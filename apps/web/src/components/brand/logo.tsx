import Image from "next/image";
import { cn } from "@/lib/utils";

type LogoProps = {
  size?: number;
  className?: string;
  withWordmark?: boolean;
  wordmarkClassName?: string;
};

/**
 * Logo Kolo Família — círculo com o mascote, em PNG.
 * Asset original em /public/logo-kolo.png (342x159, fundo escuro com texto).
 * Renderizamos em forma circular com overflow hidden pra ficar consistente
 * em qualquer fundo (header gradient ou claro).
 */
export function Logo({
  size = 36,
  className,
  withWordmark = false,
  wordmarkClassName,
}: LogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <span
        aria-hidden
        className="relative inline-flex shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-white/40"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo-kolo.png"
          alt=""
          width={size}
          height={size}
          className="h-full w-full object-cover"
          priority
        />
      </span>
      {withWordmark && (
        <span
          className={cn(
            "font-heading text-base font-bold tracking-tight",
            wordmarkClassName,
          )}
        >
          Kolo Família
        </span>
      )}
    </span>
  );
}
