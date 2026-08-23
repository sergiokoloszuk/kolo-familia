import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getAnthropicClient, MODELS } from "@/lib/ia/anthropic";
import { logarUsoApi } from "@/lib/billing/logar";
import { MEMBRO_CAMPOS_TOPLEVEL, MEMBRO_CAMPOS_EXTRAS } from "@/lib/kolo-vivo/campos";
import { SUBCAMPOS_DOMINIO } from "@/lib/kolo-vivo/subcampos";
import {
  avaliarFatos,
  CAMPOS_CAMADA2,
  type FatoAceito,
  type FatoCandidato,
  type FatoRejeitado,
  type ModoGuarda,
  type Via,
} from "./fato";

/**
 * EXTRATOR COMPARTILHADO DE CONHECIMENTO — um cérebro, dois canais.
 *
 * ── de onde este arquivo veio ─────────────────────────────────────────────
 *
 * Era `lib/ia/atualizar.ts`, e só a web chamava. Mudou de lugar, não de ideia:
 * a lógica é a mesma, os nomes exportados são os mesmos, e `lib/ia/atualizar.ts`
 * virou um reexport pra que nenhum chamador precise saber disso.
 *
 * A razão da mudança está em `fato.ts`: os dois canais aprendiam de formas
 * diferentes sobre a mesma criança. O WhatsApp usava `parseInbound` (UM fato
 * por turno, sem ver o perfil) mais uma segunda chamada de modelo só pra achar
 * o sub-campo. A web já fazia melhor — em lote, com sub-campo, vendo o perfil e
 * tratando evolução. Não fazia sentido construir um terceiro extrator; fazia
 * sentido tirar o melhor de dentro de `lib/ia/` (que é território da web) e pôr
 * onde os dois podem chamar.
 *
 * ⚠️ NESTA FASE O WHATSAPP AINDA NÃO CHAMA. A migração dele é o portão
 * seguinte, e depende de aprovação. O que esta fase entrega é o módulo
 * neutro, instrumentado e com guardas — provado em isolamento, com a web se
 * comportando exatamente como antes.
 *
 * ── o que mudou de verdade ────────────────────────────────────────────────
 *
 * 1. **O custo passou a existir.** `extrairAtualizacoes` nunca chamou
 *    `logarUsoApi`. Não tinha `feature`, então não aparecia em `api_calls`, e
 *    todas as medições de custo que fizemos cobriam só o WhatsApp. A web
 *    gastava modelo em silêncio.
 *
 * 2. **A saída passou por guardas** (`fato.ts`), que falham fechadas.
 *
 * 3. **A procedência é determinada aqui**, pelo pipeline — nunca pelo modelo.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Contrato legado — preservado porque a web inteira depende dele
// ─────────────────────────────────────────────────────────────────────────────

export const CAMPOS_CAMADA1: readonly string[] = [
  ...MEMBRO_CAMPOS_TOPLEVEL,
  ...MEMBRO_CAMPOS_EXTRAS,
];

export { CAMPOS_CAMADA2 };

export type ItemKoloVivo = {
  camada: "camada1" | "camada2";
  campo: string;
  /** Sub-campo (ex.: nutricional → "rejeita"), quando o domínio tem sub-campos. */
  subcampo?: string | null;
  texto: string;
  operacao: "adicionar" | "reescrever";
};

export type PropostaAtualizacao = {
  koloVivo: ItemKoloVivo[];
  conquista: string | null;
  desafio: string | null;
  /**
   * O MESMO conhecimento no contrato canônico, com `habilidade_id` e
   * procedência. Convive com `koloVivo` de propósito: a web continua lendo o
   * formato antigo enquanto a migração acontece, e quem já quiser o contrato
   * novo lê daqui sem esperar ninguém.
   */
  fatos: FatoAceito[];
  /** O que as guardas recusaram, com motivo. Sem isto a recusa some. */
  rejeitados: FatoRejeitado[];
};

