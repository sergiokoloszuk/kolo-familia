import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeLocalISO } from "@/lib/idade";
import { MEMBRO_CAMPOS_TOPLEVEL, membroCampoStorage } from "./campos";
// FACT STORE (0073) - escrita sombra, atras de flag. Ponto tecnico unico.
import { registrarFatosPerfil } from "./fatos/registrar";
import { candidatoDeItemKoloVivo } from "./fatos/adaptador";
import type { Escopo, Proveniencia } from "./fatos/tipos";
import {
  subcamposDe,
  parsearSubcampos,
  serializarSubcampos,
  splitItens,
  joinItens,
} from "./subcampos";

/**
 * ESCRITA no Kolo Vivo a partir de uma proposta extraída de conversa.
 *
 * Fonte única de duas coisas que eram implementações paralelas:
 *  - o botão "Guardar no Perfil" da web (`confirmarAtualizacao`), onde a pessoa
 *    revisa antes;
 *  - o aprendizado AUTOMÁTICO da web, que não existia — a rota de streaming
 *    gravava a mensagem e nada mais. No WhatsApp a incorporação sempre foi
 *    automática, então uma Ayla evoluía e a outra não (auditoria 30/07).
 *
 * A lógica de merge é a que já estava em produção no botão: anexa sem
 * substituir, e em domínio com sub-campos roteia o fato pro sub-campo certo.
 * Não mudou nada aqui — só saiu de dentro da server action pra poder ser
 * chamada com service-role, de dentro de um `after()`.
 */

/** O que o chamador sabe sobre a origem desta incorporacao. */
export type OrigemFatos = {
  proveniencia: Proveniencia;
  escopo?: Escopo;
  observadoEm?: string | null;
};

export type ItemProposta = {
  camada: "camada1" | "camada2";
  campo: string;
  subcampo?: string | null;
  texto: string;
  operacao: "adicionar" | "reescrever";
};

export const FAMILIA_CAMPOS = ["composicao", "rotina", "recursos", "dinamica"] as const;

/** Anexa um fato curto ao texto da seção, sem substituir o que já existe. */
export function appendFato(prev: string, fato: string): string {
  const p = (prev ?? "").trim();
  const f = fato.trim();
  if (!p) return f;
  if (p.toLowerCase().includes(f.toLowerCase())) return p;
  return `${p}\n${f}`;
}

/**
 * Novo texto de um campo, respeitando sub-campos estruturados. Domínios com
 * sub-campos (ex.: nutricional) recebem o fato NO sub-campo certo (seletor
 * substitui; lista anexa item; demais anexam texto); domínios simples usam o
 * anexo/reescrita normal.
 */
export function aplicarTextoCampo(
  campo: string,
  prev: string,
  it: { subcampo?: string | null; texto: string; operacao: "adicionar" | "reescrever" },
): string {
  const subs = subcamposDe(campo);
  if (!subs) {
    return it.operacao === "reescrever" ? it.texto : appendFato(prev, it.texto);
  }
  const valores = parsearSubcampos(subs, prev);
  const def = (it.subcampo && subs.find((s) => s.key === it.subcampo)) || subs[subs.length - 1];
  if (def.opcoes) {
    valores[def.key] = it.texto;
  } else if (def.lista) {
    valores[def.key] = joinItens([
      ...splitItens(valores[def.key] ?? ""),
      ...splitItens(it.texto),
    ]);
  } else {
    valores[def.key] = appendFato(valores[def.key] ?? "", it.texto);
  }
  return serializarSubcampos(subs, valores);
}

export type ResultadoAplicacao = {
  itensMembro: number;
  itensFamilia: number;
  /** Os textos aplicados no membro — matéria-prima pra a linha do tempo. */
  fatosMembro: string[];
  erro?: string;
};

/**
 * Aplica a proposta no perfil. Não decide NADA sobre conquista/desafio — quem
 * chama resolve isso (o botão insere um diário; o automático consolida por dia).
 */
