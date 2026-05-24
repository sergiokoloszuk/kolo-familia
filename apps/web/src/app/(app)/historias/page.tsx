import Link from "next/link";
import { Eyebrow } from "@/components/brand/eyebrow";
import { ComoUsar } from "@/components/brand/como-usar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadFamilyContext } from "@/lib/auth/require-user";

/**
 * Histórias (P-HIS-1 + P-HIS-2) — estado editorial silencioso.
 *
 * Desmontado: portal mágico, elenco, sugestões card-celebrar-antecipar-
 * ensaiar, grid de livros placeholder, "Inventar nova aventura", nota
 * "em construção".
 *
 * Histórias deve transmitir MEMÓRIA AFETIVA, não área lúdica. Por
 * enquanto, lista de histórias é sempre vazia (tabela `historias` não
 * existe ainda — fica pra P-HIS-3+). O estado vazio é editorial e
 * convida ao Diário, não a "criar primeira história".
 *
 * Não há CTA estrutural pra gerar/criar — histórias VÃO APARECER quando
 * vivência marcante for registrada no Diário (geração contextual com
 * decisão explícita do usuário, P-HIS-6 futura).
 */
export default async function HistoriasPage() {
  const { supabase, family } = await loadFamilyContext();
  const { data: criancas } = await supabase
    .from("membros_atipicos")
    .select("id, nome")
    .eq("family_account_id", family!.id)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  const primeiraCrianca = criancas?.[0];
  const temNome = Boolean(primeiraCrianca?.nome);
  const nome = primeiraCrianca?.nome;

  return (
    <div className="flex flex-col gap-10">
      <header>
        <Eyebrow>O que ficou contado</Eyebrow>
        <h1 className="mt-1 font-heading text-3xl text-foreground md:text-4xl">
          {temNome ? (
            <>
              Pequenas memórias de{" "}
              <em className="not-italic text-brand-purple">{nome}</em>, em
              forma de cena.
            </>
          ) : (
            <>
              Pequenas memórias{" "}
              <em className="not-italic text-brand-purple">da família</em>, em
              forma de cena.
            </>
          )}
        </h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Quando algo importante acontece, vira história — pra retomar quando
          precisar.
        </p>
      </header>

      <ComoUsar
        oQueFazer="As histórias aparecem aqui quando algo marcante é registrado no Diário. Você também pode criar o avatar da criança pra ilustrá-las."
        porQue="São memórias afetivas em forma de cena — pra relembrar e retomar quando fizer sentido."
      />

      <section className="max-w-2xl">
        <p className="text-base leading-relaxed text-foreground/80">
          As primeiras memórias vão aparecer aqui — quando algo marcante for
          vivido e ganhar forma narrativa.
        </p>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Por enquanto, o cotidiano vai sendo registrado no Diário.
        </p>
      </section>

      <section className="max-w-2xl rounded-2xl border border-kolo-linha bg-secondary/40 p-5">
        <h2 className="font-heading text-lg text-foreground">
          As histórias ganham vida com um avatar
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Crie o avatar de cada criança pra ilustrar as histórias e as ideias da
          Ayla — dá pra escolher entre vários estilos.
        </p>
        <Link
          href="/configuracoes/avatar"
          className={cn(buttonVariants({ variant: "outline" }), "mt-3")}
        >
          Criar avatar das crianças
        </Link>
      </section>

      <div className="flex justify-center">
        <Link
          href="/registrar/diario"
          className="text-sm font-semibold text-brand-purple underline-offset-4 hover:underline"
        >
          Registrar um dia →
        </Link>
      </div>
    </div>
  );
}

export const metadata = {
  title: "Histórias — Kolo Família",
};
