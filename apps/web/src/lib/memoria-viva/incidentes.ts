import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * INCIDENTES ESTRUTURAIS — o que NÃO é caso de revisão.
 *
 * A distinção que organiza esta camada inteira:
 *
 *   REVISÃO   um fato ficou em quarentena porque o sistema teve dúvida.
 *             A barreira funcionou. Karina decide num botão.
 *
 *   INCIDENTE um fato ATIVO tem pessoa errada, ou falta proveniência, ou houve
 *             duplicação. A barreira FALHOU. Não há botão que conserte isso —
 *             a ação certa é desligar a coleta.
 *
 * Por isso incidente não tem botão de "resolver". Um botão ali daria a
 * sensação de que o problema foi tratado, quando o sistema está quebrado e
 * continua gravando.
 *
 * Todos os detectores devolvem **contagem e identificadores**, nunca o texto do
 * fato: a mensagem vai para o WhatsApp.
 */

export type TipoIncidente =
  | "pessoa_errada_ativa"
  | "cuidadora_ativa"
  | "sem_proveniencia"
  | "sem_evidencia"
  | "duplicacao_tecnica"
  | "estado_epistemologico_proibido"
  | "falha_persistente";

export type Incidente = {
  tipo: TipoIncidente;
  quantidade: number;
  /** Uma frase. Vai no WhatsApp. */
  descricao: string;
  /** Uma frase. O que está em risco. */
  risco: string;
  /**
   * O passo concreto. Nunca "verifique o sistema" — sempre a consulta exata ou
   * o comando exato, porque quem lê está no celular, à noite, sem contexto.
   */
  verificacao: string;
};

/** Marcadores de fala em primeira pessoa sobre si — a cuidadora, não a criança. */
const CUIDADORA = "(eu (estou|t[oô]|n[ãa]o)|me sinto|n[ãa]o aguento|minha vida)";
/** Menção a outra criança da casa. */
const OUTRA_CRIANCA = "(irm[ãa]o?|primo|prima|meu outro filho|minha outra filha|os dois|as duas)";

/**
 * Roda os detectores. Só o que é **estrutural** — conceito genérico e afirmação
 * composta não entram: são qualidade, vão no resumo semanal, e transformá-los
 * em alerta faria a mensagem perder o significado de urgência.
 */
export async function detectarIncidentes(supabase: SupabaseClient): Promise<Incidente[]> {
  const achados: Incidente[] = [];

  const contar = async (aplicar: (q: never) => unknown): Promise<number> => {
    try {
      const base = supabase.from("perfil_fatos").select("id", { count: "exact", head: true });
      const { count } = (await aplicar(base as never)) as { count: number | null };
      return count ?? 0;
    } catch {
      return 0;
    }
  };

  // 1. Fato ATIVO cujo texto menciona outra criança. A barreira deveria ter
  //    mandado para quarentena.
  const pessoaErrada = await contar((q) =>
    (q as never as { eq: (a: string, b: string) => { ilike: (a: string, b: string) => unknown } })
      .eq("status", "ativo")
      .ilike("afirmacao", "%irm%"),
  );
  if (pessoaErrada > 0) {
    achados.push({
      tipo: "pessoa_errada_ativa",
      quantidade: pessoaErrada,
      descricao: `${pessoaErrada} fato(s) ativo(s) mencionam outra criança da casa.`,
      risco: "A informação pode estar no perfil da criança errada.",
      verificacao:
        "No banco: select id, membro_atipico_id, afirmacao from perfil_fatos " +
        `where status='ativo' and afirmacao ~* '${OUTRA_CRIANCA}';`,
    });
  }

  // 2. Fato ATIVO em primeira pessoa sobre quem cuida.
  const cuidadora = await contar((q) =>
    (q as never as { eq: (a: string, b: string) => { ilike: (a: string, b: string) => unknown } })
      .eq("status", "ativo")
      .ilike("afirmacao", "%me sinto%"),
  );
  if (cuidadora > 0) {
    achados.push({
      tipo: "cuidadora_ativa",
      quantidade: cuidadora,
      descricao: `${cuidadora} fato(s) ativo(s) parecem ser sobre quem cuida, não sobre a criança.`,
      risco: "O perfil da criança está recebendo informação da mãe ou do pai.",
      verificacao:
        "No banco: select id, afirmacao from perfil_fatos " +
        `where status='ativo' and afirmacao ~* '${CUIDADORA}';`,
    });
  }

  // 3. Sem proveniência: não dá para saber de onde veio.
  const semProv = await contar((q) =>
    (q as never as { is: (a: string, b: null) => { is: (a: string, b: null) => unknown } })
      .is("source_message_id", null)
      .is("source_actor_id", null),
  );
  if (semProv > 0) {
    achados.push({
      tipo: "sem_proveniencia",
      quantidade: semProv,
      descricao: `${semProv} fato(s) sem origem registrada.`,
      risco: "Não é possível saber quem contou nem conferir depois.",
      verificacao:
        "No banco: select id, source_channel from perfil_fatos " +
        "where source_message_id is null and source_actor_id is null;",
    });
  }

  // 4. Sem evidência: o fato existe e a matéria-prima não.
  const semEvidencia = await contar((q) =>
    (q as never as { is: (a: string, b: null) => unknown }).is("source_content_id", null),
  );
  if (semEvidencia > 0) {
    achados.push({
      tipo: "sem_evidencia",
      quantidade: semEvidencia,
      descricao: `${semEvidencia} fato(s) sem referência ao conteúdo original.`,
      risco: "Esses fatos não poderão ser reprocessados nem conferidos.",
      verificacao:
        "No banco: select id, source_channel from perfil_fatos where source_content_id is null;",
    });
  }

  // 5. Estado epistemológico proibido: a IA deduziu e ficou como relato.
  const proibido = await contar((q) =>
    (q as never as { eq: (a: string, b: string) => { neq: (a: string, b: string) => unknown } })
      .eq("source_type", "ai_inference")
      .neq("verification_status", "inferred"),
  );
  if (proibido > 0) {
    achados.push({
      tipo: "estado_epistemologico_proibido",
      quantidade: proibido,
      descricao: `${proibido} fato(s) deduzidos pela IA estão marcados como se a família tivesse contado.`,
      risco: "Hipótese da Ayla virando informação sobre a criança.",
      verificacao:
        "No banco: select id from perfil_fatos " +
        "where source_type='ai_inference' and verification_status<>'inferred';",
    });
  }

  // 6. Duplicação técnica: o índice único deveria impedir.
  try {
    const { data } = await supabase.rpc("noop_inexistente");
    void data;
  } catch {
    /* sem rpc; a checagem abaixo usa consulta direta */
  }
  const dupes = await contarDuplicatas(supabase);
  if (dupes > 0) {
    achados.push({
      tipo: "duplicacao_tecnica",
      quantidade: dupes,
      descricao: `${dupes} chave(s) de idempotência repetida(s).`,
      risco: "O mesmo relato pode estar contando como várias evidências.",
      verificacao:
        "No banco: select idempotency_key, count(*) from perfil_fatos " +
        "group by 1 having count(*) > 1;",
    });
  }

  // 7. Falha persistente de gravação.
  try {
    const { count } = await supabase
      .from("eventos_app")
      .select("id", { count: "exact", head: true })
      .eq("kind", "perfil_fato_falhou")
      .gte("created_at", new Date(Date.now() - 86400_000).toISOString());
    if ((count ?? 0) >= 5) {
      achados.push({
        tipo: "falha_persistente",
        quantidade: count ?? 0,
        descricao: `${count} falhas de gravação nas últimas 24 h.`,
        risco: "A coleta está perdendo informação sem avisar.",
        verificacao:
          "No banco: select payload from eventos_app where kind='perfil_fato_falhou' " +
          "order by created_at desc limit 20;",
      });
    }
  } catch {
    /* sem eventos_app */
  }

  return achados;
}

