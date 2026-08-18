import { pronomesPara, type Genero } from "./pronomes";
import type { SupabaseClient } from "@supabase/supabase-js";
import { idadeAnos } from "@/lib/idade";

/**
 * O QUE A AYLA EXPERIMENTAL SABE DA CRIANÇA — 15/08/2026, Fase 1.
 *
 * ⚠️ POR QUE ESTE ARQUIVO EXISTE. Até aqui o braço experimental mandava ao
 * modelo o nome, a idade e `membros_atipicos.perfil`. E `perfil` NÃO é prosa:
 * VI NO CÓDIGO que ele vem de `perfilPrimario()`, ou seja, um token do conjunto
 * {TEA, TDAH, Dislexia, AHSD, EmInvestigacao, Outro}. A Ayla recebia
 * "O que já sabemos: TEA" e conversava no escuro.
 *
 * O conhecimento real da criança já existe, em `perfil_vivo_membro`. PROVEI em
 * produção: a verbalidade da Manu ("Não monta frases ainda; comunicação verbal
 * limitada a palavras soltas") está em `desafios_regulacao.texto`; a
 * sensibilidade dela ("cobre os ouvidos com barulhos altos") está em
 * `sensorial.texto`; os interesses estão em `como_e.interesses`.
 *
 * ⚠️ NÃO É PARA CARREGAR O PERFIL INTEIRO. São 26 domínios; mandar todos em
 * todo turno é o erro que o núcleo antigo cometeu e que esta frente existe para
 * não repetir. Aqui entra o RETRATO — quem é a criança —, com teto de tamanho.
 * Domínio específico entra por assunto, não por existir.
 */

/** Teto do bloco de retrato. Acima disto, corta pela ordem de prioridade. */
export const TETO_CONTEXTO_BASE = 1200;

export type LinhaPerfilVivo = {
  essencial?: unknown;
  como_e?: unknown;
  corpo_rotina?: unknown;
  desafios_regulacao?: unknown;
  sensorial?: unknown;
  categorias_extras?: Record<string, unknown> | null;
};

/**
 * DADO PREENCHIDO NÃO É DADO ÚTIL.
 *
 * ⚠️ CASO REAL, conta do Sérgio: `corpo_rotina = "btbrtbtbtb"`. Mandar isso ao
 * modelo é pior que não mandar nada — ele tenta dar sentido ao ruído.
 *
 * O filtro é DELIBERADAMENTE CONSERVADOR e sem IA: só descarta o que não tem
 * como ser informação. Na dúvida, preserva — descartar dado legítimo de uma
 * família é um dano maior que deixar passar uma linha estranha.
 */
export function pareceInformacao(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const t = v.trim();
  // ⚠️ PISO DE 3, e não de 4: "TEA" é informação legítima e tem três letras.
  // O teste pegou isto — o piso mais alto era conservador na direção errada.
  if (t.length < 3) return false;
  // Sem nenhuma vogal em 4+ caracteres: teclado batido, não palavra.
  if (!/[aeiouáéíóúâêôãõà]/i.test(t)) return false;
  // Uma letra só repetida, ou duas alternando: "aaaa", "btbtbtbt".
  if (/^(.)\1+$/.test(t.replace(/\s/g, ""))) return false;
  if (/^(..)\1{2,}$/.test(t.replace(/\s/g, ""))) return false;
  const placeholders = ["teste", "test", "xxx", "asd", "n/a", "na", "-", "...", "sem"];
  if (placeholders.includes(t.toLowerCase())) return false;
  return true;
}

/** O `{ texto }` de um campo do Perfil Vivo, quando ele diz alguma coisa. */
function textoDoCampo(v: unknown): string | null {
  if (typeof v === "string") return pareceInformacao(v) ? v.trim() : null;
  const o = (v ?? {}) as { texto?: unknown };
  return pareceInformacao(o.texto) ? String(o.texto).trim() : null;
}

/** Primeira frase de um campo — o retrato não precisa do parágrafo inteiro. */
function primeiraFrase(t: string, max = 180): string {
  const corte = t.split(/\n|(?<=\.)\s/)[0]?.trim() ?? t;
  return corte.length > max ? corte.slice(0, max - 1).trimEnd() + "…" : corte;
}

