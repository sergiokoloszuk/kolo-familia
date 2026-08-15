"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { salvarNovaVersao, ativarVersao, lerVersao } from "../actions";

type Versao = {
  id: string;
  versao: number;
  status: string;
  chars: number;
  sha: string;
  nota: string | null;
  publicado_em: string | null;
  created_at: string;
};

/** SHA-256 no navegador — o mesmo algoritmo que o servidor usa. */
async function shaCliente(texto: string): Promise<string> {
  const bytes = new TextEncoder().encode(texto);
  const buf = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function EditorDocumento({
  chave,
  textoInicial,
  shaInicial,
  versaoAtiva,
  versoes,
}: {
  chave: string;
  textoInicial: string;
  shaInicial: string;
  versaoAtiva: { id: string; versao: number } | null;
  versoes: Versao[];
}) {
  const [texto, setTexto] = useState(textoInicial);
  const [nota, setNota] = useState("");
  const [sha, setSha] = useState(shaInicial);
  const [aviso, setAviso] = useState<{ tipo: "ok" | "erro"; msg: string } | null>(null);
  const [conferencia, setConferencia] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();
  const emVoo = useRef(false);

  const sujo = texto !== textoInicial;

  // SHA calculado no cliente, sempre que o texto muda.
  useEffect(() => {
    let vivo = true;
    shaCliente(texto).then((s) => {
      if (vivo) setSha(s);
    });
    return () => {
      vivo = false;
    };
  }, [texto]);

  // ⚠️ AVISO DE SAÍDA. O texto é colado à mão, longo, e pode não ter cópia em
  // lugar nenhum. Perder isso por um fechar de aba seria o pior defeito da tela.
  useEffect(() => {
    if (!sujo) return;
    const h = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [sujo]);

  function salvar() {
    // Trava de duplo clique: o `useTransition` já desabilita o botão, mas um
    // clique duplo rápido pode escapar entre o evento e o re-render.
    if (emVoo.current) return;
    emVoo.current = true;
    setAviso(null);
    setConferencia(null);
    iniciar(async () => {
      try {
        const r = await salvarNovaVersao(chave, texto, nota);
        setAviso(r.ok ? { tipo: "ok", msg: r.msg } : { tipo: "erro", msg: r.error });
      } finally {
        emVoo.current = false;
      }
    });
  }

  function ativar(id: string, v: number) {
    if (!confirm(`Colocar a versão ${v} no ar?`)) return;
    setAviso(null);
    iniciar(async () => {
      const r = await ativarVersao(id);
      setAviso(r.ok ? { tipo: "ok", msg: r.msg } : { tipo: "erro", msg: r.error });
    });
  }

  /** Lê do banco e compara com o que está na tela — prova, não impressão. */
  function conferir(id: string) {
    setConferencia(null);
    iniciar(async () => {
      const r = await lerVersao(id);
      if (!r) {
        setConferencia("não consegui ler a versão");
        return;
      }
      const meu = await shaCliente(texto);
      setConferencia(
        r.sha === meu
          ? `✅ o texto persistido é idêntico ao que está no editor (${r.sha.slice(0, 16)}…)`
          : `⚠️ DIFERENTE do editor — banco ${r.sha.slice(0, 16)}… / editor ${meu.slice(0, 16)}…`,
      );
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
        <span>
          <strong>{texto.length.toLocaleString("pt-BR")}</strong> caracteres
        </span>
        <span className="font-mono text-xs text-muted-foreground">SHA-256 {sha}</span>
        {sujo ? <span className="text-xs font-semibold text-amber-700">alterações não salvas</span> : null}
      </div>

      <textarea
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        spellCheck={false}
        placeholder="Cole aqui o documento integral…"
        className="min-h-[520px] w-full resize-y overflow-auto rounded-md border bg-background p-4 font-mono text-xs leading-relaxed"
      />

      <input
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="O que mudou nesta versão (aparece no histórico)"
        className="w-full rounded-md border bg-background px-3 py-2 text-sm"
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button disabled={pendente || !texto.trim()} onClick={salvar}>
          {pendente ? "salvando…" : "Salvar nova versão"}
        </Button>
        <span className="text-xs text-muted-foreground">
          Salvar cria uma versão nova e <strong>não</strong> a coloca no ar.
        </span>
      </div>

      {aviso ? (
        <p className={aviso.tipo === "ok" ? "text-sm text-emerald-700" : "text-sm text-red-700"}>
          {aviso.msg}
        </p>
      ) : null}
      {conferencia ? <p className="font-mono text-xs">{conferencia}</p> : null}

      <section className="rounded-lg border">
        <h2 className="border-b px-4 py-2 text-sm font-semibold">Histórico</h2>
        {versoes.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Nenhuma versão ainda.</p>
        ) : (
          <ul className="flex flex-col divide-y">
            {versoes.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm">
                <span className="font-mono">v{v.versao}</span>
                <span
                  className={
                    v.status === "ativo"
                      ? "rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-900"
                      : "rounded bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground"
                  }
                >
                  {v.status === "ativo" ? "no ar" : v.publicado_em ? "já esteve no ar" : "candidata"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {v.chars.toLocaleString("pt-BR")} car.
                </span>
                <span className="font-mono text-xs text-muted-foreground">{v.sha.slice(0, 16)}…</span>
                <span className="flex-1 truncate text-xs text-muted-foreground">{v.nota ?? ""}</span>
                <Button size="sm" variant="ghost" disabled={pendente} onClick={() => conferir(v.id)}>
                  Conferir
                </Button>
                {v.status !== "ativo" ? (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={pendente}
                    onClick={() => ativar(v.id, v.versao)}
                  >
                    {versaoAtiva ? "Ativar (troca a do ar)" : "Ativar"}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
