import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ReportData } from "@/lib/relatorio/data";

const FAIXA_LABEL: Record<string, string> = {
  normal: "Normal",
  leve: "Leve",
  moderada: "Moderada",
  severa: "Severa",
  extremamente_severa: "Extremamente severa",
};

/**
 * Render compartilhado do relatório.
 *
 * Usado em três contextos:
 *   - /relatorios/[id]: preview pra mãe revisar
 *   - /relatorios/[id]/imprimir: HTML print-friendly (Ctrl+P → PDF)
 *   - /r/[token]: link vivo público
 *
 * O CSS usa classes utility do Tailwind. Imprimir usa @media print
 * pra ajustes visuais.
 */
export function ReportRender({
  data,
  narrativa,
  variante,
}: {
  data: ReportData;
  narrativa: string[];
  variante: "preview" | "print" | "live";
}) {
  return (
    <article className={`flex flex-col gap-6 ${variante === "print" ? "max-w-none" : "max-w-3xl"}`}>
      <Header data={data} variante={variante} />

      <Identificacao data={data} />

      {data.destinatario === "terapeuta" ? (
        <RelatorioTerapeuta data={data} narrativa={narrativa} />
      ) : (
        <RelatorioEscola data={data} narrativa={narrativa} />
      )}

      <Footer data={data} />
    </article>
  );
}

function Header({ data, variante }: { data: ReportData; variante: string }) {
  return (
    <header className="flex flex-col gap-1 border-b pb-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">
        Kolo Família · Relatório para {data.destinatario}
      </p>
      <h1 className="font-heading text-2xl font-semibold">{data.membro.nome}</h1>
      <p className="text-sm text-muted-foreground">
        {data.membro.idade} anos · {data.membro.perfil}
        {variante !== "live" && (
          <>
            {" "}
            · Janela: últimos {data.janelaMeses} meses · Gerado em{" "}
            {format(new Date(data.geradoEm), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
              locale: ptBR,
            })}
          </>
        )}
        {variante === "live" && (
          <> · <strong>Atualizado em tempo real</strong></>
        )}
      </p>
    </header>
  );
}

function Identificacao({ data }: { data: ReportData }) {
  if (data.destinatario === "escola") {
    return (
      <section>
        <h2 className="mb-2 text-lg font-medium">Identificação</h2>
        <p className="text-sm">
          {data.membro.nome}, {data.membro.idade} anos.
        </p>
      </section>
    );
  }
  return (
    <section>
      <h2 className="mb-2 text-lg font-medium">Identificação</h2>
      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-medium">Nome</dt>
          <dd>{data.membro.nome}</dd>
        </div>
        <div>
          <dt className="font-medium">Idade</dt>
          <dd>{data.membro.idade} anos</dd>
        </div>
        <div>
          <dt className="font-medium">Perfil declarado</dt>
          <dd>{data.membro.perfil}</dd>
        </div>
        {data.membro.diagnosticosFormais.length > 0 && (
          <div>
            <dt className="font-medium">Diagnósticos formais informados</dt>
            <dd>{data.membro.diagnosticosFormais.join("; ")}</dd>
          </div>
        )}
      </dl>
    </section>
  );
}

