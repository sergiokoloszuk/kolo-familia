import type { SupabaseClient } from "@supabase/supabase-js";
import { membroCampoStorage } from "@/lib/kolo-vivo/campos";
import { parsearSubcampos, serializarSubcampos, subcamposDe } from "@/lib/kolo-vivo/subcampos";

/**
 * QUEM ESCREVE O PERFIL VIVO — PEND-194 Fase 2.
 *
 * ── o que esta peça decide, e o que ela NÃO decide ────────────────────────
 *
 * Ela responde UMA pergunta: neste turno, o dono da escrita do Kolo Vivo é o
 * caminho de sempre (`parseInbound` + `rotearFatoSubcampo`) ou o extrator
 * unificado? E ela devolve o PLANO de escrita do extrator, sem tocar no banco.
 *
 * ⚠️ UM DONO, NUNCA DOIS. A regra do §15 é "um dono para cada decisão", e aqui
 * ela é estrutural: o orquestrador calcula `escritorDoPerfil` UMA vez e os dois
 * caminhos leem a MESMA variável. Não existe estado em que os dois escrevam —
 * não porque alguém se lembrou de checar, mas porque só há uma decisão.
 *
 * O que continua valendo, com a flag ligada ou desligada:
 *
 *   - `ayla_daily_checkins` e `diarios` seguem SEMPRE com o caminho atual.
 *     Esta fase troca o dono do PERFIL, e só dele. Trocar três coisas de uma
 *     vez é como se perde a capacidade de saber qual delas quebrou.
 *   - `parseInbound` continua rodando em todo turno: ele alimenta o check-in e
 *     o diário de qualquer jeito. Por isso a proposta do caminho antigo fica
 *     observável de graça, sem segunda chamada de modelo.
 *   - a resposta à família sai ANTES de tudo isto, como sempre.
 */

/**
 * A FLAG, e por que ela não é um booleano.
 *
 * A Fase 2 nasce restrita à família administrativa e precisa crescer
 * admin → coorte → todas sem trocar de mecanismo a cada passo. Uma variável só
 * cobre o caminho inteiro:
 *
 *   ausente · "" · "0" · "false" · "off"   → NINGUÉM (o default, e o estado em que isto entra no ar)
 *   "1" · "true" · "admin"                 → só famílias administrativas
 *   "todas"                                → todas as famílias
 *   "<uuid>,<uuid>,…"                      → só as famílias listadas
 *
 * ⚠️ `"1"` E `"true"` SIGNIFICAM **ADMIN**, NÃO "TODAS" — e isto é deliberado.
 * O resto do repositório usa `1`/`true` como "ligado", então alguém vai
 * digitar `1` achando que está ligando para o QA. Se `1` valesse "todas", esse
 * dedo trocaria o cérebro que aprende sobre as crianças de TODAS as famílias,
 * de uma vez, sem revisão. Para atingir todas é preciso escrever a palavra
 * `todas`, que ninguém digita por reflexo.
 */
export type AlvoDaEscrita =
  | { tipo: "ninguem" }
  | { tipo: "admin" }
  | { tipo: "todas" }
  | { tipo: "lista"; familias: readonly string[] };

export function alvoDaEscritaDoExtrator(): AlvoDaEscrita {
  let bruto = "";
  try {
    bruto = (process.env.KOLO_EXTRATOR_ESCRITA ?? "").trim().toLowerCase();
  } catch {
    return { tipo: "ninguem" };
  }
  if (!bruto || bruto === "0" || bruto === "false" || bruto === "off") {
    return { tipo: "ninguem" };
  }
  if (bruto === "1" || bruto === "true" || bruto === "admin") return { tipo: "admin" };
  if (bruto === "todas") return { tipo: "todas" };

  const familias = bruto
    .split(",")
    .map((s) => s.trim())
    .filter((s) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(s));
  // ⚠️ FAIL-CLOSED: valor que não é nenhuma das palavras conhecidas e não
  // contém UUID nenhum NÃO liga nada. Um typo não pode virar rollout.
  return familias.length > 0 ? { tipo: "lista", familias } : { tipo: "ninguem" };
}

export type Escritor = "atual" | "extrator_unificado";

/**
 * O dono da escrita do Perfil Vivo neste turno.
 *
 * ⚠️ LÊ ADMIN DO BANCO, não da sessão — o mesmo padrão de
 * `familia/limite-criancas.ts`, e pelo mesmo motivo: a resposta tem de valer
 * para qualquer chamador, inclusive um webhook com service role, que é
 * justamente o caso do WhatsApp. A função de lá **não** foi reusada porque ela
 * responde "esta família pode criar mais uma criança?" e carrega a isenção do
 * limite; o que se quer aqui é só "esta família é administrativa?". Reusar o
 * padrão, não a função — §4.
 */
