import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

/**
 * TER CONTA NÃO É TER ACESSO AO PRODUTO — e nenhum dos dois lados pode vazar.
 *
 * ⚠️ O QUE ISTO PRENDE, em uma frase: `(conta)` existe para ficar FORA do
 * `TrialGate`, e por isso qualquer rota que entre lá por engano vira acesso
 * grátis silencioso. Não há erro, não há alarme, não há log — a rota
 * simplesmente para de ser cobrada. Este arquivo é o alarme.
 *
 * ── de onde isto vem ──────────────────────────────────────────────────────
 *
 * Até 01/09/2026 `configuracoes/conta` e `assinatura` viviam dentro de
 * `(app)`, cujo layout devolve o `TrialGate` quando `assinaturaLiberada` é
 * falso. Uma família com o teste vencido não alcançava o próprio e-mail, a
 * própria senha nem a página de planos — e como "Sair da conta" só existia na
 * `Sidebar`, também atrás do gate, **não conseguia nem sair da conta**.
 *
 * A correção foi mover DUAS rotas, e só duas. As outras seis páginas de
 * `configuracoes/` leem `membros_atipicos` e `perfil_vivo_membro` — dado de
 * criança — e continuam gateadas.
 */

const APP = join(process.cwd(), "src/app");
const ler = (p: string) => readFileSync(join(APP, p), "utf8");
/** Sem comentários: uma menção em JSDoc não pode passar por implementação. */
const semComentarios = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

describe("1. o grupo (conta) tem uma lista FECHADA de rotas", () => {
  /** Toda página dentro de `(conta)`, por caminho relativo ao grupo. */
  function paginasDe(dir: string, base = ""): string[] {
    const raiz = join(APP, dir, base);
    if (!existsSync(raiz)) return [];
    const saida: string[] = [];
    for (const entrada of readdirSync(raiz, { withFileTypes: true })) {
      const rel = base ? `${base}/${entrada.name}` : entrada.name;
      if (entrada.isDirectory()) saida.push(...paginasDe(dir, rel));
      else if (entrada.name === "page.tsx") saida.push(rel);
    }
    return saida.sort();
  }

  it("MORDE: só estas duas páginas vivem fora do gate", () => {
    // Acrescentar uma rota aqui é decisão de produto, não detalhe de
    // implementação: ela passa a ser alcançável por quem NÃO paga. Se este
    // teste ficou vermelho, a pergunta é "essa página pode ser vista por uma
    // família com o teste vencido?" — e a resposta precisa ser sim.
    expect(paginasDe("(conta)")).toEqual([
      "assinatura/page.tsx",
      "configuracoes/conta/page.tsx",
    ]);
  });

  it("MORDE: as seis configurações de PRODUTO continuam dentro de (app)", () => {
    // Elas leem membros_atipicos / perfil_vivo_membro — dado de criança.
    for (const rota of [
      "configuracoes/page.tsx",
      "configuracoes/familia/page.tsx",
      "configuracoes/membros/page.tsx",
      "configuracoes/preferencias/page.tsx",
      "configuracoes/regras/page.tsx",
      "configuracoes/avatar/page.tsx",
    ]) {
      expect(existsSync(join(APP, "(app)", rota))).toBe(true);
      expect(existsSync(join(APP, "(conta)", rota))).toBe(false);
    }
  });
});

describe("2. o layout de (conta) autentica, e SÓ isso", () => {
  const LAYOUT = semComentarios(ler("(conta)/layout.tsx"));

  it("exige sessão e família", () => {
    expect(LAYOUT).toContain("loadFamilyContext");
    expect(LAYOUT).toContain('redirect("/onboarding")');
  });

  it("MORDE: não chama assinaturaLiberada — é o ponto inteiro do grupo", () => {
    expect(LAYOUT).not.toContain("assinaturaLiberada");
    expect(LAYOUT).not.toContain("TrialGate");
  });

  it("MORDE: não monta a Sidebar, que lista crianças e planos", () => {
    // A Sidebar recebe `criancas` e `temPlanos`. Montá-la aqui vazaria nome e
    // idade de criança para uma sessão sem entitlement.
    expect(LAYOUT).not.toContain("Sidebar");
  });

  it("oferece sair — a porta que faltava", () => {
    expect(LAYOUT).toContain("/auth/logout");
  });
});

describe("3. o gate do produto continua exatamente onde estava", () => {
  const APP_LAYOUT = semComentarios(ler("(app)/layout.tsx"));

  it("MORDE: (app) segue devolvendo TrialGate sem assinatura liberada", () => {
    expect(APP_LAYOUT).toContain("!assinaturaLiberada(sub)");
    expect(APP_LAYOUT).toContain("<TrialGate");
  });

  it("MORDE: a condição do gate não ganhou exceção nova", () => {
    // Se alguém acrescentar um `|| rotaDeConta` aqui, o produto abre.
    expect(APP_LAYOUT).toContain("!isAdmin && !isAnalista && !assinaturaLiberada(sub)");
  });
});

describe("4. Minha conta não vê dado de criança", () => {
  const CONTA = ler("(conta)/configuracoes/conta/page.tsx");

  it("MORDE: não lê nenhuma tabela de criança", () => {
    for (const tabela of [
      "membros_atipicos",
      "perfil_vivo_membro",
      "planos",
      "rotinas",
      "sugestao_perfil_vivos",
    ]) {
      expect(CONTA).not.toContain(`from("${tabela}")`);
    }
  });

  it("lê só o que é da conta", () => {
    expect(CONTA).toContain('from("family_profiles")');
    expect(CONTA).toContain('from("family_accounts")');
  });
});

