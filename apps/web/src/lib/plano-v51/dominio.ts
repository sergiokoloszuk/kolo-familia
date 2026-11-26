/** Estado da experiência Web. Não é outra memória: sem I/O ou persistência implícita.
 * Um adaptador de persistência deverá confirmar seus eventos antes de dizer "salvo". */
export const ETAPAS = ["Entender", "Descobrir", "Combinar", "Experimentar", "Evoluir"] as const;
export const PASSOS = [
  { id: "saber", etapa: 0, nome: "O que já sabemos" },
  { id: "perguntas", etapa: 0, nome: "Perguntas que mudam o caminho" },
  { id: "voce", etapa: 0, nome: "Como você está" },
  { id: "olharCrianca", etapa: 1, nome: "Olhares sobre a criança" },
  { id: "olharAdulto", etapa: 1, nome: "Olhares sobre você" },
  { id: "funciona", etapa: 1, nome: "O que já funciona" },
  { id: "confere", etapa: 1, nome: "Confere comigo" },
  { id: "objetivo", etapa: 2, nome: "Objetivo" },
  { id: "caminhos", etapa: 2, nome: "Caminhos" },
  { id: "conversar", etapa: 2, nome: "Jeitos de conversar" },
  { id: "combinado", etapa: 2, nome: "Combinado" },
  { id: "lembretes", etapa: 2, nome: "Lembretes" },
  { id: "experimentar", etapa: 3, nome: "Experimentar" },
  { id: "evoluir", etapa: 4, nome: "Evoluir" },
] as const;
export type Passo = typeof PASSOS[number]["id"];
export type EstadoEstrategia = "proposto" | "escolhido" | "tentado" | "resultado_observado" | "conquista_confirmada";
export type Origem = "web" | "whatsapp";
export type Cadastro = { texto: string; origem: string; atualizadoEm?: string };
export type MembroPlano = { id: string; nome: string; cadastro: Cadastro[] };
export type Pergunta = { id: string; texto: string; opcoes: string[]; respondidaNoContexto?: boolean };
export type Olhar = {
  id: string; titulo: string; sobre: "crianca" | "adulto";
  origem: { tipo: "relato_hoje" | "cadastro"; frase: string };
  blocos: { titulo: string; texto: string }[];
};
export type Estrategia = { id: string; titulo: string; porque: string; como: string[]; minima: string };
export type ConteudoPlano = {
  perguntas: Pergunta[]; olhares: Olhar[]; objetivo: string;
  estrategias: Estrategia[]; dizer: { momento: string; frase: string; detalhe: string }[];
  evitar: { frase: string; porque: string }[]; observar: string[];
};
export type Resultado = "ajudou" | "parcial" | "nao_mudou" | "incerto";
export type Registro = {
  id: string; em: string; origem: Origem; tipo: "tentativa" | "sem_tentativa";
  estrategiaId: string; relato: string; resultado?: Resultado; aprendizado?: string;
  conquista?: { melhoria: string; confirmadaEm: string };
};
export type Cuidado = { risco: "agora" | "as_vezes" | "nao_mais" | "incerto"; frase: string; emAberto: boolean };
export type PlanoV51 = {
  id: string; familyId: string; membroId: string; titulo: string; relatoHoje: string;
  conteudo: ConteudoPlano; criadoEm: string; revisao: number; passo: number; alcance: number;
  respostas: Record<string, string>; sentimento: string; bateria: string;
  funciona: string; objetivo: string; confirmado: boolean;
  estrategiaId: string | null; depois: string[]; frases: number[];
  estados: Record<string, EstadoEstrategia>;
  combinado: { quando: string; frequencia: string; quem: string; voltarEm: string; confirmadoEm?: string };
  lembretes: { autorizado: boolean; canal?: string; frequencia?: string; horario?: string };
  situacao: "ativo" | "pausado" | "encerrado";
  registros: Registro[]; feedback?: { nota: number; comentario: string; em: string };
  cuidado?: Cuidado; eventos: { id: string; tipo: string; em: string }[];
};
export type AcaoPlano =
  | { tipo: "navegar"; passo: number }
  | { tipo: "avancar" }
  | { tipo: "responder"; perguntaId: string; resposta: string }
  | { tipo: "contexto"; campo: "sentimento" | "bateria" | "funciona" | "objetivo"; valor: string }
  | { tipo: "escolher"; estrategiaId: string }
  | { tipo: "depois"; estrategiaId: string }
  | { tipo: "frase"; indice: number }
  | { tipo: "combinado"; campo: "quando" | "frequencia" | "quem" | "voltarEm"; valor: string }
  | { tipo: "confirmar" }
  | { tipo: "lembrete"; canal: string; frequencia: string; horario: string; disponivel: boolean }
  | { tipo: "desligar_lembrete" }
  | { tipo: "pausar" | "encerrar" | "retomar" }
  | { tipo: "registrar"; registro: Omit<Registro, "em" | "conquista"> }
  | { tipo: "conquista"; registroId: string; melhoria: string; confirma: boolean }
  | { tipo: "feedback"; nota: number; comentario: string }
  | { tipo: "cuidado"; cuidado: Cuidado };

