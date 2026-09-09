import type { PerfilConsultavel, CampoPerfil } from "@/lib/kolo-vivo/consultar";

/**
 * A LACUNA QUE MUDA A CONDUTA — Gate B, 08/09/2026.
 *
 * ⚠️ O QUE ESTE ARQUIVO SUBSTITUI. O caminho vivo injetava
 * `<o_que_ainda_nao_sei>` com CINCO CAMPOS FIXOS de cadastro — nome do
 * responsável, data de nascimento, como a criança se comunica, interesses,
 * desafios atuais — independentemente do assunto do turno. O modelo recebia uma
 * lista de buracos de formulário e, ao lado, o Core §8 mandando não interrogar.
 * As duas competem, e a lista é mais concreta.
 *
 * ⚠️ CAMPO VAZIO NÃO É LACUNA. É a distinção inteira deste gate. Uma lacuna só
 * vira candidata quando pertence ao assunto de AGORA; e só vira pergunta quando
 * a resposta mudaria hipótese, estratégia, nível da intervenção ou
 * personalização. Se não muda, o campo pode continuar vazio — e a Ayla ajuda.
 *
 * ⚠️ ZERO OU UMA, NUNCA A LISTA. O prompt não recebe o que falta; recebe, no
 * máximo, **a** pergunta que vale a pena. É o mesmo princípio que fez
 * `barco = 0` funcionar no Gate A: o que não está no prompt não compete com a
 * vontade de ajudar.
 *
 * ⚠️ NÃO É UM QUARTO DONO. A inteligência de "o que sabemos e o que falta" é a
 * de `kolo-vivo/consultar.ts`, que já roda na web. Aqui só se ESCOLHE, sobre a
 * linha de perfil que o turno já carregou.
 */

/**
 * O QUE JÁ FOI RESPONDIDO — e por que não é uma lista nova.
 *
 * ⚠️ A PRIMEIRA FONTE JÁ FUNCIONA SOZINHA. `PerfilConsultavel.lacunasDe` só
 * devolve campo com `estado === "vazio"`. Assim que a resposta da família é
 * incorporada ao Perfil, o campo deixa de ser lacuna — sem nenhuma lista, sem
 * nenhum estado paralelo. Metade do problema já estava resolvida pelo dado.
 *
 * ⚠️ O QUE FALTAVA é a janela entre a família responder e a incorporação
 * acontecer. Nesse intervalo o fato JÁ ESTÁ DISPONÍVEL na conversa, e
 * perguntar de novo é o defeito que este gate existe para matar.
 *
 * ⚠️ "JÁ RESPONDIDO" NÃO É "A PERGUNTA FOI FEITA". É "o fato necessário já está
 * disponível". Por isso a chave é o CAMPO (`emocional.gatilhos`), não o texto da
 * pergunta: uma pergunta diferente atrás do mesmo fato conta como repetição.
 *
 * ⚠️ CANAL REUSADO, NÃO CRIADO. A lacuna escolhida viaja em
 * `ayla_messages.metadata` — o mesmo lugar onde a clarificação de criança já
 * guarda `pedido` e a proposta de rotina guarda `proposta`. Nenhuma tabela
 * nova, nenhum segundo estado. E como `ayla_messages` carrega
 * `membro_atipico_id`, o isolamento entre irmãos vem de graça: o que a Manu
 * respondeu nunca fecha a lacuna do Mario.
 */
/**
 * O QUE A RESPOSTA DA FAMÍLIA FEZ COM A LACUNA.
 *
 * ⚠️ "VEIO UMA MENSAGEM DEPOIS" NÃO É RESPOSTA. Fechar a lacuna só porque a
 * família falou de novo transformaria "não sei" em fato e mudança de assunto em
 * conhecimento. As duas coisas que este gate mais precisa evitar.
 *
 * ⚠️ E O SILÊNCIO TAMBÉM NÃO FECHA. Uma pergunta ignorada não pode silenciar o
 * assunto para sempre — a lacuna continua aberta e pode voltar quando o assunto
 * voltar.
 */
