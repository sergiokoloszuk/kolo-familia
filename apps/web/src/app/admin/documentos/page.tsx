import Link from "next/link";
import { requireAdmin } from "@/lib/auth/require-admin";
import { CHAVES_DOCUMENTO, ROTULO_DOCUMENTO } from "@/lib/ayla/documentos";
import { resumoDocumentos } from "./actions";
import { sha256 } from "./sha";

/**
 * DOCUMENTOS DA AYLA — a lista.
 *
 * ⚠️ CADASTRAR ≠ INJETAR. Hoje só o Core é resolvido e entra no prompt. Os
 * outros quatro podem ser escritos, versionados e ativados aqui sem que uma
 * única conversa mude — a decisão de quando cada um entra é outra frente.
 * A tela diz isso em voz alta para ninguém achar que ativou e ligou.
 */
export default async function DocumentosPage() {
  await requireAdmin();
  const linhas = await resumoDocumentos();

  const porChave = new Map<string, ReturnType<typeof Object>[]>();
  for (const l of linhas) {
    const arr = (porChave.get(l.chave) ?? []) as typeof linhas;
    arr.push(l);
    porChave.set(l.chave, arr as never);
  }

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Documentos da Ayla</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          O texto que define como a Ayla pensa, conduz e entrega. Cole o documento
          integral, salve como versão nova e ative quando quiser. Salvar nunca
          sobrescreve: cada versão fica no histórico.
        </p>
      </header>

      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
        <strong>Cadastrar não é ligar.</strong> Hoje apenas o <strong>Core</strong> é
        usado nas conversas. Trial, Plano, Cartões Visuais e Fontes Confiáveis podem
        ser escritos e ativados aqui sem afetar nenhuma família — quando cada um
        entra na conversa é decisão de outra etapa.
      </div>

      <ul className="flex flex-col divide-y rounded-lg border">
        {CHAVES_DOCUMENTO.map((chave) => {
          const versoes = (linhas.filter((l) => l.chave === chave) ?? []).sort(
            (a, b) => b.versao - a.versao,
          );
          const ativa = versoes.find((v) => v.status === "ativo");
          const ultima = versoes[0];
          return (
            <li key={chave} className="flex items-center gap-4 p-4">
              <div className="min-w-44">
                <Link
                  href={`/admin/documentos/${chave}`}
                  className="font-semibold underline-offset-4 hover:underline"
                >
                  {ROTULO_DOCUMENTO[chave]}
                </Link>
                <div className="font-mono text-xs text-muted-foreground">{chave}</div>
              </div>

              {versoes.length === 0 ? (
                <span className="text-sm text-muted-foreground">
                  ainda não cadastrado — abra e cole o texto
                </span>
              ) : (
                <div className="flex flex-1 flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                  <span>
                    {ativa ? (
                      <>
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900">
                          no ar
                        </span>{" "}
                        v{ativa.versao}
                      </>
                    ) : (
                      <span className="rounded bg-muted px-2 py-0.5 text-xs font-semibold">
                        nenhuma versão no ar
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {(ativa ?? ultima).chars.toLocaleString("pt-BR")} caracteres
                  </span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {(ativa ?? ultima).sha.slice(0, 16)}…
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {versoes.length} versã{versoes.length === 1 ? "o" : "es"}
                    {ativa?.publicado_em
                      ? ` · no ar desde ${new Date(ativa.publicado_em).toLocaleString("pt-BR")}`
                      : ""}
                  </span>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
