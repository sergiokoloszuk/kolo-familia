import Link from "next/link";
import { formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Image as ImageIcon, Sparkles, Star } from "lucide-react";
import { Eyebrow } from "@/components/brand/eyebrow";
import { EstadoVazio } from "@/components/brand/estado-vazio";
import { IconCard } from "@/components/brand/icon-card";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { assinarImagens } from "@/lib/storage/imagens";
import { cn } from "@/lib/utils";
import { GaleriaItem } from "./galeria-item";

// Geração de cena (gpt-image-1) leva ~15-25s; evita timeout da action.
export const maxDuration = 60;

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
  // Bucket privado → URL assinada de curta duração, gerada na leitura.
  const urlsAssinadas = await assinarImagens(
    supabase,
    (imagens ?? []).map((i) => i.url as string),
  );

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-start gap-4">
        <IconCard tone="light" size="lg" className="hidden md:inline-flex">
          <ImageIcon aria-hidden />
        </IconCard>
        <div>
          <Eyebrow>Galeria</Eyebrow>
          <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
            Imagens das{" "}
            <em className="not-italic text-brand-purple">brincadeiras</em> e
            histórias
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Geradas pelas estratégias e pelas conversas. Favorita pra ficar,
            compartilha ou baixa quando quiser.
          </p>
        </div>
      </header>

      <div className="flex flex-wrap gap-2">
        <FilterPill href="/galeria" label="Todas" active={!filtroTipo && !apenasFavoritas} />
        <FilterPill
          href="/galeria?fav=1"
          label="Favoritas"
          icon={<Star className="size-3.5 fill-current" aria-hidden />}
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
          {imagens.map((img, i) => {
            const nome = Array.isArray(img.membros_atipicos)
              ? img.membros_atipicos[0]?.nome
              : (img.membros_atipicos as { nome: string } | null)?.nome;
            return (
              <li key={img.id}>
                <GaleriaItem
                  id={img.id}
                  url={urlsAssinadas[i] ?? img.url}
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
        <EstadoVazio
          icon={<Sparkles />}
          titulo="A galeria começa em branco"
          descricao={
            <>
              Configura o avatar do membro em{" "}
              <Link
                href="/configuracoes/avatar"
                className="text-brand-purple underline underline-offset-2 hover:text-brand-purple-dark"
              >
                /configuracoes/avatar
              </Link>{" "}
              — cada brincadeira, atividade ou história social gera uma
              imagem que pousa aqui.
            </>
          }
        />
      )}
    </div>
  );
}

function FilterPill({
  href,
  label,
  icon,
  active,
}: {
  href: string;
  label: string;
  icon?: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
        active
          ? "bg-brand-purple text-white"
          : "bg-kolo-lilas-bg-2 text-muted-foreground hover:bg-kolo-lilas hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

export const metadata = {
  title: "Galeria — Kolo Família",
};
