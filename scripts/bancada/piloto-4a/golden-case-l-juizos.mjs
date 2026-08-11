/**
 * GOLDEN CASE L — os 6 juízos individuais que voltaram vazios.
 *
 * ⚠️ REAPROVEITA as gerações de `docs/bancada/golden-case-l-2026-08-11.txt`.
 * NADA é gerado de novo — a bancada custou 13 chamadas e as respostas do Plano
 * são as mesmas, byte a byte.
 *
 * Causa do vazio na primeira tentativa: `maxTokens: 700` num modelo de
 * raciocínio — o orçamento acabava antes da saída. A comparação final, com
 * 1.200, funcionou. Aqui vão 2.000.
 *
 * CEGO DE VERDADE: o juiz recebe a boa prática e UMA proposta. Não recebe o
 * perfil, não sabe o braço, não vê as outras. Como rebaixamento e invenção
 * exigem o perfil como gabarito, peço ao juiz o que a proposta PRESSUPÕE sobre
 * a criança — e a comparação com os perfis reais é feita fora, sem modelo.
 */
import { mod, linha, caixa } from "./comum.mjs";
import { readFileSync, writeFileSync } from "node:fs";

const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const MODELO = MODELO_CONVERSA.openai;
const out = [];
const w = (s) => { out.push(s); console.log(s); };

const BP_CONVERSA =
  "Brincadeira de papéis — médico, professora, garçom, vendedora — é treino de vida social embalado em ficção. Você entra como personagem ('sou o médico, deixa eu ouvir seu coração'), criança imita, depois deixa ela liderar e você responde. Sem dirigir muito ('agora você diz X'). Solta a improvisação dela. Cada papel é experimentação de tom de voz, vocabulário específico, gesto, hierarquia, cuidado. Estendido ao longo dos anos, esse tipo de brincadeira constrói capacidade de assumir perspectiva alheia, que é base de empatia adulta. Não tem brinquedo educativo que substitui — só a invenção compartilhada com tempo livre faz esse trabalho.";
const OBJETIVO = "Iniciar e sustentar pequenas interações sociais com outras pessoas.";

// ── as 6 gerações, extraídas do laudo salvo ──────────────────────────────
const bruto = readFileSync("docs/bancada/golden-case-l-2026-08-11.txt", "utf8");
const GERACOES = [];
for (const bloco of bruto.split(/█{20,}/)) {
  const cab = bloco.match(/^\s*([ABC] · [^\n·]+) · execução (\d)/m);
  if (!cab) continue;
  const corpo = bloco.split("\n").filter((l) => /^\s*│/.test(l)).map((l) => l.replace(/^\s*│ ?/, "")).join("\n").trim();
  if (corpo) GERACOES.push({ rotulo: cab[1].trim(), exec: Number(cab[2]), texto: corpo });
}
if (GERACOES.length !== 6) throw new Error(`esperava 6 gerações, achei ${GERACOES.length}`);
w(`reaproveitadas ${GERACOES.length} gerações do laudo — nenhuma foi refeita\n`);

