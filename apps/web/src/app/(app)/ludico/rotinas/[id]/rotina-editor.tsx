"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUp,
  Backpack,
  Bath,
  Bed,
  BookOpen,
  Car,
  Check,
  Circle,
  Gamepad2,
  Hotel,
  IceCreamCone,
  Music,
  Paintbrush,
  Pencil,
  Plane,
  Plus,
  Printer,
  RotateCcw,
  School,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Sun,
  Trash2,
  Utensils,
  Wand2,
  Waves,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { progressoDaRotina, resumoDoProgresso } from "@/lib/ludico/rotina-progresso";
import {
  RESPOSTAS_FEEDBACK,
  type RespostaFeedback,
} from "@/lib/ludico/rotina-resultado";
import {
  adicionarTarefa,
  adicionarVariasTarefas,
  criarRotinaDia,
  definirModoExibicao,
  excluirRotina,
  editarTarefa,
  excluirTarefa,
  gerarCardsVisuais,
  renomearRotina,
  reordenarTarefas,
  repetirTarefaEmDias,
  registrarResultadoRotina,
  resetarRotina,
  toggleTarefa,
} from "../actions";

/**
 * O ESTADO OPERACIONAL DOS CARTÕES, inteiro e verdadeiro.
 *
 * "aguardando" entrou em 08/08/2026: até então, cartões pedidos mas sem tema
 * ficavam em "nenhum" — indistinguível de "ninguém pediu cartão". A tela abria
 * em modo cartões, mostrava ícone e não dizia nada, então a família ficava
 * esperando uma arte que nunca tinha sido encomendada.
 */
type CardsStatus = "nenhum" | "aguardando" | "gerando" | "pronto" | "erro";

/** Ícones curados pros passos visuais. A chave é guardada em rotina_tarefas.icone. */
const ICONES: Record<string, LucideIcon> = {
  aviao: Plane,
  carro: Car,
  praia: Waves,
  sol: Sun,
  sorvete: IceCreamCone,
  compras: ShoppingBag,
  hotel: Hotel,
  comida: Utensils,
  dormir: Bed,
  banho: Bath,
  roupa: Shirt,
  mochila: Backpack,
  livro: BookOpen,
  brincar: Gamepad2,
  musica: Music,
  pintar: Paintbrush,
  escola: School,
};
const ICONE_KEYS = Object.keys(ICONES);
function IconeDe(k: string | null | undefined): LucideIcon {
  return (k && ICONES[k]) || Circle;
}

const DIAS_CURTOS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const DIAS_FULL = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

/** Selo de passo numerado — deixa o fluxo "1 faça isso, 2 faça aquilo" claro. */
function StepBadge({ n }: { n: number }) {
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-full bg-brand-purple text-xs font-bold text-white">
      {n}
    </span>
  );
}

/** Cartão de espera (geração dos cartões) — moldura amarela, animado, "não travou". */
function CardGerando() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-brand-yellow/60 bg-brand-yellow/[0.1] px-4 py-8 text-center shadow-[0_4px_20px_rgba(230,180,40,0.15)] print:hidden">
      <span className="animate-bounce text-4xl" aria-hidden>
        ⏳
      </span>
      <p className="font-heading text-lg text-brand-purple-dark">Gerando os cartões ilustrados…</p>
      <div className="flex gap-1.5" aria-hidden>
        <span className="size-2 animate-bounce rounded-full bg-brand-yellow" style={{ animationDelay: "0ms" }} />
        <span className="size-2 animate-bounce rounded-full bg-brand-purple/60" style={{ animationDelay: "150ms" }} />
        <span className="size-2 animate-bounce rounded-full bg-brand-yellow" style={{ animationDelay: "300ms" }} />
      </div>
      <p className="max-w-sm text-sm text-muted-foreground">
        Leva ~1 a 2 minutos. Pode deixar esta tela aberta — ela atualiza sozinha quando ficar pronto.{" "}
        <strong className="text-foreground">Não travou 🙂</strong>
      </p>
    </div>
  );
}

type Tarefa = {
  id: string;
  texto: string;
  icone: string | null;
  hora: string | null;
  concluida: boolean;
  nomeTematico: string | null;
  imagemUrl: string | null;
};

type AvatarMini = { id: string; url: string; selecionado: boolean };