export type TipoDeResposta =
  /** O fato ficou disponível. Fecha. */
  | "suficiente"
  /** Deu parte do fato ("às vezes", "mais ou menos"). Fecha: repetir a mesma
   *  pergunta depois de uma resposta parcial é a repetição que mata a conversa. */
  | "parcial"
  /** "Não, isso não acontece mais." Fecha E manda no presente. */
  | "correcao"
  /** "Não sei." NÃO fecha — mas também não se insiste no mesmo turno. */
  | "nao_sabe"
  /** Mudou de assunto. NÃO fecha. */
  | "outro_assunto"
  /** "sim", "ok", um emoji. NÃO fecha: não responde "qual é o gatilho?". */
  | "nao_resolve";

const NAO_SABE = /^\s*(n[ãa]o sei|nem sei|sei l[áa]|n[ãa]o fa[çc]o ideia|boa pergunta)\b/i;
const PARCIAL = /\b([àa]s vezes|mais ou menos|depende|acho que|talvez|nem sempre|de vez em quando)\b/i;
const CORRECAO =
  /\b(n[ãa]o (acontece|[ée]) mais|isso (n[ãa]o|nunca) (acontece|foi)|mudou|agora (ele|ela) j[áa]|parou de|n[ãa]o [ée] (mais )?(isso|por causa))\b/i;
const SO_CONFIRMA = /^\s*(sim|s|ok(ay)?|isso|certo|uhum|aham|blz|beleza|t[áa]|obrigad[ao])[\s.!💛🌿]*$/i;

/** ⚠️ O TEXTO É LIDO, NUNCA GUARDADO. Nada disto entra em rastro nem em prompt. */
export function classificarResposta(texto: string | null | undefined): TipoDeResposta {
  const t = (texto ?? "").trim();
  if (!t) return "nao_resolve";
  // A correção vence tudo: ela é informação sobre o presente, mesmo curta.
  if (CORRECAO.test(t)) return "correcao";
  if (NAO_SABE.test(t)) return "nao_sabe";
  if (SO_CONFIRMA.test(t)) return "nao_resolve";
  if (PARCIAL.test(t)) return "parcial";
  // ⚠️ O PISO DE TAMANHO É GROSSEIRO DE PROPÓSITO. Distinguir "respondeu o que
  // eu perguntei" de "falou outra coisa" com precisão exigiria um modelo, e o
  // custo de errar para MENOS é só perguntar de novo depois; errar para MAIS é
  // inventar que se sabe. Uma frase de conteúdo real quase sempre passa de 12
  // caracteres; "sim" e "ok" já saíram acima.
  return t.length >= 12 ? "suficiente" : "nao_resolve";
}

/** O que o turno anterior perguntou e o que a família fez com isso. */
export type Fala = {
  direcao: string;
  texto?: string | null;
  metadata?: Record<string, unknown> | null;
  membro_atipico_id?: string | null;
};

export type LacunasResolvidas = {
  /** Chaves `dominio.campo` que saem de candidatas. */
  fechadas: Set<string>;
  /** Chaves que a família corrigiu — o presente manda. */
  corrigidas: Set<string>;
  /** Para o rastro: o que aconteceu com cada pergunta feita. */
  detalhe: Array<{ chave: string; resposta: TipoDeResposta }>;
};

