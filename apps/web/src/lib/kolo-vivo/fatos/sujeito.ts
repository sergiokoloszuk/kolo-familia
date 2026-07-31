/**
 * BARREIRA DE SUJEITO E DE CONTEÚDO — o filtro que roda antes de persistir.
 *
 * A auditoria da Fase 3 comprovou dois erros com dados medidos:
 *
 *   "Estou exausta e sem paciência"          → gravado como fato da CRIANÇA
 *   "O Pedro brinca, mas a Ana não interage" → gravado no membro em foco
 *
 * O primeiro viola o bloqueador nº 3 do prompt mestre (dado de outra pessoa no
 * perfil errado). O segundo é o mesmo erro com aparência inocente.
 *
 * REGRA QUE ORGANIZA TUDO AQUI:
 *
 *   Perder um candidato incerto é preferível a gravar um fato na pessoa errada.
 *
 * Um fato perdido reaparece na próxima conversa — as famílias repetem o que
 * importa. Um fato gravado na pessoa errada fica, é lido como verdade, e
 * contamina toda projeção futura sem deixar rastro de que está errado.
 *
 * SEM IA, de propósito: o prompt mestre proíbe chamada nova sem justificativa, e
 * os sinais que importam são estruturais (quem foi selecionado no formulário) ou
 * lexicais grosseiros (primeira pessoa, dois nomes na frase). Um classificador
 * probabilístico aqui erraria de formas mais difíceis de auditar.
 */

/** Quem é o sujeito da afirmação. */
export type SujeitoCandidato =
  | "accompanied_member"
  | "caregiver"
  | "another_person"
  | "multiple_or_ambiguous"
  | "unknown";

