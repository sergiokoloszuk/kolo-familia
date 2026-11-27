import type { SupabaseClient } from "@supabase/supabase-js";
import type { EntradaConversacional, SaidaConversacional } from "@/lib/ia/provider";
import { MODELO_CONVERSA } from "@/lib/ia/provider";
import { resolverDocumento, lerRascunho } from "@/lib/ayla/documentos";
import { logEvent } from "@/lib/log";
import {
  COOLDOWN_REENVIO_SEG,
  DURACAO_MIN,
  MAX_CHARS_MENSAGEM,
  MAX_PEDIDOS_POR_HORA,
  MAX_REENVIOS,
  MAX_TENTATIVAS,
  SYSTEM_RESUMO,
  VALIDADE_CODIGO_MIN,
  chaveDoTelefone,
  estadoDaSessao,
  gerarCodigo,
  gerarToken,
  hash,
  montarSystemDemonstracao,
  segundosRestantes,
  textoDoCodigo,
  textoDoResumo,
  validarDados,
  type EstadoSessao,
} from "./regras";

/**
 * DEMONSTRAÇÃO DA AYLA — o que grava, envia e conversa (PEND-259).
 *
 * Quatro passos, cada um uma rota pública em `/api/demo/*`:
 *   1. `pedirCodigo`     — nome, e-mail, WhatsApp → código no WhatsApp;
 *   2. `confirmarCodigo` — código certo → token da conversa e 20 minutos;
 *   3. `conversar`       — uma mensagem → a resposta da Ayla;
 *   4. `encerrar`        — o resumo vai para o WhatsApp confirmado.
 *
 * ⚠️ "1 NÚMERO = 1 DEMONSTRAÇÃO" é do banco (índice único da 0101). Aqui o app
 * só antecipa a recusa para dar a mensagem certa; a corrida é do Postgres.
 *
 * ⚠️ A CONDUÇÃO É DA RESPONSÁVEL. O texto que orienta a demonstração é o
 * documento `demonstracao` do Admin (versionado, ativar/voltar como o Core).
 * Sem documento ativo, a demonstração NÃO abre: não existe condução de reserva
 * no código, porque ela viraria uma segunda fonte para a mesma decisão.
 *
 * Toda dependência externa (banco, Z-API, modelo) entra por `Dependencias`,
 * para os testes exercitarem o fluxo de verdade sem rede.
 */

export type Dependencias = {
  admin: SupabaseClient;
  enviarWhatsApp: (p: { phoneE164: string; texto: string }) => Promise<unknown>;
  gerar: (e: EntradaConversacional) => Promise<SaidaConversacional>;
  agora?: () => number;
};

const TABELA = "demonstracoes_ayla";
const MENSAGENS = "demonstracao_mensagens";
const PROVIDER = "openai" as const;

type LinhaDemo = {
  id: string;
  nome: string;
  email: string;
  telefone_e164: string;
  telefone_chave: string;
  codigo_hash: string | null;
  codigo_expira_em: string | null;
  tentativas: number;
  reenvios: number;
  ultimo_envio_em: string | null;
  verificado_em: string | null;
  expira_em: string | null;
  turnos: number;
  encerrada_em: string | null;
  resumo_reservado_em: string | null;
  resumo_enviado_em: string | null;
};

const COLUNAS =
  "id, nome, email, telefone_e164, telefone_chave, codigo_hash, codigo_expira_em, tentativas, reenvios, ultimo_envio_em, verificado_em, expira_em, turnos, encerrada_em, resumo_reservado_em, resumo_enviado_em";

const UNIQUE = "23505";

function iso(ms: number): string {
  return new Date(ms).toISOString();
}

async function registrar(kind: string, severity: "info" | "warn" | "error", message: string, payload: Record<string, unknown> = {}) {
  // ⚠️ Nada de telefone, e-mail, código ou texto da conversa no log.
  await logEvent({ kind, severity, persistir: true, message, payload });
}

// ─── 1. pedir o código ──────────────────────────────────────────────────

export type ResultadoPedido =
  | { ok: true; demoId: string }
  | { ok: false; motivo: "dados_invalidos"; campo: string }
  | { ok: false; motivo: "cooldown"; segundosRestantes: number }
  | { ok: false; motivo: "ja_usou" | "max_reenvios" | "limite_global" | "envio_falhou" | "erro" };

