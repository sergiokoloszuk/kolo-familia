import Link from "next/link";
import { Sparkles, Wand2 } from "lucide-react";
import { ComoUsar } from "@/components/brand/como-usar";
import { loadFamilyContext } from "@/lib/auth/require-user";

export const metadata = { title: "Histórias — Kolo Família" };

export default async function HistoriasPage() {
  const { supabase, family } = await loadFamilyContext();

  const [{ data: historias }, { data: membros }] = await Promise.all([
    supabase
      .from("historias")
      .select("id, titulo, capa_url, leituras, created_at")
      .eq("family_account_id", family!.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("membros_atipicos")
      .select("id, nome, avatares_membros_atipicos(imagem_url)")
      .eq("family_account_id", family!.id)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
  ]);

  const temAvatar = (membros ?? []).some((m) => {
    const a = Array.isArray(m.avatares_membros_atipicos)
      ? m.avatares_membros_atipicos[0]
      : m.avatares_membros_atipicos;
    return Boolean(a?.imagem_url);
  });

  const lista = historias ?? [];

  return (
    <div className="flex flex-col gap-8">
      {/* Portal */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-purple-deep via-brand-purple-dark to-brand-purple px-8 py-12 text-white">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(1.5px 1.5px at 12% 20%, rgba(255,255,255,.7) 50%, transparent), radial-gradient(1.5px 1.5px at 85% 30%, rgba(255,186,0,.7) 50%, transparent), radial-gradient(1px 1px at 70% 75%, rgba(255,255,255,.6) 50%, transparent), radial-gradient(1px 1px at 30% 80%, rgba(255,186,0,.5) 50%, transparent)",
          }}
        />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-yellow/30 bg-white/10 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-brand-yellow backdrop-blur">
            <Sparkles className="size-3.5" /> Histórias ilustradas
          </span>
          <h1 className="mt-4 max-w-2xl font-heading text-3xl leading-tight md:text-4xl">
            Você conta a situação, a Kolo cria a{" "}
            <em className="not-italic text-brand-yellow">história ilustrada</em> com o
            personagem da criança.
          </h1>
          <p className="mt-3 max-w-xl text-white/75">
            Pra antecipar um momento difícil, ensaiar uma situação nova ou celebrar
            uma conquista — sempre com a criança como protagonista.
          </p>
        </div>
      </section>

      <ComoUsar
        oQueFazer="Descreva a história que você quer (ex.: 'preparar para o dentista') e a Kolo escreve e ilustra com o avatar da criança. Depois é só ler junto."
        porQue="Histórias sociais ajudam a criança a entender e antecipar o que vai acontecer — diminui a ansiedade do desconhecido."
      />

      {/* Grid de histórias + criar */}
      <section className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {/* Card criar */}
        <Link
          href="/historias/criar"
          className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand-purple/30 bg-kolo-lilas-bg-2/40 p-6 text-center transition-all hover:-translate-y-1 hover:border-brand-purple hover:shadow-lg"
          style={{ aspectRatio: "3 / 4" }}
        >
          <span className="flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-brand-yellow-dark text-brand-purple-dark shadow-md transition-transform group-hover:scale-105">
            <Wand2 className="size-7" />
          </span>
          <span className="font-heading text-base font-semibold text-foreground">
            Criar história
          </span>
          <span className="text-xs text-muted-foreground">
            {temAvatar ? "Você descreve, a Kolo ilustra" : "Crie um avatar primeiro"}
          </span>
        </Link>

        {lista.map((h) => (
          <Link key={h.id} href={`/historias/${h.id}`} className="group flex flex-col gap-2">
            <div
              className="relative overflow-hidden rounded-2xl bg-kolo-lilas-bg shadow-md transition-all group-hover:-translate-y-1 group-hover:shadow-xl"
              style={{ aspectRatio: "3 / 4" }}
            >
              {h.capa_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={h.capa_url as string}
                  alt={h.titulo as string}
                  className="size-full object-cover"
                />
              ) : (
                <div className="flex size-full items-center justify-center bg-gradient-to-br from-brand-purple-dark to-brand-purple text-white/60">
                  <Sparkles className="size-8" />
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3">
                <p className="font-heading text-sm font-medium leading-tight text-white drop-shadow">
                  {h.titulo as string}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