export function criarPlanoV51(p: {
  id: string; familyId: string; membro: MembroPlano; titulo: string; relato: string;
  conteudo: ConteudoPlano; agora: string;
}): PlanoV51 {
  if (!p.id || !p.familyId || !p.membro.id || !p.titulo.trim() || !p.relato.trim()) throw new Error("Falta identificar o plano e seu relato.");
  // Uma hipótese só entra se a frase de origem realmente estiver disponível.
  for (const olhar of p.conteudo.olhares) {
    const frase = olhar.origem.frase.trim();
    const fontes = olhar.origem.tipo === "relato_hoje" ? [p.relato] : p.membro.cadastro.map(c => c.texto);
    if (!frase || !fontes.some(f => f.includes(frase))) throw new Error("Hipótese sem frase de origem verificável.");
  }
  if (new Set(p.conteudo.estrategias.map(e => e.id)).size !== p.conteudo.estrategias.length) throw new Error("Estratégias com identidade repetida.");
  return {
    id: p.id, familyId: p.familyId, membroId: p.membro.id, titulo: p.titulo.trim(), relatoHoje: p.relato,
    conteudo: p.conteudo, criadoEm: p.agora, revisao: 0, passo: 0, alcance: 0, respostas: {},
    sentimento: "", bateria: "", funciona: "", objetivo: p.conteudo.objetivo,
    confirmado: false, estrategiaId: null, depois: [], frases: [],
    estados: Object.fromEntries(p.conteudo.estrategias.map(e => [e.id, "proposto"])),
    combinado: { quando: "", frequencia: "", quem: "", voltarEm: dataLocal(p.agora, 7) },
    lembretes: { autorizado: false }, situacao: "ativo", registros: [], eventos: [],
  };
}

