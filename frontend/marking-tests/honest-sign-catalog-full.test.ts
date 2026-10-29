import { describe, expect, test } from "./test-compat";
import {
    buildCatalogCardRequest,
    catalogFormFromCard,
    catalogRequirements,
    catalogLayerCompletion,
    createCatalogFormSchema,
    emptyCatalogForm,
    hasCatalogFormChanges,
} from "../src/marking/lib/honest-sign/catalogForm";
import {
    catalogGtinActorKey,
    catalogGtinRecoveryKey,
    readCatalogGtinRecovery,
    writeCatalogGtinRecovery,
} from "../src/marking/lib/honest-sign/catalogGtinRecovery";

import type { CatalogFormValues } from "../src/marking/lib/honest-sign/catalogForm";
import type {
    CatalogAttribute,
    CatalogCardRequest,
} from "../src/marking/lib/honest-sign/catalogTypes";

const gtin = (body: string) =>
    `${body}${(10 - ([...body].reverse().reduce((sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 3 : 1), 0) % 10)) % 10}`;
const primary = "05011846021161";
const nested = gtin("0501184602117");
const industrial = gtin("0040000000001");
const industrialPack = gtin("0040000000002");
const attribute = (
    id: number,
    changes: Partial<CatalogAttribute> = {},
): CatalogAttribute => ({
    id,
    name: `Attribute ${id}`,
    groupName: "Synthetic",
    groupId: 24,
    fieldType: "text",
    requirement: "o",
    isMultiple: false,
    multiplicityType: null,
    presetOnly: false,
    options: [],
    valueTypes: [],
    dependencies: [],
    isFirstLayer: true,
    isSecondLayer: false,
    hasUnsupportedDictionary: false,
    ...changes,
});
const model = [
    attribute(2478),
    attribute(2504),
    attribute(2716, {
        fieldType: "number",
        requirement: "m",
        valueTypes: ["л"],
    }),
];
const values = (
    changes: Partial<CatalogFormValues> = {},
): CatalogFormValues => ({
    ...emptyCatalogForm,
    productGroupCode: "8",
    categoryId: "100",
    gtin: primary,
    name: "Synthetic dairy product",
    brand: "Test brand",
    tnved: "0401201100",
    attributes: { attr_2716: [{ value: "1", valueType: "л" }] },
    ...changes,
});
const schema = (attributes = model) =>
    createCatalogFormSchema(attributes, (key) => key);
const pack = (
    changes: Partial<CatalogFormValues["identifiers"][number]> = {},
): CatalogFormValues["identifiers"][number] => ({
    gtin: nested,
    level: "inner-pack",
    multiplier: "6",
    unit: "шт",
    packageGenerateOrder: "",
    ...changes,
});

