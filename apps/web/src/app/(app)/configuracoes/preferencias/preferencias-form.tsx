"use client";

import { useState, useTransition } from "react";
import { Check, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { salvarPreferencias, type Preferencias } from "./actions";

type Crianca = { id: string; nome: string; preferencias: Preferencias };

const SUB = [
  { key: "temas", label: "Temas e hiperfocos", placeholder: "dinossauros, trens, espaço…" },
  { key: "midia", label: "Desenhos, filmes e personagens", placeholder: "Patrulha Canina, Toy Story…" },
  { key: "materiais", label: "Materiais e brincadeiras", placeholder: "giz de cera, guache, água, massinha…" },
  { key: "musicas", label: "Músicas e sons", placeholder: "música que acalma, abertura favorita…" },
] as const;

export function PreferenciasForm({ criancas }: { criancas: Crianca[] }) {
  return (
    <div className="flex flex-col gap-5">
      {criancas.map((c) => (
        <CriancaCard key={c.id} crianca={c} />
      ))}
    </div>
  );
}

function CriancaCard({ crianca }: { crianca: Crianca }) {
  const [pref, setPref] = useState<Preferencias>(crianca.preferencias);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function salvar() {
    setErro(null);
    setOk(false);
    start(async () => {
      const r = await salvarPreferencias({ membroId: crianca.id, ...pref });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOk(true);
    });
  }

  return (
    <div className="rounded-2xl border border-foreground/[0.08] bg-white p-5">
      <h3 className="mb-4 font-heading text-lg text-foreground">{crianca.nome}</h3>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SUB.map((s) => (
          <TagsField
            key={s.key}
            label={s.label}
            placeholder={s.placeholder}
            valores={pref[s.key]}
            onChange={(v) => {
              setPref((p) => ({ ...p, [s.key]: v }));
              setOk(false);
            }}
          />
        ))}
      </div>

      {erro && (
        <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button type="button" onClick={salvar} disabled={pending}>
          {pending ? (
            <>
              <RefreshCw className="size-4 animate-spin" aria-hidden /> Salvando...
            </>
          ) : (
            "Salvar"
          )}
        </Button>
        {ok && (
          <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600">
            <Check className="size-4" aria-hidden /> Salvo
          </span>
        )}
      </div>
    </div>
  );
}

function TagsField({
  label,
  placeholder,
  valores,
  onChange,
}: {
  label: string;
  placeholder: string;
  valores: string[];
  onChange: (v: string[]) => void;
}) {
  const [draft, setDraft] = useState("");

  function add(raw: string) {
    const novos = raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s && !valores.includes(s));
    if (novos.length) onChange([...valores, ...novos]);
    setDraft("");
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        {valores.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded-full bg-kolo-lilas-bg-2 px-2.5 py-1 text-xs font-medium text-brand-purple-dark"
          >
            {v}
            <button
              type="button"
              aria-label={`Remover ${v}`}
              onClick={() => onChange(valores.filter((x) => x !== v))}
              className="text-brand-purple/60 hover:text-brand-purple"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(draft);
            } else if (e.key === "Backspace" && !draft && valores.length) {
              onChange(valores.slice(0, -1));
            }
          }}
          onBlur={() => draft.trim() && add(draft)}
          placeholder={valores.length ? "" : placeholder}
          className="min-w-[8ch] flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted-foreground/50"
        />
      </div>
    </div>
  );
}
