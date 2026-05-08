"use client";

import { useState, useTransition } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Copy, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { criarLinkVivo, revogarLinkVivo } from "../actions";

type LinkExistente = {
  id: string;
  destinatario_nome: string;
  token: string;
  expira_em: string | null;
  revogado: boolean;
  revogado_em: string | null;
  acessos: number;
  created_at: string;
};

export function LinkVivoActions({
  relatorioId,
  destinatarioPadrao,
  linksExistentes,
}: {
  relatorioId: string;
  destinatarioPadrao: string;
  linksExistentes: LinkExistente[];
}) {
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [copiado, setCopiado] = useState<string | null>(null);
  const [destinatarioNome, setDestinatarioNome] = useState("");
  const [validade, setValidade] = useState<7 | 30 | 90 | 0>(30);

  const ativos = linksExistentes.filter((l) => !l.revogado);

  function handleCriar() {
    if (destinatarioNome.trim().length < 2) {
      setErro("Nome do destinatário é obrigatório.");
      return;
    }
    setErro(null);
    startTransition(async () => {
      try {
        await criarLinkVivo({
          relatorioId,
          destinatarioNome,
          validadeDias: validade,
        });
        setDestinatarioNome("");
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  function handleRevogar(linkId: string) {
    if (!confirm("Revogar este link? O destinatário perderá acesso.")) return;
    setErro(null);
    startTransition(async () => {
      try {
        await revogarLinkVivo(linkId);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro inesperado");
      }
    });
  }

  function copiar(token: string) {
    const url = `${window.location.origin}/r/${token}`;
    navigator.clipboard.writeText(url).then(() => {
      setCopiado(token);
      setTimeout(() => setCopiado(null), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Destinatário padrão deste relatório:{" "}
        <strong>{destinatarioPadrao === "terapeuta" ? "Terapeuta" : "Escola"}</strong>.
      </p>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="md:col-span-2">
          <Label htmlFor="dest-nome">Nome de quem vai receber</Label>
          <Input
            id="dest-nome"
            value={destinatarioNome}
            onChange={(e) => setDestinatarioNome(e.target.value)}
            placeholder={
              destinatarioPadrao === "terapeuta"
                ? "Ex: Dra. Marina (terapeuta ocupacional)"
                : "Ex: Profa. Ana / Escola Aurora"
            }
          />
        </div>
        <div>
          <Label htmlFor="validade">Validade</Label>
          <select
            id="validade"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            value={validade}
            onChange={(e) => setValidade(Number(e.target.value) as 7 | 30 | 90 | 0)}
          >
            <option value={7}>7 dias</option>
            <option value={30}>30 dias</option>
            <option value={90}>90 dias</option>
            <option value={0}>Sem expiração</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={handleCriar} disabled={pending}>
          {pending ? "Gerando..." : "Gerar link vivo"}
        </Button>
      </div>

      {ativos.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-4">
          <h3 className="text-sm font-medium">Links ativos</h3>
          <ul className="flex flex-col gap-2">
            {ativos.map((l) => (
              <li key={l.id}>
                <div className="rounded-md border bg-card px-3 py-2 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex-1">
                      <p className="font-medium">{l.destinatario_nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.expira_em
                          ? `Expira em ${format(new Date(l.expira_em), "dd/MM/yyyy", {
                              locale: ptBR,
                            })}`
                          : "Sem expiração"}{" "}
                        · {l.acessos} acessos
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => copiar(l.token)}
                      >
                        {copiado === l.token ? (
                          <>
                            <Check aria-hidden="true" /> Copiado
                          </>
                        ) : (
                          <>
                            <Copy aria-hidden="true" /> Copiar URL
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevogar(l.id)}
                        disabled={pending}
                      >
                        Revogar
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {linksExistentes.some((l) => l.revogado) && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer">
            Histórico de revogados ({linksExistentes.filter((l) => l.revogado).length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {linksExistentes
              .filter((l) => l.revogado)
              .map((l) => (
                <li key={l.id} className="flex items-center justify-between">
                  <span>{l.destinatario_nome}</span>
                  <Badge variant="outline">Revogado</Badge>
                </li>
              ))}
          </ul>
        </details>
      )}
    </div>
  );
}
