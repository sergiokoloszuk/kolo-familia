"use client";

import { useState } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AvataresGaleria } from "./[id]/avatares-galeria";
import { AvatarForm } from "./[id]/avatar-form";
import type { AvatarDescricao } from "@/lib/imagem/avatar-prompt";

type AvatarItem = { id: string; imagem_url: string | null; selecionado: boolean };

/**
 * Seção de um membro na página única de Avatar (Lúdico). Mostra a galeria
 * (escolher / deletar — já dentro de AvataresGaleria) e os botões Criar novo /
 * Editar, que abrem o formulário sob demanda. "Editar" não altera o pixel
 * (avatar é gerado por IA): abre o criador já preenchido com as características
 * do avatar atual, pra gerar uma versão nova.
 */
export function AvatarMembroSecao({
  membroId,
  nome,
  subtitulo,
  avatares,
  inicialCriar,
  inicialEditar,
}: {
  membroId: string;
  nome: string;
  subtitulo: string;
  avatares: AvatarItem[];
  inicialCriar: AvatarDescricao;
  inicialEditar: AvatarDescricao;
}) {
  const [modo, setModo] = useState<null | "criar" | "editar">(null);
  const temAvatares = avatares.some((a) => a.imagem_url);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-foreground/[0.08] bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg font-medium text-foreground">{nome}</h2>
          <p className="text-sm text-muted-foreground">{subtitulo}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant={modo === "criar" ? "secondary" : "default"}
            onClick={() => setModo((m) => (m === "criar" ? null : "criar"))}
          >
            {modo === "criar" ? <X className="size-4" aria-hidden /> : <Plus className="size-4" aria-hidden />}
            {modo === "criar" ? "Fechar" : "Criar novo"}
          </Button>
          {temAvatares && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setModo((m) => (m === "editar" ? null : "editar"))}
            >
              {modo === "editar" ? <X className="size-4" aria-hidden /> : <Pencil className="size-4" aria-hidden />}
              {modo === "editar" ? "Fechar" : "Editar"}
            </Button>
          )}
        </div>
      </div>

      {temAvatares ? (
        <AvataresGaleria avatares={avatares} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Ainda não há avatar pra {nome}. Toque em <strong>Criar novo</strong> pra montar o primeiro.
        </p>
      )}

      {modo && (
        <div className="rounded-xl border border-brand-purple/15 bg-kolo-lilas-bg-2/30 p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            {modo === "criar"
              ? "Descreva o avatar e gere a imagem. O novo já entra como o escolhido."
              : "Ajuste as características do avatar atual e gere uma nova versão (a anterior continua na galeria — você decide qual usar ou deletar)."}
          </p>
          {/* key força remontar o form ao trocar entre criar/editar, pra pegar o inicial certo */}
          <AvatarForm
            key={modo}
            membroId={membroId}
            inicial={modo === "criar" ? inicialCriar : inicialEditar}
          />
        </div>
      )}
    </section>
  );
}
