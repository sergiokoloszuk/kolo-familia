import { describe, expect, it } from "vitest";
import { aplicarPisosDeRotinaDitada, etapasDitadasEmLinhas, familiaDitouSequencia, opcaoDeContinuarRotinaNoLudico, pediuApoioVisual, perguntaDeTema, temaConfirmadoNestaRotina } from "./rotina-guiada";
import { gerarRotina } from "@/lib/ludico/rotina-servico";
import { destinoPermitido } from "@/lib/auth/destino-link";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ProntidaoRotina } from "./prontidao-rotina";
import { readFileSync } from "node:fs";

const pedido = "Quero montar uma rotina visual para a Manu\nCafé\nBanho\nEscola\nCasa da vó";
const falta: ProntidaoRotina = {
  desfecho: "falta",
  tamanho: "rotina",
  visual: false,
  reusaHistorico: false,
  pergunta: "Essa sequência cobre o dia inteiro ou só a manhã?",
  parteClinica: null,
  motivo: "falta o recorte de tempo",
};

describe("Manu: sequência ditada já define o recorte da rotina", () => {
  it("reproduz os dois sinais objetivos ignorados no turno real", () => {
    expect(familiaDitouSequencia(pedido)).toBe(true);
    expect(pediuApoioVisual(pedido)).toBe(true);
  });

  it("não pede o dia inteiro de novo e respeita o visual pedido", () => {
    const d = aplicarPisosDeRotinaDitada(falta, pedido);
    expect(d.desfecho).toBe("suficiente");
    expect(d.pergunta).toBeNull();
    expect(d.visual).toBe(true);
  });

  it("cria as quatro etapas diretamente, sem pedir ao gerador para completá-las", async () => {
    expect(etapasDitadasEmLinhas(pedido)).toEqual(["Café", "Banho", "Escola", "Casa da vó"]);
    const resultado = await gerarRotina(null as unknown as SupabaseClient, {
      familyId: null,
      membroAtipicoId: "manu-id",
      nome: "Manu",
      idade: 6,
      historico: [{ de: "mae", texto: pedido }],
      mensagem: pedido,
      sequenciaDitada: etapasDitadasEmLinhas(pedido),
      pularProntidao: true,
    });
    expect(resultado.desfecho).toBe("gerou");
    if (resultado.desfecho !== "gerou") return;
    expect(resultado.rotinas).toHaveLength(1);
    expect(resultado.rotinas[0].tarefas).toEqual([
      { texto: "Café", hora: null }, { texto: "Banho", hora: null },
      { texto: "Escola", hora: null }, { texto: "Casa da vó", hora: null },
    ]);
  });

  it("não converte mero pedido sem sequência em rotina pronta", () => {
    expect(aplicarPisosDeRotinaDitada(falta, "Quero uma rotina visual para a Manu").desfecho).toBe("falta");
  });

  it("não publica para o irmão se o pedido literal nomeia Manu", async () => {
    const resultado = await gerarRotina(null as unknown as SupabaseClient, {
      familyId: null,
      membroAtipicoId: "mario-id",
      nome: "Mario",
      idade: 8,
      historico: [{ de: "mae", texto: pedido }],
      mensagem: pedido,
      sequenciaDitada: etapasDitadasEmLinhas(pedido),
      pularProntidao: true,
      membrosDaFamilia: [{ id: "mario-id", nome: "Mario" }, { id: "manu-id", nome: "Manu" }],
    });
    expect(resultado.desfecho).toBe("conflito_identidade");
  });

  it("separa a escolha do tema e oferece o quadro da criança no Lúdico", () => {
    const tema = perguntaDeTema("Manu", ["Dinossauros", "Animais"]);
    expect(tema).toContain("*Para ilustrar os cartões*\n");
    expect(tema).toContain("1️⃣ *Dinossauros*\n2️⃣ *Animais*");
    const destino = "/ludico/rotinas/12dc78f3-6367-4b86-8d01-fb6f5be1abcc";
    expect(destinoPermitido(destino)).toBe(true);
    const convite = opcaoDeContinuarRotinaNoLudico("Manu", `https://exemplo.test${destino}`);
    expect(convite).toContain("*Prefere continuar no Lúdico?*");
    expect(convite).toContain("rotina de Manu");
    expect(convite).toContain("*Gerar cartões*");
    expect(convite).toContain(destino);
    expect(opcaoDeContinuarRotinaNoLudico("Manu", null)).toBe("");
  });

  it("preserva limite clínico ou avaliação de que não é rotina", () => {
    expect(aplicarPisosDeRotinaDitada({ ...falta, desfecho: "limite_atuacao" }, pedido).desfecho).toBe("limite_atuacao");
    expect(aplicarPisosDeRotinaDitada({ ...falta, desfecho: "nao_e_rotina" }, pedido).desfecho).toBe("nao_e_rotina");
  });

  it("recupera Fada rosa quando a própria Ayla confirmou o tema para Manu", () => {
    const conversa = [
      { de: "mae" as const, texto: "Fada rosa", membroId: null },
      { de: "kolo" as const, texto: "Fada rosa anotado pro tema dos cartões — a Manu vai adorar 🌸", membroId: "manu-id" },
      { de: "mae" as const, texto: pedido, membroId: null },
    ];
    expect(temaConfirmadoNestaRotina(conversa, "manu-id")).toBe("Fada rosa");
    expect(temaConfirmadoNestaRotina(conversa, "mario-id")).toBeNull();
  });

  it("não interpreta uma fala curta solta como tema sem confirmação", () => {
    expect(temaConfirmadoNestaRotina([
      { de: "mae", texto: "Dinossauro" },
      { de: "kolo", texto: "Vamos organizar os passos", membroId: "manu-id" },
    ], "manu-id")).toBeNull();
  });

  it("não marca pronta uma rotina com qualquer cartão sem imagem", () => {
    const rota = readFileSync(new URL("../../app/api/ludico/gerar-rotina/route.ts", import.meta.url), "utf8");
    expect(rota).toContain("imagens.some((url) => !url)");
    expect(rota).toContain("gravadas.some((t) => !t.imagem_url)");
    expect(rota.indexOf("gravadas.some((t) => !t.imagem_url)")).toBeLessThan(rota.indexOf('cards_status: "pronto"'));
  });
});
