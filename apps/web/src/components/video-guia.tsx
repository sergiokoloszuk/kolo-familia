"use client";

import { useState } from "react";
import { Play, X } from "lucide-react";
import { track } from "@/lib/analytics/track-client";
import { videoDaArea, type AreaAjuda } from "@/lib/video-ajuda";

/**
 * O GUIA DA KOLO EM VÍDEO.
 *
 * Muita família entra e não descobre o que dá pra pedir — a auditoria do trial
 * (04/08/2026) mostrou 21 de 42 chegando ao fim do teste sem nunca ter escrito
 * pra Ayla. O vídeo é a explicação principal; o texto ao redor é só moldura.
 *
 * Embed oficial do Tella (a página do vídeo declara em og:video). Nada é
 * baixado nem copiado pro projeto.
 */
const EMBED = "https://www.tella.tv/video/vid_cmsens8k600sl04l150o8gy18/embed";

/** O player em si. Proporção fixa pra não pular no mobile. */
export function PlayerGuia({ titulo, src }: { titulo: string; src?: string }) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-kolo-linha bg-black/[0.04]">
      <div className="relative w-full" style={{ aspectRatio: "16 / 9" }}>
        <iframe
          src={src ?? EMBED}
          title={titulo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          loading="lazy"
          className="absolute inset-0 size-full"
        />
      </div>
    </div>
  );
}

/**
 * O CARD DA HOME. Hierarquia secundária de propósito: quem já entendeu a Kolo
 * passa reto, quem não entendeu acha o guia. Não pode competir com o Registro
 * do dia nem com o banner do trial.
 *
 * Abre em modal — a pessoa assiste sem sair da plataforma.
 */
export function CardVideoGuia() {
  const [aberto, setAberto] = useState(false);

  function abrir() {
    track("home_video_aberto");
    setAberto(true);
  }

  return (
    <>
      <section className="flex flex-col gap-3 rounded-2xl border border-kolo-linha bg-white px-5 py-4 md:flex-row md:items-center md:justify-between md:gap-6">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-brand-purple/10 text-brand-purple">
            <Play className="size-4" aria-hidden />
          </span>
          <div>
            <p className="font-heading text-base font-medium text-foreground">
              Conheça tudo o que você pode fazer na Kolo
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Em poucos minutos: como conversar com a Ayla, criar planos, rotinas e histórias,
              registrar o dia e acompanhar a evolução.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={abrir}
          className="shrink-0 self-start rounded-full border border-brand-purple/30 px-4 py-2 text-sm font-semibold text-brand-purple transition-colors hover:bg-brand-purple/5 md:self-auto"
        >
          Assistir ao vídeo
        </button>
      </section>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Guia da Kolo em vídeo"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setAberto(false)}
        >
          <div
            className="flex w-full max-w-3xl flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="flex items-center gap-1.5 self-end rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-foreground"
            >
              <X className="size-4" aria-hidden /> Fechar
            </button>
            <PlayerGuia titulo="Como usar a Kolo Família — guia completo" />
          </div>
        </div>
      )}
    </>
  );
}

/**
 * A AJUDA CONTEXTUAL DE UMA ÁREA.
 *
 * Mesma base do card da Home — um player só no produto, um modal só. O que
 * muda é o tamanho: aqui é um link discreto perto do título, porque o vídeo é
 * AJUDA e não o conteúdo da página.
 *
 * ⚠️ Sem URL configurada, retorna null: nada é renderizado, nem espaço, nem
 * "em breve". A página fica exatamente como está hoje.
 */
export function VideoAjuda({ area }: { area: AreaAjuda }) {
  const [aberto, setAberto] = useState(false);
  const video = videoDaArea(area);
  if (!video) return null;

  function abrir() {
    track("video_ajuda_aberto", { pagina: area });
    setAberto(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="flex w-fit items-center gap-1.5 text-sm font-medium text-brand-purple underline-offset-4 hover:underline"
      >
        <Play className="size-3.5" aria-hidden /> {video.chamada}
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={video.chamada}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => setAberto(false)}
        >
          <div
            className="flex w-full max-w-3xl flex-col gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="flex items-center gap-1.5 self-end rounded-full bg-white/90 px-3 py-1.5 text-sm font-semibold text-foreground"
            >
              <X className="size-4" aria-hidden /> Fechar
            </button>
            <PlayerGuia titulo={video.chamada} src={video.url!} />
          </div>
        </div>
      )}
    </>
  );
}