/**
 * INTERESSES ATUAIS — união das duas fontes, menos o que a família descartou.
 *
 * ⚠️ AS DUAS FONTES EXISTEM E DIVERGEM. PROVEI em produção: a Manu tem
 * `como_e.interesses = ["Cozinha","Dinossauro",…]` e
 * `categorias_extras.preferencias.temas = ["contos e princesas"]`. Escolher uma
 * e ignorar a outra perderia interesse verdadeiro; por isso a leitura é UNIÃO.
 *
 * ⚠️ NADA É APAGADO. `evitar` só tira da lista ATUAL — o histórico continua no
 * banco, e é dele que a evolução ("não gosta mais disso") vai ser lida um dia.
 */
export function interessesAtuais(pv: LinhaPerfilVivo | null): string[] {
  if (!pv) return [];
  const extras = (pv.categorias_extras ?? {}) as Record<string, unknown>;
  const pref = (extras.preferencias ?? {}) as { temas?: unknown; evitar?: unknown };
  const lista = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean) : [];

  const comoE = (pv.como_e ?? {}) as { interesses?: unknown };
  const uniao = [...lista(comoE.interesses), ...lista(pref.temas)];
  const evitar = new Set(lista(pref.evitar).map((s) => s.toLowerCase()));

  const vistos = new Set<string>();
  const atuais: string[] = [];
  for (const i of uniao) {
    const k = i.toLowerCase();
    if (evitar.has(k) || vistos.has(k)) continue;
    vistos.add(k);
    atuais.push(i);
  }
  return atuais;
}

/**
 * OS DESAFIOS ATUAIS — os domínios com texto, mais recentes primeiro.
 *
 * O onboarding distribui cada desafio no domínio correspondente
 * (`categorias_extras.sono`, `.nutricional`…), cada um com `atualizado_em`.
 * Aqui pegamos os três mais recentes: é o retrato, não o histórico.
 */
const ROTULO_DOMINIO: Record<string, string> = {
  sensorial: "sensorial",
  nutricional: "alimentação",
  comunicacao: "comunicação",
  emocional: "emoções",
  foco: "foco",
  sono: "sono",
  socializacao: "socialização",
  motor: "motor",
  rotina: "rotina",
  autonomia: "autonomia",
  aprendizado: "aprendizado",
  escola: "escola",
  transicoes: "transições",
  conflitos: "conflitos",
  saude_geral: "saúde",
};

/**
 * MUDANÇAS RECENTES — o que o perfil deixou de dizer, e quando (PEND-090 · Peça 2).
 *
 * ⚠️ O CONTEXTO SÓ MOSTRAVA O ESTADO, NUNCA A TRAJETÓRIA. O modelo recebia
 * "Como se comunica: Fala palavras soltas" e não tinha como saber que até a
 * semana passada ali dizia "Não-verbal". Sem isso, ou a Ayla trata a mudança
 * como se sempre tivesse sido assim (e a família não se sente vista numa
 * conquista real), ou ela desconfia de um relato novo sem ter em que se apoiar.
 *
 * O Core v9 §16 já manda não repetir pergunta "salvo se houver conflito ou
 * motivo para acreditar que mudou". O motivo passa a estar ESCRITO aqui, em vez
 * de precisar ser inferido de dois blocos de texto.
 *
 * ⚠️ SÓ O QUE É RECENTE. Marco de três meses atrás é história do app
 * (`/evolucao`), não assunto da conversa de hoje. A janela é curta de
 * propósito: o valor está em reconhecer a mudança perto de quando ela
 * aconteceu, e um histórico inteiro no prompt vira ruído.
 */
const JANELA_MARCOS_DIAS = 30;

export function marcosRecentes(
  pv: LinhaPerfilVivo | null,
  agora: Date = new Date(),
  limite = 3,
): string[] {
  if (!pv) return [];
  const extras = (pv.categorias_extras ?? {}) as Record<string, unknown>;
  const bruto = Array.isArray(extras.marcos) ? (extras.marcos as unknown[]) : [];
  const corte = new Date(agora.getTime() - JANELA_MARCOS_DIAS * 86400_000);
  const out: Array<{ data: string; texto: string }> = [];
  for (const m of bruto) {
    const o = (m ?? {}) as { data?: unknown; texto?: unknown };
    const data = String(o.data ?? "").trim();
    const texto = String(o.texto ?? "").trim();
    // Sem data não dá para dizer que é recente — e "mudou recentemente" sem
    // data é exatamente o tipo de afirmação que não se pode fazer.
    if (!data || !texto) continue;
    const d = new Date(`${data.slice(0, 10)}T00:00:00Z`);
    if (Number.isNaN(d.getTime()) || d < corte) continue;
    out.push({ data: data.slice(0, 10), texto });
  }
  // Mais recentes primeiro — a lista já costuma vir assim, mas não depender
  // disso é barato.
  out.sort((a, b) => b.data.localeCompare(a.data));
  return out.slice(0, limite).map((m) => `${m.data} — ${m.texto}`);
}

