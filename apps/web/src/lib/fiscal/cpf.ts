/** CPF é validado antes de seguir para o Stripe. Nunca o registre em logs. */
export function normalizarCpf(valor: string): string {
  return valor.replace(/\D/g, "");
}

export function cpfValido(valor: string): boolean {
  const cpf = normalizarCpf(valor);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const digito = (posicao: number) => {
    const soma = cpf
      .slice(0, posicao - 1)
      .split("")
      .reduce((total, atual, indice) => total + Number(atual) * (posicao - indice), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };

  return Number(cpf[9]) === digito(10) && Number(cpf[10]) === digito(11);
}
