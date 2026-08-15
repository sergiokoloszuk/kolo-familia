/**
 * C2 · desce o ramo experimental para DEPOIS do classificador e dos roteadores.
 *
 * ⚠️ POR QUE DESCER O EXPERIMENTAL EM VEZ DE SUBIR SEIS REGIÕES. A tentativa
 * anterior (Fatia 2, revertida) movia a região dos roteadores para cima — e os
 * testes pegaram que `classificarIntencao` mora no meio dela, com três blocos
 * dependendo de `intent`. Mover em bloco fazia o experimental herdar uma LLM.
 *
 * Descer o experimental produz EXATAMENTE a mesma ordem final e move UM bloco
 * em vez de seis. Menos superfície, mesma arquitetura:
 *
 *   acesso → fim de semana → escolher criança → segurança → retomada →
 *   membro → desafios → menu → escolha → classificarIntencao →
 *   rotina(ver/editar/conduzir) → plano → "sim" curto →
 *   EXPERIMENTAL  ← passa a ver `turnoClassificado`
 *   → parser → geração
 *
 * E o experimental deixa de ser a primeira porta para ser o que sempre foi na
 * intenção: quem responde quando NENHUMA intenção especializada casou.
 *
 * ⚠️ O CUSTO, declarado: o turno experimental passa a pagar
 * `classificarIntencao` — MEDIDO em 849 ms de p50. Continua sem `parseInbound`
 * (2.659 ms de p50), então segue ~1,8 s mais rápido que o Legacy, que paga os
 * dois. Era a decisão C2, tomada com esses números na mesa.
 *
 * Uso:  node scripts/c2-descer-experimental.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const P = "apps/web/src/lib/ayla/orchestrator.ts";
const orig = readFileSync(P, "utf8");
const L = orig.split("\n");
const idx = (s, from = 0) => L.findIndex((l, n) => n >= from && l.includes(s));

// ── fronteiras do bloco a mover ───────────────────────────────────────────
const iCabec = idx("// 3a-EXP. A PORTA AO LADO") - 1; // a linha de ═══ acima
const iFim = idx("// 3a. Resposta à oferta de fim de semana"); // primeira linha DEPOIS
const iDestino = L.findIndex((l, n) => n > iFim && l.trim() === "// 4. Parser IA");

if (iCabec < 1 || iFim < 0 || iDestino < 0) throw new Error("âncoras não encontradas");
if (!(iCabec < iFim && iFim < iDestino)) throw new Error("ordem das âncoras inesperada");

const antes = L.slice(0, iCabec);
const ramo = L.slice(iCabec, iFim); // o ramo experimental inteiro
const meio = L.slice(iFim, iDestino); // roteadores + classificador
const depois = L.slice(iDestino);

// Sanidade: o bloco movido tem de ser o ramo, e nada além dele.
if (!ramo.some((l) => l.includes("if (ehFamiliaExperimental(family.id))")))
  throw new Error("o bloco recortado não contém o ramo experimental");
if (meio.some((l) => l.includes("if (ehFamiliaExperimental(family.id))")))
  throw new Error("o ramo apareceu no meio — recorte errado");

const NOTA = [
  "  // ⚠️ 15/08/2026 · C2 — O EXPERIMENTAL DESCEU PARA CÁ.",
  "  //",
  "  // Ele era a PRIMEIRA porta depois do gate de assinatura, e o `return` dele",
  "  // pulava tudo o que vem acima: fim de semana, escolha de criança, rotina",
  "  // (ver/editar/conduzir), Cartões e o \"sim\" curto do Kolo Vivo. Uma família",
  "  // da allowlist que pedisse a rotina de terça não recebia a rotina —",
  "  // recebia uma resposta conversacional SOBRE rotina. A capacidade existia e",
  "  // não era alcançada.",
  "  //",
  "  // Descer resolve sem duplicar nada: os roteadores já se auto-excluem por",
  "  // `if` e já encerram o turno com `return`. O experimental passa a ser o que",
  "  // sempre foi na intenção — quem responde quando NENHUMA intenção",
  "  // especializada casou.",
  "  //",
  "  // ⚠️ O QUE ELE GANHA AQUI: `turnoClassificado` já existe neste ponto, com",
  "  // intenção, tema, aceite e skills. Um dono só para a decisão, e é o mesmo",
  "  // objeto que a recuperação de Boas Práticas consome logo abaixo — então",
  "  // religar o acervo ao caminho novo não custa classificação nova.",
  "  //",
  "  // ⚠️ O QUE ELE PASSA A PAGAR: `classificarIntencao`, MEDIDO em 849 ms de",
  "  // p50 (bancada de 15/08). Continua sem `parseInbound` (2.659 ms de p50),",
  "  // que segue abaixo — então o turno experimental continua mais rápido que o",
  "  // Legacy, que paga os dois. Era a decisão C2, com esses números na mesa.",
  "",
];

const novo = [...antes, ...meio, ...NOTA, ...ramo, ...depois];
writeFileSync(P, novo.join("\n"), "utf8");

// ── PROVAS ────────────────────────────────────────────────────────────────
const semNota = novo.filter((l, n) => !(n >= antes.length + meio.length && n < antes.length + meio.length + NOTA.length));
const ordenado = (a) => [...a].sort().join("\n");
const pos = (arr, s) => arr.findIndex((l) => l.includes(s));

const iExpNovo = pos(novo, "if (ehFamiliaExperimental(family.id))");
const ck = [
  ["nada se perdeu (linhas + notas)", semNota.length === L.length],
  ["multiconjunto idêntico — nada sumiu nem duplicou", ordenado(semNota) === ordenado(L)],
  ["o ramo chegou inteiro e contíguo", novo.slice(iExpNovo - ramo.indexOf(ramo.find((l) => l.includes("if (ehFamiliaExperimental"))), iExpNovo - ramo.indexOf(ramo.find((l) => l.includes("if (ehFamiliaExperimental"))) + ramo.length).join("\n") === ramo.join("\n")],
  ["o ramo aparece UMA vez", novo.filter((l) => l.includes("if (ehFamiliaExperimental(family.id))")).length === 1],
  ["classificador vem ANTES do experimental", pos(novo, "const turnoClassificado = rotinaConversa") < iExpNovo],
  ["fim de semana vem ANTES", pos(novo, "// 3a. Resposta à oferta de fim de semana") < iExpNovo],
  ["escolher criança vem ANTES", pos(novo, "// 3b-crianca. A Ayla pediu") < iExpNovo],
  ["rotina ver/editar/conduzir vêm ANTES", ["// 3c-rotina-ver.", "// 3c-rotina-editar.", "// 3c-rotina. Fluxo CONDUZIDO"].every((s) => pos(novo, s) < iExpNovo)],
  ['"sim" curto vem ANTES', pos(novo, '// 3b. "Sim" curto') < iExpNovo],
  ["acesso continua ANTES de tudo", pos(novo, "if (pedeAcessoAoApp(inbound.texto))") < pos(novo, "// 3a. Resposta à oferta de fim de semana")],
  ["gate de assinatura continua no topo", pos(novo, "// 2b. ASSINATURA (GATE)") < pos(novo, "if (pedeAcessoAoApp(inbound.texto))")],
  ["parser continua DEPOIS do experimental", iExpNovo < novo.findIndex((l, n) => n > iExpNovo && l.trim() === "// 4. Parser IA")],
];

console.log("linhas:", L.length, "→", novo.length, `(+${novo.length - L.length} = só a nota)`);
console.log("bloco movido:", ramo.length, "linhas");
console.log("");
for (const [r, o] of ck) console.log(` ${o ? "OK " : "FALHOU "} ${r}`);
if (ck.some(([, o]) => !o)) process.exit(1);
