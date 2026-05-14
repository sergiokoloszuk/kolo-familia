"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { addAdmin, type AdminRole } from "./actions";

const ROLES: { value: AdminRole; label: string }[] = [
  { value: "admin_geral", label: "Geral" },
  { value: "admin_conteudo", label: "Conteúdo" },
  { value: "admin_suporte", label: "Suporte" },
];

export function AddAdminForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("admin_geral");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    startTransition(async () => {
      try {
        await addAdmin({ email, role });
        setEmail("");
        setRole("admin_geral");
        router.refresh();
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
      <div className="grid gap-3 md:grid-cols-[1fr_180px]">
        <div>
          <Label htmlFor="admin-email">Email</Label>
          <input
            id="admin-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            placeholder="usuario@exemplo.com"
            disabled={pending}
          />
        </div>
        <div>
          <Label htmlFor="admin-role">Cargo</Label>
          <select
            id="admin-role"
            value={role}
            onChange={(e) => setRole(e.target.value as AdminRole)}
            className="mt-1 w-full rounded-md border bg-background px-3 py-2 text-sm"
            disabled={pending}
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      {erro && <p className="text-xs text-destructive">{erro}</p>}
      <div>
        <Button type="submit" disabled={pending || !email}>
          {pending ? "Adicionando..." : "Adicionar admin"}
        </Button>
      </div>
    </form>
  );
}
