"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RespostaMarkdown } from "@/components/resposta-markdown";
import { saveCampanha, sugerirRedacaoCampanha, type SaveCampanhaInput } from "./actions";
import {
  SEGMENTOS_ASSINATURA,
} from "@/lib/admin/campanha-target";

const CATEGORIAS = [
  { value: "informacional", label: "Informacional" },
  { value: "promocional", label: "Promocional" },
  { value: "avaliacao", label: "Avaliação" },
  { value: "operacional", label: "Operacional (sem opt-out)" },
] as const;

// Os segmentos e suas definições vêm da MESMA fonte que resolve o público —
// rótulo na tela e regra no código não podem divergir.
const STATUS_ASSINATURA = SEGMENTOS_ASSINATURA;

export type CampanhaInicial = {
  id?: string;
  titulo?: string;
  categoria?: SaveCampanhaInput["categoria"];
  canais?: SaveCampanhaInput["canais"];
  segmentacao?: SaveCampanhaInput["segmentacao"];
  conteudo_whatsapp?: string;
  conteudo_email_assunto?: string;
  conteudo_email_corpo?: string;
  janela_inicio?: string | null;
  janela_fim?: string | null;
};

export function CampanhaForm({ inicial }: { inicial: CampanhaInicial }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [objetivo, setObjetivo] = useState("");
  const [ajuste, setAjuste] = useState("");
  const [sugestao, setSugestao] = useState<string | null>(null);
  const [form, setForm] = useState<SaveCampanhaInput>({
    id: inicial.id,
    titulo: inicial.titulo ?? "",
    categoria: inicial.categoria ?? "informacional",
    canais: inicial.canais ?? ["whatsapp"],
    segmentacao: {
      ...inicial.segmentacao,
      assinatura: inicial.segmentacao?.assinatura ?? [],
      exigir_consentimento_ayla: inicial.segmentacao?.exigir_consentimento_ayla ?? true,
    },
    conteudo_whatsapp: inicial.conteudo_whatsapp ?? "",
    conteudo_email_assunto: inicial.conteudo_email_assunto ?? "",
    conteudo_email_corpo: inicial.conteudo_email_corpo ?? "",
    janela_inicio: inicial.janela_inicio ?? null,
    janela_fim: inicial.janela_fim ?? null,
  });

  function set<K extends keyof SaveCampanhaInput>(
    k: K,
    v: SaveCampanhaInput[K],
  ) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function toggleCanal(canal: "whatsapp" | "email") {
    setForm((f) => {
      const has = f.canais.includes(canal);
      return {
        ...f,
        canais: has ? f.canais.filter((c) => c !== canal) : [...f.canais, canal],
      };
    });
  }

  function toggleStatus(status: (typeof STATUS_ASSINATURA)[number]["value"]) {
    setForm((f) => {
      const cur = f.segmentacao.assinatura ?? [];
      const has = cur.includes(status);
      return {
        ...f,
        segmentacao: {
          ...f.segmentacao,
          assinatura: has ? cur.filter((s) => s !== status) : [...cur, status],
        },
      };
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      try {
        const { id } = await saveCampanha(form);
        if (!inicial.id) router.push(`/admin/campanhas/${id}`);
        else router.refresh();
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  function pedirSugestao(aprimorar: boolean) {
    setErro(null);
    startTransition(async () => {
      try {
        const resultado = await sugerirRedacaoCampanha({
          objetivo,
          textoAtual: aprimorar ? (sugestao ?? form.conteudo_whatsapp ?? "") : undefined,
          ajuste: aprimorar ? ajuste : undefined,
        });
        setSugestao(resultado.texto);
        setAjuste("");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Não foi possível sugerir a redação.");
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

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="titulo">Título interno</Label>
        <Input
          id="titulo"
          value={form.titulo}
          onChange={(e) => set("titulo", e.target.value)}
          placeholder="ex: Lançamento Beta — convite founders"
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="categoria">Categoria</Label>
        <select
          id="categoria"
          value={form.categoria}
          onChange={(e) =>
            set("categoria", e.target.value as SaveCampanhaInput["categoria"])
          }
          className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
        >
          {CATEGORIAS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Promocional respeita janela de 48h após crise/exaustão. Operacional é
          o único que ignora opt-out por categoria.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Canais</Label>
        <div className="flex gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <input
              type="checkbox"
              checked={form.canais.includes("whatsapp")}
              onChange={() => toggleCanal("whatsapp")}
            />
            WhatsApp
          </label>
          <label className="flex items-center gap-1.5 opacity-60">
            <input
              type="checkbox"
              checked={form.canais.includes("email")}
              onChange={() => toggleCanal("email")}
              disabled
              title="Email ainda não está implementado no disparo"
            />
            Email (em breve)
          </label>
        </div>
      </div>

      {form.canais.includes("whatsapp") && (
        <>
          <section className="flex flex-col gap-3 rounded-lg border bg-muted/20 p-4" aria-label="Ajuda para redigir">
            <div>
              <h2 className="text-sm font-semibold">Conte para a IA o que você quer comunicar</h2>
              <p className="text-xs text-muted-foreground">Ela sugere a redação; você revisa, edita ou pede ajustes. Nada é enviado daqui.</p>
            </div>
            <textarea
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
              rows={4}
              maxLength={3000}
              aria-label="Objetivo e informações da mensagem"
              placeholder="Ex.: Convide as famílias para o programa de amanhã às 9h30 na Vibe Mundial, sobre respiração. Inclua o link que informei. Tom acolhedor e direto."
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
            <Button type="button" variant="outline" disabled={pending || objetivo.trim().length < 10} onClick={() => pedirSugestao(false)}>
              {pending ? "Preparando..." : "Sugerir redação"}
            </Button>
            {sugestao && (
              <div className="flex flex-col gap-3 rounded-md border bg-white p-3">
                <p className="text-xs font-semibold">Sugestão para revisar — ainda não é o texto final</p>
                <RespostaMarkdown
                  texto={sugestao.replace(/\*([^*\n]+)\*/g, "**$1**")}
                  className="flex flex-col gap-2 text-sm"
                />
                <label className="flex flex-col gap-1 text-xs">
                  O que quer ajustar?
                  <Input value={ajuste} onChange={(e) => setAjuste(e.target.value)} maxLength={1000} placeholder="Ex.: mais curto, mais caloroso, destaque o horário" />
                </label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={pending || !ajuste.trim()} onClick={() => pedirSugestao(true)}>Pedir ajuste</Button>
                  <Button type="button" disabled={pending} onClick={() => {
                    if (form.conteudo_whatsapp?.trim() && !confirm("Substituir o texto atual pela sugestão?")) return;
                    set("conteudo_whatsapp", sugestao);
                    setSugestao(null);
                  }}>Usar esta redação</Button>
                </div>
              </div>
            )}
          </section>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ww">Texto final para WhatsApp — editável</Label>
            <textarea
              id="ww"
              rows={6}
              value={form.conteudo_whatsapp ?? ""}
              onChange={(e) => set("conteudo_whatsapp", e.target.value)}
              placeholder="Escreva ou aprove uma sugestão. Pode usar blocos e quebras de linha."
              className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            />
            <p className="text-xs text-muted-foreground">
              {(form.conteudo_whatsapp ?? "").length} caracteres. Confira datas, valores e links antes de aprovar a campanha.
            </p>
          </div>
        </>
      )}

      <fieldset className="flex flex-col gap-3 rounded-md border bg-muted/20 p-3">
        <legend className="px-1 text-sm font-medium">Segmentação</legend>

        <p className="text-sm text-muted-foreground">
          Antes de selecionar, <Link href="/admin/campanhas/publicos" target="_blank" rel="noopener noreferrer" className="underline">veja os contatos de cada grupo</Link>.
          Esta lista é um retrato do cadastro; a elegibilidade para receber será conferida novamente antes do envio.
        </p>

        <div className="flex flex-col gap-1.5">
          <Label>Quem recebe</Label>
          <p className="text-xs text-muted-foreground">Escolha ao menos um grupo antes de simular ou enviar. Nenhum grupo vem marcado automaticamente.</p>
          <div className="flex flex-col gap-1.5 text-sm">
            {STATUS_ASSINATURA.map((s) => (
              <label key={s.value} className="flex items-start gap-1.5">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={(form.segmentacao.assinatura ?? []).includes(s.value)}
                  onChange={() => toggleStatus(s.value)}
                />
                <span>
                  {s.label}
                  <span className="text-muted-foreground"> — {s.definicao}</span>
                </span>
              </label>
            ))}
          </div>
        </div>

        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            checked={form.segmentacao.exigir_consentimento_ayla !== false}
            onChange={(e) =>
              set("segmentacao", {
                ...form.segmentacao,
                exigir_consentimento_ayla: e.target.checked,
              })
            }
          />
          Apenas famílias com consentimento ativo da Ayla (filtro legado)
        </label>
      </fieldset>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="submit" disabled={pending}>
          {pending
            ? "Salvando..."
            : inicial.id
              ? "Salvar"
              : "Criar rascunho"}
        </Button>
      </div>
    </form>
  );
}
