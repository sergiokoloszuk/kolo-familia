import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { assinarImagens } from "@/lib/storage/imagens";
import { idadeAnos } from "@/lib/idade";
import { AvatarForm } from "./avatar-form";
import { AvataresGaleria } from "./avatares-galeria";
import type { AvatarDescricao } from "@/lib/imagem/avatar-prompt";

// Geração de imagem (gpt-image-1) leva ~15-25s; evita timeout da action.
export const maxDuration = 60;

export default async function AvatarMembroPage(
  props: PageProps<"/configuracoes/avatar/[id]">,
) {
  const { id } = await props.params;
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: membro }, { data: avatares }] = await Promise.all([
    supabase
      .from("membros_atipicos")
      .select("id, nome, data_nascimento, perfil")
      .eq("id", id)
      .eq("family_account_id", familyId)
      .maybeSingle(),
    supabase
      .from("avatares_membros_atipicos")
      .select("id, imagem_url, estilo, descricao_textual, selecionado, created_at")
      .eq("membro_atipico_id", id)
      .order("selecionado", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (!membro) notFound();

  // Bucket privado → assina cada avatar na leitura.
  const avatarUrls = await assinarImagens(
    supabase,
    (avatares ?? []).map((a) => (a.imagem_url as string | null) ?? null),
  );
  const lista = (avatares ?? []).map((a, i) => ({
    id: a.id as string,
    imagem_url: avatarUrls[i] ?? (a.imagem_url as string | null) ?? null,
    selecionado: Boolean(a.selecionado),
  }));

  // Defaults do formulário: parte da descrição do avatar selecionado (ou do
  // mais recente), pra facilitar criar uma variação.
  const base = (avatares ?? [])[0];
  const descricao = (base?.descricao_textual ?? {}) as Partial<AvatarDescricao>;
  const inicial: AvatarDescricao = {
    estilo: (base?.estilo as "cartoon" | "aquarela") ?? "cartoon",
    idade: descricao.idade ?? idadeAnos(membro.data_nascimento),
    generoVisual: descricao.generoVisual ?? null,
    tomPele: descricao.tomPele ?? null,
    cabeloCor: descricao.cabeloCor ?? null,
    cabeloComprimento: descricao.cabeloComprimento ?? null,
    cabeloTextura: descricao.cabeloTextura ?? null,
    oculos: descricao.oculos ?? false,
    tracosMarcantes: descricao.tracosMarcantes ?? null,
    roupasFrequentes: descricao.roupasFrequentes ?? null,
  };

  const temAvatares = lista.some((a) => a.imagem_url);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/ludico"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Lúdico
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Avatares de {membro.nome}
        </h1>
        <p className="text-sm text-muted-foreground">
          {idadeAnos(membro.data_nascimento)} anos · {membro.perfil}
        </p>
      </header>

      {temAvatares && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Avatares de {membro.nome}</CardTitle>
            <CardDescription>
              Toque em <strong>Usar este</strong> pra escolher qual avatar entra nas
              Histórias, Rotinas e ilustrações.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AvataresGaleria avatares={lista} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {temAvatares ? "Criar outro avatar" : "Criar o avatar"}
          </CardTitle>
          <CardDescription>
            Quanto mais específico, mais consistente o personagem fica entre as
            ilustrações. Estilo deliberadamente cartoon/aquarela — não foto-realista.
            O novo avatar já entra como o escolhido.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AvatarForm membroId={membro.id} inicial={inicial} />
        </CardContent>
      </Card>
    </div>
  );
}
