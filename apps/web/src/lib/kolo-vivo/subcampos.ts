/**
 * Sub-campos estruturados de um domínio do Kolo Vivo.
 *
 * Para não reescrever o backend (que guarda UM texto por domínio), os
 * sub-campos são serializados no mesmo texto, com rótulos:
 *
 *   Aceita bem: arroz, banana
 *   Rejeita: folhas, carne em pedaço
 *   Texturas & padrões: prefere seco/crocante
 *
 * Assim a IA passa a ver cada dimensão separada, o armazenamento, o contexto e
 * a auto-incorporação continuam iguais, e qualquer domínio pode ganhar campos
 * só declarando-os em DOMINIOS.
 */

export type SubCampo = {
  key: string;
  label: string;
  placeholder?: string;
  /** Quando presente, o campo vira um seletor (chips) em vez de texto livre.
   *  Ex.: Seletividade alimentar → ["Alta", "Média", "Baixa"]. */
  opcoes?: string[];
  /** Quando true, o campo é uma LISTA de itens (bullets). Guardado como
   *  "item1; item2; item3". Ex.: aceita, rejeita, texturas. */
  lista?: boolean;
  /** Campo CONDICIONAL: só aparece se outro campo (geralmente o seletor
   *  inicial) estiver com um dos valores. Ex.: perguntas de fala só se "Como
   *  se comunica" = "Fala frases"/"Fala palavras soltas". */
  mostrarSe?: { campo: string; valores: string[] };
};

/** Filtra os campos que devem aparecer dado o estado atual (condicionais). */
export function camposVisiveis(
  campos: SubCampo[],
  valores: Record<string, string>,
): SubCampo[] {
  return campos.filter((c) => {
    if (!c.mostrarSe) return true;
    const v = (valores[c.mostrarSe.campo] ?? "").trim();
    return c.mostrarSe.valores.includes(v);
  });
}

