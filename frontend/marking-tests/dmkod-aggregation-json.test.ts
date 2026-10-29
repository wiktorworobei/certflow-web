import { AxiosError } from "axios";
import { expect, test } from "./test-compat";
import {
    DmKodAggregationJsonError,
    DMKOD_AGGREGATION_JSON_MAX_BYTES,
    dmKodAggregationRangesExample,
    parseDmKodAggregationRangesJson,
    serializeDmKodAggregationRangesJson,
    readDmKodAggregationJsonFile,
} from "../src/marking/lib/dmkod-aggregation-json";
import {
    canSignDmKodAggregationReport,
    canPullDmKodAggregationReport,
    dmKodReportPreparationWasNotSent,
} from "../src/marking/lib/dmkod-aggregation-policy";
import {
    actionFields,
    buildExtendedAction,
    extendedDefaults,
    extendedFormSchema,
} from "../src/marking/lib/dmkod-extended-policy";
import {
    orderMarkingActions,
    withDmKodOrderTarget,
} from "../src/marking/lib/dmkod-order-layout-policy";

const reference = { order_item_id: 548, start: 1, end: 5 };
const payload = {
    containers: [
        {
            ...reference,
            capacity: "5:configured",
            parent: { order_item_id: 549, start: 1, end: 1 },
            updated_at: "2026-10-26T12:00:00+03:00",
            excluded: false,
            unpacked: false,
            mix_items: true,
        },
    ],
    attributes: {
        note: "Без потерь · 😀",
        nested: { value: [null, false, 3.5, { order_id: "metadata only" }] },
    },
};

test("aggregation JSON maps every documented field and preserves attributes and capacity types", () => {
    const parsed = parseDmKodAggregationRangesJson(
        "\uFEFF" + JSON.stringify(payload),
        157,
    );
    expect(parsed).toEqual({
        orderId: 157,
        containers: [
            {
                orderItemId: 548,
                start: 1,
                end: 5,
                capacity: "5:configured",
                parent: { orderItemId: 549, start: 1, end: 1 },
                updatedAt: payload.containers[0].updated_at,
                excluded: false,
                unpacked: false,
                mixItems: true,
            },
        ],
        attributes: payload.attributes,
    });
    expect(JSON.parse(serializeDmKodAggregationRangesJson(parsed))).toEqual(
        payload,
    );
    for (const capacity of [null, 0, -3, 5, "", "0005", "no-coercion"]) {
        const body = {
            containers: [
                { ...reference, capacity, parent: null, updated_at: null },
            ],
        };
        expect(
            JSON.parse(
                serializeDmKodAggregationRangesJson(
                    parseDmKodAggregationRangesJson(JSON.stringify(body), 157),
                ),
            ),
        ).toEqual(body);
    }
    expect(JSON.parse(dmKodAggregationRangesExample(548))).toEqual({
        containers: [{ order_item_id: 548, start: 1, end: 1 }],
    });
});

test("aggregation JSON rejects extra root/container/reference fields and invalid shapes without exposing source values", () => {
    const invalid = [
        null,
        [],
        {},
        { ...payload, order_id: 999 },
        { ...payload, orderId: 999 },
        { ...payload, company: "private-value" },
        { ...payload, url: "https://private.invalid" },
        { ...payload, clientRequestId: "private-value" },
        { ...payload, attributes: null },
        { ...payload, attributes: [] },
        { containers: [] },
        { containers: [{ ...reference, unknown: "private-value" }] },
        { containers: [{ ...reference, order_item_id: "548" }] },
        { containers: [{ ...reference, start: 0 }] },
        { containers: [{ ...reference, start: 6 }] },
        { containers: [{ ...reference, end: 1.5 }] },
        { containers: [{ ...reference, parent: 549 }] },
        {
            containers: [
                { ...reference, parent: { ...reference, unknown: 1 } },
            ],
        },
        { containers: [{ ...reference, excluded: null }] },
        { containers: [{ ...reference, mix_items: "true" }] },
        { containers: [{ ...reference, updated_at: "2026-10-26" }] },
        { containers: [{ ...reference, capacity: 1.5 }] },
    ];
    for (const body of invalid) {
        try {
            parseDmKodAggregationRangesJson(JSON.stringify(body), 157);
            throw new Error("should reject");
        } catch (error) {
            expect(error).toBeInstanceOf(DmKodAggregationJsonError);
            expect((error as Error).message).not.toContain("private-value");
        }
    }
    expect(() => parseDmKodAggregationRangesJson("{", 157)).toThrow(
        DmKodAggregationJsonError,
    );
    expect(() =>
        parseDmKodAggregationRangesJson(JSON.stringify(payload), 0),
    ).toThrow();
});

test("aggregation JSON enforces finite JSON, bounded metadata and UTF-8 file size", () => {
    expect(() =>
        parseDmKodAggregationRangesJson(
            '{"containers":[{"order_item_id":548,"start":1,"end":5}],"attributes":{"id":9007199254740993}}',
            157,
        ),
    ).toThrow(DmKodAggregationJsonError);
    expect(() =>
        parseDmKodAggregationRangesJson(
            '{"containers":[{"order_item_id":548,"start":1,"end":5}],"attributes":{"value":1e999}}',
            157,
        ),
    ).toThrow();
    for (const attributes of [
        { " ": 1 },
        { ["k".repeat(257)]: 1 },
        { "bad\nkey": 1 },
        { "bad\u0085key": 1 },
        { values: Array(100_001).fill(null) },
    ])
        expect(() =>
            parseDmKodAggregationRangesJson(
                JSON.stringify({ containers: [reference], attributes }),
                157,
            ),
        ).toThrow();
    const text = JSON.stringify({
        containers: [reference],
        attributes: { value: "я".repeat(DMKOD_AGGREGATION_JSON_MAX_BYTES / 2) },
    });
    expect(() => parseDmKodAggregationRangesJson(text, 157)).toThrow(
        DmKodAggregationJsonError,
    );
});