export function jaRespondidas(falas: ReadonlyArray<Fala>, membroId: string): LacunasResolvidas {
  const fechadas = new Set<string>();
  const corrigidas = new Set<string>();
  const detalhe: LacunasResolvidas["detalhe"] = [];

  for (let i = 0; i < falas.length; i++) {
    const f = falas[i];
    if (f.direcao !== "outbound") continue;
    // ⚠️ ESCOPO POR CRIANÇA, NA ORIGEM. `ayla_messages` carrega
    // `membro_atipico_id`, então o isolamento entre irmãos não precisa de
    // mecanismo novo: a resposta sobre a Manu nunca fecha a lacuna do Mario.
    if ((f.membro_atipico_id ?? membroId) !== membroId) continue;
    const chave = (f.metadata as { lacuna?: unknown } | null)?.lacuna;
    if (typeof chave !== "string" || !chave.includes(".")) continue;

    // A PRIMEIRA fala da família depois da pergunta é a que responde. As
    // seguintes já são outro turno, com outra pergunta.
    const resposta = falas.slice(i + 1).find((x) => x.direcao === "inbound");
    if (!resposta) continue;
    const tipo = classificarResposta(resposta.texto);
    detalhe.push({ chave, resposta: tipo });
    if (tipo === "suficiente" || tipo === "parcial" || tipo === "correcao") fechadas.add(chave);
    if (tipo === "correcao") corrigidas.add(chave);
  }
  return { fechadas, corrigidas, detalhe };
}

/**
 * O que a decisão devolve — e `null` é um desfecho legítimo, não uma falha.
 *
 * ⚠️ ESTE OBJETO É O RASTRO. Ele carrega o suficiente para reconstruir POR QUE
 * a Ayla perguntou (ou não) sem guardar uma palavra do que a família escreveu:
 * chaves de campo, motivos e contagens. Se um dia ela repetir uma pergunta,
 * queremos saber qual campo foi considerado ainda aberto e por quê.
 */
export type DecisaoDeLacuna = {
  /** `null` = NO ASK. Campo vazio pode continuar vazio. */
  escolhida: { dominio: string; campo: string; label: string } | null;
  /** Por que ela mudaria a conduta — para o rastro, nunca para o prompt. */
  motivo: string | null;
  /** Quantas eram pertinentes ao tema antes do corte. */
  candidatas: number;
  /** Domínios consultados neste turno. */
  dominios: string[];
  /** As candidatas, em ordem, como `dominio.campo`. */
  candidatasChaves: string[];
  /** O que saiu da disputa, e por quê. */
  descartadas: Array<{ chave: string; motivo: string }>;
  /** O que já estava respondido quando este turno começou. */
  jaRespondidas: string[];
  /** Campos que a família corrigiu — o presente vence o histórico. */
  corrigidas: string[];
  /** ASK ou NO_ASK, explícito. */
  decisao: "ASK" | "NO_ASK";
  /**
   * COMO os domínios foram escolhidos — PEND-184, 09/09/2026.
   *
   * `tema` é o caminho normal. `fallback_sem_catalogo` é o turno em que o
   * catálogo de skills não carregou: o decisor não pôde dizer o tema, e em vez
   * de emudecer (o defeito da PEND-184) este gate olha os domínios que o
   * PERFIL já conhece. `nenhum` é quando não houve nem uma coisa nem outra.
   *
   * Precisa estar no rastro porque um ASK por fallback e um ASK por tema têm
   * confiabilidades diferentes, e quem auditar depois não pode ter que adivinhar
   * qual dos dois aconteceu.
   */
  origemDosDominios: "tema" | "fallback_sem_catalogo" | "nenhum";
};

/**
 * OS DOMÍNIOS DE CADA TEMA — e a razão de a lista ser curta.
 *
 * Uma lacuna de sono não muda a orientação sobre alimentação. Limitar o
 * candidato ao assunto de agora é o que impede a Ayla de puxar um campo vazio
 * qualquer só porque ele existe.
 *
 * ⚠️ REUSO: as chaves são as MESMAS de `VIZINHOS_DA_SKILL` em
 * `experimental-contexto.ts` e de `ROTULO_DOMINIO`. Um vocabulário só.
 */
