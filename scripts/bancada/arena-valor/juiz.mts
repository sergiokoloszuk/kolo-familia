/**
 * O JUIZ CEGO DA ARENA DE VALOR — 14/09/2026.
 *
 * ⚠️ JUIZ DIFERENTE DO GERADOR, E ISSO NÃO É DETALHE. As respostas saem do
 * `gpt-5.6-luna` (o modelo da conversa em produção); o julgamento sai da
 * Anthropic. Modelo julgando a própria saída premia o próprio estilo, e o que
 * se quer medir aqui é VALOR PARA A FAMÍLIA, não coerência interna do gerador.
 *
 * ⚠️ CEGO DE VERDADE, E A CEGUEIRA É CONFERIDA. As seis respostas do mesmo
 * turno chegam ao juiz embaralhadas, com rótulos R1..R6 sorteados por caso —
 * e o material passa por `limpar()`, que remove o marcador
 * `<neurodesenvolvimento>` e qualquer vestígio das camadas. Sem isso o juiz
 * saberia qual braço tem Pós pela própria forma do texto, e "B deve ser melhor"
 * viraria profecia.
 *
 * ⚠️ O CRITÉRIO CENTRAL É VALOR KOLO 0–3, e o nível 1 existe para ser duro: uma
 * resposta CORRETA que qualquer busca devolveria é nível 1, não 2. A pergunta
 * do nível 3 é a da missão — *"há aqui alguma razão concreta para uma família
 * preferir a Kolo a uma resposta genérica de IA ou a conteúdo gratuito?"*.
 *
 *   cd apps/web && npx tsx ../../scripts/bancada/arena-valor/juiz.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
for (const l of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split(/\r?\n/)) {
  const m = l.match(/^([A-Z_0-9]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const { default: Anthropic } = await import("@anthropic-ai/sdk");
const cliente = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
const MODELO_JUIZ = "claude-sonnet-4-6";

type Geracao = {
  caso: string;
  tipo: string;
  critico: boolean;
  braco: string;
  rodada: number;
  turno: number;
  mensagem: string;
  esperado: string;
  reprova: string;
  fala: string;
};
const GERACOES: Geracao[] = JSON.parse(
  readFileSync(resolve(AQUI, "resultados", "geracoes.json"), "utf8"),
);

/** Remove tudo que denunciaria a camada. A cegueira se garante aqui. */
function limpar(t: string): string {
  return (t ?? "")
    .replace(/<\/?neurodesenvolvimento>/gi, "")
    .replace(/\[[AB]\d+\.\d+\]|\[BP2\.\d\]/g, "")
    .replace(/Boas Pr[áa]ticas?/gi, "material de apoio")
    .trim();
}

const SYSTEM = `Você avalia respostas de uma assistente de IA para famílias de crianças atípicas. Seu trabalho é dizer quais respostas VALEM UMA ASSINATURA e quais são apenas corretas.

Você recebe a mensagem da mãe, o que sabemos da criança, o que se esperava da resposta, e VÁRIAS respostas candidatas anônimas (R1, R2, …). Você NÃO sabe como cada uma foi produzida e não deve especular.

VALOR KOLO — o critério central, 0 a 3:
0 SEM VALOR — errada, perigosa, não responde ao pedido, puro eco do que a mãe disse, ou termina só em "observe / procure um profissional".
1 ÚTIL, MAS COMUM — correta e aplicável, porém genérica. A família acharia o mesmo numa busca. Exemplos de nível 1: "brinque de minha vez/sua vez", "use rotina visual", "elogie o esforço", "faça atividades curtas", higiene do sono padrão.
2 PERSONALIZADO — usa dados REAIS desta criança (o que ela gosta, o que já funciona, o que o perfil diz) e adapta a orientação a eles.
3 ALTO VALOR — além de personalizado: conecta sinais entre si, oferece uma hipótese/mecanismo útil SEM diagnosticar, escolhe uma prioridade, entrega estratégia ou brincadeira concreta ancorada no interesse e na habilidade atual, diz o que observar, e o que fazer se funcionar ou não.

⚠️ SEJA DURO NO 3. A pergunta é: "há aqui alguma razão concreta para uma família preferir isto a uma resposta genérica de IA ou a conteúdo gratuito?". Na dúvida entre 2 e 3, dê 2.
⚠️ RESPOSTA MAIS LONGA NÃO É MELHOR. Mais sugestões não é melhor. Mais termo técnico não é melhor. O que conta é densidade de valor.
⚠️ JARGÃO ACADÊMICO NA FALA COM A MÃE É DEFEITO, não qualidade.

Além do VALOR KOLO, marque para cada resposta:
- primeira_acao: "ASK" (pergunta sem entregar) | "DELIVER" (entrega) | "ASK_DELIVER" (entrega e pergunta) | "SAFETY" (checagem de risco) | "ACKNOWLEDGE" (só acolhe)
- usou_perfil: usou informação específica desta criança? true/false
- perguntou_o_sabido: perguntou algo que o perfil já responde? true/false
- entregou_concreto: há algo executável hoje (brincadeira, estratégia, frase pronta)? true/false
- usou_interesse: usou o interesse/hiperfoco da criança para DESENHAR a atividade (não só citar o nome)? true/false
- obvio: a ideia central é o lugar-comum do tema? true/false
- jargao: usou termo técnico/acadêmico na fala com a mãe? true/false
- seguranca_excessiva: repetiu checagem de risco quando o contexto já avançou? true/false
- mecanismo: explicou uma hipótese útil sem diagnosticar? true/false
- pagaria: uma mãe pagaria por esta resposta? true/false

Devolva APENAS JSON:
{"avaliacoes":[{"rotulo":"R1","valor_kolo":0,"primeira_acao":"DELIVER","usou_perfil":true,"perguntou_o_sabido":false,"entregou_concreto":true,"usou_interesse":false,"obvio":false,"jargao":false,"seguranca_excessiva":false,"mecanismo":true,"pagaria":true,"justificativa":"uma frase"}],"melhor":"R1","pior":"R6","porque_a_melhor":"uma frase"}`;

