"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { selecionarAvatar, excluirAvatar } from "./actions";

type AvatarItem = { id: string; imagem_url: string | null; selecionado: boolean };

export function AvataresGaleria({ avatares }: { avatares: AvatarItem[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const comImagem = avatares.filter((a) => a.imagem_url);

  if (comImagem.length === 0) return null;

  function escolher(id: string) {
    setErro(null);
    start(async () => {
      const r = await selecionarAvatar({ avatarId: id });
      if (!r.ok) setErro(r.error);
      else router.refresh();
    });
  }

  function remover(id: string) {
    setErro(null);
    start(async () => {
      const r = await excluirAvatar({ avatarId: id });
      if (!r.ok) setErro(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {comImagem.map((a) => (
          <div
            key={a.id}
            className={cn(
              "relative flex flex-col gap-2 rounded-2xl border-2 bg-white p-2 transition-colors",
              a.selecionado ? "border-brand-purple" : "border-transparent hover:border-brand-purple/30",
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={a.imagem_url as string}
              alt="Avatar"
              className="aspect-square w-full rounded-xl object-cover"
            />
            {a.selecionado ? (
              <span className="inline-flex items-center justify-center gap-1 rounded-full bg-brand-purple px-2.5 py-1 text-xs font-semibold text-white">
                <Check className="size-3" aria-hidden /> Em uso
              </span>
            ) : (
              <button
                type="button"
                onClick={() => escolher(a.id)}
                disabled={pending}
                className="rounded-full border border-brand-purple/40 px-2.5 py-1 text-xs font-semibold text-brand-purple transition-colors hover:bg-kolo-lilas-bg-2 disabled:opacity-50"
              >
                Usar este
              </button>
            )}
            <button
              type="button"
              onClick={() => remover(a.id)}
              disabled={pending}
              aria-label="Excluir avatar"
              className="absolute right-1 top-1 flex size-7 items-center justify-center rounded-full bg-white/90 text-muted-foreground shadow transition-colors hover:text-destructive disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