describe("National Catalog full card contract", () => {
    test("a selected non-oil group and separate draft mode reach the typed request", () => {
        const request = buildCatalogCardRequest(values(), model, "draft");
        expect(request.productGroupCode).toBe(8);
        expect(request.sendToModeration).toBe(false);
        expect(request.identifiers).toEqual([
            { gtin: primary, level: "trade-unit", multiplier: 1, unit: "шт" },
        ]);
        expect(request.isSet).toBe(false);
        expect(request.isKit).toBe(false);
        expect(request.isSim).toBe(false);
        expect(schema().safeParse(values()).success).toBe(true);
    });

    test.each(["inner-pack", "box"] as const)(
        "standalone %s editing preserves root level, multiplier and scoped core values",
        (level) => {
            const original: CatalogCardRequest = {
                ...buildCatalogCardRequest(values(), model, "original"),
                identifiers: [
                    { gtin: primary, level, multiplier: 6, unit: "шт" },
                    { gtin: nested, level: "box", multiplier: 12, unit: "шт" },
                ],
                attributes: [
                    { id: 2716, value: "1", valueType: "л", gtin: primary },
                    {
                        id: 2478,
                        value: "Name on nested packaging",
                        valueType: null,
                        gtin: nested,
                    },
                    {
                        id: 2504,
                        value: "Nested brand",
                        valueType: null,
                        gtin: nested,
                    },
                ],
            };
            const form = catalogFormFromCard(original);
            expect(form.baseLevel).toBe(level);
            expect(form.baseMultiplier).toBe("6");
            expect(form.identifiers).toHaveLength(1);
            expect(form.identifiers[0].gtin).toBe(nested);
            expect(buildCatalogCardRequest(form, model, "update")).toEqual({
                ...original,
                requestId: "update",
                attributes: expect.arrayContaining(original.attributes),
            });
            expect(
                buildCatalogCardRequest(form, model, "update").attributes,
            ).toHaveLength(original.attributes.length);
            expect(
                hasCatalogFormChanges(
                    form,
                    catalogFormFromCard(original),
                    model,
                ),
            ).toBe(false);
            expect(schema().safeParse(form).success).toBe(true);
        },
    );

    test("non-consumer primary packaging scopes default attributes and root aliases cannot bypass multiplicity", () => {
        const form = values({ baseLevel: "box", baseMultiplier: "6" });
        expect(buildCatalogCardRequest(form, model, "box").attributes).toEqual([
            { id: 2716, value: "1", valueType: "л", gtin: primary },
        ]);
        const duplicate = values({
            attributes: {
                attr_2716: [
                    { value: "1", valueType: "л" },
                    { value: "2", valueType: "л", gtin: primary },
                ],
            },
        });
        expect(schema().safeParse(duplicate).success).toBe(false);
    });

    test("packaging dependencies stay in their own scope and primary completion ignores child values", () => {
        const scopedModel = [
            model[2],
            attribute(500, {
                dependencies: [{ value: "yes", attributeIds: [501] }],
            }),
            attribute(501, { requirement: "b" }),
        ];
        const form = values({
            identifiers: [pack()],
            sendToModeration: true,
            attributes: {
                attr_2716: [{ value: "2", valueType: "л", gtin: nested }],
                attr_500: [{ value: "yes", valueType: "", gtin: nested }],
                attr_501: [
                    { value: "inactive root", valueType: "" },
                    { value: "active child", valueType: "", gtin: nested },
                ],
            },
        });
        const required = catalogRequirements(scopedModel, form);
        expect(required.primaryRequired.has(501)).toBe(false);
        expect(required.requiredByScope.get(nested)?.has(501)).toBe(true);
        expect(catalogLayerCompletion(scopedModel, form).first.filled).toBe(0);
        expect(
            buildCatalogCardRequest(
                form,
                scopedModel,
                "scope",
            ).attributes.filter((item) => item.id === 501),
        ).toEqual([
            { id: 501, value: "active child", valueType: null, gtin: nested },
        ]);
        expect(schema(scopedModel).safeParse(form).success).toBe(false);
        form.attributes.attr_2716.push({ value: "1", valueType: "л" });
        expect(schema(scopedModel).safeParse(form).success).toBe(true);
    });

    test("sets can begin as drafts, industrial sets remain separate from industrial kits", () => {
        const emptySet = values({ composition: "set", attributes: {} });
        expect(schema([]).safeParse(emptySet).success).toBe(true);
        expect(
            schema([]).safeParse({ ...emptySet, sendToModeration: true })
                .success,
        ).toBe(false);
        expect(
            schema([]).safeParse({
                ...emptySet,
                productGroupCode: "1",
                sendToModeration: true,
            }).success,
        ).toBe(true);
        const industrialSet = values({
            productGroupCode: "28",
            gtinMode: "industrial",
            composition: "set",
            gtin: "",
            attributes: {},
            setGtins: [{ gtin: industrialPack, quantity: "2" }],
        });
        expect(schema([]).safeParse(industrialSet).success).toBe(true);
        expect(
            buildCatalogCardRequest(industrialSet, [], "industrial-set"),
        ).toMatchObject({
            gtin: "",
            isSim: true,
            isSet: true,
            isKit: false,
            identifiers: [],
            setGtins: [{ gtin: industrialPack, quantity: 2 }],
        });
        expect(
            schema([]).safeParse({ ...industrialSet, composition: "kit" })
                .success,
        ).toBe(false);
        expect(
            schema([]).safeParse({ ...industrialSet, productGroupCode: "42" })
                .success,
        ).toBe(false);
        expect(
            schema([]).safeParse({
                ...emptySet,
                setGtins: [{ gtin: industrialPack, quantity: "1" }],
            }).success,
        ).toBe(false);
    });

    test("technical and industrial creation never invent a GTIN or send unresolved packaging/photos", () => {
        for (const mode of ["technical", "industrial"] as const) {
            const form = values({
                productGroupCode: "28",
                gtinMode: mode,
                gtin: "",
                attributes: {},
            });
            expect(schema([]).safeParse(form).success).toBe(true);
            expect(buildCatalogCardRequest(form, [], "generated").gtin).toBe(
                "",
            );
            expect(
                buildCatalogCardRequest(form, [], "generated").identifiers,
            ).toEqual([]);
            expect(
                schema([]).safeParse({
                    ...form,
                    photoUrl: "https://example.com/photo.jpg",
                }).success,
            ).toBe(false);
        }
    });

    test("industrial package generation uses empty string GTIN and unique mutually exclusive orders", () => {
        const form = values({
            productGroupCode: "42",
            gtinMode: "industrial",
            gtin: industrial,
            identifiers: [pack({ gtin: "", packageGenerateOrder: "1" })],
        });
        expect(schema().safeParse(form).success).toBe(true);
        expect(
            buildCatalogCardRequest(form, model, "order").identifiers?.[1],
        ).toMatchObject({
            gtin: "",
            level: "inner-pack",
            packageGenerateOrder: 1,
        });
        expect(
            schema().safeParse({
                ...form,
                identifiers: [
                    pack({ gtin: industrialPack, packageGenerateOrder: "1" }),
                ],
            }).success,
        ).toBe(false);
        expect(
            schema().safeParse({
                ...form,
                identifiers: [
                    ...form.identifiers,
                    pack({ gtin: "", packageGenerateOrder: "1" }),
                ],
            }).success,
        ).toBe(false);
        expect(schema().safeParse({ ...form, gtin: "" }).success).toBe(false);
        expect(
            schema().safeParse({ ...form, productGroupCode: "8" }).success,
        ).toBe(false);
    });

    test("images preserve 3D arrays and scope while legacy primary photo is emitted only once", () => {
        const form = values({
            identifiers: [pack()],
            photoUrl: "https://example.com/primary.jpg",
            images: [
                {
                    photoType: "3ds",
                    urls: "https://example.com/1.jpg\nhttps://example.com/2.jpg",
                    identifier: nested,
                },
            ],
        });
        expect(schema().safeParse(form).success).toBe(true);
        const request = buildCatalogCardRequest(form, model, "images");
        expect(request.photoUrl).toBeNull();
        expect(request.images).toEqual([
            { photoType: "default", photoUrls: [form.photoUrl] },
            {
                photoType: "3ds",
                photoUrls: [
                    "https://example.com/1.jpg",
                    "https://example.com/2.jpg",
                ],
                identifier: nested,
                identifierType: "gtin",
            },
        ]);
        expect(
            schema().safeParse({
                ...form,
                images: [{ ...form.images[0], photoType: "default" }],
            }).success,
        ).toBe(false);
        expect(
            schema().safeParse({
                ...form,
                images: [
                    {
                        ...form.images[0],
                        urls: Array.from(
                            { length: 101 },
                            (_, i) => `https://example.com/${i}.jpg`,
                        ).join("\n"),
                    },
                ],
            }).success,
        ).toBe(false);
        expect(
            schema().safeParse({
                ...form,
                images: [{ ...form.images[0], identifier: industrial }],
            }).success,
        ).toBe(false);
    });

    test("full TN VED requires ten digits matching the primary prefix, and resource limits apply to total payload", () => {
        const tnvedModel = [attribute(13933)];
        const form = values({
            tnved: "0401",
            attributes: {
                attr_13933: [{ value: "0401201100", valueType: "" }],
            },
        });
        expect(schema(tnvedModel).safeParse(form).success).toBe(true);
        expect(
            schema(tnvedModel).safeParse({
                ...form,
                attributes: {
                    attr_13933: [{ value: "2710198200", valueType: "" }],
                },
            }).success,
        ).toBe(false);
        expect(schema().safeParse(values({ unit: "кг" })).success).toBe(false);
        expect(
            schema().safeParse(
                values({ identifiers: [pack({ multiplier: "1.5" })] }),
            ).success,
        ).toBe(false);
        expect(
            schema([]).safeParse(
                values({
                    identifiers: Array.from({ length: 500 }, () => pack()),
                }),
            ).success,
        ).toBe(false);
        const manyModel = [
            attribute(600, { isMultiple: true }),
            attribute(601, { isMultiple: true }),
        ];
        expect(
            schema(manyModel).safeParse(
                values({
                    attributes: {
                        attr_600: Array.from({ length: 250 }, () => ({
                            value: "a",
                            valueType: "",
                        })),
                        attr_601: Array.from({ length: 251 }, () => ({
                            value: "b",
                            valueType: "",
                        })),
                    },
                }),
            ).success,
        ).toBe(false);
    });
});

