import { beforeEach, describe, expect, it } from "vitest";
import { BancoMemoria } from "./__harness/banco-memoria";
import { falaCoerenteComEstado } from "./rotina-fala-coerente";
import { resolverRotinaOrfa } from "./rotina-reconciliacao";

/**
 * O CICLO COMPLETO DA ROTINA VISUAL, provado por estado.
 *
 * pedido → rotina criada → tema dito → aguardando → reconciliador →
 * dispararGeracao → gerando → pronto → artefato existente → fala correta.
 *
 * ⚠️ O QUE ESTE ARQUIVO PROVA E O QUE NÃO PROVA. Ele exercita a MÁQUINA DE
 * ESTADOS de verdade — as escritas, as transições, a guarda de concorrência, o
 * portão da fala — com banco em memória. Ele NÃO prova a geração de imagem em
 * si: `dispararGeracao` faz um POST HTTP para `/api/ludico/gerar-rotina` com um
 * segredo que só existe no ambiente de produção. Essa metade só se prova com
 * smoke em produção, e dizer o contrário seria confundir teste verde com
 * produto entregue.
 */

const FAM = "fam-e2e";
const ROTINA = "rot-e2e";
const T0 = new Date("2026-09-06T15:00:00.000Z");
const em = (min: number) => new Date(T0.getTime() + min * 60_000).toISOString();

/** A linha do tempo observada, para o relatório do ciclo. */
type Marco = { t: string; estado: string; nota: string };

function cenario() {
  const db = new BancoMemoria();
  db.semear("rotinas", [
    {
      id: ROTINA,
      family_account_id: FAM,
      membro_atipico_id: "membro-1",
      nome: "Dia com os tios",
      tema: null,
      cards_status: "aguardando",
      created_at: em(0),
    },
  ]);
  db.semear("ayla_messages", [
    // A mãe disse o tema ANTES de a rotina ser gravada, na mesma conversa —
    // o caso real da Karina.
    { family_account_id: FAM, direcao: "inbound", texto: "Quero uma rotina visual\nTema princesa", created_at: em(-18) },
    { family_account_id: FAM, direcao: "inbound", texto: "Ok", created_at: em(-2) },
    // E duas horas depois, a cobrança.
    { family_account_id: FAM, direcao: "inbound", texto: "E agora?", created_at: em(133) },
  ]);
  return db;
}

