import type { Genero } from "./pronomes";

/**
 * DE QUEM A FAMÍLIA ESTÁ FALANDO.
 *
 * Existe por causa de um caso real (03/08/2026). A mãe escreveu:
 *
 *   "Amanhã vai ser um dia bem importante porque a gente vai levar ELA no médico"
 *
 * Nenhum nome — só o pronome. `membroMencionado` procurava apenas nome próprio,
 * devolveu null, e a cadeia caiu em `membroConversa`, que trazia o Mario da
 * conversa anterior. O MODELO leu o perfil dos dois filhos, entendeu "ela" e
 * escreveu a resposta inteira sobre a Manu — mas o `membro_atipico_id` que foi
 * pro banco era o do Mario. A rotina da consulta médica da menina ficou salva
 * no irmão.
 *
 * A causa é estrutural: a identidade era decidida DUAS vezes, por regex antes
 * da geração e pelo modelo durante ela, e ninguém comparava as duas.
 *
 * Aqui a decisão é uma só, com ordem de prioridade explícita, e ela sabe dizer
 * "não sei" — que é o que faltava. `?? membros[0]` nunca diz não sei: chuta em
 * silêncio, e numa família com dois filhos isso é o dobro de chance de errar.
 */

export type MembroConhecido = {
  id: string;
  nome?: string | null;
  genero?: Genero;
};

export type AlvoResolvido =
  | { tipo: "resolvido"; membroId: string; motivo: "nome" | "genero" | "unico" | "contexto" }
  | { tipo: "ambiguo"; candidatos: MembroConhecido[]; motivo: "genero" | "sem_referencia" }
  | { tipo: "sem_membro" };

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/** Só o primeiro nome, que é como a família fala. */
function primeiro(nome: string | null | undefined): string {
  return norm(nome ?? "").trim().split(/\s+/)[0] ?? "";
}

/**
 * A mensagem cita o nome de alguém da família? Nome explícito é a prioridade
 * máxima e vence qualquer contexto anterior.
 */
