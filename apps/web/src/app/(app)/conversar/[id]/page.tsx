import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { RespostaMarkdown, limparRespostaKolo } from "@/components/resposta-markdown";
import { ContinuarForm } from "./continuar-form";

/**
 * Conversa individual (P-EST-5 + P-EST-6):
 *   - Mensagens como LEITURA CORRIDA (sem Cards retangulares)
 *   - Distinção Você/Kolo via micro-label Eyebrow-style + tipografia
 *   - Continuar conversa: textarea inline, sem Card "Continuar" wrapper
 *
 * Backend, schema e routing entre skills permanecem intactos.
 */
export default async function ConversaPage(props: PageProps<"/conversar/[id]">) {
  const { id } = await props.params;
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: conversa } = await supabase
    .from("conversas")
    .select(
      "id, titulo, created_at, encerrada, membro_atipico_id, membros_atipicos(nome)",
    )
    .eq("id", id)
    .eq("family_account_id", familyId)
    .maybeSingle();

  if (!conversa) notFound();

  const { data: mensagens } = await supabase
    .from("mensagens_skill")
    .select("id, papel, conteudo, skills_acionadas, created_at")
    .eq("conversa_id", conversa.id)
    .order("created_at", { ascending: true });

  const membrosRel = conversa.membros_atipicos as
    | { nome: string }
    | { nome: string }[]
    | null;
  const membroNome = membrosRel
    ? Array.isArray(membrosRel)
      ? membrosRel[0]?.nome
      : membrosRel.nome
    : null;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <Link
          href="/estrategias"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Voltar
        </Link>
        <h1 className="font-heading text-2xl text-foreground md:text-3xl">
          {conversa.titulo ?? "Conversa"}
        </h1>
        {membroNome && (
          <p className="text-sm text-muted-foreground">Sobre {membroNome}</p>
        )}
      </header>

      <ul className="flex flex-col gap-8">
        {(mensagens ?? []).map((m) => (
          <li key={m.id}>
            {m.papel === "user" ? (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Você
                </span>
                <p className="mt-2 whitespace-pre-wrap text-base leading-relaxed text-foreground/75">
                  {m.conteudo}
                </p>
              </div>
            ) : (
              <div>
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-purple">
                  Kolo
                </span>
                <RespostaMarkdown
                  texto={limparRespostaKolo(m.conteudo)}
                  className="mt-2 flex flex-col gap-3 text-base text-foreground"
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* Continuar conversa — textarea direto, sem Card wrapper. */}
      <ContinuarForm
        conversaId={conversa.id}
        membroAtipicoId={conversa.membro_atipico_id}
      />
    </div>
  );
}
