import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { BLACK_FRIDAY_2026, janelaPublicaAberta } from "@/lib/billing/black-friday-2026";
import { lerOfertaBlackFridayNoStripe } from "@/lib/billing/oferta-black-friday";
import {
  lerEstadoBlackFriday,
  lerProvaBackupBlackFriday,
} from "@/lib/billing/estado-black-friday";
import { ativarBlackFriday, pausarBlackFriday, registrarProvaBackup } from "./actions";

export const dynamic = "force-dynamic";

function Gate({ ok, titulo, detalhe }: { ok: boolean; titulo: string; detalhe: string }) {
  return (
    <li className="rounded-2xl border bg-white p-4">
      <p className="font-semibold">{ok ? "✅" : "⛔"} {titulo}</p>
      <p className="mt-1 text-sm text-muted-foreground">{detalhe}</p>
    </li>
  );
}

export default async function BlackFridayAdminPage() {
  await requireAdmin();
  const admin = createServiceRoleClient();
  const [{ count, error: migrationError }, estado, provaBackup, preco] = await Promise.all([
    admin.from("black_friday_2026_participacoes").select("family_account_id", { count: "exact", head: true }),
    lerEstadoBlackFriday(admin),
    lerProvaBackupBlackFriday(admin),
    lerOfertaBlackFridayNoStripe(),
  ]);
  const migracaoPronta = !migrationError;
  const janelaAberta = janelaPublicaAberta(new Date());
  const podeAtivar = migracaoPronta && Boolean(provaBackup) && preco.ok && janelaAberta && estado !== "encerrada";

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-purple">Campanha crítica</p>
        <h1 className="mt-2 font-heading text-3xl">Black Friday 2026</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Esta tela não envia mensagens. Ela só mostra as travas e, quando todas estiverem verdes,
          permite ligar ou pausar novas entradas.
        </p>
      </div>

      <div className="rounded-3xl bg-brand-purple-dark p-6 text-white">
        <p className="text-sm text-white/70">Estado atual</p>
        <p className="mt-1 text-3xl font-bold capitalize">{estado}</p>
        <p className="mt-2 text-sm text-white/75">Participações registradas: {count ?? "indisponível"}</p>
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        <Gate ok={migracaoPronta} titulo="Banco preparado" detalhe={migracaoPronta ? "A estrutura da campanha está disponível." : "A migração ainda não foi aplicada. A campanha fica desligada."} />
        <Gate ok={Boolean(provaBackup)} titulo="Backup restaurado" detalhe={provaBackup ?? "Falta registrar a prova real de restauração (PEND-092)."} />
        <Gate ok={preco.ok} titulo="Preço Stripe" detalhe={preco.ok ? `R$ 39,90/mês conferido em ${preco.priceId}.` : preco.problema ?? "Não conferido."} />
        <Gate ok={janelaAberta} titulo="Data permitida" detalhe={janelaAberta ? "Estamos dentro de novembro de 2026, horário de Brasília." : "A ativação só é permitida entre 1º e 30 de novembro."} />
      </ul>

      <section className="rounded-3xl border bg-white p-6">
        <h2 className="font-heading text-xl">Prova do backup</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Registre aqui apenas depois de restaurar o backup em ambiente separado e conferir que ele abre.
        </p>
        <form action={registrarProvaBackup} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input name="prova" defaultValue={provaBackup ?? ""} required minLength={12} maxLength={500}
            placeholder="Data, local e referência da evidência"
            className="min-w-0 flex-1 rounded-xl border px-4 py-2" />
          <button className="rounded-full bg-brand-purple px-5 py-2 font-semibold text-white">Registrar prova</button>
        </form>
      </section>

      <section className="rounded-3xl border bg-white p-6">
        <h2 className="font-heading text-xl">Virar a chave</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Ao ativar, testes em curso passam de 7 para 15 dias totais. Nenhuma mensagem e nenhuma cobrança são feitas.
        </p>
        <div className="mt-4 flex gap-3">
          {estado === "ativa" ? (
            <form action={pausarBlackFriday}>
              <button className="rounded-full border border-red-300 px-5 py-2 font-semibold text-red-700">Pausar novas entradas</button>
            </form>
          ) : (
            <form action={ativarBlackFriday}>
              <button disabled={!podeAtivar}
                className="rounded-full bg-brand-purple px-5 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
                Ativar campanha
              </button>
            </form>
          )}
        </div>
      </section>

      <p className="text-xs text-muted-foreground">
        Contrato: {BLACK_FRIDAY_2026.diasTrial} dias · R$ 39,90/mês · checkout por 30 minutos · anual oculto.
      </p>
    </div>
  );
}
