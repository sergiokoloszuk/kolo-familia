/** Dados de demonstração relatados na conversa, não leitura de conta familiar. */
const isa = { nome: "Isabela", nascimento: "2007-12-25", genero: "feminino", sabe: {
  como_e: { texto: "Gosta de cinema, música, comida japonesa, poke, frutos do mar e sair com amigas. Quer começar a trabalhar e prestar vestibular no próximo ano." },
  sensorial: "Sensível a sons, luz forte e cheiros. Às vezes não quer ser tocada. Gosta de experimentar texturas diferentes.",
}, extras: {
  comunicacao: "Verbal e fluente, vocabulário ótimo e compreensão ótima.",
  socializacao: "Interage bem com os pares e gosta de sair com amigas. Também gosta de ficar sozinha no quarto.",
  foco: "Mantém atenção quando está engajada; às vezes se distrai. Não há episódios de hiperfoco registrados.",
  nutricional: "Gosta de comida japonesa, poke e frutos do mar. Os ingredientes que aceita não estão detalhados.",
  sono: "Dormia cerca de 7 horas; não há descrição de rotina ou ambiente de sono.",
  emocional: "Expressa emoções gritando, chorando e falando palavrões. Mudanças na rotina são relatadas como difíceis.",
} };
export const referenciasBase44 = [
  { id: "ref_alimentacao", tema: "nutricional", pessoa: isa, mensagem: "Ela come arroz, frango e batata. Se coloco feijão ou salada, manda tirar. Eu insisto porque tenho medo de ela nunca aprender a comer outras coisas." },
  { id: "ref_socializacao", tema: "socializacao", pessoa: isa, mensagem: "ela nao quer sair com as amigas, acha que nao sabe o que conversar, não se acha bonita." },
  { id: "ref_autonomia_8", tema: "autonomia", pessoa: { nome: "Filha", nascimento: "2018-01-10", genero: "feminino" }, mensagem: "minha filha de 8 anos não sabe arrumar quarto, escovar dente, tomar banho, amarrar sapato. e se falo fica brava, não quer aprender" },
  { id: "ref_comunicacao_4", tema: "comunicacao", pessoa: { nome: "Filha", nascimento: "2022-01-10", genero: "feminino", extras: { comunicacao: "A mãe descreve a filha como não verbal. Não há outros detalhes de expressão ou compreensão registrados." } }, mensagem: "minha filha é não verbal e tem 4 anos\ncomo posso ajudar ela a entender mais o contexto e explicar o que ela quer e entender o que eu peço" },
  { id: "ref_brincadeira_adulta", tema: "socializacao", pessoa: isa, mensagem: "Quero uma brincadeira rápida para fazer com a Isabela agora, usando o que você sabe sobre ela." },
  { id: "ref_introducao_foco", tema: "foco", pessoa: isa, mensagem: "Quero explorar Atenção e Concentração." },
];
