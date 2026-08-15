import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assinaturaLiberada,
  acessoEncerradoSemPagar,
  diasAteExclusao,
  pagamentoEmFalha,
  trialValido,
  type AcessoAssinatura,
} from "@/lib/auth/assinatura";
import { familiaEhDeStaff } from "@/lib/auth/acesso";
// ⚠️ A DURAÇÃO DO TESTE TEM UM DONO SÓ (`fatos-comerciais.ts`), e a suíte morde
// quem declara a própria cópia — foi assim que o template do WhatsApp já disse
// 30 dias enquanto o código dizia 7. Aqui ela só é lida.
import { TRIAL_DIAS } from "@/lib/billing/fatos-comerciais";

/**
 * "EM QUE PONTO DA JORNADA ESTA FAMÍLIA ESTÁ?" — a pergunta, num lugar só.
 *
 * ⚠️ O QUE ESTE MÓDULO **NÃO** É. Não é um segundo motor de assinatura, e não
 * inventa estado nenhum. `subscription_accesses` continua sendo a fonte de
 * verdade, e `lib/auth/assinatura.ts` continua sendo a REGRA — as funções puras
 * de lá (`assinaturaLiberada`, `trialValido`, `acessoEncerradoSemPagar`,
 * `pagamentoEmFalha`) são chamadas aqui, nunca reescritas. Duas fontes para a
 * mesma decisão sempre divergem, e a divergência apareceria justamente onde
 * dói: uma família assinante recebendo conversa de venda.
 *
 * ⚠️ O QUE ELE ACRESCENTA, e o motivo de existir. O gate de acesso responde
 * SIM/NÃO. A condução precisa de mais do que isso: precisa saber que hoje é o
 * terceiro dia, que faltam quatro, que a família já assinou (e portanto sai da
 * conversa comercial), ou que o teste acabou. Esse "que dia é hoje" não existia
 * em lugar nenhum do código — era a peça que faltava, e é só ela que nasce
 * aqui, DERIVADA das mesmas colunas.
 *
 * ⚠️ FAIL CLOSED. Sem linha, com data ilegível ou com erro de leitura, a fase é
 * `desconhecida` e `acesso` é `false`. Quem conduz não conduz por palpite: uma
 * fase inventada por ausência de dado colocaria a Ayla vendendo para quem já
 * paga.
 */

const MS_DIA = 24 * 60 * 60 * 1000;

/** A linha crua, do jeito que o banco guarda. */
export type LinhaAssinatura = AcessoAssinatura & { created_at?: string | null };

export type FaseTrial =
  /** Não dá para saber: sem linha, sem data, ou erro de leitura. */
  | "desconhecida"
  /** Existe linha, o teste ainda não começou a contar (sem `trial_ends_at`). */
  | "nao_iniciado"
  /** Dentro dos dias de teste. `dia` diz qual é. */
  | "trial"
  /** O teste acabou e ninguém assinou. */
  | "trial_encerrado"
  /** Pagando. Sai da condução comercial. */
  | "assinante"
  /** Cortesia válida (comp). Também sai da condução comercial. */
  | "cortesia"
  /** Pagamento falhou e está na janela de graça — acesso ainda de pé. */
  | "pagamento_em_falha"
  /** Cancelado/pausado, sem acesso e sem ser fim de teste. */
  | "encerrado";

export type EstadoTrial = {
  fase: FaseTrial;
  /**
   * O dia do teste, base ZERO: o dia em que a família chegou é D0, e o último
   * dia de um teste de 7 dias é D6. `null` fora do teste.
   *
   * ⚠️ Base zero de propósito, porque é assim que o documento da jornada fala
   * (D0–D7) — e um off-by-one aqui viraria a mensagem do dia errado para
   * família de verdade.
   */
  dia: number | null;
  /** Dias inteiros que ainda faltam até o fim do teste. `null` fora dele. */
  diasRestantes: number | null;
  /** O acesso está liberado agora? É `assinaturaLiberada`, sem reinterpretação. */
  acesso: boolean;
  /**
   * A Ayla deve conduzir a conversa de teste/assinatura com esta família?
   *
   * Assinante e cortesia saem — e isso é regra de produto, não detalhe: quem já
   * pagou não pode ouvir convite para pagar. Staff também sai, pelo mesmo
   * motivo pelo qual é isento no gate de acesso.
   */
  emConducaoComercial: boolean;
  /** Dias até a exclusão dos dados, quando há falha de pagamento carimbada. */
  diasAteExclusaoDeDados: number | null;
  /** A linha lida, para quem precisar decidir algo que este resumo não cobre. */
  linha: LinhaAssinatura | null;
};

const DESCONHECIDO: EstadoTrial = {
  fase: "desconhecida",
  dia: null,
  diasRestantes: null,
  acesso: false,
  emConducaoComercial: false,
  diasAteExclusaoDeDados: null,
  linha: null,
};

