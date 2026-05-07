import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "../../nav";
import { TrilhaForm } from "../trilha-form";

export default async function NovaTrilhaPage() {
  await requireAdmin();
  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Nova trilha</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Conteúdo</CardTitle>
        </CardHeader>
        <CardContent>
          <TrilhaForm inicial={{}} />
        </CardContent>
      </Card>
    </div>
  );
}
