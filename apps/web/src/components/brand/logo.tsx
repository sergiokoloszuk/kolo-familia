import { cn } from "@/lib/utils";

type LogoProps = {
  size?: number;
  className?: string;
  withWordmark?: boolean;
  wordmarkClassName?: string;
};

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
        className="inline-flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: "#facc15",
        }}
      >
        <svg
          viewBox="0 0 64 64"
          width={size * 0.7}
          height={size * 0.7}
          aria-hidden
        >
          <g fill="#6b21a8">
            <circle cx="22" cy="26" r="6.5" />
            <circle cx="42" cy="26" r="6.5" />
            <path d="M14 44c0-5 8-9 18-9s18 4 18 9v1c0 1.6-1.4 3-3 3H17c-1.6 0-3-1.4-3-3z" />
          </g>
        </svg>
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
