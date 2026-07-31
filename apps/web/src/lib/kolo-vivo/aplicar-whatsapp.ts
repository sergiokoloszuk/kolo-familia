import type { SupabaseClient } from "@supabase/supabase-js";
import { membroCampoStorage } from "./campos";
import { appendFato } from "./aplicar";
import { registrarFatosPerfil } from "./fatos/registrar";
import { candidatoDeItemKoloVivo } from "./fatos/adaptador";
import { escopoAtivoDaFamilia } from "./fatos/escopo-ativo";
import { resolverMembro, type FonteDoFoco } from "./fatos/foco-membro";
import { idDeEvidencia } from "./fatos/evidencia";
import { PERFIL_MEMBRO_SELECT } from "./leitura";

type SecaoJson = { texto?: string; atualizado_em?: string } | null;

/**
 * ESCRITA DO WHATSAPP NO PERFIL — a fronteira real, agora testavel.
 *
 * Estava dentro de `ayla/orchestrator.ts`, privada, num modulo de 2.900 linhas
 * com dezenas de dependencias. Consequencia: o caminho de MAIOR volume da
 * memoria so podia ser validado por componentes isolados - nunca ponta a ponta.
 *
 * O orquestrador continua chamando ESTA funcao. Nao ha segunda implementacao:
 * o corpo e o mesmo, movido, e o unico ganho e poder executa-lo contra um
 * Postgres de verdade num teste.
 *
 * O risco conhecido que ela carrega: o `membroId` que chega aqui vem de
 * `ctx.membros[0]` no orquestrador - o PRIMEIRO filho do array, nao um foco.
 * Por isso `fonteDoFoco` e parametro: quem chama declara de onde tirou o
 * membro, e `resolverMembro` decide entre persistir, quarentena e rejeitar.
 */
export async function aplicarSugestaoNoMembro(
  supabase: SupabaseClient,
  familyId: string,
  membroId: string,
  campo: string,
  texto: string,
  operacao: "adicionar" | "reescrever" = "adicionar",
  /**
   * Origem para a escrita sombra no fact store (0073). Ausente = nao grava.
   * `subcampo` da a GRANULARIDADE: sem ele o conceito fica igual ao dominio
   * ("sensorial" em vez de "sensorial.barulho"), e a recorrencia futura mediria
   * "quantas vezes falamos de sensorial" - inutil para maturacao. Foi o defeito
   * encontrado na Fase 2.
   */
  origemFato?: {
    messageId?: string | null;
    subcampo?: string | null;
    /** UM run por processamento do turno, compartilhado pelos fatos dele. */
    extractionRunId?: string | null;
    /**
     * O LOTE que o extrator leu (0074). Quando presente, é ELE a evidência —
     * `messageId` descreve uma mensagem da rajada, e o extrator leu todas.
     */
    loteId?: string | null;
    /**
     * De onde o chamador tirou o `membroId`. O padrao e `primeiro_da_familia`
     * porque e a VERDADE sobre o orquestrador hoje: ele usa `ctx.membros[0]`.
     * Um padrao otimista aqui mentiria para `resolverMembro`.
     */
    fonteDoFoco?: FonteDoFoco;
  },
): Promise<boolean> {
  const storage = membroCampoStorage(campo);
  if (storage === null) return false;

  const { data: atual } = await supabase
    .from("perfil_vivo_membro")
    .select(
      PERFIL_MEMBRO_SELECT,
    )
    .eq("membro_atipico_id", membroId)
    .maybeSingle();

  const now = new Date().toISOString();
  let patch: Record<string, unknown>;
  if (storage === "toplevel") {
    const secaoAtual = (atual as Record<string, SecaoJson> | null)?.[campo] ?? {};
    const novoTexto =
      operacao === "reescrever"
        ? texto.trim()
        : appendFato(secaoAtual?.texto ?? "", texto);
    patch = { [campo]: { ...secaoAtual, texto: novoTexto, atualizado_em: now } };
  } else {
    const extras = {
      ...((atual?.categorias_extras as Record<string, unknown>) ?? {}),
    };
    const secaoAtual = (extras[campo] as SecaoJson) ?? {};
    const novoTexto =
      operacao === "reescrever"
        ? texto.trim()
        : appendFato(secaoAtual?.texto ?? "", texto);
    extras[campo] = { ...secaoAtual, texto: novoTexto, atualizado_em: now };
    patch = { categorias_extras: extras };
  }

  const { error } = await supabase.from("perfil_vivo_membro").upsert(
    {
      membro_atipico_id: membroId,
      family_account_id: familyId,
      ...patch,
    },
    { onConflict: "membro_atipico_id" },
  );

  // ESCRITA SOMBRA (0073) - depois do upsert do perfil atual. Mesmo servico
  // usado pela web; a logica nova existe num lugar so.
  if (!error && origemFato) {
    try {
      // RESOLUCAO DE FOCO. Sem isto o WhatsApp gravava direto no `membroId`
      // que recebeu - e ele vem de `ctx.membros[0]`, o primeiro filho do
      // array. Numa familia com dois filhos, tudo ia para quem estivesse em
      // primeiro, ativo e em silencio. O teste ponta a ponta expos: os
      // cenarios 5, 6 e 7 gravavam ATIVO no Pedro.
      const { data: irmaos } = await supabase
        .from("membros_atipicos")
        .select("id, nome")
        .eq("family_account_id", familyId);
      const foco = resolverMembro({
        membroId,
        fonte: origemFato.fonteDoFoco ?? "primeiro_da_familia",
        texto,
        nomesDaFamilia: (irmaos ?? []).map((m) => ({
          id: m.id as string,
          nome: (m.nome as string) ?? "",
        })),
      });

      await registrarFatosPerfil(supabase, [
        candidatoDeItemKoloVivo({
          familyId,
          membroId,
          campo,
          subcampo: origemFato.subcampo ?? null,
          texto,
          proveniencia: {
            sourceType: "caregiver_report",
            channel: "whatsapp",
            messageId: origemFato.messageId ?? null,
          },
          escopo: await escopoAtivoDaFamilia(supabase, familyId),
          // LINHAGEM. A unidade de evidência do WhatsApp é o LOTE: a rajada
          // que o extrator de fato leu. Apontar para uma mensagem escolhida
          // entre três descreveria mal o insumo — quem reconstruísse o caso
          // recuperaria um terço da entrada e culparia o extrator.
          //
          // O `whatsapp_turn` continua como QUEDA: se o registro do lote falhou,
          // uma evidência parcial e honesta vale mais que evidência nenhuma.
          linhagem: origemFato.loteId
            ? {
                sourceContentId: idDeEvidencia("extracao_lote", origemFato.loteId),
                extractionRunId: origemFato.extractionRunId ?? null,
              }
            : origemFato.messageId
              ? {
                  sourceContentId: idDeEvidencia("whatsapp_turn", origemFato.messageId),
                  extractionRunId: origemFato.extractionRunId ?? null,
                }
              : undefined,
        }),
      ].map((c) => ({ ...c, foco })));
    } catch {
      // Nunca quebra o turno; o servico ja registra cada falha.
    }
  }

  return !error;
}
