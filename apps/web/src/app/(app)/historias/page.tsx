import Link from "next/link";
import { Sparkles, Wand2, BookOpen } from "lucide-react";
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

  const avatarUrl = (() => {
    for (const m of membros ?? []) {
      const a = Array.isArray(m.avatares_membros_atipicos)
        ? m.avatares_membros_atipicos[0]
        : m.avatares_membros_atipicos;
      if (a?.imagem_url) return a.imagem_url as string;
    }
    return null;
  })();
  const temAvatar = Boolean(avatarUrl);
  const lista = historias ?? [];

  return (
    <div className="flex flex-col gap-8">
      {/* Portal "universo" */}
      <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-purple-deep via-brand-purple-dark to-brand-purple px-8 py-10 text-white">
        {/* estrelas */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-70"
          style={{
            backgroundImage:
              "radial-gradient(1.5px 1.5px at 12% 20%, rgba(255,255,255,.7) 50%, transparent), radial-gradient(1.5px 1.5px at 85% 30%, rgba(255,186,0,.7) 50%, transparent), radial-gradient(1px 1px at 70% 75%, rgba(255,255,255,.6) 50%, transparent), radial-gradient(1px 1px at 30% 80%, rgba(255,186,0,.5) 50%, transparent)",
          }}
        />
        {/* lua */}
        <div
          aria-hidden
          className="pointer-events-none absolute -right-12 -top-12 size-56 rounded-full blur-[2px]"
          style={{
            background:
              "radial-gradient(circle at 35% 35%, rgba(255,186,0,.85) 0%, rgba(255,186,0,.25) 50%, transparent 75%)",
          }}
        />
        <div className="relative flex items-center gap-8">
          <div className="flex-1">
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
            {lista.length > 0 && (
              <span className="mt-5 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/85 backdrop-blur">
                <BookOpen className="size-3.5 text-brand-yellow" />
                {lista.length} {lista.length === 1 ? "história" : "histórias"} no universo
              </span>
            )}
          </div>
          {avatarUrl && (
            <div className="relative hidden shrink-0 sm:block">
              <div
                aria-hidden
                className="absolute -inset-3 rounded-full"
                style={{ background: "radial-gradient(circle, rgba(255,186,0,.25) 0%, transparent 65%)" }}
              />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={avatarUrl}
                alt="Avatar da criança"
                className="relative size-32 rounded-full border-2 border-white/40 object-cover shadow-xl md:size-40"
              />
            </div>
          )}
        </div>
      </section>

      <ComoUsar
        oQueFazer="Descreva a história que você quer (ex.: 'preparar para o dentista') e a Kolo escreve e ilustra com o avatar da criança. Depois é só ler junto."
        porQue="Histórias sociais ajudam a criança a entender e antecipar o que vai acontecer — diminui a ansiedade do desconhecido."
      />

      {/* Estante */}
      <section className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
        {/* Card criar — varinha com anel girando */}
        <Link
          href="/historias/criar"
          className="group flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-brand-purple/30 bg-kolo-lilas-bg-2/40 p-6 text-center transition-all hover:-translate-y-1 hover:border-brand-purple hover:shadow-lg"
          style={{ aspectRatio: "3 / 4" }}
        >
          <span className="relative flex size-16 items-center justify-center rounded-full bg-gradient-to-br from-brand-yellow to-brand-yellow-dark text-brand-purple-dark shadow-md transition-transform group-hover:scale-105">
            <span
              aria-hidden
              className="absolute -inset-1.5 rounded-full border border-dashed border-brand-yellow/60 animate-[spin_14s_linear_infinite]"
            />
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
              className="relative overflow-hidden rounded-2xl bg-kolo-lilas-bg shadow-[0_2px_6px_rgba(46,10,82,0.08),0_14px_30px_rgba(46,10,82,0.14)] transition-all group-hover:-translate-y-1.5"
              style={{ aspectRatio: "3 / 4" }}
            >
              {/* lombada */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-10 w-2 bg-gradient-to-r from-black/20 to-transparent"
              />
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
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-3 pt-10">
                <p className="font-heading text-sm font-medium leading-tight text-white drop-shadow">
                  {h.titulo as string}
                </p>
              </div>
            </div>
            {Number(h.leituras) > 0 && (
              <span className="px-1 text-xs text-muted-foreground">
                ✦ {h.leituras} {Number(h.leituras) === 1 ? "leitura" : "leituras"}
              </span>
            )}
          </Link>
        ))}
      </section>
    </div>
  );
}
