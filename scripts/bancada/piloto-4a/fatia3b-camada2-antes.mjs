/**
 * O JUÍZO QUE FALTOU — o documento ANTES.
 *
 * Na execução de 11/08 o juiz do plano ANTES devolveu texto VAZIO (o mesmo modo
 * de falha do Golden Case L: modelo de raciocínio com teto de tokens curto para
 * a resposta pedida). O placar imprimiu `0` em todas as medidas de repetição do
 * ANTES — e `0 → 6` seria a leitura mais enganosa possível deste experimento:
 * pareceria que a 3b criou a repetição do nada, quando o braço de comparação
 * simplesmente não foi medido.
 *
 * O plano ANTES não é gerado de novo: ele é lido do arquivo salvo. Uma chamada.
 *
 *   node scripts/bancada/piloto-4a/fatia3b-camada2-antes.mjs
 */
import { mod, linha, caixa } from "./comum.mjs";
import { readFileSync, writeFileSync, appendFileSync } from "node:fs";

const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const ARQ = "docs/bancada/fatia3b-camada2-2026-08-11.txt";
const salvo = readFileSync(ARQ, "utf8");

// O documento ANTES, entre o cabeçalho do plano ANTES e o do plano DEPOIS.
const i = salvo.indexOf("PLANO ANTES ·");
const j = salvo.indexOf("PLANO DEPOIS ·");
if (i < 0 || j < 0) throw new Error("não achei os dois planos no arquivo salvo");
const bruto = salvo.slice(i, j);
const doc = bruto
  .split("\n")
  .filter((l) => l.startsWith("  │") || l.startsWith("### "))
  .map((l) => (l.startsWith("### ") ? `\n## ${l.slice(4)}` : l.replace(/^ {2}│ ?/, "")))
  .join("\n")
  .trim();
console.log(`documento ANTES recuperado: ${doc.length} caracteres`);

const SYS_DOC = readFileSync("scripts/bancada/piloto-4a/fatia3b-camada2.mjs", "utf8")
  .split("const SYS_DOC = `")[1]
  .split("`;")[0];

const PERFIL =
  "Bia, 5 anos. INTERESSES: brincar de mercadinho, caixa registradora, organizar as coisas.\n" +
  "Iniciativa e reciprocidade: Fala com adultos conhecidos. Com crianças da idade dela, fica em silêncio.\n" +
  "Como se comunica: Fala frases\nConversa e argumentação: Mantém o vai-e-vem com adulto conhecido.\n" +
  "Perfil sensorial: Misto\nReação a sons: não\nLuz: não\nTexturas (roupas, objetos): Evita etiquetas.";
const DESAFIO =
  "Bia quase não fala com as crianças da escola. Quero ajudar ela a iniciar e " +
  "sustentar pequenas interações sociais com outras pessoas.";

const r = await gerarConversacional({
  provider: "openai", model: MODELO_CONVERSA.openai, system: SYS_DOC,
  messages: [{
    role: "user",
    content: `PERFIL DA CRIANÇA (o que se sabe):\n${PERFIL}\n\nO QUE A MÃE PEDIU: "${DESAFIO}"\n\nPLANO A AVALIAR:\n"""\n${doc}\n"""`,
  }],
  // 4000, e não 2500: o teto curto foi a causa do vazio.
  maxTokens: 4000, cacheSystem: true,
});

const texto = r.texto.trim();
if (!texto) throw new Error("veio vazio DE NOVO — não concluir nada deste braço");
console.log(`\n${linha()}\nJUÍZO DO DOCUMENTO · ANTES (refeito)\n`);
console.log(caixa(texto));
appendFileSync(ARQ, `\n\n${linha()}\nJUÍZO DO DOCUMENTO · ANTES (refeito, maxTokens 4000)\n\n${caixa(texto)}\n`, "utf8");
writeFileSync("docs/bancada/fatia3b-camada2-antes-2026-08-11.txt", texto, "utf8");
