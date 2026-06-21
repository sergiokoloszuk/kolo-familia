import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Eyebrow } from "@/components/brand/eyebrow";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { assinarImagens } from "@/lib/storage/imagens";
import { idadeAnos } from "@/lib/idade";
import { AvatarMembroSecao } from "./secao-membro";
import { coerceEstilo, type AvatarDescricao } from "@/lib/imagem/avatar-prompt";

// A geração de imagem (gpt-image-1) roda na action a partir desta rota; dá
// fôlego pra não estourar o timeout.
export const maxDuration = 60;

type AvatarRow = {
  id: string;
  imagem_url: string | null;
  estilo: string | null;
  descricao_textual: Partial<AvatarDescricao> | null;
  selecionado: boolean | null;
  created_at: string | null;
};

export default async function AvataresIndexPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select(
      "id, nome, data_nascimento, perfil, avatares_membros_atipicos(id, imagem_url, estilo, descricao_textual, selecionado, created_at)",
    )
    .eq("family_account_id", familyId)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const membrosList = membros ?? [];

  // Para cada membro: ordena os avatares (escolhido primeiro, depois recentes),
  // assina as URLs (bucket privado) e monta os defaults dos formulários.
  const secoes = await Promise.all(
    membrosList.map(async (m) => {
      const avs = ([...((m.avatares_membros_atipicos as AvatarRow[]) ?? [])]).sort((a, b) => {
        if (Boolean(b.selecionado) !== Boolean(a.selecionado)) return b.selecionado ? 1 : -1;
        return (b.created_at ?? "").localeCompare(a.created_at ?? "");
      });
      const urls = await assinarImagens(supabase, avs.map((a) => a.imagem_url ?? null));
      const avatares = avs.map((a, i) => ({
        id: a.id,
        imagem_url: urls[i] ?? a.imagem_url ?? null,
        selecionado: Boolean(a.selecionado),
      }));

      const idade = idadeAnos(m.data_nascimento);
      const base = avs[0];
      const d = (base?.descricao_textual ?? {}) as Partial<AvatarDescricao>;

      const inicialEditar: AvatarDescricao = {
        estilo: coerceEstilo(base?.estilo),
        idade: d.idade ?? idade,
        generoVisual: d.generoVisual ?? null,
        tomPele: d.tomPele ?? null,
        cabeloCor: d.cabeloCor ?? null,
        cabeloComprimento: d.cabeloComprimento ?? null,
        cabeloTextura: d.cabeloTextura ?? null,
        oculos: d.oculos ?? false,
        tracosMarcantes: d.tracosMarcantes ?? null,
        roupasFrequentes: d.roupasFrequentes ?? null,
      };
      const inicialCriar: AvatarDescricao = {
        estilo: coerceEstilo(null),
        idade,
        generoVisual: null,
        tomPele: null,
        cabeloCor: null,
        cabeloComprimento: null,
        cabeloTextura: null,
        oculos: false,
        tracosMarcantes: null,
        roupasFrequentes: null,
      };

      return {
        id: m.id as string,
        nome: m.nome as string,
        subtitulo: `${idade} anos · ${m.perfil}`,
        avatares,
        inicialCriar,
        inicialEditar,
      };
    }),
  );

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
        <Eyebrow>Lúdico</Eyebrow>
        <h1 className="font-heading text-2xl font-semibold tracking-tight md:text-3xl">
          Avatares
        </h1>
        <p className="max-w-2xl text-sm text-muted-foreground">
          Aqui você cria os personagens ilustrados de cada um (vários estilos 3D —
          animação, massinha, boneco…). <strong>São eles que entram nas Histórias e
          nas Rotinas visuais.</strong> Crie quantos quiser por pessoa e escolha qual
          fica em uso. Não guardamos fotos — só a ilustração.
        </p>
        <div className="mt-1 flex flex-wrap gap-2">
          <Link
            href="/historias"
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-purple/30 bg-white px-3 py-1.5 text-xs font-semibold text-brand-purple transition-colors hover:bg-kolo-lilas-bg-2"
          >
            Criar uma história →
          </Link>
          <Link
            href="/ludico/rotinas"
            className="inline-flex items-center gap-1.5 rounded-full border border-brand-purple/30 bg-white px-3 py-1.5 text-xs font-semibold text-brand-purple transition-colors hover:bg-kolo-lilas-bg-2"
          >
            Montar uma rotina visual →
          </Link>
        </div>
      </header>

      {secoes.length > 0 ? (
        <div className="flex flex-col gap-5">
          {secoes.map((s) => (
            <AvatarMembroSecao
              key={s.id}
              membroId={s.id}
              nome={s.nome}
              subtitulo={s.subtitulo}
              avatares={s.avatares}
              inicialCriar={s.inicialCriar}
              inicialEditar={s.inicialEditar}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Ninguém cadastrado ainda</CardTitle>
            <CardDescription>
              Adicione no Perfil e volte aqui pra criar o avatar.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
    </div>
  );
}