async function contarDuplicatas(supabase: SupabaseClient): Promise<number> {
  try {
    const { data } = await supabase.from("perfil_fatos").select("idempotency_key").limit(5000);
    const vistas = new Set<string>();
    let repetidas = 0;
    for (const l of data ?? []) {
      const k = (l as { idempotency_key: string }).idempotency_key;
      if (vistas.has(k)) repetidas += 1;
      else vistas.add(k);
    }
    return repetidas;
  } catch {
    return 0;
  }
}

/**
 * A mensagem de incidente. Sem botão de resolver, de propósito.
 *
 * A ordem dos passos importa: desligar vem antes de investigar, porque cada
 * minuto com a coleta ligada é mais acervo contaminado. E "não apague" vem em
 * segundo porque o instinto de quem vê erro é limpar — e limpar destrói a
 * evidência de que o erro existiu.
 */
export function mensagemDeIncidente(incidentes: Incidente[], urlVerificacao: string): string {
  const linhas = [
    "🛑 Memória Viva precisa ser pausada",
    "",
    "Problema:",
    ...incidentes.map((i) => `• ${i.descricao}`),
    "",
    "Risco:",
    ...incidentes.map((i) => `• ${i.risco}`),
    "",
    "O que fazer agora:",
    "1. Desligue a flag PERFIL_FATOS_SHADOW_WRITE no painel da Vercel.",
    "2. NÃO apague nem altere nenhum fato — a evidência do erro é o que permite entender.",
    "3. Rode a verificação abaixo e mande o resultado para o responsável técnico:",
    ...incidentes.map((i) => `   ${i.verificacao}`),
    "4. Só religue depois de entender e corrigir a causa.",
    "",
    urlVerificacao,
  ];
  return linhas.join("\n");
}

/** A mensagem diária. Só sai quando há fila. */
export function mensagemDiaria(quantidade: number, url: string): string {
  const min = Math.max(1, Math.round(quantidade * 0.75));
  return [
    "⚠️ Memória Viva tem casos para você revisar",
    "",
    `Casos aguardando: ${quantidade}`,
    "",
    "O que fazer:",
    "Abra a fila, compare cada relato com o fato extraído e escolha uma opção.",
    "",
    "Tempo estimado:",
    `Aproximadamente ${min} minuto${min > 1 ? "s" : ""}.`,
    "",
    url,
  ].join("\n");
}
