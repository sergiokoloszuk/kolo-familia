/**
 * CATÁLOGO DE ARTEFATOS — a fonte ÚNICA do que a Ayla pode oferecer, gerar e
 * prometer, por canal.
 *
 * O PRINCÍPIO: UTILIDADE NÃO SIGNIFICA DISPONIBILIDADE.
 *
 * Um cartão "como me ajudar" seria útil. Um resumo pra professora seria útil.
 * Uma carteirinha de direitos seria muito útil. Nada disso existe — e o modelo,
 * que é bom em ser prestativo, oferece assim mesmo. Em 06/08/2026 uma mãe ouviu
 * "a carteirinha vai sair logo aí pra você 👆", mandou o laudo da filha, mandou
 * foto da medicação, cobrou duas vezes, e nunca recebeu nada: `carteirinha` não
 * existia em uma linha sequer do produto.
 *
 * ⚠️ POR QUE ISTO É CÓDIGO E NÃO SÓ UMA FRASE NO PROMPT. O prompt JÁ dizia
 * "nunca prometa documento que não existe", com todas as letras, e a promessa
 * saiu do mesmo jeito. Uma proibição genérica compete com a instrução de ser
 * prestativa e perde. O que não perde é o orquestrador saber a lista: o modelo
 * recebe só o que existe NAQUELE canal, e a rede de fronteiras barra a promessa
 * que escapar (ver `deteccao-catalogo.ts`).
 *
 * AO HABILITAR UM ARTEFATO NOVO: mude `gera`/`oferece` aqui e implemente a
 * ação real. O prompt dos dois canais e a rede acompanham sozinhos — é esse o
 * ponto de existir uma fonte só.
 */

export type Canal = "whatsapp" | "web";

export type Artefato = {
  /** Chave estável — vai pra log e pra teste, não pra tela. */
  id: string;
  /** Como a Ayla chama isso na conversa. Primeiro nome = o preferido. */
  nomes: string[];
  /**
   * O sistema GERA e ENTREGA neste canal? Só com `true` a Ayla pode dizer que
   * vai montar/mandar. É o campo que separa promessa de invenção.
   */
  gera: Record<Canal, boolean>;
  /**
   * A Ayla pode OFERECER — inclusive mandando o link de onde a família faz.
   * Oferecer sem gerar é legítimo ("dá pra criar no app, aqui é o link"); o que
   * não pode é dizer que ELA vai montar e enviar.
   */
  oferece: Record<Canal, boolean>;
  /** O que acontece de verdade quando é aceito. Vai pro prompt. */
  entrega: string;
};

/**
 * HABILITADOS — cada um tem uma ação real por trás, e o comentário diz qual.
 * Se a ação sumir, a linha sai daqui no mesmo commit.
 */
export const ARTEFATOS: readonly Artefato[] = [
  {
    id: "plano",
    nomes: ["plano estratégico com atividades", "plano estratégico"],
    // `lib/ia/plano.ts` → `gerarPlano` + PDF + magic-link (`lib/ayla/ponte.ts`).
    gera: { whatsapp: true, web: true },
    oferece: { whatsapp: true, web: true },
    entrega: "sai em PDF no WhatsApp E com link do app, sempre os dois juntos",
  },
  {
    id: "rotina_visual",
    nomes: ["rotina visual", "rotina em cartões"],
    // `lib/ayla/rotina-guiada.ts` → conduz, gera os cartões e manda o PDF.
    gera: { whatsapp: true, web: true },
    oferece: { whatsapp: true, web: true },
    entrega: "sai em PDF no WhatsApp E com link, sempre os dois",
  },
  {
    id: "historia",
    nomes: ["história personalizada", "história social"],
    // ⚠️ NÃO É GERADA NO WHATSAPP. O orquestrador manda um magic-link pra
    // `/historias/criar` e quem cria é a família, no app. Marcar `gera: true`
    // aqui faria a Ayla prometer um arquivo que ninguém monta — o erro da
    // carteirinha, com outro nome.
    gera: { whatsapp: false, web: true },
    oferece: { whatsapp: true, web: true },
    entrega: "é criada no app (Lúdico → Histórias) — mande o link, não prometa arquivo",
  },
  {
    id: "relatorio_escola",
    nomes: ["relatório para a escola", "relatório para o terapeuta"],
    // Feito no app, em Evolução → Relatório.
    gera: { whatsapp: false, web: true },
    oferece: { whatsapp: true, web: true },
    entrega: "é feito no app (Evolução → Relatório) — mande o link; NÃO chega em PDF pelo WhatsApp",
  },
];

/**
 * REGISTRADOS E DESLIGADOS — desenhados, decididos, ainda sem implementação.
 *
 * Ficam aqui de propósito, e não numa lista de "proibidos": o dia em que
 * existirem, habilitar é mudar uma linha. Enquanto `gera` e `oferece` forem
 * falsos, valem exatamente como qualquer coisa que não existe — a Ayla ajuda
 * com o CONTEÚDO na conversa e não promete arquivo nenhum.
 */