function normalizar(t: string): string {
  return (t ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A cuidadora falando DELA. Primeira pessoa + estado próprio.
 *
 * Ancorado em construções de sujeito, não em palavras soltas: "eu" sozinho
 * aparece em "eu acho que ele gosta", que é sobre a criança.
 */
const PRIMEIRA_PESSOA_SOBRE_SI =
  /\b(eu (estou|to|tou|nao|sou|me)|me sinto|minha vida|to (exausta|exausto|cansada|cansado|no limite|acabada|acabado)|estou (exausta|exausto|cansada|cansado|sem paciencia|no limite)|nao aguento|desabafar)\b/;

/**
 * Mais de uma pessoa na mesma afirmação. Inclui comparação, que é o caso mais
 * traiçoeiro: "o irmão come de tudo, já ele não" mistura dois sujeitos e o fato
 * do irmão não pode entrar em perfil nenhum.
 */
const MULTIPLAS_PESSOAS =
  /\b(irma|irmao|primo|prima|meu outro filho|minha outra filha|meus dois filhos|meus filhos|as duas|os dois|um deles|o outro)\b/;

/** Terceiro alguém que não é a pessoa acompanhada nem quem cuida. */
const OUTRA_PESSOA =
  /\b(a professora|o professor|a terapeuta|o terapeuta|a fono|o medico|a medica|a diretora|a cuidadora|meu marido|minha esposa|meu companheiro)\b/;

export type EntradaSujeito = {
  texto: string;
  /**
   * O fluxo selecionou explicitamente a pessoa acompanhada? Formulário do
   * diário e "Guardar no Perfil" da web selecionam; o WhatsApp herda o membro
   * em foco do turno, que também é uma seleção — só que mais frágil.
   */
  membroSelecionado: boolean;
};

/**
 * Classifica o sujeito.
 *
 * A decisão de projeto que vale registrar: quando há membro selecionado e
 * NENHUM contra-sinal, tratamos como `accompanied_member`. A alternativa —
 * exigir sinal positivo — rejeitaria a maior parte do acervo legítimo, porque
 * relato curto normalmente não tem pronome ("Aceita brócolis cozido"). O
 * prompt mestre manda priorizar o "membro explicitamente selecionado", e é
 * isso que fazemos: a estrutura afirma o sujeito, e o texto só pode DESMENTIR.
 */
export function classificarSujeito(e: EntradaSujeito): SujeitoCandidato {
  const t = normalizar(e.texto);
  if (!t) return "unknown";

  // Contra-sinais, em ordem de gravidade. O primeiro que casa manda.
  if (MULTIPLAS_PESSOAS.test(t)) return "multiple_or_ambiguous";
  if (PRIMEIRA_PESSOA_SOBRE_SI.test(t)) return "caregiver";
  if (OUTRA_PESSOA.test(t)) return "another_person";

  return e.membroSelecionado ? "accompanied_member" : "unknown";
}

/** Só um sujeito é elegível para o perfil da pessoa acompanhada. */
export function sujeitoElegivel(s: SujeitoCandidato): boolean {
  return s === "accompanied_member";
}

// ============================================================
// Conteúdo verificável
// ============================================================

/**
 * Afirmações puramente afetivas, sem nada observável.
 *
 * "É uma criança especial" foi aceita na amostra e vira ruído permanente: não
 * descreve comportamento, necessidade, preferência, habilidade nem contexto, e
 * ainda ocupa espaço em qualquer projeção futura.
 *
 * O critério é ESTREITO de propósito. Elogio + atributo funcional continua
 * passando ("é muito carinhoso com a irmã" tem um com quem; "é observador em
 * ambientes novos" tem um onde). O que cai é elogio puro e sozinho.
 */
const ELOGIO_PURO =
  /^(ele|ela|e|meu filho|minha filha|a crianca|o menino|a menina|\s)*\s*(e|eh)?\s*(um|uma)?\s*(crianca|menino|menina|garoto|garota|filho|filha)?\s*(muito|super|tao|bem)?\s*(especial|incrivel|maravilhos[ao]|lind[ao]|amor|fofo|fofa|perfeit[ao]|unic[ao]|doce|encantador[a]?)\s*[.!]*$/;

/** Palavras que, sozinhas, não afirmam nada verificável. */
const SEM_INFORMACAO = /^(sim|nao|ok|obrigada|obrigado|bom dia|boa tarde|boa noite|oi|ola)\s*[.!?]*$/;

export type VerdictoConteudo = { ok: true } | { ok: false; motivo: string };

/**
 * A afirmação diz algo verificável?
 *
 * Piso determinístico, e ele é mesmo um piso: distinguir "informação útil" de
 * "texto bonito" no caso geral exigiria julgamento semântico. O que dá para
 * fazer sem IA é barrar as duas formas inequívocas — elogio puro e interjeição.
 * O resto passa, e a Fase 4B mede quanto ruído sobrou.
 */
export function afirmacaoTemConteudo(texto: string): VerdictoConteudo {
  const t = normalizar(texto);
  if (t.length < 3) return { ok: false, motivo: "afirmacao_curta" };
  if (SEM_INFORMACAO.test(t)) return { ok: false, motivo: "sem_informacao" };
  if (ELOGIO_PURO.test(t)) return { ok: false, motivo: "elogio_sem_atributo" };
  return { ok: true };
}

// ============================================================
// Generalidade do conceito
// ============================================================

/**
 * O conceito é apenas o domínio (sem subcampo)?
 *
 * Não é defeito por si — quando o roteamento não produziu subcampo, o conceito
 * amplo é o comportamento correto, e inventar um subcampo por palavra solta
 * seria pior. Mas fato amplo **não serve para promoção**: contar "quantas vezes
 * falamos de sensorial" não caracteriza padrão nenhum.
 *
 * A maturação (Fase 7) deve usar esta função para excluir fatos amplos da
 * promoção a `pattern` ou `trait`, e as consultas de auditoria a usam como
 * métrica. Por isso é função derivada, e não coluna: nada a migrar, e a regra
 * fica num lugar só.
 */
export function conceitoEhAmplo(conceito: string, dominio: string): boolean {
  return (conceito ?? "").trim() === (dominio ?? "").trim();
}
