"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RespostaMarkdown, limparRespostaKolo } from "@/components/resposta-markdown";
import { dividirEmBolhas, ritmoDasBolhas } from "@/lib/ayla/bolhas";
import {
  paraWhatsApp,
  sintaxeCruaWeb,
  sintaxeCruaWhatsApp,
  type SintaxeCrua,
} from "@/lib/ayla/apresentacao";
import { simular, type ResultadoSimulacao, type VersaoParaTeste } from "./actions";

type Aba = "cru" | "web" | "whatsapp";

export function Simulador({
  familias,
  versoes,
}: {
  familias: Array<{ id: string; nome: string }>;
  versoes: VersaoParaTeste[];
}) {
  const [familia, setFamilia] = useState(familias[0]?.id ?? "");
  const [versaoId, setVersaoId] = useState<string>("");
  const [msg, setMsg] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  /**
   * A CONVERSA DE QA — vive AQUI, no estado do componente, e em nenhum outro
   * lugar. Fechar a aba apaga. É de propósito: o que a Karina escreve testando
   * não pode virar histórico da família de QA, senão a Ayla passa a ler o teste
   * de ontem como se a mãe tivesse dito.
   */
  const [turnos, setTurnos] = useState<
    Array<{ mae: string; resposta: ResultadoSimulacao & { ok: true } }>
  >([]);

  /**
   * Trocar família ou Core zera a conversa. Sem isto, o turno 3 da Família A
   * viajaria como histórico da Família B — que é exatamente a contaminação que
   * a sessão temporária existe para evitar.
   */
  function trocarContexto(fn: () => void) {
    fn();
    setTurnos([]);
    setErro(null);
  }

  const acumulado = turnos.reduce(
    (a, t) => ({
      llms: a.llms + t.resposta.llms,
      consultas: a.consultas + t.resposta.consultas,
      entrada: a.entrada + t.resposta.tokensEntrada,
      saida: a.saida + t.resposta.tokensSaida,
      ms: a.ms + t.resposta.msTotal,
    }),
    { llms: 0, consultas: 0, entrada: 0, saida: 0, ms: 0 },
  );

  function enviar() {
    const texto = msg.trim();
    if (!texto) return;
    iniciar(async () => {
      setErro(null);
      // O histórico que vai ao modelo é o desta sessão, na ordem em que
      // aconteceu — mãe, Ayla, mãe, Ayla…
      const anteriores = turnos.flatMap((t) => [
        { quem: "mae" as const, texto: t.mae },
        { quem: "ayla" as const, texto: t.resposta.texto },
      ]);
      const r = await simular(familia, texto, versaoId || null, anteriores);
      if (r.ok) {
        setTurnos((t) => [...t, { mae: texto, resposta: r }]);
        setMsg("");
      } else {
        setErro(r.error);
      }
    });
  }

  const rotulo = (v: VersaoParaTeste) =>
    `v${v.versao} · ${v.status === "ativo" ? "no ar" : v.publicado_em ? "já esteve no ar" : "candidata"} · ${v.chars.toLocaleString("pt-BR")} car.`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold">Família de QA</span>
          <select
            value={familia}
            onChange={(e) => trocarContexto(() => setFamilia(e.target.value))}
            className="min-w-52 rounded-md border bg-background px-3 py-2 text-sm"
          >
            {familias.length === 0 ? <option value="">nenhuma família no QA</option> : null}
            {familias.map((f) => (
              <option key={f.id} value={f.id}>
                {f.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs">
          <span className="font-semibold">Core a testar</span>
          <select
            value={versaoId}
            onChange={(e) => trocarContexto(() => setVersaoId(e.target.value))}
            className="min-w-72 rounded-md border bg-background px-3 py-2 text-sm"
          >
            <option value="">o que está no ar (ou o Core do código)</option>
            {versoes.map((v) => (
              <option key={v.id} value={v.id}>
                {rotulo(v)}
              </option>
            ))}
          </select>
        </label>
      </div>

      {turnos.length > 0 ? (
        <div className="flex flex-col gap-6 border-t pt-4">
          {turnos.map((t, i) => (
            <div key={i} className="flex flex-col gap-3">
              <div className="rounded-md bg-kolo-lilas-bg-2/60 px-4 py-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  Mãe · turno {i + 1}
                </span>
                <p className="mt-1 whitespace-pre-wrap text-sm">{t.mae}</p>
              </div>
              <Apresentacao texto={t.resposta.texto} />
              <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs sm:grid-cols-5">
                <Metrica k="Core testado" v={t.resposta.coreTestado} />
                <Metrica
                  k="origem"
                  v={`${t.resposta.coreOrigem}${t.resposta.coreVersao !== null ? ` v${t.resposta.coreVersao}` : ""}`}
                />
                <Metrica k="foco" v={t.resposta.foco} />
                <Metrica k="LLMs" v={String(t.resposta.llms)} />
                <Metrica k="consultas" v={String(t.resposta.consultas)} />
                <Metrica k="tokens ent." v={t.resposta.tokensEntrada.toLocaleString("pt-BR")} />
                <Metrica k="tokens saí." v={t.resposta.tokensSaida.toLocaleString("pt-BR")} />
                <Metrica k="contexto" v={`${t.resposta.msContexto} ms`} />
                <Metrica k="modelo" v={`${(t.resposta.msModelo / 1000).toFixed(1)} s`} />
                <Metrica k="ponta a ponta" v={`${(t.resposta.msTotal / 1000).toFixed(1)} s`} />
              </dl>
            </div>
          ))}

          <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <strong>Sessão:</strong> {turnos.length} {turnos.length === 1 ? "turno" : "turnos"} ·{" "}
            {acumulado.llms} LLMs · {acumulado.consultas} consultas ·{" "}
            {acumulado.entrada.toLocaleString("pt-BR")} tokens de entrada ·{" "}
            {acumulado.saida.toLocaleString("pt-BR")} de saída ·{" "}
            {(acumulado.ms / 1000).toFixed(1)}s no total
          </p>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 border-t pt-4">
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder={
            turnos.length === 0
              ? "A mensagem que a mãe mandaria…"
              : "A próxima mensagem da mãe — a Ayla vê tudo acima…"
          }
          className="min-h-[90px] w-full rounded-md border bg-background p-3 text-sm"
        />
        <div className="flex items-center gap-3">
          <Button disabled={pendente || !msg.trim() || !familia} onClick={enviar}>
            {pendente
              ? "A Ayla está pensando…"
              : turnos.length === 0
                ? "Testar"
                : "Continuar a conversa"}
          </Button>
          {turnos.length > 0 ? (
            <Button variant="ghost" onClick={() => trocarContexto(() => setMsg(""))}>
              Nova conversa
            </Button>
          ) : null}
          <span className="text-xs text-muted-foreground">
            Conversa temporária de QA — nada aqui é gravado.
          </span>
        </div>
        {erro ? <p className="text-sm text-red-700">{erro}</p> : null}
      </div>
    </div>
  );
}

/**
 * CRU · WEB · WHATSAPP — a mesma resposta, nas três formas que importam.
 *
 * ⚠️ NADA AQUI É RENDERIZAÇÃO NOVA. A aba WEB usa o MESMO `RespostaMarkdown`
 * que a mãe vê em /conversar, e a aba WHATSAPP usa as MESMAS `paraWhatsApp`,
 * `dividirEmBolhas` e `ritmoDasBolhas` do orquestrador. Um segundo renderizador
 * aqui seria um segundo lugar para a verdade morar — e o simulador deixaria de
 * provar qualquer coisa no dia em que os dois divergissem.
 */
function Apresentacao({ texto }: { texto: string }) {
  const [aba, setAba] = useState<Aba>("web");

  const textoWeb = limparRespostaKolo(texto);
  const textoZap = paraWhatsApp(limparRespostaKolo(texto));
  const bolhas = dividirEmBolhas(textoZap);
  const ritmo = ritmoDasBolhas(bolhas);
  const espera = ritmo.reduce((a, b) => a + b, 0);

  const cruasWeb = sintaxeCruaWeb(textoWeb);
  const cruasZapAntes = sintaxeCruaWhatsApp(textoWeb);
  const cruasZapDepois = sintaxeCruaWhatsApp(textoZap);

  const abas: Array<[Aba, string]> = [
    ["cru", "CRU"],
    ["web", "WEB"],
    ["whatsapp", "WHATSAPP"],
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1 border-b">
        {abas.map(([id, rotulo]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={`-mb-px border-b-2 px-3 py-1.5 text-xs font-semibold tracking-wide ${
              aba === id
                ? "border-brand-purple text-brand-purple"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {rotulo}
          </button>
        ))}
        <span className="ml-auto self-center text-[11px] text-muted-foreground">
          {texto.length.toLocaleString("pt-BR")} caracteres
        </span>
      </div>

      {aba === "cru" ? (
        <div className="rounded-md border bg-muted/40 p-4">
          <p className="whitespace-pre-wrap font-mono text-xs leading-relaxed">{texto}</p>
        </div>
      ) : null}

      {aba === "web" ? (
        <>
          <div className="rounded-md border bg-background p-5">
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-brand-purple">
              Kolo
            </span>
            <RespostaMarkdown texto={textoWeb} className="mt-2 flex flex-col gap-3 text-base" />
          </div>
          <Cruas titulo="Apareceria cru na Web" itens={cruasWeb} />
        </>
      ) : null}

      {aba === "whatsapp" ? (
        <>
          <div className="flex flex-col gap-2 rounded-md border bg-muted/30 p-4">
            {bolhas.map((b, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="mt-2 w-16 shrink-0 text-right font-mono text-[10px] text-muted-foreground">
                  {ritmo[i] > 0 ? `+${ritmo[i]}s` : "na hora"}
                </span>
                <p className="max-w-[85%] whitespace-pre-wrap rounded-lg rounded-tl-none bg-white px-3 py-2 text-sm leading-relaxed shadow-sm">
                  {b}
                </p>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            <strong>{bolhas.length}</strong> {bolhas.length === 1 ? "balão" : "balões"} ·{" "}
            <strong>{espera}s</strong> de espera artificial (teto 4s) · a mãe começa a ler o
            primeiro balão {ritmo[0] ?? 0}s depois de a resposta ficar pronta.
          </p>
          {cruasZapAntes.length > 0 && cruasZapDepois.length === 0 ? (
            <p className="rounded-md border border-emerald-600/30 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <strong>paraWhatsApp converteu {cruasZapAntes.length}</strong>{" "}
              {cruasZapAntes.length === 1 ? "marcação" : "marcações"} que apareceria(m) crua(s):{" "}
              {cruasZapAntes.map((c) => c.sintaxe).join(" · ")}
            </p>
          ) : null}
          <Cruas titulo="Ainda apareceria cru no WhatsApp" itens={cruasZapDepois} />
        </>
      ) : null}
    </div>
  );
}

/** O veredito do detector. Verde quando não há nada — o caso normal. */
function Cruas({ titulo, itens }: { titulo: string; itens: SintaxeCrua[] }) {
  if (itens.length === 0) {
    return (
      <p className="text-xs text-emerald-700">✓ Nenhum Markdown cru chegaria à família.</p>
    );
  }
  return (
    <div className="rounded-md border border-red-600/40 bg-red-50 px-3 py-2 text-xs text-red-900">
      <p className="font-semibold">
        ⚠ {titulo} ({itens.length})
      </p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {itens.map((c) => (
          <li key={c.sintaxe}>
            <span className="font-mono font-semibold">{c.sintaxe}</span> — em{" "}
            <span className="font-mono">{JSON.stringify(c.exemplo)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Metrica({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{k}</dt>
      <dd className="font-mono font-semibold">{v}</dd>
    </div>
  );
}