/**
 * ⚠️ O `limite = 3` SAIU EM 18/08/2026, E O CASO QUE O DERRUBOU FOI ESTE.
 *
 * Rosangela perguntou "quais alimentos ele gosta?". O perfil tinha, salvo desde
 * 07/08: *"Aceita bem / preferidos: banana; maçã; melancia; mamão"*. A Ayla
 * respondeu **"até agora não tenho registrado quais alimentos o Matheo gosta"**.
 *
 * PROVEI POR EXECUÇÃO reconstruindo o bloco com o perfil real dela: a palavra
 * "banana" NÃO estava no prompt. Alimentação era o domínio mais ANTIGO (07/08)
 * entre cinco preenchidos, ficou em 5º na ordenação por recência e foi cortada
 * aqui — antes de o prompt existir. O modelo respondeu com fidelidade ao que
 * recebeu; o dado nunca chegou.
 *
 * MEDI na base: 31 de 77 perfis (40%) tinham mais de 3 domínios preenchidos,
 * somando **131 domínios descartados**. Em alimentação especificamente: 28
 * perfis tinham o campo, e **16 (57%) estavam fora do contexto**.
 *
 * E MEDI o custo de não cortar: mesmo sem limite algum, o pior perfil da base
 * produz 761 caracteres de seção, contra um teto de 1200 para o bloco inteiro.
 * O corte descartava dado que cabia — e o teto, que já existia, nunca chegava a
 * ser exercitado.
 *
 * O teto de segurança que sobra aqui NÃO é critério de seleção: são 20 para que
 * um `categorias_extras` corrompido não vire uma lista infinita. Quem decide o
 * que não cabe é o teto de caracteres, em `montarContextoBase`, item a item.
 *
 * ⚠️ A ORDEM CONTINUA SENDO POR RECÊNCIA, e isso continua sendo um problema
 * aberto: recência não é prioridade. Ver PEND-089 — o corte foi corrigido, a
 * ordenação não.
 */
export function desafiosAtuais(pv: LinhaPerfilVivo | null, limite = 20): string[] {
  if (!pv) return [];
  const extras = (pv.categorias_extras ?? {}) as Record<string, unknown>;
  const itens: Array<{ rotulo: string; texto: string; quando: string }> = [];
  for (const [chave, valor] of Object.entries(extras)) {
    const rotulo = ROTULO_DOMINIO[chave];
    if (!rotulo) continue;
    const texto = textoDoCampo(valor);
    if (!texto) continue;
    const quando = String((valor as { atualizado_em?: unknown })?.atualizado_em ?? "");
    itens.push({ rotulo, texto: primeiraFrase(texto, 140), quando });
  }
  itens.sort((a, b) => b.quando.localeCompare(a.quando));
  return itens.slice(0, limite).map((i) => `${i.rotulo}: ${i.texto}`);
}

/**
 * OS DESAFIOS QUE A FAMÍLIA MARCOU NO CADASTRO — e por que precisam de função
 * própria.
 *
 * ⚠️ REGRESSÃO CORRIGIDA EM 15/08/2026. O onboarding grava a lista em
 * `categorias_extras.desafios_onboarding` E cria uma chave por domínio com
 * `{ texto: "" }`. `desafiosAtuais()` descartava as duas coisas: a lista não
 * está em `ROTULO_DOMINIO`, e as chaves estão vazias. Resultado provado: com o
 * cadastro completo, o modelo recebia "desafios atuais" como LACUNA — e o Core
 * manda perguntar o que falta. A mãe marcava três desafios, a boas-vindas os
 * citava de volta, e a Ayla perguntava de novo no turno seguinte.
 *
 * MEDI em produção (15/08/2026, 124 perfis): 100 têm a lista, e das chaves de
 * domínio que ela aponta, **370 estão vazias contra 122 preenchidas**. Ou seja:
 * três de cada quatro desafios declarados eram invisíveis.
 *
 * ⚠️ SEPARADO DE `desafiosAtuais` DE PROPÓSITO. São coisas diferentes: aqui é
 * "o que ela marcou numa lista", lá é "o que ela contou, com data". Fundir os
 * dois faria um chip de cadastro parecer relato — e o prompt trata os dois de
 * formas distintas, como tem que ser.
 */