const PropostaSchema = z.object({
  kolo_vivo: z
    .array(
      z.object({
        camada: z.enum(["camada1", "camada2"]),
        campo: z.string(),
        subcampo: z.string().trim().nullable().optional(),
        texto: z.string().trim().min(1),
        operacao: z.enum(["adicionar", "reescrever"]).default("adicionar"),
        // Opcionais: o prompt de hoje não os pede, então vêm ausentes e as
        // guardas do modo `compativel` não os exigem. Estão no schema porque o
        // modo `estrito` — o destino — exige, e um schema que muda depois é
        // uma segunda migração.
        citacao: z.string().trim().nullable().optional(),
        inferido: z.boolean().optional(),
      }),
    )
    .default([]),
  conquista: z.string().trim().min(1).nullable().default(null),
  desafio: z.string().trim().min(1).nullable().default(null),
});

const SYSTEM = `Você é o assistente de registro do Kolo Família. Lê uma conversa entre um adulto responsável e a Kolo (assistente) e CAPTURA o que vale guardar sobre a criança/família. Devolve APENAS JSON, nada antes ou depois.

Sua missão é ajudar a plataforma a ir aprendendo sobre a criança a cada conversa. Seja GENEROSO com o que é NOVO: é melhor propor um fato novo e o adulto desmarcar do que deixar passar. Mas capture só FATOS ditos pelo adulto — NUNCA o conselho/sugestão que a Kolo deu.

REGRA DE NOVIDADE (dura): antes de propor QUALQUER item, confira o "Perfil atual". Se a informação JÁ está registrada — mesmo dita com outras palavras — NÃO proponha (não duplique). Só proponha o que ACRESCENTA algo realmente novo, ou use "reescrever" para REFINAR/CORRIGIR o que já existe. Na dúvida entre repetir e omitir, OMITA.

EVOLUÇÃO (importante): a criança cresce e muda. Se a info CONTRADIZ ou EVOLUI um valor já registrado — especialmente um STATUS/termômetro (ex.: estava "não-verbal" e passou a falar; seletividade alimentar era "Alta" e diminuiu; antes não dormia sozinha e agora dorme) — proponha ATUALIZAR com operacao "reescrever" (NÃO "adicionar"), trazendo o valor NOVO. Mudar um status assim é um marco da evolução; não deixe o dado antigo envelhecer.

Capture em 3 destinos (qualquer um pode ficar vazio):

1. kolo_vivo — informações duradouras. Cada item { camada, campo, texto, operacao }:
   - camada "camada1" (a criança) — escolha o campo MAIS específico:
     • nutricional → ALIMENTAÇÃO: o que come/aceita, o que recusa, texturas, seletividade, dificuldades à mesa, água. GATILHOS: "come", "não come", "aceita", "recusa", "fruta", "verdura", "textura", "seletiv", "à mesa".
     • sono → como adormece, como dorme, despertares, horário de dormir.
     • sensorial → reações a som, luz, textura, toque, cheiro, movimento.
     • comunicacao → como se expressa e como entende (fala, palavras, apontar, imagens, CAA).
     • socializacao → como se relaciona com outras pessoas, com quem flui, o que trava.
     • emocional → gatilhos, sinais quando está difícil, crises, o que ajuda a regular. GATILHOS: "crise", "birra", "frustra", "explode", "chora", "acalma".
     • foco → atenção, concentração, dispersão, hiperfoco.
     • motor → coordenação do corpo todo (grossa) e das mãos (fina).
     • autonomia → o que faz sozinha, o que ainda precisa de ajuda.
     • aprendizado → como aprende, o que ajuda a aprender.
     • imitacao → o que imita (gestos, sons, faz de conta).
     • tela_midia → relação com telas (o que assiste, quanto, como reage).
     • escola → adaptações, o que funciona, queixas.
     • saude_geral → acompanhamentos, alergias, saúde.
     • como_e → interesses, gostos, jeito de ser (que NÃO sejam comida). GATILHOS: "gosta de", "adora", "ama", "curte".
     • essencial → diagnóstico ou algo central de quem ela é.
     • (legado — evite, prefira os específicos acima) corpo_rotina, desafios_regulacao.
   - camada "camada2" (a família), campo: composicao, rotina, recursos (terapias/escola/apoios), dinamica.
   - **operacao** — olhe o "Perfil atual" antes de decidir:
     • "adicionar" → é um FATO NOVO que NÃO está na seção. texto = a frase curta nova.
     • "reescrever" → o assunto JÁ está na seção e você vai REFINAR/atualizar (mais detalhe, correção). texto = o TEXTO COMPLETO e atualizado da seção, integrando o que já existia + o novo, SEM perder nada importante e SEM repetir.
   - Se a info já está na seção (igual OU equivalente, com outras palavras), NÃO inclua o item.

2. conquista — algo que deu certo / um avanço pra celebrar (frase curta), senão null.

3. desafio — uma dificuldade pontual do dia (frase curta), senão null.

Exemplos:
- "ela adora andar de bicicleta" e a seção como_e não menciona bicicleta → { camada1, como_e, "Adora andar de bicicleta.", "adicionar" }.
- "não aceita frutas e só come o que é crocante" → { camada1, nutricional, "Não aceita frutas; aceita bem alimentos crocantes.", "adicionar" }.
- "ela demora muito pra dormir, só com luz baixa" → { camada1, sono, "Demora pra adormecer; precisa de luz baixa.", "adicionar" }.
- "ele comeu brócolis pela primeira vez" → conquista: "Comeu brócolis pela primeira vez."

Alguns campos têm SUB-CAMPOS — quando propuser um item nesses campos, escolha também "subcampo" (a dimensão exata). Se o sub-campo tiver valor fixo, o "texto" deve ser exatamente um desses valores. (A lista exata vem na mensagem.)

Formato OBRIGATÓRIO (apenas isto):
{ "kolo_vivo": [ { "camada": "camada1", "campo": "nutricional", "subcampo": "rejeita", "texto": "frutas", "operacao": "adicionar" } ], "conquista": null, "desafio": "..." }`;

