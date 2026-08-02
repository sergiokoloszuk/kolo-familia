/**
 * RECUPERAÇÃO quando a fronteira do diagnóstico é atravessada.
 *
 * Duas peças, ambas neutras de canal, ambas usadas pelo WhatsApp e pela web:
 *
 *   1. `INSTRUCAO_REGENERAR` — o que dizer ao modelo pra ele refazer. Orientada
 *      pelo erro concreto, não um "tente de novo" genérico.
 *   2. `respostaSeguraDeDiagnostico()` — o piso, pra quando a segunda tentativa
 *      também atravessa.
 *
 * O PISO NÃO PODE SER UM ACOLHIMENTO VAZIO. O fallback que já existia no
 * WhatsApp ("Tô aqui com você 🌿 Me conta um pouquinho mais sobre isso?") é
 * adequado pra uma resposta barrada por meta-discurso — a mãe repete e segue.
 * Aqui ele seria péssimo: a pessoa acabou de perguntar se a filha tem autismo.
 * Devolver carinho e um pedido de "conta mais" faz duas coisas erradas de uma
 * vez — ignora a pergunta e sugere que contar mais levaria à resposta, que é
 * exatamente o que a fronteira proíbe.
 *
 * Então o piso é uma RESPOSTA DE VERDADE: reconhece a pergunta, é honesta sobre
 * o que não dá pra fazer e por quê (o tipo de avaliação, não a falta de
 * informação), oferece o próximo passo concreto e devolve a escolha. É texto
 * fixo do repositório — não passa por modelo, então não pode atravessar a
 * fronteira que acabou de ser atravessada duas vezes.
 *
 * Ele é o pior resultado possível deste caminho, não o resultado esperado: só
 * aparece quando o modelo falhou DUAS vezes na mesma pergunta.
 */

import type { AchadoDiagnostico } from "./deteccao-diagnostico";

/**
 * A instrução de refazer. Vai como nota interna (WhatsApp) ou bloco `<sistema>`
 * (web) — os dois canais já têm um mecanismo pra isso, nenhum precisou de um
 * novo.
 *
 * Diz o que fazer no lugar, não só o que evitar: "não conclua" sozinho produz
 * a recusa burocrática, que é a outra forma de falhar.
 */
export function instrucaoRegenerar(achados: AchadoDiagnostico[]): string {
  const trechos = achados
    .map((a) => `"${a.trecho}"`)
    .slice(0, 3)
    .join(", ");
  return [
    `ATENÇÃO — sua resposta anterior atravessou a FRONTEIRA DO DIAGNÓSTICO e NÃO foi enviada.`,
    `O que a denunciou: ${trechos}.`,
    `Refaça a resposta inteira. NÃO conclua, não estime probabilidade, não exclua, não gradue nível ou gravidade, não pese um diagnóstico contra outro, não raciocine sobre o encaixe desta criança numa hipótese, e não diga que um diagnóstico muda pouco.`,
    `E não caia no oposto: recusa seca ("não posso diagnosticar, procure um profissional") é tão errada quanto. NÃO diga que falta informação — o motivo não é a quantidade de informação, é o tipo de avaliação que a conclusão exige.`,
    `Continue ajudando de verdade no mesmo turno: reconheça a pergunta, seja honesta em UMA frase, devolva os sinais que a família já observou sem carimbar nenhum, explique no geral que aquilo aparece em perfis diferentes e tem outras explicações, diga que vale levar pra avaliação e que você organiza o que levar, e trabalhe a dificuldade concreta de hoje.`,
    `Mantenha o seu tom de sempre e o formato do canal.`,
  ].join(" ");
}

/**
 * O piso. Só entra quando a regeneração também atravessou.
 *
 * Personalizado com o que sempre se sabe (quem fala, de quem se fala) e nada
 * além disso: qualquer coisa a mais viria do perfil, e usar o perfil aqui é
 * justamente o movimento que produziu o problema.
 */
export function respostaSeguraDeDiagnostico(params: {
  nomeCuidador?: string | null;
  nomeMembro?: string | null;
}): string {
  const voc = params.nomeCuidador?.trim() ? `, ${params.nomeCuidador.trim()}` : "";
  const dela = params.nomeMembro?.trim() ? ` ${params.nomeMembro.trim()}` : "";
  const aPessoa = params.nomeMembro?.trim() ? params.nomeMembro.trim() : "ela";

  return [
    `Essa pergunta é das mais legítimas que existem${voc} — e eu queria muito poder te dar uma resposta fechada.`,
    `Mas essa conclusão não sai de conversa, por mais que eu conheça${dela}: ela depende de uma avaliação feita por um profissional, que observa de perto. Não é que falte você me contar mais — é o tipo de avaliação mesmo.`,
    ``,
    `O que eu consigo fazer, e ajuda de verdade:`,
    ``,
    `Organizar com você o que você já vem observando e o que ainda vale reparar até a consulta — e montar um resumo pra você levar, pra não depender de lembrar de tudo na hora.`,
    ``,
    `E, enquanto isso, trabalhar o que está pesando no dia a dia de vocês agora. Isso melhora sem depender de nome nenhum, e é onde a gente já pode ajudar ${aPessoa} hoje.`,
    ``,
    `Por onde você prefere começar?`,
  ].join("\n");
}
