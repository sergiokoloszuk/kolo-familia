"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  salvarRascunho,
  descartarRascunho,
  publicarRascunho,
  restaurarVersao,
  simular,
} from "./actions";

type Versao = {
  id: string;
  versao: number;
  status: string;
  nota: string | null;
  quando: string;
  tamanho: number;
};

type Props = {
  ativo: { versao: number; conteudo: string; publicadoEm: string | null } | null;
  rascunho: { versao: number; conteudo: string } | null;
  fallback: string;
  historico: Versao[];
  familias: Array<{ id: string; nome: string }>;
};

const STATUS_COR: Record<string, string> = {
  ativo: "bg-emerald-100 text-emerald-900",
  rascunho: "bg-amber-100 text-amber-900",
  arquivado: "bg-muted text-muted-foreground",
};

export function EditorCore({ ativo, rascunho, fallback, historico, familias }: Props) {
  // O que está no editor: o rascunho se houver, senão o que está no ar, senão
  // o Core do código — para editar a partir do que a Ayla é hoje, e não do zero.
  const partida = rascunho?.conteudo ?? ativo?.conteudo ?? fallback;
  const [texto, setTexto] = useState(partida);
  const [nota, setNota] = useState("");
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [pendente, iniciar] = useTransition();

  const noAr = ativo ? `v${ativo.versao} (banco)` : "Core do código";
  const sujo = texto !== partida;

  function rodar(fn: () => Promise<{ ok: boolean; msg?: string; error?: string }>) {
    setAviso(null);
    iniciar(async () => {
      const r = await fn();
      setAviso(
        r.ok
          ? { tipo: "ok", msg: r.msg ?? "Feito." }
          : { tipo: "erro", msg: r.error ?? "Falhou." },
      );
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle className="text-base">
            CORE — no ar: <span className="font-mono text-sm">{noAr}</span>
          </CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {rascunho ? (
              <Badge className={STATUS_COR.rascunho}>rascunho v{rascunho.versao}</Badge>
            ) : null}
            <span>{texto.length.toLocaleString("pt-BR")} caracteres</span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            spellCheck={false}
            className="min-h-[420px] w-full rounded-md border bg-background p-3 font-mono text-xs leading-relaxed"
          />
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="O que mudou e por quê (aparece no histórico)"
            className="w-full rounded-md border bg-background px-3 py-2 text-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              disabled={pendente || !sujo}
              onClick={() => rodar(() => salvarRascunho(texto, nota))}
            >
              Salvar rascunho
            </Button>
            <Button
              variant="secondary"
              disabled={pendente || !rascunho}
              onClick={() => rodar(publicarRascunho)}
            >
              Publicar
            </Button>
            <Button
              variant="ghost"
              disabled={pendente || !rascunho}
              onClick={() => rodar(descartarRascunho)}
            >
              Descartar rascunho
            </Button>
            {sujo ? (
              <span className="text-xs text-amber-700">
                Alterações não salvas — o simulador testa o rascunho SALVO.
              </span>
            ) : null}
          </div>
          {aviso ? (
            <p
              className={
                aviso.tipo === "ok"
                  ? "text-sm text-emerald-700"
                  : "text-sm text-red-700"
              }
            >
              {aviso.msg}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Simulador familias={familias} temRascunho={!!rascunho} />

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico</CardTitle>
        </CardHeader>
        <CardContent>
          {historico.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma versão ainda. A Ayla está no Core do código.
            </p>
          ) : (
            <ul className="flex flex-col divide-y">
              {historico.map((v) => (
                <li key={v.id} className="flex items-center gap-3 py-2 text-sm">
                  <Badge className={STATUS_COR[v.status] ?? ""}>{v.status}</Badge>
                  <span className="font-mono">v{v.versao}</span>
                  <span className="text-xs text-muted-foreground">
                    {new Date(v.quando).toLocaleString("pt-BR")} ·{" "}
                    {v.tamanho.toLocaleString("pt-BR")} car.
                  </span>
                  <span className="flex-1 truncate text-xs text-muted-foreground">
                    {v.nota ?? ""}
                  </span>
                  {v.status === "arquivado" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pendente}
                      onClick={() => rodar(() => restaurarVersao(v.id))}
                    >
                      Restaurar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * TESTAR A AYLA — com uma família real do QA, sem tocar nela.
 *
 * ⚠️ Nada é enviado por WhatsApp e nada entra no histórico da conversa. O que
 * o simulador faz é ler o contexto real e chamar o modelo — o mesmo caminho da
 * conversa, sem o orquestrador que envia e registra.
 */
function Simulador({
  familias,
  temRascunho,
}: {
  familias: Array<{ id: string; nome: string }>;
  temRascunho: boolean;
}) {
  const [familia, setFamilia] = useState(familias[0]?.id ?? "");
  const [msg, setMsg] = useState("");
  const [usarRascunho, setUsarRascunho] = useState(temRascunho);
  const [saida, setSaida] = useState<
    | { ok: true; texto: string; coreOrigem: string; coreVersao: number | null; foco: string; ms: number }
    | { ok: false; error: string }
    | null
  >(null);
  const [pendente, iniciar] = useTransition();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Testar a Ayla</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">
          Lê o contexto real da família e chama o modelo. <strong>Não envia
          WhatsApp, não entra no histórico da conversa e não registra
          aprendizado.</strong> O gasto de token é real e aparece no Uso de API
          como <code>ayla_simulador</code>.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={familia}
            onChange={(e) => setFamilia(e.target.value)}
            className="rounded-md border bg-background px-3 py-2 text-sm"
          >
            {familias.length === 0 ? <option value="">nenhuma família no QA</option> : null}
            {familias.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={usarRascunho}
              disabled={!temRascunho}
              onChange={(e) => setUsarRascunho(e.target.checked)}
            />
            Usar o rascunho {temRascunho ? "" : "(não há)"}
          </label>
        </div>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="A mensagem que a mãe mandaria…"
          className="min-h-[80px] w-full rounded-md border bg-background p-3 text-sm"
        />
        <div>
          <Button
            disabled={pendente || !msg.trim() || !familia}
            onClick={() =>
              iniciar(async () => {
                setSaida(null);
                setSaida(await simular(familia, msg, usarRascunho));
              })
            }
          >
            {pendente ? "A Ayla está pensando…" : "Testar"}
          </Button>
        </div>
        {saida ? (
          saida.ok ? (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="mb-2 text-xs text-muted-foreground">
                Testando Core{" "}
                <strong>
                  {saida.coreVersao !== null ? `v${saida.coreVersao}` : "do código"}
                </strong>{" "}
                — {usarRascunho ? "RASCUNHO" : saida.coreOrigem === "admin" ? "ATIVO" : "FALLBACK"} ·
                foco {saida.foco} · {(saida.ms / 1000).toFixed(1)}s
              </p>
              <p className="whitespace-pre-wrap text-sm">{saida.texto}</p>
            </div>
          ) : (
            <p className="text-sm text-red-700">{saida.error}</p>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