/** Chaves (caso, rodada, turno) — as 6 respostas de um mesmo momento. */
const grupos = new Map<string, Geracao[]>();
for (const g of GERACOES) {
  const k = `${g.caso}|${g.rodada}|${g.turno}`;
  if (!grupos.has(k)) grupos.set(k, []);
  grupos.get(k)!.push(g);
}

type Aval = Record<string, unknown> & { rotulo: string; valor_kolo: number };
const resultados: Array<Record<string, unknown>> = [];
let n = 0;

for (const [chave, grupo] of grupos) {
  // embaralha por grupo — o rótulo R1 não é sempre o braço A
  const ordem = [...grupo].sort(() => Math.random() - 0.5);
  const rotulos = new Map<string, string>();
  const blocos = ordem.map((g, i) => {
    const r = `R${i + 1}`;
    rotulos.set(r, g.braco);
    return `### ${r}\n${limpar(g.fala)}`;
  });

  const g0 = grupo[0]!;
  const user = [
    `MENSAGEM DA MÃE: ${g0.mensagem}`,
    `O QUE SE ESPERAVA: ${g0.esperado}`,
    g0.reprova ? `REPROVA SE: ${g0.reprova}` : "",
    "",
    ...blocos,
  ]
    .filter(Boolean)
    .join("\n\n");

  let parsed: { avaliacoes?: Aval[]; melhor?: string; pior?: string; porque_a_melhor?: string } = {};
  try {
    const r = await cliente.messages.create({
      model: MODELO_JUIZ,
      max_tokens: 3000,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const b = r.content[0];
    const raw = b?.type === "text" ? b.text : "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (m) parsed = JSON.parse(m[0]);
  } catch (e) {
    console.error(`\nerro em ${chave}:`, e instanceof Error ? e.message.slice(0, 80) : e);
  }

  for (const a of parsed.avaliacoes ?? []) {
    const braco = rotulos.get(a.rotulo);
    if (!braco) continue;
    resultados.push({
      caso: g0.caso,
      tipo: g0.tipo,
      critico: g0.critico,
      rodada: g0.rodada,
      turno: g0.turno,
      braco,
      ...a,
      foi_melhor: parsed.melhor === a.rotulo,
      foi_pior: parsed.pior === a.rotulo,
    });
  }
  n++;
  if (n % 5 === 0) process.stdout.write(`${n}/${grupos.size} `);
}

const arq = resolve(AQUI, "resultados", "julgamentos.json");
writeFileSync(arq, JSON.stringify(resultados, null, 2), "utf8");
console.log(`\n\n${resultados.length} avaliações → ${arq}`);

// ── prova de cegueira: o rótulo R1 não pode ter caído sempre no mesmo braço
const r1 = GERACOES.length ? "ok" : "sem dados";
console.log(`grupos julgados: ${n} de ${grupos.size} · ${r1}`);
