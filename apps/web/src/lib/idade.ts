/**
 * Idade em anos completos a partir da data de nascimento.
 *
 * Fonte de verdade no banco passou a ser `data_nascimento` (date). A idade é
 * sempre derivada disto na borda de leitura — nunca armazenada (senão fica
 * defasada com o tempo).
 *
 * Aceita string "YYYY-MM-DD" (date do Postgres) ou Date. Null/inválido → null.
 */
export function idadeAnos(
  dataNascimento: string | Date | null | undefined,
): number | null {
  if (!dataNascimento) return null;
  const dob =
    typeof dataNascimento === "string"
      ? new Date(`${dataNascimento.slice(0, 10)}T00:00:00`)
      : dataNascimento;
  if (Number.isNaN(dob.getTime())) return null;
  const hoje = new Date();
  let anos = hoje.getFullYear() - dob.getFullYear();
  const m = hoje.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < dob.getDate())) anos -= 1;
  return anos >= 0 ? anos : null;
}

/**
 * Máscara de data BR enquanto digita: "dd/mm/aaaa".
 * Aceita só dígitos e insere as barras. Usada em <input type="text">
 * (digitável no celular, diferente do type="date" nativo).
 */
export function mascararDataBr(v: string): string {
  const d = (v ?? "").replace(/\D/g, "").slice(0, 8);
  if (d.length <= 2) return d;
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`;
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`;
}

/** "dd/mm/aaaa" → "YYYY-MM-DD" (valida data real). Incompleto/invlálido → null. */
export function dataBrParaIso(br: string): string | null {
  const m = (br ?? "").trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  const iso = `${yyyy}-${mm}-${dd}`;
  const dt = new Date(`${iso}T00:00:00`);
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getMonth() + 1 !== Number(mm) ||
    dt.getDate() !== Number(dd)
  ) {
    return null;
  }
  return iso;
}

/** "YYYY-MM-DD" → "dd/mm/aaaa". Vazio/invlálido → "". */
export function dataIsoParaBr(iso: string | null | undefined): string {
  const m = (iso ?? "").slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}
