import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SkillForm } from "../skill-form";

export default async function NovaSkillPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <Link
          href="/admin/skills"
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft aria-hidden="true" className="size-3" />
          Skills
        </Link>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Nova skill</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Configuração</CardTitle>
        </CardHeader>
        <CardContent>
          <SkillForm inicial={{}} />
        </CardContent>
      </Card>
    </div>
  );
}
