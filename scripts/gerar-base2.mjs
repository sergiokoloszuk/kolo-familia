/**
 * GERADOR DA BASE 2 · PERGUNTAS E ORIENTAÇÕES POR TEMA.
 *
 * Lê `docs/skills/*.md` e escreve um módulo TypeScript com as seções já
 * separadas. Roda em build/manutenção — **nunca em turno de conversa**.
 *
 * POR QUE GERAR EM VEZ DE LER EM RUNTIME: os `.md` vivem em `docs/`, fora de
 * `apps/web`. Ler o disco em produção depende de o bundle carregar arquivos de
 * fora do app — coisa que a Vercel não garante, e que falharia em silêncio no
 * pior lugar possível. Um módulo gerado é importado como qualquer outro código:
 * existe no deploy, custa zero I/O e zero latência por turno.
 *
 * NÃO reescreve, resume ou reformata o conteúdo. Recorta pelos títulos que o
 * material já tem e preserva o texto VERBATIM, como o cabeçalho dos arquivos
 * exige.
 *
 *   node scripts/gerar-base2.mjs
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const RAIZ = resolve(import.meta.dirname, "..");
const ORIGEM = join(RAIZ, "docs", "skills");
const DESTINO = join(RAIZ, "apps", "web", "src", "lib", "conducao", "base2-conteudo.ts");

/**
 * A que estado da conversa cada seção serve.
 *
 * `investigacao` — ajuda a COMPREENDER antes de orientar.
 * `intervencao`  — ajuda a CONDUZIR depois de compreender.
 * `contexto`     — vale nos dois (missão, limites, idade).
 *
 * O mapa é por título real do material. Título desconhecido cai em `contexto`,
 * que é o default inócuo: aparece só quando pedido explicitamente.
 */
const ESTADO_POR_SECAO = [
  [/^TRIAGEM/, "investigacao"],
  [/^PERGUNTA DE ALTO VALOR/, "investigacao"],
  [/^ANTES DE ORIENTAR/, "investigacao"],
  [/MAPA DE RACIOCÍNIO/, "investigacao"],
  [/^PRINCÍPIO CENTRAL/, "investigacao"],
  [/^REGRA DE CONDUÇÃO|^REGRA CENTRAL/, "investigacao"],
  [/^RESPOSTA QUANDO FALTA/, "investigacao"],
  [/^ATIVIDADES/, "intervencao"],
  [/^FRASES/, "intervencao"],
  [/^ERROS COMUNS/, "intervencao"],
  [/^O QUE OBSERVAR/, "intervencao"],
  [/^PROGRESSÃO/, "intervencao"],
  [/^USO DE INTERESSES/, "intervencao"],
  [/^RESPOSTA QUANDO HÁ INFORMAÇÃO SUFICIENTE/, "intervencao"],
];

const estadoDe = (titulo) =>
  ESTADO_POR_SECAO.find(([re]) => re.test(titulo))?.[1] ?? "contexto";

/** "LEITURA — MAPA DE RACIOCÍNIO" → subtema "leitura". */
function subtemaDe(titulo) {
  const m = titulo.match(/^(.+?)\s+—\s+MAPA DE RACIOCÍNIO$/);
  return m ? m[1].trim().toLowerCase() : null;
}

const slug = (s) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * TÍTULO EM LINHA MAIÚSCULA, sem `#`.
 *
 * `nutricional.md` é o único que não usa markdown nos títulos: escreve
 * `MISSÃO`, `PRINCÍPIO CENTRAL` em linha própria, tudo em caixa alta. Sem este
 * reconhecimento o arquivo inteiro saía com ZERO seções — foi o que aconteceu
 * na primeira geração. O conteúdo não tem culpa do formato.
 *
 * Conservador de propósito: linha curta, inteiramente em caixa alta, sem
 * pontuação final e cercada por linha em branco. Frase de conteúdo não passa.
 */
const TITULO_CAIXA = /^[A-ZÀ-Ú0-9][A-ZÀ-Ú0-9 ,/—()-]{3,60}$/;

function ehTituloCaixa(linha, anterior, proxima) {
  const t = linha.trim();
  if (!TITULO_CAIXA.test(t)) return false;
  if (/[.:;?!]$/.test(t)) return false;
  return anterior.trim() === "" && proxima.trim() === "";
}