function RelatorioTerapeuta({
  data,
  narrativa,
}: {
  data: ReportData;
  narrativa: string[];
}) {
  return (
    <>
      <section>
        <h2 className="mb-2 text-lg font-medium">Resumo do perfil (Kolo Vivo)</h2>
        <Field label="Essencial" value={data.koloVivo.essencial} />
        <Field label="Como ele/ela é" value={data.koloVivo.como_e} />
        <Field label="Corpo & rotina" value={data.koloVivo.corpo_rotina} />
        <Field label="Desafios & regulação" value={data.koloVivo.desafios_regulacao} />
        <Field label="Sensorial" value={data.koloVivo.sensorial} />
      </section>

      {data.koloVivo.composicaoFamilia && (
        <section>
          <h2 className="mb-2 text-lg font-medium">Contexto da família</h2>
          <Field label="Composição" value={data.koloVivo.composicaoFamilia} />
          <Field label="Rotina" value={data.koloVivo.rotinaFamilia ?? ""} />
          <Field label="Recursos" value={data.koloVivo.recursosFamilia ?? ""} />
        </section>
      )}

      {narrativa.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-medium">Padrões observados na janela</h2>
          <ul className="ml-5 list-disc space-y-1 text-sm">
            {narrativa.map((obs, i) => (
              <li key={i}>{obs}</li>
            ))}
          </ul>
        </section>
      )}

      <LinhaDoTempo data={data} />

      {data.camadaB && (
        <section>
          <h2 className="mb-2 text-lg font-medium">
            Camada B — regulação do adulto cuidador
          </h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Distribuição em registros de desafio. Sem identificar nomes.
          </p>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <h3 className="font-medium">Estado do adulto</h3>
              <ul className="ml-4 list-disc">
                {data.camadaB.correlacaoEstadoAdulto.map((c) => (
                  <li key={c.estado}>
                    {labelEstado(c.estado)}: {c.ocorrenciasDesafio}×
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="font-medium">Reação do adulto</h3>
              <ul className="ml-4 list-disc">
                {data.camadaB.correlacaoReacao.map((c) => (
                  <li key={c.reacao}>
                    {labelReacao(c.reacao)}: {c.ocorrenciasDesafio}×
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {data.dass21 && data.dass21.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-medium">DASS-21 (cuidadora principal)</h2>
          <p className="mb-2 text-xs text-muted-foreground">
            Termômetro auto-aplicável. Não é diagnóstico.
          </p>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left">
                <th className="py-1 pr-2">Data</th>
                <th className="py-1 pr-2">Depressão</th>
                <th className="py-1 pr-2">Ansiedade</th>
                <th className="py-1 pr-2">Estresse</th>
              </tr>
            </thead>
            <tbody>
              {data.dass21.map((a) => (
                <tr key={a.data} className="border-b last:border-b-0">
                  <td className="py-1 pr-2">{a.data}</td>
                  <td className="py-1 pr-2">
                    {a.depressao.score} ({FAIXA_LABEL[a.depressao.faixa] ?? a.depressao.faixa})
                  </td>
                  <td className="py-1 pr-2">
                    {a.ansiedade.score} ({FAIXA_LABEL[a.ansiedade.faixa] ?? a.ansiedade.faixa})
                  </td>
                  <td className="py-1 pr-2">
                    {a.estresse.score} ({FAIXA_LABEL[a.estresse.faixa] ?? a.estresse.faixa})
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </>
  );
}

function RelatorioEscola({
  data,
  narrativa,
}: {
  data: ReportData;
  narrativa: string[];
}) {
  return (
    <>
      <section>
        <h2 className="mb-2 text-lg font-medium">Como {data.membro.nome} é</h2>
        <Field label="Forças e interesses" value={data.koloVivo.como_e} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Como se regula</h2>
        <Field label="Rotina e corpo" value={data.koloVivo.corpo_rotina} />
        <Field label="Sensorial" value={data.koloVivo.sensorial} />
      </section>

      <section>
        <h2 className="mb-2 text-lg font-medium">Sinais de desregulação e o que ajuda</h2>
        <Field label="Desafios e gatilhos conhecidos" value={data.koloVivo.desafios_regulacao} />
      </section>

      {narrativa.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-medium">Padrões observados</h2>
          <ul className="ml-5 list-disc space-y-1 text-sm">
            {narrativa.map((obs, i) => (
              <li key={i}>{obs}</li>
            ))}
          </ul>
        </section>
      )}

      {data.linhaDoTempo.estrategiasAplicadas.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-medium">Estratégias que vêm funcionando em casa</h2>
          <ul className="ml-5 list-disc space-y-1 text-sm">
            {data.linhaDoTempo.estrategiasAplicadas.slice(0, 5).map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function LinhaDoTempo({ data }: { data: ReportData }) {
  if (
    data.linhaDoTempo.conquistas.length === 0 &&
    data.linhaDoTempo.desafios.length === 0
  ) {
    return null;
  }
  return (
    <section>
      <h2 className="mb-2 text-lg font-medium">Linha do tempo</h2>

      {data.linhaDoTempo.conquistas.length > 0 && (
        <div className="mb-3">
          <h3 className="text-sm font-medium">
            Conquistas ({data.linhaDoTempo.conquistas.length})
          </h3>
          <ul className="ml-5 list-disc text-sm">
            {data.linhaDoTempo.conquistas.slice(0, 8).map((c, i) => (
              <li key={i}>
                <span className="text-muted-foreground">{c.data}:</span> {c.texto}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.linhaDoTempo.desafios.length > 0 && (
        <div className="mb-3">
          <h3 className="text-sm font-medium">
            Desafios ({data.linhaDoTempo.desafios.length})
          </h3>
          <ul className="ml-5 list-disc text-sm">
            {data.linhaDoTempo.desafios.slice(0, 8).map((c, i) => (
              <li key={i}>
                <span className="text-muted-foreground">{c.data}:</span> {c.texto}
              </li>
            ))}
          </ul>
        </div>
      )}

      {data.linhaDoTempo.gatilhosFrequentes.length > 0 && (
        <div>
          <h3 className="text-sm font-medium">Gatilhos recorrentes</h3>
          <ul className="ml-5 list-disc text-sm">
            {data.linhaDoTempo.gatilhosFrequentes.map((g, i) => (
              <li key={i}>
                {g.texto} ({g.ocorrencias}×)
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function Footer({ data }: { data: ReportData }) {
  return (
    <footer className="border-t pt-4 text-xs text-muted-foreground">
      <p>
        Este relatório espelha registros voluntários da família no Kolo Família. Não
        constitui diagnóstico, prognóstico ou recomendação clínica. Termômetros
        auto-aplicáveis (DASS-21) não substituem avaliação profissional.
      </p>
      <p className="mt-1">
        Gerado em {format(new Date(data.geradoEm), "dd/MM/yyyy 'às' HH:mm")} · Kolo
        Família
      </p>
    </footer>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value || value.trim().length === 0) return null;
  return (
    <div className="mb-2">
      <h3 className="text-sm font-medium">{label}</h3>
      <p className="whitespace-pre-wrap text-sm text-muted-foreground">{value}</p>
    </div>
  );
}

function labelEstado(v: string): string {
  const m: Record<string, string> = {
    calmo: "Calmo",
    firme: "Firme",
    cansado: "Cansado",
    ansioso: "Ansioso",
    impaciente: "Impaciente",
  };
  return m[v] ?? v;
}

function labelReacao(v: string): string {
  const m: Record<string, string> = {
    acolhedor: "Acolhedor",
    esperou: "Esperou",
    interveio: "Interveio",
    impositivo: "Impositivo",
    chamou_ajuda: "Chamou ajuda",
    outro: "Outro",
  };
  return m[v] ?? v;
}
