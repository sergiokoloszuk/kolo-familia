/**
 * VERIFICAÇÃO DE PROTEÇÃO CONTRA PERDA DE TRABALHO — somente leitura.
 *
 * Rodar ANTES de encerrar sessão, trocar de máquina, ou qualquer operação de
 * risco (cherry-pick, reset, rebase, limpeza de working tree, exclusão de
 * arquivo, tirar o projeto do Google Drive).
 *
 * ── o que ela responde ────────────────────────────────────────────────────
 *
 *   1. commits locais ainda não enviados
 *   2. branches com commits que não existem em remoto nenhum
 *   3. arquivos não rastreados e modificados
 *   4. arquivos relevantes que só existem aqui (por CONTEÚDO, não por nome)
 *   5. stashes, e se o conteúdo deles tem cópia remota
 *   6. main local × origin/main × main NO SERVIDOR
 *   7. migrations não versionadas em remoto, e divergência com o registro
 *      de aplicadas
 *
 * ── por que ela existe ────────────────────────────────────────────────────
 *
 * Em 21/08/2026 uma varredura achou 105 commits e 17 arquivos únicos que só
 * existiam num computador e no Google Drive — entre eles a migração da Fase 3
 * e o documento de condução do teste VIGENTE em produção. Duas migrações já
 * aplicadas em produção (0080, 0081) não tinham cópia remota nenhuma.
 *
 * ── garantia de que não estraga nada ──────────────────────────────────────
 *
 * Só executa: status · log · rev-list · rev-parse · for-each-ref · stash list
 * · ls-remote · cat-file --batch-check · hash-object SEM `-w`.
 * NÃO faz commit, push, fetch, checkout, reset nem apaga arquivo.
 * `ls-remote` consulta o servidor sem escrever nada em .git.
 *
 * ⚠️ NÃO faz `fetch` de propósito: fetch escreve em refs/remotes. Por isso as
 * comparações contra `origin/*` usam refs possivelmente DESATUALIZADOS — e é
 * exatamente por isso que a main é conferida também por `ls-remote`, que fala
 * com o servidor de verdade.
 *
 * Uso:  node scripts/protecao-verificar.mjs
 *       node scripts/protecao-verificar.mjs --sem-rede    (pula o ls-remote)
 *
 * Saída: 0 = nada em risco · 1 = há trabalho só local · 2 = erro na checagem.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const SEM_REDE = process.argv.includes("--sem-rede");

/** Registro opcional de migrations aplicadas em produção, uma por linha. */
const LEDGER = "supabase/migrations/APLICADAS.txt";

const git = (...args) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const linhas = (s) => s.split(/\r?\n/).filter((l) => l.trim() !== "");

/* ── acumuladores do veredito ────────────────────────────────────────────── */
const riscos = [];
const naoSei = [];
const t = (n) => (n === 1 ? "" : "s");

console.log("═".repeat(78));
console.log("VERIFICAÇÃO DE PROTEÇÃO CONTRA PERDA DE TRABALHO — somente leitura");
console.log("═".repeat(78));

const branchAtual = git("rev-parse", "--abbrev-ref", "HEAD").trim();
console.log(`branch atual: ${branchAtual}`);
if (SEM_REDE) console.log("modo --sem-rede: o servidor NÃO será consultado");

/* ── 1. commits locais ainda não enviados ────────────────────────────────── */
console.log("\n── 1. COMMITS LOCAIS AINDA NÃO ENVIADOS " + "─".repeat(38));

const soLocais = linhas(git("log", "--branches", "--not", "--remotes", "--oneline"));
if (soLocais.length === 0) {
  console.log("MEDI: 0 commits. Todo commit local existe em algum branch remoto.");
} else {
  console.log(`MEDI: ${soLocais.length} commit${t(soLocais.length)} sem cópia remota.`);
  soLocais.slice(0, 15).forEach((l) => console.log("   " + l));
  if (soLocais.length > 15) console.log(`   … e mais ${soLocais.length - 15}.`);
  riscos.push(`${soLocais.length} commit${t(soLocais.length)} local${soLocais.length === 1 ? "" : "is"} sem cópia remota`);
}

/* ── 2. branches com commits ausentes de todo remoto ─────────────────────── */
console.log("\n── 2. BRANCHES COM COMMITS QUE NÃO ESTÃO EM REMOTO " + "─".repeat(27));

