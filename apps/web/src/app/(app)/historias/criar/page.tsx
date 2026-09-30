import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { assinarImagens } from "@/lib/storage/imagens";
import { resolverCriancaAtivaId } from "@/lib/crianca-ativa";
import { idadeAnos } from "@/lib/idade";
import { CriarHistoriaForm } from "./criar-form";
import { carregarIntencaoLudico } from "@/lib/ludico/intencao";

export const metadata = { title: "Criar história — Kolo Família" };

// Geração escreve + ilustra várias páginas (gpt-image-1). O trabalho pesado
// roda em after() e HERDA este maxDuration — 60s não cabia (5 imgs paralelas
// em pares + roteiro passava do limite e matava o container antes do catch
// marcar status='erro', prendendo o usuário no skeleton).
export const maxDuration = 300;

export default async function CriarHistoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ membro?: string; intencao?: string }>;
}) {
  const { supabase, family } = await loadFamilyContext();
  const sp = await searchParams;

  const { data: membros } = await supabase
    .from("membros_atipicos")
    .select("id, nome, data_nascimento, avatares_membros_atipicos(id, imagem_url, selecionado, created_at)")
    .eq("family_account_id", family!.id)
    .eq("ativo", true)
    .order("created_at", { ascending: true });

  type AvRow = {
    id: string;
    imagem_url: string | null;
    selecionado: boolean | null;
    created_at: string | null;
  };

  // Por criança: ordena os avatares (em uso primeiro, depois recentes).
  const perMembro = (membros ?? []).map((m) => {
    const arr = (
      Array.isArray(m.avatares_membros_atipicos)
        ? m.avatares_membros_atipicos
        : m.avatares_membros_atipicos
          ? [m.avatares_membros_atipicos]
          : []
    ) as AvRow[];
    const avs = [...arr].sort((a, b) => {
      if (Boolean(b.selecionado) !== Boolean(a.selecionado)) return b.selecionado ? 1 : -1;
      return (b.created_at ?? "").localeCompare(a.created_at ?? "");
    });
    return { id: m.id as string, nome: m.nome as string, idade: idadeAnos(m.data_nascimento as string | null), avs };
  });

  // Assina todas as URLs num lote só (bucket privado) e redistribui.
  const signed = await assinarImagens(
    supabase,
    perMembro.flatMap((pm) => pm.avs.map((a) => a.imagem_url ?? null)),
  );
  let idx = 0;
  const criancas = perMembro.map((pm) => {
    const avatares = pm.avs
      .map((a) => ({
        id: a.id,
        url: signed[idx++] ?? a.imagem_url ?? null,
        selecionado: Boolean(a.selecionado),
      }))
      .filter((a): a is { id: string; url: string; selecionado: boolean } => Boolean(a.url));
    return { id: pm.id, nome: pm.nome, idade: pm.idade, avatares };
  });

  const todas = criancas.map((c) => ({ id: c.id, nome: c.nome, idade: c.idade, temAvatar: c.avatares.length > 0 }));
  const semAvatar = todas.filter((m) => !m.temAvatar);
  // O link da Ayla transporta a pessoa do turno. Avatar é opcional: histórias
  // também podem usar animais, robôs ou pessoas fictícias.
  const membroPedido = sp.membro?.trim() ?? "";
  const pedidoValido = criancas.some((m) => m.id === membroPedido) ? membroPedido : "";
  const ativaId = pedidoValido || (await resolverCriancaAtivaId(criancas)) || "";
  const intencao =
    sp.intencao && ativaId
      ? await carregarIntencaoLudico(supabase, {
          id: sp.intencao,
          familyId: family!.id,
          membroId: ativaId,
        }).catch(() => null)
      : null;
  const payload = intencao?.artefato === "historia" ? intencao.payload : {};
  const descricaoInicial = typeof payload.descricao === "string" ? payload.descricao : "";
  const objetivoInicial =
    payload.objetivo === "agir" || payload.objetivo === "agencia" || payload.objetivo === "compreender"
      ? payload.objetivo
      : "compreender";

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <Link
        href="/historias"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" aria-hidden /> Histórias
      </Link>

      <header>
        <div className="flex items-center gap-3">
          <h1 className="font-heading text-3xl text-foreground">
            Criar uma <em className="not-italic text-brand-purple">história</em>
          </h1>
          <span
            aria-label="feature em versão beta"
            className="inline-flex items-center rounded-full border border-kolo-linha bg-secondary/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground"
          >
            beta
          </span>
        </div>
        <p className="mt-2 text-muted-foreground">
          Conte a situação com suas palavras. A Kolo escreve e ilustra cada página.
          Você escolhe quem vive a história e o estilo visual do mundo.
        </p>
      </header>

      {todas.length === 0 ? (
        <div className="rounded-2xl border border-kolo-linha bg-secondary/40 p-6">
          <p className="font-heading text-lg text-foreground">
            Ninguém cadastrado ainda
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Adicione no Perfil e volte aqui pra criar a história.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <CriarHistoriaForm
            criancas={criancas}
            ativaId={ativaId}
            intencaoId={intencao?.id}
            descricaoInicial={descricaoInicial}
            objetivoInicial={objetivoInicial}
          />

          {semAvatar.length > 0 && (
            <div className="rounded-2xl border border-brand-purple/20 bg-kolo-lilas-bg-2/40 p-4">
              <p className="font-heading text-base font-medium text-foreground">
                Personalizar com o próprio avatar
              </p>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                É opcional: a história já pode usar animais, robôs ou personagens
                fictícios. Criando um avatar, a própria pessoa também pode protagonizar.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {semAvatar.map((m) => (
                  <Link
                    key={m.id}
                    href={`/configuracoes/avatar/${m.id}?origem=whatsapp${intencao?.id ? `&intencao=${encodeURIComponent(intencao.id)}` : ""}&retomar=${encodeURIComponent(
                      `/historias/criar?membro=${m.id}${intencao?.id ? `&intencao=${intencao.id}` : ""}`,
                    )}`}
                    className={cn(
                      buttonVariants({
                        variant: "outline",
                        size: "sm",
                      }),
                    )}
                  >
                    Criar avatar de {m.nome}
                  </Link>
                ))}
              </div>
            </div>
          )}

          <Link
            href="/configuracoes/avatar"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver / editar todos os avatares →
          </Link>
        </div>
      )}
    </div>
  );
}
