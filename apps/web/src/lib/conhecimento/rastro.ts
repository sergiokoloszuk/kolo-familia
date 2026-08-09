import { logEvent } from "@/lib/log";
import type { BoaPraticaRecuperada } from "./recuperar";

/**
 * O RASTRO DO CONHECIMENTO — para uma resposta já enviada, saber o que a Kolo
 * consultou.
 *
 * O problema que isto resolve (auditado em 06-08/08/2026): não havia como
 * responder *"a Ayla consultou o nosso conhecimento para responder isso? o que
 * encontrou? o que chegou ao modelo?"* para nenhuma conversa real. A
 * recuperação era invisível dos dois lados — quando funcionava e quando
 * devolvia vazio —, e uma resposta escrita só com o conhecimento geral do
 * modelo era indistinguível de uma sustentada pelo acervo.
 *
 * ⚠️ ISTO É OBSERVABILIDADE, E OBSERVABILIDADE NÃO PODE MUDAR O QUE MEDE.
 * Nada aqui altera quais BPs são escolhidas, a ordem, o bloco, o prompt ou a
 * resposta. Só registra.
 *
 * ── TRÊS ESTADOS, e a diferença entre eles é o ponto ────────────────────────
 *
 *   RECUPERADO       — a consulta devolveu estes ids.
 *   ENVIADO AO MODELO — destes, estes entraram no bloco do prompt.
 *   USADO            — **não observável**, e não vamos fingir que é.
 *
 * O terceiro é o que mais se gostaria de ter e é o único que este rastro NÃO
 * dá. Ter a BP no contexto não prova que ela sustentou a resposta; provar uso
 * exigiria outra coisa (o modelo citar o id, ou um juiz comparando resposta e
 * conteúdo). Registrar "usado" a partir de "estava no prompt" seria fabricar a
 * evidência mais importante da frente.
 *
 * PRIVACIDADE: só ids, contagens e rótulos. Nunca título de BP, texto da
 * família, prompt ou resposta — tudo isso já vive em outro lugar, e duplicar
 * dado de criança num log é criar um segundo lugar para vazar.
 */

export const KIND_RASTRO_CONHECIMENTO = "conhecimento_consultado";

export type CanalConhecimento = "whatsapp" | "web";

/** Por que o bloco saiu vazio. Distinguir isto é metade do valor do rastro. */
export type MotivoVazio =
  /** O classificador/roteador não devolveu skill nem tag: nem se consultou. */
  | "sem_skill"
  /** Consultou e o acervo não tinha nada para aquelas skills/idade. */
  | "acervo_vazio"
  /** A consulta falhou (erro de banco, timeout) e foi engolida. */
  | "erro_na_consulta";

export type RastroConhecimento = {
  canal: CanalConhecimento;
  familyId: string | null;
  membroId: string | null;
  /** Skills roteadas, na ordem — a primeira é a principal. */
  skills: readonly string[];
  /** Quantas tags entraram na consulta (a web manda; o WhatsApp não). */
  tags: number;
  idade: number | null;
  recuperados: readonly string[];
  enviados: readonly string[];
  motivoVazio?: MotivoVazio;
};

/**
 * O motivo do vazio, deduzido do que se sabe — nunca "não sei".
 *
 * `erroNaConsulta` vem de fora porque a recuperação engole a própria falha
 * (devolve `[]` num catch). Sem esse sinal, erro de banco e acervo vazio ficam
 * indistinguíveis — que é exatamente o estado que este rastro existe para
 * acabar.
 */
export function motivoDoVazio(p: {
  skills: readonly string[];
  tags: number;
  erroNaConsulta?: boolean;
}): MotivoVazio {
  if (p.erroNaConsulta) return "erro_na_consulta";
  if (p.skills.length === 0 && p.tags === 0) return "sem_skill";
  return "acervo_vazio";
}

/**
 * Monta o rastro a partir do que a recuperação devolveu e do que foi para o
 * bloco. Pura, para poder ser testada sem banco e sem modelo.
 *
 * `enviadas` é passada separadamente de propósito: hoje o bloco leva tudo o
 * que foi recuperado, mas isso é uma coincidência do código atual, não uma
 * garantia. No dia em que alguém filtrar entre uma coisa e outra, o rastro
 * mostra a diferença em vez de escondê-la.
 */
export function montarRastro(p: {
  canal: CanalConhecimento;
  familyId: string | null;
  membroId: string | null;
  skills: readonly string[];
  tags?: number;
  idade?: number | null;
  recuperadas: readonly BoaPraticaRecuperada[];
  enviadas: readonly BoaPraticaRecuperada[];
  erroNaConsulta?: boolean;
}): RastroConhecimento {
  const tags = p.tags ?? 0;
  const recuperados = p.recuperadas.map((b) => b.id).filter(Boolean);
  const enviados = p.enviadas.map((b) => b.id).filter(Boolean);
  const base: RastroConhecimento = {
    canal: p.canal,
    familyId: p.familyId ?? null,
    membroId: p.membroId ?? null,
    skills: [...p.skills],
    tags,
    idade: p.idade ?? null,
    recuperados,
    enviados,
  };
  // Vazio é o que se mede pelo que CHEGOU ao modelo. Recuperar três e mandar
  // zero é, para a família, o mesmo que não ter encontrado nada.
  if (enviados.length === 0) {
    return { ...base, motivoVazio: motivoDoVazio({ skills: p.skills, tags, erroNaConsulta: p.erroNaConsulta }) };
  }
  return base;
}

/**
 * Grava o rastro. Best-effort e silencioso por construção: `logEvent` já
 * engole a própria falha, e aqui há um segundo `catch` porque nenhuma família
 * pode perder uma resposta por causa de uma linha de log.
 */
export async function registrarRastroConhecimento(r: RastroConhecimento): Promise<void> {
  try {
    await logEvent({
      kind: KIND_RASTRO_CONHECIMENTO,
      severity: "info",
      // Operação normal que precisa sobreviver à retenção do stdout. Ver a
      // justificativa do campo em `lib/log.ts`.
      persistir: true,
      family_account_id: r.familyId,
      message: `${r.canal}: ${r.enviados.length} de ${r.recuperados.length} ao modelo${r.motivoVazio ? ` (vazio: ${r.motivoVazio})` : ""}`,
      payload: {
        canal: r.canal,
        membro_id: r.membroId,
        skills: r.skills,
        tags: r.tags,
        idade: r.idade,
        recuperados: r.recuperados,
        enviados: r.enviados,
        n_recuperados: r.recuperados.length,
        n_enviados: r.enviados.length,
        vazio: r.enviados.length === 0,
        motivo_vazio: r.motivoVazio ?? null,
        // Dito por extenso no próprio dado: quem ler isto daqui a seis meses
        // não pode concluir que a resposta se apoiou nestas BPs.
        uso_efetivo: "nao_observavel",
      },
    });
  } catch {
    /* observabilidade nunca derruba a conversa */
  }
}
