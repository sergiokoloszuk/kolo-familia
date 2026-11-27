import { createServiceRoleClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/require-admin";
import { formatarBRL, lerPlanosParaExibir } from "@/lib/billing/planos";
import { BLACK_FRIDAY_2026 } from "@/lib/billing/black-friday-2026";
import { lerVirada, paraCampoDeBrasilia } from "@/lib/billing/virada-comercial";
import { cancelarVirada, programarVirada } from "./actions";

export const dynamic = "force-dynamic";

function dataBrasilia(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "short",
  });
}

export default async function ViradaAdminPage() {
  await requireAdmin();
  const admin = createServiceRoleClient();
  const [virada, planos] = await Promise.all([lerVirada(admin), lerPlanosParaExibir(admin)]);
  const fimBlackFriday = BLACK_FRIDAY_2026.fimPublicoExclusivo;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-brand-purple">Comercial</p>
        <h1 className="mt-2 font-heading text-3xl">Virada: sem teste grátis para novas contas</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          A partir da data programada, quem cria conta não ganha dias grátis: conclui o cadastro e
          vai direto para a escolha do plano. Esta tela não envia mensagens, não cobra ninguém e não
          muda nada de quem já tem teste, cortesia, oferta Black Friday ou assinatura — cada um
          mantém o próprio prazo.
        </p>
      </div>

      <div className="rounded-3xl bg-brand-purple-dark p-6 text-white">
        <p className="text-sm text-white/70">Estado atual</p>
        <p className="mt-1 text-3xl font-bold">
          {virada.ativa ? "Valendo" : virada.programadaPara ? "Programada" : "Não programada"}
        </p>
        <p className="mt-2 text-sm text-white/75">
          {virada.programadaPara
            ? `${virada.ativa ? "Desde" : "Começa em"} ${dataBrasilia(virada.programadaPara)} (horário de Brasília).`
            : "Novas contas continuam ganhando o teste de 7 dias."}
        </p>
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        <li className="rounded-2xl border bg-white p-4">
          <p className="font-semibold">Preço que novas contas verão</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Mensal {formatarBRL(planos.mensal.centavos) ?? "indisponível"} · Anual{" "}
            {formatarBRL(planos.anual.centavos) ?? "indisponível"} — lido do Stripe pela mesma
            fonte do checkout.
          </p>
        </li>
        <li className="rounded-2xl border bg-white p-4">
          <p className="font-semibold">Black Friday</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Novas entradas encerram sozinhas em {dataBrasilia(fimBlackFriday)}. Quem já participa
            mantém os 15 dias e os R$ 39,90 até o próprio prazo. Se a virada for depois dessa data,
            o intervalo volta ao teste de 7 dias com o preço normal.
          </p>
        </li>
      </ul>

      <section className="rounded-3xl border bg-white p-6">
        <h2 className="font-heading text-xl">Programar ou mudar a data</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Horário de Brasília. Pode ser alterada quantas vezes for preciso até a data chegar.
        </p>
        <form action={programarVirada} className="mt-4 flex flex-col gap-3">
          <input
            type="datetime-local"
            name="quando"
            required
            defaultValue={paraCampoDeBrasilia(virada.programadaPara)}
            className="w-full max-w-xs rounded-xl border px-4 py-2"
          />
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="confirmo" value="sim" required className="mt-1" />
            <span>
              Confirmo: a partir desta data, novas contas não terão dias grátis, e os termos de uso
              passam a mostrar a seção “Demonstração e Assinaturas”.
            </span>
          </label>
          <button className="w-fit rounded-full bg-brand-purple px-5 py-2 font-semibold text-white">
            Gravar data
          </button>
        </form>
      </section>

      {virada.programadaPara ? (
        <section className="rounded-3xl border bg-white p-6">
          <h2 className="font-heading text-xl">Cancelar a virada</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Novas contas voltam a ganhar o teste de 7 dias na hora. Quem criou conta durante a
            virada continua sem teste — não há concessão retroativa.
          </p>
          <form action={cancelarVirada} className="mt-4">
            <button className="rounded-full border border-red-300 px-5 py-2 font-semibold text-red-700">
              Cancelar virada
            </button>
          </form>
        </section>
      ) : null}
    </div>
  );
}
