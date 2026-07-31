"use client";

import { useState, useTransition } from "react";
import type { CasoRevisao } from "@/lib/memoria-viva/revisao";
import { decidir } from "./actions";

/**
 * Um caso, um card, quatro botões.
 *
 * A área principal não tem jargão: nada de "estado epistemológico", "sujeito",
 * "lineage". Quem revisa precisa responder uma pergunta simples — de quem é
 * esta informação, e ela confere? Os termos técnicos ficam recolhidos.
 */

const MOTIVO_HUMANO: Record<string, { titulo: string; explicacao: (c: CasoRevisao) => string }> = {
  conflito_de_nome: {
    titulo: "Pode ser sobre outra criança",
    explicacao: (c) =>
      `O sistema ficou em dúvida porque a mensagem cita um nome diferente de ${c.membroNome ?? "quem está em foco"}.`,
  },
  foco_fragil: {
    titulo: "Não deu para saber de quem é",
    explicacao: (c) =>
      `A família tem mais de uma criança acompanhada e a mensagem não diz de quem se trata. O sistema não quis chutar ${c.membroNome ?? "um perfil"}.`,
  },
  sujeito_multiple_or_ambiguous: {
    titulo: "A mensagem fala de mais de uma pessoa",
    explicacao: () =>
      "O sistema encontrou mais de uma pessoa na mesma frase e não separou quem é quem.",
  },
  sujeito_unknown: {
    titulo: "Não ficou claro de quem é",
    explicacao: () => "O sistema não conseguiu identificar sobre quem é a informação.",
  },
};

const CANAL: Record<string, string> = {
  whatsapp: "WhatsApp",
  web: "Web",
  diario: "Diário",
  tela: "Tela",
  sistema: "Sistema",
};

function dataBr(iso: string): string {
  const d = String(iso).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const [a, m, dia] = d.split("-");
  return `${dia}/${m}/${a}`;
}

type Props = { caso: CasoRevisao; onResolvido: (id: string) => void };

export function CasoCard({ caso, onResolvido }: Props) {
  const [pendente, iniciar] = useTransition();
  const [confirmando, setConfirmando] = useState<null | "pessoa_errada" | "descartar">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState(false);

  const motivo = MOTIVO_HUMANO[caso.motivo ?? ""] ?? {
    titulo: "Precisa de conferência",
    explicacao: () => "O sistema separou este caso para revisão humana.",
  };

  function executar(decisao: "aprovar" | "pessoa_errada" | "descartar" | "em_duvida") {
    if (pendente) return; // trava o clique duplo no cliente; o servidor também trava
    setErro(null);
    iniciar(async () => {
      const r = await decidir({ fatoId: caso.id, decisao });
      if (r.ok) {
        onResolvido(caso.id);
      } else {
        setErro("Não deu para salvar agora. Tente de novo.");
        setConfirmando(null);
      }
    });
  }

  return (
    <article className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm">
      <header className="mb-4">
        <h2 className="text-lg font-semibold text-neutral-900">{motivo.titulo}</h2>
        <p className="mt-1 text-sm text-neutral-600">
          Compare o que foi dito com o que o sistema entendeu e escolha uma opção.
        </p>
        <p className="mt-2 text-xs text-neutral-500">
          {CANAL[caso.canal ?? ""] ?? caso.canal ?? "origem desconhecida"} ·{" "}
          {dataBr(caso.observadoEm)}
          {caso.membroNome ? ` · perfil de ${caso.membroNome}` : ""}
        </p>
      </header>

      <div className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
        {motivo.explicacao(caso)}
      </div>

      <section className="mb-4">
        <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
          O que o sistema entendeu
        </h3>
        <p className="text-base text-neutral-900">{caso.afirmacao}</p>
        {caso.tempoOriginal ? (
          <p className="mt-1 text-sm text-neutral-600">Quando: “{caso.tempoOriginal}”</p>
        ) : null}
      </section>

      {caso.dominiosSensiveis.length > 0 ? (
        <p className="mb-4 text-xs text-neutral-600">
          Assunto delicado: {caso.dominiosSensiveis.join(", ")}
        </p>
      ) : null}

      {erro ? (
        <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{erro}</p>
      ) : null}

      {confirmando ? (
        <div className="mb-3 rounded-lg border border-neutral-300 bg-neutral-50 p-4">
          <p className="text-sm text-neutral-800">
            {confirmando === "pessoa_errada"
              ? "Este fato será invalidado porque está no perfil errado. Ele não vai ser transferido automaticamente para outro perfil."
              : "Este fato será descartado e não será usado. O que a família contou continua guardado."}
          </p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => setConfirmando(null)}
              className="min-h-11 rounded-lg border border-neutral-300 px-4 text-sm"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={pendente}
              onClick={() => executar(confirmando)}
              className="min-h-11 rounded-lg bg-red-600 px-4 text-sm font-medium text-white disabled:opacity-50"
            >
              {pendente ? "Salvando…" : "Confirmar"}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pendente}
            onClick={() => executar("aprovar")}
            className="min-h-11 flex-1 rounded-lg bg-emerald-600 px-4 text-sm font-medium text-white disabled:opacity-50"
          >
            Está certo
          </button>
          <button
            type="button"
            disabled={pendente}
            onClick={() => setConfirmando("pessoa_errada")}
            className="min-h-11 flex-1 rounded-lg border border-neutral-300 px-4 text-sm disabled:opacity-50"
          >
            Perfil errado
          </button>
          <button
            type="button"
            disabled={pendente}
            onClick={() => setConfirmando("descartar")}
            className="min-h-11 flex-1 rounded-lg border border-neutral-300 px-4 text-sm disabled:opacity-50"
          >
            Descartar
          </button>
          <button
            type="button"
            disabled={pendente}
            onClick={() => executar("em_duvida")}
            className="min-h-11 flex-1 rounded-lg border border-neutral-300 px-4 text-sm text-neutral-600 disabled:opacity-50"
          >
            Não sei dizer
          </button>
        </div>
      )}

      <details
        open={detalhes}
        onToggle={(e) => setDetalhes((e.target as HTMLDetailsElement).open)}
        className="mt-4"
      >
        <summary className="cursor-pointer text-xs text-neutral-500">Detalhes técnicos</summary>
        <dl className="mt-2 grid grid-cols-2 gap-1 text-xs text-neutral-600">
          <dt>conceito</dt>
          <dd>{caso.conceito}</dd>
          <dt>domínio</dt>
          <dd>{caso.dominio}</dd>
          <dt>sujeito</dt>
          <dd>{caso.sujeito ?? "—"}</dd>
          <dt>motivo</dt>
          <dd>{caso.motivo ?? "—"}</dd>
          <dt>verificação</dt>
          <dd>{caso.verificationStatus}</dd>
          <dt>evidência</dt>
          <dd className="break-all">{caso.sourceContentId ?? "ausente"}</dd>
          <dt>execução</dt>
          <dd className="break-all">{caso.extractionRunId ?? "—"}</dd>
          <dt>fato</dt>
          <dd className="break-all">{caso.id}</dd>
        </dl>
      </details>
    </article>
  );
}
