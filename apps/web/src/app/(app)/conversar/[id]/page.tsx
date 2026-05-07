import { notFound } from "next/navigation";
import Link from "next/link";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft } from "lucide-react";
import { ContinuarForm } from "./continuar-form";

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
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/conversar"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Voltar
        </Link>
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          {conversa.titulo ?? "Conversa"}
        </h1>
        {membroNome && (
          <p className="text-sm text-muted-foreground">Sobre {membroNome}</p>
        )}
      </header>

      <ul className="flex flex-col gap-4">
        {(mensagens ?? []).map((m) => (
          <li key={m.id}>
            {m.papel === "user" ? (
              <Card className="bg-muted/30">
                <CardHeader>
                  <CardDescription>Você</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm">{m.conteudo}</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <CardTitle className="text-sm font-medium">Especialistas</CardTitle>
                  <SkillsBadges skills={m.skills_acionadas} />
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm">{m.conteudo}</p>
                </CardContent>
              </Card>
            )}
          </li>
        ))}
      </ul>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Continuar</CardTitle>
        </CardHeader>
        <CardContent>
          <ContinuarForm
            conversaId={conversa.id}
            membroAtipicoId={conversa.membro_atipico_id}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function SkillsBadges({ skills }: { skills: unknown }) {
  if (!Array.isArray(skills) || skills.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {skills.map((s: { name: string; display_name: string }) => (
        <Badge key={s.name} variant="secondary" className="text-xs">
          {s.display_name}
        </Badge>
      ))}
    </div>
  );
}
