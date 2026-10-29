import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { utilisationBatchKeys } from "@marking/hooks/use-utilisation-batches";
import { documentsApiService } from "@marking/lib/honest-sign/documentsApiService";
import i18n from "@marking/src/i18n";
import { useAuthStore } from "@marking/src/store/auth";

/** Each authenticated call processes at most one already signed server item. Never retries a POST. */
export function useUtilisationBatchProcessor(companyId: string) {
    const client = useQueryClient();
    const actorId = useAuthStore((state) => state.user?.id ?? "anonymous");
    const mounted = useRef(true);
    const running = useRef(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    const processBatch = async (id: string) => {
        if (running.current) return;
        running.current = true;
        setIsProcessing(true);
        setError("");
        try {
            let batch = await documentsApiService.getUtilisationBatch(id);
            client.setQueryData(
                utilisationBatchKeys.detail(companyId, actorId, id),
                batch,
            );
            for (let count = 0; count < 20 && mounted.current; count++) {
                if (
                    (useAuthStore.getState().user?.id ?? "anonymous") !==
                    actorId
                )
                    break;
                if (
                    batch.state !== "Queued" ||
                    !batch.items.some((item) => item.state === "Queued")
                )
                    break;
                const next =
                    await documentsApiService.processUtilisationBatchNext(id);
                client.setQueryData(
                    utilisationBatchKeys.detail(companyId, actorId, id),
                    next,
                );
                void client.invalidateQueries({
                    queryKey: utilisationBatchKeys.all(companyId, actorId),
                });
                const previousQueued = batch.items.filter(
                    (item) => item.state === "Queued",
                ).length;
                batch = next;
                if (
                    batch.items.filter((item) => item.state === "Queued")
                        .length >= previousQueued
                )
                    break;
            }
        } catch (cause) {
            if (mounted.current)
                setError(
                    cause instanceof Error
                        ? cause.message
                        : i18n.t("honestSign.documents.batch.errors.process"),
                );
            // A lost response does not imply that CRPT rejected the report. Reload the durable receipt only.
            void client.invalidateQueries({
                queryKey: utilisationBatchKeys.detail(companyId, actorId, id),
            });
        } finally {
            running.current = false;
            if (mounted.current) setIsProcessing(false);
            void client.invalidateQueries({
                queryKey: utilisationBatchKeys.all(companyId, actorId),
            });
        }
    };
    return { processBatch, isProcessing, error };
}