export async function aplicarPropostaNoPerfil(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroId: string | null;
    itens: ItemProposta[];
    /**
     * Proveniencia para a ESCRITA SOMBRA no fact store (0073). Opcional de
     * proposito: sem ela o fato ainda e gravado, com origem desconhecida, e
     * isso vira metrica (`sem_proveniencia`) em vez de quebrar o turno.
     * Ausente por completo = comportamento identico ao anterior.
     */
    fatos?: OrigemFatos;
  },
): Promise<ResultadoAplicacao> {
  const { familyId, membroId, itens } = params;
  const now = new Date().toISOString();

  const membroItens = itens.filter(
    (it) => it.camada === "camada1" && membroCampoStorage(it.campo) !== null,
  );
  const familiaItens = itens.filter(
    (it) => it.camada === "camada2" && (FAMILIA_CAMPOS as readonly string[]).includes(it.campo),
  );

  const fatosMembro: string[] = [];

  if (membroItens.length > 0 && membroId) {
    const { data: atual } = await supabase
      .from("perfil_vivo_membro")
      .select("essencial, como_e, corpo_rotina, desafios_regulacao, sensorial, categorias_extras")
      .eq("membro_atipico_id", membroId)
      .maybeSingle();

    const toplevel: Record<string, Record<string, unknown>> = {};
    for (const campo of MEMBRO_CAMPOS_TOPLEVEL) {
      toplevel[campo] = ((atual as Record<string, unknown> | null)?.[campo] as Record<
        string,
        unknown
      >) ?? {};
    }
    const extras: Record<string, unknown> =
      (atual?.categorias_extras as Record<string, unknown>) ?? {};

    for (const it of membroItens) {
      const onde = membroCampoStorage(it.campo);
      if (onde === "toplevel") {
        const prev = (toplevel[it.campo].texto as string) ?? "";
        toplevel[it.campo] = {
          ...toplevel[it.campo],
          texto: aplicarTextoCampo(it.campo, prev, it),
          atualizado_em: now,
        };
      } else if (onde === "extras") {
        const atualCampo = (extras[it.campo] as Record<string, unknown>) ?? {};
        const prev = (atualCampo.texto as string) ?? "";
        extras[it.campo] = {
          ...atualCampo,
          texto: aplicarTextoCampo(it.campo, prev, it),
          atualizado_em: now,
        };
      }
      fatosMembro.push(it.texto);
    }

    const { error } = await supabase.from("perfil_vivo_membro").upsert(
      {
        membro_atipico_id: membroId,
        family_account_id: familyId,
        ...toplevel,
        categorias_extras: extras,
      },
      { onConflict: "membro_atipico_id" },
    );
    if (error) {
      return { itensMembro: 0, itensFamilia: 0, fatosMembro: [], erro: error.message };
    }
  }

  if (familiaItens.length > 0) {
    const { data: atual } = await supabase
      .from("perfil_vivo_familia")
      .select("composicao, rotina, recursos, dinamica")
      .eq("family_account_id", familyId)
      .maybeSingle();
    const secoes: Record<string, Record<string, unknown>> = {};
    for (const campo of FAMILIA_CAMPOS) {
      secoes[campo] = ((atual as Record<string, unknown> | null)?.[campo] as Record<
        string,
        unknown
      >) ?? {};
    }
    for (const it of familiaItens) {
      const prev = (secoes[it.campo].texto as string) ?? "";
      const novoTexto = it.operacao === "reescrever" ? it.texto : appendFato(prev, it.texto);
      secoes[it.campo] = { ...secoes[it.campo], texto: novoTexto, atualizado_em: now };
    }
    const { error } = await supabase
      .from("perfil_vivo_familia")
      .upsert({ family_account_id: familyId, ...secoes });
    if (error) {
      return {
        itensMembro: membroItens.length,
        itensFamilia: 0,
        fatosMembro,
        erro: error.message,
      };
    }
  }

  // ESCRITA SOMBRA (0073) - depois de o perfil atual ja ter sido atualizado.
  // Nunca antes: se falhar aqui, o comportamento de producao ja aconteceu e
  // nada muda para a familia.
  await gravarFatosSombra(supabase, {
    familyId,
    membroId,
    itens: membroItens,
    origem: params.fatos,
  });

  return {
    itensMembro: membroId ? membroItens.length : 0,
    itensFamilia: familiaItens.length,
    fatosMembro,
  };
}

