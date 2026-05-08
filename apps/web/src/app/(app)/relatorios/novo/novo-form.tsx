"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { gerarRelatorio, type GerarRelatorioInput } from "../actions";

export function NovoRelatorioForm({
  membros,
}: {
  membros: Array<{ id: string; nome: string }>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [form, setForm] = useState<GerarRelatorioInput>({
    membroAtipicoId: membros[0]?.id ?? "",
    destinatario: "terapeuta",
    janelaMeses: 3,
    incluiCamadaB: false,
    incluiDass21: false,
  });

  function update<K extends keyof GerarRelatorioInput>(
    k: K,
    v: GerarRelatorioInput[K],
  ) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    if (!form.membroAtipicoId) {
      setErro("Escolha um membro.");
      return;
    }
    startTransition(async () => {
      try {
        const r = await gerarRelatorio(form);
        router.push(`/relatorios/${r.id}`);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  const ehTerapeuta = form.destinatario === "terapeuta";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="membro">Membro</Label>
        <select
          id="membro"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          value={form.membroAtipicoId}
          onChange={(e) => update("membroAtipicoId", e.target.value)}
        >
          {membros.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Destinatário</Label>
        <div className="grid gap-2 md:grid-cols-2">
          {(["terapeuta", "escola"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => update("destinatario", d)}
              className={`rounded-md border p-3 text-left text-sm ${
                form.destinatario === d
                  ? "border-foreground bg-muted"
                  : "hover:bg-muted/50"
              }`}
            >
              <p className="font-medium">
                {d === "terapeuta" ? "Para terapeuta" : "Para escola"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {d === "terapeuta"
                  ? "Tom técnico-descritivo. Inclui Kolo Vivo completo, linha do tempo, opcionalmente Camada B e DASS-21."
                  : "Tom prático para sala de aula. Sem Camada B nem DASS-21. Sem reflexões da mãe."}
              </p>
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="janela">Janela temporal</Label>
        <select
          id="janela"
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
          value={form.janelaMeses}
          onChange={(e) => update("janelaMeses", Number(e.target.value) as 1 | 3 | 6 | 12)}
        >
          <option value={1}>Último 1 mês</option>
          <option value={3}>Últimos 3 meses</option>
          <option value={6}>Últimos 6 meses</option>
          <option value={12}>Últimos 12 meses</option>
        </select>
      </div>

      {ehTerapeuta && (
        <fieldset className="flex flex-col gap-3 rounded-md border p-4">
          <legend className="px-2 text-sm font-medium">Opt-ins</legend>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.incluiCamadaB}
              onChange={(e) => update("incluiCamadaB", e.target.checked)}
            />
            <span>
              <span className="font-medium">Incluir Camada B</span>
              <p className="text-xs text-muted-foreground">
                Padrão de regulação do adulto cuidador correlacionado a desafios.
                Sem identificar nomes — usa papéis genéricos.
              </p>
            </span>
          </label>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.incluiDass21}
              onChange={(e) => update("incluiDass21", e.target.checked)}
            />
            <span>
              <span className="font-medium">Incluir DASS-21</span>
              <p className="text-xs text-muted-foreground">
                Histórico longitudinal das três dimensões (depressão, ansiedade,
                estresse). Termômetro auto-aplicável, não diagnóstico.
              </p>
            </span>
          </label>
        </fieldset>
      )}

      <div className="flex justify-end pt-2">
        <Button type="submit" disabled={pending}>
          {pending ? "Gerando..." : "Gerar relatório"}
        </Button>
      </div>
    </form>
  );
}