const SYS = `Você avalia se uma proposta de intervenção GENERALIZOU o mecanismo de uma boa prática, ou apenas a copiou/decorou.

Você recebe a BOA PRÁTICA original, o OBJETIVO e UMA proposta. Não conhece o perfil da criança nem outras propostas. Julgue apenas o que está diante de você.

Responda EXATAMENTE neste formato, uma linha por campo:

HABILIDADE_ALVO: <qual habilidade a proposta trabalha, em até 12 palavras>
RELACAO_COM_O_OBJETIVO: SIM|NAO — <a habilidade acima serve ao objetivo declarado?>
MECANISMOS_DA_BP_PRESERVADOS: <liste SÓ os que realmente aparecem na proposta — assumir papel/perspectiva, motivo real para falar, iniciar, responder, manter a troca, experimentar tom/vocabulário/gesto, reagir ao outro, reciprocidade, criança lidera. Não é checklist: só o que existe>
COMO_FUNCIONA_NA_PRATICA: <em até 25 palavras, o que acontece de fato entre adulto e criança>
GENERALIZACAO: SIM|NAO — <o princípio foi abstraído e reaplicado, ou a atividade original foi copiada?>
DECORACAO: <o que mudou que é só personagem, objeto, cenário ou tema visual, sem efeito funcional — ou "nada">
PRESSUPOE_SOBRE_A_CRIANCA: <o que a proposta ASSUME sobre interesses, nível de fala, autonomia ou sensibilidades — liste os pressupostos, mesmo os implícitos>
NIVEL_EXIGIDO: <o nível de comunicação que a proposta exige da criança: pré-verbal | palavras soltas | frases | conversa>
VEREDITO: PASS_FORTE|PASS_PARCIAL|FAIL
JUSTIFICATIVA: <uma frase semântica, sem repetir os campos acima>

Rigoroso. Na dúvida entre PASS_FORTE e PASS_PARCIAL, escolha PASS_PARCIAL.
PASS_FORTE exige que a FORMA da interação sirva ao objetivo, não só o assunto dela.`;

const notas = [];
for (const g of GERACOES) {
  const user = `BOA PRÁTICA ORIGINAL:\n"""\n${BP_CONVERSA}\n"""\n\nOBJETIVO: "${OBJETIVO}"\n\nPROPOSTA A AVALIAR:\n"""\n${g.texto}\n"""`;
  const j = await gerarConversacional({
    provider: "openai", model: MODELO, system: SYS,
    messages: [{ role: "user", content: user }], maxTokens: 2000, cacheSystem: true,
  });
  const t = j.texto.trim();
  notas.push({ ...g, juizo: t });
  w(`\n${linha()}\n${g.rotulo} · execução ${g.exec}  (o juiz não sabe disto)\n`);
  w(caixa(t || "*** VAZIO DE NOVO ***"));
}

const campo = (t, k) => {
  const m = t.match(new RegExp(`^${k}:\s*(.+)$`, "m"));
  return m ? m[1].trim() : "?";
};

w(`\n\n${linha()}\nPLACAR DOS JUÍZOS INDIVIDUAIS\n`);
w("braço".padEnd(32) + "ex  " + "generaliz".padEnd(11) + "objetivo".padEnd(10) + "nível exigido".padEnd(16) + "veredito");
for (const n of notas) {
  w(n.rotulo.padEnd(32) + n.exec + "   " +
    campo(n.juizo, "GENERALIZACAO").split(" ")[0].padEnd(11) +
    campo(n.juizo, "RELACAO_COM_O_OBJETIVO").split(" ")[0].padEnd(10) +
    campo(n.juizo, "NIVEL_EXIGIDO").slice(0, 15).padEnd(16) +
    campo(n.juizo, "VEREDITO"));
}
w(`\n── DECORAÇÃO apontada por braço ──`);
for (const n of notas) w(`  ${n.rotulo} #${n.exec}: ${campo(n.juizo, "DECORACAO")}`);
w(`\n── PRESSUPOSTOS (comparo com os perfis reais fora do modelo) ──`);
for (const n of notas) w(`  ${n.rotulo} #${n.exec}: ${campo(n.juizo, "PRESSUPOE_SOBRE_A_CRIANCA")}`);
w(`\n── MECANISMOS PRESERVADOS ──`);
for (const n of notas) w(`  ${n.rotulo} #${n.exec}: ${campo(n.juizo, "MECANISMOS_DA_BP_PRESERVADOS")}`);
w(`\n── COMO FUNCIONA NA PRÁTICA ──`);
for (const n of notas) w(`  ${n.rotulo} #${n.exec}: ${campo(n.juizo, "COMO_FUNCIONA_NA_PRATICA")}`);

writeFileSync(`${process.cwd()}/docs/bancada/golden-case-l-juizos-2026-08-11.txt`, out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/golden-case-l-juizos-2026-08-11.txt");
