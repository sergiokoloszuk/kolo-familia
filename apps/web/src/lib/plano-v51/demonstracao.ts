import type { ConteudoPlano, MembroPlano } from "./dominio";

/** Exclusivamente no painel interno. Sem histórico, conquistas ou semanas preenchidas. */
export const MEMBROS_FICTICIOS: MembroPlano[] = [
  { id: "demo-manu", nome: "Manu", cadastro: [] },
  { id: "demo-theo", nome: "Theo", cadastro: [] },
];

export function conteudoDemonstrativo(relato: string): ConteudoPlano {
  return {
    perguntas: [
      { id: "momento", texto: "Em que momento fica mais difícil?", opcoes: ["Parar o que estava fazendo", "Começar", "Continuar"] },
      { id: "apoio", texto: "O que você já experimentou nessa hora?", opcoes: ["Avisar antes", "Fazer junto", "Ainda não experimentei um apoio"] },
    ],
    olhares: [{
      id: "olhar-demo", titulo: "Talvez valha separar o começo do restante da tarefa",
      sobre: "crianca", origem: { tipo: "relato_hoje", frase: relato },
      blocos: [
        { titulo: "Uma possibilidade para observar", texto: "Ter dificuldade em começar e ter dificuldade em executar são situações diferentes. Este exemplo de laboratório não permite concluir qual delas está acontecendo." },
        { titulo: "O que ainda não sabemos", texto: "Precisamos entender em que momento o apoio faz diferença. Olhar para você ou sentar à mesa, por si só, não demonstra compreensão da tarefa." },
        { titulo: "Outro ângulo", texto: "Em vez de medir tudo pela tarefa inteira, pode ser útil observar o primeiro movimento: o que acontece quando o pedido fica claro e pequeno?" },
        { titulo: "Na prática", texto: "Escolham uma possibilidade que caiba no dia e observem a resposta. Uma tentativa traz informação; não é uma prova sobre a capacidade da criança ou sobre você." },
      ],
    }],
    objetivo: "Encontrar um começo possível, com o apoio que fizer sentido para vocês",
    estrategias: [
      { id: "demo-primeiro-passo", titulo: "Só o primeiro passo", porque: "Um começo pequeno permite observar qual apoio é necessário, sem assumir a causa da dificuldade.", como: ["Escolham uma pequena parte do que querem experimentar.", "Deixe claro qual é o primeiro passo e dê tempo para uma resposta.", "Observe o que acontece, sem transformar terminar tudo na meta desta tentativa."], minima: "Experimentar apenas um começo, na próxima oportunidade." },
      { id: "demo-juntos", titulo: "Um começo acompanhado", porque: "É uma alternativa para observar se fazer uma pequena parte junto muda a participação.", como: ["Combine uma pequena parte para fazer junto.", "Mostre ou explique apenas essa parte, sem exigir contato visual.", "Dê espaço para a criança indicar o que precisa."], minima: "Uma pequena parte juntos." },
    ],
    dizer: [
      { momento: "Para começar", frase: "Vamos olhar só para esta parte?", detalhe: "Uma proposta pequena, com tempo para responder." },
      { momento: "Se não funcionar", frase: "Vamos descobrir o que ficou difícil.", detalhe: "Sem afirmar o que a criança sentiu ou quis fazer." },
    ],
    evitar: [{ frase: "Você não faz porque não quer", porque: "Atribui uma intenção que ainda não conhecemos e não esclarece o apoio necessário." }],
    observar: ["O que aconteceu no primeiro passo", "Qual apoio foi usado", "O que coube na rotina de vocês"],
  };
}
