import type { PlanoSecao } from "./plano";

/**
 * O PORTÃO DO PLANO — o que não pode virar artefato.
 *
 * Caso real (03/08/2026). A mãe da Adelly recebeu um PDF chamado:
 *
 *   "Aguardando a situação específica de Adelly.pdf"
 *
 * E o plano dentro dele estava BOM: sete seções, 925 a 2.108 caracteres cada,
 * todas sobre o desafio que ela acabara de contar. O que falhou foi só o
 * TÍTULO — `analisarDesafio` é uma chamada separada que olha o mesmo material e
 * pode chegar a outra conclusão. Duas leituras, nenhuma confrontada.
 *
 * Ela provavelmente nem abriu o arquivo.
 *
 * Isto aqui faz duas coisas diferentes, de propósito:
 *
 *   ESCOLHER O TÍTULO  — um título ruim não joga fora um plano bom. Se o
 *                        gerado admite falta de contexto, cai pro tema já
 *                        validado pela prontidão.
 *   VALIDAR O PLANO    — se o CONTEÚDO não sustenta um artefato, aí sim não
 *                        publica nada.
 *
 * E valida por CLASSE, não por frase: barrar só "Aguardando a situação
 * específica" seria trocar um buraco por outro menor.
 */

/** Seções que estruturam o plano — abrem e fecham. Sem elas não é um plano. */
export const SECOES_ESTRUTURAIS = ["entender", "observar"] as const;

/** Abaixo disto, a seção é placeholder disfarçado de conteúdo. */
const MINIMO_SECAO = 200;
/** Quantas seções de conteúdo (fora entender/observar) precisam ter substância. */
const MINIMO_CONTEUDO = 2;

function norm(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * O texto ADMITE que falta contexto?
 *
 * O alvo é a classe "ainda não sei do que se trata", não uma frase. Note o que
 * NÃO entra: "específico" sozinho é palavra legítima e frequente ("Rotina
 * específica da manhã", "um momento específico do dia"). Barrar por ela seria
 * criar falso positivo em título bom.
 */
export function admiteFaltaDeContexto(texto: string): boolean {
  const t = norm(texto);
  return (
    /\baguardand/.test(t) ||
    /\ba (ser )?defini(r|do|da)\b/.test(t) ||
    /\b(ainda )?(nao|sem) (defini|informa|sei|temos|ha) /.test(t) ||
    /\bsem (contexto|informacoes|dados|situacao)\b/.test(t) ||
    /\bindefinid[oa]\b/.test(t) ||
    /\bpendente de\b/.test(t) ||
    /\bfalta (definir|informar|saber|contexto)\b/.test(t) ||
    /\bassim que (voce|vc) (contar|disser|falar)\b/.test(t)
  );
}

/** Sobrou marcador de template no texto? */
export function temPlaceholder(texto: string): boolean {
  const t = texto ?? "";
  return (
    // MAIÚSCULA E COM DOIS-PONTOS, de propósito. `/\bTODO\b/i` casava com a
    // palavra portuguesa "todo" — "o dia todo", "como um todo" — e barrou 21
    // seções de planos bons quando isto foi medido contra a produção.
    /\bTODO:/.test(t) ||
    /\bFIXME\b/.test(t) ||
    /\blorem ipsum\b/i.test(t) ||
    // Só marcadores de template de verdade. `[nome]` FICOU DE FORA: os planos
    // reais usam "em 5 minutos o [nome] chega" como frase-modelo pra família
    // completar, e isso é conteúdo, não buraco.
    /\[(inserir|preencher|completar|a definir)[^\]]*\]/i.test(t) ||
    /\bpreencher aqui\b/i.test(t) ||
    /\{\{[^}]+\}\}/.test(t)
  );
}

/**
 * O TÍTULO QUE VAI PRO ARTEFATO.
 *
 * Um plano bom não é descartado porque o título saiu ruim — o título é
 * consertável, o conteúdo não. Ordem: o gerado, se for coerente; senão o tema
 * já validado pela prontidão; senão o nome da criança.
 */
