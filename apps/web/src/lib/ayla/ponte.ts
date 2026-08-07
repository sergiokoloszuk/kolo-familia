import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { gerarPlano, PlanoIncompletoError } from "@/lib/ia/plano";
import { planoParaPdf } from "@/lib/plano/pdf";
import { enviarDocumento } from "./whatsappSender";
import { logEvent, logServerError } from "@/lib/log";
import { criarLinkAcesso } from "@/lib/auth/acesso-link";
import { avaliarProntidaoParaPlano } from "./prontidao-plano";
import { semOutrosMembros } from "./membro-escopo";

/**
 * Num pedido de plano EXPLÍCITO ("me traz um plano"), o desafio de verdade está
 * na CONVERSA — não na frase-gatilho. Puxa as últimas trocas pra o plano focar
 * EXATAMENTE no que foi discutido, sem virar genérico nem espalhar pra outros
 * temas/filhos. Falha → devolve a própria mensagem (nunca quebra).
 */
async function desafioDaConversa(
  supabase: SupabaseClient,
  familyId: string,
  mensagemAtual: string,
  membroAtipicoId: string | null,
): Promise<string> {
  try {
    // JANELA. Antes eram as 10 últimas mensagens, sem recorte de tempo nenhum —
    // e num caso real (03/08/2026) elas alcançaram uma conversa de 9h25 antes,
    // sobre arrumar o quarto. O bloco inteiro virou o "desafio", e o plano de
    // pinça e pegada do lápis saiu com o título "Guardar brinquedos com modelo
    // junto". Conteúdo certo, identidade de outro assunto.
    const desde = new Date(Date.now() - 45 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from("ayla_messages")
      .select("direcao, texto, created_at, membro_atipico_id")
      .eq("family_account_id", familyId)
      .gte("created_at", desde)
      .order("created_at", { ascending: false })
      .limit(10);
    // ⚠️ IDENTIDADE, NÃO SÓ TEMPO. A janela de 45 min foi posta pra impedir que
    // um assunto de 9h antes virasse o plano — mas tempo não diz DE QUEM é a
    // informação. Numa família com dois filhos, a conversa sobre o irmão estava
    // dentro da janela e entrava no desafio: o plano saía com o nome de uma
    // criança e o conteúdo da outra, em PDF, entregue. Ver `membro-escopo.ts`.
    const linhas = semOutrosMembros(
      (data ?? []) as Array<{ direcao: string; texto: string | null; membro_atipico_id?: string | null }>,
      membroAtipicoId,
    )
      .reverse()
      .map((m) => {
        const t = m.texto?.trim();
        if (!t) return null;
        return `${m.direcao === "inbound" ? "Mãe" : "Ayla"}: ${t.slice(0, 500)}`;
      })
      .filter((l): l is string => Boolean(l));
    // Sem conversa recente, o pedido de agora é o desafio — nunca um assunto
    // antigo que por acaso ficou sendo a última coisa no banco.
    if (linhas.length === 0) return mensagemAtual;
    return `A família pediu um plano. O PEDIDO DE AGORA é este: "${mensagemAtual.slice(0, 500)}" — o plano é sobre ISSO, e o título tem que refletir ISSO.\n\nA conversa abaixo serve pra você entender melhor a criança e o contexto. NÃO amplie pra outros temas, outros filhos, viagens ou eventos que aparecem nela: se o assunto da conversa for outro, ele é contexto, não é o plano.\n\nConversa recente:\n${linhas.join("\n")}`;
  } catch {
    return mensagemAtual;
  }
}

/**
 * Gera o PDF do plano, sobe no Storage (URL assinada, 1h) e envia como
 * documento no WhatsApp. Falha 100% silenciosa — o PDF é um bônus; se falhar,
 * o link segue normal. Z-API baixa o arquivo na hora do envio, então a URL
 * curta basta (e mantém o dado privado, sem URL pública permanente).
 */
async function entregarPdfDoPlano(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    phoneE164: string;
    titulo: string;
    secoes: Array<{ tipo: string; titulo: string; conteudo_markdown: string }>;
    nomeMembro?: string | null;
  },
): Promise<boolean> {
  try {
    const bytes = await planoParaPdf({
      titulo: params.titulo,
      nome: params.nomeMembro,
      secoes: params.secoes,
    });
    const path = `${params.familyId}/plano/${crypto.randomUUID()}.pdf`;
    const { error: upErr } = await supabase.storage
      .from("imagens")
      .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: false });
    if (upErr) throw upErr;
    const { data: signed } = await supabase.storage
      .from("imagens")
      .createSignedUrl(path, 3600);
    if (!signed?.signedUrl) throw new Error("sem signed url");

    const fileName = `${(params.titulo || "plano").replace(/[^\w\sÀ-ÿ-]/g, "").slice(0, 50).trim() || "plano"}.pdf`;
    const envio = await enviarDocumento({
      phoneE164: params.phoneE164,
      url: signed.signedUrl,
      fileName,
    });
    // Visibilidade REAL do envio. Antes isto era logEvent com severity "info" —
    // que nunca persiste (o limiar é warn+), então a gente achava que tinha
    // visibilidade e não tinha: nem sucesso nem falha apareciam. Agora fica no
    // ayla_send_log, com o messageId do provedor, que é o que permite cobrar a
    // Z-API quando ela aceita (200) e não entrega (caso Jacke, 22–24/07).
    await supabase.from("ayla_send_log").insert({
      family_account_id: params.familyId,
      template_key: "plano_pdf",
      payload: {
        fileName,
        bytes: bytes.length,
        phone: params.phoneE164,
        // ONDE O ARQUIVO ESTÁ, de verdade. A URL que a Z-API recebeu é assinada
        // e morre em 1h — guardá-la não responderia "que PDF a família recebeu?"
        // no dia seguinte. O caminho no Storage responde, e permite reassinar.
        midia_path: path,
        midia_tipo: "application/pdf",
        // Aceito pelo provedor, NÃO entregue — mesma leitura de `enviarTexto`.
        zaap_message_id: envio.messageId,
      },
      resposta_provider: envio.raw as Record<string, unknown> | null,
      status: "enviada",
      erro: null,
    });
    await logEvent({
      kind: "ayla_pdf_plano_ok",
      severity: "info",
      family_account_id: params.familyId,
      payload: { bytes: bytes.length, messageId: envio.messageId },
    });
    return true;
  } catch (e) {
    // Falha do PDF não quebra a resposta (o link segue), mas NÃO pode ser cega
    // pra nós nem pra ela: persiste, e quem chama deixa de prometer o PDF.
    await logServerError("ayla_pdf_plano_falha", e, {
      family_account_id: params.familyId,
    });
    await supabase.from("ayla_send_log").insert({
      family_account_id: params.familyId,
      template_key: "plano_pdf",
      payload: { titulo: params.titulo, phone: params.phoneE164 },
      resposta_provider: null,
      status: "falha",
      erro: e instanceof Error ? e.message.slice(0, 500) : "erro",
    });
    return false;
  }
}