const locais = linhas(git("for-each-ref", "--format=%(refname:short)", "refs/heads"));
const desprotegidos = [];
for (const b of locais) {
  const n = linhas(git("rev-list", b, "--not", "--remotes")).length;
  if (n > 0) desprotegidos.push([n, b]);
}
if (desprotegidos.length === 0) {
  console.log(`MEDI: nenhum. Os ${locais.length} branches locais têm cobertura remota.`);
} else {
  desprotegidos
    .sort((a, b) => b[0] - a[0])
    .forEach(([n, b]) => console.log(`   ${String(n).padStart(4)} commit${t(n)}  ${b}`));
  riscos.push(`${desprotegidos.length} branch${desprotegidos.length === 1 ? "" : "es"} com commit sem cópia remota`);
}

/* ── 3. working tree: não rastreados e modificados ───────────────────────── */
console.log("\n── 3. ARQUIVOS NÃO RASTREADOS E MODIFICADOS " + "─".repeat(34));

const estado = linhas(git("status", "--porcelain", "-uall"));
const arquivos = estado.map((l) => ({ marca: l.slice(0, 2).trim(), caminho: l.slice(3).replace(/^"|"$/g, "") }));
const naoRastreados = arquivos.filter((a) => a.marca === "??");
const modificados = arquivos.filter((a) => a.marca !== "??");

console.log(`MEDI: ${arquivos.length} ${arquivos.length === 1 ? "item" : "itens"} — ${naoRastreados.length} não rastreado${t(naoRastreados.length)}, ${modificados.length} rastreado${t(modificados.length)} modificado${t(modificados.length)}.`);
if (arquivos.length > 0) {
  console.log("   (ignorados pelo .gitignore não entram nesta conta)");
}

/* ── 4. quais desses só existem AQUI, por conteúdo ───────────────────────── */
console.log("\n── 4. ARQUIVOS RELEVANTES APENAS LOCAIS (por conteúdo) " + "─".repeat(23));

const soLocalArquivos = [];
if (arquivos.length === 0) {
  console.log("MEDI: working tree limpo, nada a conferir.");
} else {
  const refs = linhas(git("for-each-ref", "--format=%(refname:short)", "refs/remotes"))
    .filter((r) => !r.endsWith("/HEAD"));

  if (refs.length === 0) {
    naoSei.push("não há refs remotos locais para comparar — rode `git fetch` fora desta checagem");
    console.log("NÃO SEI: nenhum ref remoto conhecido neste clone.");
  } else {
    // hash do conteúdo no disco (SEM -w: não escreve objeto nenhum)
    const meus = new Map();
    for (const a of arquivos) {
      if (!existsSync(a.caminho)) continue; // arquivo deletado no working tree
      meus.set(a.caminho, git("hash-object", "--", a.caminho).trim());
    }

    // uma única passada de cat-file para todas as combinações ref:caminho
    const consultas = [];
    for (const caminho of meus.keys()) for (const r of refs) consultas.push(`${r}:${caminho}`);

    const saida = execFileSync("git", ["cat-file", "--batch-check"], {
      input: consultas.join("\n") + "\n",
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });

    const achadoEm = new Map(); // caminho -> ref que tem blob idêntico
    linhas(saida).forEach((l, i) => {
      const alvo = consultas[i];
      if (!alvo || / missing$/.test(l)) return;
      const sha = l.split(/\s+/)[0];
      const sep = alvo.indexOf(":");
      const ref = alvo.slice(0, sep);
      const caminho = alvo.slice(sep + 1);
      if (meus.get(caminho) === sha && !achadoEm.has(caminho)) achadoEm.set(caminho, ref);
    });

    // Segunda passada, sobre os que não bateram no mesmo caminho: o conteúdo
    // pode estar salvo sob OUTRO NOME. `--find-object` acha o commit que
    // introduziu aquele blob exato. É a diferença entre "perdi o arquivo" e
    // "o arquivo tem outro nome lá" — e a regra 12 exige provar isso ANTES de
    // qualquer limpeza. Caso real: trial-v1.md × trial-v1-base.md.
    const porConteudo = new Map(); // caminho -> "sha do commit | caminho remoto"
    for (const [caminho, sha] of meus) {
      if (achadoEm.has(caminho)) continue;
      let commit = "";
      try {
        commit = git("log", "--remotes", `--find-object=${sha}`, "--format=%H", "-1").trim();
      } catch {
        /* --find-object indisponível nesta versão do git: segue como só local */
      }
      if (!commit) continue;
      let ondeEsta = "";
      try {
        ondeEsta = linhas(git("ls-tree", "-r", "--format=%(objectname) %(path)", commit))
          .find((l) => l.startsWith(sha))
          ?.slice(41) ?? "";
      } catch {
        /* nome exato indisponível; o commit já basta como prova */
      }
      porConteudo.set(caminho, { commit: commit.slice(0, 8), ondeEsta });
    }

    for (const [caminho] of meus) {
      if (achadoEm.has(caminho)) {
        console.log(`   PROTEGIDO  ${caminho}  →  ${achadoEm.get(caminho).replace(/^origin\//, "")}`);
      } else if (porConteudo.has(caminho)) {
        const { commit, ondeEsta } = porConteudo.get(caminho);
        console.log(`   OUTRO NOME ${caminho}`);
        console.log(`              conteúdo idêntico já versionado em ${commit}${ondeEsta ? ` como ${ondeEsta}` : ""}`);
      } else {
        console.log(`   SÓ LOCAL   ${caminho}`);
        soLocalArquivos.push(caminho);
      }
    }
    console.log(`\nMEDI: ${meus.size} conferido${t(meus.size)} — ${achadoEm.size} no mesmo caminho, ${porConteudo.size} sob outro nome, ${soLocalArquivos.length} sem cópia remota alguma.`);
    if (soLocalArquivos.length > 0) {
      riscos.push(`${soLocalArquivos.length} arquivo${t(soLocalArquivos.length)} sem cópia remota`);
    }
    if (porConteudo.size > 0) {
      console.log("   OUTRO NOME não é risco de perda: o conteúdo está salvo. É risco de");
      console.log("   confusão — decidir qual nome vale antes de apagar o duplicado.");
    }
  }
}

