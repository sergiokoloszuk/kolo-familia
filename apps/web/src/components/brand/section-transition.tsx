import { cn } from "@/lib/utils";

/**
 * SectionTransition — curva SVG suave conectando duas seções (Manual §11 e §14).
 *
 * Use entre seções de cores diferentes pra evitar corte em linha reta.
 * `fill` deve ser a cor da seção SEGUINTE (a curva "puxa" a próxima cor por cima).
 *
 * Exemplo:
 *   <section className="bg-kolo-lilas">...</section>
 *   <SectionTransition fill="white" />
 *   <section className="bg-white">...</section>
 *
 * Direção:
 *   - "concave" (default): curva pra cima, como um sorriso invertido
 *   - "convex": curva pra baixo, como um sorriso
 */
export function SectionTransition({
  fill = "white",
  direction = "concave",
  className,
}: {
  fill?: string;
  direction?: "concave" | "convex";
  className?: string;
}) {
  const path =
    direction === "concave"
      ? "M0,0 C480,60 960,60 1440,0 L1440,60 L0,60 Z"
      : "M0,60 C480,0 960,0 1440,60 L1440,60 L0,60 Z";

  return (
    <div className={cn("relative -mb-px block h-[60px] w-full", className)} aria-hidden>
      <svg
        viewBox="0 0 1440 60"
        preserveAspectRatio="none"
        className="block h-full w-full"
      >
        <path d={path} fill={fill} />
      </svg>
    </div>
  );
}