/**
 * ⚠️ O TRECHO QUE SÓ ENTRA NO MODO ESTRITO.
 *
 * Pedir citação muda o que o modelo devolve, e mudar o que o modelo devolve na
 * web sem provar em produção é o erro que o protocolo chama de "acrescentar
 * prompt antes de auditar". Por isso ele existe, está testado, e está
 * DESLIGADO no caminho da web — que continua no modo `compativel`.
 */
const SYSTEM_ESTRITO = `

ÂNCORA OBRIGATÓRIA. Em CADA item de kolo_vivo inclua também:
- "citacao": o TRECHO LITERAL da fala do adulto que sustenta o fato — copiado, sem parafrasear, sem corrigir, sem juntar pedaços distantes. Se você não consegue copiar um trecho, o fato não é do adulto: não o proponha.
- "inferido": true se for uma LEITURA sua (o adulto não disse, você concluiu); false se o adulto afirmou.

Uma leitura sua nunca pode ser marcada como afirmação do adulto.`;

export type ParamsExtracao = {
  transcript: string;
  koloVivoResumo: string;
  membro: { nome: string; idade: number | null; perfil: string } | null;
  /**
   * ⚠️ Cliente vindo de QUEM CHAMA, como manda `logarUsoApi`. Na web tem que
   * ser SERVICE ROLE: `api_calls` é tabela de auditoria e a RLS recusa o
   * INSERT da sessão da família — foi assim que `conversa_web` ficou com ZERO
   * registros por meses. Ausente, a extração roda e só não é medida.
   */
  supabase?: SupabaseClient | null;
  familyId?: string | null;
  /** Por onde a informação entrou. Vira `procedencia.via` de cada fato. */
  via: Via;
  /** ISO do momento. Vem de fora pra que a simulação possa congelar o tempo. */
  em?: string;
  /** Texto original da família — é contra ELE que a citação é conferida. */
  entradaNormalizada?: string;
  /** Estado atual por domínio, pra guarda condicional (`mostrarSe`). */
  estadoAtual?: Record<string, string>;
  modo?: ModoGuarda;
  meta?: Record<string, unknown>;
};

