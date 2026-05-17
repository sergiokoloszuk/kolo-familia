"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { savePessoa } from "./actions";

const PAPEIS: { value: string; label: string }[] = [
  { value: "mae", label: "Mãe" },
  { value: "pai", label: "Pai" },
  { value: "padrasto", label: "Padrasto" },
  { value: "madrasta", label: "Madrasta" },
  { value: "avo_a", label: "Avó" },
  { value: "avo_o", label: "Avô" },
  { value: "irmao_a", label: "Irmão(ã)" },
  { value: "tio_a", label: "Tio(a)" },
  { value: "baba", label: "Babá" },
  { value: "professor_a", label: "Professor(a)" },
  { value: "terapeuta", label: "Terapeuta" },
  { value: "medico", label: "Médico(a)" },
  { value: "amigo_da_familia", label: "Amigo da família" },
  { value: "outro", label: "Outro" },
];

const FREQUENCIAS: { value: string; label: string }[] = [
  { value: "", label: "(não informado)" },
  { value: "diaria", label: "Diária" },
  { value: "semanal", label: "Semanal" },
  { value: "mensal", label: "Mensal" },
  { value: "rara", label: "Rara" },
  { value: "unica", label: "Única / pontual" },
];

export function PessoaForm({
  initial,
  onSaved,
}: {
  initial?: {
    id?: string;
    nome: string;
    apelido?: string | null;
    papel: string;
    papel_livre?: string | null;
    observacoes?: string | null;
    coabitante: boolean;
    frequencia_contato?: string | null;
  };
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const [nome, setNome] = useState(initial?.nome ?? "");
  const [apelido, setApelido] = useState(initial?.apelido ?? "");
  const [papel, setPapel] = useState(initial?.papel ?? "pai");
  const [papelLivre, setPapelLivre] = useState(initial?.papel_livre ?? "");
  const [observacoes, setObservacoes] = useState(initial?.observacoes ?? "");
  const [coabitante, setCoabitante] = useState(initial?.coabitante ?? false);
  const [frequencia, setFrequencia] = useState(initial?.frequencia_contato ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      const res = await savePessoa({
        id: initial?.id,
        nome,
        apelido: apelido || undefined,
        papel: papel as never,
        papel_livre: papelLivre || undefined,
        observacoes: observacoes || undefined,
        coabitante,
        frequencia_contato: (frequencia || undefined) as never,
      });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      if (!initial?.id) {
        // Reset pra próximo cadastro
        setNome("");
        setApelido("");
        setPapel("pai");
        setPapelLivre("");
        setObservacoes("");
        setCoabitante(false);
        setFrequencia("");
      }
      router.refresh();
      onSaved?.();
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="nome">Nome</Label>
          <input
            id="nome"
            type="text"
            required
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={pending}
          />
        </div>
        <div>
          <Label htmlFor="apelido">Apelido (opcional)</Label>
          <input
            id="apelido"
            type="text"
            value={apelido}
            onChange={(e) => setApelido(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={pending}
          />
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <Label htmlFor="papel">Papel</Label>
          <select
            id="papel"
            value={papel}
            onChange={(e) => setPapel(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={pending}
          >
            {PAPEIS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label htmlFor="frequencia">Frequência de contato</Label>
          <select
            id="frequencia"
            value={frequencia}
            onChange={(e) => setFrequencia(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={pending}
          >
            {FREQUENCIAS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {(papel === "outro" || papelLivre) && (
        <div>
          <Label htmlFor="papel_livre">Papel (texto livre)</Label>
          <input
            id="papel_livre"
            type="text"
            value={papelLivre}
            onChange={(e) => setPapelLivre(e.target.value)}
            placeholder={'ex: "vizinha que ajuda", "padrinho"'}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={pending}
          />
        </div>
      )}

      <div>
        <Label className="flex cursor-pointer items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={coabitante}
            onChange={(e) => setCoabitante(e.target.checked)}
            disabled={pending}
          />
          Mora na mesma casa
        </Label>
      </div>

      <div>
        <Label htmlFor="observacoes">Observações (opcional)</Label>
        <textarea
          id="observacoes"
          rows={2}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="qualquer coisa que ajude no contexto"
          className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
          disabled={pending}
        />
      </div>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <div>
        <Button type="submit" disabled={pending || !nome}>
          {pending ? "Salvando..." : initial?.id ? "Salvar alterações" : "Adicionar pessoa"}
        </Button>
      </div>
    </form>
  );
}
