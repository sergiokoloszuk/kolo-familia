/**
 * DETECTOR DE PROMESSA FORA DO CATÁLOGO — a resposta está oferecendo um artefato
 * que o sistema não sabe entregar?
 *
 * Irmão dos detectores de diagnóstico e clínico, mesma forma: regex sobre o
 * texto asseverado, `escopo.ts` cuidando de citação/metalinguagem/personagem.
 *
 * POR QUE EXISTE. O prompt já proibia inventar documento, com todas as letras
 * ("nunca prometa 'panorama', 'dossiê', 'documento'… nem 'vou montar e te
 * mando'"), e em 06/08/2026 a Ayla prometeu uma carteirinha de direitos que não
 * existe em uma linha sequer do produto — e a mãe esperou, mandou o laudo,
 * mandou foto do remédio e cobrou duas vezes. Proibição genérica compete com a
 * instrução de ser prestativa e perde. A rede não perde.
 *
 * ⚠️ O QUE ELE DELIBERADAMENTE NÃO BARRA — e é a metade que importa:
 *
 *   "Posso te passar algumas atividades aqui na conversa."     PASSA
 *   "Posso organizar contigo os pontos pra levar na escola."   PASSA
 *   "A carteirinha do TEA é emitida pela prefeitura."          PASSA
 *
 * Ajudar com o CONTEÚDO é o produto. O dano não é falar de carteirinha — é
 * dizer que VOCÊ vai montar uma. Por isso a regra exige as duas coisas juntas:
 * um verbo de CRIAR/ENTREGAR na primeira pessoa E um artefato que este canal
 * não entrega. Uma sozinha nunca dispara.
 */

import { acharPadroes, textoAsseverado, type Padrao } from "./escopo";
import type { AchadoDiagnostico } from "./deteccao-diagnostico";
import {
  ARTEFATOS,
  ARTEFATOS_FUTUROS,
  ARTEFATOS_PROIBIDOS,
  type Canal,
} from "./catalogo";

/**
 * PROMESSA NA PRIMEIRA PESSOA. "vou montar", "posso gerar", "já estou
 * preparando", "te mando", "deixa que eu faço".
 *
 * `posso` entra porque "posso montar sua carteirinha?" é uma promessa
 * disfarçada de pergunta — a mãe responde "pode" e passa a esperar. Mas note
 * que `posso` só vira achado quando o OBJETO é um artefato indisponível: com
 * objeto permitido ("posso te passar atividades aqui"), nada dispara.
 */
const VERBO_DE_ENTREGA =
  "(vou|posso|consigo|deixa (que )?eu|ja (estou|vou)|estou)\\s+" +
  "(te )?(montar|montando|gerar|gerando|criar|criando|fazer|fazendo|preparar|preparando|" +
  "emitir|emitindo|elaborar|elaborando|mandar|mandando|enviar|enviando|produzir|escrever)";

/** Entrega anunciada sem verbo na primeira pessoa: "já está saindo", "segue em PDF". */
const ENTREGA_ANUNCIADA =
  "(ja (esta|vai) (saindo|indo)|esta (quase )?pront[oa]|sai (logo|ja|em seguida)|" +
  "vai sair|segue (em|no) (pdf|anexo)|te (mando|envio) (em|no) (pdf|anexo)|em anexo)";

const ARQUIVO = "(pdf|arquivo|documento|anexo|imagem|foto|card|cartao|carteirinha|modelo impresso)";

function alternativas(nomes: string[]): string {
  return nomes
    .map((n) =>
      n
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "\\s+"),
    )
    .join("|");
}

/**
 * Os artefatos que ESTE canal não entrega: os proibidos sempre, os futuros
 * enquanto desligados, e os que existem mas são feitos no app (história,
 * relatório) — prometer montar esses é tão falso quanto os outros.
 */
function indisponiveis(canal: Canal): string[] {
  const nomes: string[] = [];
  for (const p of ARTEFATOS_PROIBIDOS) nomes.push(...p.nomes);
  for (const f of ARTEFATOS_FUTUROS) if (!f.gera[canal]) nomes.push(...f.nomes);
  for (const a of ARTEFATOS) if (!a.gera[canal]) nomes.push(...a.nomes);
  return nomes;
}

function padroes(canal: Canal): Padrao[] {
  const fora = alternativas(indisponiveis(canal));
  const proibidos = alternativas(ARTEFATOS_PROIBIDOS.flatMap((p) => p.nomes));

  const lista: Padrao[] = [
    // Promessa de montar/enviar algo que este canal não entrega.
    [
      "promete_artefato_indisponivel",
      new RegExp(`\\b${VERBO_DE_ENTREGA}\\b[^.!?]{0,40}\\b(${fora})\\b`),
    ],
    // "sua carteirinha já está saindo" — entrega anunciada, sem verbo próprio.
    [
      "anuncia_entrega_indisponivel",
      new RegExp(`\\b(${fora})\\b[^.!?]{0,40}\\b${ENTREGA_ANUNCIADA}\\b`),
    ],
    [
      "anuncia_entrega_indisponivel",
      new RegExp(`\\b${ENTREGA_ANUNCIADA}\\b[^.!?]{0,40}\\b(${fora})\\b`),
    ],
    // Documento com efeito legal/clínico: o verbo nem precisa ser de entrega,
    // basta a Ayla se colocar como quem emite.
    [
      "promete_documento_proibido",
      new RegExp(`\\b(eu )?(emito|faço|faco|assino|forneço|forneco|preencho)\\b[^.!?]{0,25}\\b(${proibidos})\\b`),
    ],
  ];

  if (canal === "whatsapp") {
    // Imagem não é artefato gerável no WhatsApp — os cartões saem do app ou do
    // PDF da rotina.
    lista.push([
      "promete_imagem_no_whatsapp",
      new RegExp(`\\b${VERBO_DE_ENTREGA}\\b[^.!?]{0,30}\\b(imagem|figura|desenho|ilustracao|card)\\b`),
    ]);
  }

  // Promessa de arquivo SEM nomear artefato nenhum ("te mando o PDF disso").
  // Fica por último: é a rede mais larga, e a mais sujeita a falso positivo.
  lista.push([
    "promete_arquivo_generico",
    new RegExp(`\\b${VERBO_DE_ENTREGA}\\b[^.!?]{0,20}\\b(o|a|um|uma|esse|essa|isso em)\\s+${ARQUIVO}\\b`),
  ]);

  return lista;
}

/**
 * O canal é obrigatório: o mesmo texto é promessa falsa no WhatsApp e verdade
 * na web (história e relatório são feitos no app). Um detector sem canal
 * escolheria entre proibir demais e proibir de menos.
 */
export function acharPromessaForaDoCatalogo(
  texto: string,
  canal: Canal,
): AchadoDiagnostico[] {
  return acharPadroes(texto, padroes(canal), {});
}

/** Atalho booleano. */
export function prometeForaDoCatalogo(texto: string, canal: Canal): boolean {
  return acharPromessaForaDoCatalogo(texto, canal).length > 0;
}

/** Só pra manter a simetria com os outros detectores (usa o mesmo helper). */
export const _textoAsseverado = textoAsseverado;
