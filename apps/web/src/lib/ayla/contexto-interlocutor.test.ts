import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * QUEM ESTÁ FALANDO — o buraco que virava nome inventado.
 *
 * Caso real (02/08/2026): a Ayla respondeu "Oi, Maria Yasmin!" e depois falou de
 * "sua filha Iasmin". Ela usou o nome da CRIANÇA para se dirigir à mãe.
 *
 * A causa não era falta de regra no núcleo: era uma frase truncada.
 * `family_profiles.como_chamar` e `nome_mae` vazios fazem `nomeMae` cair pra "",
 * e a linha saía como "Você está falando com , mãe de Iasmin." — vírgula solta,
 * sem nome. O modelo preencheu o buraco com o único nome disponível.
 *
 * Este teste lê o CÓDIGO da montagem porque a função que a constrói faz chamada
 * de modelo e não é isolável — o que importa aqui é que a frase truncada não
 * possa voltar, e isso é verificável no fonte.
 */
const FONTE = readFileSync(
  resolve(__dirname, "responder.ts"),
  "utf8",
);

describe("contexto do interlocutor sem nome", () => {
  it("a frase com nome só é montada quando há nome", () => {
    // A forma antiga — interpolar `params.nomeMae` direto — não pode existir.
    expect(FONTE).not.toMatch(/Você está falando com \$\{params\.nomeMae\}/);
    expect(FONTE).toMatch(/Você está falando com \$\{nomeDeQuemFala\}/);
  });

  it("sem nome, o contexto DIZ que não sabe — em vez de deixar o buraco", () => {
    expect(FONTE).toMatch(/Você NÃO sabe o nome de quem está falando/);
  });

  it("proíbe explicitamente usar o nome da criança para o cuidador", () => {
    expect(FONTE).toMatch(/NUNCA use o nome da criança pra se dirigir a quem cuida/);
  });

  it("proíbe deduzir o nome do áudio ou do texto", () => {
    // Foi a hipótese levantada no caso real: áudio transcrito com um nome.
    expect(FONTE).toMatch(/NÃO deduza pelo áudio ou pelo texto/);
  });

  it("a linha de concordância de gênero também não sai truncada", () => {
    // "Trate  no feminino" tinha o mesmo buraco.
    expect(FONTE).not.toMatch(/Trate \$\{params\.nomeMae\} no/);
    expect(FONTE).toMatch(/Trate \$\{nomeDeQuemFala \|\| "quem fala com você"\} no/);
  });

  it("o nome é normalizado antes de ser considerado presente", () => {
    // " " não é nome. Sem o trim, um espaço em branco reabriria o buraco.
    expect(FONTE).toMatch(/params\.nomeMae\?\.trim\(\) \?\? ""/);
  });
});
