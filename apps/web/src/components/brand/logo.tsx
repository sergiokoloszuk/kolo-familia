import { cn } from "@/lib/utils";

type LogoTone = "light" | "dark";

type LogoProps = {
  /** Font-size do "Kolo" em px. Sub-marca, ponto e respiro derivam disso. Manual: confortável 24–28px em nav header. */
  size?: number;
  /** Fundo claro → "light" (roxo escuro + cinza). Fundo escuro → "dark" (branco + amarelo). */
  tone?: LogoTone;
  /** Sub-marca empilhada embaixo. Default "Família". Passe "Inclusão", "Escola" etc para variantes. */
  submark?: string;
  className?: string;
};

const TONE = {
  light: { kolo: "#4A1577", sub: "#5B4E7A" },
  dark: { kolo: "#FFFFFF", sub: "#FFBA00" },
} as const;

const DOT_YELLOW = "#FFBA00";

/**
 * Logo Kolo Família — anatomia empilhada do Sistema de Logos Kolo v1.0 (Maio 2026).
 *
 * - "Kolo" em Fraunces medium (500), letter-spacing -0.025em + ponto amarelo (#FFBA00).
 * - Sub-marca em Plus Jakarta Sans semibold (600), uppercase, tracking 0.22em.
 * - Proporções fixas: dot = 25% do font-size do "Kolo"; sub-marca ≈ 27% e margin-top = 25%.
 *
 * Quem altera proporções/cores quebra o manual — não fazer sem revisão de marca.
 */
export function Logo({
  size = 28,
  tone = "dark",
  submark = "Família",
  className,
}: LogoProps) {
  const colors = TONE[tone];
  const dotSize = Math.round(size * 0.25);
  const subSize = Math.max(7, Math.round(size * 0.27));
  const subGap = Math.round(size * 0.25);

  return (
    <span
      className={cn("inline-flex flex-col items-start leading-none", className)}
      aria-label={`Kolo ${submark}`}
    >
      <span
        aria-hidden
        style={{
          fontFamily: "var(--font-fraunces), 'Fraunces', Georgia, serif",
          fontWeight: 500,
          fontStyle: "normal",
          letterSpacing: "-0.025em",
          fontSize: `${size}px`,
          color: colors.kolo,
          lineHeight: 1,
        }}
      >
        Kolo
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: `${dotSize}px`,
            height: `${dotSize}px`,
            backgroundColor: DOT_YELLOW,
            borderRadius: "50%",
            marginLeft: `${Math.max(1, Math.round(size * 0.05))}px`,
            verticalAlign: "baseline",
          }}
        />
      </span>
      <span
        aria-hidden
        style={{
          fontFamily: "var(--font-jakarta), 'Plus Jakarta Sans', system-ui, sans-serif",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.22em",
          fontSize: `${subSize}px`,
          color: colors.sub,
          marginTop: `${subGap}px`,
          lineHeight: 1,
        }}
      >
        {submark}
      </span>
    </span>
  );
}
