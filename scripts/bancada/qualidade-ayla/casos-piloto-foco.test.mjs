import { test } from "node:test";
import assert from "node:assert/strict";
import { casosPilotoFoco, casosAlinhamentoFoco } from "./casos-piloto-foco.mjs";
import { referenciasBase44 } from "./casos-base44-referencia.mjs";

test("alinhamento mantém os três cenários e quatro turnos exatos, sem usar Manu", () => {
  assert.equal(casosAlinhamentoFoco.length, 3);
  assert.equal(casosAlinhamentoFoco.reduce((n, c) => n + (c.mensagens?.length ?? 1), 0), 4);
  assert.ok(casosAlinhamentoFoco.every((c) => c.tema === "foco" && c.pessoa.nome !== "Manu"));
  assert.match(casosAlinhamentoFoco[0].mensagem, /professora/);
  assert.match(casosAlinhamentoFoco[0].mensagens[1], /^teria alguma brincadeira/);
  assert.match(casosAlinhamentoFoco[2].mensagem, /apenas uma/);
});

test("cinco casos e nove turnos somente de Foco, com identificadores únicos", () => {
  assert.equal(casosPilotoFoco.length, 5);
  assert.equal(new Set(casosPilotoFoco.map((c) => c.id)).size, 5);
  assert.ok(casosPilotoFoco.every((c) => c.tema === "foco"));
  assert.equal(casosPilotoFoco.reduce((n, c) => n + (c.mensagens?.length ?? 1), 0), 9);
});

test("cada caso tem pedido inicial, nascimento e régua humana, nunca resultado aprovado", () => {
  for (const c of casosPilotoFoco) {
    assert.ok(c.mensagem.trim());
    assert.match(c.pessoa.nascimento, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(c.verificar.length >= 2);
    if (c.mensagens) assert.equal(c.mensagens[0], c.mensagem);
    assert.equal(c.resultado, undefined);
  }
});

test("referência adulta preserva o exemplo já recebido, sem consultar cadastro de Manu", () => {
  const original = referenciasBase44.find((c) => c.id === "ref_introducao_foco");
  assert.deepEqual(casosPilotoFoco[0].pessoa, original.pessoa);
  assert.equal(original.mensagens, undefined);
  assert.ok(!casosPilotoFoco.some((c) => c.pessoa.nome === "Manu"));
});

test("ausente e parcial não semeiam atenção ou habilidade que o caso deve perguntar", () => {
  const sem = casosPilotoFoco.find((c) => c.id === "foco_abertura_sem_dados_do_tema");
  const parcial = casosPilotoFoco.find((c) => c.id === "foco_abertura_dados_parciais");
  assert.equal(sem.pessoa.sabe, undefined);
  assert.equal(sem.pessoa.extras, undefined);
  assert.deepEqual(parcial.pessoa.sabe.como_e.interesses, ["trens", "mapas"]);
  assert.equal(parcial.pessoa.extras.foco, undefined);
});

test("refinamento e dois irmãos exercitam fatos novos e alvo, não só apresentação", () => {
  const refino = casosPilotoFoco.find((c) => c.id === "foco_caso_concreto_e_refinamento");
  assert.equal(refino.mensagens.length, 3);
  assert.match(refino.mensagens[1], /difícil é começar/);
  assert.match(refino.mensagens[2], /vai errar/);
  const irmaos = casosPilotoFoco.find((c) => c.id === "foco_dois_irmaos_alvo_correto");
  assert.equal(irmaos.pessoa.nome, "Lia");
  assert.equal(irmaos.outrasPessoas[0].nome, "Rui");
  assert.ok(!JSON.stringify(irmaos.pessoa).includes("xadrez"));
});
