import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
      <p className="font-mono text-sm text-muted-foreground">404</p>
      <h1 className="font-heading text-2xl font-semibold">
        Não achei essa página
      </h1>
      <p className="text-sm text-muted-foreground">
        O endereço pode ter mudado, ou a página foi removida.
      </p>
      <div className="flex gap-2">
        <Link href="/" className={cn(buttonVariants())}>
          Voltar pra home
        </Link>
        <Link
          href="/contato"
          className={cn(buttonVariants({ variant: "outline" }))}
        >
          Falar com a gente
        </Link>
      </div>
    </div>
  );
}
