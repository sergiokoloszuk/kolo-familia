/**
 * RECUPERAÇÃO da fronteira clínica — a instrução de refazer e o piso.
 *
 * Espelha `recuperacao-diagnostico.ts`, e pelo mesmo motivo: o piso NÃO pode ser
 * um acolhimento vazio. Quem escreveu "ela começou a tremer" ou "ele não come
 * desde que aumentou a dose" não pode receber "me conta um pouco mais" — nem
 * "procure um profissional" e ponto, que é a outra forma de abandonar.
 *
 * O piso aqui é mais curto e mais direto que o do diagnóstico, de propósito:
 * quando a conversa é sobre um corpo, a coisa mais útil que se pode fazer é
 * apontar o caminho e ajudar a chegar nele organizado — não desenvolver um
 * raciocínio bonito.
 *
 * Texto fixo do repositório: não passa por modelo, então não pode atravessar a
 * fronteira que acabou de ser atravessada duas vezes. Há teste cobrando isso.
 */

import type { AchadoDiagnostico } from "./deteccao-diagnostico";

export function instrucaoRegenerarClinica(achados: AchadoDiagnostico[]): string {
  const trechos = achados
    .map((a) => `"${a.trecho}"`)
    .slice(0, 3)
    .join(", ");
  return [
    `ATENÇÃO — sua resposta anterior atravessou a FRONTEIRA CLÍNICA e NÃO foi enviada.`,
    `O que a denunciou: ${trechos}.`,
    `Refaça a resposta inteira. NÃO conclua causa, NÃO diga se é grave ou leve, NÃO decida se precisa de atendimento, NÃO mande esperar, NÃO prescreva nem sugira começar/parar/aumentar/diminuir/trocar medicação ou dose, NÃO afirme que um sintoma é (ou não é) da neurodivergência, e NÃO minimize ("é fase", "isso passa", "é normal").`,
    `Cuidado com o seu viés: você tem uma explicação neurocomportamental pronta e convincente, e causas do CORPO não vêm com essa facilidade. Se o que ela trouxe pode ser do corpo, diga isso ANTES de qualquer leitura comportamental.`,
    `E não caia no oposto: "procure um profissional" e ponto é tão errado quanto. Reconheça a importância do que ela trouxe, oriente levar a quem pode avaliar, e CONTINUE ajudando no que é seu — reconstruir quando começou, se foi súbito ou gradual, o que mais mudou na mesma época, o que a escola e os terapeutas perceberam, e organizar isso pra consulta. Siga apoiando o dia a dia (comunicação, rotina, previsibilidade) sem substituir a investigação.`,
    `Sem alarmar e sem minimizar. Mantenha o seu tom de sempre e o formato do canal.`,
  ].join(" ");
}

/**
 * O piso. Só entra quando a regeneração também atravessou.
 *
 * Não menciona sintoma nenhum — não sabe qual é, e adivinhar seria justamente o
 * erro. Fala do MOVIMENTO: isso é para ser olhado por quem avalia, e eu te ajudo
 * a chegar lá organizada.
 */
export function respostaSeguraClinica(params: {
  nomeCuidador?: string | null;
  nomeMembro?: string | null;
}): string {
  const voc = params.nomeCuidador?.trim() ? `, ${params.nomeCuidador.trim()}` : "";
  const aPessoa = params.nomeMembro?.trim() ? params.nomeMembro.trim() : "ela";

  return [
    `Isso que você trouxe é importante${voc}, e eu não quero te dar um palpite sobre uma coisa que só quem examina consegue avaliar de verdade.`,
    ``,
    `O caminho aqui é levar isso pra quem acompanha ${aPessoa} — pediatra ou o profissional que estiver mais perto do caso. E se em algum momento parecer que precisa ser agora, emergência médica é o SAMU, 192.`,
    ``,
    `O que eu faço bem, e ajuda de verdade: reconstruir com você quando isso começou, se foi de um dia pro outro ou aos poucos, o que mais mudou na mesma época, e o que a escola ou os terapeutas perceberam. Isso vira um resumo curto pra você levar na consulta — e a consulta rende muito mais.`,
    ``,
    `Quer começar por aí?`,
  ].join("\n");
}