export async function pedirCodigo(
  deps: Dependencias,
  entrada: { nome?: unknown; email?: unknown; whatsapp?: unknown; aceite?: unknown },
): Promise<ResultadoPedido> {
  const agora = deps.agora?.() ?? Date.now();
  const v = validarDados(entrada);
  if (!v.ok) return { ok: false, motivo: "dados_invalidos", campo: v.campo };
  const { nome, email, telefoneE164 } = v.dados;
  const chave = chaveDoTelefone(telefoneE164);
  const { admin } = deps;

  try {
    const { data: usada, error: erroUsada } = await admin
      .from(TABELA)
      .select("id")
      .eq("telefone_chave", chave)
      .not("verificado_em", "is", null)
      .maybeSingle();
    if (erroUsada) throw erroUsada;
    if (usada) return { ok: false, motivo: "ja_usou" };

    const { count, error: erroCount } = await admin
      .from(TABELA)
      .select("id", { count: "exact", head: true })
      .gte("created_at", iso(agora - 60 * 60 * 1000));
    if (erroCount) throw erroCount;
    if ((count ?? 0) >= MAX_PEDIDOS_POR_HORA) {
      await registrar("demo_limite_global", "warn", "freio global de pedidos de código acionado", { count });
      return { ok: false, motivo: "limite_global" };
    }

    const { data: pendente, error: erroPendente } = await admin
      .from(TABELA)
      .select(COLUNAS)
      .eq("telefone_chave", chave)
      .is("verificado_em", null)
      .maybeSingle();
    if (erroPendente) throw erroPendente;

    const codigo = gerarCodigo();
    const comum = {
      nome,
      email,
      telefone_e164: telefoneE164,
      codigo_hash: hash(codigo),
      codigo_expira_em: iso(agora + VALIDADE_CODIGO_MIN * 60 * 1000),
      tentativas: 0,
      ultimo_envio_em: iso(agora),
    };

    let demoId: string;
    const linha = pendente as LinhaDemo | null;
    if (linha) {
      const desde = linha.ultimo_envio_em ? (agora - Date.parse(linha.ultimo_envio_em)) / 1000 : Infinity;
      if (desde < COOLDOWN_REENVIO_SEG) {
        return { ok: false, motivo: "cooldown", segundosRestantes: Math.ceil(COOLDOWN_REENVIO_SEG - desde) };
      }
      if (linha.reenvios >= MAX_REENVIOS) return { ok: false, motivo: "max_reenvios" };
      const { data: upd, error } = await admin
        .from(TABELA)
        .update({ ...comum, reenvios: linha.reenvios + 1 })
        .eq("id", linha.id)
        .is("verificado_em", null)
        .select("id");
      if (error) throw error;
      if (!Array.isArray(upd) || upd.length === 0) return { ok: false, motivo: "ja_usou" };
      demoId = linha.id;
    } else {
      const { data: ins, error } = await admin
        .from(TABELA)
        .insert({
          ...comum,
          telefone_chave: chave,
          reenvios: 0,
          turnos: 0,
          verificado_em: null,
          encerrada_em: null,
          resumo_reservado_em: null,
          resumo_enviado_em: null,
        })
        .select("id")
        .single();
      if (error) {
        // Duplo clique: o outro pedido criou a linha pendente primeiro.
        if (error.code === UNIQUE) return { ok: false, motivo: "cooldown", segundosRestantes: COOLDOWN_REENVIO_SEG };
        throw error;
      }
      demoId = (ins as { id: string }).id;
    }

    try {
      await deps.enviarWhatsApp({ phoneE164: telefoneE164, texto: textoDoCodigo(codigo) });
    } catch (e) {
      await registrar("demo_codigo_envio_falhou", "error", "código da demonstração não saiu pela Z-API", {
        demo_id: demoId,
        erro: e instanceof Error ? e.message : "erro",
      });
      return { ok: false, motivo: "envio_falhou" };
    }
    await registrar("demo_codigo_enviado", "info", "código da demonstração enviado", { demo_id: demoId });
    return { ok: true, demoId };
  } catch (e) {
    await registrar("demo_pedido_erro", "error", "falha ao pedir código da demonstração", {
      erro: e instanceof Error ? e.message : "erro",
    });
    return { ok: false, motivo: "erro" };
  }
}

// ─── 2. confirmar o código ──────────────────────────────────────────────

export type ResultadoConfirmacao =
  | { ok: true; token: string; segundosRestantes: number }
  | { ok: false; motivo: "sem_pedido" | "expirado" | "max_tentativas" | "codigo_errado" | "ja_usou" | "erro" };

