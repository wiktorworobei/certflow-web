import type { CatalogFeedMessage } from "./catalogTypes";

const productLookupMethod = /\bfeed-product\b/iu;
const productLookupSentence = /(?<![^.!?\n])\s*[^.!?\n]*\bfeed-product\b[^.!?\n]*(?:[.!?]|(?=\n|$))/giu;
const productLookupInstruction = /^(?:(?:для (?:поиска|проверки)|to (?:find|check)).*?\s)?(?:воспользуйтесь|используйте|вызовите|use|call)\s+/iu;
const moderation = /(?:на модерации|under moderation|pending moderation|under review)/iu;
const missingGs1 = /(?:нет активных|не найдено активных|no active)[^.!?\n]*(?:GCP|GLN)/iu;

function catalogProviderMessage(value: string | null | undefined, lookupName: string): string {
    if (!value) return "";
    const validationText = /^(?:Ошибка валидации GTIN\.\s*)?Validation error:\s*\[gtin\s*(?:=>|⇒|→)\s*(.*?)\]\s*\.?$/isu.exec(value.trim())?.[1];
    return (validationText ?? value)
        .replace(productLookupSentence, (sentence) =>
            productLookupInstruction.test(sentence.trim()) ? "" : sentence)
        .replace(/\bfeed-product\b/giu, lookupName)
        .replace(/\s*\[(?:скрыто|redacted|hidden)\]/giu, "")
        .replace(/\s+([.!?,])/gu, "$1")
        .trim();
}

export function catalogFeedMessageSuggestsLookup(item: CatalogFeedMessage): boolean {
    return item.code === "157" ||
        item.reason === "DuplicateGtin" ||
        productLookupMethod.test(`${item.message ?? ""}\n${item.statusMessage ?? ""}`);
}

export function catalogFeedMessageLines(
    item: CatalogFeedMessage,
    translate: (key: string) => string,
): string[] {
    const providerText = `${item.message ?? ""}\n${item.statusMessage ?? ""}`;
    if (missingGs1.test(providerText)) {
        return [translate("honestSign.catalog.feedMessageText.missingGs1")];
    }
    if (item.code === "81" && (item.attributeId === 3961 || /ОКПД\s*2|OKPD\s*2/iu.test(providerText))) {
        return [translate("honestSign.catalog.feedMessageText.missingOkpd2")];
    }
    if (item.code === "157" && moderation.test(providerText)) {
        return [translate("honestSign.catalog.feedMessageText.cardUnderModeration")];
    }
    if (item.reason === "DuplicateGtin") {
        return [translate("honestSign.catalog.feedDetails.duplicateGtin")];
    }

    const lookupName = translate("honestSign.catalog.feedMessageText.cardLookupName");
    const lines = [catalogProviderMessage(item.message, lookupName), catalogProviderMessage(item.statusMessage, lookupName)];
    return [...new Set(lines.filter(Boolean))];
}
