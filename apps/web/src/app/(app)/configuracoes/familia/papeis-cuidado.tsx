"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPapelCuidado, removePapelCuidado, type ActionResult } from "./actions";

const TIPOS: { value: string; label: string }[] = [
  { value: "", label: "(sem papel)" },
  { value: "principal", label: "Cuidador principal" },
  { value: "apoio_frequente", label: "Apoio frequente" },
  { value: "apoio_esporadico", label: "Apoio esporádico" },
  { value: "neutro", label: "Neutro / sem envolvimento" },
  { value: "tira_de_cena", label: "Tira de cena (presença que cansa)" },
  { value: "opositor", label: "Opositor / fricção" },
];

export function PapelCuidadoSelect({
  pessoaFamiliaId,
  membroAtipicoId,
  membroNome,
  tipoCuidadoAtual,
}: {
  pessoaFamiliaId: string;
  membroAtipicoId: string;
  membroNome: string;
  tipoCuidadoAtual: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [valor, setValor] = useState(tipoCuidadoAtual ?? "");

  function run(fn: () => Promise<ActionResult>) {
    setErro(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onChange(novo: string) {
    setValor(novo);
    if (novo === "") {
      run(() => removePapelCuidado(pessoaFamiliaId, membroAtipicoId));
    } else {
      run(() =>
        setPapelCuidado({
          pessoa_familia_id: pessoaFamiliaId,
          membro_atipico_id: membroAtipicoId,
          tipo_cuidado: novo as never,
        }),
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="text-muted-foreground">→ {membroNome}:</span>
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        disabled={pending}
        className="rounded-md border bg-background px-2 py-1 text-xs"
      >
        {TIPOS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {erro && <span className="text-destructive">{erro}</span>}
    </div>
  );
}