export async function extrairAtualizacoes(
  params: ParamsExtracao,
): Promise<PropostaAtualizacao> {
  const {
    transcript,
    koloVivoResumo,
    membro,
    supabase = null,
    familyId = null,
    via,
    em = new Date().toISOString(),
    entradaNormalizada,
    estadoAtual = {},
    modo = "compativel",
    meta,
  } = params;

  const client = getAnthropicClient();

  const regraMembro = membro
    ? `A conversa é sobre a criança: ${membro.nome}${membro.idade != null ? `, ${membro.idade} anos` : ""}, perfil ${membro.perfil}.`
    : `A conversa é sobre a família em geral (sem criança específica): use SÓ camada2 no kolo_vivo, e deixe conquista e desafio como null.`;

  const instrSub = Object.entries(SUBCAMPOS_DOMINIO)
    .map(([campo, subs]) => {
      const lista = subs
        .map((s) => (s.opcoes ? `${s.key} (valor: ${s.opcoes.join("/")})` : s.key))
        .join(", ");
      return `- ${campo}: ${lista}`;
    })
    .join("\n");

  const userMsg = `${regraMembro}

<campos_com_subcampos>
Ao propor itens nestes campos, defina "subcampo":
${instrSub}
</campos_com_subcampos>

<kolo_vivo_atual>
${koloVivoResumo || "(vazio)"}
</kolo_vivo_atual>

<conversa>
${transcript}
</conversa>

Decida o que vale guardar e devolva o JSON.`;

  const vazio: PropostaAtualizacao = {
    koloVivo: [],
    conquista: null,
    desafio: null,
    fatos: [],
    rejeitados: [],
  };

  const system = modo === "estrito" ? `${SYSTEM}${SYSTEM_ESTRITO}` : SYSTEM;

  let raw = "";
  let inTok = 0;
  let outTok = 0;
  let falhou = false;
  const t0 = Date.now();
  try {
    const stream = client.messages.stream({
      model: MODELS.principal,
      max_tokens: 800,
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      messages: [{ role: "user", content: userMsg }],
    });
    const finalMessage = await stream.finalMessage();
    raw = finalMessage.content
      .filter((b): b is Extract<typeof b, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("");
    inTok = finalMessage.usage.input_tokens;
    outTok = finalMessage.usage.output_tokens;
  } catch {
    // Comportamento preservado: a extração é acessória — se o modelo falhar, a
    // conversa da família segue. O que MUDA é que a falha deixa de ser muda.
    falhou = true;
  }

  // ⚠️ INSTRUMENTAÇÃO — a lacuna que motivou esta fase.
  //
  // `void`, e não `await`: quem chama é uma server action que já devolveu o
  // essencial; esperar o INSERT de auditoria seria cobrar latência da família
  // por um número nosso. Mesmo padrão de `lib/ia/intencao.ts`.
  //
  // A duração vai em `meta` porque `api_calls` não tem coluna de duração — e
  // criar uma seria infraestrutura paralela de métrica, que a missão proíbe.
  if (supabase) {
    void logarUsoApi(supabase, {
      family_account_id: familyId,
      provider: "anthropic",
      model: MODELS.principal,
      feature: "extrair_conhecimento",
      input_tokens: inTok,
      output_tokens: outTok,
      meta: {
        ...(meta ?? {}),
        via,
        modo,
        ok: !falhou,
        duracao_ms: Date.now() - t0,
      },
    });
  }

  if (falhou) return vazio;

  const parsed = parseJson(raw);
  if (!parsed) return vazio;

  // ── as guardas ──────────────────────────────────────────────────────────
  const candidatos: FatoCandidato[] = parsed.kolo_vivo.map((item) => ({
    camada: item.camada,
    campo: item.campo,
    subcampo: item.subcampo ?? null,
    valor: item.texto,
    operacao: item.operacao,
    citacao: item.citacao ?? null,
    inferido: item.inferido ?? false,
  }));

  const { aceitos, rejeitados } = avaliarFatos({
    candidatos,
    temMembro: membro != null,
    entradaNormalizada: entradaNormalizada ?? transcript,
    procedenciaBase: { via, em },
    modo,
    estadoAtual,
  });

  return {
    // Formato legado, derivado dos MESMOS fatos aceitos — não de um segundo
    // caminho. Duas fontes para a mesma decisão sempre divergem.
    koloVivo: aceitos.map((f) => ({
      camada: f.camada,
      campo: f.campo,
      subcampo: f.subcampo,
      texto: f.valor,
      operacao: f.operacao,
    })),
    conquista: membro ? parsed.conquista : null,
    desafio: membro ? parsed.desafio : null,
    fatos: aceitos,
    rejeitados,
  };
}

function parseJson(s: string): z.infer<typeof PropostaSchema> | null {
  const trimmed = s.trim();
  let candidate: unknown;
  try {
    candidate = JSON.parse(trimmed);
  } catch {
    const match =
      trimmed.match(/```json\s*([\s\S]*?)\s*```/i) ?? trimmed.match(/(\{[\s\S]*\})/);
    if (!match) return null;
    try {
      candidate = JSON.parse(match[1]);
    } catch {
      return null;
    }
  }
  const parsed = PropostaSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}
