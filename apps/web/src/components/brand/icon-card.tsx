import { cn } from "@/lib/utils";

/**
 * IconCard — container quadrado com ícone, sistema dual Kolo (Manual §08).
 *
 * tone="light" (fundo lilás/creme/branco): container amarelo sólido #FFBA00 + ícone roxo escuro.
 * tone="dark" (fundo roxo deep/Kolo): container translúcido branco/12% + ícone amarelo.
 *
 * Tamanho default = 48×48 (rounded-2xl). Para hero/features: size="lg" (56×56).
 * Stroke do ícone deve ser 1.8 (Manual §08).
 *
 * Esperado: passe o ícone como child (ex: <Heart className="size-6 stroke-[1.8]" />).
 */
export function IconCard({
  children,
  tone = "light",
  size = "md",
  className,
}: {
  children: React.ReactNode;
  tone?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    sm: "size-10 rounded-xl [&_svg]:size-5",
    md: "size-12 rounded-2xl [&_svg]:size-6",
    lg: "size-14 rounded-2xl [&_svg]:size-7",
  };

  return (
    <span
      aria-hidden
      className={cn(
        tone === "light" ? "icon-card-kolo" : "icon-card-kolo-dark",
        sizes[size],
        "[&_svg]:stroke-[1.8]",
        className,
      )}
    >
      {children}
    </span>
  );
}