/**
 * Plano que não veio completo (sem as seções práticas) NÃO é entregue — mas
 * também não pode virar silêncio: a mãe pediu um plano e ficaria sem resposta
 * nenhuma sobre ele. Aqui a Ayla assume e convida a pedir de novo.
 * Qualquer OUTRO erro segue silencioso (a conversa normal cobre).
 */
function recadoDePlanoIncompleto(e: unknown, contexto: string): string | null {
  if (!(e instanceof PlanoIncompletoError)) return null;
  console.warn(`[ayla:ponte] plano incompleto (${contexto}) — geradas=${e.geradas.join(",")}`);
  return "Comecei a montar teu plano e ele não ficou do jeito que eu quero te entregar — faltou justamente a parte do que fazer. Me pede de novo daqui a pouquinho? Aí eu monto inteirinho 🌿";
}

async function nomeDoMembro(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string | null,
): Promise<string | null> {
  if (!membroId) return null;
  const { data } = await supabase
    .from("membros_atipicos")
    .select("nome")
    .eq("id", membroId)
    .eq("family_account_id", familyId)
    .maybeSingle();
  return (data?.nome as string | undefined) ?? null;
}

/**
 * Ponte WhatsApp → app (Fase 3).
 *
 * A Ayla responde no WhatsApp (o momento). Quando a mãe traz um DESAFIO de
 * verdade — algo que renderia um plano completo —, montamos um "gostinho":
 * deixamos a pergunta dela já começada nas Estratégias e mandamos um
 * magic-link que abre o app JÁ LOGADO, direto na conversa, onde ela acha o
 * plano completo (Fase 1) com toda a profundidade.
 *
 * Princípios:
 * - Só em desafio (crise acolhe; desabafo ouve; dúvida é curta) — Fase 2.
 * - No máximo uma vez por dia, pra não virar spam de link.
 * - Falha 100% silenciosa: qualquer erro → null, e a resposta do WhatsApp
 *   segue normal, sem link. A ponte nunca pode quebrar a conversa.
 */
