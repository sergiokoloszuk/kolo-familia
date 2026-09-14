import type { NaoPromovido } from "./tipos";

/**
 * O QUE FICOU DE FORA DO RACIOCÍNIO DA AYLA — E POR QUÊ.
 *
 * ⚠️ ESTA LISTA É A PROVA DE QUE "PÓS INTEGRAL" NÃO VIROU "PÓS RESUMIDA".
 * "Integral" não significa que tudo vira contexto de conversa — significa que
 * nada saiu em silêncio. Cada linha aqui é uma decisão registrada, com motivo, e
 * `cobertura.test.ts` lê os DOIS documentos originais e exige que toda seção
 * esteja coberta por uma unidade ou por uma linha desta lista. Conteúdo novo nos
 * originais quebra o teste até alguém decidir para que lado ele vai.
 *
 * A maior parte das decisões aqui vem da CANÔNICA §4 ("o que preservar como
 * raciocínio, e o que é prosa"). Onde eu divergi dela, a linha diz isso.
 */
export const NAO_PROMOVIDO: readonly NaoPromovido[] = [
  // ─────────── A
  {
    fonte: "A",
    secao: "§2 · Série histórica de incidência (1975→2004)",
    o_que: "1 em 10.000 (1975) → 1 em 166 (2004), e o 1 em 31 atual do CDC",
    motivo:
      "A série histórica não tem fonte declarada nem data de apuração, e comparar prevalência entre décadas confunde mudança de critério diagnóstico com mudança de incidência. Só o dado atual do CDC se sustenta — e ele é argumento de acolhimento ('você não está sozinha'), não raciocínio clínico sobre a criança.",
    vive_em: "Core v11, quando couber acolher o isolamento da família",
  },
  {
    fonte: "A",
    secao: "§2 · Etiologia e genética (detalhe)",
    o_que: "Base genética e epigenética, heterogeneidade neurobiológica, alterações congênitas compensatórias",
    motivo:
      "Contextualiza, não muda o que a família faz amanhã. O que MUDA conduta — a retirada da culpa — foi promovido em A2.3.",
    vive_em: "A2.3 (a parte que muda conduta)",
  },
  {
    fonte: "A",
    secao: "§3 · Perguntas literais de investigação",
    o_que:
      "'Quando você entra no quarto, a criança desvia o foco do brinquedo para olhar seu rosto?' e as três equivalentes dos degraus B, C e D",
    motivo:
      "São boas perguntas e viram INTERROGATÓRIO se chegarem como lista pronta. A pós entrega o CAMPO a investigar (`investigar`); a redação é da Ayla, no tom dela e no fio da conversa. Entregar a pergunta literal é o caminho mais curto para o formulário que o §14 do protocolo proíbe.",
    vive_em: "o campo `investigar` das unidades A3.A–A3.D, e a voz do Core",
  },
  {
    fonte: "A",
    secao: "§3 · Práticas de intervenção (passo a passo)",
    o_que:
      "'Seguir a Liderança' detalhado, 'Modelo com Espera' (segurar o item junto ao rosto, esperar até 5 segundos), hierarquia de dicas visual→verbal→física, parar a brincadeira e aguardar",
    motivo:
      "É repertório executável — território das Boas Práticas, não da pós. Duplicar aqui criaria duas fontes para a mesma instrução, que divergiriam na primeira revisão. A pós fica com a DIREÇÃO ('sustentar a atenção compartilhada antes de cobrar palavra'); a BP entrega o passo a passo.",
    vive_em: "`boas_praticas` (381 linhas em produção) e o campo `direcao` das unidades",
  },
  {
    fonte: "A",
    secao: "§9 · Referências e recursos educacionais",
    o_que: "'Mãos Quietas', Baron-Cohen, Uta Frith, Temple Grandin, Atypical, Farol das Orcas",
    motivo:
      "Conteúdo de produto para a família, não raciocínio clínico sobre a criança. Tem valor real e lugar próprio — e recomendar livro e filme dentro de um turno de orientação desvia a conversa do caso.",
    vive_em: "nenhum lugar ainda — é oportunidade de produto, registrada aqui para não se perder",
  },
  {
    fonte: "A",
    secao: "§10 · Os 20 princípios de ouro (16 dos 20)",
    o_que: "Os princípios 1-10, 12-17 — repetições dos que já viraram unidade",
    motivo:
      "Não foram descartados: são a mesma afirmação que as unidades de §1, §3, §6 e §7 já carregam, escritas em forma de mandamento. Promover os 20 como unidades próprias duplicaria dezesseis vezes o que já está dito, e a recuperação passaria a devolver o mesmo raciocínio em duas embalagens. O mapa princípio→unidade está em `cobertura.test.ts`. Os quatro que acrescentavam algo (11, 18, 19, 20) viraram A10.11, A10.18 e A10.20.",
    vive_em: "A1.1–A1.5, A3.A–A3.D, A6.1, A6.2, A7.1–A7.6",
  },

  // ─────────── B
  {
    fonte: "B",
    secao: "Tema 1 · História do DSM-IV → DSM-5 (detalhe)",
    o_que: "Datas da unificação, remoção da Síndrome de Rett por etiologia definida, nomenclatura TGD-SOE",
    motivo:
      "⚠️ DIVERGI PARCIALMENTE DA CANÔNICA AQUI, e é deliberado. A canônica manda não promover 'história do DSM-IV→DSM-5'. Mas as famílias USAM os nomes antigos ('ele tem Asperger'), e não reconhecê-los faz a Ayla ler mal o relato. Promovi o MÍNIMO — o mapeamento dos nomes que a família diz (B1.2) — e deixei aqui datas, história e a remoção de Rett, que de fato não mudam conduta.",
    vive_em: "B1.2 (só o mapeamento de nomes)",
  },
  {
    fonte: "B",
    secao: "Tema 1 · Fatores de risco ambientais",
    o_que: "Idade parental avançada, prematuridade extrema, baixo peso, exposição fetal a ácido valproico",
    motivo:
      "Fator de risco populacional não diz nada sobre a criança que já está aqui, e dito a uma mãe vira retrospecto culpabilizante — exatamente o oposto de A2.3, que é a unidade que essa seção deveria produzir.",
    vive_em: "A2.3, pelo lado que interessa (a retirada da culpa)",
  },
  {
    fonte: "B",
    secao: "Tema 2 · Marcadores acústicos e prosódicos (F0)",
    o_que: "F0 acima de 500 Hz, variabilidade de entonação, duração de enunciado como preditor de prognóstico",
    motivo:
      "Medida de laboratório, inacessível por WhatsApp, e associada a PROGNÓSTICO — o tipo de afirmação que a Ayla não faz sobre uma criança específica. O traço audível ('voz robótica, cantada') já entra pela tríade da apraxia em B3.1.",
    vive_em: "B3.1, pelo sinal observável",
  },
  {
    fonte: "B",
    secao: "Tema 3 · Instrumentos de prontidão (KSPT, VMPAC)",
    o_que: "Testes padronizados de imitação orofacial e planejamento motor de fala",
    motivo:
      "Instrumento de aplicação profissional. Pode informar QUANDO sugerir avaliação — e é isso que B3.1 faz —, mas nomear o teste empurra a família a pedir um exame específico ao profissional, o que inverte a relação. §8 de A e a fronteira clínica de `diretrizes.ts` proíbem a aplicação.",
    vive_em: "B3.1, como 'sinalizar avaliação fonoaudiológica'",
  },
  {
    fonte: "B",
    secao: "Tema 4 · Integração Sensorial de Ayres (a abordagem)",
    o_que: "Trabalho tátil-vestibular-proprioceptivo em sala equipada com balanços, redes, lycras, túneis, skates",
    motivo: "É exatamente o que o §8.3 de A proíbe a Ayla de prescrever. Promovido como LIMITE, não como técnica.",
    vive_em: "A8.3 (o limite) e B4.1–B4.4 (o raciocínio de limiar, que é o que serve em casa)",
  },
  {
    fonte: "B",
    secao: "Tema 5 · Intervenção comportamental na alimentação (ABA/JABA)",
    o_que: "Reforço diferencial (DRA), extinção de fuga (manter a colher até haver aceitação), shaping",
    motivo:
      "Protocolo clínico de aplicação profissional — e 'manter a colher até que haja aceitação' orientado por WhatsApp a uma mãe exausta, sem supervisão, é risco concreto de coerção alimentar. §8 de A proíbe.",
    vive_em: "B5.2, pela via sensorial (tolerar, tocar, cheirar antes de provar)",
  },
  {
    fonte: "B",
    secao: "Tema 5 · Vineland e WHODAS (instrumentos)",
    o_que: "Escalas de comportamento adaptativo",
    motivo: "Instrumento profissional. O CONCEITO que eles medem — suporte definido pelo ambiente real — foi promovido.",
    vive_em: "B5.1",
  },
  {
    fonte: "B",
    secao: "Tema 7 · BAPQ como instrumento",
    o_que: "Questionário autoadministrado de fenótipo ampliado",
    motivo:
      "Aplicar rastreio no ADULTO desloca o cuidado da criança para a mãe, sem que ninguém tenha pedido, e num momento em que ela está vulnerável. O fenômeno foi promovido (B7.1) exatamente com a cautela de não virar avaliação dela.",
    vive_em: "B7.1, com cautela explícita",
  },
  {
    fonte: "B",
    secao: "Parte 2 · Instrumentos de rastreio de todas as faixas",
    o_que: "M-CHAT-R, CSBS DP, Griffiths, CARS-BR, Bateria MAC, Protocolo Perfil Sensorial de Dunn, ADI-R, AQ-10, escalas de humor e alexitimia",
    motivo:
      "Aplicação profissional, sem exceção. A Ayla aplicar ou pontuar qualquer um deles colide com o §8.1 de A: seria diagnóstico com outro nome. O que sobrevive é o FOCO DE AVALIAÇÃO de cada faixa — o que olhar —, promovido em BP2.1–BP2.5.",
    vive_em: "BP2.1–BP2.5, pelo foco de avaliação de cada faixa",
  },
  {
    fonte: "B",
    secao: "Parte 3 · Referências científicas e grounding",
    o_que: "Os 7 blocos de fontes (Fernandes, Lopes-Herrera, Ayres/Dunn, Joseph & Tager-Flusberg, FGV, CARS-BR, M-CHAT)",
    motivo:
      "Não é texto para o prompt: é a PROCEDÊNCIA. Foi distribuída campo a campo — cada unidade vinda de B carrega sua citação em `procedencia`, e é isso que permite auditar de onde veio uma afirmação sem carregar a bibliografia no contexto.",
    vive_em: "o campo `procedencia` de cada unidade de B",
  },
];
