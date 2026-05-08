"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { gerarApoio, type GerarApoioResultado } from "../actions";
import { gerarCenaParaGaleria } from "../../galeria/actions";

const TIPO_GALERIA: Record<string, "brincadeira" | "atividade" | "historia_social"> = {
  brincadeiras: "brincadeira",
  atividades: "atividade",
  historias_sociais: "historia_social",
};

export function ApoioForm({
  outputTypeKey,
  geraImagemOpcional,
  membros,
}: {
  outputTypeKey: string;
  geraImagemOpcional: boolean;
  membros: Array<{ id: string; nome: string }>;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [resultado, setResultado] = useState<GerarApoioResultado | null>(null);
  const [membroId, setMembroId] = useState<string>(membros[0]?.id ?? "");
  const [pedido, setPedido] = useState("");
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [imagemPending, setImagemPending] = useState(false);
  const [imagemErro, setImagemErro] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pedido.trim()) return;
    setError(null);
    setResultado(null);
    startTransition(async () => {
      try {
        const r = await gerarApoio({
          outputTypeKey,
          membroAtipicoId: membroId || null,
          pedido,
        });
        setResultado(r);
      } catch (e) {
        setError(traduzirErro(e instanceof Error ? e.message : "Erro inesperado"));
      }
    });
  }

  function tentarOutra() {
    setResultado(null);
    setPedido("");
    setImagemUrl(null);
    setImagemErro(null);
  }

  function handleGerarImagem() {
    if (!membroId) {
      setImagemErro("Escolha sobre qual membro é a cena pra gerar imagem.");
      return;
    }
    const tipo = TIPO_GALERIA[outputTypeKey];
    if (!tipo) return;
    setImagemErro(null);
    setImagemPending(true);
    (async () => {
      try {
        const r = await gerarCenaParaGaleria({
          membroAtipicoId: membroId,
          descricaoCena: pedido,
          tipo,
        });
        setImagemUrl(r.url);
      } catch (e) {
        setImagemErro(traduzirErro(e instanceof Error ? e.message : "Erro inesperado"));
      } finally {
        setImagemPending(false);
      }
    })();
  }

  if (resultado) {
    return (
      <div className="flex flex-col gap-4">
        {!resultado.validacaoOk && resultado.validacaoMotivo && (
          <div className="rounded-md border border-amber-300/60 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Aviso de validação: {resultado.validacaoMotivo}
          </div>
        )}
        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <CardTitle className="text-sm font-medium">Sua resposta</CardTitle>
            {resultado.skillsAcionadas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {resultado.skillsAcionadas.map((s) => (
                  <Badge key={s.name} variant="secondary" className="text-xs">
                    {s.display_name}
                  </Badge>
                ))}
              </div>
            )}
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm">{resultado.texto}</p>
          </CardContent>
        </Card>

        {geraImagemOpcional && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">Gerar imagem desta cena</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {imagemErro && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {imagemErro}
                </div>
              )}
              {imagemUrl ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagemUrl}
                    alt="Cena ilustrada"
                    className="aspect-square w-full max-w-sm rounded-md border object-cover"
                  />
                  <p className="text-xs text-muted-foreground">
                    Salva na sua galeria. Você pode favoritar e baixar lá.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-xs text-muted-foreground">
                    Vai usar o avatar canônico do membro + a descrição da cena.
                    Configure o avatar antes em /configuracoes/avatar.
                  </p>
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleGerarImagem}
                      disabled={imagemPending}
                    >
                      {imagemPending ? "Gerando..." : "Gerar imagem"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={tentarOutra}>
            Pedir outra
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {membros.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="membro">Sobre quem é?</Label>
          <select
            id="membro"
            className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
            value={membroId}
            onChange={(e) => setMembroId(e.target.value)}
          >
            <option value="">Geral da família</option>
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="pedido">Contexto / situação</Label>
        <textarea
          id="pedido"
          rows={4}
          value={pedido}
          onChange={(e) => setPedido(e.target.value)}
          placeholder="Ex: dia chuvoso, criança em casa o dia inteiro, querendo descarregar energia."
          className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          disabled={pending}
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          O Kolo Família não substitui profissionais da saúde.
        </p>
        <Button type="submit" disabled={pending || !pedido.trim()}>
          {pending ? "Pensando..." : "Gerar"}
        </Button>
      </div>
    </form>
  );
}

function traduzirErro(msg: string): string {
  if (msg.toLowerCase().includes("anthropic_api_key"))
    return "A chave da Anthropic não está configurada no servidor.";
  if (msg.toLowerCase().includes("nenhuma skill"))
    return "Skills iniciais ainda não estão no banco. Aplique a migração 0003_seed.sql.";
  if (msg.toLowerCase().includes("não encontrado"))
    return "Tipo de apoio não encontrado.";
  return msg;
}
