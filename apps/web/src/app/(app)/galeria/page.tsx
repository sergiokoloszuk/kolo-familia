import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { GaleriaItem } from "./galeria-item";

const TIPOS_LABEL: Record<string, string> = {
  brincadeira: "Brincadeira",
  atividade: "Atividade",
  historia_social: "História social",
  conquista: "Conquista",
  livre: "Livre",
};

export default async function GaleriaPage(props: PageProps<"/galeria">) {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;
  const sp = await props.searchParams;
  const filtroTipo = typeof sp.tipo === "string" ? sp.tipo : undefined;
  const apenasFavoritas = sp.fav === "1";

  let query = supabase
    .from("galeria_imagens")
    .select("id, url, tipo, tags, favoritada, prompt_usado, created_at, membros_atipicos(nome)")
    .eq("family_account_id", familyId)
    .order("created_at", { ascending: false })
    .limit(60);

  if (filtroTipo) query = query.eq("tipo", filtroTipo);
  if (apenasFavoritas) query = query.eq("favoritada", true);

  const { data: imagens } = await query;

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Galeria</h1>
        <p className="text-sm text-muted-foreground">
          Imagens geradas pelas skills e pela Ayla. Favorita pra ficar e compartilha
          ou baixa quando quiser.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterPill href="/galeria" label="Todas" active={!filtroTipo && !apenasFavoritas} />
        <FilterPill
          href="/galeria?fav=1"
          label="⭐ Favoritas"
          active={apenasFavoritas && !filtroTipo}
        />
        {Object.entries(TIPOS_LABEL).map(([k, label]) => (
          <FilterPill
            key={k}
            href={`/galeria?tipo=${k}`}
            label={label}
            active={filtroTipo === k}
          />
        ))}
      </div>

      {imagens && imagens.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {imagens.map((img) => {
            const nome = Array.isArray(img.membros_atipicos)
              ? img.membros_atipicos[0]?.nome
              : (img.membros_atipicos as { nome: string } | null)?.nome;
            return (
              <li key={img.id}>
                <GaleriaItem
                  id={img.id}
                  url={img.url}
                  tipo={img.tipo as string | null}
                  favoritada={img.favoritada as boolean}
                  membroNome={nome ?? null}
                  criadaEm={formatRelative(new Date(img.created_at), new Date(), { locale: ptBR })}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sem imagens ainda</CardTitle>
            <CardDescription>
              Configure o avatar do membro em{" "}
              <Link href="/configuracoes/avatar" className="underline">
                /configuracoes/avatar
              </Link>{" "}
              e depois gere imagens em /apoio (Brincadeiras, Atividades, Histórias
              sociais).
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}

function FilterPill({
  href,
  label,
  active,
}: {
  href: string;
  label: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full border px-3 py-1 text-xs ${
        active
          ? "border-foreground bg-foreground text-background"
          : "text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </Link>
  );
}

export const metadata = {
  title: "Galeria — Kolo Família",
};