const DOMINIOS_DO_TEMA: Record<string, readonly string[]> = {
  sono: ["sono", "rotina"],
  nutricional: ["nutricional", "sensorial"],
  alimentacao: ["nutricional", "sensorial"],
  comunicacao: ["comunicacao", "socializacao"],
  socializacao: ["socializacao", "comunicacao"],
  emocional: ["emocional", "sensorial", "comunicacao"],
  sensorial: ["sensorial", "emocional"],
  rotina: ["rotina", "transicoes", "sono"],
  transicoes: ["rotina", "emocional"],
  escola: ["escola", "socializacao", "emocional"],
  autonomia: ["autonomia", "motor"],
  // ⚠️ `sensorial` entra aqui POR CAUSA DA PÓS §7: dispersão em ambiente
  // público pede o sensorial ANTES do foco. Sem estar na lista, o campo nunca
  // seria candidato e a regra de ordem não teria o que ordenar.
  foco: ["foco", "sensorial", "rotina"],
  motor: ["motor", "sensorial"],
  aprendizado: ["aprendizado", "foco"],
};

/**
 * CAMPOS QUE MUDAM A CONDUTA, por domínio.
 *
 * ⚠️ ESTA LISTA É O TESTE DECISIONAL, ESCRITO. Cada entrada existe porque
 * respostas diferentes levam a estratégias diferentes — e é isso que separa
 * "campo do formulário" de "pergunta que vale um turno da família".
 *
 * O que NÃO está aqui é deliberado: data de nascimento, nome do responsável e
 * "interesses" quase nunca mudam a conduta do turno. Eles podem faltar, e a
 * Ayla orienta do mesmo jeito.
 */
const CAMPOS_DECISIVOS: Record<string, readonly string[]> = {
  // A ORDEM DENTRO DE CADA LINHA É A PRIORIDADE: o que muda mais vem primeiro.
  // "gatilhos" muda a estratégia inteira; "padrão" muda o nível da intervenção.
  emocional: ["gatilhos", "padrao", "sinais", "ajuda"],
  sono: ["padrao", "adormece", "despertares", "atrapalha"],
  nutricional: ["seletividade", "texturas_rejeita", "dificuldades"],
  // A escada pré-verbal inteira (pós §3) precisa ser candidata para poder ser
  // ordenada: `contato` e `iniciativa` são os degraus de baixo, e `vocabulario`
  // o de cima. Quem decide a ordem é `pesoDaPos`, não esta linha.
  comunicacao: ["forma", "mostra", "entende", "contato", "iniciativa", "vocabulario"],
  socializacao: ["disposicao", "interage", "com_quem"],
  sensorial: ["perfil", "sons", "toques", "movimento"],
  rotina: ["padrao", "transicoes", "avisar"],
  escola: ["queixas", "funciona", "padrao"],
  autonomia: ["padrao", "precisa_ajuda"],
  foco: ["padrao", "dispersa", "sustenta"],
  motor: ["padrao", "grosso", "fino"],
  aprendizado: ["modo", "dificulta"],
};

/**
 * AS REGRAS DE ORDENAÇÃO VINDAS DA PÓS — critério, nunca conteúdo.
 *
 * ⚠️ PROVENIÊNCIA: `docs/ENCAIXE-POS-NEURODESENVOLVIMENTO.md` §2, extraído de
 * `material-pos-v1-ORIGINAL.md` §3 e §7. O que entra aqui é a ORDEM de
 * investigação; nenhuma pergunta literal, nenhuma intervenção, nenhum texto da
 * pós chega ao prompt. O contexto do turno não cresce um caractere.
 *
 * ⚠️ POR QUE ISSO NÃO É UM QUESTIONÁRIO. Estas regras não acrescentam perguntas
 * — elas mudam qual das lacunas JÁ candidatas vem primeiro. Se não houver
 * lacuna candidata, continuam sem efeito, e NO ASK segue válido.
 */
type RegraDeOrdem = {
  id: string;
  /** De onde a regra veio, para quem ler o código depois. */
  origem: string;
  /** Quando ela se aplica ao relato de agora. */
  gatilho: RegExp;
  /** Temas em que faz sentido — fora deles, não interfere. */
  temas: readonly string[];
  /** O que passa para a frente da fila, na forma `dominio.campo`. */
  prioriza: readonly string[];
};

