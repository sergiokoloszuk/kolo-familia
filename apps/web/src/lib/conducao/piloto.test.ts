import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { FLAG_PILOTO_4A, FLAG_PILOTO_4A_FAMILIAS, pilotoQuatroA } from "./piloto";

const src = (p: string) => readFileSync(resolve(__dirname, "..", p), "utf8");

const PILOTO = "11111111-1111-1111-1111-111111111111";
const COMUM = "22222222-2222-2222-2222-222222222222";

afterEach(() => {
  delete process.env[FLAG_PILOTO_4A];
  delete process.env[FLAG_PILOTO_4A_FAMILIAS];
});

/**
 * ⚠️ ESTE BLOCO MUDOU EM 10/08/2026, e a decisão antiga não era erro.
 *
 * Até aqui a flag era um booleano global (`KOLO_PILOTO_ESTRATEGIAS=1`), e fazia
 * sentido: a pergunta da 4A.1 era "o que muda só porque a Ayla enxerga
 * melhor?", medida em bancada, com a flag desligada em produção o tempo todo.
 *
 * O piloto restrito (três famílias) tornou o booleano inutilizável: não havia
 * como alcançar três sem alcançar 172. Virou o rollout de três estados que
 * `lib/ia/provider.ts` já usava e que a produção já provou.
 */
describe("o rollout de três estados", () => {
  it("1. ausente = ninguém — o padrão nunca é ligar", () => {
    delete process.env[FLAG_PILOTO_4A];
    expect(pilotoQuatroA(PILOTO)).toBe(false);
    expect(pilotoQuatroA(COMUM)).toBe(false);
  });

  it("2. grafia errada cai em OFF, nunca em ON", () => {
    // O pior caso tem que ser "continua como estava", nunca "vazou pra todos".
    for (const v of ["", "0", "1", "true", "sim", "ativo", "ON", "Teste", "openai"]) {
      process.env[FLAG_PILOTO_4A] = v;
      process.env[FLAG_PILOTO_4A_FAMILIAS] = PILOTO;
      expect(pilotoQuatroA(PILOTO), `"${v}" não deveria ligar`).toBe(false);
    }
  });

  it("3. teste = só quem está na lista", () => {
    process.env[FLAG_PILOTO_4A] = "teste";
    process.env[FLAG_PILOTO_4A_FAMILIAS] = PILOTO;
    expect(pilotoQuatroA(PILOTO)).toBe(true);
    expect(pilotoQuatroA(COMUM)).toBe(false);
  });

  it("4. MORDE: sob teste, lista vazia = NINGUÉM (o acidente mais provável)", () => {
    // Apagar a lista, renomeá-la ou um deploy que não a carregue NÃO pode
    // promover todo mundo. É a razão de o estado de teste ser um valor próprio.
    process.env[FLAG_PILOTO_4A] = "teste";
    for (const lista of [undefined, "", "   ", ",,,", "\n"]) {
      if (lista === undefined) delete process.env[FLAG_PILOTO_4A_FAMILIAS];
      else process.env[FLAG_PILOTO_4A_FAMILIAS] = lista;
      expect(pilotoQuatroA(PILOTO), `lista ${JSON.stringify(lista)}`).toBe(false);
      expect(pilotoQuatroA(COMUM)).toBe(false);
    }
  });

  it("5. on = todas as famílias, sem tocar em implementação", () => {
    // É esta linha que garante o rollout da próxima missão: trocar `teste` por
    // `on` libera para todos. Se ela quebrar, o rollout virou código de novo.
    process.env[FLAG_PILOTO_4A] = "on";
    delete process.env[FLAG_PILOTO_4A_FAMILIAS];
    expect(pilotoQuatroA(PILOTO)).toBe(true);
    expect(pilotoQuatroA(COMUM)).toBe(true);
  });

  it("6. FAIL CLOSED: id ausente, vazio ou não-string nunca entra", () => {
    process.env[FLAG_PILOTO_4A] = "teste";
    process.env[FLAG_PILOTO_4A_FAMILIAS] = PILOTO;
    for (const id of [null, undefined, "", "   ", 123 as unknown as string]) {
      expect(pilotoQuatroA(id), `id ${JSON.stringify(id)}`).toBe(false);
    }
  });

  it("7. a lista aceita vírgula, espaço e quebra de linha", () => {
    process.env[FLAG_PILOTO_4A] = "teste";
    process.env[FLAG_PILOTO_4A_FAMILIAS] = `${COMUM},, ${PILOTO}\n`;
    expect(pilotoQuatroA(PILOTO)).toBe(true);
    expect(pilotoQuatroA(COMUM)).toBe(true);
  });
});

