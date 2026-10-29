import type {
    CreateOrderProductDraft,
    CreateOrderProductTouchedState,
    OrderTemplateOption,
} from "@marking/components/honest-sign/types";

export const PRODUCT_GROUP_LABELS: Record<string, string> = {
    milk: "Молочная продукция",
    alcohol: "Алкогольная продукция",
    autofluids: "Моторные масла",
    construction: "Строительные материалы",
    beer: "Напитки",
    tobacco: "Табачная продукция",
    water: "Упакованная вода",
    "soft-drinks": "Безалкогольные напитки",
    shoes: "Обувь",
};

export const ORDER_TEMPLATE_OPTIONS: OrderTemplateOption[] = [
    {
        id: 1,
        category: "Обувные товары",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (88 символов)",
    },
    {
        id: 3,
        category: "Табачная продукция - блоки",
        format: "01 GTIN + 21 SERIAL (7 символов) + 8005 (000000) + 93 (4 символа)",
    },
    {
        id: 4,
        category: "Табачная продукция - пачки (non-GS1)",
        format: "GTIN + SERIAL (7 символов) + МРЦ (4 символа) + КП (4 символа)",
    },
    {
        id: 5,
        category: "Лекарственные препараты для медицинского применения",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 7,
        category: "Шины и покрышки пневматические резиновые новые",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 8,
        category: "Фотокамеры (кроме кинокамер), фотовспышки и лампы-вспышки",
        format: "01 GTIN + 21 SERIAL (20 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 9,
        category: "Духи и туалетная вода",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 10,
        category:
            "Предметы одежды, белье постельное, столовое, туалетное и кухонное",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 11,
        category: "Велосипеды и велосипедные рамы",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 12,
        category: "Медицинские изделия",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа) / 97 (base64)",
    },
    {
        id: 14,
        category: "Альтернативная табачная продукция (GS1)",
        format: "01 GTIN + 21 SERIAL (7 символов) + 8005 (000000) + 93 (4 символа)",
    },
    {
        id: 15,
        category: "Альтернативная табачная продукция (non-GS1)",
        format: "GTIN + SERIAL (7 символов) + МРЦ (АААА) + КП (4 символа)",
    },
    {
        id: 16,
        category: "Упакованная вода",
        format: "01 GTIN + 21 SERIAL (13 символов) + 93 (4 символа)",
    },
    {
        id: 18,
        category:
            "Пиво, напитки, изготавливаемые на основе пива и слабоалкогольные напитки",
        format: "01 GTIN + 21 SERIAL (7 символов) + 93 (4 символа) / 335Y (6 символов)",
    },
    {
        id: 20,
        category: "Молочная продукция",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа) / 3103 (6 символов)",
    },
    {
        id: 21,
        category: "Никотиносодержащая продукция (блоки)",
        format: "01 GTIN + 21 SERIAL (7 символов) + 8005 (000000) + 93 (4 символа)",
    },
    {
        id: 22,
        category: "Никотиносодержащая продукция - пачки (non-GS1)",
        format: "GTIN + SERIAL (7 символов) + МРЦ (АААА) + КП (4 символа)",
    },
    {
        id: 23,
        category: "Биологически активные добавки к пище",
        format: "01 GTIN + 21 SERIAL (13 символов) + 93 (4 символа)",
    },
    {
        id: 25,
        category:
            "Антисептики и дезинфицирующие средства (потребительская и групповая упаковка)",
        format: "01 GTIN + 21 SERIAL (13 символов) + 93 (4 символа)",
    },
    {
        id: 26,
        category: "Корма для животных",
        format: "01 GTIN + 21 SERIAL (6 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 27,
        category: "Морепродукты",
        format: "01 GTIN + 21 SERIAL (6 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 28,
        category: "Безалкогольное пиво",
        format: "01 GTIN + 21 SERIAL (7 символов) + 93 (4 символа) / 335Y (6 символов)",
    },
    {
        id: 29,
        category: "Соковая продукция и безалкогольные напитки",
        format: "01 GTIN + 21 SERIAL (13 символов) + 93 (4 символа)",
    },
    {
        id: 30,
        category: "Биологически активные добавки к пище",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 31,
        category: "Антисептики и дезинфицирующие средства",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 32,
        category: "Мясные изделия",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 34,
        category: "Игры и игрушки для детей",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 36,
        category: "Радиоэлектронная продукция",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа) / 30 (1-8 символов) / 310Y (6 символов) / 311Y (6 символов) / 335Y (6 символов)",
    },
    {
        id: 37,
        category: "Радиоэлектронная продукция",
        format: "01 GTIN + 21 SERIAL (13 символов) + 93 (4 символа) / 30 (1-8 символов) / 310Y (6 символов) / 311Y (6 символов) / 335Y (6 символов)",
    },
    {
        id: 38,
        category: "Морепродукты",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 39,
        category: "Титановая металлопродукция",
        format: "01 GTIN + 21 SERIAL (13 символов) + 93 (4 символа)",
    },
    {
        id: 40,
        category: "Растительные масла",
        format: "01 GTIN + 21 SERIAL (13 символов) + 93 (4 символа)",
    },
    {
        id: 41,
        category: "Корма для животных",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 42,
        category: "Бакалейная продукция",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 43,
        category: "Бакалейная продукция",
        format: "01 GTIN + 21 SERIAL (13 символов) + 93 (4 символа)",
    },
    {
        id: 44,
        category: "Оптоволокно и оптоволоконная продукция",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 45,
        category: "Оптоволокно и оптоволоконная продукция",
        format: "01 GTIN + 21 SERIAL (13 символов) + 93 (4 символа)",
    },
    {
        id: 46,
        category: "Косметика, бытовая химия и товары личной гигиены",
        format: "01 GTIN + 21 SERIAL (6 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 47,
        category: "Косметика, бытовая химия и товары личной гигиены",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 48,
        category: "Консервированная продукция",
        format: "01 GTIN + 21 SERIAL (6 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 49,
        category: "Консервированная продукция",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 50,
        category: "Ветеринарные препараты",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 51,
        category: "Растительные масла",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 52,
        category: "Печатная продукция",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 53,
        category: "Строительные материалы",
        format: "01 GTIN + 21 SERIAL (13 символов) + 93 (4 символа)",
    },
    {
        id: 54,
        category: "Строительные материалы",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 55,
        category:
            "Пиротехнические изделия и средства обеспечения пожарной безопасности и пожаротушения",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 56,
        category:
            "Пиротехнические изделия и средства обеспечения пожарной безопасности и пожаротушения",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 57,
        category: "Отопительные приборы",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 58,
        category: "Отопительные приборы",
        format: "01 GTIN + 21 SERIAL (6 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 59,
        category: "Игры и игрушки для детей",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 60,
        category: "Моторные масла",
        format: "01 GTIN + 21 SERIAL (13 символов) + 93 (4 символа)",
    },
    {
        id: 61,
        category: "Моторные масла",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 62,
        category: "Кабельно-проводниковая продукция",
        format: "01 GTIN + 21 SERIAL (13 символов) + 93 (4 символа)",
    },
    {
        id: 63,
        category: "Кабельно-проводниковая продукция",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 64,
        category: "Полимерные трубы",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 65,
        category: "Полимерные трубы",
        format: "01 GTIN + 21 SERIAL (6 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 66,
        category: "Сладости и кондитерские изделия",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 67,
        category: "Сладости и кондитерские изделия",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 68,
        category: "Автозапчасти и комплектующие транспортных средств",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 69,
        category: "Автозапчасти и комплектующие транспортных средств",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 70,
        category:
            "Радиоэлектронная продукция. Электронные системы доставки никотина",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 71,
        category:
            "Радиоэлектронная продукция. Электронные системы доставки никотина",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 72,
        category: "Радиоэлектронная продукция. Ноутбуки и смартфоны",
        format: "01 GTIN + 21 SERIAL (20 символов) + 93 (4 символа)",
    },
    {
        id: 73,
        category: "Радиоэлектронная продукция. Ноутбуки и смартфоны",
        format: "01 GTIN + 21 SERIAL (20 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 74,
        category: "Мясные изделия",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
    {
        id: 75,
        category: "Кормовые добавки",
        format: "01 GTIN + 21 SERIAL (6 символов) + 93 (4 символа)",
    },
    {
        id: 76,
        category: "Кормовые добавки",
        format: "01 GTIN + 21 SERIAL (13 символов) + 91 (4 символа) + 92 (44 символа)",
    },
];