export function desafiosDoOnboarding(pv: LinhaPerfilVivo | null): string[] {
  if (!pv) return [];
  const extras = (pv.categorias_extras ?? {}) as Record<string, unknown>;
  const bruto = extras.desafios_onboarding;
  if (!Array.isArray(bruto)) return [];
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const item of bruto) {
    const chave = String(item ?? "").trim();
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    // Sem rótulo conhecido, vai a própria chave: perder o desafio por causa de
    // um domínio novo seria repetir exatamente o defeito que isto corrige.
    out.push(ROTULO_DOMINIO[chave] ?? chave);
  }
  return out;
}

/**
 * COMO A CRIANÇA SE COMUNICA — de `categorias_extras.comunicacao`, com o campo
 * legado como resgate.
 *
 * ⚠️ O EXPERIMENTAL LIA O LUGAR ERRADO. Buscava só o top-level
 * `desafios_regulacao`; o schema híbrido guarda comunicação em
 * `categorias_extras.comunicacao` (a mesma lista que `lib/ia/context.ts` usa).
 * O efeito provado era pior que uma ausência: com o domínio preenchido, o mesmo
 * prompt dizia "comunicação: fala frases de 3 palavras" E "não sei como a
 * criança se comunica".
 *
 * ⚠️ O FALLBACK NÃO É PRECAUÇÃO — É MEDIDO. Em produção (124 perfis): 40 têm o
 * campo novo, 3 têm o legado, e **1 tem SÓ o legado**. Uma família perderia a
 * informação sem esta linha.
 */
/**
 * DOS DOMÍNIOS MARCADOS NO CADASTRO, OS QUE DE FATO NÃO TÊM DETALHE.
 *
 * ⚠️ ESTA FUNÇÃO EXISTE POR CAUSA DE UM DEFEITO MEU. A primeira versão da
 * correção dos desafios (`662a857`) decidia "sem detalhe" subtraindo os três
 * que passaram pelo teto de `desafiosAtuais`. Com oito domínios preenchidos, a
 * `escola` ficava de fora do teto e o prompt anunciava "escola: ainda sem
 * detalhe" — com o texto dela sentado no banco. PROVEI POR EXECUÇÃO na bancada
 * de 15/08/2026.
 *
 * A pergunta certa é sobre o DADO, não sobre a vaga no bloco.
 *
 * ⚠️ `comunicacao` tem tratamento próprio porque ela é renderizada por outra
 * linha (`Comunicação hoje:`) e pode vir do campo legado `desafios_regulacao`.
 * Sem esta checagem, o mesmo prompt afirmaria e negaria a mesma coisa — que é
 * exatamente o defeito que a leitura de comunicação já tinha antes.
 */
export function desafiosSemDetalhe(pv: LinhaPerfilVivo | null): string[] {
  if (!pv) return [];
  const extras = (pv.categorias_extras ?? {}) as Record<string, unknown>;
  const temComunicacao = Boolean(comunicacaoAtual(pv));
  const marcados = Array.isArray(extras.desafios_onboarding) ? extras.desafios_onboarding : [];
  const vistos = new Set<string>();
  const out: string[] = [];
  for (const item of marcados) {
    const chave = String(item ?? "").trim();
    if (!chave || vistos.has(chave)) continue;
    vistos.add(chave);
    if (chave === "comunicacao" && temComunicacao) continue;
    if (textoDoCampo(extras[chave])) continue;
    out.push(ROTULO_DOMINIO[chave] ?? chave);
  }
  return out;
}

export function comunicacaoAtual(pv: LinhaPerfilVivo | null): string {
  if (!pv) return "";
  const extras = (pv.categorias_extras ?? {}) as Record<string, unknown>;
  return textoDoCampo(extras.comunicacao) || textoDoCampo(pv.desafios_regulacao) || "";
}

