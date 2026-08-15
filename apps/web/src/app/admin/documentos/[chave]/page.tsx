import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { CHAVES_DOCUMENTO, ROTULO_DOCUMENTO, type ChaveDocumento } from "@/lib/ayla/documentos";
import { listarVersoes } from "../actions";
import { sha256 } from "../sha";
import { EditorDocumento } from "./editor";

export default async function DocumentoPage({ params }: { params: Promise<{ chave: string }> }) {
  await requireAdmin();
  const { chave } = await params;
  if (!(CHAVES_DOCUMENTO as readonly string[]).includes(chave)) notFound();

  const versoes = await listarVersoes(chave);
  const ativa = versoes.find((v) => v.status === "ativo") ?? null;
  const maisNova = versoes[0] ?? null;

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <Link href="/admin/documentos" className="text-xs text-muted-foreground hover:underline">
            ← Documentos da Ayla
          </Link>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">
            {ROTULO_DOCUMENTO[chave as ChaveDocumento]}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">{chave}</p>
        </div>
        {chave !== "core" ? (
          <p className="max-w-md text-xs text-amber-800">
            Este documento ainda <strong>não é usado</strong> nas conversas. Salvar e
            ativar aqui não muda nada para nenhuma família.
          </p>
        ) : null}
      </header>

      <EditorDocumento
        chave={chave}
        // O editor abre com o texto da versão no ar; sem ela, com a mais nova.
        textoInicial={(ativa ?? maisNova)?.conteudo ?? ""}
        shaInicial={sha256((ativa ?? maisNova)?.conteudo ?? "")}
        versaoAtiva={ativa ? { id: ativa.id, versao: ativa.versao } : null}
        versoes={versoes.map((v) => ({
          id: v.id,
          versao: v.versao,
          status: v.status,
          chars: v.conteudo.length,
          sha: sha256(v.conteudo),
          nota: v.nota,
          publicado_em: v.publicado_em,
          created_at: v.created_at,
        }))}
      />
    </div>
  );
}
