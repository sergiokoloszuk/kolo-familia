/**
 * UMA RETENTATIVA CURTA — e só uma.
 *
 * ⚠️ MUDOU DE ENDEREÇO EM 24/08/2026, e não mudou de comportamento. Esta função
 * era privada dentro de `lib/ayla/responder.ts` — o caminho Legacy. O caminho
 * OFICIAL, que atende todas as famílias no WhatsApp desde 17/08, **não tinha
 * retentativa nenhuma**: capturava a exceção e devolvia `null`, e quem segurava
 * a queda era o próprio Legacy.
 *
 * Enquanto o Legacy existir, isso funciona. Quando ele sair, uma falha
 * transitória do provider — sobrecarga, rate-limit, um 500 que passa em
 * segundos — vira uma mãe sem resposta. Por isso a retentativa precisa viver
 * onde os dois alcançam.
 *
 * ⚠️ O LIMITE É ESTRITO, E ISSO É A FUNÇÃO INTEIRA. Uma tentativa, uma
 * repetição, fim. Sem laço, sem contador, sem recursão: não há como esta função
 * multiplicar chamadas além de 2, e não há como ela entrar em loop. Um retry
 * com política configurável seria mais elegante e mais fácil de errar.
 *
 * A pausa de 1.200 ms existe porque o modo de falha que ela cobre é
 * justamente o transitório — repetir na mesma hora tende a bater no mesmo
 * limite.
 */
export async function comRetentativaCurta<T>(fn: () => T | Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (e) {
    console.warn(
      "[conducao] 1ª tentativa falhou, tentando de novo:",
      e instanceof Error ? e.message : e,
    );
    await new Promise((r) => setTimeout(r, 1200));
    return fn();
  }
}
