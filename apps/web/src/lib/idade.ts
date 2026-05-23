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
