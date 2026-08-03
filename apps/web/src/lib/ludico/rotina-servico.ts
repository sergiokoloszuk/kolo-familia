import type { SupabaseClient } from "@supabase/supabase-js";
import { avaliarProntidaoParaRotina } from "@/lib/ayla/prontidao-rotina";
import { validarRotina, resumirFalhas, type FalhaRotina } from "@/lib/ayla/validacao-rotina";
import { interpretarRotina } from "./rotina-ia";
import type { RotinaProposta } from "./rotina-ia-core";

/**
 * O SERVIÇO ÚNICO DE ROTINA — uma política, dois canais.
 *
 * Até 03/08/2026 existiam DOIS geradores decidindo o mesmo artefato:
 *
 *   app      → interpretarRotina() + SYSTEM_ROTINA
 *   WhatsApp → conduzirRotina()    + CONTRATO_ROTINA
 *
 * E eles se contradiziam. Sobre horário, literalmente:
 *   app:      "HORÁRIO É OPCIONAL... NUNCA invente horário"
 *   WhatsApp: "Horário que ela não deu, você PROPÕE a partir do que sabe"
 *
 * Mesma família, mesma criança, comportamento oposto conforme o canal. E o
 * prompt do app não carregava `nucleoConducao()` — era a mesma "segunda Ayla"
 * que já tínhamos matado no condutor de rotina do WhatsApp, viva do outro lado.
 *
 * Aqui a ordem é uma só, e vale para quem entrar por qualquer porta:
 *
 *   PRONTIDÃO  → é caso de rotina? tenho o mínimo? isto é meu?
 *   GERAÇÃO    → um gerador só (`interpretarRotina`)
 *   VALIDAÇÃO  → pode ser publicado?
 *
 * Quem chama decide o que fazer com o desfecho — o WhatsApp conversa, o app
 * mostra na tela. A INTERFACE pode ser diferente; a POLÍTICA não.
 *
 * O que este serviço deliberadamente NÃO faz: persistir, gerar PDF, mandar
 * link. Isso é de quem chamou, e é o que mantém o serviço testável sem banco.
 */

export type ResultadoRotina =
  | { desfecho: "gerou"; rotinas: RotinaProposta[]; tema: string | null; resposta: string }
  | { desfecho: "falta"; pergunta: string | null; motivo: string }
  | { desfecho: "falta_escopo"; motivo: string }
  | { desfecho: "nao_e_rotina"; motivo: string }
  | { desfecho: "limite_atuacao"; parteClinica: string | null; motivo: string }
  | { desfecho: "barrada"; falhas: FalhaRotina[]; motivo: string };

export async function gerarRotina(
  supabase: SupabaseClient,
  params: {
    familyId: string | null;
    membroAtipicoId: string;
    nome: string;
    idade: number | null;
    /** Idade em meses — bebê pequeno pesa no limite de atuação. */
    idadeMeses?: number | null;
    historico: Array<{ de: "mae" | "kolo"; texto: string }>;
    /** A última mensagem, para a prontidão avaliar o pedido de agora. */
    mensagem: string;
    /** O que já se sabe: perfil, rotina existente, transições. */
    contexto?: string;
    /** O ponto difícil que a conversa revelou — muda a granularidade. */
    pontoDificil?: string | null;
    /** Ajuste de uma proposta já mostrada (o app usa nas idas e vindas). */
    propostaAtual?: RotinaProposta[] | null;
    /** Pula a prontidão: o app quando a mãe já está no assistente e ajustando. */
    pularProntidao?: boolean;
  },
): Promise<ResultadoRotina> {
  const conversa = params.historico
    .map((h) => `${h.de === "mae" ? "Mãe" : "Ayla"}: ${h.texto}`)
    .join("\n");

  // ── 1. PRONTIDÃO ───────────────────────────────────────────────────────
  if (!params.pularProntidao) {
    const p = await avaliarProntidaoParaRotina({
      mensagem: params.mensagem,
      conversa,
      contexto: params.contexto,
      idadeMeses: params.idadeMeses ?? null,
    });
    console.log(`[rotina:servico] prontidão=${p.desfecho} motivo="${p.motivo}"`);

    if (p.desfecho === "nao_e_rotina") return { desfecho: "nao_e_rotina", motivo: p.motivo };
    if (p.desfecho === "falta_escopo") return { desfecho: "falta_escopo", motivo: p.motivo };
    if (p.desfecho === "falta") return { desfecho: "falta", pergunta: p.pergunta, motivo: p.motivo };
    if (p.desfecho === "limite_atuacao") {
      return { desfecho: "limite_atuacao", parteClinica: p.parteClinica, motivo: p.motivo };
    }
  }

  // ── 2. GERAÇÃO — o gerador oficial, o mesmo dos dois canais ────────────
  // O PONTO DIFÍCIL entra aqui e não num campo novo do schema: ele muda a
  // granularidade das etapas (uma preparação antes do momento que trava) e a
  // explicação que acompanha a rotina. Era coletado e jogado fora.
  const historico = params.pontoDificil
    ? [
        ...params.historico,
        {
          de: "mae" as const,
          texto: `(o que mais trava no dia: ${params.pontoDificil} — quebre esse momento em passos menores, com uma etapa de preparação antes dele)`,
        },
      ]
    : params.historico;

  const proposta = await interpretarRotina(supabase, {
    familyId: params.familyId,
    nome: params.nome,
    idade: params.idade,
    historico,
    propostaAtual: params.propostaAtual ?? null,
  });

  // REDE CONTRA MULTIPLICAÇÃO. O prompt já pede uma rotina por pedido, mas o
  // caso real (1 tarde → 5 rotinas de 33 etapas) mostra que a instrução sozinha
  // não segura. Rotinas com a MESMA sequência de tarefas são a mesma rotina.
  if (proposta.rotinas?.length > 1) {
    const vistas = new Map<string, (typeof proposta.rotinas)[number]>();
    for (const r of proposta.rotinas) {
      const chave = (r.tarefas ?? []).map((t) => t.texto.trim().toLowerCase()).join("|");
      if (!vistas.has(chave)) vistas.set(chave, r);
    }
    if (vistas.size < proposta.rotinas.length) {
      console.warn(
        `[rotina:servico] colapsou ${proposta.rotinas.length} → ${vistas.size} rotina(s) idênticas`,
      );
      proposta.rotinas = [...vistas.values()];
    }
  }

  if (!proposta.rotinas?.length) {
    return {
      desfecho: "falta",
      pergunta: proposta.pergunta ?? null,
      motivo: "gerador não devolveu rotina",
    };
  }

  // ── 3. VALIDAÇÃO — antes de qualquer persistência ou publicação ────────
  const tarefas = proposta.rotinas.flatMap((r) =>
    (r.tarefas ?? []).map((t) => ({ texto: t.texto, hora: t.hora })),
  );
  const veredito = validarRotina({
    tarefas,
    baseDeHorarios: `${conversa}\n${params.contexto ?? ""}`,
  });
  if (!veredito.ok) {
    console.warn(`[rotina:servico] BARRADA — ${resumirFalhas(veredito.falhas)}`);
    return {
      desfecho: "barrada",
      falhas: veredito.falhas,
      motivo: resumirFalhas(veredito.falhas),
    };
  }

  return {
    desfecho: "gerou",
    rotinas: proposta.rotinas,
    tema: proposta.tema ?? null,
    resposta: proposta.resposta ?? "",
  };
}
