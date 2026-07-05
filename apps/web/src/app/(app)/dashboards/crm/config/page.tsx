import { createServiceRoleClient } from "@/lib/supabase/server";
import { ehAdmin } from "@/lib/auth/require-admin";
import { carregarFaseScripts } from "@/lib/crm/fase-scripts";
import { CrmNav } from "../crm-nav";
import { ConfigForm } from "./config-form";

export const dynamic = "force-dynamic";

export default async function CrmConfigPage() {
  const [scripts, isAdmin] = await Promise.all([
    carregarFaseScripts(createServiceRoleClient()),
    ehAdmin(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <CrmNav />
      <p className="-mt-2 text-sm text-muted-foreground">
        Roteiro por fase (ordem da jornada): o que a <strong>Ayla</strong> faz e a{" "}
        <strong>sugestão da sua abordagem</strong> — que alimenta o copiloto.{" "}
        {isAdmin ? "Edite à vontade." : "(Leitura — só admin edita.)"}
      </p>

      <div className="flex flex-col gap-4">
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
    </div>
  );
}
