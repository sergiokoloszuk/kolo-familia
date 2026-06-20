"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { criarEGerarAvatar } from "./actions";
import { AVATAR_ESTILOS, type AvatarDescricao } from "@/lib/imagem/avatar-prompt";

export function AvatarForm({
  membroId,
  inicial,
}: {
  membroId: string;
  inicial: AvatarDescricao;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [form, setForm] = useState<AvatarDescricao>(inicial);

  function update<K extends keyof AvatarDescricao>(k: K, v: AvatarDescricao[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSucesso(null);
  }

  function handleCriar() {
    setErro(null);
    setSucesso(null);
    startTransition(async () => {
      const r = await criarEGerarAvatar({ membroId, ...form });
      if (!r.ok) {
        setErro(traduzirErro(r.error));
        return;
      }
      setImagemUrl(r.imagem_url);
      setSucesso("Avatar criado e escolhido como o atual.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {erro && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}
      {sucesso && (
        <div className="rounded-md border border-green-300/60 bg-green-50 px-3 py-2 text-sm text-green-900">
          {sucesso}
        </div>
      )}

      {imagemUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imagemUrl}
          alt="Avatar gerado"
          className="aspect-square w-48 self-start rounded-md border object-cover"
        />
      )}

      <div className="flex flex-col gap-2">
        <Label>Estilo</Label>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {AVATAR_ESTILOS.map((es) => {
            const ativo = form.estilo === es.value;
            return (
              <button
                key={es.value}
                type="button"
                onClick={() => update("estilo", es.value)}
                aria-pressed={ativo}
                className={cn(
                  "flex flex-col gap-1 rounded-xl border-2 p-3 text-left transition-colors",
                  ativo
                    ? "border-brand-purple bg-kolo-lilas-bg-2/50"
                    : "border-input bg-background hover:border-brand-purple/40",
                )}
              >
                <span className="text-sm font-semibold text-foreground">{es.label}</span>
                <span className="text-xs leading-snug text-muted-foreground">{es.descricao}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Idade aproximada (opcional)"
          control={
            <Input
              type="number"
              value={form.idade ?? ""}
              onChange={(e) =>
                update("idade", e.target.value ? Number(e.target.value) : null)
              }
            />
          }
        />
        <Field
          label="Gênero visual"
          control={
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={form.generoVisual ?? ""}
              onChange={(e) =>
                update("generoVisual", (e.target.value || null) as AvatarDescricao["generoVisual"])
              }
            >
              <option value="">—</option>
              <option value="menino">Menino</option>
              <option value="menina">Menina</option>
              <option value="neutro">Neutro</option>
            </select>
          }
        />
        <Field
          label="Tom de pele"
          control={
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={form.tomPele ?? ""}
              onChange={(e) =>
                update("tomPele", (e.target.value || null) as AvatarDescricao["tomPele"])
              }
            >
              <option value="">—</option>
              <option value="muito_clara">Muito clara</option>
              <option value="clara">Clara</option>
              <option value="media">Média</option>
              <option value="morena">Morena</option>
              <option value="negra_clara">Negra clara</option>
              <option value="negra">Negra</option>
            </select>
          }
        />
        <Field
          label="Cor do cabelo"
          control={
            <Input
              value={form.cabeloCor ?? ""}
              onChange={(e) => update("cabeloCor", e.target.value || null)}
              placeholder="Ex: castanho escuro"
            />
          }
        />
        <Field
          label="Comprimento do cabelo"
          control={
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={form.cabeloComprimento ?? ""}
              onChange={(e) =>
                update(
                  "cabeloComprimento",
                  (e.target.value || null) as AvatarDescricao["cabeloComprimento"],
                )
              }
            >
              <option value="">—</option>
              <option value="curto">Curto</option>
              <option value="medio">Médio</option>
              <option value="longo">Longo</option>
            </select>
          }
        />
        <Field
          label="Textura do cabelo"
          control={
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={form.cabeloTextura ?? ""}
              onChange={(e) =>
                update(
                  "cabeloTextura",
                  (e.target.value || null) as AvatarDescricao["cabeloTextura"],
                )
              }
            >
              <option value="">—</option>
              <option value="liso">Liso</option>
              <option value="ondulado">Ondulado</option>
              <option value="cacheado">Cacheado</option>
              <option value="crespo">Crespo</option>
            </select>
          }
        />
        <Field
          label="Usa óculos?"
          control={
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.oculos ?? false}
                onChange={(e) => update("oculos", e.target.checked)}
              />
              Sim
            </label>
          }
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="tracos">Traços marcantes (opcional)</Label>
        <Input
          id="tracos"
          value={form.tracosMarcantes ?? ""}
          onChange={(e) => update("tracosMarcantes", e.target.value || null)}
          placeholder="Ex: sardas no nariz, dente da frente um pouco grande"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="roupas">Roupas frequentes (opcional)</Label>
        <Input
          id="roupas"
          value={form.roupasFrequentes ?? ""}
          onChange={(e) => update("roupasFrequentes", e.target.value || null)}
          placeholder="Ex: camiseta de dinossauro e calça de moletom"
        />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
        <Button type="button" onClick={handleCriar} disabled={pending}>
          {pending ? "Criando…" : "Criar avatar"}
        </Button>
      </div>
    </div>
  );
}

function Field({ label, control }: { label: string; control: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {control}
    </div>
  );
}

function traduzirErro(msg: string): string {
  if (msg.toLowerCase().includes("openai_api_key"))
    return "A chave da OpenAI não está configurada no servidor.";
  if (msg.toLowerCase().includes("storage upload"))
    return "Falha ao salvar a imagem no Storage. Verifique se a migração 0005 foi aplicada.";
  if (msg.toLowerCase().includes("salve a descrição"))
    return "Salve a descrição primeiro, depois gere o avatar.";
  return msg;
}
