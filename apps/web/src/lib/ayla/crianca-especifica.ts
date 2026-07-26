import type { SupabaseClient } from "@supabase/supabase-js";
import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";

/**
 * O Kolo se organiza em volta de UMA criança específica — é isso que faz o Kolo
 * Vivo acumular padrões e as ideias saírem sob medida em vez de genéricas. Mas o
 * campo do nome aceita qualquer coisa, e às vezes a pessoa usa o campo como
 * recado: uma terapeuta escreveu "Cuido de Várias Crianças. Sou Terapeuta!" e a
 * Ayla passou a dizer "a comunicação da Cuido de Várias Crianças. Sou
 * Terapeuta! tem pesado" (25/07).
 *
 * Aqui a Ayla PERCEBE isso e CONDUZ: em vez de seguir mandando engajamento em
 * cima de um nome que não é nome, ela explica como funciona e convida a pessoa a
 * escolher uma criança (nome + idade) — inclusive uma que ela atende, ou um caso
 * simulado, se for profissional querendo conhecer. Quando a pessoa responde, a
 * gente grava e a vida segue normal (auto-incorporação, sem formulário).
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

export type CriancaPendente = {
  membroId: string;
  nomeCru: string;
  motivo: Exclude<MotivoNomeNaoNome, null>;
};

/**
 * A família tem alguma criança de verdade definida? Se TODOS os membros têm
 * nome que não é nome, a conversa precisa resolver isso antes de qualquer
 * engajamento — devolve o primeiro pendente. Se pelo menos um membro está ok,
 * não é pendência (a Ayla fala daquele).
 */
export async function criancaPendente(
  supabase: SupabaseClient,
  familyId: string,
): Promise<CriancaPendente | null> {
  const { data } = await supabase
    .from("membros_atipicos")
    .select("id, nome, created_at")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });
  const membros = data ?? [];
  if (!membros.length) return null; // sem membro é outro problema (onboarding)

  const pendentes: CriancaPendente[] = [];
  for (const m of membros) {
    const motivo = motivoNomeNaoNome(m.nome as string);
    if (motivo === null) return null; // tem criança de verdade → segue normal
    pendentes.push({ membroId: m.id as string, nomeCru: (m.nome as string) ?? "", motivo });
  }
  return pendentes[0] ?? null;
}

/**
 * O convite. Explica em uma frase POR QUE o Kolo pede uma criança específica
 * (é o que faz a ajuda ser sob medida), pede nome + idade, e abre a porta pro
 * caso profissional: pode ser uma criança que ela atende ou uma situação
 * simulada. Sem tom de erro de formulário — ninguém errou nada.
 */
export function templateConviteCriancaEspecifica(params: {
  nomeMae: string;
  motivo: Exclude<MotivoNomeNaoNome, null>;
}): string {
  const oi = `Oi, ${params.nomeMae} 💛`;

  if (params.motivo === "profissional") {
    return [
      `${oi} Vi no cadastro que você acompanha várias crianças — que bom ter você aqui.`,
      "",
      "Deixa eu te contar como eu funciono, pra você me aproveitar de verdade: eu me organizo em volta de *uma criança por vez*. É isso que me faz útil — eu vou guardando o que você me conta (o que funcionou, o que não funcionou, os padrões que aparecem) e as ideias vão ficando sob medida pra aquela criança, em vez de genéricas.",
      "",
      "Então o melhor jeito de me conhecer é escolher *uma* criança: me diz o primeiro nome e a idade, e me traz uma situação real — do tipo “trava na hora de sair de casa” ou “não aceita alimento novo”. Eu te devolvo caminhos concretos, do jeito que dá pra levar pra família.",
      "",
      "E pode ser um caso simulado, se você preferir testar primeiro. Do jeito que ficar mais fácil pra você 🌿",
    ].join("\n");
  }

  return [
    `${oi} Antes de continuar, preciso te pedir uma coisinha 🌿`,
    "",
    "Eu me organizo em volta de *uma criança específica* — é assim que eu consigo guardar o que você me conta e ir ficando sob medida, em vez de dar ideia genérica. Só que no cadastro o nome dela não veio.",
    "",
    "Me diz só o *primeiro nome e a idade* dela? Aí eu já sigo daqui, com você.",
  ].join("\n");
}

type Extraido = { nome: string | null; idade: number | null };

const SYSTEM_EXTRAIR = `Você lê a resposta de uma pessoa que a Ayla acabou de convidar a escolher UMA criança específica (nome + idade). Extraia o que ela deu.

Devolva APENAS JSON: {"nome":"Lucas","idade":6}
- nome: só o PRIMEIRO nome da criança, como ela escreveu (capitalizado). null se ela não disse nome.
- idade: número em ANOS. "3 aninhos"→3, "vai fazer 5"→5, "1 ano e meio"→1, "18 meses"→1. null se não disse.
- Se ela falou de si mesma, recusou, perguntou outra coisa, ou não deu nome de criança: {"nome":null,"idade":null}.
- NÃO invente nome nem idade. Nome de criança, não o nome da mãe/terapeuta.`;

/** Lê a resposta dela e tira nome + idade da criança (null quando não veio). */
export async function extrairCriancaDaResposta(texto: string): Promise<Extraido> {
  const vazio: Extraido = { nome: null, idade: null };
  if (!texto.trim()) return vazio;
  try {
    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 120,
      system: SYSTEM_EXTRAIR,
      messages: [{ role: "user", content: texto.slice(0, 700) }],
    });
    const b = resp.content[0];
    const raw = b?.type === "text" ? b.text : "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return vazio;
    const j = JSON.parse(m[0]) as { nome?: unknown; idade?: unknown };
    const nome = typeof j.nome === "string" ? primeiroNome(j.nome).slice(0, 40) : null;
    const idadeNum = typeof j.idade === "number" ? Math.round(j.idade) : null;
    const idade = idadeNum != null && idadeNum >= 0 && idadeNum <= 30 ? idadeNum : null;
    // Nome que também não é nome (ela repetiu o recado) não serve.
    if (nome && !nomeUsavelCrianca(nome)) return vazio;
    return { nome: nome || null, idade };
  } catch (e) {
    console.warn("[ayla:crianca] extração falhou:", e instanceof Error ? e.message : e);
    return vazio;
  }
}

/**
 * Grava o que ela deu e devolve a fala de confirmação — ou null se ainda não dá
 * pra seguir (faltou o nome). Idade é bem-vinda mas não trava: com o nome a Ayla
 * já consegue conversar, e a idade ela pergunta no caminho.
 */
export async function resolverCriancaPendente(
  supabase: SupabaseClient,
  params: { pendente: CriancaPendente; texto: string },
): Promise<string | null> {
  const { nome, idade } = await extrairCriancaDaResposta(params.texto);
  if (!nome) return null;

  const patch: Record<string, unknown> = { nome };
  if (idade != null) patch.idade = idade;
  const { error } = await supabase
    .from("membros_atipicos")
    .update(patch)
    .eq("id", params.pendente.membroId);
  if (error) {
    console.warn("[ayla:crianca] update falhou:", error.message);
    return null;
  }

  const comIdade = idade != null ? `, ${idade} anos` : "";
  return [
    `Perfeito — ${nome}${comIdade} 🌿 Anotado: agora é sobre ${nome} que a gente fala.`,
    "",
    `Me conta uma situação de verdade que tá pesando: o que acontece, em que momento do dia, e o que vocês já tentaram. Com isso eu já te devolvo caminhos concretos.`,
  ].join("\n");
}
