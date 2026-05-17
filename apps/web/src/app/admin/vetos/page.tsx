import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminNav } from "../nav";
import { VetoForm } from "./veto-form";
import { VetoRow } from "./veto-row";

export default async function AdminVetosPage() {
  const { supabase } = await requireAdmin();

  const { data: vetos } = await supabase
    .from("ai_validator_vetos")
    .select("id, categoria, padrao, flags, descricao, sugestao, ativo, origem, updated_at")
    .order("categoria", { ascending: true })
    .order("padrao", { ascending: true });

  // Agrupa por categoria
  const byCategoria = new Map<string, typeof vetos>();
  for (const v of vetos ?? []) {
    const cat = (v.categoria as string) ?? "sem categoria";
    if (!byCategoria.has(cat)) byCategoria.set(cat, []);
    byCategoria.get(cat)!.push(v);
  }

  const ativos = (vetos ?? []).filter((v) => v.ativo).length;

  return (
    <div className="flex flex-col gap-6">
      <AdminNav />
      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Vetos do Validador</h1>
        <p className="text-sm text-muted-foreground">
          Regex que o Validador rejeita em qualquer resposta de skill. Falha em
          qualquer veto = regenera a resposta. Cache atualiza em até 1 min.
          Fallback hardcoded no código garante que a IA não pare se o DB falhar.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar veto</CardTitle>
          <CardDescription>
            Padrão usa sintaxe regex JavaScript. Exemplo:{" "}
            <code>{`\\bquerida m[ãa]e\\b`}</code> pega &quot;querida mãe&quot; e variações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VetoForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Vetos cadastrados</CardTitle>
          <CardDescription>
            {vetos?.length ?? 0} total · {ativos} ativo(s). Vetos com origem
            &quot;sistema&quot; não podem ser removidos (apenas desativados);
            adicionados via UI podem ser removidos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(vetos?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum veto no DB. Rode <code>node scripts/seed-validator-vetos.mjs</code>
              {" "}pra portar os ~26 do fallback hardcoded.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {Array.from(byCategoria.entries()).map(([cat, items]) => (
                <div key={cat}>
                  <h3 className="mb-2 text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    {cat} ({items?.length ?? 0})
                  </h3>
                  <ul className="flex flex-col gap-1.5">
                    {(items ?? []).map((v) => (
                      <li
                        key={v.id as string}
                        className="flex flex-col gap-1 rounded-md border bg-card px-3 py-2 text-sm"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <code className="break-all font-mono text-xs">
                            {(v.padrao as string)}
                            {v.flags ? ` /${v.flags}` : ""}
                          </code>
                          <div className="flex items-center gap-2">
                            <Badge variant={v.ativo ? "default" : "secondary"}>
                              {v.ativo ? "ativo" : "inativo"}
                            </Badge>
                            <Badge variant="outline">{v.origem as string}</Badge>
                            <VetoRow
                              id={v.id as string}
                              ativo={v.ativo as boolean}
                              origem={v.origem as string}
                            />
                          </div>
                        </div>
                        {v.descricao && (
                          <p className="text-xs text-muted-foreground">
                            {v.descricao as string}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
