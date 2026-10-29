import { z } from "zod";

import type {
    DmKodAggregationRangesPush,
    DmKodJsonValue,
} from "@marking/lib/dmkod-extended-types";

export const DMKOD_AGGREGATION_JSON_MAX_BYTES = 10 * 1024 * 1024;
const integer = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const reference = z
    .strictObject({
        order_item_id: integer,
        start: integer,
        end: integer,
    })
    .refine((value) => value.start <= value.end);
const container = reference.safeExtend({
    capacity: z
        .union([
            z
                .number()
                .int()
                .min(Number.MIN_SAFE_INTEGER)
                .max(Number.MAX_SAFE_INTEGER),
            z.string(),
            z.null(),
        ])
        .optional(),
    parent: reference.nullable().optional(),
    updated_at: z.iso.datetime({ offset: true }).nullable().optional(),
    excluded: z.boolean().optional(),
    unpacked: z.boolean().optional(),
    mix_items: z.boolean().optional(),
});
const body = z.strictObject({
    containers: z.array(container).min(1).max(10_000),
    attributes: z
        .custom<Record<string, unknown>>(
            (value) =>
                value !== null &&
                typeof value === "object" &&
                !Array.isArray(value),
        )
        .optional(),
});

export class DmKodAggregationJsonError extends Error {
    constructor(
        public readonly kind: "syntax" | "structure" | "size" | "encoding",
    ) {
        super(`Invalid aggregation JSON: ${kind}`);
    }
}

function jsonValue(
    value: unknown,
    depth = 0,
    budget = { nodes: 0 },
): DmKodJsonValue {
    if (depth > 16 || ++budget.nodes > 100_000)
        throw new DmKodAggregationJsonError("structure");
    if (
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean"
    )
        return value;
    if (
        typeof value === "number" &&
        Number.isFinite(value) &&
        (!Number.isInteger(value) || Number.isSafeInteger(value))
    )
        return value;
    if (Array.isArray(value))
        return value.map((entry) => jsonValue(entry, depth + 1, budget));
    if (value && typeof value === "object")
        return Object.fromEntries(
            Object.entries(value).map(([key, entry]) => {
                if (!key.trim() || key.length > 256 || /\p{Cc}/u.test(key))
                    throw new DmKodAggregationJsonError("structure");
                return [key, jsonValue(entry, depth + 1, budget)];
            }),
        );
    throw new DmKodAggregationJsonError("structure");
}

/** The document supplies composition only. Company and selected order remain outside it. */
export function parseDmKodAggregationRangesJson(
    text: string,
    orderId: number,
): DmKodAggregationRangesPush {
    if (
        new TextEncoder().encode(text).byteLength >
        DMKOD_AGGREGATION_JSON_MAX_BYTES
    )
        throw new DmKodAggregationJsonError("size");
    if (!integer.safeParse(orderId).success)
        throw new DmKodAggregationJsonError("structure");
    let parsed: unknown;
    try {
        parsed = JSON.parse(text.replace(/^\uFEFF/, ""));
    } catch {
        throw new DmKodAggregationJsonError("syntax");
    }
    const result = body.safeParse(parsed);
    if (!result.success) throw new DmKodAggregationJsonError("structure");
    const value = result.data;
    const request: DmKodAggregationRangesPush = {
        orderId,
        containers: value.containers.map((entry) => ({
            orderItemId: entry.order_item_id,
            start: entry.start,
            end: entry.end,
            ...(entry.capacity !== undefined
                ? { capacity: entry.capacity }
                : {}),
            ...(entry.parent !== undefined
                ? {
                      parent: entry.parent && {
                          orderItemId: entry.parent.order_item_id,
                          start: entry.parent.start,
                          end: entry.parent.end,
                      },
                  }
                : {}),
            ...(entry.updated_at !== undefined
                ? { updatedAt: entry.updated_at }
                : {}),
            ...(entry.excluded !== undefined
                ? { excluded: entry.excluded }
                : {}),
            ...(entry.unpacked !== undefined
                ? { unpacked: entry.unpacked }
                : {}),
            ...(entry.mix_items !== undefined
                ? { mixItems: entry.mix_items }
                : {}),
        })),
        ...(value.attributes !== undefined
            ? {
                  attributes: jsonValue(value.attributes) as {
                      [key: string]: DmKodJsonValue;
                  },
              }
            : {}),
    };
    if (
        new TextEncoder().encode(JSON.stringify(request)).byteLength >
        12 * 1024 * 1024
    )
        throw new DmKodAggregationJsonError("size");
    return request;
}

export function serializeDmKodAggregationRangesJson(
    value: DmKodAggregationRangesPush,
): string {
    const external = {
        containers: value.containers.map((entry) => ({
            order_item_id: entry.orderItemId,
            start: entry.start,
            end: entry.end,
            ...(entry.capacity !== undefined
                ? { capacity: entry.capacity }
                : {}),
            ...(entry.parent !== undefined
                ? {
                      parent: entry.parent && {
                          order_item_id: entry.parent.orderItemId,
                          start: entry.parent.start,
                          end: entry.parent.end,
                      },
                  }
                : {}),
            ...(entry.updatedAt !== undefined
                ? { updated_at: entry.updatedAt }
                : {}),
            ...(entry.excluded !== undefined
                ? { excluded: entry.excluded }
                : {}),
            ...(entry.unpacked !== undefined
                ? { unpacked: entry.unpacked }
                : {}),
            ...(entry.mixItems !== undefined
                ? { mix_items: entry.mixItems }
                : {}),
        })),
        ...(value.attributes !== undefined
            ? { attributes: value.attributes }
            : {}),
    };
    const text = JSON.stringify(external, null, 2);
    parseDmKodAggregationRangesJson(text, value.orderId);
    return text;
}

export function dmKodAggregationRangesExample(orderItemId = 1): string {
    return serializeDmKodAggregationRangesJson({
        orderId: 1,
        containers: [
            {
                orderItemId,
                start: 1,
                end: 1,
            },
        ],
    });
}

export async function readDmKodAggregationJsonFile(
    file: Pick<File, "name" | "size" | "arrayBuffer">,
    orderId: number,
): Promise<DmKodAggregationRangesPush> {
    if (file.size > DMKOD_AGGREGATION_JSON_MAX_BYTES)
        throw new DmKodAggregationJsonError("size");
    if (!/\.json$/i.test(file.name))
        throw new DmKodAggregationJsonError("structure");
    const bytes = await file.arrayBuffer();
    if (bytes.byteLength > DMKOD_AGGREGATION_JSON_MAX_BYTES)
        throw new DmKodAggregationJsonError("size");
    let text: string;
    try {
        text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
        throw new DmKodAggregationJsonError("encoding");
    }
    return parseDmKodAggregationRangesJson(text, orderId);
}
