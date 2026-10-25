import type { NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { resolveFamily } from "@/lib/auth/current-family";
import { requireActiveWrite } from "@/lib/auth/require-active-write";
import { qualidadeRespostaV2Ativa } from "@/lib/ayla/qualidade-resposta";
import { transcreverArquivo } from "@/lib/ayla/transcribe";

export const maxDuration = 90;
const MAX_BYTES = 12 * 1024 * 1024;
const TIPOS: Record<string, string> = { "audio/webm": "webm", "audio/ogg": "ogg", "audio/mp4": "mp4", "audio/mpeg": "mp3", "audio/wav": "wav" };

export async function POST(req: NextRequest) {
  if (!qualidadeRespostaV2Ativa()) return Response.json({ erro: "Áudio indisponível." }, { status: 404 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ erro: "Entre novamente para enviar áudio." }, { status: 401 });
  const { data: family } = await resolveFamily(supabase);
  if (!family) return Response.json({ erro: "Família não encontrada." }, { status: 403 });
  try { await requireActiveWrite(family.id); }
  catch { return Response.json({ erro: "Confira seu acesso para continuar." }, { status: 402 }); }
  if (!process.env.OPENAI_API_KEY) return Response.json({ erro: "A transcrição está indisponível. Você pode escrever sua mensagem." }, { status: 503 });
  if (Number(req.headers.get("content-length")) > MAX_BYTES + 65536) return Response.json({ erro: "Envie um áudio menor." }, { status: 413 });
  let form: FormData;
  try { form = await req.formData(); }
  catch { return Response.json({ erro: "Não consegui ler o áudio." }, { status: 400 }); }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || !audio.size || audio.size > MAX_BYTES) return Response.json({ erro: "Envie um áudio de até 12 MB." }, { status: 400 });
  const extensao = TIPOS[audio.type.split(";")[0]];
  if (!extensao) return Response.json({ erro: "Formato de áudio não reconhecido." }, { status: 415 });
  const texto = await transcreverArquivo(audio, `audio.${extensao}`, {
    supabase: createServiceRoleClient(), family_account_id: family.id, feature: "conversa_web_audio",
  });
  return texto ? Response.json({ texto })
    : Response.json({ erro: "Não consegui transcrever. Tente novamente ou escreva a mensagem." }, { status: 502 });
}
