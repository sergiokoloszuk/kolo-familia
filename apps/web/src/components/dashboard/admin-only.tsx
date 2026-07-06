/** Selo pra marcar conteúdo que SÓ o admin vê (a agência não). Pra Karina não
 *  achar que a agência está vendo algo que é privado. */
export function AdminOnly({ children }: { children?: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-purple/10 px-2 py-0.5 text-[11px] font-medium text-brand-purple">
      🔒 {children ?? "Só admin — a agência não vê"}
    </span>
  );
}
