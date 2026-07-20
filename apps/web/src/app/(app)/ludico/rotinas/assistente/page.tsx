import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { resolverCriancaAtivaId } from "@/lib/crianca-ativa";
import { capitalizarNome } from "@/lib/nome";
import { SeletorCrianca } from "../../../seletor-crianca";
import { AssistenteChat } from "./assistente-chat";

/**
 * Montar a rotina conversando com a Kolo (o "cérebro" da Etapa 1). A mãe conta
 * como são os dias; a IA entende e propõe a semana; ela aprova e vira rotina.
 * Mesmo motor que a Ayla usa no WhatsApp.
 */
export default async function AssistenteRotinaPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const lista = (membros ?? []).map((m) => ({
    id: m.id as string,
    nome: capitalizarNome(m.nome as string),
  }));
  const ativaId = (await resolverCriancaAtivaId(membros ?? [])) ?? null;
  const ativa = lista.find((m) => m.id === ativaId) ?? lista[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/ludico/rotinas"
        className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="size-4" aria-hidden /> Rotinas
      </Link>

      <header className="max-w-2xl">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand-purple">
          Lúdico · Rotina Visual
        </p>
        <h1 className="mt-1 font-heading text-2xl text-foreground md:text-3xl">
          Montar com a Kolo{ativa ? ` — ${ativa.nome}` : ""}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Me conta como são os dias — do jeito que você souber, pode ser tudo solto de uma vez.
          Horário é opcional. Eu organizo a semana e você aprova.
        </p>
      </header>

      {lista.length > 1 && ativaId && (
        <div className="w-fit">
          <SeletorCrianca
            criancas={lista.map((m) => ({ id: m.id, nome: m.nome }))}
            ativaId={ativaId}
            variant="screen"
          />
        </div>
      )}

      {ativa ? (
        <AssistenteChat membroId={ativa.id} nome={ativa.nome} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Cadastre uma criança no Perfil pra montar a rotina.
        </p>
      )}
    </div>
  );
}
