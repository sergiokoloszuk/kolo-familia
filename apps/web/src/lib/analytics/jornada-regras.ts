export type CanalAtribuicao =
  | "trafego_pago"
  | "organico_social"
  | "afiliado"
  | "convite"
  | "parceria"
  | "landing_sem_canal"
  | "sem_origem"
  | "desconhecido";

export type AtribuicaoEntrada = {
  afiliado_id: string | null;
  ref_codigo: string | null;
  utm_source: string | null;
  utm_medium: string | null;
};

const FONTES_PAGAS = new Set([
  "facebookads",
  "googleads",
  "google_ads",
  "adwords",
  "tiktokads",
  "tiktok_ads",
]);

const MIDIAS_PAGAS = new Set([
  "cpc",
  "ppc",
  "paid",
  "paid_social",
  "paid-social",
  "paid_search",
  "paid-search",
  "display",
]);

const FONTES_SOCIAIS = new Set(["facebook", "fb", "instagram", "ig", "meta", "tiktok"]);

const normalizar = (valor: string | null) => valor?.trim().toLowerCase() || null;

/**
 * Classifica o canal sem tratar qualquer UTM como tráfego pago.
 *
 * `utm_source=base44` descreve a landing, não a aquisição. Fontes novas ficam
 * explícitas como desconhecidas até serem classificadas, em vez de inflar pago.
 */
export function classificarCanalAtribuicao(f: AtribuicaoEntrada): CanalAtribuicao {
  if (f.afiliado_id) return "afiliado";

  const source = normalizar(f.utm_source);
  const medium = normalizar(f.utm_medium);

  if (source === "base44") return "landing_sem_canal";
  if (source?.startsWith("escalasaas")) return "parceria";
  if (source && (FONTES_PAGAS.has(source) || (medium != null && MIDIAS_PAGAS.has(medium)))) {
    return "trafego_pago";
  }
  if (source && FONTES_SOCIAIS.has(source)) return "organico_social";
  if (f.ref_codigo) return "convite";
  if (source) return "desconhecido";
  return "sem_origem";
}
export type MarcosJornadaEntrada = {
  onboardingCompleted: boolean | null;
  onboardingStep: number | null;
  usos: number;
  temPlano: boolean;
  falouComAyla: boolean;
};

export type MarcosJornada = {
  iniciouOnboarding: boolean;
  concluiuOnboarding: boolean;
  recebeuPrimeiroValor: boolean;
  engajou: boolean;
};

/**
 * Marcos vitalícios e cumulativos do funil. Cada etapa só pode ser verdadeira
 * quando a anterior também é, evitando o antigo 210 → 241.
 */
export function calcularMarcosJornada(entrada: MarcosJornadaEntrada): MarcosJornada {
  const step = Math.min(7, Math.max(1, entrada.onboardingStep ?? 1));
  const concluiuOnboarding = Boolean(entrada.onboardingCompleted) || step >= 7;
  const iniciouOnboarding = step > 1 || concluiuOnboarding;
  const teveValor = entrada.usos >= 1 || entrada.temPlano || entrada.falouComAyla;
  const recebeuPrimeiroValor = concluiuOnboarding && teveValor;
  const engajou =
    recebeuPrimeiroValor &&
    (entrada.usos >= 2 || (entrada.temPlano && entrada.falouComAyla));

  return {
    iniciouOnboarding,
    concluiuOnboarding,
    recebeuPrimeiroValor,
    engajou,
  };
}