export function escolherTitulo(params: {
  /** O que `analisarDesafio` devolveu. */
  gerado?: string | null;
  /** O tema que a prontidão validou a partir da conversa. É o fallback bom. */
  temaValidado?: string | null;
  nome?: string | null;
}): { titulo: string; trocado: boolean; motivo: string } {
  const g = (params.gerado ?? "").trim();
  const ok = (s: string) => s.length >= 3 && !admiteFaltaDeContexto(s) && !temPlaceholder(s);

  if (g && ok(g)) return { titulo: g, trocado: false, motivo: "-" };

  const tema = (params.temaValidado ?? "").trim();
  if (tema && ok(tema)) {
    return {
      titulo: tema.length > 70 ? `${tema.slice(0, 67)}...` : tema,
      trocado: true,
      motivo: g ? `título gerado admitia falta de contexto: "${g.slice(0, 60)}"` : "sem título gerado",
    };
  }

  const nome = (params.nome ?? "").trim();
  return {
    titulo: nome ? `Plano — ${nome}` : "Plano",
    trocado: true,
    motivo: "nem o título gerado nem o tema serviam",
  };
}

export type FalhaPlano = {
  codigo:
    | "sem_estrutural"
    | "estrutural_fraca"
    | "sem_conteudo"
    | "secao_vazia"
    | "placeholder"
    | "admite_falta_contexto";
  detalhe: string;
};

/**
 * O plano tem substância para virar artefato?
 *
 * Roda DEPOIS da geração e ANTES de persistir, gerar PDF e mandar link. Em
 * falha não existe versão degradada: ou o plano se sustenta, ou a Ayla segue
 * conversando e pede a situação concreta.
 */
export function validarPlano(params: {
  titulo: string;
  secoes: readonly PlanoSecao[];
}): { ok: boolean; falhas: FalhaPlano[] } {
  const falhas: FalhaPlano[] = [];
  const corpo = (s: PlanoSecao) => (s.conteudo_markdown ?? "").trim();

  // O título já passou por `escolherTitulo`; se ainda admite falta de
  // contexto, é porque nem o tema servia — e aí o problema é de conteúdo.
  if (admiteFaltaDeContexto(params.titulo)) {
    falhas.push({ codigo: "admite_falta_contexto", detalhe: `título: "${params.titulo}"` });
  }

  for (const t of SECOES_ESTRUTURAIS) {
    const s = params.secoes.find((x) => x.tipo === t);
    if (!s) {
      falhas.push({ codigo: "sem_estrutural", detalhe: t });
    } else if (corpo(s).length < MINIMO_SECAO) {
      falhas.push({ codigo: "estrutural_fraca", detalhe: `${t} (${corpo(s).length} chars)` });
    }
  }

  const conteudo = params.secoes.filter(
    (s) => !(SECOES_ESTRUTURAIS as readonly string[]).includes(s.tipo),
  );
  const comSubstancia = conteudo.filter((s) => corpo(s).length >= MINIMO_SECAO);
  if (comSubstancia.length < MINIMO_CONTEUDO) {
    falhas.push({
      codigo: "sem_conteudo",
      detalhe: `${comSubstancia.length} seção(ões) com substância, mínimo ${MINIMO_CONTEUDO}`,
    });
  }

  for (const s of params.secoes) {
    const c = corpo(s);
    if (c.length > 0 && c.length < 60) {
      falhas.push({ codigo: "secao_vazia", detalhe: `${s.tipo} (${c.length} chars)` });
    }
    if (temPlaceholder(c)) {
      falhas.push({ codigo: "placeholder", detalhe: s.tipo });
    }
    if (admiteFaltaDeContexto(c) && c.length < 400) {
      // Texto curto que só diz "me conta mais" não é seção de plano.
      falhas.push({ codigo: "admite_falta_contexto", detalhe: `seção ${s.tipo}` });
    }
  }

  return { ok: falhas.length === 0, falhas };
}

/** Resumo pro log. Nunca vai pra família. */
export function resumirFalhasPlano(falhas: readonly FalhaPlano[]): string {
  return falhas.map((f) => `${f.codigo}:${f.detalhe}`).join(" | ");
}

/** Erro tipado — quem chama precisa saber que NADA foi persistido. */
export class PlanoSemSubstanciaError extends Error {
  // Campo explícito em vez de parameter property: o type-stripping do Node (que
  // as bancadas usam pra importar o módulo de produção direto) não suporta a
  // forma curta, e uma bancada que não consegue importar o código real mede
  // outra coisa.
  readonly falhas: FalhaPlano[];

  constructor(falhas: FalhaPlano[]) {
    super(`plano sem substância: ${resumirFalhasPlano(falhas)}`);
    this.name = "PlanoSemSubstanciaError";
    this.falhas = falhas;
  }
}
