/**
 * O DNA DOS ESPECIALISTAS — princípios extraídos, não prompts copiados.
 *
 * ⚠️ DE ONDE ISTO VEIO, E POR QUE NÃO É INVENÇÃO MINHA. A tabela
 * `specialist_prompt_templates` tem 14 especialistas (13 ativos) com
 * `objective`, `tone`, `scope`, `limits`, `kolo_vivo_fields`,
 * `knowledge_tags` e `fallback_questions`. Lendo os 14, há DUAS GERAÇÕES:
 *
 *   · SETE REESCRITOS — `aprendizado`, `autonomia`, `foco`, `imitacao`,
 *     `motor`, `nutricional`, `socializacao`. O `objective` deles DECOMPÕE a
 *     habilidade em etapas nomeadas e manda localizar onde trava.
 *   · SETE ORIGINAIS — `comunicacao`, `emocional`, `rotina`, `sensorial`,
 *     `sono`, `meu_bem_estar`, `comportamento_e_limites`. O `objective` é do
 *     tipo "Apoiar a higiene de sono…": correto e genérico.
 *
 * Os princípios abaixo saem dos SETE REESCRITOS, porque é neles que o padrão
 * se repete. Cada um cita a evidência literal que o sustenta — a missão pediu
 * "se o código não sustentar, não atribuir aos especialistas".
 *
 * ⚠️ E ELE NUNCA CHEGOU AO WHATSAPP. `lib/ia/prompt.ts` monta
 * `buildIdentityBlock` (Objetivo/Tom/Escopo/Limites) e injeta no canal WEB.
 * O caminho experimental — que atende TODAS as famílias no WhatsApp desde
 * 17/08 — não injeta nada disso: `catalogo-skills.ts` lê da mesma tabela
 * apenas `name` e `routing_keywords`, para classificar. Ou seja, a
 * inteligência dos especialistas existe, está no banco, e alcança o canal
 * menor. Este módulo é a hipótese de que é exatamente isso que falta.
 *
 * ⚠️ NÃO É UM ESPECIALISTA NOVO E NÃO RESTAURA A ARQUITETURA ANTIGA. É uma
 * instrução única, transversal, que impõe a FORMA DE RACIOCINAR comum aos
 * sete — sem nome de persona, sem roteamento, sem 13 chamadas de modelo.
 */

/** Um princípio do DNA, com a evidência que o sustenta. */
export type PrincipioDoDna = {
  id: string;
  titulo: string;
  /** Especialistas em cuja definição o princípio aparece. */
  em: readonly string[];
  /** Trecho literal do banco que sustenta o princípio. */
  evidencia: string;
};

export const DNA: readonly PrincipioDoDna[] = [
  {
    id: "decompor",
    titulo: "Decompor a habilidade em etapas nomeadas, e localizar em qual delas trava",
    em: ["aprendizado", "autonomia", "foco", "motor", "nutricional", "socializacao"],
    evidencia:
      "socializacao: “Localizar a micro-habilidade social que está difícil — querer, entrar, permanecer, alternar turnos, aceitar a ideia do outro, lidar com o ‘não’, encerrar”. " +
      "nutricional: “a etapa atual da escada de aproximação — tolerar, aceitar no prato, tocar, cheirar, experimentar”. " +
      "motor: “estabilizar, segurar, controlar força, planejar o movimento, coordenar as duas mãos, sustentar”.",
  },
  {
    id: "partir_do_que_funciona",
    titulo: "Partir do que a criança JÁ faz, nunca do que falta",
    em: ["autonomia", "imitacao", "nutricional", "socializacao"],
    evidencia:
      "autonomia: “Parte do que a pessoa já faz, nunca do que falta”. " +
      "imitacao: “Achar onde a imitação JÁ acontece — objeto, som, música, vídeo, irmão — e construir a partir dali, começando por imitar a criança, não por ‘faz igual’”.",
  },
  {
    id: "um_passo",
    titulo: "Mover UM passo, a menor mudança testável — não um programa",
    em: ["autonomia", "foco", "nutricional", "socializacao"],
    evidencia:
      "nutricional: “mover UM passo. Quase nunca começa em ‘comer’”. " +
      "foco: “entregar a menor mudança testável”. " +
      "autonomia: “reduzindo uma camada por vez”. " +
      "socializacao: “trabalhar UMA por vez”.",
  },
  {
    id: "reducao_de_suporte",
    titulo: "Progresso é redução de suporte, não faz/não faz",
    em: ["autonomia", "aprendizado"],
    evidencia:
      "autonomia: “Progresso se mede por redução de suporte, não por faz/não faz”; “Não retira ajuda de uma vez”. " +
      "aprendizado: “com apoio suficiente e redução gradual”.",
  },
  {
    id: "etapa_nao_rotulo",
    titulo: "Nomear a etapa, não o rótulo — e descrever o que acontece, não o caráter",
    em: ["aprendizado", "foco", "socializacao"],
    evidencia:
      "aprendizado: “Nomeia a etapa, não o rótulo. Sem jargão pedagógico”. " +
      "foco: “Descreve o que acontece, não o caráter da criança”. " +
      "socializacao: “Ensina repertório, não jeito certo de ser”.",
  },
  {
    id: "diferencial_cruzado",
    titulo: "Distinguir de domínios vizinhos antes de escolher a conduta",
    em: ["motor", "foco", "nutricional"],
    evidencia:
      "motor: “Não trata toda dificuldade de escrita como coordenação — copiar bem e falhar no ditado é Aprendizado”. " +
      "foco: “Não trata movimento como desatenção”. " +
      "nutricional: separa textura, novidade, previsibilidade, marca, ambiente e permanência.",
  },
  {
    id: "brincadeira_com_objetivo",
    titulo: "Brincadeira com objetivo — nunca ficha de exercício nem avaliação",
    em: ["motor", "imitacao"],
    evidencia:
      "motor: “Brincadeira com objetivo, não ficha de exercício”. " +
      "imitacao: “Brincadeira, não avaliação. Menos fala quando a demonstração basta”.",
  },
  {
    id: "o_dado_nao_e_ma_vontade",
    titulo: "O que a criança consegue em outro contexto é DADO, não prova de má vontade",
    em: ["foco"],
    evidencia:
      "foco: “Atenção não é uniforme: sustentar no que gosta é dado, não prova de má vontade”.",
  },
  {
    id: "encaminhar_com_criterio",
    titulo: "Encaminhamento tem gatilho nomeado — não é a resposta padrão",
    em: ["nutricional", "motor", "imitacao"],
    evidencia:
      "nutricional: “Engasgo, ânsia, dor, vômito, perda de peso ou repertório em queda pedem avaliação profissional, não exposição”. " +
      "imitacao: “Não condiciona comunicação à capacidade de imitar. Ajuda física nunca é forçada”.",
  },
];

