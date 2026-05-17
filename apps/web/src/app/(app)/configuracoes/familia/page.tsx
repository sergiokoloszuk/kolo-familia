import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { loadFamilyContext } from "@/lib/auth/require-user";
import { PessoaForm } from "./pessoa-form";
import { TogglePessoa } from "./pessoa-row";
import { PapelCuidadoSelect } from "./papeis-cuidado";

const PAPEL_LABEL: Record<string, string> = {
  mae: "Mãe",
  pai: "Pai",
  padrasto: "Padrasto",
  madrasta: "Madrasta",
  avo_a: "Avó",
  avo_o: "Avô",
  irmao_a: "Irmão(ã)",
  tio_a: "Tio(a)",
  baba: "Babá",
  professor_a: "Professor(a)",
  terapeuta: "Terapeuta",
  medico: "Médico(a)",
  amigo_da_familia: "Amigo da família",
  outro: "Outro",
};

const FREQUENCIA_LABEL: Record<string, string> = {
  diaria: "diária",
  semanal: "semanal",
  mensal: "mensal",
  rara: "rara",
  unica: "única",
};

export default async function FamiliaPage() {
  const { supabase, family } = await loadFamilyContext();
  const familyId = family!.id;

  const [{ data: pessoas }, { data: membros }, { data: papeis }] = await Promise.all([
    supabase
      .from("pessoas_familia")
      .select("id, nome, apelido, papel, papel_livre, observacoes, coabitante, frequencia_contato, ativo, created_at")
      .eq("family_account_id", familyId)
      .order("ativo", { ascending: false })
      .order("created_at", { ascending: true }),
    supabase
      .from("membros_atipicos")
      .select("id, nome")
      .eq("family_account_id", familyId)
      .eq("ativo", true)
      .order("created_at", { ascending: true }),
    supabase
      .from("papeis_cuidado")
      .select("pessoa_familia_id, membro_atipico_id, tipo_cuidado")
      .in(
        "pessoa_familia_id",
        // placeholder — vamos filtrar por família via subquery RLS
        ["00000000-0000-0000-0000-000000000000"],
      ),
  ]);

  // Re-query papeis com IDs reais (a primeira query usava placeholder pra evitar erro de array vazio)
  const pessoaIds = (pessoas ?? []).map((p) => p.id as string);
  let papeisReais: Array<{
    pessoa_familia_id: string;
    membro_atipico_id: string;
    tipo_cuidado: string;
  }> = [];
  if (pessoaIds.length > 0) {
    const { data } = await supabase
      .from("papeis_cuidado")
      .select("pessoa_familia_id, membro_atipico_id, tipo_cuidado")
      .in("pessoa_familia_id", pessoaIds);
    papeisReais = (data ?? []) as typeof papeisReais;
  }
  void papeis;

  // Mapa { pessoa_id: { membro_id: tipo } }
  const papeisMap = new Map<string, Map<string, string>>();
  for (const p of papeisReais) {
    if (!papeisMap.has(p.pessoa_familia_id)) papeisMap.set(p.pessoa_familia_id, new Map());
    papeisMap.get(p.pessoa_familia_id)!.set(p.membro_atipico_id, p.tipo_cuidado);
  }

  const ativos = (pessoas ?? []).filter((p) => p.ativo).length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/configuracoes"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Voltar para configurações
        </Link>
      </div>

      <header>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Mapa familiar</h1>
        <p className="text-sm text-muted-foreground">
          Quem cuida, quem mora junto, quem aparece no dia a dia. Esses dados
          ajudam a Ayla e as especialistas a entender o contexto sem você
          precisar contar do zero toda vez.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Adicionar pessoa</CardTitle>
          <CardDescription>
            Quem faz parte do círculo de cuidado — pai, padrasto, avós, babá,
            professora, terapeuta. Você pode editar ou desativar depois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PessoaForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pessoas cadastradas</CardTitle>
          <CardDescription>
            {pessoas?.length ?? 0} cadastrada(s) · {ativos} ativa(s).
          </CardDescription>
        </CardHeader>
        <CardContent>
          {(pessoas?.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma pessoa cadastrada ainda. Comece pelo cuidador principal.
            </p>
          ) : (
            <ul className="flex flex-col gap-3">
              {(pessoas ?? []).map((p) => {
                const papelLabel = PAPEL_LABEL[p.papel as string] ?? (p.papel as string);
                const papelExibir = p.papel_livre || papelLabel;
                const papeisDestaPessoa = papeisMap.get(p.id as string);
                return (
                  <li
                    key={p.id as string}
                    className="flex flex-col gap-2 rounded-md border bg-card px-3 py-3 text-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">
                          {p.nome as string}
                          {p.apelido ? <span className="text-muted-foreground"> ({p.apelido as string})</span> : null}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {papelExibir}
                          {p.coabitante ? " · mora junto" : ""}
                          {p.frequencia_contato
                            ? ` · contato ${FREQUENCIA_LABEL[p.frequencia_contato as string] ?? p.frequencia_contato}`
                            : ""}
                        </p>
                        {p.observacoes && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {p.observacoes as string}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={p.ativo ? "default" : "secondary"}>
                          {p.ativo ? "ativo" : "inativo"}
                        </Badge>
                        <TogglePessoa id={p.id as string} ativo={p.ativo as boolean} />
                      </div>
                    </div>

                    {p.ativo && (membros?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-3 border-t pt-2">
                        {(membros ?? []).map((m) => (
                          <PapelCuidadoSelect
                            key={m.id as string}
                            pessoaFamiliaId={p.id as string}
                            membroAtipicoId={m.id as string}
                            membroNome={m.nome as string}
                            tipoCuidadoAtual={papeisDestaPessoa?.get(m.id as string) ?? null}
                          />
                        ))}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