export function RotinaEditor({
  rotinaId,
  membroAtipicoId,
  diaSemana,
  nomeInicial,
  modoInicial,
  nomeMembro,
  avatares,
  tema,
  historia,
  cardsStatus,
  resultadoInicial,
  tarefasIniciais,
}: {
  rotinaId: string;
  membroAtipicoId: string;
  /** 0-6 se é um dia da semana; null se é rotina avulsa (aí não tem "repete em"). */
  diaSemana: number | null;
  nomeInicial: string;
  modoInicial: "cartoes" | "lista";
  nomeMembro: string | null;
  avatares: AvatarMini[];
  tema: string | null;
  historia: string | null;
  cardsStatus: CardsStatus;
  /** O que a família já respondeu sobre esta rotina, se respondeu. */
  resultadoInicial: string | null;
  tarefasIniciais: Tarefa[];
}) {
  const router = useRouter();
  // A pessoa escolhe como ver: cartões (imagem) ou lista. Persiste por rotina.
  const [modo, setModo] = useState<"cartoes" | "lista">(modoInicial);
  const visual = modo === "cartoes";

  function trocarModo(novo: "cartoes" | "lista") {
    if (novo === modo) return;
    setModo(novo);
    start(async () => setErroFrom(await definirModoExibicao({ rotinaId, modo: novo })));
  }

  // Enquanto gera os cards em segundo plano, faz polling até virar pronto/erro.
  useEffect(() => {
    if (cardsStatus !== "gerando") return;
    const t = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(t);
  }, [cardsStatus, router]);
  const [nome, setNome] = useState(nomeInicial);
  const [tarefas, setTarefas] = useState<Tarefa[]>(tarefasIniciais);
  const [erro, setErro] = useState<string | null>(null);
  // Tela do dia = só RESULTADO quando já tem passos; edição fica atrás de "Editar".
  const [editando, setEditando] = useState(tarefasIniciais.length === 0);
  const [, start] = useTransition();

  // Próximo dia da semana (só quando é uma rotina de dia). Domingo → volta à semana.
  const proximoDia = diaSemana != null && diaSemana < 6 ? diaSemana + 1 : null;
  function irProximoDia() {
    if (diaSemana == null) return;
    if (proximoDia == null) {
      router.push("/ludico/rotinas/semana");
      return;
    }
    start(async () => {
      const r = await criarRotinaDia({ membroAtipicoId, diaSemana: proximoDia });
      if (r.ok) router.push(`/ludico/rotinas/${r.rotinaId}`);
      else setErro(r.error);
    });
  }

  function setErroFrom(r: { ok: boolean; error?: string }) {
    if (!r.ok && r.error) setErro(r.error);
  }

  function toggle(id: string) {
    const alvo = tarefas.find((t) => t.id === id);
    if (!alvo) return;
    const novo = !alvo.concluida;
    setTarefas((ts) => ts.map((t) => (t.id === id ? { ...t, concluida: novo } : t)));
    start(async () => setErroFrom(await toggleTarefa({ rotinaId, tarefaId: id, concluida: novo })));
  }

  function mover(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= tarefas.length) return;
    const copia = tarefas.slice();
    [copia[i], copia[j]] = [copia[j], copia[i]];
    setTarefas(copia);
    start(async () =>
      setErroFrom(await reordenarTarefas({ rotinaId, ordemIds: copia.map((t) => t.id) })),
    );
  }

  function remover(id: string) {
    setTarefas((ts) => ts.filter((t) => t.id !== id));
    start(async () => setErroFrom(await excluirTarefa({ rotinaId, tarefaId: id })));
  }

  /**
   * TROCAR A PALAVRA DELA. `editarTarefa` existia na action desde sempre e o
   * editor nunca a importou: dava pra reordenar e apagar um passo, nunca pra
   * corrigir o texto. A mãe que escreveu "tomar banho" e queria "hora do banho"
   * tinha que apagar e escrever de novo.
   *
   * Otimista na tela e salvo no servidor — se falhar, o erro aparece e o texto
   * dela continua ali pra tentar de novo.
   */
  function renomearPasso(id: string, texto: string) {
    const t = texto.trim();
    if (!t) return;
    const atual = tarefas.find((x) => x.id === id);
    if (!atual || atual.texto === t) return;
    setTarefas((ts) => ts.map((x) => (x.id === id ? { ...x, texto: t } : x)));
    start(async () =>
      setErroFrom(await editarTarefa({ rotinaId, tarefaId: id, texto: t, icone: atual.icone })),
    );
  }

  function adicionar(texto: string, icone: string | null, hora: string | null, repeteDias: number[]) {
    start(async () => {
      const r = await adicionarTarefa({ rotinaId, texto, icone, hora });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      setTarefas((ts) => [
        ...ts,
        { id: r.tarefaId, texto, icone, hora, concluida: false, nomeTematico: null, imagemUrl: null },
      ]);
      // "Repete em": grava a mesma atividade nos outros dias marcados.
      const outros = repeteDias.filter((d) => d !== diaSemana);
      if (outros.length > 0) {
        await repetirTarefaEmDias({ membroAtipicoId, dias: outros, texto, icone, hora });
      }
    });
  }

  function adicionarVarios(textos: string[]) {
    if (textos.length === 0) return;
    start(async () => {
      const r = await adicionarVariasTarefas({ rotinaId, textos });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.refresh(); // recarrega já na ordem certa
    });
  }

  function resetar() {
    setTarefas((ts) => ts.map((t) => ({ ...t, concluida: false })));
    start(async () => setErroFrom(await resetarRotina({ rotinaId })));
  }

  function salvarNome(novo: string) {
    const n = novo.trim();
    if (!n || n === nome) return;
    setNome(n);
    start(async () => setErroFrom(await renomearRotina({ rotinaId, nome: n })));
  }

  return (
    <div className="flex flex-col gap-6">
      {erro && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </p>
      )}

      <CabecalhoRotina
        nome={nome}
        onRename={salvarNome}
        onReset={resetar}
        rotinaId={rotinaId}
      />

      {/* Como exibir: cartões (imagem) ou lista. Escolha da pessoa, persiste. */}
      <div className="flex items-center gap-2 print:hidden">
        <span className="text-sm text-muted-foreground">Ver como:</span>
        <div className="inline-flex rounded-full border border-foreground/10 bg-white p-0.5 text-xs font-semibold">
          <button
            type="button"
            onClick={() => trocarModo("cartoes")}
            className={cn(
              "rounded-full px-3 py-1.5 transition-colors",
              visual ? "bg-brand-purple text-white" : "text-foreground/60 hover:text-foreground",
            )}
          >
            Cartões
          </button>
          <button
            type="button"
            onClick={() => trocarModo("lista")}
            className={cn(
              "rounded-full px-3 py-1.5 transition-colors",
              !visual ? "bg-brand-purple text-white" : "text-foreground/60 hover:text-foreground",
            )}
          >
            Lista
          </button>
        </div>
      </div>

      {cardsStatus === "gerando" && <CardGerando />}
      {/* ESPERANDO A ESCOLHA, não esperando a arte. A diferença importa: aqui
          nada foi encomendado ainda, e a tela precisa dizer isso em vez de
          deixar a família olhando ícone achando que a imagem está a caminho. */}
      {cardsStatus === "aguardando" && (
        <p className="rounded-2xl border border-brand-purple/20 bg-brand-purple/5 px-4 py-3 text-sm text-foreground/80 print:hidden">
          Os cartões desta rotina ainda não começaram — falta escolher o tema. Você pode
          responder à Ayla no WhatsApp ou escolher aqui mesmo, embaixo.
        </p>
      )}
      {cardsStatus === "erro" && (
        <p className="rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm text-amber-800 print:hidden">
          Algo falhou ao montar os cards. Dá pra tentar de novo abaixo.
        </p>
      )}

      {historia && <HistoriaPanel historia={historia} nomeMembro={nomeMembro} />}

      {/* COMO USAR — nos DOIS modos. Antes só o modo cartões explicava; quem
          abria em lista recebia uma linha solta ("dá pra abrir no celular") e
          tinha que deduzir o resto. Uma mãe que nunca usou cartões precisa
          saber as três coisas: dá pra usar na tela, dá pra imprimir, e dá pra
          mudar o que estiver errado. */}
      <ComoUsar visual={visual} nomeMembro={nomeMembro} />

      <ProgressoDaRotina tarefas={tarefas} />

      {visual && cardsStatus === "pronto" && (
        <a
          href={`/api/ludico/rotinas/${rotinaId}/cartoes`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-fit items-center gap-2 rounded-full border border-brand-purple/30 px-4 py-2 text-sm font-semibold text-brand-purple transition-colors hover:bg-brand-purple/5 print:hidden"
        >
          ✂️ Cartões pra recortar (varalzinho)
        </a>
      )}

      {visual ? (
        <ViewCartoes
          tarefas={tarefas}
          agoraId={progressoDaRotina(tarefas).agoraId}
          onToggle={toggle}
          onMover={mover}
          onRemover={remover}
        />
      ) : (
        <ViewChecklist
          tarefas={tarefas}
          agoraId={progressoDaRotina(tarefas).agoraId}
          onToggle={toggle}
          onMover={mover}
          onRemover={remover}
        />
      )}

      {/* "ESSA ROTINA AJUDOU?" — depois da sequência, nunca antes: perguntar
          se ajudou acima do quadro é pedir opinião sobre algo que ela ainda
          não olhou. Só aparece quando há o que avaliar. */}
      {tarefas.length > 0 && (
        <FeedbackRotina
          rotinaId={rotinaId}
          resultadoInicial={resultadoInicial}
          onQuerAjustar={() => setEditando(true)}
        />
      )}

      {editando ? (
        <>
          {tarefas.length > 0 && (
            <ListaEditavel
              tarefas={tarefas}
              onRenomear={renomearPasso}
              onMover={mover}
              onRemover={remover}
            />
          )}

          <AddTarefa
            rotinaId={rotinaId}
            visual={visual}
            temPassos={tarefas.length > 0}
            diaSemana={diaSemana}
            onAdd={adicionar}
            onAddVarios={adicionarVarios}
          />

          {visual && cardsStatus !== "gerando" && (
            <GerarCards
              rotinaId={rotinaId}
              temaInicial={tema}
              jaTem={cardsStatus === "pronto"}
              nomeMembro={nomeMembro}
              avatares={avatares}
            />
          )}

          {tarefas.length > 0 && (
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="w-fit rounded-full bg-brand-purple px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-dark print:hidden"
            >
              Concluir ✓
            </button>
          )}
        </>
      ) : (
        <>
          {/* O "Gerar cartões" aparece aqui quando ainda não há cartões (senão
              ficaria escondido atrás de "Editar"). A espera já está no topo. */}
          {visual &&
            (cardsStatus === "nenhum" || cardsStatus === "aguardando" || cardsStatus === "erro") && (
            <GerarCards
              rotinaId={rotinaId}
              temaInicial={tema}
              jaTem={false}
              nomeMembro={nomeMembro}
              avatares={avatares}
            />
          )}
          <div className="flex flex-wrap items-center gap-3 print:hidden">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-purple/30 px-4 py-2 text-sm font-semibold text-brand-purple transition-colors hover:bg-brand-purple/5"
            >
              ✏️ Editar
            </button>
            {diaSemana != null && (
              <button
                type="button"
                onClick={irProximoDia}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-purple-dark"
              >
                {proximoDia != null ? `Montar ${DIAS_FULL[proximoDia]}` : "Ver a semana"} →
              </button>
            )}
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground print:hidden">
        Marcar é só pra acompanhar o que já passou — ajuda na previsibilidade e na
        autonomia.
      </p>
    </div>
  );
}

function CabecalhoRotina({
  nome,
  onRename,
  onReset,
  rotinaId,
}: {
  nome: string;
  onRename: (n: string) => void;
  onReset: () => void;
  rotinaId: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(nome);
  const [confirmaExcluir, setConfirmaExcluir] = useState(false);
  const [, start] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editando ? (
          <Input
            autoFocus
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            onBlur={() => {
              onRename(valor);
              setEditando(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRename(valor);
                setEditando(false);
              }
            }}
            className="max-w-xs"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setValor(nome);
              setEditando(true);
            }}
            className="group inline-flex items-center gap-2 text-left"
          >
            <h1 className="font-heading text-2xl text-foreground md:text-3xl">{nome}</h1>
            <Pencil className="size-3.5 text-foreground/30 transition-colors group-hover:text-foreground/60" />
          </button>
        )}
        <div className="flex gap-2 print:hidden">
          {/* IMPRIMIR VALE NOS DOIS MODOS. Ficava atrás de `visual` — quem
              abrisse a rotina em lista não tinha como imprimir, embora a lista
              seja perfeitamente imprimível (o `print:hidden` está só nos
              controles, nunca no conteúdo). A mãe que quer colar na geladeira
              não deveria precisar descobrir que existe um modo "Cartões". */}
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-kolo-lilas-bg-2 hover:text-brand-purple"
          >
            <Printer className="size-3.5" /> Imprimir
          </button>
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-full border border-foreground/10 bg-white px-3 py-1.5 text-xs font-semibold text-foreground/70 hover:bg-kolo-lilas-bg-2 hover:text-brand-purple"
          >
            <RotateCcw className="size-3.5" /> Recomeçar
          </button>
        </div>
      </div>

      <div className="flex justify-end print:hidden">
        {confirmaExcluir ? (
          <span className="inline-flex items-center gap-3 text-sm">
            <span className="text-muted-foreground">Excluir esta rotina?</span>
            <button
              type="button"
              onClick={() =>
                start(async () => {
                  const r = await excluirRotina({ rotinaId });
                  if (r.ok) router.push("/ludico/rotinas");
                })
              }
              className="font-semibold text-destructive hover:underline"
            >
              Sim, excluir
            </button>
            <button
              type="button"
              onClick={() => setConfirmaExcluir(false)}
              className="text-muted-foreground hover:text-foreground"
            >
              Não
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmaExcluir(true)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-3.5" /> Excluir rotina
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- Cartões visuais (criança) ---------- */
/* ---------- Lista editável (modo edição) ---------- */

/**
 * OS PASSOS COM AS PALAVRAS DELA, editáveis.
 *
 * Em modo edição a tela mostrava os CARTÕES — dava pra subir, descer e apagar,
 * mas não pra trocar uma palavra. Quem escreveu "tomar banho" e queria "hora do
 * banho" tinha que apagar o passo e escrever de novo, perdendo a arte já gerada.
 *
 * Aqui o texto dela está num campo, do jeito que ela escreveu. Salva ao sair do
 * campo ou no Enter — sem botão de salvar, que é mais uma coisa pra ela lembrar.
 */
/**
 * O QUE JÁ PASSOU, O QUE É AGORA, O QUE FALTA.
 *
 * A tela sabia responder só a primeira. As outras duas são o que torna a
 * sequência previsível pra criança — e são justamente as que ela não consegue
 * deduzir sozinha olhando cartões todos iguais.
 *
 * Some da impressão: no papel a sequência é a ordem, e "agora" muda a cada
 * hora. Uma folha colada na parede dizendo "agora: jantar" ficaria errada na
 * manhã seguinte.
 */
function ProgressoDaRotina({ tarefas }: { tarefas: Tarefa[] }) {
  const p = progressoDaRotina(tarefas);
  if (p.total === 0) return null;
  const agora = tarefas.find((t) => t.id === p.agoraId);
  const pct = Math.round((p.feitas / p.total) * 100);
  return (
    <div className="flex flex-col gap-2 print:hidden" aria-live="polite">
      <p className="text-sm font-medium text-foreground">
        {resumoDoProgresso(p, agora?.nomeTematico ?? agora?.texto ?? null)}
      </p>
      <div
        className="h-1.5 w-full max-w-md overflow-hidden rounded-full bg-foreground/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={p.total}
        aria-valuenow={p.feitas}
        aria-label="Etapas concluídas"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            p.completa ? "bg-emerald-500" : "bg-brand-purple",
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

/**
 * A PÁGINA PRECISA ENSINAR — e em três frases, não num manual.
 *
 * Vale nos dois modos. O texto muda porque o gesto muda (tocar no card × marcar
 * na lista), mas as três informações são as mesmas: usar na tela, imprimir,
 * corrigir.
 */
function ComoUsar({ visual, nomeMembro }: { visual: boolean; nomeMembro: string | null }) {
  const dono = nomeMembro ? `com ${nomeMembro}` : "com a criança";
  return (
    <div className="rounded-2xl border border-brand-yellow/30 bg-brand-yellow/[0.07] px-4 py-3 print:hidden">
      <p className="text-sm leading-relaxed text-foreground">
        <strong className="font-semibold">Como usar:</strong>{" "}
        {visual ? (
          <>
            a cada etapa concluída, <strong className="font-semibold">toquem juntos no card</strong>{" "}
            pra marcar como feito. Ele esmaece ao marcar, e a etapa de agora fica destacada — assim{" "}
            {dono} enxerga o que já passou, o que é agora e o que ainda falta. Tocou sem querer?
            Toque de novo que ele volta.
          </>
        ) : (
          <>
            vá <strong className="font-semibold">marcando cada etapa</strong> conforme acontece. A
            etapa de agora fica destacada, e as marcadas saem do caminho — assim {dono} enxerga o
            que já passou, o que é agora e o que ainda falta.
          </>
        )}
      </p>
      <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Smartphone className="size-3.5" /> Dá pra abrir no celular e ir marcando
        </span>
        <span className="flex items-center gap-1.5">
          <Printer className="size-3.5" /> Ou imprimir e colar na parede
        </span>
        <span className="flex items-center gap-1.5">
          <Pencil className="size-3.5" /> Errou uma etapa? Dá pra editar em “Editar”
        </span>
      </p>
    </div>
  );
}

/**
 * A PERGUNTA QUE FECHA O CICLO — leve, e uma vez.
 *
 * Quatro botões e nada de texto livre: a mãe está com a criança na frente, e
 * caixa de texto aqui é a diferença entre responder e não responder. As
 * palavras dela continuam chegando pelo WhatsApp, que é onde ela já escreve.
 *
 * "Quero ajustar" não é só um rótulo: ele abre a edição na hora. Quem clica
 * ali está pedindo para mudar a sequência, e devolver só um "obrigada pelo
 * retorno" seria fingir que a resposta foi ouvida.
 */
function FeedbackRotina({
  rotinaId,
  resultadoInicial,
  onQuerAjustar,
}: {
  rotinaId: string;
  resultadoInicial: string | null;
  onQuerAjustar: () => void;
}) {
  const [resultado, setResultado] = useState<string | null>(resultadoInicial);
  const [erro, setErro] = useState<string | null>(null);
  const [, start] = useTransition();

  function responder(r: RespostaFeedback, valor: string) {
    const anterior = resultado;
    setResultado(valor);
    setErro(null);
    if (r === "quero_ajustar") onQuerAjustar();
    start(async () => {
      const res = await registrarResultadoRotina({ rotinaId, resposta: r });
      // A escrita é conferida do outro lado; se não gravou, a marca volta
      // atrás. Deixar o botão aceso por uma resposta que não existe no banco
      // seria mentir para a mãe sobre algo que ela acabou de fazer.
      if (!res.ok) {
        setResultado(anterior);
        setErro("Não consegui guardar sua resposta. Dá pra tentar de novo.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-kolo-linha bg-white px-4 py-3 print:hidden">
      <p className="text-sm font-semibold text-foreground">Essa rotina ajudou?</p>
      <div className="flex flex-wrap gap-2">
        {RESPOSTAS_FEEDBACK.map((op) => {
          const marcada = resultado === op.resultado;
          return (
            <button
              key={op.chave}
              type="button"
              aria-pressed={marcada}
              onClick={() => responder(op.chave, op.resultado)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                marcada
                  ? "border-brand-purple bg-brand-purple text-white"
                  : "border-foreground/15 bg-white text-foreground/70 hover:border-brand-purple/40 hover:text-brand-purple",
              )}
            >
              {op.rotulo}
            </button>
          );
        })}
      </div>
      {erro ? (
        <p className="text-xs text-destructive">{erro}</p>
      ) : resultado ? (
        <p className="text-xs text-muted-foreground">
          Obrigada — isso ajuda a Ayla a acertar a próxima. Dá pra mudar sua resposta a
          qualquer momento.
        </p>
      ) : null}
    </div>
  );
}

function ListaEditavel({
  tarefas,
  onRenomear,
  onMover,
  onRemover,
}: {
  tarefas: Tarefa[];
  onRenomear: (id: string, texto: string) => void;
  onMover: (i: number, dir: -1 | 1) => void;
  onRemover: (id: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2 print:hidden">
      <p className="text-sm font-semibold text-foreground">Os passos</p>
      <p className="text-sm text-muted-foreground">
        Toque num passo pra mudar as palavras. Dá pra reordenar e apagar também.
      </p>
      <ul className="flex flex-col gap-2">
        {tarefas.map((t, i) => (
          <li
            key={t.id}
            className="flex items-center gap-2 rounded-xl border border-kolo-linha bg-white px-3 py-2 focus-within:ring-2 focus-within:ring-brand-purple/30"
          >
            <span className="w-5 shrink-0 text-sm font-bold tabular-nums text-brand-purple">
              {i + 1}
            </span>
            <input
              defaultValue={t.texto}
              onBlur={(e) => onRenomear(t.id, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") {
                  e.currentTarget.value = t.texto;
                  e.currentTarget.blur();
                }
              }}
              maxLength={120}
              aria-label={`Passo ${i + 1}`}
              className="min-w-0 flex-1 bg-transparent text-[15px] focus:outline-none"
            />
            <span className="flex shrink-0 items-center gap-1">
              <Mini icone={ArrowUp} onClick={() => onMover(i, -1)} disabled={i === 0} label="Subir" />
              <Mini
                icone={ArrowDown}
                onClick={() => onMover(i, 1)}
                disabled={i === tarefas.length - 1}
                label="Descer"
              />
              <Mini icone={X} onClick={() => onRemover(t.id)} disabled={false} label="Apagar" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ViewCartoes({
  tarefas,
  agoraId,
  onToggle,
  onMover,
  onRemover,
}: {
  tarefas: Tarefa[];
  /** A etapa de AGORA. Ganha destaque na tela e nenhum no papel. */
  agoraId: string | null;
  onToggle: (id: string) => void;
  onMover: (i: number, dir: -1 | 1) => void;
  onRemover: (id: string) => void;
}) {
  if (tarefas.length === 0) return <Vazio />;
  return (
    <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 print:grid-cols-3 print:gap-2">
      {tarefas.map((t, i) => {
        const Icon = IconeDe(t.icone);
        const agora = t.id === agoraId;
        return (
          <li key={t.id} className="group relative print:break-inside-avoid">
            <button
              type="button"
              onClick={() => onToggle(t.id)}
              aria-current={agora ? "step" : undefined}
              className={cn(
                "flex w-full flex-col items-center gap-3 rounded-3xl border-2 p-5 text-center transition-all",
                t.concluida
                  ? "border-foreground/10 bg-foreground/[0.03] opacity-60"
                  : agora
                    ? // O destaque não pode depender só de cor: a borda mais
                      // grossa e o rótulo "AGORA" sobrevivem a daltonismo e à
                      // impressão em preto e branco.
                      "border-brand-purple bg-brand-purple/[0.06] ring-2 ring-brand-purple/25"
                    : "border-brand-purple/15 bg-white hover:border-brand-purple/40",
              )}
            >
              {agora && (
                <span className="rounded-full bg-brand-purple px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white print:hidden">
                  Agora
                </span>
              )}
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {i + 1}º
              </span>
              {t.imagemUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.imagemUrl}
                  alt={t.texto}
                  className={cn(
                    "aspect-square w-full rounded-2xl object-cover",
                    t.concluida && "opacity-50 grayscale",
                  )}
                />
              ) : (
                <span
                  className={cn(
                    "flex size-20 items-center justify-center rounded-2xl",
                    t.concluida ? "bg-foreground/5 text-foreground/40" : "bg-brand-yellow/20 text-[#8B5A00]",
                  )}
                >
                  <Icon className="size-10" strokeWidth={1.6} />
                </span>
              )}
              <span
                className={cn(
                  "leading-snug",
                  t.nomeTematico
                    ? "text-base font-bold uppercase tracking-wide"
                    : "text-base font-medium",
                  t.concluida ? "text-foreground/40 line-through" : "text-foreground",
                )}
              >
                {t.nomeTematico ?? t.texto}
              </span>
              {t.nomeTematico && (
                <span className={cn("text-xs", t.concluida ? "text-foreground/30" : "text-muted-foreground")}>
                  {t.texto}
                </span>
              )}
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full border-2 transition-colors",
                  t.concluida ? "border-emerald-500 bg-emerald-500 text-white" : "border-foreground/20 text-transparent",
                )}
              >
                <Check className="size-4" strokeWidth={3} />
              </span>
            </button>
            <div className="mt-1.5 flex justify-center gap-1 print:hidden">
              <Mini icone={ArrowUp} onClick={() => onMover(i, -1)} disabled={i === 0} label="Subir" />
              <Mini icone={ArrowDown} onClick={() => onMover(i, 1)} disabled={i === tarefas.length - 1} label="Descer" />
              <Mini icone={X} onClick={() => onRemover(t.id)} disabled={false} label="Remover" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/* ---------- Checklist (adolescente/adulto) ---------- */
function ViewChecklist({
  tarefas,
  agoraId,
  onToggle,
  onMover,
  onRemover,
}: {
  tarefas: Tarefa[];
  /** A etapa de AGORA. Ganha destaque na tela e nenhum no papel. */
  agoraId: string | null;
  onToggle: (id: string) => void;
  onMover: (i: number, dir: -1 | 1) => void;
  onRemover: (id: string) => void;
}) {
  if (tarefas.length === 0) return <Vazio />;
  return (
    <ul className="flex flex-col rounded-3xl border border-foreground/10 bg-white px-5 sm:max-w-md">
      {tarefas.map((t, i) => (
        <li
          key={t.id}
          aria-current={t.id === agoraId ? "step" : undefined}
          className={cn(
            "flex items-center gap-3 py-3",
            i > 0 && "border-t border-foreground/[0.06]",
            t.id === agoraId && "-mx-5 border-l-4 border-l-brand-purple bg-brand-purple/[0.05] pl-4 pr-5 print:mx-0 print:border-l-0 print:bg-transparent print:pl-0",
          )}
        >
          <button
            type="button"
            onClick={() => onToggle(t.id)}
            aria-label={t.concluida ? "Desmarcar" : "Marcar"}
            className={cn(
              "flex size-6 shrink-0 items-center justify-center rounded-md border-2 transition-colors",
              t.concluida ? "border-emerald-500 bg-emerald-500 text-white" : "border-foreground/25 text-transparent hover:border-brand-purple",
            )}
          >
            <Check className="size-3.5" strokeWidth={3} />
          </button>
          <span className={cn("flex-1 text-base", t.concluida ? "text-foreground/40 line-through" : "text-foreground")}>
            {t.texto}
          </span>
          <span className="flex gap-1 print:hidden">
            <Mini icone={ArrowUp} onClick={() => onMover(i, -1)} disabled={i === 0} label="Subir" />
            <Mini icone={ArrowDown} onClick={() => onMover(i, 1)} disabled={i === tarefas.length - 1} label="Descer" />
            <Mini icone={X} onClick={() => onRemover(t.id)} disabled={false} label="Remover" />
          </span>
        </li>
      ))}
    </ul>
  );
}

function Vazio() {
  return (
    <div className="rounded-2xl border border-dashed border-foreground/15 px-5 py-8 text-center">
      <p className="text-sm font-medium text-foreground">
        Monte a lista de atividades do dia
      </p>
      <p className="mx-auto mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
        Escreva as etapas na ordem em que acontecem — uma por linha — no campo
        abaixo. Ex.: <em className="not-italic text-foreground/70">Acordar · Escovar os
        dentes · Tomar café · Vestir a roupa · Escola</em>.
      </p>
    </div>
  );
}

function AddTarefa({
  rotinaId,
  visual,
  temPassos,
  diaSemana,
  onAdd,
  onAddVarios,
}: {
  rotinaId: string;
  visual: boolean;
  temPassos: boolean;
  diaSemana: number | null;
  onAdd: (texto: string, icone: string | null, hora: string | null, repeteDias: number[]) => void;
  onAddVarios: (textos: string[]) => void;
}) {
  const [texto, setTexto] = useState("");
  const [icone, setIcone] = useState<string | null>(null);
  const [hora, setHora] = useState("");
  const [varios, setVarios] = useState("");
  const [repeteDias, setRepeteDias] = useState<number[]>([]);

  // Não perder a lista digitada se sair da tela (ex.: foi criar um avatar e voltou).
  const draftKey = `rotina-lista-${rotinaId}`;
  useEffect(() => {
    try {
      const s = localStorage.getItem(draftKey);
      if (s) setVarios(s);
    } catch {
      /* localStorage indisponível */
    }
  }, [draftKey]);
  useEffect(() => {
    try {
      if (varios.trim()) localStorage.setItem(draftKey, varios);
      else localStorage.removeItem(draftKey);
    } catch {
      /* ignore */
    }
  }, [varios, draftKey]);

  function add() {
    const t = texto.trim();
    if (!t) return;
    onAdd(t, visual ? icone : null, hora.trim() || null, repeteDias);
    setTexto("");
    setIcone(null);
    setHora("");
    setRepeteDias([]);
  }

  function addVarios() {
    const linhas = varios
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 30);
    if (linhas.length === 0) return;
    onAddVarios(linhas);
    setVarios("");
  }

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-4 print:hidden">
      {/* Montar a lista de uma vez (uma atividade por linha) */}
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <StepBadge n={1} /> {temPassos ? "Adicionar mais passos" : "Monte a lista de atividades"}
        </p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Uma atividade por linha, na ordem em que acontecem no dia. <strong>Clique em “Adicionar à
          rotina” pra salvar</strong> antes de gerar os cartões.
        </p>
        <textarea
          value={varios}
          onChange={(e) => setVarios(e.target.value)}
          rows={5}
          placeholder={"Acordar\nEscovar os dentes\nTomar café\nVestir a roupa\nEscola"}
          className="w-full resize-y rounded-xl border border-foreground/10 bg-white px-3 py-2 text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand-purple/30"
        />
        <div>
          <Button type="button" onClick={addVarios} disabled={!varios.trim()}>
            <Plus className="size-4" aria-hidden /> Adicionar à rotina
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-foreground/10" />
        ou adicione um por vez
        <span className="h-px flex-1 bg-foreground/10" />
      </div>

      {/* Um por vez (com ícone, no modo visual) */}
      <div className="flex flex-col gap-3">
        <div className="flex gap-2">
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="Novo passo (ex.: praia, sorveteria…)"
          />
          <Input
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="hora"
            inputMode="numeric"
            className="w-20 shrink-0"
            aria-label="Horário (opcional)"
          />
          <Button type="button" variant="outline" onClick={add} disabled={!texto.trim()}>
            <Plus className="size-4" aria-hidden /> Adicionar
          </Button>
        </div>
        {diaSemana != null && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Repete em:</span>
            {DIAS_CURTOS.map((lbl, d) => {
              if (d === diaSemana) return null;
              const sel = repeteDias.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() =>
                    setRepeteDias((ds) => (sel ? ds.filter((x) => x !== d) : [...ds, d]))
                  }
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    sel
                      ? "border-brand-purple bg-brand-purple text-white"
                      : "border-foreground/15 bg-white text-muted-foreground hover:border-brand-purple/40",
                  )}
                >
                  {lbl}
                </button>
              );
            })}
            {repeteDias.length > 0 && (
              <span className="text-xs text-brand-purple">
                vai pra {repeteDias.length + 1} dias
              </span>
            )}
          </div>
        )}
        {visual && (
          <div className="flex flex-wrap gap-1.5">
            {ICONE_KEYS.map((k) => {
              const Icon = ICONES[k];
              const sel = icone === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setIcone(sel ? null : k)}
                  aria-label={k}
                  className={cn(
                    "flex size-9 items-center justify-center rounded-xl border transition-colors",
                    sel
                      ? "border-brand-purple bg-brand-yellow/25 text-[#8B5A00]"
                      : "border-foreground/10 bg-white text-foreground/50 hover:border-brand-purple/30",
                  )}
                >
                  <Icon className="size-[18px]" strokeWidth={1.8} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Mini({
  icone: Icon,
  onClick,
  disabled,
  label,
}: {
  icone: LucideIcon;
  onClick: () => void;
  disabled: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className="inline-flex size-6 items-center justify-center rounded-full text-foreground/40 transition-colors hover:bg-foreground/5 hover:text-foreground disabled:opacity-25 disabled:hover:bg-transparent"
    >
      <Icon className="size-3.5" />
    </button>
  );
}

/**
 * "A história da rotina" não dizia pra que ela serve. A função é PREPARAR a
 * criança pro que vai acontecer — e é isso que o título passa a dizer.
 */
function HistoriaPanel({ historia, nomeMembro }: { historia: string; nomeMembro?: string | null }) {
  const [aberto, setAberto] = useState(true);
  return (
    <div className="rounded-2xl border border-brand-yellow/40 bg-brand-yellow/[0.07] p-4">
      <button
        type="button"
        onClick={() => setAberto((a) => !a)}
        className="flex w-full items-center gap-2 text-left print:hidden"
      >
        <BookOpen className="size-4 text-[#8B5A00]" aria-hidden />
        <span className="font-heading text-base font-medium text-foreground">
          {nomeMembro ? `Uma historinha pra preparar ${nomeMembro}` : "Uma historinha pra preparar"}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{aberto ? "ocultar" : "ler"}</span>
      </button>
      {aberto && (
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
          {historia}
        </p>
      )}
    </div>
  );
}

function GerarCards({
  rotinaId,
  temaInicial,
  jaTem,
  nomeMembro,
  avatares,
}: {
  rotinaId: string;
  temaInicial: string | null;
  jaTem: boolean;
  nomeMembro: string | null;
  avatares: AvatarMini[];
}) {
  const router = useRouter();
  const temAvatar = avatares.length > 0;
  // Se a criança tem avatar, esse é o padrão (mais pessoal).
  const [usarAvatar, setUsarAvatar] = useState(temAvatar);
  const [avatarId, setAvatarId] = useState(
    () => (avatares.find((a) => a.selecionado) ?? avatares[0])?.id ?? "",
  );
  const [tema, setTema] = useState(temaInicial ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function gerar() {
    if (pending) return;
    if (!usarAvatar && tema.trim().length < 2) {
      setErro("Escolha um tema (ou use o avatar).");
      return;
    }
    setErro(null);
    start(async () => {
      const r = await gerarCardsVisuais({
        rotinaId,
        tema: tema.trim(),
        usarAvatar,
        avatarId: usarAvatar ? avatarId || undefined : undefined,
      });
      if (!r.ok) {
        setErro(r.error);
        return;
      }
      router.refresh();
    });
  }

  const nome = nomeMembro ?? "a pessoa";

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-brand-purple/15 bg-kolo-lilas-bg-2/40 p-4 print:hidden">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-brand-yellow/25 text-[#8B5A00]">
          <Wand2 className="size-5" aria-hidden />
        </span>
        <div className="flex-1">
          <p className="flex items-center gap-2 font-heading text-base font-medium text-foreground">
            <StepBadge n={2} /> {jaTem ? "Refazer os cartões ilustrados" : "Ilustrar e gerar os cartões"}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {usarAvatar
              ? `A Kolo ilustra cada passo com o avatar de ${nome} como personagem. Um tema é opcional, só pra ambientar. Suas atividades e a ordem não mudam.`
              : "A Kolo escreve uma historinha e ilustra cada passo com um personagem do tema (o mesmo em todos). Suas atividades e a ordem não mudam."}
          </p>

          {/* Escolha: avatar da criança × tema (só se houver avatar) */}
          {temAvatar && (
            <div className="mt-3 inline-flex rounded-full border border-foreground/10 bg-white p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setUsarAvatar(true)}
                className={cn(
                  "rounded-full px-3 py-1.5 transition-colors",
                  usarAvatar ? "bg-brand-purple text-white" : "text-foreground/60 hover:text-foreground",
                )}
              >
                Avatar de {nome}
              </button>
              <button
                type="button"
                onClick={() => setUsarAvatar(false)}
                className={cn(
                  "rounded-full px-3 py-1.5 transition-colors",
                  !usarAvatar ? "bg-brand-purple text-white" : "text-foreground/60 hover:text-foreground",
                )}
              >
                Por um tema
              </button>
            </div>
          )}
          {usarAvatar && avatares.length > 1 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {avatares.map((a) => {
                const ativo = a.id === avatarId;
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setAvatarId(a.id)}
                    aria-pressed={ativo}
                    className={cn(
                      "relative overflow-hidden rounded-lg border-2 transition-colors",
                      ativo ? "border-brand-purple" : "border-transparent hover:border-brand-purple/40",
                    )}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt="Avatar" className="size-12 object-cover" />
                    {a.selecionado && (
                      <span className="absolute inset-x-0 bottom-0 bg-brand-purple/85 py-px text-center text-[8px] font-semibold uppercase text-white">
                        em uso
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
          {!temAvatar && (
            <p className="mt-2 text-xs text-muted-foreground">
              Quer usar a carinha de {nome}?{" "}
              <Link href="/configuracoes/avatar" className="font-semibold text-brand-purple underline-offset-2 hover:underline">
                Criar avatar
              </Link>{" "}
              (sua lista fica salva — é só voltar).
            </p>
          )}

          {erro && <p className="mt-2 text-sm text-destructive">{erro}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            <Input
              value={tema}
              onChange={(e) => setTema(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && gerar()}
              placeholder={
                usarAvatar ? "Tema (opcional) — ex.: praia, espaço…" : "Tema (ex.: carros, dinossauros, espaço…)"
              }
              className="max-w-xs"
              disabled={pending}
            />
            <Button type="button" onClick={gerar} disabled={pending || (!usarAvatar && !tema.trim())}>
              {pending ? (
                <>
                  <span className="animate-pulse" aria-hidden>⏳</span> Começando…
                </>
              ) : (
                <>
                  <Wand2 className="size-4" aria-hidden /> {jaTem ? "Refazer" : "Gerar cartões"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
