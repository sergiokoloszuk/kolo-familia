/**
 * O VEREDITO DO ROLLOUT — a lógica separada do script, pra poder ser testada.
 *
 * ⚠️ POR QUE ISTO SAIU DO SCRIPT (07/08/2026): num check rápido eu contei
 * `provider === "openai"` sem olhar a `feature` e anunciei vazamento. Não era:
 * as linhas eram `ayla_audio` no `whisper-1` — transcrição de áudio, que SEMPRE
 * foi OpenAI e não tem nada a ver com a camada conversacional. Um alarme falso
 * desses custa um rollback de produção que ninguém precisava.
 *
 * A regra, então: vazamento é sobre a CONVERSA. Só `ayla_responder` (WhatsApp)
 * e `conversa_web` contam. Qualquer outra feature no OpenAI é uso normal.
 *
 * Só funções puras aqui — sem banco, sem env, sem console.
 */

/** As duas features da camada conversacional. Áudio e imagem NÃO entram. */
export const FEATURES_CONVERSA = ["ayla_responder", "conversa_web"];

/** Transcrição e afins: OpenAI por natureza, nunca sinal de rollout. */
export function ehConversacional(feature) {
  return FEATURES_CONVERSA.includes(feature);
}

/**
 * Agrupa as chamadas por família, contando só a conversa.
 *
 * Aceita a lista crua de `api_calls` de propósito: se o filtro do SELECT cair
 * um dia, o veredito continua certo — a defesa não pode morar só na query.
 */
export function agruparPorFamilia(chamadas) {
  const porFamilia = new Map();
  for (const r of chamadas) {
    if (!ehConversacional(r.feature)) continue;
    const f = porFamilia.get(r.family_account_id) ?? {
      openai: 0,
      anthropic: 0,
      usd: 0,
      modelos: new Set(),
      canais: new Set(),
    };
    f[r.provider] = (f[r.provider] ?? 0) + 1;
    f.usd += Number(r.custo_usd ?? 0);
    f.modelos.add(r.model);
    f.canais.add(r.feature === "conversa_web" ? "web" : "whatsapp");
    porFamilia.set(r.family_account_id, f);
  }
  return porFamilia;
}

/**
 * Sem allowlist, NÃO EXISTE veredito.
 *
 * ⚠️ SEGUNDO ALARME FALSO (07/08/2026, minutos depois do primeiro): rodei o
 * verificador da minha máquina. `OPENAI_TEST_FAMILY_IDS` vive no ambiente da
 * Vercel, não no `.env.local` — então a lista veio vazia, TODA família no GPT
 * pareceu não-autorizada, e o relatório mandou dar rollback. A família era
 * autorizada.
 *
 * Lista vazia significa "não sei quem pode", e não sei nunca pode virar
 * acusação. Quem chama tem que parar antes de ler o veredito.
 */
export function semAllowlist(autorizadas) {
  return autorizadas.size === 0;
}

/**
 * Os dois erros que importam, e a diferença entre "está errado" e "ninguém
 * escreveu ainda" — que é a confusão que faz mexer no que não está quebrado.
 *
 * Lança se a allowlist estiver vazia: devolver `vazamentos` cheio ali seria
 * mentir com a cara de dado.
 */
export function veredito(porFamilia, autorizadas) {
  if (semAllowlist(autorizadas)) {
    throw new Error(
      "allowlist vazia — sem OPENAI_TEST_FAMILY_IDS não dá pra dizer quem está autorizado",
    );
  }
  const lista = [...porFamilia];
  return {
    // GRAVE: família que não pediu pra testar está no GPT.
    vazamentos: lista.filter(([id, f]) => f.openai > 0 && !autorizadas.has(id)),
    // Configuração que não valeu: autorizada recebendo Claude.
    naoChegou: lista.filter(([id, f]) => autorizadas.has(id) && f.anthropic > 0),
    // Silêncio não é falha — mas também não prova nada.
    semDado: [...autorizadas].filter((id) => !porFamilia.has(id)),
  };
}
