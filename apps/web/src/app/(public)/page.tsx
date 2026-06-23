import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Raiz do app (Vercel). A landing de marketing vive no Base44
 * (www.kolofamilia.com.br) — a raiz do app NÃO mostra landing. Manda direto pro
 * lugar certo: logado → painel; senão → login. A landing antiga do Next foi
 * aposentada (não deve mais aparecer pra ninguém).
 */
export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  redirect(user ? "/painel" : "/login");
}