/**
 * OS RÓTULOS DO QUE SABEMOS — **sem uma linha do conteúdo** (Onda 1, pós-Trial).
 *
 * ⚠️ POR QUE RÓTULO E NÃO TEXTO. No modo pós-Trial a Ayla precisa poder dizer com
 * verdade "eu já tenho informações sobre o sono e a alimentação do João" — que é
 * o valor da continuidade — sem ter em mãos o material para montar a estratégia,
 * que é justamente o que o teste encerrado não paga mais.
 *
 * Evidência suficiente para vender; informação insuficiente para orientar. O
 * conteúdo NÃO entra neste modo, nem para o grupo com perfil rico.
 *
 * ⚠️ MESMA FONTE DO RETRATO NORMAL. Reusa `ROTULO_DOMINIO` e `textoDoCampo` de
 * propósito: um segundo mapa de domínios divergiria do primeiro no primeiro
 * domínio novo, e a Ayla passaria a anunciar um assunto que o retrato não
 * conhece.
 */
export function rotulosConhecidos(pv: LinhaPerfilVivo | null): string[] {
  if (!pv) return [];
  const extras = (pv.categorias_extras ?? {}) as Record<string, unknown>;
  const out: string[] = [];
  for (const [chave, valor] of Object.entries(extras)) {
    const rotulo = ROTULO_DOMINIO[chave];
    if (rotulo && textoDoCampo(valor)) out.push(rotulo);
  }
  // Comunicação tem linha própria no retrato (e resgate do campo legado), então
  // ela é conferida à parte — senão o perfil que só tem o legado sumiria daqui.
  if (comunicacaoAtual(pv) && !out.includes("comunicação")) out.push("comunicação");
  if (textoDoCampo(pv.sensorial)) out.push("sensibilidades");
  if (textoDoCampo(pv.como_e)) out.push("como ela é");
  if (interessesAtuais(pv).length) out.push("interesses");
  return [...new Set(out)];
}

/**
 * QUANTOS FATOS DE PERFIL EXISTEM — o que decide o NÍVEL DE LINGUAGEM pós-Trial.
 *
 * ⚠️ POR QUE NÃO CONTAR MENSAGENS. MEDI em 18/08/2026, nas 135 crianças ativas:
 * a régua `mensagensDaFamilia >= 5` erra em 15 casos (11%), e erra nas DUAS
 * direções — 8 crianças têm 5+ mensagens e no máximo 2 fatos (uma tem 23
 * mensagens e 1 fato), e 7 têm menos de 5 mensagens e 5+ fatos (uma tem ZERO
 * mensagens e 13 fatos, todos vindos do onboarding).
 *
 * Conversar muito não é contar; e não conversar não é não ter contado. Quem
 * decide se a Ayla pode alegar continuidade é a evidência, não o volume.
 *
 * ⚠️ CUSTO ZERO. É uma contagem sobre o Perfil Vivo que o turno JÁ carregou —
 * nenhuma consulta nova, nenhuma chamada de modelo.
 */
export function fatosDisponiveis(pv: LinhaPerfilVivo | null): number {
  return rotulosConhecidos(pv).length;
}

export type ContextoBase = {
  bloco: string;
  /** O que o onboarding NÃO respondeu — para a Ayla perguntar só isso. */
  lacunas: string[];
};

/**
 * O RETRATO, montado — e a lista do que ainda não sabemos.
 *
 * ⚠️ `<o_que_ainda_nao_sei>` existe porque a AUSÊNCIA de um bloco não é um
 * sinal legível para o modelo: sem ele, ou a Ayla refaz o cadastro inteiro
 * (ignorando o que já sabe) ou não pergunta nada. Dizer explicitamente o que
 * falta é o que faz a boas-vindas se adaptar SEM encher o Core de condicionais.
 */
