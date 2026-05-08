"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { salvarCheckinSemanal, type SalvarSemanalInput } from "./actions";

const ESCALAS_EMOCIONAL = [
  { v: "muito_bem", emoji: "🌞", label: "Muito bem" },
  { v: "bem", emoji: "🙂", label: "Bem" },
  { v: "neutro", emoji: "😐", label: "Neutro" },
  { v: "dificil", emoji: "🌧", label: "Difícil" },
  { v: "muito_dificil", emoji: "🌧🌧", label: "Muito difícil" },
] as const;

const ESCALAS_ENERGIA = [
  { v: "cheia", label: "Cheia de energia" },
  { v: "descansada", label: "Bem descansada" },
  { v: "razoavel", label: "Razoável" },
  { v: "cansada", label: "Cansada" },
  { v: "exausta", label: "Exausta" },
] as const;

export function SemanalForm({
  membros,
  semanaInicio,
}: {
  membros: Array<{ id: string; nome: string }>;
  semanaInicio: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  const [form, setForm] = useState<SalvarSemanalInput>({
    membroAtipicoId: membros[0]?.id ?? null,
    semanaInicio,
    emocionalMae: "neutro",
    energiaMae: "razoavel",
    emocionalMembro: null,
    energiaMembro: null,
    comentario: "",
    oQueFariaDiferente: "",
  });

  function update<K extends keyof SalvarSemanalInput>(k: K, v: SalvarSemanalInput[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSucesso(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      try {
        await salvarCheckinSemanal(form);
        setSucesso(true);
        setTimeout(() => router.push("/registrar"), 800);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="rounded-md border border-green-300/60 bg-green-50 px-3 py-2 text-sm text-green-900">
          Salvo. Voltando…
        </div>
      )}

      {membros.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="membro">Sobre quem é (opcional)?</Label>
          <select
            id="membro"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            value={form.membroAtipicoId ?? ""}
            onChange={(e) => update("membroAtipicoId", e.target.value || null)}
          >
            <option value="">Geral da família</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <fieldset className="flex flex-col gap-3 rounded-md border p-4">
        <legend className="px-2 text-sm font-medium">Sobre você</legend>

        <EmocionalGroup
          label="Como você esteve emocionalmente esta semana?"
          value={form.emocionalMae}
          onChange={(v) => update("emocionalMae", v)}
        />
        <EnergiaGroup
          label="Como esteve sua energia/sono esta semana?"
          value={form.energiaMae}
          onChange={(v) => update("energiaMae", v)}
        />
      </fieldset>

      {form.membroAtipicoId && (
        <fieldset className="flex flex-col gap-3 rounded-md border p-4">
          <legend className="px-2 text-sm font-medium">
            Sobre {membros.find((m) => m.id === form.membroAtipicoId)?.nome}
          </legend>

          <EmocionalGroup
            label="Como você o/a viu emocionalmente nesta semana?"
            value={form.emocionalMembro ?? null}
            onChange={(v) => update("emocionalMembro", v)}
          />
          <EnergiaGroup
            label="Como você o/a viu em energia/sono?"
            value={form.energiaMembro ?? null}
            onChange={(v) => update("energiaMembro", v)}
          />
        </fieldset>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="comentario">Comentário (opcional)</Label>
        <textarea
          id="comentario"
          rows={2}
          value={form.comentario ?? ""}
          onChange={(e) => update("comentario", e.target.value)}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reflexao">
          O que você faria diferente esta semana, pensando em como agiu? (opcional)
        </Label>
        <textarea
          id="reflexao"
          rows={3}
          value={form.oQueFariaDiferente ?? ""}
          onChange={(e) => update("oQueFariaDiferente", e.target.value)}
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          placeholder="Sem julgamento — só uma observação pra você."
        />
      </div>

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}

function EmocionalGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SalvarSemanalInput["emocionalMae"] | null;
  onChange: (v: SalvarSemanalInput["emocionalMae"]) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {ESCALAS_EMOCIONAL.map((e) => (
          <button
            key={e.v}
            type="button"
            onClick={() => onChange(e.v)}
            className={`flex flex-col items-center gap-1 rounded-md border px-3 py-2 text-xs ${
              value === e.v ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
            }`}
          >
            <span className="text-lg">{e.emoji}</span>
            <span>{e.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function EnergiaGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: SalvarSemanalInput["energiaMae"] | null;
  onChange: (v: SalvarSemanalInput["energiaMae"]) => void;
}) {
  return (
    <div>
      <Label className="mb-2 block">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {ESCALAS_ENERGIA.map((e) => (
          <button
            key={e.v}
            type="button"
            onClick={() => onChange(e.v)}
            className={`rounded-md border px-3 py-1.5 text-xs ${
              value === e.v ? "border-foreground bg-foreground text-background" : "hover:bg-muted"
            }`}
          >
            {e.label}
          </button>
        ))}
      </div>
    </div>
  );
}
