"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setAdminAtivo, setAdminRole, type AdminRole } from "./actions";

const ROLE_OPTIONS: { value: AdminRole; label: string }[] = [
  { value: "admin_geral", label: "Geral" },
  { value: "admin_conteudo", label: "Conteúdo" },
  { value: "admin_suporte", label: "Suporte" },
];

export function AdminRow({
  userId,
  role,
  ativo,
  isSelf,
}: {
  userId: string;
  role: string;
  ativo: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  function run(fn: () => Promise<void>) {
    setErro(null);
    startTransition(async () => {
      try {
        await fn();
        router.refresh();
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {erro && <span className="text-xs text-destructive">{erro}</span>}
      <select
        value={role}
        onChange={(e) => run(() => setAdminRole(userId, e.target.value as AdminRole))}
        disabled={pending || !ativo}
        className="rounded-md border bg-background px-2 py-1 text-xs"
        aria-label="Cargo do admin"
      >
        {ROLE_OPTIONS.map((r) => (
          <option key={r.value} value={r.value}>
            {r.label}
          </option>
        ))}
      </select>
      {ativo ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            if (isSelf) return;
            if (!confirm("Desativar este admin?")) return;
            run(() => setAdminAtivo(userId, false));
          }}
          disabled={pending || isSelf}
          title={isSelf ? "Você não pode desativar a si mesmo" : undefined}
        >
          Desativar
        </Button>
      ) : (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => run(() => setAdminAtivo(userId, true))}
          disabled={pending}
        >
          Reativar
        </Button>
      )}
    </div>
  );
}
