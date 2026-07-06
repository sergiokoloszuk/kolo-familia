import { createServiceRoleClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import { carregarFaseScripts } from "@/lib/crm/fase-scripts";
import { carregarCadencia } from "@/lib/crm/ayla-cadencia";
import { CrmNav } from "../crm-nav";
import { ConfigForm } from "./config-form";
import { CadenciaForm } from "./cadencia-form";

export const dynamic = "force-dynamic";

export default async function CrmConfigPage() {
  const admin = createServiceRoleClient();
  const [scripts, cadencia, isAdmin] = await Promise.all([
    carregarFaseScripts(admin),
    carregarCadencia(admin),
    ehAdmin(),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <CrmNav />

      {/* Cadência da Ayla (proativa) */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg text-foreground">Cadência da Ayla (proativa)</h2>
          <p className="text-sm text-muted-foreground">
            O que a Ayla fala em cada situação. O QUANDO (dia/estado) é automático; o QUE ela diz você ajusta aqui.{" "}
            {isAdmin ? "Edite e ligue/desligue cada uma." : "(Leitura — só admin edita.)"}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {cadencia.map((c) =>
            isAdmin ? (
              <CadenciaForm
                key={c.situacao}
                situacao={c.situacao}
                label={c.label}
                diretriz={c.diretriz}
                ativo={c.ativo}
              />
            ) : (
              <div key={c.situacao} className="rounded-2xl border border-foreground/[0.08] bg-white p-5">
                <h3 className="mb-1 font-heading text-base text-foreground">
                  {c.label} {c.ativo ? "" : "· (desligada)"}
                </h3>
                <p className="text-sm text-muted-foreground">{c.diretriz || "—"}</p>
              </div>
            ),
          )}
        </div>
      </section>

      {/* Roteiro por fase (sua abordagem no copiloto) */}
      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg text-foreground">Sua abordagem por fase (copiloto)</h2>
          <p className="text-sm text-muted-foreground">
            Referência do que a Ayla faz + a <strong>sugestão da sua abordagem</strong> por fase — que alimenta o copiloto.{" "}
            {isAdmin ? "Edite à vontade." : "(Leitura.)"}
          </p>
        </div>
        <div className="flex flex-col gap-3">
          {scripts.map((s) =>
            isAdmin ? (
              <ConfigForm
                key={s.fase}
                fase={s.fase}
                label={s.label}
                textoAyla={s.textoAyla}
                textoSugestao={s.textoSugestao}
              />
            ) : (
              <div key={s.fase} className="rounded-2xl border border-foreground/[0.08] bg-white p-5">
                <h3 className="mb-2 font-heading text-base text-foreground">{s.label}</h3>
                <p className="text-sm text-muted-foreground">
                  <strong>🤖 Ayla:</strong> {s.textoAyla || "—"}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  <strong>🙋‍♀️ Sugestão:</strong> {s.textoSugestao || "—"}
                </p>
              </div>
            ),
          )}
        </div>
      </section>
    </div>
  );
}