/* ── 5. stashes ──────────────────────────────────────────────────────────── */
console.log("\n── 5. STASHES " + "─".repeat(63));

const stashes = linhas(git("stash", "list", "--format=%gd|%H|%gs"));
if (stashes.length === 0) {
  console.log("MEDI: nenhum stash.");
} else {
  for (const s of stashes) {
    const [ref, sha, desc] = s.split("|");
    const contido = linhas(git("branch", "-r", "--contains", sha)).map((x) => x.trim());
    if (contido.length > 0) {
      console.log(`   PROTEGIDO  ${ref}  →  ${contido[0]}`);
    } else {
      console.log(`   SÓ LOCAL   ${ref}  ${desc}`);
      riscos.push(`stash ${ref} sem cópia remota`);
    }
  }
  console.log("\n   Stash NÃO é backup. Conteúdo que importa vira commit em branch.");
}

/* ── 6. main local × origin/main × servidor ──────────────────────────────── */
console.log("\n── 6. MAIN " + "─".repeat(66));

const mainLocal = git("rev-parse", "main").trim();
const mainRemotoRef = git("rev-parse", "origin/main").trim();
console.log(`   main local            ${mainLocal}`);
console.log(`   origin/main (ref)     ${mainRemotoRef}`);

if (SEM_REDE) {
  naoSei.push("main no servidor não foi consultada (--sem-rede)");
  console.log("   main no servidor      NÃO SEI (--sem-rede)");
} else {
  try {
    const srv = git("ls-remote", "origin", "refs/heads/main").split(/\s+/)[0];
    console.log(`   main no servidor      ${srv}`);
    if (srv !== mainRemotoRef) {
      console.log("   ⚠️ o ref local origin/main está DESATUALIZADO em relação ao servidor.");
      naoSei.push("origin/main local está atrás do servidor — as comparações da seção 4 podem estar defasadas");
    }
    if (srv !== mainLocal) {
      const frente = linhas(git("rev-list", `${mainRemotoRef}..main`)).length;
      const atras = linhas(git("rev-list", `main..${mainRemotoRef}`)).length;
      console.log(`   => DIVERGEM: main está ${frente} à frente, ${atras} atrás.`);
      if (frente > 0) riscos.push(`main local tem ${frente} commit${t(frente)} não enviado${t(frente)}`);
    } else {
      console.log("   => main local == origin/main == servidor.");
    }
  } catch {
    naoSei.push("não consegui falar com o servidor (rede ou credencial)");
    console.log("   main no servidor      NÃO SEI (ls-remote falhou)");
  }
}

/* ── 7. migrations ───────────────────────────────────────────────────────── */
console.log("\n── 7. MIGRATIONS " + "─".repeat(60));