const ORDEM_DA_POS: readonly RegraDeOrdem[] = [
  {
    id: "sensorial_antes_de_foco",
    // "Um sistema nervoso central sob estresse físico é incapaz de manter a
    // atenção voluntária sustentada." — pós §7
    origem: "pos §7 · dispersão em ambiente público investiga o sensorial primeiro",
    gatilho:
      /\b(escola|festa|shopping|mercado|supermercado|rua|p[úu]blico|barulh\w*|lugar cheio|muita gente)\b/i,
    temas: ["foco", "emocional"],
    prioriza: ["sensorial.perfil", "sensorial.sons", "sensorial.luz"],
  },
  {
    id: "pre_verbal_antes_de_vocabulario",
    // "A compreensão do contexto visual e de rotina é diferente do
    // processamento semântico da linguagem." — pós §7
    origem: "pos §7 · atraso de fala com 'entende tudo' investiga marcos pré-verbais",
    gatilho: /\bentende (tudo|bem)\b|\bcompreende tudo\b|\bfaz tudo que (eu )?(mando|pe[çc]o)\b/i,
    temas: ["comunicacao"],
    prioriza: ["comunicacao.contato", "comunicacao.mostra", "comunicacao.entende"],
  },
];

/**
 * A ESCADA DOS PRÉ-REQUISITOS — pós §3.
 *
 * Fala funcional exige troca de turnos, que exige gestos, que exige imitação,
 * que exige atenção compartilhada, que exige atenção social. **A lacuna que
 * diferencia a estratégia é o degrau mais baixo ainda desconhecido**, não o mais
 * alto: perguntar vocabulário a quem não olha para o rosto é perguntar o degrau
 * errado.
 *
 * ⚠️ NÃO É CHECKLIST. A escada só reordena o que já era candidato. Se o degrau
 * de baixo já é conhecido, ele nem aparece — e se nada mais falta, é NO ASK.
 */
const ESCADA_COMUNICACAO: readonly string[] = [
  "comunicacao.contato", // atenção social
  "comunicacao.mostra", // atenção compartilhada / apontar
  "comunicacao.iniciativa", // troca de turnos
  "comunicacao.forma", // como se comunica hoje
  "comunicacao.entende", // compreensão
  "comunicacao.vocabulario", // o degrau mais alto
];

/** Posição na fila: menor vem primeiro. `Infinity` = não priorizado. */
function pesoDaPos(chave: string, relato: string, temas: readonly string[]): number {
  for (const regra of ORDEM_DA_POS) {
    if (!regra.temas.some((t) => temas.includes(t))) continue;
    if (!regra.gatilho.test(relato)) continue;
    const i = regra.prioriza.indexOf(chave);
    if (i >= 0) return i; // 0,1,2 — antes de tudo
  }
  // ⚠️ A ESCADA SÓ VALE QUANDO O ASSUNTO É COMUNICAÇÃO — a bancada pegou isto.
  // Sem esta guarda, `comunicacao.contato` vencia `emocional.gatilhos` num turno
  // sobre birra, porque a escada dava peso a QUALQUER campo dela. Um
  // pré-requisito de fala não é mais decisivo que o gatilho da crise quando a
  // mãe está falando da crise.
  if (temas.includes("comunicacao")) {
    const degrau = ESCADA_COMUNICACAO.indexOf(chave);
    if (degrau >= 0) return 100 + degrau; // a escada ordena entre si
  }
  return Number.POSITIVE_INFINITY;
}

/**
 * ESCOLHE ZERO OU UMA LACUNA.
 *
 * ⚠️ NA DÚVIDA, NO ASK. Uma pergunta desnecessária custa o turno da família e
 * contraria o §8 do Prompt Mestre; um campo vazio não custa nada. O viés é
 * deliberadamente conservador: só pergunta o que está na lista decisiva, no
 * domínio do assunto de agora.
 */