export const PAYMENT_TYPE_MAP: Record<string, number> = {
    "Оплата по нанесению": 2,
    "Оплата по эмиссии": 1,
};

export const PAYMENT_TYPE_OPTIONS = Object.keys(PAYMENT_TYPE_MAP);

export const RELEASE_METHOD_TYPE_MAP: Record<string, string> = {
    "Произведён в РФ": "PRODUCTION",
    "Ввезён в РФ": "IMPORT",
};

export const RELEASE_METHOD_OPTIONS = Object.keys(RELEASE_METHOD_TYPE_MAP);

export const SERIAL_NUMBER_TYPE_MAP: Record<string, string> = {
    Пользователем: "SELF_MADE",
    Автоматически: "OPERATOR",
};

// Manual serial numbers require an explicit array matching the requested quantity.
// The current wizard intentionally exposes only operator generation until that
// protected input flow is implemented.
export const SERIAL_NUMBER_OPTIONS = ["Автоматически"] as const;

export const CIS_TYPE_MAP: Record<string, string> = {
    "Групповая потребительская упаковка": "GROUP",
    "Единица товара": "UNIT",
    Набор: "SET",
};

export const CIS_TYPE_OPTIONS = Object.keys(CIS_TYPE_MAP);

export const DEFAULT_TEMPLATE_ID =
    ORDER_TEMPLATE_OPTIONS.find((option) => option.id === 20)?.id ??
    ORDER_TEMPLATE_OPTIONS[0]?.id ??
    0;

export const PRODUCT_GROUP_DEFAULT_TEMPLATE_IDS: Record<string, number> = {
    milk: DEFAULT_TEMPLATE_ID,
    autofluids:
        ORDER_TEMPLATE_OPTIONS.find(
            (option) => option.category === "Моторные масла",
        )?.id ?? DEFAULT_TEMPLATE_ID,
};

export const createEmptyProductDraft = (): CreateOrderProductDraft => ({
    gtin: "",
    quantity: "",
    serialNumberType: "Автоматически",
    cisType: "Единица товара",
});

export const createEmptyProductTouchedState =
    (): CreateOrderProductTouchedState => ({
        gtin: false,
        quantity: false,
        serialNumberType: false,
        cisType: false,
    });