export function montarContextoBase(params: {
  nomeResponsavel: string | null;
  membro: {
    nome: string | null;
    data_nascimento: string | null;
    diagnosticos_formais: unknown;
    /** Opcional de propósito: quem não tem o dado continua chamando igual. */
    genero?: string | null;
  } | null;
  perfilVivo: LinhaPerfilVivo | null;
}): ContextoBase {
  const { nomeResponsavel, membro, perfilVivo: pv } = params;
  const linhas: string[] = [];
  const lacunas: string[] = [];

  if (nomeResponsavel) linhas.push(`Responsável: ${nomeResponsavel}`);
  else lacunas.push("nome do responsável");

  if (!membro) return { bloco: "", lacunas };

  const idade = idadeAnos(membro.data_nascimento);
  linhas.push(`Criança: ${membro.nome ?? "(sem nome)"}${idade != null ? `, ${idade} anos` : ""}`);
  if (idade == null) lacunas.push("data de nascimento");

  // ── O GÊNERO REGISTRADO CHEGA AO MODELO (17/08/2026) ─────────────────────
  //
  // ⚠️ ERA O ÚNICO DOS CINCO DADOS QUE O SISTEMA TINHA E NÃO ENTREGAVA. A
  // coluna `membros_atipicos.genero` já vinha no `select` e já era usada por
  // `resolverFoco` (é ela que faz "minha filha" apontar para a criança certa),
  // mas nenhuma linha deste bloco a mencionava. Quando a Ayla escrevia "ele" ou
  // "ela", estava adivinhando — quase sempre pelo nome, que é exatamente o
  // palpite que acabou de ser removido das proativas (`endsWith("a")`).
  //
  // ⚠️ SÓ QUANDO É DADO REGISTRADO. `pronomesPara` é a fonte única do projeto e
  // já responde isso em `generoDefinido`: masculino e feminino são escolhas da
  // família; `neutro`, `null` e qualquer valor estranho caem no mesmo lugar e
  // NÃO produzem linha nenhuma. Ausência de gênero não vira gênero inferido, e
  // não vira lacuna: não se pergunta o gênero da criança só para escrever
  // bonito — o Core já sabe falar de forma neutra quando não sabe.
  //
  // Entra como PRONOME, não como rótulo ("Gênero: feminino"), porque o que o
  // modelo precisa é da concordância, não de um campo de cadastro para
  // comentar.
  const p = pronomesPara(membro.genero as Genero);
  if (p.generoDefinido) linhas.push(`Como falar dela: ${p.sujeito}/${p.possessivo}`);

  // ⚠️ `length > 0`, e não a verdade do array: `[]` é TRUTHY em JS, e era isso
  // que fazia o prompt receber "Diagnóstico informado pela família: " vazio.
  // PROVEI: as três famílias de QA têm `diagnosticos_formais = []`.
  const diag = membro.diagnosticos_formais;
  const diagLista = Array.isArray(diag)
    ? diag.map((d) => String(d).trim()).filter(Boolean)
    : pareceInformacao(diag)
      ? [String(diag).trim()]
      : [];
  if (diagLista.length > 0) {
    linhas.push(`Diagnóstico informado pela família: ${diagLista.join(", ")}`);
  }

  // ⚠️ `membros_atipicos.perfil` NÃO entra. É `perfilPrimario()` — um rótulo.
  // Se um dia servir, serve como diagnóstico, nunca como "o que já sabemos".

  const comunicacao = comunicacaoAtual(pv ?? null);
  if (comunicacao) linhas.push(`Comunicação hoje: ${primeiraFrase(comunicacao)}`);
  else lacunas.push("como a criança se comunica");

  const sensorial = textoDoCampo(pv?.sensorial);
  if (sensorial) linhas.push(`Sensibilidades: ${primeiraFrase(sensorial)}`);

  // ⚠️ COMO ELA É — o campo que a família escreveu sobre QUEM é esta criança.
  //
  // Caso real, 17/08/2026: a mãe perguntou "o que você sabe que ela aceita já?"
  // e a Ayla respondeu que não sabia. O perfil da criança tinha, aqui,
  // "Adora uva passa." A coluna `como_e` era buscada no banco desde sempre —
  // mas só `como_e.interesses` era consumido (`interessesAtuais`), e o `texto`
  // morria na montagem. Disponível, recuperada, NÃO injetada: §15 do protocolo
  // na forma mais cara, porque faz a Ayla perguntar o que a Kolo já sabia.
  //
  // NÃO usa `primeiraFrase` de propósito. Nos outros campos o corte é aceitável
  // porque o resto é detalhe; aqui o resto É o retrato — a segunda frase costuma
  // trazer o jeito da criança, não uma nota de rodapé. O teto do bloco continua
  // valendo, e a poda por prioridade acontece lá embaixo.
  //
  // Vem ANTES dos interesses porque identidade sobrevive à poda; gosto é o que
  // se corta primeiro quando o bloco estoura.
  const comoE = textoDoCampo(pv?.como_e);
  if (comoE) linhas.push(`Como ela é: ${comoE.replace(/\s*\n\s*/g, " ").slice(0, 400)}`);

  const interesses = interessesAtuais(pv ?? null);
  if (interesses.length) linhas.push(`Interesses atuais: ${interesses.join(", ")}`);
  else lacunas.push("interesses da criança");

  // ⚠️ DUAS FONTES, DOIS SIGNIFICADOS. O que ela CONTOU (com data) e o que ela
  // MARCOU no cadastro. Os detalhados vêm primeiro; os marcados que ainda não
  // têm detalhe entram numa linha própria, dizendo que falta o detalhe — é o
  // que faz a Ayla perguntar "me conta do sono" em vez de "o que está difícil?",
  // que a família já respondeu.
  // ⚠️ SEM CORTE ARBITRÁRIO (18/08/2026). Todos os domínios preenchidos são
  // ELEGÍVEIS; quem decide o que não cabe é o teto, logo abaixo, e item a item.
  // Ver o comentário de `desafiosAtuais` para o caso Rosangela.
  const desafios = desafiosAtuais(pv ?? null);
  const renderDesafios = (itens: readonly string[]) =>
    `Desafios atuais:\n- ${itens.join("\n- ")}`;
  /** Onde a seção de desafios ficou em `linhas` — o teto precisa encontrá-la. */
  let idxDesafios = -1;
  if (desafios.length) {
    idxDesafios = linhas.length;
    linhas.push(renderDesafios(desafios));
  }

  // ⚠️ DEPOIS DOS DESAFIOS, ANTES DAS LACUNAS. A mudança é sobre um desafio que
  // já foi nomeado acima — lida junto, ela diz "isto aqui virou outra coisa".
  // Lida antes, viraria manchete de uma criança que o modelo ainda não conhece.
  const mudancas = marcosRecentes(pv ?? null);
  if (mudancas.length) {
    linhas.push(`Mudou recentemente (registrado):\n- ${mudancas.join("\n- ")}`);
  }

  // ⚠️ O CRITÉRIO É "TEM TEXTO?", NUNCA "ENTROU NO TOP-3".
  //
  // Regressão que EU introduzi em `662a857` e que a bancada pegou: eu subtraía
  // apenas os três que o teto de `desafiosAtuais` deixou entrar. Com perfil
  // rico, `escola` tinha "Resiste a entrar na sala nas segundas" no banco e o
  // prompt dizia "escola: ainda sem detalhe" — pior que omitir, porque AFIRMA
  // ao modelo uma coisa falsa e faz a Ayla perguntar o que já sabe.
  //
  // O teto continua existindo (é outra frente); o que não pode é o teto virar
  // fonte de verdade sobre o que a família contou.
  const semDetalhe = desafiosSemDetalhe(pv ?? null);
  if (semDetalhe.length) {
    linhas.push(
      `Desafios que a família marcou no cadastro, ainda sem detalhe: ${semDetalhe.join(", ")}`,
    );
  }

  // Lacuna só quando NENHUMA das duas fontes tem nada. Declarar falta o que a
  // família já respondeu é o que fazia a Ayla repetir a pergunta.
  if (!desafios.length && !semDetalhe.length) lacunas.push("desafios atuais");

  // ── O TETO PODA ITEM A ITEM, E NUNCA APAGA A SEÇÃO INTEIRA ───────────────
  //
  // ⚠️ ANTES ERA `linhas.pop()` PURO, e os desafios são UMA entrada de `linhas`
  // com os itens juntos por `\n`. Bastava o bloco estourar para a seção inteira
  // desaparecer de uma vez — a família contava seis coisas e o modelo recebia
  // zero. Agora a seção encolhe pelo fim, um domínio por vez, e sobrevive com
  // pelo menos um item.
  //
  // A ordem de sacrifício é a de sempre — pelo fim, que é a de menor
  // prioridade: primeiro os marcados sem detalhe, depois as mudanças recentes,
  // e só então os desafios começam a encolher.
  const MIN_DESAFIOS_VISIVEIS = 1;
  const visiveis = [...desafios];
  let bloco = linhas.join("\n");
  while (bloco.length > TETO_CONTEXTO_BASE && linhas.length > 2) {
    const ultimo = linhas.length - 1;
    if (ultimo === idxDesafios) {
      // Chegou nos desafios: encolhe em vez de remover.
      if (visiveis.length <= MIN_DESAFIOS_VISIVEIS) break;
      visiveis.pop();
      linhas[idxDesafios] = renderDesafios(visiveis);
    } else {
      linhas.pop();
    }
    bloco = linhas.join("\n");
  }
  return { bloco, lacunas };
}