function parsear(tema, texto) {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  // Só cai no formato caixa-alta quem não usa markdown — assim um arquivo
  // bem formatado nunca corre o risco de ganhar seções fantasma.
  const temMarkdown = linhas.some((l) => /^#\s+\S/.test(l));
  const secoes = [];
  let atual = null;

  const fechar = () => {
    if (!atual) return;
    const conteudo = atual.buf.join("\n").trim();
    // Seção sem corpo é só um título; não vira entrada.
    if (conteudo) secoes.push({ ...atual, conteudo, buf: undefined });
    atual = null;
  };

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const h1 = linha.match(/^#\s+(.+?)\s*$/);
    const h2 = linha.match(/^##\s+(.+?)\s*$/);
    const caixa =
      !temMarkdown && ehTituloCaixa(linha, linhas[i - 1] ?? "", linhas[i + 1] ?? "")
        ? [null, linha.trim()]
        : null;
    if (h1 || h2 || caixa) {
      const titulo = (h1 ?? h2 ?? caixa)[1].trim();
      const nivel1 = Boolean(h1 || caixa);
      // A CAMADA 1 já está no banco (`specialist_prompt_templates`). Repeti-la
      // aqui criaria duas fontes para a mesma coisa.
      if (/^CAMADA 1/i.test(titulo)) {
        fechar();
        atual = null;
        break;
      }
      const pai = h2 && secoes.length ? (secoes.at(-1)?.secao ?? null) : null;
      fechar();
      atual = {
        id: `${tema}/${slug(titulo)}`,
        tema,
        secao: nivel1 ? titulo : (pai ?? titulo),
        titulo,
        nivel: nivel1 ? 1 : 2,
        subtema: subtemaDe(titulo),
        estado: estadoDe(nivel1 ? titulo : (pai ?? titulo)),
        buf: [],
      };
      continue;
    }
    if (atual) atual.buf.push(linha);
  }
  fechar();
  return secoes;
}

/**
 * SÓ DOCUMENTO CANÔNICO ENTRA — e o critério é uma lista, não uma heurística.
 *
 * Duas tentativas mais espertas falharam, cada uma por um motivo que vale
 * guardar. Procurar a marca "FONTE CANÔNICA" em qualquer lugar do texto pegou
 * o próprio guia de escrita, que cita a marca dentro do esqueleto de exemplo.
 * Exigi-la na primeira linha derrubou `imitacao.md`, que começa direto no
 * título — os documentos também não são uniformes no cabeçalho.
 *
 * Uma lista de exceções é menos elegante e mais honesta: quem fica de fora é
 * decisão explícita, e todo arquivo novo em `docs/skills/` é skill até que
 * alguém diga o contrário.
 */
const NAO_SAO_SKILL = new Set(["README.md", "COMO-ESCREVER.md"]);

const arquivos = readdirSync(ORIGEM)
  .filter((f) => f.endsWith(".md"))
  .filter((f) => !NAO_SAO_SKILL.has(f))
  .sort();

const todas = [];
for (const f of arquivos) {
  const tema = f.replace(/\.md$/, "");
  todas.push(...parsear(tema, readFileSync(join(ORIGEM, f), "utf8")));
}

const corpo = `// GERADO POR scripts/gerar-base2.mjs — NÃO EDITAR À MÃO.
// Fonte: docs/skills/*.md (conteúdo editorial aprovado, VERBATIM).
// Para atualizar: edite o .md e rode \`node scripts/gerar-base2.mjs\`.
// O teste \`base2.test.ts\` falha se este arquivo ficar defasado.

export type EstadoConversa = "investigacao" | "intervencao" | "contexto";

export type SecaoBase2 = {
  /** Identificador estável: \`tema/slug-do-titulo\`. */
  id: string;
  tema: string;
  /** Título da seção de nível 1 a que este trecho pertence. */
  secao: string;
  /** O título deste trecho (igual a \`secao\` quando é nível 1). */
  titulo: string;
  nivel: 1 | 2;
  /** "leitura" em "LEITURA — MAPA DE RACIOCÍNIO"; null quando não há. */
  subtema: string | null;
  estado: EstadoConversa;
  conteudo: string;
};

export const BASE2: readonly SecaoBase2[] = ${JSON.stringify(todas, null, 2)} as const;
`;

writeFileSync(DESTINO, corpo, "utf8");

const porTema = {};
for (const s of todas) porTema[s.tema] = (porTema[s.tema] ?? 0) + 1;
console.log(`BASE 2 gerada: ${todas.length} seções de ${arquivos.length} temas`);
for (const [t, n] of Object.entries(porTema)) console.log(`  ${t.padEnd(16)} ${n}`);
console.log(`\n→ ${DESTINO}`);
