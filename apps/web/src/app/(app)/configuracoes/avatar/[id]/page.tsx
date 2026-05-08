import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { AvatarForm } from "./avatar-form";
import type { AvatarDescricao } from "@/lib/imagem/avatar-prompt";

export default async function AvatarMembroPage(
  props: PageProps<"/configuracoes/avatar/[id]">,
) {
  const { id } = await props.params;
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: membro }, { data: avatar }] = await Promise.all([
    supabase
      .from("membros_atipicos")
      .select("id, nome, idade, perfil")
      .eq("id", id)
      .eq("family_account_id", familyId)
      .maybeSingle(),
    supabase
      .from("avatares_membros_atipicos")
      .select("estilo, descricao_textual, imagem_url, prompt_canonico")
      .eq("membro_atipico_id", id)
      .maybeSingle(),
  ]);

  if (!membro) notFound();

  const descricao = (avatar?.descricao_textual ?? {}) as Partial<AvatarDescricao>;
  const inicial: AvatarDescricao = {
    estilo: (avatar?.estilo as "cartoon" | "aquarela") ?? "cartoon",
    idade: descricao.idade ?? membro.idade,
    generoVisual: descricao.generoVisual ?? null,
    tomPele: descricao.tomPele ?? null,
    cabeloCor: descricao.cabeloCor ?? null,
    cabeloComprimento: descricao.cabeloComprimento ?? null,
    cabeloTextura: descricao.cabeloTextura ?? null,
    oculos: descricao.oculos ?? false,
    tracosMarcantes: descricao.tracosMarcantes ?? null,
    roupasFrequentes: descricao.roupasFrequentes ?? null,
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/configuracoes/avatar"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Avatares
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Avatar de {membro.nome}
        </h1>
        <p className="text-sm text-muted-foreground">
          {membro.idade} anos · {membro.perfil}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Descrição</CardTitle>
          <CardDescription>
            Quanto mais específico, mais consistente o personagem fica entre as
            ilustrações. Estilo deliberadamente cartoon/aquarela — não foto-realista.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarForm
            membroId={membro.id}
            inicial={inicial}
            imagemAtualUrl={avatar?.imagem_url ?? null}
          />
        </CardContent>
      </Card>
    </div>
  );
}