export async function confirmarCodigo(
  deps: Dependencias,
  entrada: { demoId?: unknown; codigo?: unknown },
): Promise<ResultadoConfirmacao> {
  const agora = deps.agora?.() ?? Date.now();
  const demoId = String(entrada.demoId ?? "");
  const codigo = String(entrada.codigo ?? "").replace(/\D/g, "");
  if (!/^[0-9a-f-]{36}$/i.test(demoId) || codigo.length !== 6) return { ok: false, motivo: "codigo_errado" };
  const { admin } = deps;

  try {
    const { data, error } = await admin
      .from(TABELA)
      .select(COLUNAS)
      .eq("id", demoId)
      .is("verificado_em", null)
      .maybeSingle();
    if (error) throw error;
    const linha = data as LinhaDemo | null;
    if (!linha || !linha.codigo_hash) return { ok: false, motivo: "sem_pedido" };
    if (!linha.codigo_expira_em || Date.parse(linha.codigo_expira_em) <= agora) return { ok: false, motivo: "expirado" };
    if (linha.tentativas >= MAX_TENTATIVAS) return { ok: false, motivo: "max_tentativas" };

    if (hash(codigo) !== linha.codigo_hash) {
      const tentativas = linha.tentativas + 1;
      const { error: erroTent } = await admin
        .from(TABELA)
        .update({ tentativas })
        .eq("id", linha.id);
      if (erroTent) throw erroTent;
      return { ok: false, motivo: tentativas >= MAX_TENTATIVAS ? "max_tentativas" : "codigo_errado" };
    }

    const token = gerarToken();
    const expiraEm = iso(agora + DURACAO_MIN * 60 * 1000);
    const { data: upd, error: erroUpd } = await admin
      .from(TABELA)
      .update({
        verificado_em: iso(agora),
        codigo_hash: null,
        token_hash: hash(token),
        iniciada_em: iso(agora),
        expira_em: expiraEm,
      })
      .eq("id", linha.id)
      .is("verificado_em", null)
      .select("id");
    if (erroUpd) {
      // O índice da 0101: este número já tem uma demonstração confirmada.
      if (erroUpd.code === UNIQUE) return { ok: false, motivo: "ja_usou" };
      throw erroUpd;
    }
    if (!Array.isArray(upd) || upd.length === 0) return { ok: false, motivo: "sem_pedido" };
    await registrar("demo_iniciada", "info", "demonstração confirmada e iniciada", { demo_id: linha.id });
    return { ok: true, token, segundosRestantes: segundosRestantes(expiraEm, agora) };
  } catch (e) {
    await registrar("demo_confirmacao_erro", "error", "falha ao confirmar código da demonstração", {
      erro: e instanceof Error ? e.message : "erro",
    });
    return { ok: false, motivo: "erro" };
  }
}

// ─── 3. conversar ───────────────────────────────────────────────────────

type MensagemHistorico = { papel: "pessoa" | "ayla"; texto: string };

export type ResultadoConversa =
  | { ok: true; resposta: string; segundosRestantes: number; estado: EstadoSessao }
  | { ok: false; motivo: "token_invalido" | "mensagem_invalida" | "indisponivel" | "concorrente" | "erro" }
  | { ok: false; motivo: "encerrada" | "tempo_esgotado" | "turnos_esgotados" };

async function lerSessao(admin: SupabaseClient, token: unknown): Promise<LinhaDemo | null> {
  const t = String(token ?? "");
  if (t.length < 20 || t.length > 100) return null;
  const { data, error } = await admin.from(TABELA).select(COLUNAS).eq("token_hash", hash(t)).maybeSingle();
  if (error) throw error;
  return (data as LinhaDemo | null) ?? null;
}

/**
 * O system e as mensagens de um turno — compartilhado entre a demonstração
 * real e a simulação do Admin, para o Admin testar EXATAMENTE o que a pessoa
 * vai viver.
 */
async function gerarResposta(
  deps: Dependencias,
  params: { conducao: string; nome: string; historico: MensagemHistorico[]; texto: string; segundos: number },
): Promise<string> {
  const core = await resolverDocumento(deps.admin, "core");
  const saida = await deps.gerar({
    provider: PROVIDER,
    model: MODELO_CONVERSA[PROVIDER],
    system: montarSystemDemonstracao({
      core: core.conteudo,
      conducao: params.conducao,
      nomePessoa: params.nome,
      segundosRestantes: params.segundos,
    }),
    messages: [
      ...params.historico.map((m) => ({
        role: m.papel === "pessoa" ? ("user" as const) : ("assistant" as const),
        content: m.texto,
      })),
      { role: "user" as const, content: params.texto },
    ],
    maxTokens: 2000,
    esforcoRaciocinio: "low",
  });
  const resposta = (saida.texto ?? "").trim();
  if (!resposta) throw new Error("resposta vazia do modelo");
  return resposta;
}