/**
 * A INSTRUÇÃO DO TURNO — o DNA como texto para o modelo.
 *
 * ⚠️ CURTA DE PROPÓSITO. O Core já tem 28 mil caracteres; um bloco longo aqui
 * competiria com ele e a competição é justamente o que faz regra perder dentro
 * de prompt. O que entra é só o que os sete reescritos têm em comum e o Core
 * NÃO diz: a decomposição da habilidade, o ponto de partida no que já funciona,
 * o passo único, e a proibição de entregar o óbvio.
 *
 * ⚠️ NÃO REPETE O QUE JÁ É PISO. Voz, acolhimento, fronteira clínica,
 * segurança, materiais seguros e concordância de gênero ficam com o Core e com
 * `VOZ_E_LIMITES` — duplicar aqui seria a segunda fonte que este repositório
 * paga caro para não ter.
 */
export const BLOCO_DNA = `# Como raciocinar antes de responder

Esta é a forma de pensar dos especialistas da Kolo. Ela não aparece na resposta
— ela decide o que a resposta vai conter.

1. QUAL É A HABILIDADE, E EM QUAL ETAPA ELA TRAVA. Toda queixa é sobre uma
   habilidade que tem degraus. "Não espera a vez" não é um problema: é querer,
   entrar, permanecer, alternar, aceitar a ideia do outro, lidar com o "não",
   encerrar — e um desses é o que está difícil AGORA. Nomeie a etapa, não o
   rótulo.

2. COMECE PELO QUE JÁ FUNCIONA. Procure no que você sabe desta criança onde a
   habilidade JÁ aparece — em outro contexto, com outra pessoa, com outro
   objeto, dentro do que ela ama. É dali que se constrói. O que ela consegue
   em um lugar e não em outro é DADO sobre a condição, nunca prova de má
   vontade.

3. UM PASSO, NÃO UM PROGRAMA. Entregue a menor mudança testável — uma coisa
   para fazer hoje. Progresso aqui se mede por REDUÇÃO DE SUPORTE, não por
   faz/não faz.

4. ANTES DE ESCOLHER A CONDUTA, DESCARTE O VIZINHO. Dificuldade de escrever
   pode ser coordenação ou pode ser a etapa da escrita — copiar bem e falhar no
   ditado são coisas diferentes. Movimento não é desatenção. Recusa de comida
   pode ser textura, novidade, previsibilidade, marca, ambiente ou permanência.
   Diga qual você está supondo, como hipótese.

5. SE FOR PROPOR ATIVIDADE: brincadeira com objetivo, nunca ficha de exercício.
   Ancorada no interesse real desta criança, no nível dela, com o que existe na
   casa. Diga em uma linha o que observar, e o que fazer se não funcionar.

6. NÃO ENTREGUE O ÓBVIO. Se a sua resposta é o que qualquer busca devolveria —
   "faça de minha vez/sua vez", "use rotina visual", "elogie o esforço" — ela
   ainda não usou nada do que você sabe desta criança. Volte ao passo 2.`;

/**
 * Os princípios que NÃO entraram no bloco, e por quê — para a próxima pessoa
 * não achar que foram esquecidos.
 *
 * `encaminhar_com_criterio` e a parte de limites de cada especialista ficam de
 * fora porque o Core v11 e a fronteira clínica de `diretrizes.ts` já são o
 * piso: repeti-los aqui criaria duas fontes para a mesma recusa. O princípio
 * segue valendo — só não é este bloco que o carrega.
 */
export const FORA_DO_BLOCO: readonly string[] = ["encaminhar_com_criterio"];
