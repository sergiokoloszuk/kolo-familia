"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarAfiliado, atualizarAfiliado } from "./actions";

export type AfiliadoForm = {
  id?: string;
  nome: string;
  email: string;
  codigo_unico: string;
  ativo: boolean;
  comissao_tipo: "pct_primeira_mensalidade" | "pct_recorrente" | "valor_fixo" | "nenhuma";
  comissao_valor: number;
  comissao_meses: number;
  desconto_tipo: "nenhum" | "pct" | "valor";
  desconto_valor: number;
  desconto_duracao: "primeira" | "sempre";
  janela_atribuicao_dias: number;
  observacoes: string;
};

const VAZIO: AfiliadoForm = {
  nome: "",
  email: "",
  codigo_unico: "",
  ativo: true,
  comissao_tipo: "pct_primeira_mensalidade",
  comissao_valor: 50,
  comissao_meses: 1,
  desconto_tipo: "nenhum",
  desconto_valor: 0,
  desconto_duracao: "primeira",
  janela_atribuicao_dias: 30,
  observacoes: "",
};

export function AfiliadoFormulario({ inicial }: { inicial?: AfiliadoForm }) {
  const router = useRouter();
  const editar = Boolean(inicial?.id);
  const [f, setF] = useState<AfiliadoForm>(inicial ?? VAZIO);
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function set<K extends keyof AfiliadoForm>(k: K, v: AfiliadoForm[K]) {
    setF((prev) => ({ ...prev, [k]: v }));
    setOk(false);
  }

  const comissaoUnidade = f.comissao_tipo === "valor_fixo" ? "R$" : "%";
  const descontoUnidade = f.desconto_tipo === "valor" ? "R$" : "%";

  function salvar() {
    setErro(null);
    setOk(false);
    start(async () => {
      const r = editar
        ? await atualizarAfiliado({ ...f, id: inicial!.id! })
        : await criarAfiliado(f);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setOk(true);
      if (!editar) {
        router.push(`/admin/afiliados/${r.id}`);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex max-w-2xl flex-col gap-5 rounded-2xl border bg-white p-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Campo label="Nome do afiliado/parceiro">
          <Input value={f.nome} onChange={(e) => set("nome", e.target.value)} />
        </Campo>
        <Campo label="E-mail">
          <Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Campo>
        <Campo label="Código do link (vazio = gerar automático)">
          <Input
            value={f.codigo_unico}
            placeholder="ex: MARIA10"
            onChange={(e) => set("codigo_unico", e.target.value)}
          />
        </Campo>
        <Campo label="Ativo">
          <label className="flex h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={f.ativo}
              onChange={(e) => set("ativo", e.target.checked)}
              className="size-4 accent-brand-purple"
            />
            {f.ativo ? "Sim — link funciona" : "Não — link desativado"}
          </label>
        </Campo>
      </div>

      <fieldset className="rounded-xl border border-foreground/10 p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Comissão (paga ao afiliado)
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Campo label="Forma">
            <Select
              value={f.comissao_tipo}
              onChange={(v) => set("comissao_tipo", v as AfiliadoForm["comissao_tipo"])}
              options={[
                ["pct_primeira_mensalidade", "% da 1ª mensalidade"],
                ["pct_recorrente", "% recorrente (por X meses)"],
                ["valor_fixo", "Valor fixo por venda"],
                ["nenhuma", "Sem comissão"],
              ]}
            />
          </Campo>
          {f.comissao_tipo !== "nenhuma" && (
            <Campo label={`Valor (${comissaoUnidade})`}>
              <Input
                type="number"
                inputMode="decimal"
                value={f.comissao_valor}
                onChange={(e) => set("comissao_valor", Number(e.target.value))}
              />
            </Campo>
          )}
          {f.comissao_tipo === "pct_recorrente" && (
            <Campo label="Por quantos meses">
              <Input
                type="number"
                value={f.comissao_meses}
                onChange={(e) => set("comissao_meses", Number(e.target.value))}
              />
            </Campo>
          )}
        </div>
      </fieldset>

      <fieldset className="rounded-xl border border-foreground/10 p-4">
        <legend className="px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Desconto (pro cliente que usar o link)
        </legend>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Campo label="Tipo">
            <Select
              value={f.desconto_tipo}
              onChange={(v) => set("desconto_tipo", v as AfiliadoForm["desconto_tipo"])}
              options={[
                ["nenhum", "Sem desconto"],
                ["pct", "% de desconto"],
                ["valor", "Valor de desconto"],
              ]}
            />
          </Campo>
          {f.desconto_tipo !== "nenhum" && (
            <>
              <Campo label={`Valor (${descontoUnidade})`}>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={f.desconto_valor}
                  onChange={(e) => set("desconto_valor", Number(e.target.value))}
                />
              </Campo>
              <Campo label="Duração">
                <Select
                  value={f.desconto_duracao}
                  onChange={(v) => set("desconto_duracao", v as AfiliadoForm["desconto_duracao"])}
                  options={[
                    ["primeira", "Só a 1ª mensalidade"],
                    ["sempre", "Enquanto for assinante"],
                  ]}
                />
              </Campo>
            </>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          O desconto entra em vigor no checkout — depende do Stripe (Fase 2). Por
          ora fica registrado aqui.
        </p>
      </fieldset>

      <Campo label="Janela de atribuição (dias que o clique vale)">
        <Input
          type="number"
          value={f.janela_atribuicao_dias}
          onChange={(e) => set("janela_atribuicao_dias", Number(e.target.value))}
        />
      </Campo>

      <Campo label="Observações (interno)">
        <textarea
          rows={2}
          value={f.observacoes}
          onChange={(e) => set("observacoes", e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
        />
      </Campo>

      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}
      {ok && editar && <p className="text-sm text-emerald-600">Salvo.</p>}

      <div>
        <Button type="button" onClick={salvar} disabled={pending}>
          {pending ? "Salvando..." : editar ? "Salvar alterações" : "Criar afiliado"}
        </Button>
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: [string, string][];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
    >
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}
