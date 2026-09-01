/**
 * Stub de `server-only` para o Vitest.
 *
 * O pacote `server-only` existe para QUEBRAR O BUILD quando um módulo de
 * servidor é importado por um componente de cliente — é uma proteção de
 * bundling, e ela continua valendo em `next build`, que é onde ela importa.
 *
 * No Vitest não há bundler de cliente, e o pacote não resolve: qualquer módulo
 * com `import "server-only"` ficava intestável. O efeito prático disso era
 * pior do que a proteção: `lib/email/verificacao-email.ts` guarda a troca de
 * e-mail da família, e não dá para deixar um mecanismo desses sem teste de
 * comportamento só por causa de um import que não faz nada em tempo de teste.
 */
export {};
