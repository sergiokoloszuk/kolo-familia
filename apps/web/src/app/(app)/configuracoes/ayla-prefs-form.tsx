"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarAylaPrefs, type SalvarAylaPrefsInput } from "./actions";

export function AylaPrefsForm({
  inicial,
  consentimento,
  pausadaAte,
}: {
  inicial: SalvarAylaPrefsInput;
  consentimento: boolean;
  pausadaAte: string | null | undefined;
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [form, setForm] = useState<SalvarAylaPrefsInput>(inicial);

  function set<K extends keyof SalvarAylaPrefsInput>(k: K, v: SalvarAylaPrefsInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSucesso(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      try {
        await salvarAylaPrefs(form);
        setSucesso(true);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="rounded-md border border-green-300/60 bg-green-50 px-3 py-2 text-sm text-green-900">
          Salvo.
        </div>
      )}

      {pausadaAte && new Date(pausadaAte) > new Date() && (
        <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Acompanhamento pausado até {pausadaAte}. Você pode digitar &quot;PAUSAR 0&quot; no WhatsApp ou desativar abaixo pra voltar antes.
        </div>
      )}

      <div className="flex items-start gap-3 rounded-md border p-3">
        <input
          id="desativada"
          type="checkbox"
          checked={!form.desativada && consentimento}
          disabled={!consentimento || pending}
          onChange={(e) => set("desativada", !e.target.checked)}
          className="mt-1"
        />
        <div className="flex-1">
          <Label htmlFor="desativada" className="font-medium">
            Receber mensagens no WhatsApp
          </Label>
          <p className="mt-1 text-xs text-muted-foreground">
            Máximo 2 mensagens proativas por dia, no horário que você escolher.
            {!consentimento && " Sem o consentimento inicial, não consigo ativar daqui."}
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hora_inicio">Horário de início</Label>
          <Input
            id="hora_inicio"
            type="time"
            value={form.horario_preferido_inicio}
            onChange={(e) => set("horario_preferido_inicio", e.target.value)}
            disabled={pending || form.desativada}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="hora_fim">Horário de fim</Label>
          <Input
            id="hora_fim"
            type="time"
            value={form.horario_preferido_fim}
            onChange={(e) => set("horario_preferido_fim", e.target.value)}
            disabled={pending || form.desativada}
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="frequencia">Frequência</Label>
        <select
          id="frequencia"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          value={form.frequencia}
          onChange={(e) =>
            set("frequencia", e.target.value as "diaria" | "3x_semana" | "semanal")
          }
          disabled={pending || form.desativada}
        >
          <option value="diaria">Diária</option>
          <option value="3x_semana">3× por semana</option>
          <option value="semanal">Semanal</option>
        </select>
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
