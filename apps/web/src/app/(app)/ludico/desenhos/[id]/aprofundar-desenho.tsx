"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { aprofundarDesenho } from "../actions";

export function AprofundarDesenho({
  desenhoId,
  nome,
}: {
  desenhoId: string;
  nome: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const ela = nome ?? "a criança";

  function go() {
    setErro(null);
    start(async () => {
      const r = await aprofundarDesenho({ desenhoId });
      if (!r.ok) setErro(r.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-2xl border border-brand-purple/20 bg-white p-4">
      <p className="text-sm leading-relaxed text-foreground">
        Conversou com {ela} e anotou acima? Agora a Kolo monta a <strong>leitura</strong> a
        partir do desenho e do que {ela} contou — com uma{" "}
        <strong>história pra continuar juntas</strong>. (Dá pra gerar sem a resposta, mas com a
        voz de {ela} fica muito mais rica.)
      </p>
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <Button type="button" onClick={go} disabled={pending} className="w-fit">
        {pending ? (
          <>
            <Sparkles className="size-4 animate-pulse" aria-hidden /> Gerando a leitura…
          </>
        ) : (
          <>
            <Sparkles className="size-4" aria-hidden /> Gerar a leitura
          </>
        )}
      </Button>
    </div>
  );
}