test("JSON files decode strict UTF-8 and reject oversized input before reading", async () => {
    const valid = new File(["\uFEFF" + JSON.stringify(payload)], "input.json");
    expect(await readDmKodAggregationJsonFile(valid, 157)).toEqual(
        parseDmKodAggregationRangesJson(JSON.stringify(payload), 157),
    );
    await expect(
        readDmKodAggregationJsonFile(
            new File([new Uint8Array([0xff, 0xfe, 0x80])], "invalid.json"),
            157,
        ),
    ).rejects.toBeInstanceOf(DmKodAggregationJsonError);
    let read = false;
    await expect(
        readDmKodAggregationJsonFile(
            {
                name: "large.json",
                size: DMKOD_AGGREGATION_JSON_MAX_BYTES + 1,
                arrayBuffer: async () => {
                    read = true;
                    return new ArrayBuffer(0);
                },
            },
            157,
        ),
    ).rejects.toBeInstanceOf(DmKodAggregationJsonError);
    expect(read).toBe(false);
    const attributes = JSON.parse(
        '{"__proto__":{"preserved":true},"constructor":[null,false]}',
    );
    const parsed = parseDmKodAggregationRangesJson(
        JSON.stringify({ containers: [reference], attributes }),
        157,
    );
    expect(
        JSON.parse(serializeDmKodAggregationRangesJson(parsed)).attributes,
    ).toEqual(attributes);
    expect(({} as Record<string, unknown>).preserved).toBeUndefined();
});

test("the selected order owns the new payload and legacy format is not the primary order action", () => {
    const values = withDmKodOrderTarget(
        "PushAggregationRanges",
        {
            ...extendedDefaults,
            id: "999",
            aggregationRanges: JSON.stringify(payload),
            aggregation: "must not leak",
        },
        157,
    );
    expect(
        extendedFormSchema(
            actionFields("PushAggregationRanges"),
            "invalid",
        ).safeParse(values).success,
    ).toBe(true);
    const request = buildExtendedAction(
        "PushAggregationRanges",
        values,
        "intent",
    );
    expect(request.aggregationRanges?.orderId).toBe(157);
    expect(request.id).toBeUndefined();
    expect(request.aggregation).toBeUndefined();
    expect(orderMarkingActions.aggregation[0]).toBe("PushAggregationRanges");
    expect(orderMarkingActions.aggregation).not.toContain("PushAggregation");
});

test("aggregation signing requires server permission, a fresh CREATED report and all successful dependencies", () => {
    const report = {
        id: 51,
        canSign: true,
        state: "CREATED",
        uuid: null,
        createdAtUtc: null,
        failureReason: null,
        precedingAggregationReportIds: [50],
        precedesAggregationReportId: null,
    };
    const previous = {
        ...report,
        id: 50,
        state: "SUCCESS",
        precedingAggregationReportIds: [],
    };
    expect(canSignDmKodAggregationReport(report, [report, previous])).toBe(
        true,
    );
    expect(
        canSignDmKodAggregationReport({ ...report, canSign: false }, [
            report,
            previous,
        ]),
    ).toBe(false);
    expect(canSignDmKodAggregationReport(report, [report])).toBe(false);
    expect(
        canSignDmKodAggregationReport(report, [
            report,
            { ...previous, state: "PARTIAL" },
        ]),
    ).toBe(false);
    expect(
        canSignDmKodAggregationReport(report, [report, previous], true),
    ).toBe(false);
    for (const state of [
        "SIGNED",
        "PENDING",
        "SUCCESS",
        "FAILED",
        "PARTIAL",
        "PARTIALLY",
        "UNKNOWN",
    ])
        expect(
            canSignDmKodAggregationReport({ ...report, state }, [
                report,
                previous,
            ]),
        ).toBe(false);
});

test("aggregation pulls only submitted reports and releases only explicit unsent signing preparations", () => {
    for (const state of ["SIGNED", "PENDING"])
        expect(canPullDmKodAggregationReport({ state })).toBe(true);
    for (const state of [
        "CREATED",
        "SUCCESS",
        "PARTIALLY",
        "FAILED",
        "DECLINED",
        "UNKNOWN",
    ])
        expect(canPullDmKodAggregationReport({ state })).toBe(false);
    const rejected = new AxiosError(
        "synthetic preparation expired",
        "ERR_BAD_REQUEST",
        undefined,
        undefined,
        {
            status: 409,
            statusText: "Conflict",
            config: {} as never,
            headers: {},
            data: { code: "error.dmkod_report_payload_changed" },
        },
    );
    expect(dmKodReportPreparationWasNotSent(rejected, "SignAggregation")).toBe(
        true,
    );
    expect(dmKodReportPreparationWasNotSent(rejected, "SignValidation")).toBe(
        true,
    );
    expect(
        dmKodReportPreparationWasNotSent(rejected, "PushAggregationRanges"),
    ).toBe(false);
    expect(
        dmKodReportPreparationWasNotSent(
            new AxiosError("synthetic timeout", "ECONNABORTED"),
            "SignAggregation",
        ),
    ).toBe(false);
    expect(
        dmKodReportPreparationWasNotSent(
            new AxiosError(
                "synthetic pending",
                "ERR_BAD_REQUEST",
                undefined,
                undefined,
                {
                    status: 409,
                    statusText: "Conflict",
                    config: {} as never,
                    headers: {},
                    data: { code: "error.dmkod_order_operation_pending" },
                },
            ),
            "SignAggregation",
        ),
    ).toBe(false);
});
