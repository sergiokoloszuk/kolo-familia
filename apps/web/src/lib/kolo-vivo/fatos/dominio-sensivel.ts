/**
 * MARCADOR MÍNIMO DE DOMÍNIO SENSÍVEL.
 *
 * NÃO é o motor de Governança. Não bloqueia, não cita fonte, não encaminha, não
 * muda resposta nenhuma. A única coisa que faz é **marcar**, na escrita, os
 * fatos que um dia vão exigir cuidado especial.
 *
 * Por que agora e não depois: inferir "isto é médico" a posteriori, sobre texto
 * livre já acumulado, é o pior momento possível para inferir. Marcar na captura
 * custa uma coluna e um regex; descobrir depois custa reprocessar tudo.
 *
 * DOMÍNIO FUNCIONAL ≠ DOMÍNIO SENSÍVEL, e confundi-los é o erro fácil:
 *
 *   dominio = "sono"    dominios_sensiveis = ["medical"]      (usa medicação)
 *   dominio = "escola"  dominios_sensiveis = ["school_rights"] (fala de laudo)
 *   dominio = "sono"    dominios_sensiveis = []                (só rotina)
 *
 * Taxonomia curta e extensível de propósito: sem evidência de uso, uma lista
 * grande seria adivinhação. Ausência é `[]`, nunca `null` — array vazio diz
 * "avaliado e não é sensível"; `null` diria "ninguém olhou".
 */

export type DominioSensivel =
  | "medical"
  | "medication"
  | "diagnosis"
  | "legal"
  | "school_rights"
  | "safety"
  | "emotional_distress"
  | "neonatal";

function normalizar(t: string): string {
  return (t ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/**
 * Padrões por domínio. Deliberadamente ESTREITOS: falso negativo aqui custa um
 * fato não marcado, que dá para reprocessar; falso positivo enche o marcador de
 * ruído e ele deixa de significar alguma coisa.
 */
const PADROES: ReadonlyArray<[DominioSensivel, RegExp]> = [
  ["medication", /\b(remedio|medicac|medicament|dose|mg\b|ritalina|risperidona|melatonina|fluoxetina|receita medica)\b/],
  ["diagnosis", /\b(laudo|diagnostic|cid[- ]?1?0?\b|avaliacao neuropsicologic|deu no exame|foi diagnosticad)\b/],
  ["medical", /\b(neuro(pediatra|logista)?|psiquiatra|pediatra|exame|convuls|crise epilep|internac|cirurgia|refluxo|alergia grave)\b/],
  ["legal", /\b(direito|lei\b|judicial|advogad|processo|liminar|beneficio|bpc\b|inss\b)\b/],
  ["school_rights", /\b(aee\b|sala de recurso|adaptacao curricular|professor de apoio|mediador escolar|recusaram a matricula|nao aceitaram na escola)\b/],
  ["safety", /\b(autoles|se machuc|se cort|bate a cabeca|fugiu de casa|se jogou|engasg|sufoc|risco de vida)\b/],
  ["emotional_distress", /\b(nao aguento mais|nao quero mais viver|pensei em desistir|depress|panico|surto|colaps)\b/],
  ["neonatal", /\b(prematur|uti neonatal|recem[- ]nascid|nasceu de \d+ semanas|incubadora|apgar)\b/],
];

/**
 * Marca zero ou mais domínios sensíveis.
 *
 * `dominioFuncional` entra só como sinal fraco: alguns domínios do Kolo Vivo
 * tocam saúde por natureza, e ignorá-los perderia o óbvio.
 */
export function marcarDominiosSensiveis(
  afirmacao: string,
  dominioFuncional?: string | null,
): DominioSensivel[] {
  const t = normalizar(afirmacao);
  const achados = new Set<DominioSensivel>();

  for (const [dominio, re] of PADROES) {
    if (re.test(t)) achados.add(dominio);
  }

  // O domínio funcional `saude_geral` é sobre saúde por definição.
  if (normalizar(dominioFuncional ?? "").startsWith("saude")) achados.add("medical");

  return [...achados];
}
