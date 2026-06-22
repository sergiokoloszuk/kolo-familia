"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { hojeLocalISO } from "@/lib/idade";
import {
  registrarDia,
  proporKoloVivoDoDiario,
  salvarKoloVivoDoDiario,
  type RegistrarDiaInput,
} from "./actions";

type KvItem = {
  camada: "camada1" | "camada2";
  campo: string;
  subcampo?: string | null;
  texto: string;
  operacao: "adicionar" | "reescrever";
};

const CAMPO_LABEL: Record<string, string> = {
  nutricional: "Alimentação",
  sono: "Sono",
  sensorial: "Sensorial",
  comunicacao: "Comunicação",
  socializacao: "Socialização",
  emocional: "Regulação emocional",
  foco: "Foco e atenção",
  motor: "Motor",
  autonomia: "Autonomia",
  aprendizado: "Aprendizado",
  imitacao: "Imitação",
  tela_midia: "Tela e mídia",
  escola: "Escola",
  saude_geral: "Saúde geral",
  como_e: "Interesses e jeito de ser",
  essencial: "O essencial",
  corpo_rotina: "Corpo e rotina",
  desafios_regulacao: "Desafios",
};

const ESCALAS_MAE = [
  { v: "muito_bem", emoji: "🌞", label: "Muito bem" },
  { v: "bem", emoji: "🙂", label: "Bem" },
  { v: "neutro", emoji: "😐", label: "Neutro" },
  { v: "dificil", emoji: "🌧", label: "Difícil" },
  { v: "muito_dificil", emoji: "🌧🌧", label: "Muito difícil" },
] as const;

const QUEM_ESTAVA = [
  { v: "mae", label: "Eu" },
  { v: "pai", label: "Pai" },
  { v: "avo_a", label: "Avó" },
  { v: "avo_o", label: "Avô" },
  { v: "irmao_a", label: "Irmão/Irmã" },
  { v: "baba", label: "Babá" },
  { v: "professor_a", label: "Professor(a)" },
  { v: "outro", label: "Outro" },
] as const;

const ESTADO_ADULTO = [
  { v: "calmo", label: "Calma" },
  { v: "firme", label: "Firme" },
  { v: "cansado", label: "Cansada" },
  { v: "ansioso", label: "Ansiosa" },
  { v: "impaciente", label: "Impaciente" },
] as const;

const REACAO_ADULTO = [
  { v: "acolhedor", label: "Acolhi" },
  { v: "esperou", label: "Esperei" },
  { v: "interveio", label: "Intervim" },
  { v: "impositivo", label: "Fui impositiva" },
  { v: "chamou_ajuda", label: "Chamei ajuda" },
  { v: "outro", label: "Outro" },
] as const;

type FormState = {
  membroAtipicoId: string | null;
  escalaEmocionalMae: RegistrarDiaInput["escalaEmocionalMae"];
  escalaEmocionalMembro: RegistrarDiaInput["escalaEmocionalMembro"];
  conquista: string;
  desafio: string;
  observacaoLivre: string;
  possivelGatilho: string;
  quemEstava: RegistrarDiaInput["quemEstava"];
  estadoAdulto: RegistrarDiaInput["estadoAdulto"];
  reacaoAdulto: RegistrarDiaInput["reacaoAdulto"];
};

