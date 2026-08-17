/**
 * Leitura do campo "nome da criança" — só regex e string, sem I/O e sem IA.
 *
 * Mora separado de `crianca-especifica.ts` de propósito: aquele módulo importa o
 * cliente da Anthropic, que arrasta `node:path` junto. Como `pronomes.ts` usa
 * estas funções e é importado por componentes de cliente (tela-1-mae.tsx), tê-las
 * lá fazia o SDK inteiro cair no bundle do navegador e o build quebrava. Mantenha
 * este arquivo puro — nada de client, supabase ou fetch aqui dentro.
 *
 * O contexto do porquê isso existe está em `crianca-especifica.ts`.
 */

/** Sinais de que quem cadastrou é PROFISSIONAL (terapeuta, escola, clínica). */
const PROFISSIONAL =
  /\b(terapeuta|psic[óo]loga?o?|psicopedagoga?o?|fonoaudi[óo]loga?o?|fono|t\.?o\.?|terapia ocupacional|professora?|pedagoga?|educadora?|cl[íi]nica|consult[óo]rio|pacientes?|alunos?|atendo|atendimento|v[áa]rias crian[çc]as|muitas crian[çc]as|diversas crian[çc]as)\b/i;

/** Frase em 1ª pessoa / recado — não é nome de pessoa. */
const FRASE_1A_PESSOA =
  /\b(sou|tenho|cuido|trabalho|atendo|preciso|quero|gostaria|meu|minha|meus|minhas|somos)\b/i;

/** Placeholder no lugar do nome ("ainda não sei", "a definir", "meu filho"). */
const PLACEHOLDER =
  /\b(n[ãa]o sei|ainda n[ãa]o|a definir|sem nome|n[ãa]o informad[oa]|crian[çc]as?|filh[oa]s?|beb[êe]|nen[êe]|an[ôo]nimo|teste|xxx+)\b/i;

export type MotivoNomeNaoNome = "profissional" | "recado" | null;

/**
 * O texto no campo do nome dá pra usar numa frase ("a comunicação da ___")?
 * Nome composto longo ("Ryan Lucas de Oliveira Feitosa") É válido — o que
 * invalida é pontuação de frase, verbo em 1ª pessoa, tamanho absurdo ou palavra
 * de profissão. Sem isso a regra barraria mães que só escreveram o nome inteiro.
 */
export function nomeUsavelCrianca(nome: string | null | undefined): boolean {
  return motivoNomeNaoNome(nome) === null;
}

/**
 * O mesmo detector, aplicado a QUEM CUIDA — `family_profiles.nome_mae` e
 * `como_chamar`.
 *
 * Por que existe (caso real, 02/08/2026): uma mãe escreveu a apresentação
 * inteira no campo do nome — "Meu Nome e Gisela Meu Filgo e Davi Ele e
 * Autista" — e a primeira mensagem que ela recebeu começou exatamente assim,
 * com a frase impressa crua no lugar do nome dela.
 *
 * O detector já pegava esse texto ("recado": 48 caracteres, 10 palavras, verbo
 * em 1ª pessoa). Ele só nunca tinha sido ligado ao campo do cuidador — estava
 * aplicado apenas ao nome da criança. Isto aqui é a fiação que faltava, e é de
 * propósito o MESMO detector: um detector paralelo divergiria com o tempo.
 *
 * Quando devolve false, quem chama fala SEM nome. Nunca com o nome da criança
 * no lugar — esse é o outro buraco, e ele é tratado no contexto do responder.
 */
export function nomeUsavelCuidador(nome: string | null | undefined): boolean {
  return motivoNomeNaoNome(nome) === null;
}

/**
 * O que a Ayla usa pra chamar quem cuida: o primeiro nome, se o campo for
 * mesmo um nome. Caso contrário, string vazia — e as templates já sabem
 * saudar sem nome ("Oi!" em vez de "Oi, !").
 *
 * É aqui que os dois funis do WhatsApp (`loadFamiliaParaEnvio` e a mensagem
 * espontânea) filtram `como_chamar`/`nome_mae`, num lugar só.
 */
export function primeiroNomeConfiavel(nome: string | null | undefined): string {
  return nomeUsavelCuidador(nome) ? primeiroNome(nome) : "";
}

/**
 * O irmão do anterior, para a CRIANÇA: o primeiro nome quando o campo é mesmo
 * um nome; string vazia quando não é.
 *
 * ⚠️ POR QUE VIROU FUNÇÃO (17/08/2026). Esta mesma expressão —
 * `nomeUsavelCrianca(x) ? primeiroNome(x) : ""` — estava escrita à mão em
 * `messageTemplates.ts` e PRECISAVA ser repetida em cinco proativas escritas
 * direto no orquestrador. Seis cópias da mesma decisão é como ela diverge; uma
 * função é uma fonte só.
 *
 * O caso que cobrou (Paula, 17/08/2026): o campo do nome tinha `"Meu Filhos"`,
 * e a proativa do vídeo saiu dizendo "montar histórias do Meu Filhos". Noventa
 * segundos depois, a conversa reativa — que JÁ consultava o detector — disse
 * "no cadastro o nome dela não veio". Duas mensagens contradizendo uma à outra.
 *
 * ⚠️ NÃO USE ISTO PARA IDENTIFICAR A CRIANÇA. O nome cru continua sendo o dado
 * de identidade (é por ele que o orquestrador casa "a Manu" com o membro
 * certo); o que esta função devolve é o nome de FALAR. Filtrar na origem
 * quebraria o casamento por nome.
 */
export function primeiroNomeCriancaConfiavel(nome: string | null | undefined): string {
  return nomeUsavelCrianca(nome) ? primeiroNome(nome) : "";
}

export function motivoNomeNaoNome(nome: string | null | undefined): MotivoNomeNaoNome {
  const n = (nome ?? "").trim();
  if (!n) return "recado";
  if (PROFISSIONAL.test(n)) return "profissional";
  if (/[.!?;:]/.test(n)) return "recado";
  if (FRASE_1A_PESSOA.test(n)) return "recado";
  if (PLACEHOLDER.test(n)) return "recado";
  if (n.length > 40) return "recado";
  if (n.split(/\s+/).length > 6) return "recado";
  if (/\d/.test(n)) return "recado";
  return null;
}

/** Primeiro nome — é assim que a Ayla chama a criança no WhatsApp. */
export function primeiroNome(nome: string | null | undefined): string {
  const n = (nome ?? "").trim();
  if (!n) return "";
  return n.split(/\s+/)[0];
}
