import { idadeAnos } from "@/lib/idade";
import { primeiroNomeCriancaConfiavel } from "./crianca-especifica";

/** Aceite isolado do convite das boas-vindas; relato concreto continua livre. */
export function aceitouPerguntasIniciais(texto: string): boolean {
  return /^(?:sim|ok|tá bom|ta bom|pode ser|quero|pode|vamos|claro|topo|bora|perguntas|quero responder|pode perguntar)[.!\s]*$/i.test(
    texto.trim(),
  );
}

export function recusouPerguntasIniciais(texto: string): boolean {
  return /^(?:não|nao|agora não|agora nao|prefiro não|prefiro nao)[.!\s]*$/i.test(texto.trim());
}

export function perguntaInicial(params: {
  nome: string | null;
  dataNascimento: string | null;
  falaPorSi?: boolean;
}): string {
  const idade = idadeAnos(params.dataNascimento);
  const nome = primeiroNomeCriancaConfiavel(params.nome) || "essa pessoa";
  if (idade == null) {
    return `Para começar: qual é a idade de ${nome}? Assim escolho uma pergunta que faça sentido. Pode responder por áudio.`;
  }
  if (idade <= 5) {
    return `Para conhecer melhor ${nome}: como costuma mostrar o que quer ou o que incomoda? Pode responder com um exemplo ou por áudio.`;
  }
  if (idade <= 10) {
    return `Para conhecer melhor ${nome}: em que momento da tarefa ou da rotina precisa de mais ajuda? Um exemplo já basta.`;
  }
  if (idade <= 17) {
    return `Para conhecer melhor ${nome}: o que gostaria que ficasse mais fácil, e que tipo de ajuda aceita?`;
  }
  return params.falaPorSi
    ? "Para começar: o que você quer tornar mais fácil no dia a dia, e o que já funciona para você?"
    : `Para começar: o que ${nome} gostaria de tornar mais fácil no dia a dia, e o que já funciona?`;
}
