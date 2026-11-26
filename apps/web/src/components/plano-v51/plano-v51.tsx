"use client";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { aplicarPlano, criarPlanoV51, dataLocal, diaPlano, etapaConcluida, ETAPAS, PASSOS, perguntasPendentes, type AcaoPlano, type ConteudoPlano, type MembroPlano, type PlanoV51, type Resultado, } from "@/lib/plano-v51/dominio";
import "./plano-v51.css";
type Escopo = {
    familyId: string;
    membroId: string;
};
/** Portas explícitas: testes substituem o transporte, nunca fingem uma chamada de IA real.
 * Sem adaptador confirmado de escrita, a interface mantém apenas a sessão local. */
export type ServicosPlanoV51 = {
    preparar: (p: Escopo & {
        relato: string;
        titulo: string;
    }) => Promise<ConteudoPlano>;
    iniciar?: (p: Escopo & {
        relato: string;
        titulo: string;
        requisicaoId: string;
    }) => Promise<PlanoV51>;
    conversar?: (p: Escopo & {
        texto: string;
        plano?: PlanoV51;
        mensagens: {
            papel: "user" | "assistant";
            texto: string;
        }[];
    }) => Promise<string>;
    persistir?: (p: {
        planoId: string;
        membroId: string;
        revisao: number;
        eventos: {
            id: string;
            acao: AcaoPlano;
        }[];
    }) => Promise<PlanoV51>;
};
type Props = {
    familyId: string;
    nome: string;
    membros: MembroPlano[];
    servicos: ServicosPlanoV51;
    planosIniciais?: PlanoV51[];
    planoInicialId?: string;
    interno?: boolean;
    agora?: () => string;
};
type Rascunho = {
    relato: string;
    assunto: string;
    enviado: boolean;
    somenteConversar: boolean;
    mensagens: {
        papel: "user" | "assistant";
        texto: string;
    }[];
};
const vazio = (): Rascunho => ({ relato: "", assunto: "", enviado: false, somenteConversar: false, mensagens: [] });
const hoje = () => new Date().toISOString();
const RESULTADOS: {
    id: Resultado;
    texto: string;
}[] = [{ id: "ajudou", texto: "Ajudou" }, { id: "parcial", texto: "Ajudou em parte" }, { id: "nao_mudou", texto: "Não mudou desta vez" }, { id: "incerto", texto: "Ainda não sei" }];
const data = (s: string) => new Date(s.length === 10 ? `${s}T12:00:00` : s).toLocaleDateString("pt-BR", { day: "numeric", month: "short" });
function Botao({ texto, onClick, secundario, disabled, bloqueado }: {
    texto: string;
    onClick: () => void;
    secundario?: boolean;
    disabled?: boolean;
    bloqueado?: boolean;
}) {
    return <button type="button" className={`pv-btn ${secundario ? "ghost" : ""}`} disabled={bloqueado || disabled} onClick={onClick}>{texto}</button>;
}
export function PlanoV51({ familyId, nome, membros, servicos, planosIniciais = [], planoInicialId, interno = false, agora = hoje }: Props) {
    // Não selecionar automaticamente o primeiro filho, mesmo no painel de teste.
    const inicial = planosIniciais.find(p => p.id === planoInicialId && p.familyId === familyId && membros.some(m => m.id === p.membroId));
    const [membroId, setMembroId] = useState(inicial?.membroId ?? "");
    const [rascunhos, setRascunhos] = useState<Record<string, Rascunho>>({});
    const [planos, setPlanos] = useState<PlanoV51[]>(() => planosIniciais.filter(p => p.familyId === familyId && membros.some(m => m.id === p.membroId)));
    const [aberto, setAberto] = useState<string | null>(inicial?.id ?? null);
    const [prioridades, setPrioridades] = useState<Record<string, string>>({});
    const [gaveta, setGaveta] = useState<"ayla" | "ficha" | "trilha" | null>(null);
    const [erro, setErro] = useState("");
    const [aviso, setAviso] = useState("");
    const [ocupado, setOcupado] = useState(false);
    const [chat, setChat] = useState("");
    const [formulario, setFormulario] = useState(false);
    const [relatoTentativa, setRelatoTentativa] = useState("");
    const [tentou, setTentou] = useState<"sim" | "nao" | null>(null);
    const [resultado, setResultado] = useState<Resultado | null>(null);
    const [aprendizado, setAprendizado] = useState("");
    const [melhoria, setMelhoria] = useState<Record<string, string>>({});
    const [confirmaMelhoria, setConfirmaMelhoria] = useState<Record<string, boolean>>({});
    const [nota, setNota] = useState(0);
    const [comentario, setComentario] = useState("");
    const trava = useRef(false);
    const pendentes = useRef<Record<string, {
        id: string;
        acao: AcaoPlano;
    }[]>>({});
    const requisicao = useRef<string | null>(null);
    const geracao = useRef(0);
    const tituloRef = useRef<HTMLHeadingElement>(null);
    const membro = membros.find(m => m.id === membroId);
    const rascunho = rascunhos[membroId] ?? vazio();
    const p = planos.find(p => p.id === aberto && p.familyId === familyId && p.membroId === membroId);
    const doMembro = planos.filter(p => p.familyId === familyId && p.membroId === membroId);
    const passo = p ? PASSOS[p.passo] : null;
    const estrategia = p?.conteudo.estrategias.find(e => e.id === p.estrategiaId);
    useEffect(() => {
        if (!gaveta)
            return;
        const anterior = document.activeElement as HTMLElement | null;
        const dialog = document.querySelector<HTMLElement>(".pv51 [role=dialog]");
        dialog?.querySelector<HTMLElement>("button, input, textarea")?.focus();
        function tecla(e: KeyboardEvent) {
            if (e.key === "Escape") {
                setGaveta(null);
                return;
            }
            if (e.key !== "Tab" || !dialog)
                return;
            const campos = [...dialog.querySelectorAll<HTMLElement>("button:not(:disabled), input, textarea, [tabindex='0']")];
            const primeiro = campos[0], ultimo = campos.at(-1);
            if (e.shiftKey && document.activeElement === primeiro) {
                e.preventDefault();
                ultimo?.focus();
            }
            else if (!e.shiftKey && document.activeElement === ultimo) {
                e.preventDefault();
                primeiro?.focus();
            }
        }
        document.addEventListener("keydown", tecla);
        return () => { document.removeEventListener("keydown", tecla); anterior?.focus(); };
    }, [gaveta]);
    function atualizarRascunho(valores: Partial<Rascunho>, alvo = membroId) {
        if (valores.relato !== undefined || valores.assunto !== undefined)
            requisicao.current = null;
        setRascunhos(v => ({ ...v, [alvo]: { ...(v[alvo] ?? vazio()), ...valores } }));
    }
    function trocarMembro(id: string) {
        if (ocupado)
            return;
        geracao.current++;
        requisicao.current = null;
        setMembroId(id);
        setAberto(null);
        setGaveta(null);
        setErro("");
        setAviso("");
        setFormulario(false);
        setRelatoTentativa("");
        setTentou(null);
        setResultado(null);
        setChat("");
        setNota(0);
        setComentario("");
        setMelhoria({});
        setConfirmaMelhoria({});
    }
    async function agir(acao: AcaoPlano): Promise<boolean> {
        if (!p || trava.current)
            return false;
        const eventoId = crypto.randomUUID();
        const res = aplicarPlano(p, { familyId, membroId, eventoId, agora: agora(), acao });
        if (!res.ok) {
            setErro(res.erro);
            return false;
        }
        const evento = { id: eventoId, acao };
        // Digitação é rascunho local. Confirmar/avançar envia o lote, evitando uma escrita por tecla.
        if (acao.tipo === "contexto" || acao.tipo === "combinado") {
            pendentes.current[p.id] = [...(pendentes.current[p.id] ?? []).filter(e => !(e.acao.tipo === acao.tipo && "campo" in e.acao && e.acao.campo === acao.campo)), evento];
            setPlanos(v => v.map(x => x.id === p.id ? res.plano : x));
            setAviso("Alteração em rascunho. Continue para confirmar a gravação.");
            return true;
        }
        trava.current = true;
        setOcupado(true);
        setErro("");
        try {
            const eventos = [...(pendentes.current[p.id] ?? []), evento];
            const confirmado = servicos.persistir ? await servicos.persistir({ planoId: p.id, membroId, revisao: p.revisao, eventos }) : res.plano;
            setPlanos(v => v.map(x => x.id === p.id ? confirmado : x));
            pendentes.current[p.id] = [];
            setAviso(servicos.persistir ? "Gravação confirmada." : "Atualizado nesta sessão. Ainda não foi salvo na sua conta.");
            if (["avancar", "navegar", "confirmar"].includes(acao.tipo)) {
                setGaveta(null);
                tituloRef.current?.focus();
            }
            return true;
        }
        catch (e) {
            setErro(e instanceof Error ? e.message : "Não foi possível confirmar a operação.");
            return false;
        }
        finally {
            trava.current = false;
            setOcupado(false);
        }
    }
    async function criar() {
        if (!membro || !rascunho.relato.trim() || !rascunho.assunto.trim() || trava.current)
            return;
        trava.current = true;
        setOcupado(true);
        setErro("");
        const versao = ++geracao.current, alvo = membroId;
        try {
            requisicao.current ??= crypto.randomUUID();
            const novo = servicos.iniciar
                ? await servicos.iniciar({ familyId, membroId: alvo, relato: rascunho.relato, titulo: rascunho.assunto, requisicaoId: requisicao.current })
                : criarPlanoV51({ id: crypto.randomUUID(), familyId, membro, titulo: rascunho.assunto, relato: rascunho.relato, conteudo: await servicos.preparar({ familyId, membroId: alvo, relato: rascunho.relato, titulo: rascunho.assunto }), agora: agora() });
            if (versao !== geracao.current)
                return;
            setPlanos(v => [...v.filter(x => x.id !== novo.id), novo]);
            requisicao.current = null;
            setAviso(servicos.iniciar ? "Plano salvo com confirmação." : "Plano criado apenas nesta sessão.");
            setPrioridades(v => v[alvo] ? v : { ...v, [alvo]: novo.id });
            setAberto(novo.id);
        }
        catch (e) {
            setErro(e instanceof Error ? e.message : "Não consegui preparar o plano.");
        }
        finally {
            trava.current = false;
            setOcupado(false);
        }
    }
    async function conversar(e: FormEvent) {
        e.preventDefault();
        if (!chat.trim() || !membro || trava.current)
            return;
        if (!servicos.conversar) {
            setErro("A conversa da Ayla ainda não está conectada neste painel. Nenhuma resposta foi gerada.");
            return;
        }
        trava.current = true;
        setOcupado(true);
        setErro("");
        const texto = chat.trim(), alvo = membroId, versao = geracao.current;
        const mensagens = [...rascunho.mensagens, { papel: "user" as const, texto }];
        try {
            const resposta = await servicos.conversar({ familyId, membroId: alvo, texto, plano: p, mensagens });
            if (versao !== geracao.current)
                return;
            atualizarRascunho({ mensagens: [...mensagens, { papel: "assistant", texto: resposta }] }, alvo);
            setChat("");
        }
        catch {
            setErro("A Ayla não conseguiu responder. Sua mensagem continua aqui para tentar de novo.");
        }
        finally {
            trava.current = false;
            setOcupado(false);
        }
    }
    function abrirFormulario() {
        setTentou(null);
        setResultado(null);
        setRelatoTentativa("");
        setAprendizado("");
        setFormulario(true);
    }
    const selo = (texto: string, tipo = "") => <span className={`pv-tag ${tipo}`}>{texto}</span>;
    function ficha() {
        return <div className="pv-ficha"><h2>Ficha do caso</h2><section>{selo("Você contou hoje", "told")}<blockquote>{p?.relatoHoje ?? rascunho.relato}</blockquote></section><section>{selo("Do cadastro")}<ul>{membro?.cadastro.map((c, i) => <li key={i}>{c.texto}<small>{c.origem}{c.atualizadoEm ? ` · ${data(c.atualizadoEm)}` : ""}</small></li>)}</ul>{!membro?.cadastro.length && <p>Nenhuma informação do cadastro disponível neste painel.</p>}</section><section>{selo("Hipóteses da Ayla", "hyp")}<p>São possibilidades, não fatos confirmados.</p>{p?.conteudo.olhares.map(o => <p key={o.id}>{o.titulo}<q>Origem: “{o.origem.frase}”</q></p>)}</section><section>{selo("Ainda não sabemos")}<ul>{p ? p.conteudo.perguntas.filter(q => !q.respondidaNoContexto && (!p.respostas[q.id] || p.respostas[q.id] === "Não sei / não reparei")).map(q => <li key={q.id}>{q.texto}</li>) : <li>O que ainda precisar ser compreendido sobre este desafio.</li>}</ul></section></div>;
    }
    const chatForm = <form className="pv-chat-form" onSubmit={conversar}><label className="pv-sr" htmlFor="pv-chat">Escreva para a Ayla</label><input id="pv-chat" value={chat} onChange={e => setChat(e.target.value)} placeholder="Pergunte sobre este plano…" disabled={ocupado || !servicos.conversar}/><button disabled={ocupado || !servicos.conversar || !chat.trim()} aria-label="Enviar para a Ayla">↑</button></form>;
    function ayla() {
        return <><header><span className="pv-avatar">A</span><div><b>Ayla</b><small>{passo?.nome ?? "Conversando com você"}</small></div></header><div className="pv-messages"><p>{passo?.id === "experimentar" ? "Quando experimentar, conte o que aconteceu. Uma tentativa é diferente de uma conquista." : passo?.id === "perguntas" ? "Só o que pode mudar a orientação. Se não souber, podemos observar depois." : "Vamos cuidar de um assunto de cada vez, com espaço para o que fizer sentido na sua rotina."}</p>{rascunho.mensagens.map((m, i) => <p key={i} className={m.papel === "user" ? "user" : ""}>{m.texto}</p>)}{!servicos.conversar && <small>Conversa ainda não conectada neste painel. Não há respostas automáticas simuladas.</small>}</div>{chatForm}</>;
    }
    function trilha() {
        if (!p || !passo)
            return null;
        return <><small>PLANO DE {membro?.nome.toLocaleUpperCase()}</small><h2>{p.titulo}</h2>{ETAPAS.map((etapa, i) => <div key={etapa} className={`pv-stage ${passo.etapa === i ? "current" : ""}`}><button disabled={ocupado || (!p.confirmado && PASSOS.findIndex(s => s.etapa === i) > p.alcance)} onClick={() => void agir({ tipo: "navegar", passo: PASSOS.findIndex(s => s.etapa === i) })}><span>{etapaConcluida(p, i) ? "✓" : i + 1}</span>{etapa}</button>{passo.etapa === i && <ul>{PASSOS.map((s, j) => s.etapa === i && <li key={s.id}><button aria-current={j === p.passo ? "step" : undefined} disabled={ocupado || (!p.confirmado && j > p.alcance)} onClick={() => void agir({ tipo: "navegar", passo: j })}>{s.nome}</button></li>)}</ul>}</div>)}<button className="pv-link" onClick={() => setGaveta("ficha")}>Ficha do caso</button></>;
    }
    const avancar = () => void agir({ tipo: "avancar" });
    function corpo(): ReactNode {
        if (!p || !passo)
            return null;
        switch (passo.id) {
            case "saber": return <><p className="pv-lead">O relato de hoje e o cadastro ficam separados. O histórico ajuda internamente, sem virar um novo episódio neste plano.</p>{ficha()}</>;
            case "perguntas": {
                const q = perguntasPendentes(p)[0];
                return q ? <>{<Escolhas label={q.texto} opcoes={[...q.opcoes, "Não sei / não reparei"]} valor={""} escolher={valor => void agir({ tipo: "responder", perguntaId: q.id, resposta: valor })} bloqueado={ocupado}/>}<p className="pv-muted">Uma pergunta de cada vez. Não saber também é uma resposta.</p></> : <div className="pv-box"><p>Já temos as respostas disponíveis para seguir.</p></div>;
            }
            case "voce": return <>{<Escolhas label={"Como você está nessa hora?"} opcoes={["Cansada", "Preocupada", "Irritada", "Tranquila", "Prefiro não responder"]} valor={p.sentimento} escolher={valor => void agir({ tipo: "contexto", campo: "sentimento", valor })} bloqueado={ocupado}/>}{<Escolhas label={"Sua bateria para esta semana"} opcoes={["Quase vazia", "Pela metade", "Carregada", "Não sei dizer"]} valor={p.bateria} escolher={valor => void agir({ tipo: "contexto", campo: "bateria", valor })} bloqueado={ocupado}/>}</>;
            case "olharCrianca":
            case "olharAdulto": {
                const olhares = p.conteudo.olhares.filter(o => o.sobre === (passo.id === "olharCrianca" ? "crianca" : "adulto"));
                return <><p className="pv-lead">Hipóteses, não certezas. Cada olhar mostra sua frase de origem.</p>{olhares.length ? olhares.map(o => <OlharCard key={o.id} olhar={o}/>) : <div className="pv-box">Ainda não há um olhar fundamentado para esta parte. Podemos seguir sem inventar uma explicação.</div>}</>;
            }
            case "funciona": return <label>Em que momentos fica um pouco mais fácil?<textarea value={p.funciona} onChange={e => void agir({ tipo: "contexto", campo: "funciona", valor: e.target.value })} placeholder="Se ainda não reparou, pode seguir sem preencher."/></label>;
            case "confere": return <>{ficha()}<p className="pv-muted">Se algo estiver diferente, volte à etapa correspondente para corrigir.</p></>;
            case "objetivo": return <><p className="pv-lead">Um passo possível de observar, ligado a este assunto.</p><label>Nosso objetivo<textarea value={p.objetivo} onChange={e => void agir({ tipo: "contexto", campo: "objetivo", valor: e.target.value })}/></label></>;
            case "caminhos": return <><p className="pv-lead">Escolha um para começar. As outras possibilidades podem ficar para depois.</p>{p.conteudo.estrategias.map(e => <section key={e.id} className={`pv-box pv-strategy ${p.estrategiaId === e.id ? "chosen" : ""}`}>{selo(p.estados[e.id] === "escolhido" ? "Escolhido" : "Sugestão da Ayla", "hyp")}<h2>{e.titulo}</h2><p>{e.porque}</p><ol>{e.como.map((x, i) => <li key={i}>{x}</li>)}</ol><div className="pv-actions">{<Botao texto={p.estrategiaId === e.id ? "Escolhido para começar" : "Começar por este"} onClick={() => void agir({ tipo: "escolher", estrategiaId: e.id })} bloqueado={ocupado} {...{ disabled: p.estrategiaId === e.id }}/>}{<Botao texto={p.depois.includes(e.id) ? "✓ Depois" : "Depois"} onClick={() => void agir({ tipo: "depois", estrategiaId: e.id })} bloqueado={ocupado} {...{ secundario: true }}/>}</div></section>)}</>;
            case "conversar": return <div className="pv-grid2"><section><h2>O que dizer</h2>{p.conteudo.dizer.map((d, i) => <button className="pv-talk" aria-pressed={p.frases.includes(i)} key={i} onClick={() => void agir({ tipo: "frase", indice: i })}><small>{d.momento}</small><b>“{d.frase}”</b><span>{d.detalhe}</span><em>{p.frases.includes(i) ? "✓ Vou usar" : "Quero usar"}</em></button>)}</section><section><h2>O que evitar, e por quê</h2>{p.conteudo.evitar.map((d, i) => <div className="pv-box" key={i}><b>× {d.frase}</b><p>{d.porque}</p></div>)}</section></div>;
            case "combinado": return <div className="pv-grid2"><section><h2>Possibilidades</h2>{p.conteudo.estrategias.map(e => <div className="pv-box" key={e.id}>{selo(p.estrategiaId === e.id ? "Escolhida" : p.depois.includes(e.id) ? "Depois" : "Sugestão")}<h3>{e.titulo}</h3></div>)}</section><section className="pv-box pv-deal"><h2>{estrategia?.titulo}</h2><div className="pv-return"><small>QUANDO VOLTAR PARA CONTAR</small><label><span className="pv-sr">Data para voltar</span><input type="date" min={dataLocal(agora())} value={p.combinado.voltarEm} onChange={e => void agir({ tipo: "combinado", campo: "voltarEm", valor: e.target.value })}/></label><span>Ou antes, quando experimentar.</span></div>{p.bateria === "Quase vazia" && <p><b>Versão mínima:</b> {estrategia?.minima}</p>}<h3>Como experimentar</h3><ol>{estrategia?.como.map((s, i) => <li key={i}>{s}</li>)}</ol>{([["quando", "Quando"], ["frequencia", "Com que frequência"], ["quem", "Quem participa"]] as const).map(([campo, texto]) => <label key={campo}>{texto}<input value={p.combinado[campo]} onChange={e => void agir({ tipo: "combinado", campo, valor: e.target.value })} placeholder="Escolha o que cabe na sua rotina"/></label>)}<h3>O que observar</h3><ul>{p.conteudo.observar.map((s, i) => <li key={i}>{s}</li>)}</ul>{p.frases.length > 0 && <><h3>Frases escolhidas</h3>{p.frases.map(i => <p key={i}>“{p.conteudo.dizer[i].frase}”</p>)}</>}</section></div>;
            case "lembretes": return <><div className="pv-box"><h2>Lembretes desligados</h2><p>Nenhum canal, frequência ou horário foi autorizado.</p><p className="pv-muted">O envio ainda não está conectado nesta versão. Nada será enviado por aqui.</p></div><div className="pv-return"><small>QUANDO VOLTAR PARA CONTAR</small><b>{data(p.combinado.voltarEm)}, ou antes, quando experimentar</b></div>{<Botao texto={"Confirmar o combinado"} onClick={() => void agir({ tipo: "confirmar" })} bloqueado={ocupado}/>}</>;
            case "experimentar": return formulario ? <><p className="pv-lead">Só o que aconteceu nesta oportunidade. Nada vem preenchido.</p>{<Escolhas label={"Você conseguiu experimentar?"} opcoes={["Experimentei", "Não deu / ainda não teve oportunidade"]} valor={tentou === "sim" ? "Experimentei" : tentou === "nao" ? "Não deu / ainda não teve oportunidade" : ""} escolher={v => setTentou(v === "Experimentei" ? "sim" : "nao")} bloqueado={ocupado}/>}<label>O que aconteceu?<textarea aria-label="Relato da tentativa" value={relatoTentativa} onChange={e => setRelatoTentativa(e.target.value)} placeholder="Conte do seu jeito."/></label>{tentou === "sim" && <Escolhas label={"E o resultado?"} opcoes={RESULTADOS.map(r => r.texto)} valor={RESULTADOS.find(r => r.id === resultado)?.texto ?? ""} escolher={v => setResultado(RESULTADOS.find(r => r.texto === v)!.id)} bloqueado={ocupado}/>}<label>O que você aprendeu? (opcional)<textarea value={aprendizado} onChange={e => setAprendizado(e.target.value)}/></label><div className="pv-actions">{<Botao texto={"Cancelar"} onClick={() => setFormulario(false)} bloqueado={ocupado} {...{ secundario: true }}/>}{<Botao texto={servicos.persistir ? "Salvar relato" : "Registrar nesta sessão"} onClick={async () => {
                        if (!p.estrategiaId || !tentou)
                            return;
                        if (await agir({ tipo: "registrar", registro: { id: crypto.randomUUID(), estrategiaId: p.estrategiaId, origem: "web", tipo: tentou === "sim" ? "tentativa" : "sem_tentativa", relato: relatoTentativa, ...(tentou === "sim" && resultado ? { resultado } : {}), aprendizado } }))
                            setFormulario(false);
                    }} bloqueado={ocupado} {...{ disabled: !tentou || (tentou === "sim" && (!resultado || !relatoTentativa.trim())) }}/>}</div></> : <><div className="pv-now3"><div className="pv-box"><small>ONDE VOCÊ ESTÁ</small><b>Dia {diaPlano(p, agora())}</b><span>Começou em {data(p.combinado.confirmadoEm!)}</span></div><div className="pv-box pv-deal"><small>O QUE COMBINAMOS</small><b>{estrategia?.titulo}</b><span>Voltar: {data(p.combinado.voltarEm)}</span></div><div className="pv-box"><small>O QUE FAZER AGORA</small><b>{p.situacao === "ativo" ? "Experimentar e contar como foi" : p.situacao === "pausado" ? "Retomar quando fizer sentido" : "Combinado encerrado"}</b>{p.situacao === "ativo" ? <Botao texto={"Contar como foi"} onClick={abrirFormulario} bloqueado={ocupado}/> : p.situacao === "pausado" ? <Botao texto={"Retomar"} onClick={() => void agir({ tipo: "retomar" })} bloqueado={ocupado}/> : null}</div></div><div className="pv-actions">{selo(p.situacao === "ativo" ? "Ativo" : p.situacao === "pausado" ? "Pausado" : "Encerrado", "deal")}<span>Lembretes desligados</span>{p.situacao === "ativo" && <Botao texto={"Pausar"} onClick={() => void agir({ tipo: "pausar" })} bloqueado={ocupado} {...{ secundario: true }}/>}{p.situacao !== "encerrado" && <Botao texto={"Encerrar"} onClick={() => {
                        if (window.confirm("Encerrar este combinado? O histórico será preservado."))
                            void agir({ tipo: "encerrar" });
                    }} bloqueado={ocupado} {...{ secundario: true }}/>}</div><div className="pv-grid2"><section><h2>Diário do combinado</h2><div className="pv-box">{selo("Combinado escolhido", "deal")}<p>{estrategia?.titulo} · {data(p.combinado.confirmadoEm!)}</p></div>{!p.registros.length && <div className="pv-box"><p>Ainda não há tentativas.</p><p>Quando experimentar, conte aqui o que aconteceu.</p></div>}{registros()}</section><section><div className="pv-box"><h2>Continuidade pelo WhatsApp</h2><p>Não há mensagem enviada nem sincronização confirmada nesta versão.</p></div><div className="pv-box"><h2>Como foi esta orientação para você?</h2><p className="pv-muted">Sobre a orientação da Ayla, separado do resultado da tentativa.</p><div className="pv-stars" role="group" aria-label="Nota da orientação">{[1, 2, 3, 4, 5].map(i => <button key={i} aria-label={`${i} estrela${i > 1 ? "s" : ""}`} aria-pressed={nota === i} onClick={() => setNota(i)}>{i <= nota ? "★" : "☆"}</button>)}</div><label>Comentário (opcional)<textarea value={comentario} onChange={e => setComentario(e.target.value)}/></label>{<Botao texto={"Registrar avaliação"} onClick={() => void agir({ tipo: "feedback", nota, comentario })} bloqueado={ocupado} {...{ disabled: !nota }}/>}{p.feedback && <p>Avaliação registrada {servicos.persistir ? "com confirmação" : "nesta sessão"}: {p.feedback.nota} de 5.</p>}</div></section></div>{<Botao texto={"Ver a evolução"} onClick={() => void agir({ tipo: "navegar", passo: 13 })} bloqueado={ocupado} {...{ secundario: true }}/>}</>;
            case "evoluir": return <><p className="pv-lead">Só o que vocês realmente contaram. Resultados e conquistas permanecem separados.</p><div className="pv-grid2"><div className="pv-box"><h2>Conquistas confirmadas</h2>{p.registros.some(r => r.conquista) ? p.registros.filter(r => r.conquista).map(r => <blockquote key={r.id}>“{r.conquista!.melhoria}”<small>{data(r.conquista!.confirmadaEm)} · {r.origem === "web" ? "aqui" : "pelo WhatsApp"}</small></blockquote>) : <p>Nenhuma conquista confirmada ainda. E tudo bem.</p>}</div><div className="pv-box"><h2>Aprendizados</h2>{p.registros.some(r => r.aprendizado) ? p.registros.filter(r => r.aprendizado).map(r => <p key={r.id}>{r.aprendizado}</p>) : <p>Ainda não há aprendizados registrados.</p>}</div></div>{registros()}{<Botao texto={"Voltar para Experimentar"} onClick={() => void agir({ tipo: "navegar", passo: 12 })} bloqueado={ocupado} {...{ secundario: true }}/>}</>;
        }
    }
    function registros() {
        return p?.registros.map(r => <article className="pv-box" key={r.id}><small>{r.origem === "web" ? "aqui" : "pelo WhatsApp"} · {data(r.em)}</small><p>{r.relato || "Ainda não houve oportunidade de experimentar."}</p>{selo(r.tipo === "sem_tentativa" ? "Sem tentativa" : "Resultado observado")}{r.resultado && <p>{RESULTADOS.find(x => x.id === r.resultado)?.texto}</p>}{r.aprendizado && <p><b>Aprendizado:</b> {r.aprendizado}</p>}{r.conquista ? <p className="pv-confirmed">Conquista confirmada: {r.conquista.melhoria}</p> : (r.resultado === "ajudou" || r.resultado === "parcial") && <div className="pv-conquest"><p>O resultado ajudou. Para reconhecer uma conquista, precisamos saber o que melhorou.</p><label>O que melhorou?<textarea value={melhoria[r.id] ?? ""} onChange={e => setMelhoria(v => ({ ...v, [r.id]: e.target.value }))}/></label><label className="pv-check"><input type="checkbox" checked={confirmaMelhoria[r.id] ?? false} onChange={e => setConfirmaMelhoria(v => ({ ...v, [r.id]: e.target.checked }))}/>Confirmo que essa melhoria aconteceu.</label>{<Botao texto={"Confirmar conquista"} onClick={() => void agir({ tipo: "conquista", registroId: r.id, melhoria: melhoria[r.id] ?? "", confirma: confirmaMelhoria[r.id] ?? false })} bloqueado={ocupado} {...{ disabled: !(melhoria[r.id]?.trim() && confirmaMelhoria[r.id]) }}/>}</div>}</article>);
    }
    return <div className="pv51" data-testid="plano-v51">
    {interno && <div className="pv-internal"><b>Painel interno · Demonstração</b><span>Personagens fictícios. Sem gravação na conta, IA real ou envios.</span></div>}
    {!servicos.persistir && <p className="pv-session">Sessão local: ao sair ou recarregar, este trabalho não fica salvo.</p>}
    <header className="pv-bar"><div className="pv-logo">Kolo<span>.</span><small>FAMÍLIA</small></div><div className="pv-kids" role="group" aria-label="Escolha a criança">{membros.map(m => <button key={m.id} aria-pressed={m.id === membroId} disabled={ocupado} onClick={() => trocarMembro(m.id)}><span>{m.nome.slice(0, 1)}</span>{m.nome}</button>)}</div><button className="pv-link" onClick={() => { setAberto(null); setFormulario(false); }}>Ayla</button></header>
    <div role="status" className="pv-status">{ocupado ? "Aguarde…" : aviso}</div>{erro && <p role="alert" className="pv-error">{erro}</p>}
    {!p ? <main className="pv-entry"><div className="pv-eyebrow">AYLA</div><h1>Oi, {nome}. <em>O que está pesando hoje?</em></h1>{!membro ? <p>Escolha a criança para começar. Cada plano fica com o membro certo.</p> : <><p className="pv-lead">Conversando sobre {membro.nome}. Um assunto de cada vez.</p>{doMembro.length > 0 && <section className="pv-plan-list"><h2>Planos de {membro.nome}</h2>{doMembro.map(plano => <div key={plano.id} className="pv-box"><button className="pv-link" onClick={() => { setAberto(plano.id); setFormulario(false); }}>{plano.titulo} · {PASSOS[plano.passo].nome}</button><button className="pv-link" aria-pressed={prioridades[membroId] === plano.id} onClick={() => setPrioridades(v => ({ ...v, [membroId]: plano.id }))}>{prioridades[membroId] === plano.id ? "Prioritário nesta sessão" : "Tornar prioritário nesta sessão"}</button></div>)}</section>}{doMembro.length === 0 && <p className="pv-muted">Ainda não há plano para {membro.nome} nesta sessão.</p>}<section className="pv-compose"><label htmlFor="pv-relato">Conte do seu jeito</label><textarea id="pv-relato" value={rascunho.relato} disabled={rascunho.enviado} onChange={e => atualizarRascunho({ relato: e.target.value })} placeholder="O que aconteceu? O que você gostaria de entender ou mudar?"/>{!rascunho.enviado ? <Botao texto={"Enviar relato"} onClick={() => atualizarRascunho({ enviado: true })} bloqueado={ocupado} {...{ disabled: !rascunho.relato.trim() }}/> : <><p>Podemos continuar conversando ou organizar um plano sobre um único assunto.</p><label>Qual assunto vamos cuidar neste plano?<input value={rascunho.assunto} onChange={e => atualizarRascunho({ assunto: e.target.value })} placeholder="Dê um nome curto para este assunto"/></label><div className="pv-invite"><h2>Quer transformar isso num plano?</h2><p>Entender melhor, escolher uma mudança possível e acompanhar o que acontecer.</p>{<Botao texto={interno ? "Criar plano de teste" : "Criar o plano"} onClick={() => void criar()} bloqueado={ocupado} {...{ disabled: !rascunho.assunto.trim() }}/>}{<Botao texto={"Agora quero só conversar"} onClick={() => atualizarRascunho({ somenteConversar: true })} bloqueado={ocupado} {...{ secundario: true }}/>}</div>{rascunho.somenteConversar && <section className="pv-freechat">{ayla()}</section>}{<Botao texto={"Quero corrigir meu relato"} onClick={() => atualizarRascunho({ enviado: false })} bloqueado={ocupado} {...{ secundario: true }}/>}</>}</section></>}</main> : <>
      <div className="pv-mobile-stage"><button aria-label="Abrir trilha" onClick={() => setGaveta("trilha")}>☰</button><div><b>{p.titulo} · {passo!.etapa + 1}. {ETAPAS[passo!.etapa]}</b><small>{passo!.nome}</small></div><button onClick={() => setGaveta("ficha")}>Ficha</button><button onClick={() => setGaveta("ayla")}>Ayla</button></div>
      {p.cuidado?.emAberto && <div className="pv-care"><b>Cuidado em aberto</b><span>{p.cuidado.risco === "agora" ? "Está acontecendo agora. O cuidado vem antes do plano." : "A situação de cuidado continua em acompanhamento."}</span><q>“{p.cuidado.frase}”</q><small>Orientação de cuidado pendente de revisão. Nenhum texto clínico do protótipo foi publicado.</small></div>}
      <div className="pv-layout"><nav className="pv-rail" aria-label="Trilha do plano">{trilha()}</nav><main className="pv-main"><div className="pv-eyebrow">{ETAPAS[passo!.etapa]}</div><h1 ref={tituloRef} tabIndex={-1}>{formulario ? "Como foi?" : passo!.id === "olharCrianca" ? `Olhares sobre ${membro?.nome}` : passo!.nome}</h1>{corpo()}{p.passo < 11 && <footer className="pv-actions">{p.passo > 0 && <Botao texto={"Voltar"} onClick={() => void agir({ tipo: "navegar", passo: p.passo - 1 })} bloqueado={ocupado} {...{ secundario: true }}/>}{<Botao texto={passo!.id === "confere" ? "Conferi, podemos seguir" : "Continuar"} onClick={avancar} bloqueado={ocupado} {...{ disabled: (passo!.id === "perguntas" && perguntasPendentes(p).length > 0) || (passo!.id === "caminhos" && !p.estrategiaId) }}/>}</footer>}</main><aside className="pv-ayla" aria-label="Conversa com a Ayla">{ayla()}</aside></div>
    </>}
    {gaveta && <div className="pv-overlay" onMouseDown={e => {
                if (e.target === e.currentTarget)
                    setGaveta(null);
            }}><section className="pv-drawer" role="dialog" aria-modal="true" aria-label={gaveta === "ayla" ? "Ayla" : gaveta === "ficha" ? "Ficha do caso" : "Trilha do plano"}><button className="pv-close" aria-label="Fechar painel" onClick={() => setGaveta(null)}>×</button>{gaveta === "ayla" ? ayla() : gaveta === "ficha" ? ficha() : trilha()}</section></div>}
  </div>;
}
function OlharCard({ olhar }: {
    olhar: ConteudoPlano["olhares"][number];
}) {
    const [guia, setGuia] = useState(false), [pagina, setPagina] = useState(0);
    return <article className="pv-box pv-olhar"><span className="pv-tag hyp">Hipótese da Ayla</span><h2>{olhar.titulo}</h2><p className="pv-source">Por que penso nisso · {olhar.origem.tipo === "relato_hoje" ? "Você contou hoje" : "Do cadastro"}<q>“{olhar.origem.frase}”</q></p><button className="pv-link" aria-pressed={guia} onClick={() => setGuia(!guia)}>{guia ? "Ver conteúdo completo" : "Quero uma leitura guiada"}</button>{(guia ? olhar.blocos.slice(pagina, pagina + 1) : olhar.blocos).map(b => <section key={b.titulo}><h3>{b.titulo}</h3><p>{b.texto}</p></section>)}{guia && <div className="pv-actions"><button className="pv-btn ghost" disabled={pagina === 0} onClick={() => setPagina(pagina - 1)}>Anterior</button><span>{pagina + 1} de {olhar.blocos.length}</span><button className="pv-btn" disabled={pagina === olhar.blocos.length - 1} onClick={() => setPagina(pagina + 1)}>Próximo</button></div>}</article>;
}
function Escolhas({ label, opcoes, valor, escolher, bloqueado }: {
    label: string;
    opcoes: string[];
    valor: string;
    escolher: (v: string) => void;
    bloqueado: boolean;
}) {
    return <fieldset className="pv-field"><legend>{label}</legend><div className="pv-chips">{opcoes.map(o => <button type="button" key={o} disabled={bloqueado} aria-pressed={valor === o} onClick={() => escolher(o)}>{o}</button>)}</div></fieldset>;
}
