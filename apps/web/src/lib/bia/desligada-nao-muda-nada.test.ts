import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { biaHabilitadaNoPrompt, BIA_FLAG_ENV } from "./flag";
import { carregarBlocoBia } from "./contexto-ayla";

/**
 * COM A FLAG DESLIGADA, A BIA NÃO EXISTE PARA NINGUÉM — 18/08/2026.
 *
 * ═══ O QUE ESTA ETAPA É, E O QUE ELA NÃO É ═══
 *
 * A tabela `bia_chunks` foi criada em produção hoje (migração 0071) e está
 * VAZIA. Este commit traz o MOTOR — recuperação, pontuação, montagem de bloco —
 * e mais nada. Não importa conteúdo, não liga na conversa, não muda uma vírgula
 * do que qualquer família recebe.
 *
 * ⚠️ O BRANCH DE ORIGEM TINHA MAIS QUE ISSO, E FOI DEIXADO PARA TRÁS DE
 * PROPÓSITO. `bia/ciclo-tecnico` também alterava `lib/ia/prompt.ts`,
 * `lib/ayla/responder.ts` e `lib/ayla/orchestrator.ts` para injetar o bloco.
 * Nada disso veio:
 *
 *   1. a instrução desta missão é trazer o motor, não ligá-lo;
 *   2. aquela fiação mira Legacy e Web — e **não toca `experimental.ts`**, que
 *      é quem atende TODAS as famílias desde 17/08. Seria ligar a BIA no
 *      caminho que hoje é fallback e deixar de fora o que está no ar;
 *   3. `prompt.bia.test.ts` também ficou de fora: ele testa exatamente aquela
 *      integração, e um teste sem o código que ele mede é teatro.
 *
 * Este arquivo é a prova do estado atual: o motor existe, e está inerte.
 */

const ORIGINAL = process.env[BIA_FLAG_ENV];
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env[BIA_FLAG_ENV];
  else process.env[BIA_FLAG_ENV] = ORIGINAL;
});

describe("a flag é fail-closed", () => {
  it("1. ausente → desligada", () => {
    expect(biaHabilitadaNoPrompt({})).toBe(false);
  });

  it("2. MORDE: só '1' e 'true' ligam — qualquer outra coisa é OFF", () => {
    for (const v of ["", " ", "0", "false", "sim", "yes", "on", "SIM", "2", "null"]) {
      expect(biaHabilitadaNoPrompt({ [BIA_FLAG_ENV]: v }), `"${v}" ligou a BIA`).toBe(false);
    }
    for (const v of ["1", "true", "TRUE", " true "]) {
      expect(biaHabilitadaNoPrompt({ [BIA_FLAG_ENV]: v }), `"${v}" não ligou`).toBe(true);
    }
  });

  it("3. o ambiente REAL deste repositório está com a BIA desligada", () => {
    // Se alguém puser a variável no `.env` sem decidir, este teste avisa.
    expect(biaHabilitadaNoPrompt()).toBe(false);
  });
});

describe("com a flag OFF, o bloco é vazio e nada é consultado", () => {
  it("4. MORDE: devolve string vazia SEM tocar no banco", async () => {
    let tocouNoBanco = false;
    const supabaseEspiao = {
      from() {
        tocouNoBanco = true;
        throw new Error("a BIA consultou o banco com a flag desligada");
      },
    } as never;

    delete process.env[BIA_FLAG_ENV];
    const bloco = await carregarBlocoBia({
      supabase: supabaseEspiao,
      familyId: "fam-1",
      canal: "whatsapp",
      contexto: { idadeAnos: 5, dominio: "sono", textoDaConversa: "ele não dorme" },
    } as never);

    expect(bloco, "a BIA injetou texto com a flag desligada").toBe("");
    expect(tocouNoBanco, "a BIA consultou o banco com a flag desligada").toBe(false);
  });

  it("5. o mesmo vale para valores lixo na variável", async () => {
    for (const v of ["0", "false", "talvez"]) {
      process.env[BIA_FLAG_ENV] = v;
      const bloco = await carregarBlocoBia({
        supabase: { from() { throw new Error("não deveria consultar"); } } as never,
        familyId: "fam-1",
        canal: "web",
        contexto: { textoDaConversa: "oi" },
      } as never);
      expect(bloco, `"${v}" produziu bloco`).toBe("");
    }
  });
});

describe("o motor está DESCONECTADO da conversa", () => {
  const raiz = resolve(__dirname, "..");
  const ler = (p: string) => readFileSync(resolve(raiz, p), "utf8");

  /** Os arquivos que montam o que o modelo lê, nos dois caminhos. */
  const CAMINHOS = [
    "ayla/experimental.ts",
    "ayla/experimental-contexto.ts",
    "ayla/responder.ts",
    "ayla/orchestrator.ts",
    "ia/prompt.ts",
  ];

  it("6. MORDE: nenhum caminho de conversa importa a BIA", () => {
    for (const arquivo of CAMINHOS) {
      const fonte = ler(arquivo);
      expect(fonte, `${arquivo} passou a importar a BIA — isto é a integração, não esta etapa`)
        .not.toMatch(/from "@?\/?\.*lib\/bia|from "\.\.\/bia|carregarBlocoBia/);
    }
  });

  it("7. e ninguém fora de lib/bia consome o motor", () => {
    // Se um dia alguém ligar, é para ser uma decisão visível — não um import
    // que entrou junto de outra coisa.
    const orquestrador = ler("ayla/orchestrator.ts");
    expect(orquestrador).not.toMatch(/buscarConhecimentosBIA|montarBlocoBia/);
  });
});

describe("a migração 0071 está registrada no repositório", () => {
  it("8. o arquivo existe — o banco não pode ter tabela que o repo desconhece", () => {
    const sql = readFileSync(
      resolve(__dirname, "../../../../../supabase/migrations/0071_bia.sql"),
      "utf8",
    );
    expect(sql).toMatch(/create table if not exists public\.bia_chunks/);
    // As duas policies têm que estar no arquivo: foi a ausência delas (por
    // truncamento no transporte) que reprovou a primeira prova em transação.
    expect((sql.match(/create policy/g) ?? []).length).toBe(2);
  });

  it("9. existe o caminho de volta", () => {
    const rollback = readFileSync(
      resolve(__dirname, "../../../../../supabase/migrations/0071_rollback.sql"),
      "utf8",
    );
    expect(rollback).toMatch(/drop table if exists public\.bia_chunks/);
  });
});
