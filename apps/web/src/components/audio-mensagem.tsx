"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, Square, Loader2 } from "lucide-react";

const escutarSuporte = () => () => {};
const suporteAudio = () => typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
const suporteServidor = () => false;

/** Transcreve para o campo editável; só o botão Enviar publica a mensagem. */
export function AudioMensagem({ onTexto, onOcupado, disabled = false }: {
  onTexto: (texto: string) => void;
  onOcupado: (ocupado: boolean) => void;
  disabled?: boolean;
}) {
  const disponivel = useSyncExternalStore(escutarSuporte, suporteAudio, suporteServidor);
  const [estado, setEstado] = useState<"pronto" | "gravando" | "transcrevendo">("pronto");
  const [erro, setErro] = useState("");
  const gravador = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const montado = useRef(true);
  const iniciando = useRef(false);
  const transcricao = useRef<AbortController | null>(null);

  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
      if (timer.current) clearTimeout(timer.current);
      if (gravador.current) {
        gravador.current.onstop = null;
        if (gravador.current.state !== "inactive") gravador.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      transcricao.current?.abort();
    };
  }, []);

  function parar() {
    if (timer.current) clearTimeout(timer.current);
    if (gravador.current?.state === "recording") gravador.current.stop();
    stream.current?.getTracks().forEach((t) => t.stop());
  }

  async function iniciar() {
    if (disabled || estado !== "pronto" || iniciando.current) return;
    iniciando.current = true;
    setErro("");
    onOcupado(true);
    try {
      const entrada = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!montado.current) { entrada.getTracks().forEach((t) => t.stop()); return; }
      stream.current = entrada;
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/ogg;codecs=opus"].find((m) => MediaRecorder.isTypeSupported(m));
      const recorder = new MediaRecorder(entrada, mime ? { mimeType: mime } : undefined);
      gravador.current = recorder;
      const partes: Blob[] = [];
      recorder.ondataavailable = (e) => { if (e.data.size) partes.push(e.data); };
      recorder.onstop = async () => {
        if (!montado.current) return;
        setEstado("transcrevendo");
        try {
          const form = new FormData();
          form.append("audio", new Blob(partes, { type: recorder.mimeType }), "mensagem");
          const abortar = new AbortController();
          transcricao.current = abortar;
          const res = await fetch("/api/conversar/transcrever", { method: "POST", body: form, signal: abortar.signal });
          const resultado = await res.json();
          if (!res.ok || !resultado.texto) throw new Error(resultado.erro || "Não consegui transcrever o áudio.");
          if (montado.current) onTexto(resultado.texto);
        } catch (e) {
          if (montado.current) setErro(e instanceof Error ? e.message : "Tente gravar novamente.");
        } finally {
          if (montado.current) { setEstado("pronto"); onOcupado(false); }
        }
      };
      recorder.start();
      setEstado("gravando");
      timer.current = setTimeout(parar, 120_000);
    } catch {
      stream.current?.getTracks().forEach((t) => t.stop());
      setErro("Não consegui acessar o microfone. Confira a permissão ou escreva sua mensagem.");
      onOcupado(false);
    } finally { iniciando.current = false; }
  }

  if (!disponivel) return null;
  return <div className="flex flex-col gap-2">
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" onClick={estado === "gravando" ? parar : iniciar}
        disabled={disabled || estado === "transcrevendo"}
        className="inline-flex items-center gap-2 rounded-full border border-brand-purple/25 px-4 py-2 text-sm font-medium text-brand-purple disabled:opacity-50">
        {estado === "transcrevendo" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : estado === "gravando" ? <Square className="size-4" aria-hidden /> : <Mic className="size-4" aria-hidden />}
        {estado === "gravando" ? "Concluir gravação" : estado === "transcrevendo" ? "Transcrevendo..." : "Responder por áudio"}
      </button>
      <span className="text-xs text-muted-foreground" aria-live="polite">
        {estado === "gravando" ? "Gravando · até 2 minutos" : "O texto aparece no campo para você conferir antes de enviar."}
      </span>
    </div>
    {erro && <p role="alert" className="text-sm text-destructive">{erro}</p>}
  </div>;
}