export function perguntasPendentes(p: PlanoV51): Pergunta[] {
  return p.conteudo.perguntas.filter(q => !q.respondidaNoContexto && !p.respostas[q.id]);
}
export function etapaConcluida(p: PlanoV51, etapa: number): boolean {
  const tipos = p.eventos.map(e => e.tipo);
  if (etapa === 0) return tipos.includes("entendimento_confirmado");
  if (etapa === 1) return tipos.includes("compreensao_confirmada");
  if (etapa === 2) return p.confirmado;
  if (etapa === 3) return p.registros.some(r => r.tipo === "tentativa" && r.resultado !== undefined);
  return tipos.includes("encerrar");
}
export function dataLocal(iso: string, dias = 0): string {
  // Meio-dia local evita que uma data sem hora seja deslocada pelo fuso.
  const d = new Date(iso); d.setDate(d.getDate() + dias);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function diaPlano(p: PlanoV51, agora: string): number {
  const data = (v: string) => Date.parse(`${dataLocal(v)}T12:00:00Z`);
  return Math.max(1, Math.round((data(agora) - data(p.combinado.confirmadoEm ?? p.criadoEm)) / 86400000) + 1);
}

/** Uma porta de eventos para a interface. Escopo e idempotência valem inclusive no laboratório. */
export function aplicarPlano(p: PlanoV51, entrada: {
  familyId: string; membroId: string; eventoId: string; agora: string; acao: AcaoPlano;
}): { ok: true; plano: PlanoV51 } | { ok: false; erro: string } {
  if (entrada.familyId !== p.familyId || entrada.membroId !== p.membroId) return { ok: false, erro: "Este plano pertence a outro membro." };
  if (!entrada.eventoId || !Number.isFinite(Date.parse(entrada.agora))) return { ok: false, erro: "Evento inválido." };
  if (p.eventos.some(e => e.id === entrada.eventoId)) return { ok: true, plano: p };
  const n: PlanoV51 = structuredClone(p), a = entrada.acao;
  const falha = (erro: string) => ({ ok: false as const, erro });
  let tipo: string = a.tipo;
  if (a.tipo === "navegar") {
    if (!Number.isInteger(a.passo) || a.passo < 0 || a.passo >= PASSOS.length || (a.passo > p.alcance && !(p.confirmado && a.passo >= 12))) return falha("Esta etapa ainda não está disponível.");
    n.passo = a.passo;
  } else if (a.tipo === "avancar") {
    const id = PASSOS[p.passo].id;
    if (p.cuidado?.risco === "agora" && p.cuidado.emAberto) return falha("O cuidado atual precisa vir primeiro.");
    if (id === "perguntas" && perguntasPendentes(p).length) return falha("Responda ou marque que ainda não sabe.");
    if (id === "saber") tipo = "entendimento_confirmado";
    if (id === "confere") tipo = "compreensao_confirmada";
    if (id === "objetivo" && !p.objetivo.trim()) return falha("Escreva um objetivo para este assunto.");
    if (id === "caminhos" && !p.estrategiaId) return falha("Escolha um caminho para começar.");
    if (id === "lembretes") return falha("Confirme o combinado para começar.");
    n.passo = Math.min(p.passo + 1, PASSOS.length - 1);
    if (PASSOS[n.passo].id === "perguntas" && perguntasPendentes(n).length === 0) n.passo++;
    n.alcance = Math.max(n.alcance, n.passo);
  } else if (a.tipo === "responder") {
    const q = p.conteudo.perguntas.find(q => q.id === a.perguntaId);
    if (!q || ![...q.opcoes, "Não sei / não reparei"].includes(a.resposta)) return falha("Resposta não reconhecida.");
    n.respostas[a.perguntaId] = a.resposta;
  } else if (a.tipo === "contexto") n[a.campo] = a.valor.slice(0, 2000);
  else if (a.tipo === "escolher") {
    if (!p.conteudo.estrategias.some(e => e.id === a.estrategiaId)) return falha("Caminho não encontrado.");
    if (p.confirmado) return falha("Encerre o combinado antes de escolher outro caminho.");
    n.estrategiaId = a.estrategiaId; n.estados[a.estrategiaId] = "escolhido";
  } else if (a.tipo === "depois") {
    if (!p.conteudo.estrategias.some(e => e.id === a.estrategiaId)) return falha("Caminho não encontrado.");
    n.depois = p.depois.includes(a.estrategiaId) ? p.depois.filter(id => id !== a.estrategiaId) : [...p.depois, a.estrategiaId];
  } else if (a.tipo === "frase") {
    if (!p.conteudo.dizer[a.indice]) return falha("Frase não encontrada.");
    n.frases = p.frases.includes(a.indice) ? p.frases.filter(i => i !== a.indice) : [...p.frases, a.indice];
  } else if (a.tipo === "combinado") {
    if (p.confirmado) return falha("O combinado confirmado não pode ser sobrescrito.");
    if (a.campo === "voltarEm" && (!/^\d{4}-\d{2}-\d{2}$/.test(a.valor) || a.valor < dataLocal(entrada.agora))) return falha("Escolha uma data a partir de hoje.");
    n.combinado[a.campo] = a.valor.slice(0, 500);
  } else if (a.tipo === "confirmar") {
    if (p.confirmado) return { ok: true, plano: p };
    if (p.cuidado?.risco === "agora" && p.cuidado.emAberto) return falha("O cuidado atual precisa vir primeiro.");
    if (PASSOS[p.passo].id !== "lembretes" || !etapaConcluida(p, 0) || !etapaConcluida(p, 1) || !p.estrategiaId || !p.objetivo.trim() || !p.combinado.quando.trim() || !p.combinado.frequencia.trim() || !p.combinado.quem.trim()) return falha("Complete e confira o combinado antes de confirmar.");
    n.confirmado = true; n.combinado.confirmadoEm = entrada.agora; n.passo = 12; n.alcance = 13;
  } else if (a.tipo === "lembrete") {
    if (!a.disponivel || p.situacao !== "ativo" || !a.canal.trim() || !a.frequencia.trim() || !/^([01]\d|2[0-3]):[0-5]\d$/.test(a.horario)) return falha("Lembrete indisponível ou autorização incompleta.");
    n.lembretes = { autorizado: true, canal: a.canal, frequencia: a.frequencia, horario: a.horario };
  } else if (a.tipo === "desligar_lembrete") n.lembretes = { autorizado: false };
  else if (["pausar", "encerrar", "retomar"].includes(a.tipo)) {
    if (!p.confirmado) return falha("Ainda não há combinado confirmado.");
    if (a.tipo === "retomar" && p.situacao === "encerrado") return falha("Um combinado encerrado permanece no histórico.");
    n.situacao = a.tipo === "pausar" ? "pausado" : a.tipo === "encerrar" ? "encerrado" : "ativo";
    n.lembretes = { autorizado: false };
  } else if (a.tipo === "registrar") {
    const r = a.registro;
    if (!p.confirmado || p.situacao !== "ativo" || r.estrategiaId !== p.estrategiaId) return falha("Não há combinado ativo para esta tentativa.");
    if (p.registros.some(x => x.id === r.id)) return { ok: true, plano: p };
    if (!r.id || !["web", "whatsapp"].includes(r.origem) || !["tentativa", "sem_tentativa"].includes(r.tipo)) return falha("Registro inválido.");
    if (r.tipo === "tentativa" && (!r.relato.trim() || !r.resultado || !["ajudou", "parcial", "nao_mudou", "incerto"].includes(r.resultado))) return falha("Conte o que aconteceu e o resultado observado.");
    if (r.tipo === "sem_tentativa" && r.resultado !== undefined) return falha("Sem tentativa não há resultado observado.");
    n.registros.push({ ...r, relato: r.relato.trim(), em: entrada.agora });
    if (r.tipo === "tentativa") {
      // Os dois eventos são distintos, mesmo quando relatados no mesmo formulário.
      if (n.estados[r.estrategiaId] === "escolhido") {
        n.estados[r.estrategiaId] = "tentado";
        n.eventos.push({ id: `${entrada.eventoId}:tentativa`, tipo: "tentado", em: entrada.agora });
      }
      if (n.estados[r.estrategiaId] !== "conquista_confirmada") n.estados[r.estrategiaId] = "resultado_observado";
      tipo = "resultado_observado";
    }
  } else if (a.tipo === "conquista") {
    const r = n.registros.find(r => r.id === a.registroId);
    if (!r || !["ajudou", "parcial"].includes(r.resultado ?? "") || !a.confirma || !a.melhoria.trim()) return falha("Uma conquista precisa do que melhorou e da sua confirmação.");
    if (r.conquista) return { ok: true, plano: p };
    r.conquista = { melhoria: a.melhoria.trim(), confirmadaEm: entrada.agora };
    n.estados[r.estrategiaId] = "conquista_confirmada";
  } else if (a.tipo === "feedback") {
    if (!Number.isInteger(a.nota) || a.nota < 1 || a.nota > 5) return falha("Escolha de 1 a 5 estrelas.");
    n.feedback = { nota: a.nota, comentario: a.comentario.trim(), em: entrada.agora };
  } else if (a.tipo === "cuidado") {
    if (a.cuidado.frase && !p.relatoHoje.includes(a.cuidado.frase)) return falha("O cuidado precisa manter a frase original.");
    n.cuidado = a.cuidado;
  }
  n.eventos.push({ id: entrada.eventoId, tipo, em: entrada.agora });
  return { ok: true, plano: n };
}
