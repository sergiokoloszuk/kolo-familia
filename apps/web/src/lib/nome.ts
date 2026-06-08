// Capitaliza nomes próprios pt-BR: "maria de souza" -> "Maria de Souza".
// Mantém conectores minúsculos (de, da, do...) e trata hífen (ana-clara -> Ana-Clara).

const MINUSCULAS = new Set(["de", "da", "do", "das", "dos", "e", "di", "du", "del"]);

function capPalavra(w: string): string {
  if (!w) return w;
  return w
    .split("-")
    .map((p) => (p ? p.charAt(0).toLocaleUpperCase("pt-BR") + p.slice(1) : p))
    .join("-");
}

export function capitalizarNome(nome: string | null | undefined): string {
  if (!nome) return "";
  return nome
    .trim()
    .toLocaleLowerCase("pt-BR")
    .split(/\s+/)
    .map((w, i) => (i > 0 && MINUSCULAS.has(w) ? w : capPalavra(w)))
    .join(" ");
}
