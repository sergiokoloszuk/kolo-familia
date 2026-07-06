import { Suspense } from "react";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { carregarComportamento, type FamRow } from "@/lib/analytics/dashboard";
import { Bloco, BarList, Stat, TabelaFamilias, Vazio } from "@/components/dashboard/blocos";
import { ehAdmin } from "@/lib/auth/require-admin";
import { AnalisePlanos } from "./analise-planos";

/**
 * Dashboard 2 — Comportamento & Uso. Responde: "o que as famílias mais fazem?"
 * — pra a equipe de tráfego dar ênfase no anúncio. O acesso e o cabeçalho ficam
 * no layout. Anônimo (agregado, sem conteúdo de criança).
 */
export const dynamic = "force-dynamic";

export default async function ComportamentoUsoPage() {
  const [d, isAdmin] = await Promise.all([
    carregarComportamento(createServiceRoleClient()),
    ehAdmin(),
  ]);
  const labelFam = (f: FamRow) =>
    f.nome?.trim() || f.email || `Família #${f.id.slice(0, 6)}`;

  return (
    <div className="flex flex-col gap-8">
      <p className="-mt-2 text-sm text-muted-foreground">
        O que as famílias mais fazem — pra dar ênfase no anúncio.
      </p>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Completude média do Kolo Vivo" value={`${d.completudeMedia}%`} />
        <Stat label="Ayla (WhatsApp)" value={d.aylaInbound} sub="mensagens (90d)" />
        <Stat label="Web — conversas" value={d.webConversas} sub="90 dias" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Bloco titulo="Features mais usadas" desc="Registro, conversa, lúdico, plano…">
          {d.featureRank.length ? <BarList items={d.featureRank} /> : <Vazio />}
        </Bloco>
        <Bloco titulo="Telas mais visitadas" desc="Do tracking — enche com o uso.">
          {d.telaRank.length ? <BarList items={d.telaRank} /> : <Vazio />}
        </Bloco>
        <Bloco titulo="Kolo Vivo — temas preenchidos" desc="Domínios com conteúdo (agregado).">
          <BarList items={d.domRank} />
        </Bloco>
        <Bloco titulo="Desafios mais recorrentes" desc="Áreas dos desafios registrados (90d).">
          <BarList items={d.desafioRank} />
        </Bloco>
        <Suspense
          fallback={
            <Bloco titulo="Planos por área" desc="Sobre o que as famílias pedem plano.">
              <p className="text-sm text-muted-foreground">Analisando os pedidos por IA…</p>
            </Bloco>
          }
        >
          <AnalisePlanos isAdmin={isAdmin} />
        </Suspense>
        <Bloco titulo="Lúdico — o que e quanto" desc="Total gerado e quantas famílias usaram.">
          <ul className="flex flex-col gap-2">
            {d.ludico.map((l) => (
              <li key={l.label} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{l.label}</span>
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{l.n}</strong> · {l.fam} família(s)
                </span>
              </li>
            ))}
          </ul>
        </Bloco>
      </div>

      <Bloco titulo="Leads mais engajados" desc="Top 20 por volume combinado. Nome da mãe (ou e-mail, quando ainda sem nome).">
        <TabelaFamilias linhas={d.topEngajadas} labelFam={labelFam} />
      </Bloco>
    </div>
  );
}
