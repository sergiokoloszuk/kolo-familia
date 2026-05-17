import { cn } from "@/lib/utils";

/**
 * Manifesto — bloco de filosofia Kolo (Manual §15).
 *
 * Fundo roxo deep com pontilhado amarelo sutil. Aspas amarelas grandes em volta da frase.
 * A frase termina com ponto amarelo Kolo (assinatura — Manual §14).
 * Eyebrow "A FILOSOFIA KOLO" embaixo.
 *
 * Usar 1 vez por landing. Posição típica: entre features e depoimentos.
 *
 * Exemplo:
 *   <Manifesto>Inclusão não é amor. É método</Manifesto>
 */
export function Manifesto({
  children,
  label = "A filosofia Kolo",
  className,
}: {
  children: React.ReactNode;
  label?: string;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl bg-brand-purple-deep px-8 py-16 text-center md:py-20",
        className,
      )}
    >
      {/* Pontilhado amarelo sutil — Manual §15 */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,186,0,0.18) 1.2px, transparent 1.2px)",
          backgroundSize: "28px 28px",
        }}
      />

      <div className="relative mx-auto max-w-3xl">
        {/* Aspa amarela grande de abertura */}
        <span
          aria-hidden
          className="block font-heading text-6xl leading-none text-brand-yellow md:text-7xl"
          style={{ fontWeight: 500 }}
        >
          “
        </span>

        <p className="mt-2 font-heading text-3xl leading-tight tracking-tight text-white md:text-4xl lg:text-5xl">
          <span style={{ fontWeight: 500 }}>{children}</span>
          <span className="ponto-kolo" aria-hidden />
        </p>

        {/* Eyebrow embaixo (Manual §14) — texto amarelo em fundo escuro */}
        <p className="eyebrow-kolo eyebrow-kolo-dark mt-10 justify-center">
          {label}
        </p>
      </div>
    </section>
  );
}