export function DiarioForm({
  membros,
  ativaId,
}: {
  membros: Array<{ id: string; nome: string }>;
  ativaId?: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);
  const [proposta, setProposta] = useState<{ koloVivo: KvItem[]; nome: string } | null>(null);
  const [kvPending, startKv] = useTransition();
  const [kvFeito, setKvFeito] = useState<"salvo" | "dispensado" | null>(null);
  const [form, setForm] = useState<FormState>({
    membroAtipicoId: membros.find((m) => m.id === ativaId)?.id ?? membros[0]?.id ?? null,
    escalaEmocionalMae: "neutro",
    escalaEmocionalMembro: null,
    conquista: "",
    desafio: "",
    observacaoLivre: "",
    possivelGatilho: "",
    quemEstava: null,
    estadoAdulto: null,
    reacaoAdulto: null,
  });

  function update<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSucesso(false);
  }

  function resetar() {
    setForm({
      membroAtipicoId: membros[0]?.id ?? null,
      escalaEmocionalMae: "neutro",
      escalaEmocionalMembro: null,
      conquista: "",
      desafio: "",
      observacaoLivre: "",
      possivelGatilho: "",
      quemEstava: null,
      estadoAdulto: null,
      reacaoAdulto: null,
    });
    setSucesso(false);
    setErro(null);
    setProposta(null);
    setKvFeito(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setProposta(null);
    setKvFeito(null);
    const membroId = form.membroAtipicoId;
    startTransition(async () => {
      try {
        await registrarDia({
          membroAtipicoId: membroId,
          data: hojeLocalISO(),
          escalaEmocionalMae: form.escalaEmocionalMae,
          escalaEmocionalMembro: form.escalaEmocionalMembro ?? null,
          conquista: form.conquista || undefined,
          desafio: form.desafio || undefined,
          observacaoLivre: form.observacaoLivre || undefined,
          possivelGatilho: form.possivelGatilho || undefined,
          quemEstava: form.quemEstava,
          estadoAdulto: form.estadoAdulto,
          reacaoAdulto: form.reacaoAdulto,
        });
        setSucesso(true);
        router.refresh();

        // Diário → Kolo Vivo: lê o que foi escrito e oferece guardar o que é
        // novo (a mãe decide). Só com criança vinculada + algo escrito.
        if (membroId && temEvento) {
          const texto = [
            form.conquista.trim() && `Conquista: ${form.conquista.trim()}`,
            form.desafio.trim() && `Desafio: ${form.desafio.trim()}`,
            form.possivelGatilho.trim() && `Possível gatilho: ${form.possivelGatilho.trim()}`,
            form.observacaoLivre.trim() && `Observação: ${form.observacaoLivre.trim()}`,
          ]
            .filter(Boolean)
            .join("\n");
          const r = await proporKoloVivoDoDiario({ membroAtipicoId: membroId, texto });
          if (r.ok && r.koloVivo.length > 0) {
            setProposta({ koloVivo: r.koloVivo as KvItem[], nome: r.nome });
          }
        }
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  function salvarKv() {
    if (!proposta || !form.membroAtipicoId) return;
    const membroId = form.membroAtipicoId;
    startKv(async () => {
      const r = await salvarKoloVivoDoDiario({ membroAtipicoId: membroId, koloVivo: proposta.koloVivo });
      if (r.ok) {
        setKvFeito("salvo");
        router.refresh();
      } else {
        setErro(r.error);
      }
    });
  }

  const temEvento = Boolean(
    form.conquista.trim() || form.desafio.trim() || form.observacaoLivre.trim(),
  );

  if (sucesso) {
    return (
      <div className="flex flex-col items-start gap-6 rounded-2xl border-l-4 border-brand-yellow bg-brand-yellow/10 p-6">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-yellow text-brand-purple-dark"
          >
            <Check className="size-5" strokeWidth={2.5} />
          </span>
          <div>
            <p className="font-heading text-lg font-semibold text-brand-purple-dark">
              Registrado!
            </p>
            <p className="mt-1 text-sm text-foreground/80">
              Já entrou no seu painel e na linha do tempo da Evolução.
            </p>
          </div>
        </div>
        {pending && form.membroAtipicoId && (
          <p className="text-sm text-muted-foreground">Vendo se tem algo novo pro Perfil…</p>
        )}

        {kvFeito === "salvo" ? (
          <p className="text-sm font-medium text-brand-purple-dark">✓ Guardado no Perfil.</p>
        ) : proposta && proposta.koloVivo.length > 0 && kvFeito !== "dispensado" ? (
          <div className="w-full rounded-xl border border-brand-purple/20 bg-white p-4">
            <p className="text-sm font-medium text-foreground">
              Percebi algo novo sobre {proposta.nome} — quer guardar no Perfil?
            </p>
            <ul className="mt-2 flex flex-col gap-1">
              {proposta.koloVivo.map((it, i) => (
                <li key={i} className="flex gap-2 text-sm text-muted-foreground">
                  <span
                    aria-hidden
                    className="mt-[0.5em] size-1.5 shrink-0 rounded-full bg-brand-purple/40"
                  />
                  <span>
                    <span className="font-medium text-foreground">
                      {CAMPO_LABEL[it.campo] ?? it.campo}:
                    </span>{" "}
                    {it.texto}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button type="button" onClick={salvarKv} disabled={kvPending}>
                {kvPending ? "Guardando..." : "Guardar no Perfil"}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setKvFeito("dispensado")}>
                Agora não
              </Button>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => router.push("/painel")}>
            Ver no painel
          </Button>
          <Button type="button" variant="outline" onClick={resetar}>
            Registrar outro
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      {membros.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="membro">Sobre quem é?</Label>
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

      {/* Check-in leve */}
      <fieldset className="flex flex-col gap-3 rounded-md border p-4">
        <legend className="px-2 text-sm font-medium">Como vocês estão?</legend>

        <div>
          <Label className="mb-2 block">Como você está hoje?</Label>
          <div className="flex flex-wrap gap-2">
            {ESCALAS_MAE.map((e) => (
              <button
                key={e.v}
                type="button"
                aria-label={e.label}
                aria-pressed={form.escalaEmocionalMae === e.v}
                onClick={() => update("escalaEmocionalMae", e.v)}
                className={`flex flex-col items-center gap-1 rounded-md border px-3 py-2 text-xs ${
                  form.escalaEmocionalMae === e.v
                    ? "border-foreground bg-foreground text-background"
                    : "hover:bg-muted"
                }`}
              >
                <span className="text-lg" aria-hidden>{e.emoji}</span>
                <span>{e.label}</span>
              </button>
            ))}
          </div>
        </div>

        {form.membroAtipicoId && (
          <div>
            <Label className="mb-2 block">
              Como{" "}
              {membros.find((m) => m.id === form.membroAtipicoId)?.nome ?? "ele/ela"}{" "}
              está hoje? (opcional)
            </Label>
            <div className="flex flex-wrap gap-2">
              {ESCALAS_MAE.map((e) => (
                <button
                  key={e.v}
                  type="button"
                  aria-label={e.label}
                  aria-pressed={form.escalaEmocionalMembro === e.v}
                  onClick={() =>
                    update(
                      "escalaEmocionalMembro",
                      form.escalaEmocionalMembro === e.v ? null : e.v,
                    )
                  }
                  className={`flex flex-col items-center gap-1 rounded-md border px-3 py-2 text-xs ${
                    form.escalaEmocionalMembro === e.v
                      ? "border-foreground bg-foreground text-background"
                      : "hover:bg-muted"
                  }`}
                >
                  <span className="text-lg" aria-hidden>{e.emoji}</span>
                  <span>{e.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </fieldset>

      {/* Camada A */}
      <fieldset className="flex flex-col gap-3 rounded-md border p-4">
        <legend className="px-2 text-sm font-medium">O que aconteceu? (Camada A)</legend>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="conquista">Uma conquista (opcional)</Label>
          <Input
            id="conquista"
            value={form.conquista}
            onChange={(e) => update("conquista", e.target.value)}
            placeholder="Algo que deu certo, mesmo pequeno."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desafio">Um desafio (opcional)</Label>
          <Input
            id="desafio"
            value={form.desafio}
            onChange={(e) => update("desafio", e.target.value)}
            placeholder="O que foi difícil hoje."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="gatilho">Possível gatilho (opcional)</Label>
          <Input
            id="gatilho"
            value={form.possivelGatilho}
            onChange={(e) => update("possivelGatilho", e.target.value)}
            placeholder="O que pode ter levado ao desafio."
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="obs">Observação livre (opcional)</Label>
          <textarea
            id="obs"
            rows={2}
            value={form.observacaoLivre}
            onChange={(e) => update("observacaoLivre", e.target.value)}
            className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
        </div>
      </fieldset>

      {/* Camada B — pede só se tem evento */}
      {temEvento && (
        <fieldset className="flex flex-col gap-3 rounded-md border p-4">
          <legend className="px-2 text-sm font-medium">
            Quem estava e como você reagiu? (Camada B)
          </legend>
          <p className="text-xs text-muted-foreground">
            Como o adulto regula-se, fala e reage altera o resultado. Por isso
            pedimos esses 3 campos quando há um evento — não pra julgar, pra
            entender o conjunto.
          </p>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="quem">Quem estava?</Label>
            <select
              id="quem"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={form.quemEstava ?? ""}
              onChange={(e) =>
                update("quemEstava", (e.target.value || null) as FormState["quemEstava"])
              }
            >
              <option value="">—</option>
              {QUEM_ESTAVA.map((q) => (
                <option key={q.v} value={q.v}>
                  {q.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <Label className="mb-2 block">Como esse adulto se sentia?</Label>
            <div className="flex flex-wrap gap-2">
              {ESTADO_ADULTO.map((e) => (
                <button
                  key={e.v}
                  type="button"
                  onClick={() =>
                    update("estadoAdulto", form.estadoAdulto === e.v ? null : e.v)
                  }
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    form.estadoAdulto === e.v
                      ? "border-foreground bg-foreground text-background"
                      : "hover:bg-muted"
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label className="mb-2 block">Como esse adulto reagiu?</Label>
            <div className="flex flex-wrap gap-2">
              {REACAO_ADULTO.map((r) => (
                <button
                  key={r.v}
                  type="button"
                  onClick={() =>
                    update("reacaoAdulto", form.reacaoAdulto === r.v ? null : r.v)
                  }
                  className={`rounded-md border px-3 py-1.5 text-xs ${
                    form.reacaoAdulto === r.v
                      ? "border-foreground bg-foreground text-background"
                      : "hover:bg-muted"
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </fieldset>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Registrar"}
        </Button>
      </div>
    </form>
  );
}
