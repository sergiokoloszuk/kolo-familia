import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { textoVideoGuia } from "./orchestrator";
import { primeiroNomeCriancaConfiavel } from "./crianca-nome";

/**
 * PROATIVA NÃO INVENTA NOME NEM GÊNERO.
 *
 * ═══ O CASO PAULA (17/08/2026, produção) ═══
 *
 * O campo do nome da criança tinha `"Meu Filhos"` — plural, não um nome. Às
 * 11:00:18 a família recebeu a campanha do vídeo dizendo *"montar histórias do
 * **Meu Filhos**"*. Às 11:01:48, noventa segundos depois, recebeu a mensagem
 * que pede o nome verdadeiro: *"no cadastro o nome dela não veio"*.
 *
 * Duas mensagens contradizendo uma à outra. O detector existia e funcionava —
 * foi ele que disparou a segunda. As proativas escritas à mão no orquestrador
 * é que não o consultavam.
 *
 * ═══ O SEGUNDO DEFEITO, ENCONTRADO NA MESMA VARREDURA ═══
 *
 * Uma delas decidia o gênero da criança pela ÚLTIMA LETRA do nome:
 * `d${nome.endsWith("a") ? "a" : "o"}`. Todo Nicolas virava menina; todo nome
 * que não termina em "a" virava menino. Gênero é dado registrado, não palpite
 * ortográfico.
 */

const ORCH = readFileSync(resolve(__dirname, "orchestrator.ts"), "utf8");

/**
 * O fonte SEM comentários.
 *
 * Necessário porque o comentário que documenta o defeito antigo cita o próprio
 * trecho proibido — e um teste que casa o texto do aviso reprova a correção
 * junto com a doença. Aqui se olha o que EXECUTA.
 */
const ORCH_CODIGO = ORCH.split("\n")
  .filter((l) => {
    const t = l.trim();
    return !t.startsWith("*") && !t.startsWith("//") && !t.startsWith("/*");
  })
  .join("\n");

describe("nome da criança — só quando é nome", () => {
  it("1. nome real passa, e vem só o primeiro", () => {
    expect(primeiroNomeCriancaConfiavel("Manuela Silva Costa")).toBe("Manuela");
  });

  it('2. MORDE: "Meu Filhos" — o caso exato da produção — não vira nome', () => {
    expect(primeiroNomeCriancaConfiavel("Meu Filhos")).toBe("");
  });

  it('3. "meu filho" no singular também não', () => {
    expect(primeiroNomeCriancaConfiavel("meu filho")).toBe("");
  });

  it("4. frase inteira no campo do nome não vira nome", () => {
    expect(primeiroNomeCriancaConfiavel("Meu Nome e Gisela Meu Filgo e Davi Ele e Autista")).toBe("");
  });

  it("5. campo vazio não vira nome", () => {
    expect(primeiroNomeCriancaConfiavel(null)).toBe("");
    expect(primeiroNomeCriancaConfiavel("")).toBe("");
  });
});

describe("a campanha do vídeo", () => {
  it("6. MORDE: com placeholder, a mensagem SAI — sem citar o nome", () => {
    const t = textoVideoGuia({ nomeMae: "Paula", nomeMembro: "Meu Filhos" });
    expect(t, "o placeholder vazou de novo").not.toContain("Meu Filhos");
    // A proativa não pode ser bloqueada por causa disso: ela continua inteira.
    expect(t).toContain("Paula");
    expect(t).toContain("Gravamos um vídeo curto");
    expect(t).toContain("montar histórias,");
  });

  it("7. com nome real, cita normalmente", () => {
    const t = textoVideoGuia({ nomeMae: "Karina", nomeMembro: "Manuela Costa" });
    expect(t).toContain("de Manuela");
    expect(t).toContain("sobre Manuela");
  });

  it("8. sem nome nenhum, a frase continua de pé", () => {
    const t = textoVideoGuia({ nomeMae: null, nomeMembro: null });
    expect(t).toContain("Oi 💛");
    expect(t).toContain("Gravamos um vídeo curto");
  });
});

describe("gênero — dado registrado, nunca palpite", () => {
  it("9. MORDE: ninguém decide gênero pela última letra do nome", () => {
    // Era `d${membro.nome.endsWith("a") ? "a" : "o"} ${membro.nome}`.
    expect(ORCH_CODIGO, "a inferência de gênero pelo nome voltou").not.toMatch(
      /endsWith\("a"\)\s*\?\s*"a"\s*:\s*"o"/,
    );
  });

  it("10. as quatro proativas citam a criança pelo helper único", () => {
    const usos = ORCH_CODIGO.match(/citarCrianca\(membro, "(de|para)"\)/g) ?? [];
    expect(usos.length, "alguma proativa voltou a montar a citação sozinha").toBe(4);
    // E nenhuma delas monta a citação com o nome cru.
    expect(ORCH_CODIGO).not.toMatch(/refMembro = membro\?\.nome \?/);
  });

  it("11. o helper só concorda quando o gênero está registrado", () => {
    const bloco = ORCH.slice(ORCH.indexOf("function citarCrianca"), ORCH.indexOf("function citarCrianca") + 900);
    expect(bloco).toMatch(/g === "feminino"/);
    expect(bloco).toMatch(/g === "masculino"/);
    // O caminho neutro existe e é o último — qualquer dúvida cai nele.
    expect(bloco).toMatch(/return ` de \$\{nome\}`/);
  });

  it("12. o nome da mãe NÃO é filtrado duas vezes — a fonte é uma só", () => {
    // `loadFamiliaParaEnvio` já aplica `primeiroNomeConfiavel`. Refiltrar aqui
    // seria a segunda fonte de decisão que este conserto existe pra evitar.
    expect(ORCH).toMatch(/nomeMae: primeiroNomeConfiavel\(/);
  });
});
