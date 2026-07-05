import { createServiceRoleClient } from "@/lib/supabase/server";
import { carregarPublico } from "@/lib/analytics/publico";
import { Bloco, BarList, Stat, Vazio } from "@/components/dashboard/blocos";

/**
 * Dashboard 3 — Público. "Quem estamos atingindo?" — perfil dos filhos, laudo,
 * idade, gênero, responsável, localização (aprox.) e cruzamentos pro tráfego.
 * Tudo agregado e anônimo.
 */
export const dynamic = "force-dynamic";

export default async function PublicoPage() {
  const d = await carregarPublico(createServiceRoleClient());
  const idadeMae = d.idadeMediaResponsavel;

  return (
    <div className="flex flex-col gap-8">
      <p className="-mt-2 text-sm text-muted-foreground">
        Quem estamos atingindo — perfil das famílias, agregado e anônimo. Ajuda a
        mirar anúncio e mensagem.
      </p>

      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Famílias" value={d.totalFamilias} />
        <Stat label="Filhos atípicos" value={d.totalFilhos} />
        <Stat
          label="Idade média do responsável"
          value={idadeMae.media != null ? `${idadeMae.media} anos` : "—"}
          sub={idadeMae.media != null ? `${idadeMae.n} com data informada` : "sem dados ainda"}
        />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Bloco titulo="Perfil do filho" desc="Condição principal informada no cadastro.">
          {d.perfilFilho.length ? <BarList items={d.perfilFilho} /> : <Vazio />}
        </Bloco>

        <Bloco titulo="Com ou sem laudo" desc="Tem diagnóstico formal registrado?">
          <BarList
            items={[
              { label: "Com laudo formal", n: d.comSemLaudo.com },
              { label: "Sem laudo / em investigação", n: d.comSemLaudo.sem },
            ]}
          />
        </Bloco>

        <Bloco titulo="Idade do filho" desc="Faixa etária dos filhos atípicos.">
          {d.idadeFilho.length ? <BarList items={d.idadeFilho} /> : <Vazio />}
        </Bloco>

        <Bloco titulo="Gênero do filho" desc="Menino, menina ou não informado.">
          {d.generoFilho.length ? <BarList items={d.generoFilho} /> : <Vazio />}
        </Bloco>

        <Bloco titulo="Filhos por família" desc="Quantos filhos atípicos cada família cadastrou.">
          {d.filhosPorFamilia.length ? <BarList items={d.filhosPorFamilia} /> : <Vazio />}
        </Bloco>

        <Bloco titulo="Localização (aprox.)" desc="Estado pelo DDD; exterior pelo país. É a região do número.">
          {d.localizacao.length ? <BarList items={d.localizacao} /> : <Vazio />}
        </Bloco>

        <Bloco titulo="Responsável — homem ou mulher" desc="Gênero de quem cuida e cadastrou.">
          {d.generoResponsavel.length ? <BarList items={d.generoResponsavel} /> : <Vazio />}
        </Bloco>

        <Bloco titulo="Responsável — laço" desc="Mãe, pai, avó… quem está no comando.">
          {d.lacoResponsavel.length ? <BarList items={d.lacoResponsavel} /> : <Vazio />}
        </Bloco>

        <Bloco titulo="Principais desafios" desc="Áreas dos desafios registrados (90d).">
          {d.dorRank.length ? <BarList items={d.dorRank} /> : <Vazio />}
        </Bloco>

        <Bloco titulo="Rede de apoio" desc="Cadastrou alguém no mapa familiar (co-cuidador)?">
          <BarList
            items={[
              { label: "Com rede cadastrada", n: d.redeApoio.com },
              { label: "Sem rede (solo?)", n: d.redeApoio.sem },
            ]}
          />
        </Bloco>
      </div>

      {/* Cruzamento origem × perfil */}
      <Bloco titulo="Origem × Perfil" desc="Qual anúncio/canal traz qual condição — pra mirar o criativo.">
        {d.origemXPerfil.length === 0 ? (
          <Vazio />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Origem</th>
                  <th className="px-3 py-2 font-medium">Perfil</th>
                  <th className="px-3 py-2 text-right font-medium">Famílias</th>
                </tr>
              </thead>
              <tbody>
                {d.origemXPerfil.map((o, i) => (
                  <tr key={i} className="border-t border-foreground/[0.06]">
                    <td className="py-2 pr-3 text-foreground">{o.origem}</td>
                    <td className="px-3 py-2 text-muted-foreground">{o.perfil}</td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">{o.n}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>

      {/* Faixa etária × conversão */}
      <Bloco titulo="Faixa etária × conversão" desc="Que idade de filho mais vira assinante (pela 1ª criança da família).">
        {d.faixaXConversao.length === 0 ? (
          <Vazio />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">Faixa</th>
                  <th className="px-3 py-2 text-right font-medium">Cadastraram</th>
                  <th className="px-3 py-2 text-right font-medium">Assinaram</th>
                  <th className="px-3 py-2 text-right font-medium">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {d.faixaXConversao.map((f) => (
                  <tr key={f.faixa} className="border-t border-foreground/[0.06]">
                    <td className="py-2 pr-3 text-foreground">{f.faixa}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{f.cadastrou}</td>
                    <td className="px-3 py-2 text-right text-muted-foreground">{f.assinou}</td>
                    <td className="px-3 py-2 text-right font-semibold text-foreground">
                      {f.cadastrou > 0 ? Math.round((f.assinou / f.cadastrou) * 100) : 0}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Bloco>
    </div>
  );
}
