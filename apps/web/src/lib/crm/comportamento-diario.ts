import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Comportamento DIA A DIA do teste, por lead (pra tela de abordagem). Pra cada
 * dia desde o cadastro: usou a web? falou com a Ayla (WhatsApp)? a Ayla escreveu?
 * recebeu plano? — assim dá pra entender a fundo como o lead se comportou no
 * teste, e por qual canal (web, WhatsApp, ou os dois).
 */

const MS_DIA = 24 * 60 * 60 * 1000;

export type DiaComportamento = {
  dia: number; // 1..7
  data: string; // ISO (início do dia do teste)
  web: number; // eventos web (telas/uso) nesse dia
  pessoaFalou: number; // mensagens da PESSOA pra Ayla (inbound)
  aylaFalou: number; // mensagens da Ayla (outbound)
  planos: number; // planos recebidos nesse dia
  canal: "web" | "whatsapp" | "ambos" | "nenhum";
};

export async function carregarComportamentoDiario(
  admin: SupabaseClient,
  familyId: string,
): Promise<DiaComportamento[]> {
  const { data: fam } = await admin
    .from("family_accounts")
    .select("created_at")
    .eq("id", familyId)
    .maybeSingle();
  if (!fam?.created_at) return [];

  const inicioMs = new Date(fam.created_at as string).getTime();
  const diasDecorridos = Math.min(7, Math.max(1, Math.floor((Date.now() - inicioMs) / MS_DIA) + 1));

  const [{ data: events }, { data: msgs }, { data: planos }] = await Promise.all([
    admin.from("user_events").select("created_at").eq("family_account_id", familyId),
    admin.from("ayla_messages").select("created_at, direcao").eq("family_account_id", familyId),
    admin.from("planos").select("created_at").eq("family_account_id", familyId),
  ]);

  const noDia = (iso: string | null | undefined, de: number, ate: number): boolean => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return t >= de && t < ate;
  };

  const dias: DiaComportamento[] = [];
  for (let d = 1; d <= diasDecorridos; d++) {
    const de = inicioMs + (d - 1) * MS_DIA;
    const ate = inicioMs + d * MS_DIA;
    const web = (events ?? []).filter((e) => noDia(e.created_at as string, de, ate)).length;
    const pessoaFalou = (msgs ?? []).filter(
      (m) => m.direcao === "inbound" && noDia(m.created_at as string, de, ate),
    ).length;
    const aylaFalou = (msgs ?? []).filter(
      (m) => m.direcao === "outbound" && noDia(m.created_at as string, de, ate),
    ).length;
    const planosN = (planos ?? []).filter((p) => noDia(p.created_at as string, de, ate)).length;

    const usouWeb = web > 0;
    const usouWhats = pessoaFalou > 0;
    const canal: DiaComportamento["canal"] =
      usouWeb && usouWhats ? "ambos" : usouWeb ? "web" : usouWhats ? "whatsapp" : "nenhum";

    dias.push({ dia: d, data: new Date(de).toISOString(), web, pessoaFalou, aylaFalou, planos: planosN, canal });
  }
  return dias;
}