/** Itens de um campo-lista (guardado como "a; b; c" ou em linhas). */
export function splitItens(value: string): string[] {
  return (value ?? "")
    .split(/[;\n]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Junta itens em "a; b; c", aparando e removendo duplicados. */
export function joinItens(itens: string[]): string {
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const it of itens) {
    const t = (it ?? "").trim();
    if (!t) continue;
    const k = t.toLowerCase();
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(t);
  }
  return out.join("; ");
}

/**
 * Sub-campos por domínio do Kolo Vivo. Fonte ÚNICA — usada pelo card (UI), pelo
 * extrator de atualizações (IA) e pela gravação. Domínios sem entrada aqui
 * continuam como texto único.
 */
export const SUBCAMPOS_DOMINIO: Record<string, SubCampo[]> = {
  nutricional: [
    {
      key: "seletividade",
      label: "Seletividade alimentar",
      opcoes: ["Alta", "Média", "Baixa"],
      placeholder: "Alta = come poucos alimentos · Média = seletivo, mas aceita variedade · Baixa = come bem",
    },
    { key: "aceita", label: "Aceita bem / preferidos", lista: true, placeholder: "arroz, banana, pão…" },
    { key: "rejeita", label: "Rejeita ou recusa", lista: true, placeholder: "folhas, carne em pedaço…" },
    { key: "texturas_aceita", label: "Texturas que aceita", lista: true, placeholder: "crocante, cremoso…" },
    { key: "texturas_rejeita", label: "Texturas que rejeita", lista: true, placeholder: "pastoso, fibroso…" },
    {
      key: "dificuldades",
      label: "Dificuldades na alimentação",
      placeholder: "Ex: demora muito, distrai fácil, só come no prato dela",
    },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  sensorial: [
    {
      key: "perfil",
      label: "Perfil sensorial",
      opcoes: ["Hipersensível", "Hipossensível", "Misto"],
      placeholder:
        "Hiper = sente demais e evita · Hipo = sente de menos e busca estímulo · Misto = varia por canal",
    },
    { key: "sons", label: "Reação a sons", placeholder: "Ex: cobre os ouvidos com barulho alto; gosta de música baixa" },
    { key: "toques", label: "Reação a toques", placeholder: "Ex: não gosta de abraços; busca pressão profunda (apertado)" },
    { key: "texturas", label: "Texturas (roupas, objetos)", placeholder: "Ex: evita etiquetas; prefere roupas macias" },
    { key: "luz", label: "Luz", placeholder: "Ex: incomoda-se com luzes fortes" },
    { key: "cheiros", label: "Cheiros", placeholder: "Ex: sensível a perfumes" },
    { key: "movimento", label: "Movimento", placeholder: "Ex: precisa balançar; gosta de ventilador girando" },
    { key: "outras", label: "Outras observações sensoriais", placeholder: "Qualquer outra coisa que você percebe" },
  ],
  comunicacao: [
    // Começa pela forma — e o resto se adapta a ela.
    {
      key: "forma",
      label: "Como se comunica",
      opcoes: ["Fala frases", "Fala palavras soltas", "Não-verbal"],
    },
    {
      key: "mostra",
      label: "Como mostra o que quer",
      placeholder: "aponta, leva pela mão até o objeto, gestos, imagens/CAA, fala",
    },
    {
      key: "entende",
      label: "Como demonstra que entende",
      placeholder: "segue pedidos simples, reage ao nome, precisa de apoio visual, entende mais do que fala",
      mostrarSe: { campo: "forma", valores: ["Fala frases", "Fala palavras soltas"] },
    },
    // Tem alguma fala:
    {
      key: "vocabulario",
      label: "Vocabulário e fala",
      placeholder: "quantas palavras; combina frases; troca/omite letras; gagueira",
      mostrarSe: { campo: "forma", valores: ["Fala frases", "Fala palavras soltas"] },
    },
    {
      key: "ecolalia",
      label: "Ecolalia / repetições",
      placeholder: "repete falas, perguntas ou frases de desenho?",
      mostrarSe: { campo: "forma", valores: ["Fala frases", "Fala palavras soltas"] },
    },
    // Fala fluente:
    {
      key: "conversa",
      label: "Conversa e argumentação",
      placeholder: "mantém o vai-e-vem? resolve problema/negocia/argumenta falando? ou fala bem mas trava nisso? frustra quando não é entendida?",
      mostrarSe: { campo: "forma", valores: ["Fala frases"] },
    },
    // Não-verbal:
    {
      key: "contexto",
      label: "Entende o contexto",
      placeholder: "entende a situação / o que vai acontecer pela rotina e pistas, mesmo sem palavras?",
      mostrarSe: { campo: "forma", valores: ["Não-verbal"] },
    },
    {
      key: "le_labios",
      label: "Lê lábios / pistas visuais",
      placeholder: "presta atenção no rosto e na boca? precisa te ver pra entender?",
      mostrarSe: { campo: "forma", valores: ["Não-verbal"] },
    },
    {
      key: "iniciativa",
      label: "Mostra o que quer ou espera?",
      opcoes: ["Mostra o que quer", "Espera oferecerem", "Varia"],
      mostrarSe: { campo: "forma", valores: ["Não-verbal"] },
    },
    // Não-verbal (ou palavras soltas):
    {
      key: "contato",
      label: "Contato visual e gestos",
      placeholder: "olha quando é chamada? aponta pra mostrar? usa gestos?",
      mostrarSe: { campo: "forma", valores: ["Não-verbal", "Fala palavras soltas"] },
    },
    {
      key: "caa",
      label: "Comunicação alternativa (CAA)",
      placeholder: "usa pranchas, PECS, app de comunicação?",
      mostrarSe: { campo: "forma", valores: ["Não-verbal", "Fala palavras soltas"] },
    },
    {
      key: "outras",
      label: "Outras observações",
      placeholder: "o que ajuda (frases curtas, apoio visual, dar tempo) e qualquer outra coisa que você percebe",
    },
  ],
  socializacao: [
    {
      key: "disposicao",
      label: "Como é socializar pra ele(a)",
      opcoes: ["Busca e curte", "Curte em doses", "Custa / cansa", "Evita"],
    },
    {
      key: "interage",
      label: "Interage com outras pessoas (pares)",
      opcoes: ["Com facilidade", "Às vezes", "Raramente"],
    },
    {
      key: "com_quem",
      label: "Com quem flui melhor",
      opcoes: ["Adultos", "Pares (mesma idade)", "Mais novos", "Indiferente"],
    },
    {
      key: "divide",
      label: "Divide e espera a vez",
      opcoes: ["Sim", "Às vezes", "Custa"],
    },
    {
      key: "sozinho",
      label: "Sozinho ou acompanhado",
      placeholder: "prefere ficar só (por quanto tempo) ou busca companhia?",
    },
    {
      key: "iniciativa",
      label: "Iniciativa e reciprocidade",
      placeholder: "inicia ou espera/responde? interage junto ou fica lado a lado? mantém o vai-e-vem?",
    },
    {
      key: "vinculos",
      label: "Vínculos e conflitos",
      placeholder: "tem amizades/pessoas de referência? como lida com dividir, perder, conflito?",
    },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  emocional: [
    {
      key: "padrao",
      label: "Como costuma ser",
      opcoes: ["Estável na maioria do tempo", "Oscila", "Desregula com facilidade", "Crises intensas"],
    },
    {
      key: "gatilhos",
      label: "Gatilhos",
      lista: true,
      placeholder: "o que costuma disparar (barulho, fome, mudança de plano, transição, frustração, cansaço…)",
    },
    {
      key: "sinais",
      label: "Sinais de que vem vindo",
      lista: true,
      placeholder: "como você percebe antes / no começo (fica quieto, agita, tampa o ouvido, fica vermelho…)",
    },
    {
      key: "manifesta",
      label: "Como se manifesta",
      placeholder: "o que acontece (choro, grito, fugir, congelar, bater, autolesão…)",
    },
    {
      key: "ajuda",
      label: "O que ajuda a passar",
      lista: true,
      placeholder: "o que acalma/regula junto (lugar quieto, ficar perto em silêncio, pressão profunda, água, previsibilidade…)",
    },
    {
      key: "piora",
      label: "O que NÃO ajuda / piora",
      lista: true,
      placeholder: "o que intensifica (insistir, falar muito, plateia, toque leve…)",
    },
    {
      key: "depois",
      label: "Depois",
      placeholder: "como fica e o que precisa pra voltar (tempo, colo, ficar sozinho…)",
    },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  sono: [
    {
      key: "padrao",
      label: "Como costuma ser o sono",
      opcoes: ["Dorme bem", "Custa pegar no sono", "Acorda à noite", "Sono irregular"],
    },
    { key: "adormece", label: "Como adormece", placeholder: "o que ajuda: escuro, peso/abraço, música, companhia, rotina" },
    { key: "tempo_pegar", label: "Quanto tempo leva pra pegar no sono", placeholder: "Ex.: rápido; uns 40 min rolando na cama" },
    { key: "despertares", label: "Despertares", placeholder: "acorda à noite? volta a dormir sozinha ou precisa de ajuda?" },
    { key: "horarios", label: "Horários", placeholder: "que horas dorme e acorda; tem cochilo de dia?" },
    { key: "atrapalha", label: "O que atrapalha", lista: true, placeholder: "barulho, luz, dia agitado, tela antes de dormir…" },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  foco: [
    {
      key: "padrao",
      label: "Como é o foco",
      opcoes: ["Foca bem", "Foca no que gosta", "Dispersa fácil", "Hiperfoco intenso"],
    },
    { key: "hiperfocos", label: "O que prende a atenção dela (hiperfocos)", lista: true, placeholder: "temas/atividades em que a atenção fica total" },
    { key: "dispersa", label: "O que dispersa", lista: true, placeholder: "barulho, gente em volta, cansaço, atividade longa…" },
    { key: "sustenta", label: "Por quanto tempo sustenta", placeholder: "Ex.: poucos minutos; muito tempo no que ama" },
    { key: "ajuda", label: "O que ajuda a focar", lista: true, placeholder: "lugar calmo, pausas, um objeto na mão, instrução curta…" },
    { key: "transicao", label: "Sair de uma atividade", placeholder: "custa parar? o que ajuda na troca (avisar antes, timer)" },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  motor: [
    {
      key: "padrao",
      label: "Coordenação geral",
      opcoes: ["Tranquila", "Alguns desafios", "Bastante desafio"],
    },
    { key: "grosso", label: "Motor grosso", placeholder: "correr, pular, subir, equilíbrio, bola" },
    { key: "fino", label: "Motor fino (mãos)", placeholder: "talher, lápis/desenho, botões, tesoura, abrir embalagens" },
    { key: "imita_mov", label: "Imita movimentos / sequências", placeholder: "copia gestos? segue passos motores?" },
    { key: "ajuda", label: "O que ajuda", lista: true, placeholder: "apoio físico, mostrar devagar, materiais adaptados…" },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  rotina: [
    {
      key: "padrao",
      label: "Como lida com a rotina",
      opcoes: ["Flui bem", "Precisa de previsibilidade", "Mudar de plano é difícil", "Mudança gera crise"],
    },
    { key: "transicoes", label: "O que ajuda nas transições", lista: true, placeholder: "avisar antes, timer, quadro com imagens, contagem…" },
    { key: "ancoras", label: "Rotinas-âncora", lista: true, placeholder: "as que não podem faltar (a ordem do banho, a música de dormir…)" },
    { key: "avisar", label: "Como você avisa mudanças", placeholder: "Ex.: aviso 10 min antes; mostro no quadro" },
    { key: "sinais", label: "Sinais quando a rotina quebra", placeholder: "o que aparece quando muda de repente" },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  autonomia: [
    {
      key: "padrao",
      label: "Autonomia no dia a dia",
      opcoes: ["Faz bastante sozinha", "Faz com apoio", "Precisa de ajuda na maioria", "Depende em quase tudo"],
    },
    { key: "sozinha", label: "O que faz sozinha", lista: true, placeholder: "vestir, comer, higiene, guardar…" },
    { key: "com_apoio", label: "O que faz com apoio", lista: true, placeholder: "o quê e qual apoio (lembrete, começar junto, passo a passo)" },
    { key: "precisa_ajuda", label: "O que ainda precisa de ajuda", lista: true },
    { key: "aprendendo", label: "O que está aprendendo a fazer", lista: true, placeholder: "em construção agora" },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  aprendizado: [
    {
      key: "modo",
      label: "Como aprende melhor",
      opcoes: ["Vendo", "Ouvindo", "Fazendo (mão na massa)", "Repetindo"],
    },
    { key: "ajuda", label: "O que ajuda a aprender", lista: true, placeholder: "visual, passo a passo, exemplos, repetição…" },
    { key: "dificulta", label: "O que dificulta", lista: true, placeholder: "instrução longa, abstrato, pressa…" },
    { key: "interesses_puxam", label: "Interesses que puxam o aprender", placeholder: "usar o que ela ama pra ensinar (dinossauros, música…)" },
    { key: "ritmo", label: "Ritmo", placeholder: "rápido; ou precisa do tempo dela" },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  imitacao: [
    {
      key: "padrao",
      label: "Imita?",
      opcoes: ["Imita bastante", "Às vezes", "Pouco", "Quase não imita"],
    },
    { key: "o_que", label: "O que imita", lista: true, placeholder: "gestos, sons, fala, tarefas, expressões…" },
    { key: "faz_de_conta", label: "Faz de conta", placeholder: "brinca de imitar cenas (cozinhar, cuidar, super-herói)?" },
    { key: "aprende_imitando", label: "Aprende imitando?", placeholder: "pega coisas vendo os outros fazerem?" },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  tela_midia: [
    {
      key: "padrao",
      label: "Relação com telas",
      opcoes: ["Tranquila", "Curte muito", "Custa sair da tela", "Tela é gatilho"],
    },
    { key: "usa", label: "O que assiste / usa", lista: true, placeholder: "desenhos, jogos, vídeos — o quê de favorito" },
    { key: "desligar", label: "Como reage ao desligar", placeholder: "o que acontece na hora de sair da tela" },
    { key: "ajuda_sair", label: "O que ajuda na hora de sair", lista: true, placeholder: "avisar antes, combinar o que vem depois, timer…" },
    { key: "combinados", label: "Combinados de tempo", placeholder: "Ex.: 2 episódios; meia hora" },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  escola: [
    {
      key: "padrao",
      label: "Como é a escola hoje",
      opcoes: ["Vai bem", "Altos e baixos", "Difícil", "Não está na escola"],
    },
    { key: "funciona", label: "O que funciona", lista: true, placeholder: "adaptações e apoios que ajudam" },
    { key: "queixas", label: "Queixas / dificuldades", lista: true, placeholder: "o que pesa (barulho, transições, lição, social…)" },
    { key: "relacoes", label: "Relação com colegas e professores", placeholder: "como é o vínculo, com quem se dá bem" },
    { key: "combinados", label: "Combinados com a escola", placeholder: "o que vocês alinharam com a equipe" },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  saude_geral: [
    {
      key: "padrao",
      label: "Saúde geral",
      opcoes: ["Estável", "Alguns pontos de atenção", "Acompanhamento intenso"],
    },
    { key: "acompanhamentos", label: "Acompanhamentos", lista: true, placeholder: "terapias e especialidades — quem e com que frequência" },
    { key: "medicacoes", label: "Medicações", lista: true, placeholder: "se houver (nome e pra quê)" },
    { key: "alergias", label: "Alergias e restrições", lista: true },
    { key: "observar", label: "Pontos a observar", lista: true, placeholder: "dor, intestino, sono, alimentação, crises…" },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
  gostos: [
    { key: "filmes", label: "Filmes, desenhos e personagens favoritos", lista: true, placeholder: "o que ama assistir; personagens que adora" },
    { key: "arte", label: "Arte: materiais e o que gosta de fazer", lista: true, placeholder: "giz de cera, tinta, massinha, lápis; desenhar, pintar, colar, modelar" },
    { key: "brincadeiras", label: "Brincadeiras favoritas", lista: true, placeholder: "o que adora brincar, com o quê, sozinha ou junto" },
    { key: "hiperfocos", label: "Paixões do momento", lista: true, placeholder: "dinossauros, trens, princesas, números…" },
    { key: "nao_gosta", label: "O que NÃO gosta", lista: true, placeholder: "atividades, texturas de arte, brincadeiras, personagens que evita" },
    { key: "outras", label: "Outras observações", placeholder: "qualquer outra coisa que você percebe" },
  ],
};

/** Domínio tem sub-campos? Devolve a definição ou null. */
export function subcamposDe(campo: string): SubCampo[] | null {
  return SUBCAMPOS_DOMINIO[campo] ?? null;
}

export function serializarSubcampos(
  campos: SubCampo[],
  valores: Record<string, string>,
): string {
  return campos
    .map((c) => {
      const v = (valores[c.key] ?? "").trim();
      return v ? `${c.label}: ${v}` : "";
    })
    .filter(Boolean)
    .join("\n");
}

/**
 * Quebra o texto rotulado de volta nos sub-campos. Texto sem rótulo (legado,
 * digitado livre) cai no último campo, pra não se perder.
 */
export function parsearSubcampos(
  campos: SubCampo[],
  texto: string,
): Record<string, string> {
  const out: Record<string, string> = {};
  if (!texto?.trim()) return out;

  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const buf: Record<string, string[]> = {};
  const legado: string[] = [];
  let atual: string | null = null;

  for (const linha of linhas) {
    const match = campos.find((c) =>
      linha.toLowerCase().startsWith(`${c.label.toLowerCase()}:`),
    );
    if (match) {
      atual = match.key;
      const resto = linha.slice(match.label.length + 1).trim();
      buf[atual] = resto ? [resto] : [];
    } else if (atual) {
      (buf[atual] ??= []).push(linha);
    } else {
      legado.push(linha);
    }
  }

  for (const c of campos) {
    if (buf[c.key]) out[c.key] = buf[c.key].join("\n").trim();
  }

  const textoLegado = legado.join("\n").trim();
  if (textoLegado && campos.length > 0) {
    const ultimo = campos[campos.length - 1].key;
    out[ultimo] = [textoLegado, out[ultimo] ?? ""].filter(Boolean).join("\n").trim();
  }
  return out;
}