/** Uma consulta: o Perfil Vivo da criança em foco. */
/**
 * O PERFIL DA FAMÍLIA — quem mora na casa, que rotina ela tem, com que recursos
 * e em que dinâmica.
 *
 * ⚠️ POR QUE ELE EXISTE SEPARADO DO PERFIL DA CRIANÇA. "Somos só eu e ela",
 * "trabalho em turno", "moramos com a avó", "não temos plano de saúde" mudam a
 * orientação tanto quanto a característica da criança — uma estratégia que
 * depende de dois adultos é inútil para quem cria sozinha. O Legacy já lia
 * isto; o caminho novo não, e era a última lacuna real de contexto.
 *
 * ⚠️ SELEÇÃO, NÃO DESPEJO. Devolve as quatro seções de conteúdo e um teto de
 * caracteres por seção. Ter o dado disponível não é motivo para mandá-lo
 * inteiro: prompt grande não é prompt bom, e cada bloco compete com o que
 * importa naquele turno.
 */
export type LinhaPerfilFamilia = {
  composicao?: unknown;
  rotina?: unknown;
  recursos?: unknown;
  dinamica?: unknown;
  categorias_extras?: unknown;
};

export async function lerPerfilFamilia(
  supabase: SupabaseClient,
  familyId: string,
): Promise<LinhaPerfilFamilia | null> {
  try {
    const { data } = await supabase
      .from("perfil_vivo_familia")
      .select("composicao, rotina, recursos, dinamica, categorias_extras")
      .eq("family_account_id", familyId)
      .maybeSingle();
    return (data as LinhaPerfilFamilia | null) ?? null;
  } catch {
    // Enriquecimento acessório: se falhar, a conversa segue sem ele.
    return null;
  }
}

