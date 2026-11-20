/**
 * BANCADA MEMÓRIA × RESPOSTAS — geração.
 *
 * Roda o CAMINHO OFICIAL (`responderExperimental`) com famílias sintéticas num
 * banco em memória. Nada é escrito em banco real, nada sai pelo WhatsApp: as
 * chaves de banco são apagadas do ambiente antes de qualquer import do app, e
 * a rede só alcança os dois endpoints de modelo (ver guarda.mjs).
 *
 *   VERSAO=v0 SPLIT=dev REPS=3 CORE_ARQUIVO=/backup/core-v12-ativo.md node rodar.mjs
 *
 * Limitação declarada: o acervo de Boas Práticas e o catálogo de skills vivem
 * só no banco de produção, sem acesso nesta bancada. A classificação é fixada
 * por caso e o repertório sai vazio — IGUAL em todas as versões, então a
 * comparação entre versões continua válida; a nota absoluta não é a da produção.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createHash } from "node:crypto";
import { registerHooks } from "node:module";
import { MON, log, Parada, instalarFetch, ultima, gastoAtual } from "./guarda.mjs";
import { CASOS } from "./casos.mjs";
import { atualizarPainel } from "./painel.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, "../../..");
const SRC = resolve(RAIZ, "apps/web/src");
const sha = (s) => createHash("sha256").update(s).digest("hex");

for (const l of readFileSync(resolve(RAIZ, "apps/web/.env.local"), "utf8").split("\n")) {
  const m = l.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
}
for (const k of Object.keys(process.env)) if (/SUPABASE|ZAPI|STRIPE|RESEND|CRON/i.test(k)) delete process.env[k];
process.env.AYLA_EXPERIMENTAL_TODAS = "true";

const VERSAO = process.env.VERSAO ?? "v0";
const SPLIT = process.env.SPLIT ?? "dev";
const REPS = Number(process.env.REPS ?? 3);
const SO = process.env.CASOS ? process.env.CASOS.split(",") : null;
const coreTexto = readFileSync(process.env.CORE_ARQUIVO ?? "/backup/core-v12-ativo.md", "utf8");
const core = { conteudo: coreTexto, versao: Number(process.env.CORE_VERSAO ?? 12) };

registerHooks({
  resolve(e, c, n) {
    if (e.startsWith("@/")) return n(pathToFileURL(resolve(SRC, e.slice(2) + ".ts")).href, c);
    if (e.startsWith(".") && !/\.[a-z]+$/.test(e)) {
      try { return n(e + ".ts", c); } catch {}
    }
    if (["next/headers", "next/cache", "server-only"].includes(e))
      return { url: pathToFileURL(resolve(RAIZ, "scripts/bancada/core-v9-vs-v2/stub-next.mjs")).href, shortCircuit: true };
    return n(e, c);
  },
});
const mod = (p) => import(pathToFileURL(resolve(SRC, p)).href);
const { responderExperimental } = await mod("lib/ayla/experimental.ts");
const { montarMundo } = await mod("lib/ayla/__harness/cenario.ts");
instalarFetch();

const diasAtras = (d) => new Date(Date.now() - d * 864e5).toISOString();

function semear(caso) {
  const mundo = montarMundo({
    nomeMae: caso.mae,
    criancas: caso.criancas.map((c) => ({ nome: c.nome, nascimento: c.nascimento, genero: c.genero, sabe: c.sabe, extras: c.extras })),
  });
  for (const c of caso.criancas) {
    const id = mundo.membros[c.nome];
    const m = mundo.db.linhas("membros_atipicos").find((x) => x.id === id);
    m.perfil = c.perfil || null;
    m.diagnosticos_formais = c.perfil ? [c.perfil] : [];
    const pv = mundo.db.linhas("perfil_vivo_membro").find((x) => x.membro_atipico_id === id);
    if (pv) {
      const quando = diasAtras(c.pvDiasAtras ?? 30);
      pv.created_at = quando;
      pv.updated_at = quando;
      for (const v of Object.values(pv.categorias_extras ?? {}))
        if (v && typeof v === "object" && "atualizado_em" in v && !v.atualizado_em) v.atualizado_em = quando;
    }
  }
  const primeiro = mundo.membros[caso.criancas[0].nome];
  mundo.db.semear(
    "ayla_messages",
    (caso.historico ?? []).map((h, i) => ({
      family_account_id: mundo.familyId,
      direcao: h.direcao,
      texto: h.texto,
      tipo: h.direcao === "inbound" ? "texto" : "conversa",
      membro_atipico_id: primeiro,
      metadata: null,
      // segundos de diferença preservam a ordem dentro do mesmo dia
      created_at: new Date(Date.now() - h.diasAtras * 864e5 + i * 1000).toISOString(),
    })),
  );
  return mundo;
}

function trecho(sistema, tag) {
  const m = sistema.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
  return m ? m[1].trim() : null;
}
function sistemaDe(corpo) {
  if (!corpo) return "";
  if (typeof corpo.system === "string") return corpo.system;
  if (Array.isArray(corpo.system)) return corpo.system.map((b) => b.text ?? "").join("\n");
  const s = (corpo.messages ?? []).filter((m) => m.role === "system" || m.role === "developer");
  return s.map((m) => (typeof m.content === "string" ? m.content : (m.content ?? []).map((b) => b.text ?? "").join("\n"))).join("\n");
}

const ARQ = resolve(MON, "resultados", `${VERSAO}.json`);
const saida = existsSync(ARQ)
  ? JSON.parse(readFileSync(ARQ, "utf8"))
  : { versao: VERSAO, coreSha: sha(core.conteudo), coreVersao: core.versao, inicio: new Date().toISOString(), resultados: [] };
const feito = new Set(saida.resultados.map((r) => `${r.caso}#${r.rep}#${r.turno}`));
const salvar = () => writeFileSync(ARQ, JSON.stringify(saida, null, 2));

const casos = CASOS.filter((c) => (SPLIT === "todos" || c.split === SPLIT) && (!SO || SO.includes(c.id)));
log(`INÍCIO geração ${VERSAO} · ${casos.length} casos (${SPLIT}) × ${REPS} repetições · Core v${core.versao} sha ${sha(core.conteudo).slice(0, 12)}`);

try {
  for (const caso of casos) {
    for (let rep = 1; rep <= REPS; rep++) {
      if (caso.turnos.every((_, t) => feito.has(`${caso.id}#${rep}#${t + 1}`))) continue;
      const mundo = semear(caso);
      const hist = [];
      for (let t = 0; t < caso.turnos.length; t++) {
        const msg = caso.turnos[t];
        const t0 = Date.now();
        let r = null, falha = null;
        const custo0 = gastoAtual();
        try {
          r = await responderExperimental(mundo.db, {
            familyId: mundo.familyId,
            mensagem: msg,
            rascunhoCore: core,
            origem: "simulador",
            turnosSimulados: hist.slice(),
            turnoClassificado: { intencao: "outro", tema: caso.skill, aceite: null, skills: [caso.skill], skillsAvaliadas: true },
            onFalha: (motivo, detalhe) => (falha = `${motivo}: ${String(detalhe).slice(0, 200)}`),
          });
        } catch (e) {
          if (e instanceof Parada) throw e;
          falha = `EXCECAO: ${e?.message ?? e}`;
        }
        const g = gastoAtual();
        const sistema = sistemaDe(ultima.corpo);
        const texto = r?.texto ?? "";
        hist.push({ quem: "mae", texto: msg }, { quem: "ayla", texto });
        saida.resultados.push({
          caso: caso.id, rep, turno: t + 1, split: caso.split, categoria: caso.categoria,
          mensagem: msg, texto, falha,
          ms: Date.now() - t0,
          custo: g.openai + g.anthropic - (custo0.openai + custo0.anthropic),
          metrica: r?.metrica
            ? { modelo: r.metrica.modelo, tokensEntrada: r.metrica.tokensEntrada, tokensSaida: r.metrica.tokensSaida, msModelo: r.metrica.msModelo, chamadasLLM: r.metrica.chamadasLLM, coreOrigem: r.metrica.coreOrigem, natureza: r.metrica.natureza }
            : null,
          contexto: { sabemos: trecho(sistema, "o_que_ja_sabemos"), conversa: trecho(sistema, "conversa_recente"), sistemaSha: sha(sistema).slice(0, 16), sistemaChars: sistema.length },
        });
        feito.add(`${caso.id}#${rep}#${t + 1}`);
        salvar();
        log(`${VERSAO} ${caso.id} rep ${rep} turno ${t + 1} · ${falha ? "FALHA " + falha : texto.length + " car."} · ${((Date.now() - t0) / 1000).toFixed(1)}s · gasto OpenAI US$ ${g.openai.toFixed(3)} / Anthropic US$ ${g.anthropic.toFixed(3)}`);
      }
    }
    atualizarPainel();
  }
  saida.fim = new Date().toISOString();
  salvar();
  log(`FIM geração ${VERSAO}: ${saida.resultados.length} respostas.`);
} catch (e) {
  salvar();
  log(`PARADA: ${e.message}`);
  process.exitCode = 2;
} finally {
  atualizarPainel();
}
