import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { SUPORTE_WHATSAPP, FATOS_COMERCIAIS } from "./fatos-comerciais";

/**
 * O CONTATO DO SUPORTE TEM UM DONO SÓ.
 *
 * Ele vivia escrito dentro do documento `trial` v4, publicado no banco. Duas
 * consequências: a Ayla só conseguia oferecê-lo a famílias em condução de
 * teste — quem já assinou, quem está no pós-Trial e a Web nunca souberam que
 * existe gente do outro lado —, e trocá-lo exigiria republicar um documento de
 * conteúdo.
 *
 * Existem outros dois números no sistema, e nenhum é suporte: o WhatsApp da
 * própria Ayla e o monitor do admin. Oferecer qualquer um deles a uma família
 * é defeito, e é o tipo de troca que acontece quando o número anda solto.
 */

const RAIZ = resolve(__dirname, "../../..");

function arquivosDeProduto(dir: string, acc: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const p = resolve(dir, e.name);
    if (e.isDirectory()) arquivosDeProduto(p, acc);
    else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

describe("o contato do suporte", () => {
  it("1. existe uma constante canônica, e é o número oficial", () => {
    expect(SUPORTE_WHATSAPP).toBe("(11) 94037-7337");
  });

  it("2. NENHUM outro arquivo de produto repete o número", () => {
    const ofensores: string[] = [];
    for (const arq of arquivosDeProduto(resolve(RAIZ, "src"))) {
      if (arq.endsWith("fatos-comerciais.ts")) continue; // é o dono
      if (/94037[\s-]?7337|94037/.test(readFileSync(arq, "utf8"))) {
        ofensores.push(arq.replace(RAIZ, ""));
      }
    }
    expect(ofensores).toEqual([]);
  });

  it("3. os dois números que NÃO são suporte não podem ser oferecidos como tal", () => {
    // (11) 96319-7032 = WhatsApp da própria Ayla · (11) 99477-0067 = monitor
    // do admin. Se algum deles aparecer no bloco de suporte, é troca de número.
    expect(FATOS_COMERCIAIS).not.toMatch(/96319|99477/);
  });

  it("4. o bloco de suporte entra nos DOIS caminhos da Ayla", () => {
    // Legacy (`responder.ts`) já injetava os fatos. O experimental — que atende
    // todas as famílias desde 17/08 — não injetava nada disso, e por isso a
    // Ayla do caminho novo não sabia nem quanto dura o teste.
    for (const arq of ["src/lib/ayla/responder.ts", "src/lib/ayla/experimental.ts"]) {
      const txt = readFileSync(resolve(RAIZ, arq), "utf8");
      expect(txt, `${arq} precisa injetar FATOS_COMERCIAIS`).toMatch(/FATOS_COMERCIAIS/);
    }
  });

  it("5. o bloco manda dar o contato, e proíbe esconder", () => {
    expect(FATOS_COMERCIAIS).toMatch(/SUPORTE HUMANO/);
    expect(FATOS_COMERCIAIS).toContain(SUPORTE_WHATSAPP);
    expect(FATOS_COMERCIAIS).toMatch(/Nunca esconda o contato/);
  });

  it("6. NÃO promete prazo de resposta — não existe SLA definido", () => {
    expect(FATOS_COMERCIAIS).toMatch(/NÃO prometa prazo/);
    // A promessa proibida, nas formas em que ela costuma aparecer.
    expect(FATOS_COMERCIAIS).not.toMatch(/\d+\s*(horas|dias) úteis|responde(mos)? em \d+/i);
  });

  it("7. cobre as intenções decididas — pedir gente, e não conseguir fazer", () => {
    for (const gatilho of ["falar com alguém", "assinar", "pagar", "cancelar", "entrar"]) {
      expect(FATOS_COMERCIAIS.toLowerCase()).toContain(gatilho);
    }
  });
});
