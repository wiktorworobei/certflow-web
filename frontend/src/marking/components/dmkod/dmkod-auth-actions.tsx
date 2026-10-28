import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useDmKodScope } from "@marking/components/dmkod/dmkod-scope-context";
import { Alert, AlertDescription } from "@marking/components/ui/alert";
import { Button } from "@marking/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@marking/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@marking/components/ui/form";
import { Input } from "@marking/components/ui/input";
import { dmKodWorkflowApi } from "@marking/lib/api/dmkod-workflow";
import { dmKodScopeKey } from "@marking/lib/dmkod-scope";

export function DmKodAuthActions({
    companyId,
    trigger = "both",
}: {
    companyId: string;
    trigger?: "both" | "register" | "reset";
}) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const [mode, setMode] = useState<"register" | "reset" | null>(null);
    const [confirm, setConfirm] = useState(false);
    const [result, setResult] = useState<string | null>(null);
    const form = useForm<{ username: string; email: string; nickname: string }>(
        {
            resolver: zodResolver(
                z.object({
                    username:
                        mode === "register"
                            ? z
                                  .string()
                                  .trim()
                                  .min(3, t("dmkod.workflow.invalid"))
                                  .max(20, t("dmkod.workflow.invalid"))
                            : z.string(),
                    email: z.email(t("dmkod.workflow.invalid")),
                    nickname: z
                        .string()
                        .trim()
                        .refine(
                            (value) =>
                                !value ||
                                (value.length >= 3 && value.length <= 20),
                            t("dmkod.workflow.invalid"),
                        ),
                }),
            ),
            defaultValues: { username: "", email: "", nickname: "" },
        },
    );
    const submit = useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: async () => {
            const values = form.getValues();
            if (mode === "register")
                await dmKodWorkflowApi.register(scope, {
                    username: values.username.trim(),
                    email: values.email,
                    nickname: values.nickname.trim() || undefined,
                });
            else await dmKodWorkflowApi.resetPassword(scope, values.email);
        },
        onSuccess: () => {
            setResult(t("dmkod.authActions.sent"));
            setConfirm(false);
            form.reset();
        },
    });
    const open = (value: "register" | "reset") => {
        setMode(value);
        setConfirm(false);
        setResult(null);
        submit.reset();
        form.reset();
    };
    return (
        <>
            <div className="flex flex-wrap gap-2">
                {trigger !== "reset" ? (
                    <Button
                        variant="link"
                        className="h-auto p-0 text-sm"
                        type="button"
                        onClick={() => open("register")}
                    >
                        {t("dmkod.authActions.register")}
                    </Button>
                ) : null}
                {trigger !== "register" ? (
                    <Button
                        variant="link"
                        className="h-auto p-0 text-sm"
                        type="button"
                        onClick={() => open("reset")}
                    >
                        {t("dmkod.authActions.reset")}
                    </Button>
                ) : null}
            </div>
            <Dialog
                open={!!mode}
                onOpenChange={(value) => {
                    if (!value && !submit.isPending) {
                        setMode(null);
                        form.reset();
                    }
                }}
            >
                <DialogContent className="integration-theme dmkod-theme">
                    <DialogHeader>
                        <DialogTitle>
                            {t(
                                mode === "register"
                                    ? "dmkod.authActions.register"
                                    : "dmkod.authActions.reset",
                            )}
                        </DialogTitle>
                        <DialogDescription>
                            {t("dmkod.authActions.description", {
                                environment: scope.environment,
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    {result ? (
                        <Alert>
                            <AlertDescription>{result}</AlertDescription>
                        </Alert>
                    ) : (
                        <Form {...form}>
                            <form
                                className="space-y-3"
                                onSubmit={form.handleSubmit(() =>
                                    setConfirm(true),
                                )}
                            >
                                {(mode === "register"
                                    ? ([
                                          "username",
                                          "email",
                                          "nickname",
                                      ] as const)
                                    : (["email"] as const)
                                ).map((name) => (
                                    <FormField
                                        key={name}
                                        control={form.control}
                                        name={name}
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>
                                                    {t(
                                                        `dmkod.authActions.${name}`,
                                                    )}
                                                </FormLabel>
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        type={
                                                            name === "email"
                                                                ? "email"
                                                                : "text"
                                                        }
                                                        autoComplete={
                                                            name === "email"
                                                                ? "email"
                                                                : "off"
                                                        }
                                                        disabled={
                                                            submit.isPending ||
                                                            confirm
                                                        }
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ))}
                                {submit.isError ? (
                                    <Alert variant="destructive">
                                        <AlertDescription>
                                            {isAxiosError<{ message?: string }>(
                                                submit.error,
                                            )
                                                ? submit.error.response?.data
                                                      ?.message ||
                                                  t("dmkod.workflow.failed")
                                                : t("dmkod.workflow.failed")}
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                                {confirm ? (
                                    <Alert>
                                        <AlertDescription>
                                            {t("dmkod.authActions.confirm", {
                                                email: form.getValues("email"),
                                                environment: scope.environment,
                                            })}
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={submit.isPending}
                                        onClick={() =>
                                            confirm
                                                ? setConfirm(false)
                                                : setMode(null)
                                        }
                                    >
                                        {t("common.cancel")}
                                    </Button>
                                    {confirm ? (
                                        <Button
                                            type="button"
                                            disabled={submit.isPending}
                                            onClick={() => submit.mutate()}
                                        >
                                            {t("dmkod.workflow.confirm")}
                                        </Button>
                                    ) : (
                                        <Button type="submit">
                                            {t("dmkod.workflow.execute")}
                                        </Button>
                                    )}
                                </DialogFooter>
                            </form>
                        </Form>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