export function escolherLacunaDecisiva(params: {
  perfil: PerfilConsultavel | null;
  /** As skills/temas que o decisor do turno identificou. */
  temas: readonly string[];
  /**
   * O relato de agora. Só é lido pelas regras de ORDEM da pós — nunca vira
   * conteúdo, nunca vai ao prompt.
   */
  relato?: string;
  /**
   * Chaves `dominio.campo` cuja informação JÁ está suficientemente disponível.
   * Não é "a pergunta já foi feita": é "o fato já é sabido". Ver `jaRespondidas`.
   */
  jaRespondido?: ReadonlySet<string>;
  /** O que a conversa recente já resolveu — ver `jaRespondidas`. */
  resolvidas?: LacunasResolvidas;
  /**
   * O catálogo de skills estava disponível? — PEND-184.
   *
   * ⚠️ QUANDO `false`, `temas` VAZIO NÃO É INFORMAÇÃO. É ausência de entrada:
   * o bloco `<catalogo_de_skills>` não foi ao prompt do decisor e o modelo
   * devolveu `[]` obedecendo ao contrato. Tratar isso como "nenhum tema" fez o
   * Gate B ficar mudo no primeiro turno humano, em 09/09/2026.
   *
   * O default é `true` para que todo chamador que não sabe distinguir mantenha
   * exatamente o comportamento anterior.
   */
  catalogoDisponivel?: boolean;
}): DecisaoDeLacuna {
  const resolvidas = params.resolvidas ?? { fechadas: new Set<string>(), corrigidas: new Set<string>(), detalhe: [] };
  const base = {
    escolhida: null,
    motivo: null,
    candidatas: 0,
    dominios: [] as string[],
    candidatasChaves: [] as string[],
    descartadas: [] as Array<{ chave: string; motivo: string }>,
    jaRespondidas: [...resolvidas.fechadas],
    corrigidas: [...resolvidas.corrigidas],
    decisao: "NO_ASK" as const,
    origemDosDominios: "nenhum" as DecisaoDeLacuna["origemDosDominios"],
  };
  if (!params.perfil) return { ...base, descartadas: [{ chave: "*", motivo: "perfil indisponível" }] };

  // Sem tema identificado não há como saber o que muda a conduta — e perguntar
  // "por perguntar" é exatamente o que este gate existe para acabar.
  const porTema = [...new Set(params.temas.flatMap((t) => DOMINIOS_DO_TEMA[t] ?? []))];

  /**
   * A DEGRADAÇÃO CONSERVADORA — PEND-184, 09/09/2026.
   *
   * ⚠️ SÓ QUANDO A ENTRADA FALTOU, NUNCA QUANDO ELA VEIO VAZIA. Se o catálogo
   * carregou e o modelo não escolheu skill nenhuma, isso É uma decisão: a
   * conversa não era sobre um domínio do acervo, e o gate continua calado. O
   * fallback existe só para o caso em que o decisor não teve como responder.
   *
   * ⚠️ E ELE OLHA O QUE O PERFIL JÁ CONHECE, não a lista inteira de domínios.
   * Abrir todos os domínios transformaria uma falha de leitura em varredura de
   * cadastro — o oposto do gate. Aqui, um domínio só entra se a família já
   * contou ALGUMA coisa sobre ele: é sinal de que aquele assunto é vivo para
   * esta criança, e é o mesmo princípio de pertinência que `desafiosAtuais` usa
   * do outro lado. Tudo o mais continua valendo — no máximo uma escolhida, só
   * campo aberto, correção vence histórico, escopo por criança.
   */
  const perfil = params.perfil;
  const dominiosDoPerfil = () =>
    Object.keys(CAMPOS_DECISIVOS).filter((d) => {
      const decisivos = CAMPOS_DECISIVOS[d] ?? [];
      // "Vivo" = a família já contou alguma coisa decisiva deste domínio
      // (`sabemos` cobre inclusive a resposta negativa) E ainda sobra pelo menos
      // um campo decisivo aberto. Sem a segunda metade, um domínio completo
      // entraria só para ser descartado logo abaixo.
      const contou = decisivos.some((campo) => perfil.sabemos(d, campo));
      const falta = perfil.lacunasDe(d).some((c) => decisivos.includes(c.key));
      return contou && falta;
    });

  const catalogoIndisponivel = params.catalogoDisponivel === false;
  const dominios = porTema.length
    ? porTema
    : catalogoIndisponivel
      ? dominiosDoPerfil()
      : [];
  const origemDosDominios: DecisaoDeLacuna["origemDosDominios"] = porTema.length
    ? "tema"
    : dominios.length
      ? "fallback_sem_catalogo"
      : "nenhum";

  if (!dominios.length) {
    return {
      ...base,
      descartadas: [
        {
          chave: "*",
          motivo: catalogoIndisponivel
            ? "catálogo indisponível e o perfil não tem domínio vivo"
            : "tema não identificado",
        },
      ],
    };
  }

  const jaRespondido = new Set([...(params.jaRespondido ?? []), ...resolvidas.fechadas]);
  const candidatas: Array<{ dominio: string; campo: CampoPerfil }> = [];
  const descartadas: Array<{ chave: string; motivo: string }> = [];

  for (const dominio of dominios) {
    const decisivos = CAMPOS_DECISIVOS[dominio];
    if (!decisivos) continue;
    for (const campo of params.perfil.lacunasDe(dominio)) {
      const chave = `${dominio}.${campo.key}`;
      if (!decisivos.includes(campo.key)) {
        descartadas.push({ chave, motivo: "não muda a conduta" });
        continue;
      }
      // ⚠️ A GARANTIA ESTRUTURAL: o campo já respondido não vira candidato. Não
      // é o modelo se comportando bem — é ele não receber a opção.
      if (jaRespondido.has(chave)) {
        descartadas.push({ chave, motivo: "já respondido nesta conversa" });
        continue;
      }
      candidatas.push({ dominio, campo });
    }
  }

  if (!candidatas.length) {
    return { ...base, dominios, descartadas, origemDosDominios };
  }

  // ⚠️ A ORDEM TEM TRÊS CAMADAS, e nenhuma delas é `[0]` de um array qualquer —
  // esse erro custou o Sudoku no Gate A.
  //   1. as regras da pós, quando o relato as aciona (mecanismo antes do rótulo);
  //   2. a escada de pré-requisitos (degrau mais baixo desconhecido primeiro);
  //   3. a ordem declarada em `DOMINIOS_DO_TEMA` × `CAMPOS_DECISIVOS`.
  const relato = params.relato ?? "";
  const chaveDe = (c: { dominio: string; campo: CampoPerfil }) => `${c.dominio}.${c.campo.key}`;
  const ordemDeclarada = (c: { dominio: string; campo: CampoPerfil }) => {
    const d = dominios.indexOf(c.dominio);
    const f = (CAMPOS_DECISIVOS[c.dominio] ?? []).indexOf(c.campo.key);
    return d * 100 + (f < 0 ? 99 : f);
  };
  const ordenadas = [...candidatas].sort((a, b) => {
    const pa = pesoDaPos(chaveDe(a), relato, params.temas);
    const pb = pesoDaPos(chaveDe(b), relato, params.temas);
    if (pa !== pb) return pa - pb;
    return ordemDeclarada(a) - ordemDeclarada(b);
  });
  const alvo = ordenadas[0];
  for (const c of ordenadas.slice(1)) {
    descartadas.push({ chave: chaveDe(c), motivo: "uma pergunta por turno" });
  }
  return {
    ...base,
    escolhida: {
      dominio: alvo.dominio,
      campo: alvo.campo.key,
      label: alvo.campo.label,
    },
    motivo: motivoDaEscolha(chaveDe(alvo), relato, params.temas, params.temas[0] ?? alvo.dominio),
    candidatas: candidatas.length,
    dominios,
    candidatasChaves: ordenadas.map(chaveDe),
    descartadas,
    decisao: "ASK",
    origemDosDominios,
  };
}

