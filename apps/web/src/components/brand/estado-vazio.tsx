import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * EstadoVazio — bloco editorial Kolo para listas/áreas sem conteúdo ainda.
 *
 * Atmosfera: "está começando", não "está vazio".
 *
 * Herda padding do Card primitivo (P2.3 — 20/24px). NÃO override pra evitar
 * empty state inflado. Ícone pequeno (size-6) em roxo, antes do título.
 */
export function EstadoVazio({
  icon,
  titulo,
  descricao,
  acao,
  className,
}: {
  icon?: React.ReactNode;
  titulo: string;
  descricao?: React.ReactNode;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card
      className={cn(
        "rounded-3xl border-l-4 border-brand-yellow bg-kolo-lilas-bg-2",
        className,
      )}
    >
      <CardHeader>
        {icon && (
          <span
            aria-hidden
            className="mb-2 inline-flex text-brand-purple [&_svg]:size-6 [&_svg]:stroke-[1.8]"
          >
            {icon}
          </span>
        )}
        <CardTitle className="font-heading text-base text-foreground">
          {titulo}
        </CardTitle>
        {descricao && <CardDescription>{descricao}</CardDescription>}
      </CardHeader>
      {acao && <CardContent>{acao}</CardContent>}
    </Card>
  );
}
