import { expect, test } from "./test-compat";
import {
    buildUtilisationBatchFilePayload,
    countUtilisationBatchDuplicates,
    createUtilisationBatchFile,
    parseUtilisationBatchFile,
    validateUtilisationBatchFile,
} from "../src/marking/lib/honest-sign/utilisationBatch";

const codeA = "010460123456789021SYNTHETIC-A\u001d93fake";
const codeB = "010460123456789021SYNTHETIC-B\u001d93fake";
const oilFile = (id: string, code: string, expiry: string) => ({
    ...createUtilisationBatchFile(
        id,
        { name: `${id}.txt`, size: 100 },
        [code],
        "autofluids",
    ),
    productionDate: "2026-10-01",
    expirationDate: expiry,
});

test("each uploaded file retains its own expiry date and complete codes in a separate signed report", () => {
    const one = oilFile("one", codeA, "2028-10-01");
    const two = oilFile("two", codeB, "2029-10-01");
    const first = buildUtilisationBatchFilePayload(one, "autofluids");
    const second = buildUtilisationBatchFilePayload(two, "autofluids");
    expect(first.attributes).toEqual({
        productionDate: "2026-10-01",
        expirationDate: "2028-10-01",
    });
    expect(second.attributes).toEqual({
        productionDate: "2026-10-01",
        expirationDate: "2029-10-01",
    });
    expect(first.sntins).toEqual([codeA]);
    expect(second.sntins).toEqual([codeB]);
    expect(Object.keys(first).sort()).toEqual([
        "attributes",
        "productGroup",
        "sntins",
    ]);
    expect(JSON.stringify(first)).not.toContain("one.txt");
    expect(one.expirationDate).toBe("2028-10-01");
});

test("cross-file duplicates use canonical CIS even when crypto tails or separator spelling differ", () => {
    expect(
        countUtilisationBatchDuplicates([
            { codes: [codeA] },
            { codes: [codeB] },
        ]),
    ).toBe(0);
    expect(
        countUtilisationBatchDuplicates([
            { codes: [codeA] },
            { codes: [codeA.replace("\u001d93fake", "<GS>93other-tail")] },
        ]),
    ).toBe(1);
    expect(countUtilisationBatchDuplicates([{ codes: [codeA, codeA] }])).toBe(
        1,
    );
});

test("file reader handles BOM, CRLF and one-column CSV escaping while retaining the crypto tail", () => {
    expect(
        parseUtilisationBatchFile(
            `\uFEFF"${codeA.replace("\u001d", "\\u001d")}"\r\n\r\n${codeB}\n`,
        ),
    ).toEqual([codeA, codeB]);
    expect(parseUtilisationBatchFile('"serial""quote"\r')).toEqual([
        'serial"quote',
    ]);
});

test("each oil file requires its own valid production and strictly future expiry dates", () => {
    const valid = oilFile("one", codeA, "2028-10-01");
    expect(
        validateUtilisationBatchFile(
            valid,
            "autofluids",
            "2026-10-22",
            "2026-10-22T12:00",
        ).valid,
    ).toBe(true);
    expect(
        validateUtilisationBatchFile(
            { ...valid, productionDate: "" },
            "autofluids",
            "2026-10-22",
            "2026-10-22T12:00",
        ).valid,
    ).toBe(false);
    expect(
        validateUtilisationBatchFile(
            { ...valid, expirationDate: "2026-10-22" },
            "autofluids",
            "2026-10-22",
            "2026-10-22T12:00",
        ).expirationDate,
    ).toBe(false);
    expect(
        validateUtilisationBatchFile(
            { ...valid, productionDate: "2026-10-23" },
            "autofluids",
            "2026-10-22",
            "2026-10-22T12:00",
        ).productionDate,
    ).toBe(false);
    expect(
        validateUtilisationBatchFile(
            { ...valid, expirationDate: "2027-02-29" },
            "autofluids",
            "2026-10-22",
            "2026-10-22T12:00",
        ).expirationDate,
    ).toBe(false);
});

test("milk storage conditions remain conditions inside one file, never expiry dates shared across files", () => {
    const file = {
        ...createUtilisationBatchFile(
            "milk",
            { name: "milk.csv", size: 50 },
            [codeA],
            "milk",
        ),
        productionDate: "2026-10-01",
        expirationMode: "milk-storage-conditions" as const,
        expirationConditions: [
            { storageConditionIndex: "1", expirationDate: "2027-01-01" },
            { storageConditionIndex: "2", expirationDate: "2027-02-01" },
        ],
    };
    expect(
        validateUtilisationBatchFile(
            file,
            "milk",
            "2026-10-22",
            "2026-10-22T12:00",
        ).valid,
    ).toBe(true);
    expect(
        buildUtilisationBatchFilePayload(file, "milk").attributes
            .expDateConditions,
    ).toEqual({ "1": "2027-01-01", "2": "2027-02-01" });
    expect(
        buildUtilisationBatchFilePayload({ ...file, cisType: "GROUP" }, "milk")
            .attributes,
    ).toEqual({ usedInProduction: 0 });
});

test("per-file code limit cannot be bypassed by valid dates", () => {
    const file = oilFile("large", codeA, "2028-10-01");
    expect(
        validateUtilisationBatchFile(
            { ...file, codes: [] },
            "autofluids",
            "2026-10-22",
            "2026-10-22T12:00",
        ).codes,
    ).toBe(false);
    expect(
        validateUtilisationBatchFile(
            { ...file, codes: Array(30_001).fill(codeA) },
            "autofluids",
            "2026-10-22",
            "2026-10-22T12:00",
        ).codes,
    ).toBe(false);
});