/**
 * Ponte para o fact store. Um lugar so - a logica nova nao pode nascer
 * duplicada como a antiga (tres implementacoes de escrita no perfil).
 */
async function gravarFatosSombra(
  supabase: SupabaseClient,
  args: {
    familyId: string;
    membroId: string | null;
    itens: ItemProposta[];
    origem?: OrigemFatos;
  },
): Promise<void> {
  if (!args.origem || args.itens.length === 0) return;
  try {
    await registrarFatosPerfil(
      supabase,
      args.itens.map((it) =>
        candidatoDeItemKoloVivo({
          familyId: args.familyId,
          membroId: args.membroId,
          campo: it.campo,
          subcampo: it.subcampo ?? null,
          texto: it.texto,
          proveniencia: args.origem!.proveniencia,
          escopo: args.origem!.escopo,
          observadoEm: args.origem!.observadoEm,
        }),
      ),
    );
  } catch {
    // Escrita sombra nunca quebra o caminho principal. O servico ja registra
    // cada falha individualmente; este catch e a ultima rede.
  }
}

/**
 * Conquista/desafio do dia vindos do aprendizado AUTOMÁTICO da web.
 *
 * CONSOLIDA por dia em vez de inserir a cada turno: sem isto, uma conversa de
 * dez mensagens viraria dez diários do mesmo episódio (é o mesmo problema que o
 * WhatsApp resolve com `decidirDedupDiario`). Uma linha por criança por dia com
 * `origem='app'`, que vai sendo completada — inclusive a que o BOTÃO criou, o
 * que é o comportamento certo: mesmo dia, mesma criança, mesma origem.
 *
 * ⚠️ `diarios.origem` tem CHECK `in ('app','ayla')` (migração 0001). Não existe
 * `'app_auto'` — usar um valor novo aqui exigiria migração e o insert falharia
 * calado. Se um dia quisermos separar botão × automático, é migração primeiro.
 */
export async function registrarDiarioAutomatico(
  supabase: SupabaseClient,
  params: {
    familyId: string;
    membroId: string;
    conquista: string | null;
    desafio: string | null;
  },
): Promise<"criado" | "atualizado" | "nada"> {
  const { familyId, membroId, conquista, desafio } = params;
  if (!conquista && !desafio) return "nada";
  const data = hojeLocalISO();

  // Sem unique em (family, membro, data, origem) — pega a mais recente do dia
  // em vez de maybeSingle(), que estouraria se houvesse duas.
  const { data: linhas } = await supabase
    .from("diarios")
    .select("id, conquista, desafio")
    .eq("family_account_id", familyId)
    .eq("membro_atipico_id", membroId)
    .eq("data", data)
    .eq("origem", "app")
    .order("created_at", { ascending: false })
    .limit(1);
  const existente = linhas?.[0];

  if (existente) {
    const novaConquista = conquista
      ? appendFato((existente.conquista as string | null) ?? "", conquista)
      : ((existente.conquista as string | null) ?? null);
    const novoDesafio = desafio
      ? appendFato((existente.desafio as string | null) ?? "", desafio)
      : ((existente.desafio as string | null) ?? null);
    const { error } = await supabase
      .from("diarios")
      .update({ conquista: novaConquista, desafio: novoDesafio })
      .eq("id", existente.id as string);
    if (error) console.warn("[kolo-vivo:diario-auto] update falhou:", error.message);
    return "atualizado";
  }

  const { error } = await supabase.from("diarios").insert({
    family_account_id: familyId,
    membro_atipico_id: membroId,
    data,
    conquista,
    desafio,
    origem: "app",
    incompleto: true,
  });
  if (error) {
    console.warn("[kolo-vivo:diario-auto] insert falhou:", error.message);
    return "nada";
  }
  return "criado";
}
