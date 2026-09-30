"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronDown, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { criarEGerarAvatar } from "./actions";
import { AVATAR_ESTILOS, type AvatarDescricao } from "@/lib/imagem/avatar-prompt";

export function AvatarForm({
  membroId,
  nome,
  inicial,
  temAvatar,
  retomarHref,
  intencaoId,
}: {
  membroId: string;
  nome: string;
  inicial: AvatarDescricao;
  temAvatar: boolean;
  retomarHref?: string;
  intencaoId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [imagemUrl, setImagemUrl] = useState<string | null>(null);
  const [form, setForm] = useState<AvatarDescricao>(inicial);
  const [detalhesAbertos, setDetalhesAbertos] = useState(!temAvatar);
  const estilosOrdenados = [...AVATAR_ESTILOS].sort((a, b) => {
    const jovem = (form.idade ?? 0) >= 11;
    const prioridade = jovem
      ? ["gamer_3d", "anime_3d", "ficcao_3d", "fantasia_3d", "animacao_3d"]
      : ["animacao_3d", "massinha_3d", "pelucia", "fantasia_3d"];
    const rank = (value: string) => {
      const i = prioridade.indexOf(value);
      return i < 0 ? prioridade.length : i;
    };
    return rank(a.value) - rank(b.value);
  });

  function update<K extends keyof AvatarDescricao>(k: K, v: AvatarDescricao[K]) {
    setForm((f) => ({ ...f, [k]: v }));
    setSucesso(null);
  }

  function handleCriar() {
    setErro(null);
    setSucesso(null);
    startTransition(async () => {
      const r = await criarEGerarAvatar({ membroId, intencaoId, ...form });
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
      {pending && (
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-gradient-to-br from-brand-purple-deep to-brand-purple-dark px-6 py-12 text-center text-white">
          <span className="grid size-20 animate-pulse place-items-center rounded-full bg-white/10 text-4xl">✨</span>
          <div><p className="font-heading text-2xl">Criando o avatar de {nome}…</p><p className="mt-2 text-sm text-white/75">Pode levar alguns segundos. Mantenha esta tela aberta.</p></div>
        </div>
      )}

      {sucesso && imagemUrl && !pending && (
        <div className="grid gap-5 rounded-2xl border border-green-300/60 bg-green-50 p-5 sm:grid-cols-[12rem_1fr]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imagemUrl} alt={`Novo avatar de ${nome}`} className="aspect-square w-full rounded-2xl border bg-white object-cover" />
          <div className="flex flex-col justify-center gap-3">
            <div><p className="font-heading text-xl text-green-950">Ficou pronto 💛</p><p className="mt-1 text-sm text-green-900">{sucesso}</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link href={retomarHref ?? `/historias/criar?membro=${membroId}`} className="inline-flex h-10 items-center justify-center rounded-md bg-brand-purple px-4 text-sm font-semibold text-white">{retomarHref ? "Continuar a história" : "Criar uma história"}</Link>
              <button type="button" onClick={() => { setImagemUrl(null); setSucesso(null); setDetalhesAbertos(true); }} className="h-10 rounded-md border bg-white px-4 text-sm font-semibold">Ajustar e criar outro</button>
            </div>
          </div>
        </div>
      )}

      {!pending && <div className="flex flex-col gap-2">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-purple">1. Escolha o estilo</p><Label className="mt-1 text-base">Qual combina mais com {nome}?</Label></div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {estilosOrdenados.map((es) => {
            const ativo = form.estilo === es.value;
            return (
              <button
                key={es.value}
                type="button"
                onClick={() => update("estilo", es.value)}
                aria-pressed={ativo}
                className={cn(
                  "relative overflow-hidden rounded-2xl border-2 p-3 text-left transition-all",
                  ativo
                    ? "border-brand-purple bg-gradient-to-br from-kolo-lilas-bg-2 to-white shadow-sm"
                    : "border-input bg-gradient-to-br from-secondary/80 to-white hover:-translate-y-0.5 hover:border-brand-purple/40",
                )}
              >
                <span aria-hidden className="mb-3 block aspect-[4/3] w-full rounded-xl bg-cover" style={{ backgroundImage: "url('/avatar-styles/style-sheet-3d.png')", backgroundSize: "400% 200%", backgroundPosition: es.previewPosition }} />
                <span className="text-sm font-semibold text-foreground">{es.label}</span>
                <span className="text-xs leading-snug text-muted-foreground">{es.descricao}</span>
              </button>
            );
          })}
        </div>
      </div>}

      {!pending && <div className="rounded-2xl border bg-secondary/20">
        <button type="button" onClick={() => setDetalhesAbertos((v) => !v)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
          <span><span className="block text-xs font-bold uppercase tracking-[0.16em] text-brand-purple">2. Confira os detalhes</span><span className="mt-1 block text-sm text-muted-foreground">Já preenchemos o que conhecemos. Edite apenas se precisar.</span></span>
          <ChevronDown className={cn("size-5 transition-transform", detalhesAbertos && "rotate-180")} aria-hidden />
        </button>
      {detalhesAbertos && <div className="grid gap-4 border-t p-4 md:grid-cols-2">
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
      </div>}

      {detalhesAbertos && <div className="flex flex-col gap-1.5 px-4">
        <Label htmlFor="tracos">Traços marcantes (opcional)</Label>
        <Input
          id="tracos"
          value={form.tracosMarcantes ?? ""}
          onChange={(e) => update("tracosMarcantes", e.target.value || null)}
          placeholder="Ex: sardas no nariz, dente da frente um pouco grande"
        />
      </div>}

      {detalhesAbertos && <div className="flex flex-col gap-1.5 px-4 pb-4">
        <Label htmlFor="roupas">Roupas frequentes (opcional)</Label>
        <Input
          id="roupas"
          value={form.roupasFrequentes ?? ""}
          onChange={(e) => update("roupasFrequentes", e.target.value || null)}
          placeholder="Ex: camiseta de dinossauro e calça de moletom"
        />
      </div>}
      </div>}

      {!pending && <div className="rounded-2xl bg-kolo-creme p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-purple">3. Gere e confira</p>
        <p className="mt-1 text-sm text-muted-foreground">O avatar anterior continua salvo. Você poderá voltar a ele quando quiser.</p>
        <Button className="mt-4 h-12 w-full text-base" type="button" onClick={handleCriar} disabled={pending}>
          <Sparkles className="size-4" aria-hidden /> {temAvatar ? "Criar uma nova versão" : "Gerar avatar"}
        </Button>
      </div>}
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
