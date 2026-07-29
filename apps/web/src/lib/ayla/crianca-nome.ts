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