export function citaNome(texto: string, membros: readonly MembroConhecido[]): MembroConhecido[] {
  const t = norm(texto);
  return membros.filter((m) => {
    const p = primeiro(m.nome);
    if (!p || p.length < 3) return false;
    return new RegExp(`\\b${p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(t);
  });
}

/**
 * A mensagem aponta um gênero — por relação ("minha filha") ou por pronome
 * ("ela")? Devolve o gênero apontado, ou null quando não há referência.
 *
 * Cuidado deliberado com "ela/ele": são palavras comuns e podem se referir a
 * qualquer coisa ("a escola, ela é ótima"). Por isso o pronome só conta quando
 * aparece perto de um verbo de cuidado/ação sobre pessoa — "levar ela",
 * "ajudar ele", "pra ela" — e não solto no meio de qualquer frase.
 */
export function generoApontado(texto: string): Genero | null {
  const t = norm(texto);

  // RELAÇÃO — inequívoca por definição.
  if (/\b(minha|nossa)\s+(filha|menina|garota|princesa)\b/.test(t)) return "feminino";
  if (/\b(meu|nosso)\s+(filho|menino|garoto)\b/.test(t)) return "masculino";
  // "a mais nova/velha" sem substantivo continua ambíguo de propósito: pode ser
  // idade entre irmãos do mesmo gênero.

  // PRONOME — só quando está claramente sobre uma pessoa sendo cuidada.
  const VERBO = "(levar|leva|levo|ajudar|ajuda|ajudo|buscar|busca|pegar|pega|acalmar|acalma|"
    + "colocar|coloca|deixar|deixa|dar|da|vestir|veste|alimentar|banhar|arrumar|arruma|"
    + "organizar|organiza|montar|monta|preparar|prepara|conversar|conversa|explicar|explica)";
  if (new RegExp(`\\b${VERBO}\\s+(a\\s+)?ela\\b`).test(t)) return "feminino";
  if (new RegExp(`\\b${VERBO}\\s+(o\\s+)?ele\\b`).test(t)) return "masculino";
  if (/\b(pra|para|com|d[ae])\s+ela\b/.test(t)) return "feminino";
  if (/\b(pra|para|com|d[ao])\s+ele\b/.test(t)) return "masculino";

  return null;
}

/**
 * A política, num lugar só. A ordem importa e é esta:
 *
 *   1. NOME EXPLÍCITO      — vence tudo, inclusive o contexto anterior.
 *   2. RELAÇÃO / PRONOME   — resolve quando há UM membro daquele gênero.
 *                            Duas filhas + "minha filha" = ambíguo, e ponto.
 *   3. UM MEMBRO SÓ        — não há o que confundir.
 *   4. CONTEXTO ATIVO      — só quando a mensagem não trouxe referência nenhuma.
 *   5. AMBÍGUO             — pergunta. NUNCA `membros[0]`.
 */
export function resolverMembroAlvo(params: {
  texto: string;
  membros: readonly MembroConhecido[];
  /** Quem a conversa vinha tratando. Só entra quando não há referência agora. */
  membroContexto?: string | null;
}): AlvoResolvido {
  const membros = params.membros.filter((m) => m.id);
  if (membros.length === 0) return { tipo: "sem_membro" };

  // 1. NOME EXPLÍCITO.
  const porNome = citaNome(params.texto, membros);
  if (porNome.length === 1) {
    return { tipo: "resolvido", membroId: porNome[0].id, motivo: "nome" };
  }
  // Citou dois nomes: a mensagem fala dos dois. Não é nossa decisão.
  if (porNome.length > 1) {
    return { tipo: "ambiguo", candidatos: porNome, motivo: "sem_referencia" };
  }

  // 2. RELAÇÃO / PRONOME.
  const genero = generoApontado(params.texto);
  if (genero) {
    const compativeis = membros.filter((m) => m.genero === genero);
    if (compativeis.length === 1) {
      return { tipo: "resolvido", membroId: compativeis[0].id, motivo: "genero" };
    }
    if (compativeis.length > 1) {
      // Duas filhas e "minha filha": a referência é real mas não distingue.
      return { tipo: "ambiguo", candidatos: compativeis, motivo: "genero" };
    }
    // Zero compatíveis (gênero não cadastrado): cai pras regras seguintes em
    // vez de barrar — perfil incompleto não pode travar a conversa.
  }

  // 3. UM MEMBRO SÓ.
  if (membros.length === 1) {
    return { tipo: "resolvido", membroId: membros[0].id, motivo: "unico" };
  }

  // 4. CONTEXTO ATIVO — e só aqui, depois de a mensagem não ter dito nada.
  const ctx = params.membroContexto;
  if (ctx && membros.some((m) => m.id === ctx)) {
    return { tipo: "resolvido", membroId: ctx, motivo: "contexto" };
  }

  // 5. AMBÍGUO.
  return { tipo: "ambiguo", candidatos: [...membros], motivo: "sem_referencia" };
}

/**
 * A GUARDA DE CONSISTÊNCIA.
 *
 * O texto já gerado cita, pelo nome, um membro DIFERENTE daquele em que o
 * artefato vai ser salvo? Então as duas decisões divergiram, e a divergência
 * silenciosa foi exatamente o que pôs a rotina da Manu no Mario.
 *
 * Devolve o membro citado no texto quando há conflito; null quando está tudo
 * coerente. Não decide o que fazer — quem chama decide (e a resposta certa é
 * não publicar e resolver a identidade primeiro).
 */
export function conflitoDeIdentidade(params: {
  texto: string;
  membroEscolhido: string;
  membros: readonly MembroConhecido[];
}): MembroConhecido | null {
  const citados = citaNome(params.texto, params.membros);
  if (citados.length !== 1) return null; // ninguém citado, ou os dois: sem conflito claro
  return citados[0].id === params.membroEscolhido ? null : citados[0];
}
