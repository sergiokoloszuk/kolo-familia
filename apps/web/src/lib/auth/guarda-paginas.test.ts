import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

/**
 * NENHUMA PÁGINA DE ADMIN OU DASHBOARDS CONSULTA COM SERVICE-ROLE SEM GUARDA
 * NO PRÓPRIO CORPO — 12/11/2026.
 *
 * Os dois vazamentos medidos em produção tinham a mesma forma: a página usava
 * `createServiceRoleClient()` (ignora RLS) e confiava num layout para barrar
 * quem não podia ver. `/admin/jornada` não tinha guarda em lugar nenhum; as
 * páginas de `/dashboards` tinham só no layout, que renderiza em paralelo.
 *
 * ⚠️ ASSERÇÃO SOBRE CÓDIGO-FONTE PROVA ESTRUTURA, NÃO COMPORTAMENTO — e aqui é
 * o que se quer: uma trava que reprova a próxima página criada sem guarda. O
 * comportamento da guarda está provado em `require-dashboard.test.ts`.
 */

const APP = resolve(__dirname, "../../app");
const RAIZES = [resolve(APP, "admin"), resolve(APP, "(app)/dashboards")];

// `admin/setup` cria o primeiro admin: por desenho exige só login.
const GUARDA_POR_PAGINA: Record<string, RegExp> = {
  "admin/setup/page.tsx": /await requireUser\(\)/,
};
const GUARDA_PADRAO = /await (requireAdmin|requireDashboard)\(\)/;

function paginas(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = resolve(dir, e.name);
    if (e.isDirectory()) paginas(p, acc);
    else if (e.name === "page.tsx") acc.push(p);
  }
  return acc;
}

/** O código sem comentários — a pergunta é o que ele CHAMA, não o que cita. */
function semComentarios(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n");
}

describe("guarda nas páginas que leem com service-role", () => {
  const todas = RAIZES.flatMap((r) => paginas(r));

  it("encontra as páginas (a varredura não está vazia)", () => {
    expect(todas.length).toBeGreaterThan(40);
  });

  it("MORDE: toda página que usa service-role chama a guarda ANTES da primeira consulta", () => {
    const semGuarda: string[] = [];
    for (const p of todas) {
      const rel = relative(APP, p).replace(/\\/g, "/");
      const codigo = semComentarios(readFileSync(p, "utf8"));
      const corpo = codigo.slice(codigo.indexOf("export default"));
      const usoServiceRole = corpo.indexOf("createServiceRoleClient(");
      if (usoServiceRole < 0) continue;
      const guarda = (GUARDA_POR_PAGINA[rel] ?? GUARDA_PADRAO).exec(corpo);
      if (!guarda || guarda.index > usoServiceRole) semGuarda.push(rel);
    }
    expect(semGuarda, `páginas sem guarda antes do service-role: ${semGuarda.join(", ")}`).toEqual([]);
  });

  it("MORDE: /admin/jornada exige admin", () => {
    const codigo = semComentarios(readFileSync(resolve(APP, "admin/jornada/page.tsx"), "utf8"));
    expect(codigo).toMatch(/await requireAdmin\(\);\s*\n\s*const d = await carregarJornadaAdmin/);
  });
});
