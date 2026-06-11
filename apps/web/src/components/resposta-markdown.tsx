import { Fragment, type ReactNode } from "react";
import { MARCADOR_PLANO } from "@/lib/ia/marcadores";

/**
 * Renderizador de markdown leve e on-brand para as respostas das skills.
 *
 * Cobre o subconjunto que o modelo emite (template de partes + "markdown
 * leve"): parágrafos, **negrito**, *itálico*, `código`, títulos (#..),
 * listas (-, *, •, 1.), citações (>) e divisores (---).
 *
 * Constrói nós React (nunca dangerouslySetInnerHTML) — seguro por
 * construção, sem risco de XSS.
 */

const RE_DIVISOR = /^(-{3,}|\*{3,}|_{3,})$/;
const RE_TITULO = /^(#{1,6})\s+(.*)$/;
const RE_CITACAO = /^>\s?/;
const RE_BULLET = /^([-*•])\s+/;
const RE_ORDENADA = /^\d+\.\s+/;

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index));
    if (m[2] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-b-${i}`} className="font-semibold text-foreground">
          {m[2]}
        </strong>,
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <em key={`${keyPrefix}-i-${i}`} className="italic text-foreground/90">
          {m[3]}
        </em>,
      );
    } else if (m[4] !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-c-${i}`}
          className="rounded bg-kolo-lilas-bg-2 px-1.5 py-0.5 font-mono text-[0.85em] text-brand-purple-dark"
        >
          {m[4]}
        </code>,
      );
    }
    lastIndex = m.index + m[0].length;
    i++;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

export function RespostaMarkdown({
  texto,
  className,
}: {
  texto: string;
  className?: string;
}) {
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < linhas.length) {
    const bruto = linhas[i];
    const t = bruto.trim();

    if (t === "") {
      i++;
      continue;
    }

    if (RE_DIVISOR.test(t)) {
      blocks.push(<hr key={key++} className="border-foreground/10" />);
      i++;
      continue;
    }

    const tituloMatch = t.match(RE_TITULO);
    if (tituloMatch) {
      const nivel = tituloMatch[1].length;
      const conteudo = renderInline(tituloMatch[2], `h-${key}`);
      blocks.push(
        nivel <= 2 ? (
          <h3 key={key++} className="font-heading text-lg font-semibold text-foreground">
            {conteudo}
          </h3>
        ) : (
          <h4 key={key++} className="text-sm font-bold uppercase tracking-[0.08em] text-muted-foreground">
            {conteudo}
          </h4>
        ),
      );
      i++;
      continue;
    }

    if (RE_CITACAO.test(t)) {
      const linhasCitacao: string[] = [];
      while (i < linhas.length && RE_CITACAO.test(linhas[i].trim())) {
        linhasCitacao.push(linhas[i].trim().replace(RE_CITACAO, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key++}
          className="border-l-2 border-brand-yellow pl-4 text-foreground/80"
        >
          {linhasCitacao.map((q, qi) => (
            <p key={qi} className="leading-relaxed">
              {renderInline(q, `bq-${key}-${qi}`)}
            </p>
          ))}
        </blockquote>,
      );
      continue;
    }

    if (RE_BULLET.test(t)) {
      const itens: string[] = [];
      while (i < linhas.length && RE_BULLET.test(linhas[i].trim())) {
        itens.push(linhas[i].trim().replace(RE_BULLET, ""));
        i++;
      }
      blocks.push(
        <ul key={key++} className="flex flex-col gap-1.5">
          {itens.map((it, ii) => (
            <li key={ii} className="flex gap-2.5 leading-relaxed">
              <span
                aria-hidden
                className="mt-[0.55em] size-1.5 shrink-0 rounded-full bg-brand-purple/50"
              />
              <span className="flex-1">{renderInline(it, `ul-${key}-${ii}`)}</span>
            </li>
          ))}
        </ul>,
      );
      continue;
    }

    if (RE_ORDENADA.test(t)) {
      const itens: string[] = [];
      while (i < linhas.length && RE_ORDENADA.test(linhas[i].trim())) {
        itens.push(linhas[i].trim().replace(RE_ORDENADA, ""));
        i++;
      }
      blocks.push(
        <ol key={key++} className="flex flex-col gap-1.5">
          {itens.map((it, ii) => (
            <li key={ii} className="flex gap-2.5 leading-relaxed">
              <span aria-hidden className="shrink-0 font-semibold text-brand-purple">
                {ii + 1}.
              </span>
              <span className="flex-1">{renderInline(it, `ol-${key}-${ii}`)}</span>
            </li>
          ))}
        </ol>,
      );
      continue;
    }

    // Parágrafo — junta linhas consecutivas até um separador de bloco.
    const para: string[] = [];
    while (i < linhas.length) {
      const l = linhas[i].trim();
      if (
        l === "" ||
        RE_DIVISOR.test(l) ||
        RE_TITULO.test(l) ||
        RE_CITACAO.test(l) ||
        RE_BULLET.test(l) ||
        RE_ORDENADA.test(l)
      ) {
        break;
      }
      para.push(l);
      i++;
    }
    blocks.push(
      <p key={key++} className="leading-relaxed text-foreground">
        {para.map((p, pi) => (
          <Fragment key={pi}>
            {pi > 0 && <br />}
            {renderInline(p, `p-${key}-${pi}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className={className ?? "flex flex-col gap-3 text-base"}>{blocks}</div>;
}

/**
 * Remove o bloco legacy "registrar este papo" do texto salvo — virou
 * botões reais na interface. Tira também um divisor/linhas em branco
 * imediatamente antes do marcador.
 */
export function limparRespostaKolo(texto: string): string {
  // Remove o marcador de "ofereceu plano" (a interface usa a presença dele,
  // não deve aparecer no texto).
  texto = texto.split(MARCADOR_PLANO).join("").trimEnd();
  const linhas = texto.replace(/\r\n/g, "\n").split("\n");
  const markerIdx = linhas.findIndex((l) => /registrar este papo/i.test(l));
  if (markerIdx === -1) return texto;
  let end = markerIdx;
  while (
    end > 0 &&
    (linhas[end - 1].trim() === "" || RE_DIVISOR.test(linhas[end - 1].trim()))
  ) {
    end--;
  }
  return linhas.slice(0, end).join("\n").trimEnd();
}