export async function escritorDoPerfil(
  supabase: SupabaseClient,
  familyId: string,
): Promise<Escritor> {
  const alvo = alvoDaEscritaDoExtrator();
  if (alvo.tipo === "ninguem") return "atual";
  if (alvo.tipo === "todas") return "extrator_unificado";
  if (alvo.tipo === "lista") {
    return alvo.familias.includes(familyId) ? "extrator_unificado" : "atual";
  }

  // tipo === "admin"
  try {
    const { data: fam } = await supabase
      .from("family_accounts")
      .select("user_id")
      .eq("id", familyId)
      .maybeSingle();
    const userId = (fam?.user_id as string | null) ?? null;
    if (!userId) return "atual";
    const { data: acesso } = await supabase
      .from("controle_acessos")
      .select("ativo")
      .eq("user_id", userId)
      .maybeSingle();
    return acesso?.ativo === true ? "extrator_unificado" : "atual";
  } catch {
    // ⚠️ FALHA NA CONSULTA NÃO PROMOVE NINGUÉM. Sem saber se a família é
    // admin, o dono continua sendo quem já era — o caminho conhecido.
    return "atual";
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export type FatoParaEscrever = {
  campo: string;
  subcampo: string | null;
  texto: string;
  operacao: "adicionar" | "reescrever";
};

export type EscritaPlanejada = {
  campo: string;
  texto: string;
  operacao: "adicionar" | "reescrever";
  /** Sub-campos efetivamente preenchidos nesta escrita. */
  subcampos: string[];
  /** Quantos destes caíram no balde de sobra do domínio. */
  noBaldeDeSobra: number;
};

export type FatoIgnorado = { campo: string; subcampo: string | null; motivo: string };

/**
 * O PLANO DE ESCRITA — função pura, e é de propósito.
 *
 * ⚠️ POR QUE AGRUPAR POR DOMÍNIO É REQUISITO, NÃO ESTILO. O extrator devolve N
 * fatos, e vários caem no mesmo domínio (na bancada do Bento, `nutricional`
 * recebeu três de uma vez: seletividade, aceita e rejeita). Escrever fato por
 * fato seria ler-modificar-gravar três vezes na MESMA linha: a segunda leitura
 * acontece antes da primeira gravação estar visível, e duas das três
 * atualizações se perdem. É o padrão que o §8 chama de rajada — e aqui a rajada
 * é a do próprio turno, sem concorrência externa nenhuma.
 *
 * Então: UMA escrita por domínio, com todos os sub-campos daquele domínio já
 * integrados ao texto que já existia.
 *
 * Recebe o texto ATUAL de cada domínio (a fotografia de antes) e devolve o
 * texto novo. Não consulta, não escreve, não chama modelo — o que a torna
 * testável caso a caso, sem banco.
 */
export function planejarEscritaDeFatos(
  fatos: readonly FatoParaEscrever[],
  textoAtualPorCampo: Readonly<Record<string, string>>,
): { escritas: EscritaPlanejada[]; ignorados: FatoIgnorado[] } {
  const ignorados: FatoIgnorado[] = [];
  // `Map` preserva a ordem de chegada: o domínio que apareceu primeiro na
  // proposta é o primeiro a ser escrito, o que deixa o log legível.
  const porCampo = new Map<string, FatoParaEscrever[]>();

  for (const f of fatos) {
    const texto = (f.texto ?? "").trim();
    if (!texto) {
      ignorados.push({ campo: f.campo, subcampo: f.subcampo, motivo: "texto_vazio" });
      continue;
    }
    if (membroCampoStorage(f.campo) === null) {
      // Mesmo destino que o caminho atual dá: fica de fora do perfil. A linha
      // de auditoria em `sugestao_perfil_vivos` é quem registra o pendente.
      ignorados.push({ campo: f.campo, subcampo: f.subcampo, motivo: "campo_desconhecido" });
      continue;
    }
    const lista = porCampo.get(f.campo);
    if (lista) lista.push({ ...f, texto });
    else porCampo.set(f.campo, [{ ...f, texto }]);
  }

  const escritas: EscritaPlanejada[] = [];

  for (const [campo, lista] of porCampo) {
    const subs = subcamposDe(campo);
    const textoAtual = (textoAtualPorCampo[campo] ?? "").trim();

    if (subs) {
      const valores = parsearSubcampos(subs, textoAtual);
      const tocados: string[] = [];
      let noBalde = 0;
      const ultimo = subs[subs.length - 1].key;

      for (const f of lista) {
        // Sub-campo declarado que não existe no domínio: não se inventa lugar.
        if (f.subcampo && !subs.some((s) => s.key === f.subcampo)) {
          ignorados.push({ campo, subcampo: f.subcampo, motivo: "subcampo_inexistente" });
          continue;
        }
        // Sem sub-campo declarado, cai no último — a MESMA regra que
        // `ehBaldeDeSobra` usa para medir. As duas contas têm de concordar.
        const destino = f.subcampo ?? ultimo;
        if (destino === ultimo) noBalde++;
        valores[destino] = f.texto;
        if (!tocados.includes(destino)) tocados.push(destino);
      }

      if (tocados.length === 0) continue;
      escritas.push({
        campo,
        // Domínio com sub-campos é sempre serializado inteiro: o texto novo já
        // contém o que existia antes mais o que chegou agora.
        texto: serializarSubcampos(subs, valores),
        operacao: "reescrever",
        subcampos: tocados,
        noBaldeDeSobra: noBalde,
      });
      continue;
    }

    // ── domínio de texto livre ────────────────────────────────────────────
    //
    // Aqui quem integra velho + novo é `aplicarSugestaoNoMembro`, que já tem a
    // regra de append e o `detectarMarcos`. Vários fatos do mesmo domínio
    // viram um texto só, para que a integração aconteça UMA vez.
    const temReescrever = lista.some((f) => f.operacao === "reescrever");
    const texto = temReescrever
      ? // "reescrever" traz o texto completo da seção: vale o último, que é o
        // mais integrado. Empilhar reescritas produziria texto duplicado.
        lista.filter((f) => f.operacao === "reescrever").at(-1)!.texto
      : lista.map((f) => f.texto).join(" ");
    escritas.push({
      campo,
      texto,
      operacao: temReescrever ? "reescrever" : "adicionar",
      subcampos: [],
      noBaldeDeSobra: 0,
    });
  }

  return { escritas, ignorados };
}
