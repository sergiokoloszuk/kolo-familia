import type { SupabaseClient } from "@supabase/supabase-js";
import { idadeAnos } from "@/lib/idade";
import { extrairAtualizacoes } from "./atualizar";
import { aplicarPropostaNoPerfil, registrarDiarioAutomatico } from "@/lib/kolo-vivo/aplicar";
import { extrairESalvarEventos } from "@/lib/ayla/eventos";
import { carregarSecoesMembro, resumoRotulado } from "@/lib/kolo-vivo/leitura";

/**
 * APRENDIZADO AUTOMÁTICO DA WEB — paridade com o WhatsApp.
 *
 * Até 30/07/2026 a rota de streaming das Estratégias gravava a mensagem e nada
 * mais: sem extração de fatos, sem linha do tempo, sem marcos. O único caminho
 * de escrita era o botão "Guardar no Perfil", que a pessoa precisa lembrar de
 * apertar. No WhatsApp a incorporação é automática desde maio. Resultado: uma
 * Ayla ia aprendendo sobre a criança e a outra não — e a mãe que usava o app
 * tinha que repetir tudo na conversa seguinte.
 *
 * Roda em `after()`, depois de a resposta já ter sido entregue: nunca atrasa o
 * chat e nunca derruba a conversa. Best-effort de ponta a ponta.
 *
 * O botão continua existindo e não muda: serve pra quem quer revisar antes de
 * guardar, e usa o MESMO aplicador (lib/kolo-vivo/aplicar.ts). A "REGRA DE
 * NOVIDADE" do extrator (não propor o que já está registrado) é o que evita os
 * dois caminhos escreverem a mesma coisa duas vezes.
 */

/** Fala curta demais não carrega fato novo — não vale a chamada de IA. */
const MIN_CARACTERES_PRA_APRENDER = 25;

export type ResultadoAprendizado = {
  rodou: boolean;
  motivo?: string;
  itensPerfil?: number;
  diario?: "criado" | "atualizado" | "nada";
};

export async function aprenderDaConversa(
  admin: SupabaseClient,
  params: {
    familyId: string;
    conversaId: string;
    membroId: string | null;
    /** A última fala da pessoa — usada só pro freio de tamanho. */
    ultimaMensagemUsuario: string;
  },
): Promise<ResultadoAprendizado> {
  const { familyId, conversaId, membroId, ultimaMensagemUsuario } = params;

  if ((ultimaMensagemUsuario ?? "").trim().length < MIN_CARACTERES_PRA_APRENDER) {
    return { rodou: false, motivo: "fala curta" };
  }

  try {
    const { data: msgs } = await admin
      .from("mensagens_skill")
      .select("papel, conteudo")
      .eq("conversa_id", conversaId)
      .order("created_at", { ascending: true });
    const transcript = (msgs ?? [])
      .map((m) => `${m.papel === "user" ? "Responsável" : "Kolo"}: ${m.conteudo}`)
      .join("\n\n")
      .slice(0, 8000);
    if (!transcript.trim()) return { rodou: false, motivo: "sem transcript" };

    let membro: { nome: string; idade: number | null; perfil: string } | null = null;
    if (membroId) {
      const { data: m } = await admin
        .from("membros_atipicos")
        .select("nome, data_nascimento, perfil")
        .eq("id", membroId)
        .eq("family_account_id", familyId)
        .maybeSingle();
      if (m) {
        membro = {
          nome: m.nome as string,
          idade: idadeAnos(m.data_nascimento as string | null),
          perfil: (m.perfil as string) ?? "",
        };
      }
    }

    // O perfil atual vai junto: é o que faz o extrator NÃO propor o que já está
    // registrado (a regra de novidade). Mesmo leitor dos dois canais.
    const koloVivoResumo = resumoRotulado(await carregarSecoesMembro(admin, membroId));

    const proposta = await extrairAtualizacoes({ transcript, koloVivoResumo, membro });
    if (proposta.koloVivo.length === 0 && !proposta.conquista && !proposta.desafio) {
      return { rodou: true, motivo: "nada novo", itensPerfil: 0, diario: "nada" };
    }

    const aplicado = await aplicarPropostaNoPerfil(admin, {
      familyId,
      membroId,
      itens: proposta.koloVivo,
      // Extraido automaticamente da conversa: o conteudo veio da familia, mas
      // a captura foi da IA e ninguem confirmou. `uncertain` e o status
      // honesto - silencio da familia nao e confirmacao.
      fatos: {
        proveniencia: {
          sourceType: "caregiver_report",
          channel: "web",
          conversationId: conversaId,
        },
      },
    });

    let diario: "criado" | "atualizado" | "nada" = "nada";
    if (membroId) {
      diario = await registrarDiarioAutomatico(admin, {
        familyId,
        membroId,
        conquista: proposta.conquista,
        desafio: proposta.desafio,
      });
    }

    // Linha do tempo: se um fato novo é uma evolução datável, vira marco. Mesmo
    // extrator do WhatsApp — a web também passa a alimentar a Evolução.
    if (membroId && aplicado.fatosMembro.length > 0) {
      try {
        await extrairESalvarEventos(admin, familyId, membroId, aplicado.fatosMembro.join("\n"));
      } catch {
        /* linha do tempo é bônus */
      }
    }

    console.log(
      `[web:aprender] conversa=${conversaId} perfil=${aplicado.itensMembro + aplicado.itensFamilia} diario=${diario}${aplicado.erro ? ` erro="${aplicado.erro}"` : ""}`,
    );

    return {
      rodou: true,
      itensPerfil: aplicado.itensMembro + aplicado.itensFamilia,
      diario,
    };
  } catch (e) {
    console.warn("[web:aprender] falhou:", e instanceof Error ? e.message : e);
    return { rodou: false, motivo: "erro" };
  }
}
