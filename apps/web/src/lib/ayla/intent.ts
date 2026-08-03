import { getAylaAnthropicClient, AYLA_MODEL } from "./anthropic";
import { CHAVES_TEMA } from "@/lib/conducao/temas";

/**
 * Classificador do TURNO da Ayla — o que a mãe/pai quer (intenção) e sobre o
 * que se está falando (tema), em vez de casar palavras-chave (que sempre vaza:
 * "vamos desenhar a rotina" ou "queria organizar os dias dele" escapavam do
 * regex). Roda no modelo leve (Haiku).
 *
 * O TEMA entrou aqui em 02/08/2026 e NÃO custou chamada nova: esta chamada já
 * acontecia a cada mensagem. O que ela devolvia era uma palavra; agora devolve
 * duas. É todo o "tema ativo" — sem tabela, sem coluna, sem migração.
 *
 * Usado como sinal PRIMÁRIO no roteamento do orchestrator; os `pede*` de regex
 * ficam como reforço (OR). Em falha, devolve "outro" e o regex decide.
 */

/** O que o turno é (intenção) E sobre o que ele é (tema). */
export type TurnoClassificado = { intencao: IntencaoAyla; tema: string | null };

export type IntencaoAyla =
  | "rotina_criar" // montar/criar/desenhar/organizar uma rotina visual
  | "rotina_ver" // ver/trazer uma rotina já existente de um dia
  | "rotina_editar" // ajustar uma rotina existente
  | "plano" // ajuda/estratégia/plano pra um desafio específico
  | "outro"; // desabafo, contar o dia, dúvida, cumprimento, história, desenho

const SYSTEM = `Você classifica a INTENÇÃO da última mensagem de uma mãe/pai falando com a Ayla (assistente de famílias atípicas), no WhatsApp. Entenda a INTENÇÃO, não palavras exatas.

Responda em UMA linha, minúscula, no formato: intencao|tema

A INTENÇÃO é uma destas:
- rotina_criar: quer MONTAR / criar / desenhar / organizar uma rotina visual (de um dia ou da semana). Ex.: "quero uma rotina", "vamos desenhar a rotina do Davi", "me ajuda a organizar melhor os dias dele", "preciso de rotina visual", "poderia montar um quadro pra ele?".
- rotina_ver: quer VER / que você TRAGA uma rotina JÁ montada de um dia. Ex.: "traz a rotina de hoje", "mostra a de terça", "me manda a rotina de amanhã".
- rotina_editar: está PEDINDO pra você ajustar uma rotina que ela já montou. Ex.: "faltou o lanche na terça", "tira o vôlei da quarta", "muda a rotina de hoje".
- plano: quer ajuda / estratégia / um plano pra um DESAFIO específico (sono, birra, escola, transição, comida, crise...). Ex.: "me ajuda com o sono dele", "ele não quer ir à escola", "o que faço nas crises?", "a hora do banho tá impossível".
- outro: qualquer outra coisa — contar como foi o dia, desabafo, dúvida geral, cumprimento, pedir história ou leitura de desenho.

Regras importantes:
- "a rotina dele tá difícil / bagunçada" NÃO é rotina_criar — é desabafo/pedido de ajuda (plano ou outro). rotina_criar é quando ela quer CONSTRUIR o quadro.
- CONTAR o que aconteceu NÃO é pedido, mesmo com verbos de mudança. "tive que chamar alguém pra arrumar o vazamento", "mudei o quarto dele", "tirei ele da natação", "hoje já está melhor" = outro. rotina_editar só quando ela pede que VOCÊ mude o quadro de rotina dela.
- Rotina aqui é só o QUADRO VISUAL de etapas. Falar da rotina da casa, do trabalho, da vida = outro.
- Na dúvida entre uma intenção de rotina e outro, escolha outro: mexer na rotina dela sem ela pedir é pior do que deixar de mexer.
- Na dúvida entre plano e outro, escolha outro.
- RESPOSTA A UMA PERGUNTA NÃO É PEDIDO. Se a Ayla acabou de perguntar algo e a mensagem é curta ("sim", "não", "às vezes", "depois que ele já fez", "na escola", "ele grita"), ela está RESPONDENDO — a intenção é "outro", sempre. Uma mensagem sem verbo de pedido não abre ferramenta nenhuma. Caso real (02/08/2026): a Ayla perguntou "ele já fez xixi quando pega a fralda?", a mãe respondeu "Depois q ele já fez", e isso virou rotina_editar — no meio de uma conversa sobre desfralde ela recebeu "não achei uma rotina pra ajustar".
- Os TEMAS listados no contexto (o que a família marcou no cadastro) servem SÓ para escolher o tema. Eles NUNCA indicam intenção: ver a palavra "rotina" na lista de temas não significa que ela está pedindo uma rotina agora.
- Responda SÓ a linha.

O TEMA é o assunto do desenvolvimento sobre o qual se está falando. Use EXATAMENTE uma destas chaves, ou "-" se nenhuma servir:
${CHAVES_TEMA.join(", ")}

Regras do tema — errar aqui faz a Ayla perder o fio da conversa:
- CONTINUIDADE MANDA. Se a mensagem segue o mesmo assunto, ou é curta/ambígua ("sim", "e aí?", "não deu certo", "e de manhã?"), REPITA o tema anterior. Não recomece.
- Só troque quando ela REALMENTE abrir outro assunto do desenvolvimento.
- Se ela acabou de ESCOLHER um tema (você ofereceu os desafios dela e ela respondeu "alimentação", "o sono", "vamos pelo foco"), esse é o tema.
- Assunto que não é do desenvolvimento (preço, acesso ao app, saudação, o dia dela) → "-"; mas se havia tema anterior e isso foi só uma pausa, mantenha o anterior.
- Nunca invente chave fora da lista.`;

