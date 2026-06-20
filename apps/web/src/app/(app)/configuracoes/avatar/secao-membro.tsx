"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Shirt, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AvataresGaleria } from "./[id]/avatares-galeria";
import { AvatarForm } from "./[id]/avatar-form";
import { vestirAvatar } from "./[id]/actions";
import type { AvatarDescricao } from "@/lib/imagem/avatar-prompt";

type AvatarItem = { id: string; imagem_url: string | null; selecionado: boolean };

const OCASIOES = [
  "Festa junina",
  "Aniversário",
  "Natal",
  "Páscoa",
  "Praia / verão",
  "Fantasia de super-herói",
];

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
  const [modo, setModo] = useState<null | "criar" | "editar" | "vestir">(null);
  const temAvatares = avatares.some((a) => a.imagem_url);
  // Avatar base pra "vestir": o em uso (ou o primeiro com imagem).
  const base =
    avatares.find((a) => a.selecionado && a.imagem_url) ??
    avatares.find((a) => a.imagem_url) ??
    null;

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
          {temAvatares && base && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setModo((m) => (m === "vestir" ? null : "vestir"))}
            >
              {modo === "vestir" ? <X className="size-4" aria-hidden /> : <Shirt className="size-4" aria-hidden />}
              {modo === "vestir" ? "Fechar" : "Vestir"}
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

      {modo === "vestir" && base ? (
        <div className="rounded-xl border border-brand-purple/15 bg-kolo-lilas-bg-2/30 p-4">
          <p className="mb-3 text-sm text-muted-foreground">
            Mantém o mesmo personagem (mesma cara e estilo) e troca só a roupa pra
            uma ocasião. Vira um novo avatar — o original continua na galeria.
          </p>
          <VestirForm avatarBaseId={base.id} />
        </div>
      ) : modo ? (
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
      ) : null}
    </section>
  );
}

/** Form de "vestir": ocasião por chips ou texto livre → gera variação. */
function VestirForm({ avatarBaseId }: { avatarBaseId: string }) {
  const router = useRouter();
  const [ocasiao, setOcasiao] = useState("");
  const [pending, start] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function vestir(texto: string) {
    const t = texto.trim();
    if (!t || pending) return;
    setErro(null);
    start(async () => {
      const r = await vestirAvatar({ avatarId: avatarBaseId, ocasiao: t });
      if (!r.ok) setErro(r.error);
      else {
        setOcasiao("");
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {erro && <p className="text-sm text-destructive">{erro}</p>}
      <div className="flex flex-wrap gap-2">
        {OCASIOES.map((o) => (
          <button
            key={o}
            type="button"
            disabled={pending}
            onClick={() => setOcasiao(o)}
            className="rounded-full border border-brand-purple/40 px-3 py-1.5 text-xs font-medium text-brand-purple transition-colors hover:bg-white disabled:opacity-50"
          >
            {o}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          value={ocasiao}
          onChange={(e) => setOcasiao(e.target.value)}
          placeholder="Ou escreva a ocasião / roupa (ex.: fantasia de astronauta)"
          disabled={pending}
        />
        <Button type="button" onClick={() => vestir(ocasiao)} disabled={pending || !ocasiao.trim()}>
          <Sparkles className="size-4" aria-hidden />
          {pending ? "Vestindo…" : "Vestir avatar"}
        </Button>
      </div>
    </div>
  );
}
