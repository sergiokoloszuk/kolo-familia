"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Send, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { enviarAbordagem } from "./actions";

type Msg = { role: "user" | "assistant"; content: string };

const OPENER =
  "Me sugira a melhor abordagem pra esse lead agora: a leitura do momento, a estratégia e a mensagem pronta pra enviar.";

/** Extrai a mensagem/roteiro final que a IA delimita com ---MENSAGEM--- / ---LIGACAO---. */
function extrair(texto: string): { tipo: "mensagem" | "ligacao" | null; conteudo: string } {
  const m = texto.indexOf("---MENSAGEM---");
  if (m !== -1) return { tipo: "mensagem", conteudo: texto.slice(m + 14).trim() };
  const l = texto.indexOf("---LIGACAO---");
  if (l !== -1) return { tipo: "ligacao", conteudo: texto.slice(l + 13).trim() };
  return { tipo: null, conteudo: "" };
}

export function Copiloto({ familyId, temWhatsapp }: { familyId: string; temWhatsapp: boolean }) {
  const router = useRouter();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [pensando, setPensando] = useState(false);
  const [input, setInput] = useState("");
  const [mensagemFinal, setMensagemFinal] = useState("");
  const [ehLigacao, setEhLigacao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [enviado, setEnviado] = useState(false);
  const [enviando, startEnvio] = useTransition();
  const abriu = useRef(false);

  async function pedirIA(historico: Msg[]) {
    setPensando(true);
    setErro(null);
    try {
      const r = await fetch("/api/crm/copiloto", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ familyId, mensagens: historico }),
      });
      const j = await r.json();
      if (!j.ok) {
        setErro(j.error ?? "Falha ao consultar a IA.");
        return;
      }
      const resposta = j.resposta as string;
      setMsgs([...historico, { role: "assistant", content: resposta }]);
      const ext = extrair(resposta);
      if (ext.tipo === "mensagem") {
        setMensagemFinal(ext.conteudo);
        setEhLigacao(false);
      } else if (ext.tipo === "ligacao") {
        setEhLigacao(true);
      }
    } catch {
      setErro("Erro de rede ao consultar a IA.");
    } finally {
      setPensando(false);
    }
  }

  // Primeira sugestão automática ao abrir.
  useEffect(() => {
    if (abriu.current) return;
    abriu.current = true;
    const inicial: Msg[] = [{ role: "user", content: OPENER }];
    setMsgs(inicial);
    void pedirIA(inicial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function enviarChat() {
    const t = input.trim();
    if (!t || pensando) return;
    const novo: Msg[] = [...msgs, { role: "user", content: t }];
    setMsgs(novo);
    setInput("");
    void pedirIA(novo);
  }

  function enviarWhatsapp() {
    setErro(null);
    startEnvio(async () => {
      const res = await enviarAbordagem({ familyId, texto: mensagemFinal.trim() });
      if (!res.ok) {
        setErro(res.error);
        return;
      }
      setEnviado(true);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Chat com o copiloto */}
      <div className="flex flex-col rounded-2xl border border-foreground/[0.08] bg-white">
        <div className="flex items-center gap-2 border-b border-foreground/[0.06] px-4 py-3">
          <Sparkles className="size-4 text-brand-purple" aria-hidden />
          <h2 className="font-heading text-base text-foreground">Copiloto</h2>
        </div>
        <div className="flex max-h-[28rem] flex-col gap-3 overflow-y-auto p-4">
          {msgs
            .filter((m) => !(m.role === "user" && m.content === OPENER))
            .map((m, i) => (
              <div
                key={i}
                className={`whitespace-pre-wrap rounded-xl px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "self-end bg-brand-purple text-white"
                    : "self-start bg-foreground/[0.04] text-foreground"
                }`}
              >
                {m.content}
              </div>
            ))}
          {pensando && (
            <div className="self-start text-sm text-muted-foreground">
              <RefreshCw className="mr-1 inline size-3 animate-spin" aria-hidden /> pensando…
            </div>
          )}
        </div>
        <div className="flex gap-2 border-t border-foreground/[0.06] p-3">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                enviarChat();
              }
            }}
            placeholder="Peça ajustes: 'mais curta', 'foca no sono'…"
            disabled={pensando}
            className="flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none disabled:opacity-50"
          />
          <Button type="button" onClick={enviarChat} disabled={pensando || !input.trim()}>
            Enviar
          </Button>
        </div>
      </div>

      {/* Mensagem a enviar */}
      <div className="flex flex-col rounded-2xl border border-foreground/[0.08] bg-white p-4">
        <h2 className="mb-1 font-heading text-base text-foreground">
          {ehLigacao ? "Roteiro de ligação" : "Mensagem a enviar"}
        </h2>
        <p className="mb-3 text-xs text-muted-foreground">
          {ehLigacao
            ? "A IA sugeriu LIGAR pra esse lead. O roteiro está no chat. (Envio por WhatsApp só pra mensagem.)"
            : "Revise e edite à vontade. Nada é enviado sem o seu OK. Sai pelo WhatsApp da Kolo, no seu nome."}
        </p>

        <textarea
          value={mensagemFinal}
          onChange={(e) => {
            setMensagemFinal(e.target.value);
            setEnviado(false);
          }}
          rows={10}
          placeholder="A sugestão da IA aparece aqui. Você pode editar."
          disabled={ehLigacao}
          className="flex-1 resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none disabled:opacity-50"
        />

        {erro && (
          <p className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {erro}
          </p>
        )}

        <div className="mt-3 flex items-center gap-3">
          <Button
            type="button"
            onClick={enviarWhatsapp}
            disabled={enviando || ehLigacao || !mensagemFinal.trim() || !temWhatsapp}
          >
            {enviando ? (
              <>
                <RefreshCw className="size-4 animate-spin" aria-hidden /> Enviando…
              </>
            ) : (
              <>
                <Send className="size-4" aria-hidden /> Enviar pelo WhatsApp
              </>
            )}
          </Button>
          {enviado && <span className="text-sm text-emerald-600">✓ Enviada e registrada.</span>}
          {!temWhatsapp && (
            <span className="text-xs text-muted-foreground">Lead sem WhatsApp cadastrado.</span>
          )}
        </div>
      </div>
    </div>
  );
}