export async function conversar(
  deps: Dependencias,
  entrada: { token?: unknown; texto?: unknown },
): Promise<ResultadoConversa> {
  const agora = deps.agora?.() ?? Date.now();
  const texto = String(entrada.texto ?? "").trim();
  if (!texto || texto.length > MAX_CHARS_MENSAGEM) return { ok: false, motivo: "mensagem_invalida" };
  const { admin } = deps;

  try {
    const linha = await lerSessao(admin, entrada.token);
    if (!linha || !linha.verificado_em) return { ok: false, motivo: "token_invalido" };
    const estado = estadoDaSessao(linha, agora);
    if (estado !== "ativa") return { ok: false, motivo: estado };

    const conducao = await resolverDocumento(admin, "demonstracao");
    if (!conducao.conteudo.trim()) {
      await registrar("demo_sem_documento", "error", "demonstração sem documento `demonstracao` ativo no Admin");
      return { ok: false, motivo: "indisponivel" };
    }

    // Reserva o turno ANTES de gastar o modelo: duas mensagens ao mesmo tempo
    // não podem passar do teto (a segunda perde a corrida e é avisada).
    const turnosAntes = linha.turnos;
    const { data: reservado, error: erroReserva } = await admin
      .from(TABELA)
      .update({ turnos: turnosAntes + 1, documento_versao: conducao.versao })
      .eq("id", linha.id)
      .eq("turnos", turnosAntes)
      .select("id");
    if (erroReserva) throw erroReserva;
    if (!Array.isArray(reservado) || reservado.length === 0) return { ok: false, motivo: "concorrente" };

    const { data: hist, error: erroHist } = await admin
      .from(MENSAGENS)
      .select("papel, texto")
      .eq("demonstracao_id", linha.id)
      .order("created_at", { ascending: true });
    if (erroHist) throw erroHist;

    const segundos = segundosRestantes(linha.expira_em, agora);
    let resposta: string;
    try {
      resposta = await gerarResposta(deps, {
        conducao: conducao.conteudo,
        nome: linha.nome,
        historico: (hist ?? []) as MensagemHistorico[],
        texto,
        segundos,
      });
    } catch (e) {
      await registrar("demo_modelo_falhou", "error", "modelo indisponível na demonstração", {
        demo_id: linha.id,
        erro: e instanceof Error ? e.message : "erro",
      });
      return { ok: false, motivo: "indisponivel" };
    }

    const { error: erroMsgs } = await admin.from(MENSAGENS).insert([
      { demonstracao_id: linha.id, papel: "pessoa", texto },
      { demonstracao_id: linha.id, papel: "ayla", texto: resposta },
    ]);
    if (erroMsgs) throw erroMsgs;

    return {
      ok: true,
      resposta,
      segundosRestantes: segundos,
      estado: estadoDaSessao({ ...linha, turnos: turnosAntes + 1 }, agora),
    };
  } catch (e) {
    await registrar("demo_conversa_erro", "error", "falha no turno da demonstração", {
      erro: e instanceof Error ? e.message : "erro",
    });
    return { ok: false, motivo: "erro" };
  }
}

// ─── 4. encerrar e mandar o resumo ──────────────────────────────────────

export type ResultadoEncerramento =
  | { ok: true; resumoEnviado: boolean; linkCadastro: string }
  | { ok: false; motivo: "token_invalido" | "envio_falhou" | "erro" };