/** Freio curto anti-duplicata: nunca gera 2 planos na mesma janela (vale até
 * com forcar=true — rede de segurança contra double-dispatch). */
const PLANO_COOLDOWN_MIN = 3;
/** No caminho AUTOMÁTICO: entregou um plano nas últimas N horas? Não insiste.
 *  (Pedido explícito da mãe fura este freio — ela pediu.) */
const JANELA_DEDUP_HORAS = 20;
/** Mínimo de mensagens da mãe antes de um plano automático. Traduz a
 *  preocupação da Karina: quem mal falou não tem perfil pra um plano bom. */
const MIN_MENSAGENS_DA_MAE = 3;


/**
 * Mint de um magic-link que abre o app já logado num destino interno.
 * Reusado pela ponte e pelo follow-up de plano (Fase 4). Devolve null se
 * não conseguir (sem e-mail, falha no admin) — o chamador decide o fallback.
 */
export async function gerarMagicLink(
  supabase: SupabaseClient,
  params: { familyId: string; next: string },
): Promise<string | null> {
  try {
    const next =
      params.next.startsWith("/") && !params.next.startsWith("//")
        ? params.next
        : "/estrategias";

    // Token NOSSO (acessos_app). Antes isto usava o magic-link do Supabase, e o
    // GoTrue guarda UM token por usuário: cada link novo matava os anteriores.
    // A mãe tocava no link de ontem e caía no /login pedindo senha que ela não
    // tem. Agora vários links valem ao mesmo tempo, por 7 dias.
    const admin = createServiceRoleClient();
    return await criarLinkAcesso(admin, { familyId: params.familyId, next, criadoPor: "ayla" });
  } catch (e) {
    console.warn(
      "[ayla:ponte] falha ao gerar magic-link:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

export async function montarPonteWhatsApp(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string | null;
    mensagem: string;
    /** O parser detectou um desafio concreto nesta mensagem. */
    temDesafio: boolean;
    /** Telefone pra enviar o PDF do plano como documento. */
    phoneE164: string;
    /** Pedido explícito de plano: pula os gates (dedup/intenção/temDesafio). */
    forcar?: boolean;
  },
): Promise<string | null> {
  const { familyId, membroAtipicoId, mensagem, phoneE164, forcar } = params;

  try {
    // Freio anti-duplicata (SEMPRE, mesmo com forcar): se acabamos de mandar um
    // plano nos últimos minutos, não manda outro. Rede de segurança contra
    // double-dispatch que escape da idempotência do inbound.
    const cooldownDesde = new Date(
      Date.now() - PLANO_COOLDOWN_MIN * 60_000,
    ).toISOString();
    const { data: recem } = await supabase
      .from("ayla_messages")
      .select("id")
      .eq("family_account_id", familyId)
      .eq("direcao", "outbound")
      .gte("enviada_em", cooldownDesde)
      .ilike("texto", "%/auth/wa%")
      .limit(1);
    if (recem && recem.length > 0) {
      console.log("[ayla:ponte] sem plano — cooldown: plano enviado há poucos minutos");
      return null;
    }

    // MEIO-TERMO, agora de verdade (29/07). O 6d4e21a tirou o auto-disparo
    // porque o plano atropelava a conversa e saía genérico pra quem tinha
    // acabado de chegar — mas o que ficou no lugar foi "a mãe precisa dizer a
    // palavra plano", e conversas de dias terminavam sem entrega nenhuma.
    // O que a Karina pediu era "conversa rica → ao ter elementos suficientes,
    // entregar": três freios baratos + o gate de suficiência.
    let temaAuto: string | null = null;
    if (!forcar) {
      // Freio 1 — não insiste: já entregou plano nas últimas 20h?
      const desdeDedup = new Date(Date.now() - JANELA_DEDUP_HORAS * 3600_000).toISOString();
      const { data: recentes } = await supabase
        .from("ayla_messages")
        .select("id")
        .eq("family_account_id", familyId)
        .eq("direcao", "outbound")
        .gte("enviada_em", desdeDedup)
        .ilike("texto", "%/auth/wa%")
        .limit(1);
      if (recentes && recentes.length > 0) {
        console.log("[ayla:ponte] sem auto-plano — já entregou um nas últimas 20h");
        return null;
      }

      // Freio 2 — a preocupação da Karina: quem acabou de chegar e mal falou
      // não tem perfil pra um plano bom. Exige conversa de verdade antes.
      const { count: inbounds } = await supabase
        .from("ayla_messages")
        .select("id", { count: "exact", head: true })
        .eq("family_account_id", familyId)
        .eq("direcao", "inbound");
      if ((inbounds ?? 0) < MIN_MENSAGENS_DA_MAE) {
        console.log(`[ayla:ponte] sem auto-plano — só ${inbounds ?? 0} mensagem(ns) da mãe`);
        return null;
      }

      // Freio 3 (barato, antes de gastar IA): mensagem sem substância dificilmente
      // fecha o critério — e o parser não marcou desafio nenhum.
      if (!params.temDesafio && mensagem.trim().length < 40) {
        console.log("[ayla:ponte] sem auto-plano — mensagem curta e sem desafio");
        return null;
      }

      // Gate de suficiência: problema + contexto + exemplo concreto.
      const prontidao = await avaliarProntidaoParaPlano(supabase, {
        familyId,
        mensagemAtual: mensagem,
      });
      console.log(
        `[ayla:ponte] prontidão=${prontidao.pronto} tema="${prontidao.tema ?? ""}" motivo="${prontidao.motivo}"`,
      );
      if (!prontidao.pronto) return null;
      temaAuto = prontidao.tema;
    }

    // Gera o plano completo na hora (single-call) a partir do desafio. Fica
    // salvo em /planos — então o link abre o plano JÁ PRONTO (não precisa
    // clicar em "gerar"), e o PDF vai junto no WhatsApp.
    // Pedido explícito ("me traz um plano") → o tema real está na CONVERSA, não
    // na frase-gatilho. Desafio direto → a própria mensagem já é o tema.
    // No caminho automático o tema vem do gate (o desafio que a conversa
    // construiu), então o plano nasce focado nele — e não na última frase solta.
    const desafioReal = forcar
      ? await desafioDaConversa(supabase, familyId, mensagem, membroAtipicoId)
      : `${await desafioDaConversa(supabase, familyId, mensagem, membroAtipicoId)}\n\n<foco_do_plano>\n${temaAuto}\n</foco_do_plano>\nO plano deve ser EXCLUSIVAMENTE sobre esse foco.`;
    console.log(`[ayla:ponte] gerando plano (forcar=${Boolean(forcar)}) membro=${membroAtipicoId ?? "null"}`);
    const plano = await gerarPlano({
      supabase,
      familyId,
      membroAtipicoId,
      desafio: desafioReal,
      origem: "estrategias",
      // O tema que a prontidão validou — fallback do título quando
      // `analisarDesafio` devolve algo que admite falta de contexto.
      temaValidado: temaAuto,
    });
    console.log(`[ayla:ponte] plano gerado id=${plano.id} secoes=${plano.secoes.length}`);

    const nomeMembro = await nomeDoMembro(supabase, familyId, membroAtipicoId);
    const pdfOk = await entregarPdfDoPlano(supabase, {
      familyId,
      phoneE164,
      titulo: plano.titulo,
      secoes: plano.secoes,
      nomeMembro,
    });

    const link = await gerarMagicLink(supabase, { familyId, next: `/planos/${plano.id}` });
    console.log(`[ayla:ponte] magic-link ${link ? "ok" : "FALHOU"} → /planos/${plano.id}`);

    // "Plano estratégico com atividades", nunca "um plano" seco: pra a mãe não
    // entender plano de ASSINATURA e perguntar o preço em vez de usar o material.
    // Nada de falar em custo aqui — sem ela ter perguntado, só planta a dúvida.
    //
    // E o principal: PEDIR QUE ELA VOLTE. Receber o plano é um momento que
    // encanta, e esse encanto se perde se ela abre sozinha e a conversa morre.
    // Se não voltar, o cron de recuperação (?tipo=recuperacao_plano_3min)
    // reabre — mas o convite tem que sair já aqui.
    const base = pdfOk
      ? "Montei um plano estratégico com atividades sobre isso — mandei em PDF aqui em cima 👆 (dá pra salvar e imprimir)."
      : "Montei um plano estratégico com atividades sobre isso 🌿";
    const volte =
      "\nDá uma olhada com calma e volta aqui pra me contar o que você achou? Quero muito saber se faz sentido pro dia a dia de vocês — e se algo não encaixou, a gente ajusta. 💛";
    if (!link) return `${base}${volte}`;
    return `${base}\nPra ver no app (já entra direto): ${link}${volte}`;
  } catch (e) {
    const recado = recadoDePlanoIncompleto(e, "ponte");
    if (recado) return recado;
    console.warn(
      "[ayla:ponte] falha ao montar ponte WhatsApp→app:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * Gera o roteiro leve de fim de semana (Fase 5) a partir do que a mãe
 * contou no WhatsApp e devolve uma mensagem com o magic-link pro plano.
 * Flexível, sem grade rígida (a variante do gerarPlano cuida do tom).
 * Falha silenciosa → null (a Ayla segue com a resposta normal).
 */
export async function montarPlanoFimDeSemana(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string | null;
    contexto: string;
    nomeMembro?: string | null;
    phoneE164: string;
  },
): Promise<string | null> {
  try {
    const desafio =
      params.contexto.trim() ||
      "Montar um fim de semana leve e gostoso, sem grade rígida, com o que a família já tem em vista.";

    const plano = await gerarPlano({
      supabase,
      familyId: params.familyId,
      membroAtipicoId: params.membroAtipicoId,
      desafio,
      variante: "fim_de_semana",
      origem: "fim_de_semana",
    });

    const pdfOk = await entregarPdfDoPlano(supabase, {
      familyId: params.familyId,
      phoneE164: params.phoneE164,
      titulo: plano.titulo,
      secoes: plano.secoes,
      nomeMembro: params.nomeMembro,
    });

    const link = await gerarMagicLink(supabase, {
      familyId: params.familyId,
      next: `/planos/${plano.id}`,
    });

    const ref = params.nomeMembro ? ` pra ${params.nomeMembro}` : "";
    const base = pdfOk
      ? `Montei um roteiro leve pro fim de semana${ref} — mandei em PDF aqui em cima 👆.`
      : `Montei um roteiro leve pro fim de semana${ref} 🌿`;
    const volte = "\nDepois me conta o que você achou? Adoro saber se deu certo. 💛";
    if (!link) return `${base}${volte}`;
    return `${base}\nPra ver no app (já entra direto): ${link}${volte}`;
  } catch (e) {
    const recado = recadoDePlanoIncompleto(e, "fim_de_semana");
    if (recado) return recado;
    console.warn(
      "[ayla:ponte] falha ao montar plano de fim de semana:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}

/**
 * Fluxo GUIADO: gera o plano PADRÃO a partir do relato que a mãe mandou (o
 * "como está hoje"), cruzando com os interesses do Perfil, e devolve a mensagem
 * com o PDF + magic-link. Espelha montarPlanoFimDeSemana (variante padrão).
 * Falha silenciosa → null (a Ayla segue com a resposta normal).
 */
export async function montarPlanoDoRelato(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroAtipicoId: string | null;
    contexto: string;
    nomeMembro?: string | null;
    phoneE164: string;
  },
): Promise<string | null> {
  try {
    const desafio = params.contexto.trim();
    if (!desafio) return null;

    const plano = await gerarPlano({
      supabase,
      familyId: params.familyId,
      membroAtipicoId: params.membroAtipicoId,
      desafio,
      origem: "estrategias",
    });

    const pdfOk = await entregarPdfDoPlano(supabase, {
      familyId: params.familyId,
      phoneE164: params.phoneE164,
      titulo: plano.titulo,
      secoes: plano.secoes,
      nomeMembro: params.nomeMembro,
    });

    const link = await gerarMagicLink(supabase, {
      familyId: params.familyId,
      next: `/planos/${plano.id}`,
    });

    const ref = params.nomeMembro ? ` pra ${params.nomeMembro}` : "";
    const base = pdfOk
      ? `Prontinho — montei o plano estratégico${ref} com o que você me contou, usando os interesses que a gente já sabe 💛 Mandei em PDF aqui em cima 👆.`
      : `Prontinho — montei o plano estratégico${ref} com o que você me contou, usando os interesses que a gente já sabe 💛`;
    const volte =
      "\nDá uma olhada e volta aqui pra me dizer o que achou? Se algo não encaixou no dia de vocês, a gente ajusta.";
    if (!link) return `${base}${volte}`;
    return `${base}\nPra ver no app (já entra direto): ${link}${volte}`;
  } catch (e) {
    const recado = recadoDePlanoIncompleto(e, "relato");
    if (recado) return recado;
    console.warn(
      "[ayla:ponte] falha ao montar plano do relato:",
      e instanceof Error ? e.message : e,
    );
    return null;
  }
}
