import { cn } from "@/lib/utils";

/**
 * Eyebrow — linha amarela + caps tracking, acima de cada H2 de seção (Manual §14).
 *
 * Em fundos claros: texto roxo Kolo.
 * Em fundos escuros (roxo deep, gradient roxo): tone="dark" → texto amarelo.
 *
 * Usar UMA vez por seção, NUNCA duas em sequência (regra de ouro §14).
 */
export function Eyebrow({
  children,
  tone = "light",
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  tone?: "light" | "dark";
  className?: string;
  as?: "div" | "p" | "span";
}) {
  return (
    <Tag
      className={cn(
        "eyebrow-kolo",
        tone === "dark" && "eyebrow-kolo-dark",
        className,
      )}
    >
      {children}
    </Tag>
  );
}
