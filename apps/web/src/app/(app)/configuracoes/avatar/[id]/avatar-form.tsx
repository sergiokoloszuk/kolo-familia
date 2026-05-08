"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { salvarDescricao, gerarAvatar } from "./actions";
import type { AvatarDescricao } from "@/lib/imagem/avatar-prompt";

export function AvatarForm({
  membroId,
  inicial,
  imagemAtualUrl,
}: {
  membroId: string;
  inicial: AvatarDescricao;
  imagemAtualUrl: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [acao, setAcao] = useState<"salvar" | "gerar" | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [imagemUrl, setImagemUrl] = useState(imagemAtualUrl);
  const [form, setForm] = useState<AvatarDescricao>(inicial);

  function update<K extends keyof AvatarDescricao>(k: K, v: AvatarDescricao[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSucesso(null);
  }

  function handleSalvar() {
    setErro(null);
    setSucesso(null);
    setAcao("salvar");
    startTransition(async () => {
      try {
        await salvarDescricao({ membroId, ...form });
        setSucesso("Descrição salva.");
      } catch (e) {
        setErro(traduzirErro(e instanceof Error ? e.message : "Erro inesperado"));
      } finally {
        setAcao(null);
      }
    });
  }

  function handleGerar() {
    setErro(null);
    setSucesso(null);
    setAcao("gerar");
    startTransition(async () => {
      try {
        // Salva primeiro pra garantir que o gerar usa os dados atuais
        await salvarDescricao({ membroId, ...form });
        const r = await gerarAvatar(membroId);
        setImagemUrl(r.imagem_url);
        setSucesso("Avatar gerado.");
      } catch (e) {
        setErro(traduzirErro(e instanceof Error ? e.message : "Erro inesperado"));
      } finally {
        setAcao(null);
      }
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

      <div className="grid gap-4 md:grid-cols-2">
        <Field
          label="Estilo"
          control={
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm shadow-sm"
              value={form.estilo}
              onChange={(e) => update("estilo", e.target.value as "cartoon" | "aquarela")}
            >
              <option value="cartoon">Cartoon</option>
              <option value="aquarela">Aquarela</option>
            </select>
          }
        />
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

      <div className="flex flex-wrap justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={handleSalvar} disabled={pending}>
          {acao === "salvar" ? "Salvando..." : "Salvar descrição"}
        </Button>
        <Button type="button" onClick={handleGerar} disabled={pending}>
          {acao === "gerar" ? "Gerando..." : imagemUrl ? "Gerar de novo" : "Gerar avatar"}
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