describe("o padrão é COMPARTILHADO com o provider, não copiado", () => {
  it("8. MORDE: as duas cópias do parser não podem divergir", () => {
    // ⚠️ HÁ DUAS, E É DELIBERADO. `provider.ts` é defendido por teste próprio
    // como transporte puro, com ZERO imports — importar daqui foi tentado em
    // 10/08/2026 e revertido para não enfraquecer aquela fronteira. O padrão é
    // compartilhado; a função, não. Este teste é o preço: se uma mudar sem a
    // outra, ele morde.
    const regra = /\.split\(\/\[,\\s\]\+\/\)/;
    expect(src("ia/provider.ts"), "provider perdeu o parser").toMatch(regra);
    expect(src("conducao/rollout.ts"), "rollout perdeu o parser").toMatch(regra);
    expect(src("conducao/piloto.ts"), "piloto não usa o parser compartilhado").toMatch(
      /listaDeFamilias/,
    );
    // E a duplicação precisa continuar DITA, não silenciosa.
    expect(src("ia/provider.ts")).toMatch(/DUPLICAÇÃO DELIBERADA/);
  });

  it("9. MORDE: provider e piloto continuam SEPARADOS conceitualmente", () => {
    // "quem responde" (GPT × Claude) e "com o que ela pensa" (4A) precisam se
    // mover em ritmos diferentes. Se o piloto passar a ler a lista do provider,
    // nunca mais dá pra ter 4A no Claude nem GPT sem 4A.
    // Procura LEITURA, não menção: o comentário de `piloto.ts` cita a variável
    // do provider de propósito, para registrar por que ela NÃO foi reusada.
    // Um teste que casasse com a palavra proibiria justamente a documentação.
    expect(src("conducao/piloto.ts"), "o piloto leu a lista do provider").not.toMatch(
      /process\.env(\.|\[["'])OPENAI_TEST_FAMILY_IDS/,
    );
    expect(src("ia/provider.ts"), "o provider leu a variável do piloto").not.toMatch(
      /process\.env(\.|\[["'])KOLO_PILOTO_4A/,
    );
  });
});

describe("FASE 4A.1 · as três leituras estão atrás da flag", () => {
  const contexto = src("ia/context.ts");

  it("3. o piloto exige rollout POR FAMÍLIA E relato — sem texto não há o que ranquear", () => {
    expect(contexto).toMatch(
      /const piloto =\s*pilotoQuatroA\(familyId\) && Boolean\(params\.relato\?\.trim\(\)\)/,
    );
  });

  it("4. MORDE: as três leituras não podem rodar fora do piloto", () => {
    // Se alguém tirar a guarda de qualquer uma delas, o WhatsApp e o resto da
    // web passam a receber contexto que ninguém mediu.
    expect(contexto).toMatch(/relato: piloto \? params\.relato : undefined/);
    expect(contexto).toMatch(/const base2 =\s*\n?\s*piloto &&/);
    expect(contexto).toMatch(/const perfilConsultavel =\s*\n?\s*piloto &&/);
  });

  it("5. MORDE: o ranking entra ANTES do corte — depois não escolheria nada", () => {
    const rec = src("conhecimento/recuperar.ts");
    const iRank = rec.indexOf("ordenarPorAderencia(");
    const iCorte = rec.indexOf("finais.slice(0, p.limite");
    expect(iRank).toBeGreaterThan(-1);
    expect(iCorte).toBeGreaterThan(iRank);
  });

  it("6. MORDE: sem `relato`, `recuperarBoasPraticas` se comporta como antes", () => {
    const rec = src("conhecimento/recuperar.ts");
    // O ternário é o que garante o byte-a-byte para o WhatsApp.
    expect(rec).toMatch(/const finais = p\.relato\?\.trim\(\)\s*\n?\s*\?/);
    expect(rec).toMatch(/:\s*ordenadas;/);
  });
});

/**
 * ⚠️ ESTE BLOCO SE INVERTEU EM 10/08/2026, e a versão antiga não era erro.
 *
 * Ele se chamava "o WhatsApp não mudou" e mordia se alguém passasse `relato` ou
 * `statusAceitos` neste canal. O motivo era bom: em 4A.1 o ranking ainda não
 * tinha sido medido, e ligá-lo no WhatsApp junto teria escondido a causa de
 * qualquer mudança observada — não se saberia se veio do ranking ou do canal.
 *
 * A medição aconteceu (bancada de 09/08, `docs/bancada/4a1-ranking-*.txt`), e a
 * decisão de produto mudou: uma Ayla só, mesma compreensão nos dois canais. O
 * teste mudou junto e continua mordendo — agora garantindo que os parâmetros
 * entrem SÓ dentro do piloto, e que o canal continue montando o próprio
 * contexto.
 */
describe("o WhatsApp recebe a 4A — e só dentro do piloto", () => {
  const orq = src("ayla/orchestrator.ts");

  it("7. os parâmetros do ranking são condicionados ao piloto, nunca incondicionais", () => {
    expect(orq).toMatch(/const noPiloto4A = pilotoQuatroA\(family\.id\)/);
    expect(orq).toMatch(/relato: noPiloto4A \? inbound\.texto : undefined/);
    expect(orq).toMatch(/statusAceitos: noPiloto4A \? \["ativo", "rascunho"\] : undefined/);
    expect(orq).toMatch(/limite: noPiloto4A \? 2 : undefined/);
  });

  it("7b. MORDE: nenhum parâmetro da 4A entra sem passar pelo piloto", () => {
    // A forma do bug seria trocar `noPiloto4A ? x : undefined` por `x` direto —
    // some a condição e as 55 famílias de fora recebem contexto que ninguém
    // mediu. Aqui se exige que toda menção venha acompanhada da guarda.
    // ⚠️ OLHA SÓ A PRÓPRIA LINHA. A primeira versão deste teste lia 120
    // caracteres à frente — e passou numa sabotagem real (10/08/2026), porque
    // encontrava o `noPiloto4A` da linha SEGUINTE. Teste que não morde não
    // protege nada; a janela larga era o defeito.
    for (const chave of ["relato:", "statusAceitos:", "limite:"]) {
      const linha = orq.split("\n").find((l) => l.trim().startsWith(chave));
      expect(linha, `${chave} sumiu do orquestrador`).toBeDefined();
      expect(linha, `${chave} ficou incondicional`).toMatch(/noPiloto4A \?/);
    }
  });

  it("7c. MORDE: perfil consultável e BASE 2 também exigem o piloto", () => {
    expect(orq).toMatch(/noPiloto4A && membroContextoId/);
    expect(orq).toMatch(/noPiloto4A && temaBase2 && temMaterial\(temaBase2\)/);
  });

  it("7d. MORDE: a licença generativa NÃO pode vazar pelo repertório", () => {
    // Este canal entrega repertório a TODA família desde 06/08. Uma guarda só
    // por "há material" ligaria a licença para as 55 de fora — o bug que quase
    // entrou nesta própria implementação.
    const resp = src("ayla/responder.ts");
    expect(resp).toMatch(/if \(params\.piloto4A && \(blocoPerfil4A/);
  });

  it("8. MORDE: o WhatsApp continua NÃO passando por buildContext", () => {
    // A regra que não mudou, e a mais importante das duas: inteligência é
    // compartilhada, MONTADOR é de cada canal. `lib/ia/context.ts` depende de
    // linhas de `skills`, `mensagens_skill`, diários e check-in, que este canal
    // não tem — reusá-lo seria arrastar a web inteira para cá.
    for (const f of ["ayla/orchestrator.ts", "ayla/responder.ts"]) {
      expect(src(f), `${f} passou a usar buildContext`).not.toMatch(/buildContext\(/);
    }
  });

  it("8b. MORDE: nenhuma cópia paralela da inteligência 4A", () => {
    // O risco real desta integração era nascer um `rankingWhatsApp`, um
    // `perfilWhatsApp` ou um `base2WhatsApp`. Os módulos são os mesmos da web.
    const universo = ["ayla/orchestrator.ts", "ayla/responder.ts"].map(src).join("\n");
    expect(universo).not.toMatch(/rankingWhatsApp|perfilWhatsApp|base2WhatsApp|ordenarPorAderencia/);
    expect(universo).toMatch(/from ["']@\/lib\/kolo-vivo\/consultar["']/);
    expect(universo).toMatch(/from ["']@\/lib\/conducao\/base2["']/);
    expect(universo).toMatch(/from ["']@\/lib\/conducao\/composicao["']/);
  });

  it("8c. MORDE: a redação do bloco de perfil é UMA, usada pelos dois canais", () => {
    expect(src("kolo-vivo/consultar.ts")).toMatch(/export function linhasDoPerfilConsultavel/);
    for (const f of ["ia/prompt.ts", "ayla/responder.ts"]) {
      expect(src(f), `${f} não usa a redação compartilhada`).toMatch(
        /linhasDoPerfilConsultavel/,
      );
    }
  });
});

describe("o que a 4A.1 NÃO liga", () => {
  it("9. a âncora e a licença entraram na 4A.2 — e só no prompt", () => {
    // Este teste guardava a AUSÊNCIA na 4A.1, para que a medição de "o que muda
    // só porque a Ayla enxerga melhor" fosse separável. A 4A.1 foi medida, e
    // agora ele guarda o oposto: as duas peças existem, e existem no prompt.
    expect(src("ia/prompt.ts")).toMatch(/conducao\/composicao/);
    expect(src("ia/prompt.ts")).toMatch(/ANCORA_PERFIL/);
    expect(src("ia/prompt.ts")).toMatch(/LICENCA_GENERATIVA/);
  });

  it("9b. MORDE: a licença só entra se houver material sobre o que operar", () => {
    // Sem perfil, sem BASE 2 e sem repertório, a licença sozinha só aumenta a
    // invenção — foi exatamente o que a bancada pegou.
    expect(src("ia/prompt.ts")).toMatch(
      /if \(ctx\.perfilConsultavel \|\| ctx\.base2\.length \|\| ctx\.boasPraticas\.length\)/,
    );
  });

  it("9c. MORDE: nada disto pode vazar para o núcleo compartilhado", () => {
    expect(src("conducao/diretrizes.ts")).not.toMatch(/LASTRO, NÃO TEXTO PARA COPIAR/);
    expect(src("conducao/diretrizes.ts")).not.toMatch(/O PERFIL É ÂNCORA/);
  });

  it("10. MORDE: nenhum caminho de produto ativa os 10 rascunhos", () => {
    const rec = src("conhecimento/recuperar.ts");
    expect(rec).toMatch(/p\.statusAceitos \?\? \["ativo"\]/);
    // FASE 4A.3 · a web passa `statusAceitos` — mas SÓ dentro do piloto, e os
    // registros continuam em `rascunho` no banco. Nenhum caminho de produção
    // publica nada; desligar a flag basta para eles sumirem.
    expect(src("ia/context.ts")).toMatch(
      /statusAceitos: piloto \? \["ativo", "rascunho"\] : undefined/,
    );
    // ⚠️ ATÉ 10/08/2026 ESTE TESTE EXIGIA que o WhatsApp NÃO passasse
    // `statusAceitos` — os 10 rascunhos eram exclusivos do piloto web. Agora o
    // WhatsApp também é piloto, então a exigência passou a ser a MESMA da web:
    // condicionado ao rollout. Os registros continuam em `rascunho` no banco, e
    // desligar o rollout continua bastando para eles sumirem dos dois canais.
    expect(src("ayla/orchestrator.ts")).toMatch(
      /statusAceitos: noPiloto4A \? \["ativo", "rascunho"\] : undefined/,
    );
    expect(src("ayla/responder.ts"), "responder não deve recuperar BP por conta própria").not.toMatch(
      /statusAceitos/,
    );
  });
});

describe("o bloco do perfil", () => {
  const prompt = src("ia/prompt.ts");

  it("10b. dentro do piloto são DUAS boas práticas, não três", () => {
    // 5 rodadas do mesmo caso em cada condição, 09/08/2026: com 3 BPs o pior
    // caso foi 17,3 s e o Perfil apareceu em 1 de 5; com 2, o pior caso caiu
    // para 5,9 s e o Perfil apareceu em 3 de 5.
    expect(src("ia/context.ts")).toMatch(/limite: piloto \? 2 : undefined/);
    // Fora do piloto, o padrão do recuperador continua 3.
    expect(src("conhecimento/recuperar.ts")).toMatch(/p\.limite \?\? 3/);
  });

  it("11. distingue vazio de NEGATIVO — é a distinção que evita repergunta", () => {
    // ⚠️ A REDAÇÃO MUDOU DE CASA em 10/08/2026: saiu de `ia/prompt.ts` para
    // `kolo-vivo/consultar.ts` quando o WhatsApp passou a receber o mesmo bloco.
    // O teste seguiu a redação — o que ele guarda é a DISTINÇÃO, não o arquivo.
    const consultar = src("kolo-vivo/consultar.ts");
    expect(consultar).toMatch(/a família já disse que NÃO é o caso:/);
    expect(consultar).toMatch(/ainda não sabemos:/);
    // A instrução de não reperguntar fica em quem monta o bloco — nos DOIS canais.
    for (const f of ["ia/prompt.ts", "ayla/responder.ts"]) {
      expect(src(f), `${f} perdeu a instrução de não reperguntar`).toMatch(
        /NÃO pergunte o que está em "sabemos"/,
      );
    }
  });

  it("12. a BASE 2 entra marcada como material interno, não como resposta", () => {
    expect(prompt).toMatch(/Material INTERNO de raciocínio/);
    expect(prompt).toMatch(/transforme as bifurcações em questionário/);
    expect(prompt).toMatch(/faça no máximo UMA pergunta/);
  });
});