const dirMig = "supabase/migrations";
if (!existsSync(dirMig)) {
  console.log("NÃO SEI: pasta de migrations não encontrada.");
  naoSei.push("pasta de migrations não encontrada");
} else {
  const migs = linhas(git("ls-files", "--others", "--cached", "--exclude-standard", "--", dirMig))
    .filter((f) => f.endsWith(".sql"));

  const refs = linhas(git("for-each-ref", "--format=%(refname:short)", "refs/remotes"))
    .filter((r) => !r.endsWith("/HEAD"));

  const consultas = [];
  for (const m of migs) for (const r of refs) consultas.push(`${r}:${m}`);
  const presente = new Set();
  const naMain = new Set();
  if (consultas.length > 0) {
    const saida = execFileSync("git", ["cat-file", "--batch-check"], {
      input: consultas.join("\n") + "\n",
      encoding: "utf8",
      maxBuffer: 256 * 1024 * 1024,
    });
    linhas(saida).forEach((l, i) => {
      if (/ missing$/.test(l)) return;
      const alvo = consultas[i];
      const sep = alvo.indexOf(":");
      const ref = alvo.slice(0, sep);
      const caminho = alvo.slice(sep + 1);
      presente.add(caminho);
      if (ref === "origin/main") naMain.add(caminho);
    });
  }

  const semRemoto = migs.filter((m) => !presente.has(m));
  console.log(`MEDI: ${migs.length} migration${t(migs.length)} no disco · ${naMain.size} em origin/main · ${semRemoto.length} sem remoto algum.`);
  if (semRemoto.length > 0) {
    semRemoto.forEach((m) => console.log(`   SEM REMOTO  ${m}`));
    riscos.push(`${semRemoto.length} migration${t(semRemoto.length)} sem cópia remota`);
  }

  // Versionada em algum branch, mas ausente de origin/main. Não é risco de
  // PERDA — é risco de RASTREABILIDADE: se uma destas já estiver aplicada em
  // produção, banco e main divergem. Foi o caso real de 0080 e 0081 em 21/08.
  const foraDaMainTodas = migs.filter((m) => presente.has(m) && !naMain.has(m));
  if (foraDaMainTodas.length > 0) {
    console.log(`\n   versionadas em branch, AUSENTES de origin/main (${foraDaMainTodas.length}):`);
    foraDaMainTodas.forEach((m) => console.log(`      ${m}`));
    console.log("   Se alguma destas já foi APLICADA em produção, banco e main divergem.");
    console.log("   Conferir uma a uma antes de fechar a sessão.");
  }

  // cruzamento com o registro de aplicadas em produção
  if (existsSync(LEDGER)) {
    const aplicadas = linhas(readFileSync(LEDGER, "utf8"))
      .map((l) => l.replace(/#.*$/, "").trim())
      .filter(Boolean);
    console.log(`\n   registro de aplicadas (${LEDGER}): ${aplicadas.length} entrada${t(aplicadas.length)}`);
    const divergentes = aplicadas.filter((a) => {
      const alvo = a.includes("/") ? a : `${dirMig}/${a}`;
      return !presente.has(alvo);
    });
    const foraDaMain = aplicadas.filter((a) => {
      const alvo = a.includes("/") ? a : `${dirMig}/${a}`;
      return presente.has(alvo) && !naMain.has(alvo);
    });
    if (divergentes.length > 0) {
      divergentes.forEach((m) => console.log(`   ⚠️ APLICADA E NÃO VERSIONADA EM REMOTO  ${m}`));
      riscos.push(`${divergentes.length} migration aplicada em produção sem cópia remota`);
    }
    if (foraDaMain.length > 0) {
      foraDaMain.forEach((m) => console.log(`   ⚠️ APLICADA, versionada, mas FORA de origin/main  ${m}`));
      riscos.push(`${foraDaMain.length} migration aplicada em produção fora de origin/main`);
    }
    if (divergentes.length === 0 && foraDaMain.length === 0) {
      console.log("   toda migration registrada como aplicada está em origin/main.");
    }
  } else {
    console.log(`\n   NÃO SEI quais migrations estão aplicadas em produção.`);
    console.log(`   Esta checagem não fala com o banco, de propósito.`);
    console.log(`   Para cruzar, criar ${LEDGER} com um nome de arquivo por linha`);
    console.log(`   (ex.: 0081_iniciar_trial_se_apto.sql). '#' inicia comentário.`);
    naoSei.push(`quais migrations estão aplicadas em produção (${LEDGER} não existe)`);
  }
}

/* ── veredito ────────────────────────────────────────────────────────────── */
console.log("\n" + "═".repeat(78));
if (riscos.length === 0) {
  console.log("VEREDITO: PROTEGIDO — nenhum trabalho depende só desta máquina.");
} else {
  console.log("VEREDITO: EM RISCO — há trabalho que só existe aqui.");
  riscos.forEach((r) => console.log(`   · ${r}`));
  console.log("\n   Enviar para branch remoto ANTES de qualquer limpeza ou operação de");
  console.log("   risco. Versionar não é mergear, e não é publicar em produção.");
}
if (naoSei.length > 0) {
  console.log("\nNÃO SEI:");
  naoSei.forEach((n) => console.log(`   · ${n}`));
}
console.log("═".repeat(78));
console.log("Esta checagem é somente leitura: não commitou, não enviou, não apagou nada.");

process.exit(riscos.length === 0 ? 0 : 1);