/** Por que ESTA lacuna, e não outra — para o rastro, nunca para o prompt. */
function motivoDaEscolha(
  chave: string,
  relato: string,
  temas: readonly string[],
  tema: string,
): string {
  for (const regra of ORDEM_DA_POS) {
    if (!regra.temas.some((t) => temas.includes(t))) continue;
    if (!regra.gatilho.test(relato)) continue;
    if (regra.prioriza.includes(chave)) return `${chave} — ${regra.origem}`;
  }
  const degrau = ESCADA_COMUNICACAO.indexOf(chave);
  if (degrau >= 0) {
    return `${chave} — degrau ${degrau + 1} da escada pré-verbal (pos §3); o mais baixo ainda desconhecido`;
  }
  return `${chave} muda a estratégia para ${tema}`;
}

/**
 * A AYLA PERGUNTOU DE FATO? — e por que isto é uma função e não um `if`.
 *
 * ⚠️ ESCOLHER UMA LACUNA NÃO É PERGUNTAR. O decisor diz qual pergunta valeria;
 * quem decide perguntar é o modelo, e o Core §8 manda ele ajudar sem perguntar
 * sempre que já der. Gravar `metadata.lacuna` sem pergunta faria o turno
 * seguinte acreditar que aquele campo foi investigado — e a resposta da mãe a
 * outra coisa fecharia uma lacuna que ninguém abriu.
 *
 * ⚠️ O TEXTO EXAMINADO É **SÓ A FALA CONVERSACIONAL**, antes de qualquer ponte.
 * MEDI o caminho vivo em 08/09/2026: a ponte do Plano é enviada como MENSAGEM
 * SEPARADA (`enviarEPersistir` com `texto: nudge`), não concatenada — então
 * `exp.texto` já é a fala pura. No Legacy é diferente (`textoCompleto =
 * ...\n\n${nudge}`), e é justamente por isso que esta função recebe o texto por
 * parâmetro em vez de ir buscá-lo: quem chama é responsável por passar a fala,
 * nunca o pacote com CTA, ponte ou convite colados.
 *
 * ⚠️ A DETECÇÃO É GROSSEIRA DE PROPÓSITO. Errar para MENOS custa perguntar de
 * novo depois; errar para MAIS inventa conhecimento. Mesmo critério de
 * `classificarResposta`.
 */
