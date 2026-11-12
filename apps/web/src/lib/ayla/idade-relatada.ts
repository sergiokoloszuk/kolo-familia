/**
 * Uma idade dita pela família não altera uma data de nascimento: "4 anos"
 * não fornece dia e mês. Ela pode, porém, corrigir o contexto da conversa.
 */
export type IdadeRelatada = {
  anos: number;
  nascimento_base: string | null;
  informada_em: string;
};

function semAcento(texto: string): string {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function idadeDitaSobreMembro(texto: string, nome: string | null): number | null {
  const primeiroNome = semAcento(nome ?? "").trim().split(/\s+/)[0];
  if (!primeiroNome || primeiroNome.length < 3) return null;
  const frase = semAcento(texto).replace(/\s+/g, " ");
  const escapado = primeiroNome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(?:^|[^a-z0-9])(?:o |a )?${escapado} (?:tem|esta com) (\\d{1,2}) anos(?:\\b|$)`);
  const idade = Number(frase.match(re)?.[1]);
  return Number.isInteger(idade) && idade >= 0 && idade <= 120 ? idade : null;
}

export function idadeRelatadaValida(
  metadata: Record<string, unknown> | null | undefined,
  nascimentoAtual: string | null,
): IdadeRelatada | null {
  const registro = metadata?.idade_reportada;
  if (!registro || typeof registro !== "object") return null;
  const r = registro as Partial<IdadeRelatada>;
  if (!Number.isInteger(r.anos) || (r.anos ?? -1) < 0 || (r.anos ?? 121) > 120) return null;
  if (r.nascimento_base !== nascimentoAtual || !r.informada_em || Number.isNaN(Date.parse(r.informada_em))) return null;
  return r as IdadeRelatada;
}