function ms(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const t = new Date(valor).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * A PARTE PURA — sem banco, para poder ser testada em todos os dias sem
 * inventar um relógio dentro de um teste de integração.
 *
 * `agora` é parâmetro justamente porque a jornada é sobre TEMPO: um leitor que
 * só sabe ler `Date.now()` não pode ser provado em D0 e em D6.
 */
export function estadoTrialDe(
  linha: LinhaAssinatura | null | undefined,
  agora: number = Date.now(),
  ehStaff = false,
): EstadoTrial {
  if (!linha) return DESCONHECIDO;

  const acesso = ehStaff || assinaturaLiberada(linha);
  const base = {
    acesso,
    diasAteExclusaoDeDados: diasAteExclusao(linha),
    linha,
  };

  // A ordem espelha a de `assinaturaLiberada`, de propósito: cortesia antes de
  // status, status antes de trial. Trocar a ordem aqui e não lá seria
  // exatamente a divergência que este módulo existe para evitar.
  const cortesiaValida =
    linha.cortesia === true && (!linha.cortesia_ate || (ms(linha.cortesia_ate) ?? 0) > agora);
  if (cortesiaValida) {
    return { ...base, fase: "cortesia", dia: null, diasRestantes: null, emConducaoComercial: false };
  }

  if (linha.status === "active") {
    return { ...base, fase: "assinante", dia: null, diasRestantes: null, emConducaoComercial: false };
  }

  if (pagamentoEmFalha(linha)) {
    // Quem falhou o pagamento JÁ é cliente: a conversa aqui é de recuperação,
    // não de venda de teste. Fica fora da condução comercial do trial.
    return {
      ...base,
      fase: "pagamento_em_falha",
      dia: null,
      diasRestantes: null,
      emConducaoComercial: false,
    };
  }

  if (linha.status === "trialing") {
    const fim = ms(linha.trial_ends_at);
    // `trialing` sem data não libera nada (ver `assinaturaLiberada`), e também
    // não é "vencido". Chamar isto de D0 seria começar uma jornada de sete dias
    // em cima de uma linha incompleta.
    if (fim == null) {
      return {
        ...base,
        fase: "nao_iniciado",
        dia: null,
        diasRestantes: null,
        emConducaoComercial: false,
      };
    }

    if (trialValido(linha, agora)) {
      const inicio = ms(linha.created_at);
      // Sem `created_at` o começo se deduz do fim: é o mesmo desenho de 7 dias
      // que o trigger do banco aplica, e degrada para o dia certo em vez de
      // para "não sei".
      const comeco = inicio ?? fim - TRIAL_DIAS * MS_DIA;
      const dia = Math.max(0, Math.floor((agora - comeco) / MS_DIA));
      const diasRestantes = Math.max(0, Math.ceil((fim - agora) / MS_DIA));
      return { ...base, fase: "trial", dia, diasRestantes, emConducaoComercial: !ehStaff };
    }

    return {
      ...base,
      fase: "trial_encerrado",
      dia: null,
      diasRestantes: 0,
      emConducaoComercial: !ehStaff,
    };
  }

  // `past_due` SEM carimbo é trial que acabou sem cartão — o produto já trata
  // isso como fim de teste, e a família precisa ouvir "seu teste acabou", não
  // "seu pagamento falhou".
  if (acessoEncerradoSemPagar(linha)) {
    return {
      ...base,
      fase: "trial_encerrado",
      dia: null,
      diasRestantes: 0,
      emConducaoComercial: !ehStaff,
    };
  }

  return { ...base, fase: "encerrado", dia: null, diasRestantes: null, emConducaoComercial: false };
}

/**
 * A VERSÃO COM BANCO — mesma leitura de `acessoLiberado`, mesmas colunas, mais
 * `created_at` (que é o que permite saber o DIA).
 *
 * Erro de leitura devolve `desconhecida`, e não um estado plausível: conduzir
 * por um palpite é pior do que não conduzir.
 */
export async function lerEstadoTrial(
  supabase: SupabaseClient,
  familyAccountId: string,
): Promise<EstadoTrial> {
  try {
    const [ehStaff, { data, error }] = await Promise.all([
      familiaEhDeStaff(supabase, familyAccountId).catch(() => false),
      supabase
        .from("subscription_accesses")
        .select("status, trial_ends_at, cortesia, cortesia_ate, pagamento_falhou_em, created_at")
        .eq("family_account_id", familyAccountId)
        .maybeSingle(),
    ]);
    // ⚠️ LEITURA CONFERIDA. `.maybeSingle()` devolve o erro em vez de lançar —
    // sem esta linha, uma falha de banco viraria "sem linha", que é um estado
    // legítimo do domínio, e a família apareceria como teste não iniciado.
    if (error) {
      console.warn(`[trial:estado] leitura falhou para ${familyAccountId}: ${error.message}`);
      return DESCONHECIDO;
    }
    return estadoTrialDe(data as LinhaAssinatura | null, Date.now(), ehStaff);
  } catch (e) {
    console.warn("[trial:estado] leitura falhou:", e instanceof Error ? e.message : e);
    return DESCONHECIDO;
  }
}
