import { requireAdmin } from "@/lib/auth/require-admin";
import { familiasExperimentais } from "@/lib/ayla/experimental";
import { AYLA_EXPERIMENTAL_PROMPT } from "@/lib/ayla/experimental-prompt";
import { listarVersoes } from "./actions";
import { EditorCore } from "./editor";

/**
 * A INTELIGÊNCIA DA AYLA, EDITÁVEL — Passo 1, 15/08/2026.
 *
 * Só o CORE por enquanto. Trial e Artefatos entram no Passo 2, reusando a
 * mesma tabela e o mesmo carregador — por isso a chave já existe no banco.
 */
export default async function AdminInteligenciaPage() {
  const { supabase } = await requireAdmin();

  const versoes = await listarVersoes();
  const ativo = versoes.find((v) => v.status === "ativo") ?? null;
  const rascunho = versoes.find((v) => v.status === "rascunho") ?? null;
  const tabelaAusente = versoes.length === 0;

  // As famílias do QA, com nome, para o simulador.
  const ids = familiasExperimentais();
  const { data: perfis } = ids.length
    ? await supabase
        .from("family_profiles")
        .select("family_account_id, nome_mae")
        .in("family_account_id", ids)
    : { data: [] };
  const nomePorId = new Map(
    (perfis ?? []).map((p) => [p.family_account_id as string, (p.nome_mae as string) || ""]),
  );
  const familias = ids.map((id) => ({
    id,
    // Sem perfil ainda é caso legítimo — mostra o id em vez de sumir da lista.
    nome: nomePorId.get(id) || `família ${id.slice(0, 8)}`,
  }));

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Inteligência da Ayla
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          O CORE é quem a Ayla é: o texto que vai junto de toda conversa. Editar
          aqui muda a Ayla sem deploy. Enquanto nenhuma versão estiver no ar, ela
          usa o Core do código — o mesmo que está em QA hoje.
        </p>
      </header>

      {tabelaAusente ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          <strong>Nenhuma versão no banco.</strong> Ou a migração{" "}
          <code>0077_ayla_documentos.sql</code> ainda não foi aplicada, ou o Core
          ainda não foi semeado. A Ayla está respondendo com o Core do código, o
          que é o comportamento correto — nada está quebrado.
        </div>
      ) : null}

      <EditorCore
        ativo={
          ativo
            ? { versao: ativo.versao, conteudo: ativo.conteudo, publicadoEm: ativo.publicado_em }
            : null
        }
        rascunho={rascunho ? { versao: rascunho.versao, conteudo: rascunho.conteudo } : null}
        fallback={AYLA_EXPERIMENTAL_PROMPT}
        historico={versoes.map((v) => ({
          id: v.id,
          versao: v.versao,
          status: v.status,
          nota: v.nota,
          quando: v.publicado_em ?? v.created_at,
          tamanho: v.conteudo.length,
        }))}
        familias={familias}
      />
    </div>
  );
}
