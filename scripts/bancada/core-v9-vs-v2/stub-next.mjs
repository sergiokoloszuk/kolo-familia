/**
 * Stub de `next/headers`, `next/cache` e `server-only` para a bancada.
 * Fora do Next esses módulos não existem. Nenhum caminho desta bancada os usa
 * — o banco é o de memória —, então `cookies()` e `headers()` ESTOURAM de
 * propósito: se um dia forem chamados, a bancada quebra em vez de fingir.
 */
export const cookies = () => { throw new Error("cookies() chamado na bancada — caminho inesperado"); };
export const headers = () => { throw new Error("headers() chamado na bancada — caminho inesperado"); };
export const draftMode = () => { throw new Error("draftMode() na bancada"); };
export const revalidatePath = () => {};
export const revalidateTag = () => {};
export const unstable_cache = (fn) => fn;