export const ARTEFATOS_FUTUROS: readonly Artefato[] = [
  {
    id: "atividade_personalizada",
    nomes: ["atividade personalizada", "atividade sob medida"],
    gera: { whatsapp: false, web: false },
    oferece: { whatsapp: false, web: false },
    entrega: "(não implementado)",
  },
  {
    id: "resumo_escola",
    nomes: ["resumo para a professora", "resumo funcional para a escola"],
    gera: { whatsapp: false, web: false },
    oferece: { whatsapp: false, web: false },
    entrega: "(não implementado)",
  },
  {
    id: "cartao_como_me_ajudar",
    nomes: ["cartão como me ajudar", "cartão funcional"],
    gera: { whatsapp: false, web: false },
    oferece: { whatsapp: false, web: false },
    entrega: "(não implementado — NÃO é carteirinha nem documento de direitos)",
  },
  {
    id: "resumo_consulta",
    nomes: ["resumo para a consulta", "resumo para o terapeuta"],
    gera: { whatsapp: false, web: false },
    oferece: { whatsapp: false, web: false },
    entrega: "(não implementado — só observações da família, nunca documento clínico)",
  },
  {
    id: "resumo_evolucao",
    nomes: ["resumo de evolução", "registro de evolução"],
    gera: { whatsapp: false, web: false },
    oferece: { whatsapp: false, web: false },
    entrega: "(não implementado)",
  },
];

/**
 * NUNCA — não é "ainda não". São documentos com efeito legal ou clínico, e a
 * Kolo não os emite em canal nenhum, agora ou depois. Habilitar qualquer um
 * destes exige decisão fora deste arquivo.
 */
export const ARTEFATOS_PROIBIDOS: ReadonlyArray<{ id: string; nomes: string[] }> = [
  { id: "carteirinha", nomes: ["carteirinha", "carteira de identificação", "ciptea"] },
  { id: "laudo", nomes: ["laudo"] },
  { id: "diagnostico_documento", nomes: ["documento de diagnóstico"] },
  { id: "declaracao", nomes: ["declaração"] },
  { id: "atestado", nomes: ["atestado"] },
  { id: "prescricao", nomes: ["prescrição", "receita"] },
  { id: "documento_oficial", nomes: ["documento oficial"] },
  { id: "dossie", nomes: ["dossiê", "panorama completo"] },
];

export function artefatosDoCanal(canal: Canal): readonly Artefato[] {
  return ARTEFATOS.filter((a) => a.oferece[canal]);
}

export function podeGerar(id: string, canal: Canal): boolean {
  return ARTEFATOS.some((a) => a.id === id && a.gera[canal]);
}

/**
 * O bloco do prompt, DERIVADO da tabela acima — o modelo recebe só o que existe
 * naquele canal. Substitui o antigo `CATALOGO` escrito à mão, que listava três
 * artefatos fixos e não sabia de canal nenhum.
 */
export function catalogoParaPrompt(canal: Canal): string {
  const disponiveis = artefatosDoCanal(canal);
  const linhas = disponiveis.map((a, i) => {
    const comoEntrega = a.gera[canal]
      ? `VOCÊ ENTREGA: ${a.entrega}.`
      : `VOCÊ NÃO MONTA ISTO AQUI — ${a.entrega}.`;
    return `${i + 1}. ${a.nomes[0].toUpperCase()} — ${comoEntrega}`;
  });

  const naoGera = disponiveis.filter((a) => !a.gera[canal]).map((a) => a.nomes[0]);

  return `# O que EXISTE pra entregar (não invente documento)
Esta lista é COMPLETA para este canal. O que não está aqui, não existe — e "seria útil" não é o mesmo que "existe".
${linhas.join("\n")}

DUAS COISAS DIFERENTES, e a distinção é obrigatória:
- SUGERIR UMA NECESSIDADE e ajudar com o CONTEÚDO aqui na conversa é sempre permitido. "Posso te passar algumas atividades aqui", "posso organizar contigo os pontos pra levar na escola" — isso você faz agora, em texto, e é ótimo.
- PROMETER UM ARTEFATO é só para os itens acima marcados como VOCÊ ENTREGA. Nunca diga "vou montar", "vou gerar", "vou criar", "te mando", "te envio em PDF", "já está saindo" nem "está quase pronto" sobre qualquer outra coisa.${
    naoGera.length > 0
      ? `\n- ${naoGera.join(" e ")}: você OFERECE e manda o link, mas quem monta é a família no app. Não diga que você vai montar nem que vai enviar o arquivo.`
      : ""
  }

NUNCA, em canal nenhum: carteirinha (de direitos, oficial ou qualquer outra), laudo, diagnóstico em documento, declaração, atestado, prescrição, documento oficial, dossiê, "panorama completo", ou arquivo/PDF de qualquer coisa fora da lista. Se pedirem, diga com franqueza que isso não é algo que você emite, explique quem emite quando você souber, e AJUDE com o que é seu — o conteúdo, na conversa.
E nunca anuncie arquivo no futuro: quem manda o arquivo é o sistema, junto com a mensagem. Se você não vê o arquivo, não prometa o arquivo.${
    canal === "whatsapp"
      ? `\nIMAGEM: você NÃO gera imagem aqui. Cartões e desenhos saem do app, e a rotina visual já vem com os cartões prontos no PDF.`
      : ""
  }`;
}
