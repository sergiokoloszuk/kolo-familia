/**
 * STT (Speech-to-Text) de áudios do WhatsApp via OpenAI Whisper.
 *
 * Z-API entrega o áudio (PTT/voice note) como `audio.audioUrl` no payload do
 * webhook — URL pública temporária. Aqui baixamos esse arquivo e mandamos pro
 * Whisper (`whisper-1`), que devolve o texto. PT-BR como hint pra qualidade.
 *
 * Custo: ~US$ 0.006 por minuto de áudio. Voice notes típicas de mãe (10-60s)
 * custam frações de centavo. Roda em background dentro do `after()` do
 * webhook, então NÃO afeta latência percebida.
 *
 * Devolve null quando algo falha (download, key faltando, Whisper down) —
 * o caller deve cair num fallback (responder pedindo pra mandar de novo).
 */

const OPENAI_TRANSCRIPTIONS_URL =
  "https://api.openai.com/v1/audio/transcriptions";

export async function transcreverAudio(audioUrl: string): Promise<string | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.warn("[transcribe] OPENAI_API_KEY não configurada");
    return null;
  }

  try {
    // 1. Baixa o áudio (Z-API expõe URL pública temporária)
    const audioRes = await fetch(audioUrl, { signal: AbortSignal.timeout(30000) });
    if (!audioRes.ok) {
      console.warn(`[transcribe] falha ao baixar áudio: HTTP ${audioRes.status}`);
      return null;
    }
    const audioBuffer = await audioRes.arrayBuffer();
    const mime = audioRes.headers.get("content-type") ?? "audio/ogg";
    const ext = mime.includes("mpeg") || mime.includes("mp3") ? "mp3" : "ogg";

    // 2. Whisper API (multipart/form-data)
    const form = new FormData();
    form.append("file", new Blob([audioBuffer], { type: mime }), `audio.${ext}`);
    form.append("model", "whisper-1");
    // Hint de idioma melhora qualidade em áudios curtos.
    form.append("language", "pt");

    const transRes = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(60000),
    });

    if (!transRes.ok) {
      const errText = await transRes.text().catch(() => "");
      console.warn(
        `[transcribe] Whisper falhou ${transRes.status}:`,
        errText.slice(0, 200),
      );
      return null;
    }

    const json = (await transRes.json()) as { text?: string };
    const texto = (json.text ?? "").trim();
    return texto || null;
  } catch (e) {
    console.warn(
      "[transcribe] erro:",
      e instanceof Error ? e.message : String(e),
    );
    return null;
  }
}