export async function classificarIntencao(params: {
  texto: string;
  /** Última fala da Ayla, se houver — ajuda a entender respostas curtas. */
  ultimaAyla?: string | null;
  /** Fala anterior da mãe — dá o fio quando a mensagem de agora é curta. */
  ultimaMae?: string | null;
  /** Tema do turno anterior. É o que impede o classificador de recomeçar. */
  temaAnterior?: string | null;
  /** O que a família marcou no cadastro — o tema costuma nascer daqui. */
  temasOnboarding?: string[];
}): Promise<TurnoClassificado> {
  const texto = (params.texto ?? "").trim();
  const anterior = params.temaAnterior ?? null;
  // Sem texto não há o que classificar — mas o tema não se perde por isso.
  if (!texto) return { intencao: "outro", tema: anterior };
  try {
    const user = [
      // ⚠️ Rotulado com força de propósito. Sem o rótulo, esta linha derrubava
      // a classificação: com os 6 desafios de uma família real no prompt, a
      // mensagem "Depois q ele já fez" era classificada como ferramenta em 13
      // de 20 execuções (plano 11x, rotina_editar 1x, rotina_ver 1x). Ver a
      // palavra "rotina" na lista bastava para o modelo achar que a mãe pedia
      // uma rotina. Com o rótulo, a lista volta a servir só ao tema.
      params.temasOnboarding?.length
        ? `(TEMAS que a família marcou no cadastro — servem SÓ pra escolher o tema, NUNCA indicam que ela está pedindo algo agora: ${params.temasOnboarding.join(", ")})`
        : "",
      anterior
        ? `(Tema do turno anterior: ${anterior} — mantenha se a conversa continuar nele)`
        : "",
      params.ultimaMae ? `(Antes ela tinha dito: "${params.ultimaMae.slice(0, 220)}")` : "",
      params.ultimaAyla ? `(A Ayla acabou de dizer: "${params.ultimaAyla.slice(0, 220)}")` : "",
      `Mensagem da mãe/pai: "${texto.slice(0, 500)}"`,
      "Resposta:",
    ]
      .filter(Boolean)
      .join("\n");

    const client = getAylaAnthropicClient();
    const resp = await client.messages.create({
      model: AYLA_MODEL,
      max_tokens: 24,
      system: SYSTEM,
      messages: [{ role: "user", content: user }],
    });
    const b = resp.content[0];
    const raw = (b?.type === "text" ? b.text : "").toLowerCase();

    const [ladoIntencao, ladoTema] = raw.split("|");
    const i = ladoIntencao ?? raw;

    // Ordem importa: checar os específicos antes de "rotina" solto.
    const intencao: IntencaoAyla = i.includes("rotina_criar")
      ? "rotina_criar"
      : i.includes("rotina_ver")
        ? "rotina_ver"
        : i.includes("rotina_editar")
          ? "rotina_editar"
          : i.includes("plano")
            ? "plano"
            : "outro";

    // Só aceita chave do vocabulário. Fora da lista = como se não tivesse dito
    // nada, e aí o tema anterior continua valendo: perder o fio é pior do que
    // ficar um turno com o tema levemente atrasado.
    const candidata = (ladoTema ?? "").trim().replace(/[^a-z_]/g, "");
    const tema = CHAVES_TEMA.includes(candidata) ? candidata : anterior;

    return { intencao, tema };
  } catch (e) {
    console.warn("[ayla:intent] classificação falhou:", e instanceof Error ? e.message : e);
    // Fallback seguro: o regex/reativo decide a intenção, e o tema não se perde.
    return { intencao: "outro", tema: anterior };
  }
}
