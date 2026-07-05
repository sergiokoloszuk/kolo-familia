/**
 * Localização APROXIMADA a partir do WhatsApp (e164). Brasil → estado pelo DDD;
 * exterior → nome do país pelo código. É a região do NÚMERO, não o endereço —
 * serve pra ter uma noção de "de onde vem o público", não é exato.
 */

export type Local =
  | { br: true; label: string } // UF, ex.: "SP"
  | { br: false; label: string }; // país, ex.: "Equador"

const DDD_UF: Record<string, string> = {
  "11": "SP", "12": "SP", "13": "SP", "14": "SP", "15": "SP", "16": "SP", "17": "SP", "18": "SP", "19": "SP",
  "21": "RJ", "22": "RJ", "24": "RJ",
  "27": "ES", "28": "ES",
  "31": "MG", "32": "MG", "33": "MG", "34": "MG", "35": "MG", "37": "MG", "38": "MG",
  "41": "PR", "42": "PR", "43": "PR", "44": "PR", "45": "PR", "46": "PR",
  "47": "SC", "48": "SC", "49": "SC",
  "51": "RS", "53": "RS", "54": "RS", "55": "RS",
  "61": "DF",
  "62": "GO", "64": "GO",
  "63": "TO",
  "65": "MT", "66": "MT",
  "67": "MS",
  "68": "AC",
  "69": "RO",
  "71": "BA", "73": "BA", "74": "BA", "75": "BA", "77": "BA",
  "79": "SE",
  "81": "PE", "87": "PE",
  "82": "AL",
  "83": "PB",
  "84": "RN",
  "85": "CE", "88": "CE",
  "86": "PI", "89": "PI",
  "91": "PA", "93": "PA", "94": "PA",
  "92": "AM", "97": "AM",
  "95": "RR",
  "96": "AP",
  "98": "MA", "99": "MA",
};

// Códigos de país (sem o Brasil, tratado à parte). Ordenados do mais longo pro
// mais curto pra casar prefixo corretamente ("593" antes de "59"/"5").
const PAISES: Array<[string, string]> = [
  ["593", "Equador"],
  ["351", "Portugal"],
  ["598", "Uruguai"],
  ["595", "Paraguai"],
  ["591", "Bolívia"],
  ["502", "Guatemala"],
  ["503", "El Salvador"],
  ["504", "Honduras"],
  ["505", "Nicarágua"],
  ["506", "Costa Rica"],
  ["507", "Panamá"],
  ["34", "Espanha"],
  ["54", "Argentina"],
  ["56", "Chile"],
  ["57", "Colômbia"],
  ["58", "Venezuela"],
  ["51", "Peru"],
  ["52", "México"],
  ["53", "Cuba"],
  ["44", "Reino Unido"],
  ["49", "Alemanha"],
  ["39", "Itália"],
  ["33", "França"],
  ["1", "EUA/Canadá"],
];

export function localizacaoWhatsapp(e164: string | null | undefined): Local | null {
  if (!e164) return null;
  const d = e164.replace(/\D/g, "");
  if (!d) return null;

  // Brasil: +55 + (DDD 2 dígitos) + número (8-9 dígitos) → 12 ou 13 dígitos.
  if (d.startsWith("55") && d.length >= 12 && d.length <= 13) {
    const uf = DDD_UF[d.slice(2, 4)];
    return { br: true, label: uf ?? "Brasil (DDD ?)" };
  }

  for (const [code, nome] of PAISES) {
    if (d.startsWith(code)) return { br: false, label: nome };
  }
  return { br: false, label: "Outro país" };
}