export async function encerrar(
  deps: Dependencias,
  entrada: { token?: unknown; linkCadastro: string },
): Promise<ResultadoEncerramento> {
  const agora = deps.agora?.() ?? Date.now();
  const { admin } = deps;
  const linkCadastro = entrada.linkCadastro;

  try {
    const linha = await lerSessao(admin, entrada.token);
    if (!linha || !linha.verificado_em) return { ok: false, motivo: "token_invalido" };

    if (!linha.encerrada_em) {
      const { error } = await admin
        .from(TABELA)
        .update({ encerrada_em: iso(agora) })
        .eq("id", linha.id)
        .is("encerrada_em", null);
      if (error) throw error;
    }
    if (linha.resumo_enviado_em) return { ok: true, resumoEnviado: true, linkCadastro };

    // Reserva primeiro: dois "encerrar" ao mesmo tempo mandam UM resumo.
    const { data: reserva, error: erroReserva } = await admin
      .from(TABELA)
      .update({ resumo_reservado_em: iso(agora) })
      .eq("id", linha.id)
      .is("resumo_reservado_em", null)
      .select("id");
    if (erroReserva) throw erroReserva;
    if (!Array.isArray(reserva) || reserva.length === 0) return { ok: true, resumoEnviado: true, linkCadastro };

    const { data: hist, error: erroHist } = await admin
      .from(MENSAGENS)
      .select("papel, texto")
      .eq("demonstracao_id", linha.id)
      .order("created_at", { ascending: true });
    if (erroHist) throw erroHist;
    const mensagens = (hist ?? []) as MensagemHistorico[];
    // Sem conversa não há o que resumir — e nada é enviado.
    if (!mensagens.some((m) => m.papel === "pessoa")) return { ok: true, resumoEnviado: false, linkCadastro };

    const liberarReserva = () =>
      admin.from(TABELA).update({ resumo_reservado_em: null }).eq("id", linha.id);

    try {
      const transcricao = mensagens
        .map((m) => `${m.papel === "pessoa" ? linha.nome : "Ayla"}: ${m.texto}`)
        .join("\n\n");
      const saida = await deps.gerar({
        provider: PROVIDER,
        model: MODELO_CONVERSA[PROVIDER],
        system: SYSTEM_RESUMO,
        messages: [{ role: "user", content: `<conversa>\n${transcricao}\n</conversa>` }],
        maxTokens: 1500,
        esforcoRaciocinio: "low",
      });
      const resumo = (saida.texto ?? "").trim();
      if (!resumo) throw new Error("resumo vazio");
      await deps.enviarWhatsApp({
        phoneE164: linha.telefone_e164,
        texto: textoDoResumo({ nome: linha.nome.split(" ")[0], resumo, linkCadastro }),
      });
    } catch (e) {
      // Devolve a reserva: um novo "encerrar" pode tentar de novo.
      await liberarReserva();
      await registrar("demo_resumo_falhou", "error", "resumo da demonstração não foi enviado", {
        demo_id: linha.id,
        erro: e instanceof Error ? e.message : "erro",
      });
      return { ok: false, motivo: "envio_falhou" };
    }

    const { error: erroEnviado } = await admin
      .from(TABELA)
      .update({ resumo_enviado_em: iso(deps.agora?.() ?? Date.now()) })
      .eq("id", linha.id);
    if (erroEnviado) throw erroEnviado;
    await registrar("demo_resumo_enviado", "info", "resumo da demonstração enviado", { demo_id: linha.id });
    return { ok: true, resumoEnviado: true, linkCadastro };
  } catch (e) {
    await registrar("demo_encerramento_erro", "error", "falha ao encerrar a demonstração", {
      erro: e instanceof Error ? e.message : "erro",
    });
    return { ok: false, motivo: "erro" };
  }
}

// ─── Admin: simular sem gravar nada ─────────────────────────────────────

/**
 * A simulação do Admin: mesma montagem de prompt da demonstração real, sem
 * linha no banco, sem código, sem limite por número e sem WhatsApp. Usa o
 * RASCUNHO do documento `demonstracao` quando existir — é assim que a
 * responsável testa a condução antes de ativar.
 */
export async function simularNoAdmin(
  deps: Dependencias,
  entrada: { historico: MensagemHistorico[]; texto: string; nome?: string; usarRascunho?: boolean },
): Promise<{ ok: true; resposta: string; versao: number | null; origem: "rascunho" | "ativo" } | { ok: false; motivo: "sem_documento" | "indisponivel" }> {
  const rascunho = entrada.usarRascunho !== false ? await lerRascunho(deps.admin, "demonstracao") : null;
  const doc = await resolverDocumento(deps.admin, "demonstracao", rascunho);
  if (!doc.conteudo.trim()) return { ok: false, motivo: "sem_documento" };
  try {
    const resposta = await gerarResposta(deps, {
      conducao: doc.conteudo,
      nome: entrada.nome?.trim() || "Visitante",
      historico: entrada.historico.slice(-40),
      texto: entrada.texto.slice(0, MAX_CHARS_MENSAGEM),
      segundos: DURACAO_MIN * 60,
    });
    return { ok: true, resposta, versao: doc.versao, origem: rascunho ? "rascunho" : "ativo" };
  } catch {
    return { ok: false, motivo: "indisponivel" };
  }
}
