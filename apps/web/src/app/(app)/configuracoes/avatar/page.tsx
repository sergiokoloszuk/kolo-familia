import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { assinarImagens } from "@/lib/storage/imagens";
import { idadeAnos } from "@/lib/idade";

type AvatarRel = { imagem_url: string | null; selecionado: boolean | null };

function avatarEscolhido(rel: unknown): AvatarRel | undefined {
  const arr = Array.isArray(rel) ? rel : rel ? [rel] : [];
  return (arr as AvatarRel[]).find((x) => x?.selecionado) ?? (arr as AvatarRel[])[0];
}

export default async function AvataresIndexPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome, data_nascimento, perfil, avatares_membros_atipicos(imagem_url, selecionado)")
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const membrosList = membros ?? [];
  // Bucket privado → assina o avatar escolhido de cada membro na leitura.
  const avatarUrls = await assinarImagens(
    supabase,
    membrosList.map((m) => avatarEscolhido(m.avatares_membros_atipicos)?.imagem_url ?? null),
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/configuracoes"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Configurações
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">
          Avatar dos membros
        </h1>
        <p className="text-sm text-muted-foreground">
          Avatar canônico ilustrado, em vários estilos (cartoon, aquarela, massinha
          3D e mais). Usado nas brincadeiras, atividades e histórias geradas pela
          Ayla. Não armazenamos fotos — só a representação ilustrada.
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-2">
        {membrosList.map((m, i) => {
          const avatarUrl = avatarUrls[i];
          const temAvatar = Boolean(avatarUrl);
          return (
            <li key={m.id}>
              <Link href={`/configuracoes/avatar/${m.id}`} className="block">
                <Card className="h-full transition-colors hover:bg-muted/30">
                  <CardHeader className="flex flex-row items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-base">{m.nome}</CardTitle>
                      <CardDescription>
                        {idadeAnos(m.data_nascimento)} anos · {m.perfil}
                      </CardDescription>
                    </div>
                    <Badge variant={temAvatar ? "default" : "outline"}>
                      {temAvatar ? "Configurado" : "Pendente"}
                    </Badge>
                  </CardHeader>
                  <CardContent>
                    {temAvatar && avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={avatarUrl}
                        alt={`Avatar de ${m.nome}`}
                        className="aspect-square w-32 rounded-md border object-cover"
                      />
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        Configurar &rarr;
                      </p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>

      {(membros ?? []).length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sem membros cadastrados</CardTitle>
            <CardDescription>
              Adicione no Kolo Vivo e volte aqui pra configurar o avatar.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