describe("CICLO COMPLETO — aguardando até fala correta", () => {
  let db: BancoMemoria;
  const linha = () => db.linhas("rotinas").find((r) => r.id === ROTINA)!;
  beforeEach(() => {
    db = cenario();
  });

  it("percorre os estados na ordem, e cada transição tem dono", async () => {
    const marcos: Marco[] = [];
    marcos.push({ t: em(0), estado: String(linha().cards_status), nota: "rotina gravada sem tema" });
    expect(linha().cards_status).toBe("aguardando");
    expect(linha().tema).toBeNull();

    // ── A fala NÃO pode afirmar conclusão neste ponto ───────────────────────
    const falaErrada = falaCoerenteComEstado({
      texto: "Pronto! A rotina da Manu está montada.",
      estado: "aguardando",
      temArtefatoVerificavel: false,
    });
    expect(falaErrada.corrigida).toBe(true);
    expect(falaErrada.texto).not.toMatch(/está montada/);
    marcos.push({ t: em(0), estado: "aguardando", nota: "portão 3 barrou 'pronto' falso" });

    // ── O reconciliador entra e recupera o tema da conversa de origem ───────
    const disparos: Array<{ id: string; tema: string }> = [];
    const r = await resolverRotinaOrfa(db.cliente() as never, ROTINA, async (id, tema) => {
      disparos.push({ id, tema });
      return true;
    });
    expect(r.tipo).toBe("resolvida");
    if (r.tipo === "resolvida") expect(r.tema).toBe("princesa");
    marcos.push({ t: em(133), estado: "gerando", nota: `tema recuperado: princesa` });

    // ── O disparo aconteceu, uma vez só, para esta rotina ──────────────────
    expect(disparos).toEqual([{ id: ROTINA, tema: "princesa" }]);
    expect(linha().tema).toBe("princesa");
    // ⚠️ O RECONCILIADOR NÃO ESCREVE `gerando`, E ISSO É O CONTRATO. Quando ele
    // escrevia, o endpoint de geração via a rotina como "já a caminho", pulava
    // por idempotência e devolvia 200 — falso sucesso que deixava a rotina em
    // `gerando` para sempre, fora do alcance do próprio varredor. Karina e
    // Maria Julia, 06/09/2026, em produção. Quem faz a transição é o endpoint,
    // que é quem sabe se a geração realmente começou.
    expect(linha().cards_status).toBe("aguardando");
    // No mundo real, é o endpoint que grava isto — aqui simulamos a transição.
    db.tabelas.set("rotinas", [{ ...linha(), cards_status: "gerando" }]);

    // ── Em `gerando` a fala ainda não pode afirmar entrega ─────────────────
    const durante = falaCoerenteComEstado({
      texto: "Pronto! Já mandei os cartões.",
      estado: "gerando",
      temArtefatoVerificavel: false,
    });
    expect(durante.corrigida).toBe(true);

    // ── O gerador conclui: estado pronto E artefato recuperável ────────────
    db.tabelas.set("rotinas", [{ ...linha(), cards_status: "pronto" }]);
    marcos.push({ t: em(136), estado: "pronto", nota: "gerador concluiu, imagem_url preenchida" });

    // ── Só AGORA a fala pode afirmar conclusão ─────────────────────────────
    const final = falaCoerenteComEstado({
      texto: "Pronto! Os cartões da rotina estão aí 🌿",
      estado: "pronto",
      temArtefatoVerificavel: true,
    });
    expect(final.corrigida).toBe(false);
    marcos.push({ t: em(136), estado: "pronto", nota: "fala autorizada a afirmar entrega" });

    // O ciclo passou por todos os estados, na ordem.
    expect(marcos.map((m) => m.estado)).toEqual([
      "aguardando",
      "aguardando",
      "gerando",
      "pronto",
      "pronto",
    ]);
  });

  it("pronto SEM artefato não fecha o ciclo — a fala recua", () => {
    const r = falaCoerenteComEstado({
      texto: "Pronto! Os cartões estão aí.",
      estado: "pronto",
      temArtefatoVerificavel: false,
    });
    expect(r.corrigida).toBe(true);
  });

  it("dois donos na mesma rotina: só um dispara", async () => {
    /**
     * ⚠️ A CORRIDA REAL — cron e turno reativo caindo no mesmo órfão. O
     * `.eq("cards_status","aguardando")` no UPDATE é o que resolve: o segundo
     * não encontra mais a linha nesse estado.
     */
    const disparos: string[] = [];
    const bater = () =>
      resolverRotinaOrfa(db.cliente() as never, ROTINA, async (id) => {
        disparos.push(id);
        return true;
      });
    const [a, b] = await Promise.all([bater(), bater()]);
    const resolvidas = [a, b].filter((x) => x.tipo === "resolvida");
    expect(resolvidas).toHaveLength(1);
    expect(disparos).toHaveLength(1);
  });

  it("disparo que não confirma deixa a rotina em 'erro', não em falso sucesso", async () => {
    const r = await resolverRotinaOrfa(db.cliente() as never, ROTINA, async () => false);
    expect(r.tipo).toBe("falhou");
    expect(linha().cards_status).toBe("erro");
  });

  it("sem evidência de tema, não inventa: devolve perguntar e não escreve nada", async () => {
    db.tabelas.set("ayla_messages", [
      { id: "m1", family_account_id: FAM, direcao: "inbound", texto: "Gere", created_at: em(5) },
    ]);
    const disparos: string[] = [];
    const r = await resolverRotinaOrfa(db.cliente() as never, ROTINA, async (id) => {
      disparos.push(id);
      return true;
    });
    expect(r.tipo).toBe("perguntar");
    expect(disparos).toHaveLength(0);
    expect(linha().tema).toBeNull();
    expect(linha().cards_status).toBe("aguardando");
  });

  it("REGRESSÃO — o reconciliador jamais grava 'gerando' por conta própria", async () => {
    /**
     * ⚠️ O BUG QUE ESTE TESTE EXISTE PARA IMPEDIR, em produção, 06/09/2026.
     *
     * O reconciliador gravava `cards_status='gerando'` antes de chamar o
     * gerador. O endpoint tem guarda de idempotência — "não refaz se já está a
     * caminho" — então via `gerando`, pulava, e devolvia 200. O disparo parecia
     * ter dado certo. As rotinas da Manu e da Maria Julia saíram de
     * `aguardando`, que o varredor recolhe, para `gerando`, que ninguém
     * recolhe: um falso sucesso que produzia um órfão PIOR que o original.
     */
    let statusNoMomentoDoDisparo: string | null = null;
    await resolverRotinaOrfa(db.cliente() as never, ROTINA, async () => {
      statusNoMomentoDoDisparo = String(linha().cards_status);
      return true;
    });
    expect(statusNoMomentoDoDisparo).toBe("aguardando");
  });

  it("tema já presente e ainda parada: dispara sem reconciliar nada", async () => {
    // A outra espécie de órfã — o dado existe, o disparo é que nunca chegou.
    // É também o caminho de reparo de quem voltou de `gerando` sem geração.
    db.tabelas.set("rotinas", [{ ...linha(), tema: "dinossauro" }]);
    const disparos: string[] = [];
    const r = await resolverRotinaOrfa(db.cliente() as never, ROTINA, async (_id, tema) => {
      disparos.push(tema);
      return true;
    });
    expect(r.tipo).toBe("resolvida");
    expect(disparos).toEqual(["dinossauro"]);
  });
});