describe("5. o entitlement não muda de dono", () => {
  const ACTIONS = semComentarios(ler("(conta)/configuracoes/conta/actions.ts"));

  it("MORDE: nenhuma ação de conta ESCREVE em subscription_accesses", () => {
    // Cuidar da conta jamais concede acesso, e jamais começa um teste novo.
    //
    // Ler é legítimo e já era feito antes desta frente: `excluirContaAction`
    // consulta `stripe_subscription_id` para cancelar a cobrança ao apagar a
    // conta. O que não pode existir é ESCRITA — é ela que mudaria entitlement.
    const trechos = ACTIONS.split('from("subscription_accesses")').slice(1);
    for (const depois of trechos) {
      const janela = depois.slice(0, 200);
      expect(janela).toContain(".select(");
      for (const escrita of [".update(", ".insert(", ".upsert(", ".delete("]) {
        expect(janela).not.toContain(escrita);
      }
    }
    expect(ACTIONS).not.toContain("trial_ends_at");
    expect(ACTIONS).not.toContain("iniciar_trial");
  });

  it("MORDE: as ações de conta não exigem assinatura ativa", () => {
    // Exigir aqui recriaria o nó: a pessoa precisaria de acesso para consertar
    // o que a impede de ter acesso.
    expect(ACTIONS).not.toContain("requireActiveWrite");
  });

  it("MORDE: as ações de PRODUTO continuam exigindo", () => {
    const produto = [
      "(app)/conversar/actions.ts",
      "(app)/kolo-vivo/actions.ts",
      "(app)/ludico/rotinas/actions.ts",
      "(app)/historias/actions.ts",
      "(app)/galeria/actions.ts",
    ];
    for (const p of produto) {
      expect(semComentarios(ler(p))).toContain("requireActiveWrite");
    }
  });
});

describe("6. o link da Ayla não é atalho para o produto", () => {
  const DESTINO = readFileSync(
    join(process.cwd(), "src/lib/auth/destino-link.ts"),
    "utf8",
  );

  it("a allowlist já permitia /configuracoes/conta e /assinatura", () => {
    // Nenhuma mudança foi necessária aqui — e é bom que o teste diga isso, pra
    // ninguém "consertar" a allowlist achando que faltava algo.
    expect(DESTINO).toContain("/^\\/configuracoes(\\/[a-z-]+)?$/");
    expect(DESTINO).toContain("/^\\/assinatura$/");
  });

  it("MORDE: manipular `next` não libera produto — o gate não vive no link", () => {
    // A allowlist permite /planos e /painel. Se o `next` fosse a fronteira,
    // trocar o parâmetro abriria o produto. Ele não é: quem barra é o layout
    // de (app), que roda em TODA rota do grupo, com ou sem link.
    expect(DESTINO).toContain("/^\\/planos$/");
    expect(DESTINO).toContain("/^\\/painel$/");
    const APP_LAYOUT = semComentarios(ler("(app)/layout.tsx"));
    expect(APP_LAYOUT).toContain("!assinaturaLiberada(sub)");
    // E o /auth/wa não decide acesso — só resolve destino e minta sessão.
    const WA = semComentarios(
      readFileSync(join(APP, "auth/wa/route.ts"), "utf8"),
    );
    expect(WA).not.toContain("assinaturaLiberada");
    expect(WA).not.toContain("subscription_accesses");
  });
});

describe("7. os becos sem saída foram fechados", () => {
  it("MORDE: o TrialGate tem Minha conta e Sair", () => {
    // Ele tinha 95 linhas, zero href e zero botão de sair: quem vencia o teste
    // não conseguia nem sair da conta.
    const GATE = semComentarios(ler("(app)/trial-gate.tsx"));
    expect(GATE).toContain('href="/configuracoes/conta"');
    expect(GATE).toContain('action="/auth/logout"');
  });

  it("MORDE: redefinir senha não despeja no paywall", () => {
    // Ia para /painel — que, sem assinatura, é o TrialGate. A pessoa acabava
    // de recuperar a senha e caía numa tela de cobrança.
    const R = semComentarios(ler("(auth)/redefinir-senha/page.tsx"));
    expect(R).toContain('router.replace("/configuracoes/conta")');
    expect(R).not.toContain('router.replace("/painel")');
  });

  it("MORDE: o login oferece a saída de quem perdeu o e-mail", () => {
    const LOGIN = semComentarios(ler("(auth)/login/page.tsx"));
    expect(LOGIN).toContain('href="/recuperar-senha"');
    expect(LOGIN).toContain('href="/sem-acesso-ao-email"');
  });

  it("MORDE: essa saída NÃO autentica ninguém", () => {
    // Aceitar telefone aqui e tratá-lo como prova da conta seria recuperação
    // para quem apenas DIZ ser a dona.
    const P = semComentarios(ler("(auth)/sem-acesso-ao-email/page.tsx"));
    for (const proibido of [
      "createClient",
      "signInWith",
      "verifyOtp",
      "action",
      "useState",
    ]) {
      expect(P).not.toContain(proibido);
    }
  });

  it("a página não expõe jargão técnico para a mãe", () => {
    // Sem comentários: o JSDoc explica a decisão citando as palavras que a
    // TELA não pode ter. Medir o arquivo cru mediria a explicação, não a tela.
    const P = semComentarios(ler("(auth)/sem-acesso-ao-email/page.tsx"));
    for (const jargao of ["magic link", "magic-link", "token", "OTP", "entitlement"]) {
      expect(P.toLowerCase()).not.toContain(jargao.toLowerCase());
    }
  });
});
