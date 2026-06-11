import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RotinasPrototipo } from "./rotinas-prototipo";

/** PROTÓTIPO (sem backend) das Rotinas visuais. */
export default function RotinasPrototipoPage() {
  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/momentos"
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft aria-hidden className="size-3" /> Voltar
      </Link>
      <RotinasPrototipo />
    </div>
  );
}
