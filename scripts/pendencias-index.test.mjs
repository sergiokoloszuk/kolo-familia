import test from "node:test";
import assert from "node:assert/strict";
import { extrairFichas, gerarIndice, validarRegistro } from "./pendencias-index.mjs";

const ficha = (id, estado = "ABERTA") => `### PEND-${id}\n**Título ${id}**\nPrioridade: **P1** · STATUS: **${estado}**\n\nCritério de baixa: prova.\n`;
const registro = (fichas) => {
  const corpo = fichas.join("\n---\n\n");
  return `# Pendências\n\n${gerarIndice(extrairFichas(corpo))}\n\n## Fichas\n\n${corpo}`;
};

test("índice completo acompanha estado e prioridade da ficha", () => {
  const texto = registro([ficha("002"), ficha("001", "PUBLICADA")]);
  const { fichas, atual, esperado } = validarRegistro(texto, "# Arquivo\n");
  assert.deepEqual(fichas.map((f) => f.id), ["002", "001"]);
  assert.equal(atual, esperado);
  assert.ok(esperado.indexOf("PEND-001") < esperado.indexOf("PEND-002"));
  assert.match(esperado, /PEND-001.*PUBLICADA/);
});

test("estado alterado sem regenerar índice é detectado", () => {
  const texto = registro([ficha("001")]).replace("STATUS: **ABERTA**", "STATUS: **PUBLICADA**");
  const { atual, esperado } = validarRegistro(texto, "# Arquivo\n");
  assert.notEqual(atual, esperado);
});

test("nova ficha não indexada é detectada", () => {
  const texto = registro([ficha("001")]) + `\n${ficha("002")}`;
  const { atual, esperado } = validarRegistro(texto, "# Arquivo\n");
  assert.notEqual(atual, esperado);
});

test("IDs duplicados no arquivo ou entre aberto e arquivo são rejeitados", () => {
  assert.throws(() => extrairFichas(ficha("001") + ficha("001")), /duplicada/);
  assert.throws(() => validarRegistro(registro([ficha("001")]), ficha("001")), /aberto e arquivo/);
});

test("ficha sem estado ou marcador do índice removido falha fechada", () => {
  assert.throws(() => extrairFichas("### PEND-001\n**Título**\nPrioridade: **P1**\n"), /sem Estado\/STATUS/);
  assert.throws(() => validarRegistro(registro([ficha("001")]).replace("<!-- PENDENCIAS-INDEX:END -->", ""), ""), /Marcadores/);
});
