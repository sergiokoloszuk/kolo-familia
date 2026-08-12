/**
 * O CENÁRIO — uma família sintética, um modelo de mentira, e o turno REAL.
 *
 * O que este arquivo monta é o mínimo para `processInbound` rodar de ponta a
 * ponta sem tocar em rede, banco, WhatsApp ou modelo pago. O que ele NÃO faz é
 * inventar a resposta: quem decide continua sendo o orquestrador.
 *
 * ⚠️ O MODELO É FALSO, E ISSO LIMITA O QUE A SIMULAÇÃO PROVA. Ele devolve texto
 * fixo e registra o que RECEBEU. Então dá para provar o que chegou ao modelo —
 * qual perfil, qual nota, qual histórico — e NÃO dá para provar o que um modelo
 * de verdade escreveria com aquilo. As duas coisas são etiquetadas separadas em
 * todo relatório: PROVEI PELO FLUXO REAL × NÃO CONSEGUI PROVAR.
 */

import { BancoMemoria, novoId } from "./banco-memoria";

export type Enviada = { texto: string; tipo?: string; para: string };

/** O que o turno pediu ao modelo — a prova de recuperação e injeção. */
export type ChamadaModelo = {
  quem: string;
  prompt: string;
  mensagem: string;
  notas: string[];
};

export type Mundo = {
  db: BancoMemoria;
  familyId: string;
  membros: Record<string, string>;
  telefone: string;
  enviadas: Enviada[];
  chamadas: ChamadaModelo[];
};

export type PerfilSintetico = {
  nome: string;
  nascimento: string;
  genero?: string;
  /**
   * O que a Kolo JÁ SABE, escrito onde o código REALMENTE lê.
   *
   * ⚠️ `perfil_vivo_membro` tem colunas próprias (`essencial`, `como_e`,
   * `corpo_rotina`, `desafios_regulacao`, `sensorial`) E um saco `categorias_extras`
   * — e `carregarKoloVivoResumo` só varre as chaves de extras que existem em
   * TEMAS com `storage === "extras"`. Na primeira rodada deste harness a
   * fixture pôs "sensorial" dentro de extras: o dado existia no banco, o teste
   * cobrava, e a falha era MINHA, não do produto. Campo homônimo não prova
   * fonte.
   */
  sabe?: Record<string, unknown>;
  /** Chaves de TEMAS com storage "extras" (rotina, escola, desafios…). */
  extras?: Record<string, unknown>;
};

export function montarMundo(params: {
  telefone?: string;
  nomeMae?: string;
  criancas: PerfilSintetico[];
}): Mundo {
  const db = new BancoMemoria();
  const telefone = params.telefone ?? "+5541999990001";
  const familyId = novoId("fam");

  db.semear("family_accounts", [
    {
      id: familyId,
      whatsapp_e164: telefone,
      nome_responsavel: params.nomeMae ?? "Ana",
      // Sem gate de assinatura no caminho do cenário: o que se mede aqui é
      // autoridade sobre artefato, não cobrança.
      assinatura_status: "active",
      trial_ate: "2099-01-01",
      idioma: "pt",
      ayla_ativa: true,
      onboarding_completo: true,
    },
  ]);

  // ⚠️ SEM ISTO, TODO CENÁRIO PASSA VERDE PELO MOTIVO ERRADO — e foi o que
  // aconteceu na primeira rodada deste harness (11/08/2026): quatro cenários de
  // artefato "passaram" com ZERO chamadas de modelo, porque o turno inteiro foi
  // respondido pelo portão de assinatura com `tipo: "assinatura_nudge"`.
  // "Nenhuma rotina criada" era verdade, e não queria dizer nada.
  //
  // `acessoLiberado` é FAIL-CLOSED e lê `subscription_accesses`, não um campo
  // em `family_accounts`. A família do cenário precisa existir lá.
  db.semear("subscription_accesses", [
    {
      family_account_id: familyId,
      status: "active",
      trial_ends_at: "2099-01-01T00:00:00.000Z",
      cortesia: false,
      cortesia_ate: null,
      pagamento_falhou_em: null,
    },
  ]);

  const membros: Record<string, string> = {};
  for (const c of params.criancas) {
    const id = novoId("membro");
    membros[c.nome] = id;
    db.semear("membros_atipicos", [
      {
        id,
        family_account_id: familyId,
        nome: c.nome,
        data_nascimento: c.nascimento,
        genero: c.genero ?? null,
        ativo: true,
      },
    ]);
    if (c.sabe || c.extras) {
      db.semear("perfil_vivo_membro", [
        {
          membro_atipico_id: id,
          family_account_id: familyId,
          ...(c.sabe ?? {}),
          categorias_extras: c.extras ?? {},
        },
      ]);
    }
  }

  return { db, familyId, membros, telefone, enviadas: [], chamadas: [] };
}

/** A fala da mãe, no formato que a Z-API entrega. */
export function inboundDe(mundo: Mundo, texto: string, quando = new Date()) {
  return {
    phoneE164: mundo.telefone,
    texto,
    messageId: novoId("zaap"),
    recebidaEm: quando,
  };
}

/**
 * O ESTADO DO TURNO, do jeito que o cenário precisa ler.
 *
 * Vem do que FOI GRAVADO e do que FOI ENVIADO — não de uma variável interna do
 * orquestrador. Se um dia o caminho mudar por dentro, o cenário continua
 * medindo a mesma coisa: o que a família recebeu.
 */
export function estadoDoTurno(mundo: Mundo) {
  const msgs = mundo.db.linhas("ayla_messages");
  const saida = msgs.filter((m) => m.direcao === "outbound");
  const ultima = saida[saida.length - 1] ?? null;
  return {
    respondeu: mundo.enviadas.length > 0,
    ultimoTexto: mundo.enviadas[mundo.enviadas.length - 1]?.texto ?? null,
    tipo: (ultima?.tipo as string | undefined) ?? null,
    membroResolvido: (ultima?.membro_atipico_id as string | null) ?? null,
    rotinasCriadas: mundo.db.linhas("rotinas").length,
    planosCriados: mundo.db.linhas("planos").length,
    chamadas: mundo.chamadas.map((c) => c.quem),
  };
}