describe("Catalog GTIN generation recovery metadata", () => {
    const requestId = "11111111-1111-4111-8111-111111111111";
    test("reload restores only the request key and keeps actor, company and impersonation isolated", () => {
        const saved = new Map<string, string>();
        const storage = {
            getItem: (key: string) => saved.get(key) ?? null,
            setItem: (key: string, value: string) => {
                saved.set(key, value);
            },
            removeItem: (key: string) => {
                saved.delete(key);
            },
        };
        const actor = catalogGtinActorKey({ id: "actor" });
        expect(
            writeCatalogGtinRecovery(storage, actor, "company", requestId),
        ).toBe(true);
        expect([...saved.values()]).toEqual([requestId]);
        expect(readCatalogGtinRecovery(storage, actor, "company")).toEqual({
            requestId,
            blocked: false,
        });
        expect(
            readCatalogGtinRecovery(storage, actor, "another-company")
                .requestId,
        ).toBeNull();
        expect(
            catalogGtinActorKey({
                id: "actor",
                isImpersonated: true,
                impersonatedByUserId: "admin",
            }),
        ).not.toBe(actor);
        expect(writeCatalogGtinRecovery(storage, actor, "company", null)).toBe(
            true,
        );
        expect(
            readCatalogGtinRecovery(storage, actor, "company").requestId,
        ).toBeNull();
        saved.set(catalogGtinRecoveryKey(actor, "company"), "not-a-request-id");
        expect(readCatalogGtinRecovery(storage, actor, "company").blocked).toBe(
            true,
        );
    });
    test("missing, throwing and silently discarded storage never authorizes a generation write", () => {
        expect(readCatalogGtinRecovery(null, "actor", "company").blocked).toBe(
            true,
        );
        expect(
            writeCatalogGtinRecovery(null, "actor", "company", requestId),
        ).toBe(false);
        const unavailable = {
            getItem: () => {
                throw new Error("blocked");
            },
            setItem: () => {
                throw new Error("blocked");
            },
            removeItem: () => {},
        };
        expect(
            readCatalogGtinRecovery(unavailable, "actor", "company").blocked,
        ).toBe(true);
        expect(
            writeCatalogGtinRecovery(
                unavailable,
                "actor",
                "company",
                requestId,
            ),
        ).toBe(false);
        expect(
            writeCatalogGtinRecovery(
                {
                    getItem: () => null,
                    setItem: () => {},
                    removeItem: () => {},
                },
                "actor",
                "company",
                requestId,
            ),
        ).toBe(false);
    });
});
