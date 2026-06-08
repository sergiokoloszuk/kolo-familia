import { idadeAnos } from "@/lib/idade";

// composicao guarda { irmaos: [{nome, data_nascimento, brinca_junto}], texto? }.
// Resume em texto legível, com a idade calculada na hora (atualiza com o tempo).
// Fonte única — usada na Ayla (contexto) e na tela do Kolo Vivo.

const BRINCA: Record<string, string> = {
  sim: "brincam juntos",
  asvezes: "brincam às vezes",
  nao: "não brincam juntos",
};

export function resumirComposicao(valor: unknown): string {
  if (!valor || typeof valor !== "object") return "";
  const obj = valor as { texto?: unknown; irmaos?: unknown };
  const partes: string[] = [];
  if (typeof obj.texto === "string" && obj.texto.trim()) partes.push(obj.texto.trim());
  if (Array.isArray(obj.irmaos) && obj.irmaos.length > 0) {
    const lista = (obj.irmaos as Array<Record<string, unknown>>)
      .map((i) => {
        const nome = typeof i.nome === "string" ? i.nome : "";
        if (!nome) return "";
        const idade = idadeAnos(
          typeof i.data_nascimento === "string" ? i.data_nascimento : null,
        );
        const brinca = BRINCA[i.brinca_junto as string] ?? "";
        const det = [idade != null ? `${idade} anos` : "", brinca]
          .filter(Boolean)
          .join(", ");
        return det ? `${nome} (${det})` : nome;
      })
      .filter(Boolean);
    if (lista.length > 0) partes.push(`Irmãos na casa: ${lista.join("; ")}`);
  }
  return partes.join(" · ");
}
