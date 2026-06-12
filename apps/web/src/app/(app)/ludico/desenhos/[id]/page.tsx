import Link from "next/link";
import { notFound } from "next/navigation";
import {
  BookOpen,
  ChevronLeft,
  Eye,
  Heart,
  Lightbulb,
  MessageCircleQuestion,
  Sprout,
  Star,
} from "lucide-react";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { capitalizarNome } from "@/lib/nome";
import { DesenhoPoller } from "./desenho-poller";
import { RespostaCrianca } from "./resposta-crianca";
import { AprofundarDesenho } from "./aprofundar-desenho";

export const maxDuration = 300;

type Releitura = {
  o_que_contou?: string;
  importante?: string[];
  perguntas?: string[];
  historia?: string;
  registro?: string;
};

type Analise = {
  observamos?: string[];
  leituras?: string[];
  perguntas?: string[];
  registro?: string;
  releitura?: Releitura;
};

function dataBr(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export default async function DesenhoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { supabase, family } = await loadFamilyContext();

  const { data: desenho } = await supabase
    .from("desenhos")
    .select(
      "id, imagem_url, contexto_dia, analise, status, resposta_crianca, created_at, membros_atipicos(nome)",
    )
    .eq("id", id)
    .eq("family_account_id", family!.id)
    .maybeSingle();

  if (!desenho) notFound();

  const rel = desenho.membros_atipicos as { nome: string } | { nome: string }[] | null;
  const nome = rel ? (Array.isArray(rel) ? rel[0]?.nome : rel.nome) : null;
  const status = desenho.status as string;
  const analise = (desenho.analise as Analise | null) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/ludico/desenhos"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-3" /> Diário de desenhos
      </Link>

      <header>
        <h1 className="font-heading text-2xl text-foreground md:text-3xl">
          O que este desenho conta?
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {dataBr(desenho.created_at as string)}
          {nome ? ` · ${capitalizarNome(nome)}` : ""}
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,320px)_1fr]">
        <div className="flex flex-col gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={desenho.imagem_url as string}
            alt="Desenho"
            className="w-full rounded-2xl border border-foreground/[0.06] object-contain"
          />
          {desenho.contexto_dia && (
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Contexto do dia:</span>{" "}
              {desenho.contexto_dia as string}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {status === "analisando" && <DesenhoPoller />}

          {status === "erro" && (
            <p className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Não consegui ler este desenho. Tente enviar uma foto mais nítida e com boa luz.
            </p>
          )}

          {status === "pronto" && analise && (
            <>
              <Bloco
                icone={<Eye className="size-4" />}
                titulo="O que observamos"
                tom="bg-cat-sensorial-soft text-cat-sensorial"
              >
                <Lista itens={analise.observamos ?? []} />
              </Bloco>

              <Bloco
                icone={<Lightbulb className="size-4" />}
                titulo="Possíveis leituras"
                tom="bg-cat-emocao-soft text-cat-emocao"
              >
                <p className="mb-2 text-xs italic text-muted-foreground">
                  São hipóteses pra observar — não conclusões. O sentido é da criança.
                </p>
                <Lista itens={analise.leituras ?? []} />
              </Bloco>

              <Bloco
                icone={<MessageCircleQuestion className="size-4" />}
                titulo="Perguntas pra explorar"
                tom="bg-cat-comunicacao-soft text-cat-comunicacao"
              >
                <Lista itens={analise.perguntas ?? []} />
              </Bloco>

              {analise.registro && (
                <Bloco
                  icone={<Sprout className="size-4" />}
                  titulo="Pra acompanhar"
                  tom="bg-cat-rotina-soft text-cat-rotina"
                >
                  <p className="text-sm leading-relaxed text-foreground/90">
                    {analise.registro}
                  </p>
                </Bloco>
              )}

              <RespostaCrianca
                desenhoId={desenho.id as string}
                inicial={(desenho.resposta_crianca as string | null) ?? null}
              />

              {(desenho.resposta_crianca as string | null)?.trim() &&
                (analise.releitura ? (
                  <ReleituraSecao
                    releitura={analise.releitura}
                    nome={nome ? capitalizarNome(nome) : null}
                  />
                ) : (
                  <AprofundarDesenho
                    desenhoId={desenho.id as string}
                    nome={nome ? capitalizarNome(nome) : null}
                  />
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function ReleituraSecao({
  releitura,
  nome,
}: {
  releitura: Releitura;
  nome: string | null;
}) {
  const quem = nome ?? "a criança";
  return (
    <div className="flex flex-col gap-5 rounded-3xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-5">
      <div className="flex items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-lg bg-brand-purple text-white">
          <Heart className="size-4" />
        </span>
        <h2 className="font-heading text-lg font-medium text-foreground">
          A partir do que {quem} contou
        </h2>
      </div>

      {releitura.o_que_contou && (
        <p className="text-sm leading-relaxed text-foreground/90">{releitura.o_que_contou}</p>
      )}

      {(releitura.importante?.length ?? 0) > 0 && (
        <Bloco
          icone={<Star className="size-4" />}
          titulo={`O que parece importante pra ${quem}`}
          tom="bg-cat-emocao-soft text-cat-emocao"
        >
          <Lista itens={releitura.importante ?? []} />
        </Bloco>
      )}

      {(releitura.perguntas?.length ?? 0) > 0 && (
        <Bloco
          icone={<MessageCircleQuestion className="size-4" />}
          titulo="Próximas perguntas"
          tom="bg-cat-comunicacao-soft text-cat-comunicacao"
        >
          <Lista itens={releitura.perguntas ?? []} />
        </Bloco>
      )}

      {releitura.historia && (
        <Bloco
          icone={<BookOpen className="size-4" />}
          titulo={`Uma história pra continuar com ${quem}`}
          tom="bg-cat-social-soft text-cat-social"
        >
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {releitura.historia}
          </p>
        </Bloco>
      )}

      {releitura.registro && (
        <Bloco
          icone={<Sprout className="size-4" />}
          titulo="Pra acompanhar"
          tom="bg-cat-rotina-soft text-cat-rotina"
        >
          <p className="text-sm leading-relaxed text-foreground/90">{releitura.registro}</p>
        </Bloco>
      )}
    </div>
  );
}

function Bloco({
  icone,
  titulo,
  tom,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  tom: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <span className={`flex size-7 items-center justify-center rounded-lg ${tom}`}>
          {icone}
        </span>
        <h2 className="font-heading text-lg font-medium text-foreground">{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function Lista({ itens }: { itens: string[] }) {
  if (itens.length === 0) return null;
  return (
    <ul className="flex flex-col gap-1.5">
      {itens.map((it, i) => (
        <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-foreground">
          <span
            aria-hidden
            className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-brand-purple/50"
          />
          <span className="flex-1">{it}</span>
        </li>
      ))}
    </ul>
  );
}
