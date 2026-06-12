"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { enviarDesenho } from "./actions";

export function EnviarDesenho({ membros }: { membros: Array<{ id: string; nome: string }> }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [membroId, setMembroId] = useState(membros[0]?.id ?? "");
  const [contexto, setContexto] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [arrastando, setArrastando] = useState(false);
  const [pending, start] = useTransition();

  function escolher(f: File | null) {
    setErro(null);
    if (f && !f.type.startsWith("image/")) {
      setErro("Isso não parece uma imagem. Use uma foto/print (PNG, JPG ou WEBP).");
      return;
    }
    setPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return f ? URL.createObjectURL(f) : null;
    });
    setFile(f);
  }

  function aoSoltar(e: React.DragEvent) {
    e.preventDefault();
    setArrastando(false);
    const f = e.dataTransfer.files?.[0];
    if (f) escolher(f);
  }

  // Colar imagem (Ctrl+V / Cmd+V) — pega a primeira imagem da área de
  // transferência (print, foto copiada, etc.) e usa como o desenho.
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const it of items) {
        if (it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) {
            escolher(f);
            e.preventDefault();
          }
          break;
        }
      }
    }
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, []);

  function enviar() {
    if (!file || pending) return;
    setErro(null);
    const fd = new FormData();
    fd.append("file", file);
    if (membroId) fd.append("membroId", membroId);
    if (contexto.trim()) fd.append("contexto", contexto.trim());
    start(async () => {
      const r = await enviarDesenho(fd);
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.push(`/ludico/desenhos/${r.desenhoId}`);
    });
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-5">
      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => escolher(e.target.files?.[0] ?? null)}
      />

      {preview ? (
        <div className="relative w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={preview} alt="Desenho" className="max-h-64 rounded-xl object-contain" />
          <button
            type="button"
            onClick={() => escolher(null)}
            aria-label="Remover"
            className="absolute -right-2 -top-2 flex size-7 items-center justify-center rounded-full bg-foreground text-white shadow"
          >
            <X className="size-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setArrastando(true);
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={aoSoltar}
          className={cn(
            "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-10 transition-colors",
            arrastando
              ? "border-brand-purple bg-brand-purple/5 text-brand-purple"
              : "border-foreground/15 text-muted-foreground hover:border-brand-purple/40 hover:text-brand-purple",
          )}
        >
          <ImagePlus className="size-8" aria-hidden />
          <span className="text-sm font-medium">
            {arrastando ? "Solte a imagem aqui" : "Arraste, cole ou escolha o desenho"}
          </span>
          <span className="text-xs text-muted-foreground/70">
            Arraste pra cá · cole com Ctrl+V · ou toque pra tirar foto/abrir arquivo
          </span>
        </button>
      )}

      {membros.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="des-membro" className="text-sm font-medium text-foreground">
            De quem é o desenho
          </label>
          <select
            id="des-membro"
            value={membroId}
            onChange={(e) => setMembroId(e.target.value)}
            className="h-10 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm"
          >
            {membros.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="des-contexto" className="text-sm font-medium text-foreground">
          O que rolava antes / como ela estava{" "}
          <span className="font-normal text-muted-foreground">(opcional)</span>
        </label>
        <textarea
          id="des-contexto"
          rows={2}
          value={contexto}
          onChange={(e) => setContexto(e.target.value)}
          placeholder="Ex.: fez depois da escola, num dia agitado; estava animada; se ela já te contou o que é, pode adiantar aqui."
          className="w-full resize-none rounded-xl border border-foreground/[0.08] bg-white/70 px-3.5 py-2.5 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-foreground/10"
        />
      </div>

      <div>
        <Button type="button" onClick={enviar} disabled={pending || !file}>
          {pending ? (
            <>
              <Sparkles className="size-4 animate-pulse" aria-hidden /> Enviando…
            </>
          ) : (
            <>
              <Sparkles className="size-4" aria-hidden /> Ver o que o desenho conta
            </>
          )}
        </Button>
      </div>

      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        Isto é uma leitura observacional pra ajudar você a perguntar e acompanhar — não é
        diagnóstico nem substitui profissionais de saúde.
      </p>
    </div>
  );
}