/** Uma linha por seção que tenha conteúdo de verdade. */
export function blocoDaFamilia(pf: LinhaPerfilFamilia | null): string {
  if (!pf) return "";
  const ROTULOS: Array<[keyof LinhaPerfilFamilia, string]> = [
    ["composicao", "quem mora na casa"],
    ["rotina", "rotina da casa"],
    ["recursos", "recursos e apoios"],
    ["dinamica", "dinâmica familiar"],
  ];
  const linhas: string[] = [];
  for (const [chave, rotulo] of ROTULOS) {
    const texto = achatar(pf[chave]);
    if (texto) linhas.push(`${rotulo}: ${texto.slice(0, 300)}`);
  }
  return linhas.length ? `<a_familia>\n${linhas.join("\n")}\n</a_familia>` : "";
}

/**
 * Achata um jsonb em texto legível, descartando o que não é informação.
 *
 * Reusa `pareceInformacao` — o mesmo filtro que já impede "não sei", "-" e
 * repetições de caractere de virarem contexto. Sem ele, o bloco encheria de
 * placeholders e a Ayla trataria "aaaa" como um fato da família.
 */
function achatar(v: unknown): string {
  if (typeof v === "string") return pareceInformacao(v) ? v.trim() : "";
  if (Array.isArray(v)) return v.map(achatar).filter(Boolean).join("; ");
  if (v && typeof v === "object") {
    return Object.entries(v as Record<string, unknown>)
      .map(([k, val]) => {
        const t = achatar(val);
        return t ? `${k.replace(/_/g, " ")} ${t}` : "";
      })
      .filter(Boolean)
      .join("; ");
  }
  return "";
}

export async function lerPerfilVivo(
  supabase: SupabaseClient,
  membroId: string | null,
): Promise<LinhaPerfilVivo | null> {
  if (!membroId) return null;
  try {
    const { data } = await supabase
      .from("perfil_vivo_membro")
      .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();
    return (data as LinhaPerfilVivo | null) ?? null;
  } catch {
    return null;
  }
}