export function deveGravarLacuna(
  decisao: DecisaoDeLacuna | null,
  falaDaAyla: string,
): string | null {
  if (!decisao?.escolhida) return null;
  if (!/\?/.test(falaDaAyla ?? "")) return null;
  return `${decisao.escolhida.dominio}.${decisao.escolhida.campo}`;
}

/**
 * O BLOCO QUE VAI AO PROMPT — uma linha, ou nada.
 *
 * ⚠️ NO ASK NÃO PRODUZ TEXTO. Nem "não há lacunas", nem "você já sabe tudo":
 * silêncio. Um cabeçalho seguido de nada ensina o modelo a preencher
 * formulário, e é a lição de `resumoDoDominio` neste mesmo repositório.
 *
 * ⚠️ E A LACUNA NÃO É ORDEM DE PERGUNTAR. O Core §8 continua mandando ajudar no
 * mesmo turno; esta linha diz QUAL pergunta vale, não que perguntar é
 * obrigatório.
 */
export function blocoDaLacuna(d: DecisaoDeLacuna): string {
  if (!d.escolhida) return "";
  return `<lacuna_decisiva>Se ainda faltar UMA coisa para orientar melhor, é esta: **${d.escolhida.label}**. Só pergunte se a resposta mudaria mesmo o que você vai sugerir — e, se perguntar, entregue uma orientação útil no MESMO turno. Nunca pergunte mais de uma coisa.</lacuna_decisiva>`;
}
