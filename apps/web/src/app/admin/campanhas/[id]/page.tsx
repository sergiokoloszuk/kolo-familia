import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatRelative } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { CampanhaForm, type CampanhaInicial } from "../campanha-form";
import type { SaveCampanhaInput } from "../actions";
import { AcoesCampanha } from "./acoes";

const STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "outline" | "destructive"
> = {
  rascunho: "outline",
  aguardando_aprovacao: "secondary",
  aprovada: "default",
  enviando: "default",
  enviada: "secondary",
  cancelada: "destructive",
};

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  enviando: "Enviando",
  enviada: "Enviada",
  cancelada: "Cancelada",
};

export default async function CampanhaDetalhePage(
  props: PageProps<"/admin/campanhas/[id]">,
) {
  const { id } = await props.params;
  const { supabase } = await requireAdmin();

  const { data: c } = await supabase
    .from("campanhas")
    .select(
      "id, titulo, categoria, canais, segmentacao, conteudo_whatsapp, conteudo_email_assunto, conteudo_email_corpo, janela_inicio, janela_fim, status, total_alcance, total_bloqueados, created_at, updated_at, aprovada_em, autor_user_id, aprovador_user_id",
    )
    .eq("id", id)
    .maybeSingle();

  if (!c) notFound();

  const editavel = c.status === "rascunho";

  // Quando estiver enviando/enviada, mostra agregados de destinatários
  let agregados:
    | { enviada: number; bloqueada: number; falha: number; pendente: number }
    | null = null;
  if (c.status === "enviando" || c.status === "enviada") {
    const { data: linhas } = await supabase
      .from("campanhas_destinatarios")
      .select("status")
      .eq("campanha_id", c.id);
    const a = { enviada: 0, bloqueada: 0, falha: 0, pendente: 0 };
    for (const l of linhas ?? []) {
      const s = l.status as keyof typeof a;
      if (s in a) a[s]++;
    }
    agregados = a;
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/campanhas"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Campanhas
        </Link>
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {c.titulo}
          </h1>
          <Badge variant={STATUS_VARIANT[c.status] ?? "outline"}>
            {STATUS_LABEL[c.status] ?? c.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Criada{" "}
          {formatRelative(new Date(c.created_at), new Date(), { locale: ptBR })}
          {c.aprovada_em &&
            ` · aprovada em ${format(new Date(c.aprovada_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}`}
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ações</CardTitle>
          <CardDescription>
            Estado atual:{" "}
            <strong>{STATUS_LABEL[c.status] ?? c.status}</strong>. Toda campanha
            passa por rascunho → aguardando aprovação → aprovada → enviando →
            enviada.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AcoesCampanha id={c.id} status={c.status} />
        </CardContent>
      </Card>

      {agregados && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Andamento do disparo</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <Estat label="Entregues" value={agregados.enviada} />
            <Estat label="Bloqueadas" value={agregados.bloqueada} />
            <Estat label="Falhas" value={agregados.falha} />
            <Estat label="Pendentes" value={agregados.pendente} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editavel ? "Editar configuração" : "Configuração (somente leitura)"}
          </CardTitle>
          {!editavel && (
            <CardDescription>
              Submetida ou disparada — clone se quiser ajustar.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {editavel ? (
            <CampanhaForm
              inicial={
                {
                  id: c.id,
                  titulo: c.titulo,
                  categoria: c.categoria as SaveCampanhaInput["categoria"],
                  canais:
                    (c.canais as SaveCampanhaInput["canais"]) ?? ["whatsapp"],
                  segmentacao:
                    (c.segmentacao as SaveCampanhaInput["segmentacao"]) ?? {},
                  conteudo_whatsapp: c.conteudo_whatsapp ?? "",
                  conteudo_email_assunto: c.conteudo_email_assunto ?? "",
                  conteudo_email_corpo: c.conteudo_email_corpo ?? "",
                  janela_inicio: c.janela_inicio,
                  janela_fim: c.janela_fim,
                } satisfies CampanhaInicial
              }
            />
          ) : (
            <pre className="overflow-auto whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-xs">
              {c.conteudo_whatsapp || "(sem conteúdo WhatsApp)"}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Estat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-mono text-lg font-semibold">{value}</p>
    </div>
  );
}
