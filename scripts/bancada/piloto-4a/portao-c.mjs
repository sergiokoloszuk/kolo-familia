/**
 * PORTÃO C — personalização real. Mesmo desafio, três crianças diferentes.
 *
 * O critério é duro de propósito: trocar o nome do interesse NÃO conta. A
 * estratégia, a linguagem, o apoio ou a condução têm que mudar quando o perfil
 * justificar.
 *
 *   node scripts/bancada/piloto-4a/portao-c.mjs
 */
import {
  mod, chamarWeb, chamarWhatsApp, ctxWeb, perfilSintetico, recuperarReal,
  base2Real, supabaseStub, FAMILIA_PILOTO, linha, caixa,
} from "./comum.mjs";
import { writeFileSync } from "node:fs";

const { classificarIntencao } = await mod("lib/ia/intencao.ts");
const { blocoBoasPraticas } = await mod("lib/conhecimento/recuperar.ts");

const out = [];
const w = (s) => { out.push(s); console.log(s); };

/** O MESMO desafio para os três. */
const DESAFIO = "Ele trava para começar qualquer atividade que não quer fazer. Fica parado, enrola, e às vezes chora antes mesmo de tentar.";

const PERFIS = [
  {
    id: "A · 4 anos · palavras curtas · carrinhos · sensível a barulho · muito apoio",
    nome: "Léo", idade: 4, perfil: "TEA", genero: "masculino",
    secoes: {
      essencial: "Léo, 4 anos. INTERESSES: carrinhos. Precisa de bastante apoio do adulto para iniciar e sustentar tarefa.",
      comunicacao: "Fala por palavras e frases curtas. Entende comandos simples de uma etapa.",
      sensorial: "Sensibilidade a barulho — ambientes com muito som o desorganizam.",
    },
    perfilConsultavel: perfilSintetico({
      comunicacao: { label: "Comunicação", campos: [
        { key: "expressao", label: "fala por palavras/frases curtas", estado: "preenchido", valor: "palavras e frases curtas" },
        { key: "compreensao", label: "entende comandos simples", estado: "preenchido", valor: "comandos de uma etapa" },
        { key: "leitura", label: "lê", estado: "negativo" },
      ]},
      sensorial: { label: "Sensorial", campos: [
        { key: "som", label: "sensibilidade a barulho", estado: "preenchido", valor: "desorganiza com muito som" },
        { key: "tato", label: "sensibilidade tátil", estado: "vazio" },
      ]},
      interesses: { label: "Interesses", campos: [
        { key: "fortes", label: "interesses fortes", estado: "preenchido", valor: "carrinhos" },
      ]},
      autonomia: { label: "Autonomia", campos: [
        { key: "apoio", label: "nível de apoio necessário", estado: "preenchido", valor: "bastante apoio do adulto" },
      ]},
    }),
  },
  {
    id: "B · 9 anos · verbal · lê · futebol · segue sequência escrita",
    nome: "Rafa", idade: 9, perfil: "TDAH", genero: "masculino",
    secoes: {
      essencial: "Rafa, 9 anos. INTERESSES: futebol. Consegue seguir uma sequência escrita.",
      comunicacao: "Verbal, boa compreensão, lê bem.",
      aprendizado: "A dificuldade maior é INICIAR tarefas pouco interessantes; depois de começar, sustenta.",
    },
    perfilConsultavel: perfilSintetico({
      comunicacao: { label: "Comunicação", campos: [
        { key: "expressao", label: "verbal, vocabulário amplo", estado: "preenchido", valor: "fala bem" },
        { key: "leitura", label: "lê", estado: "preenchido", valor: "lê bem" },
      ]},
      aprendizado: { label: "Aprendizado", campos: [
        { key: "iniciar", label: "dificuldade de iniciar", estado: "preenchido", valor: "trava no começo de tarefa pouco interessante" },
        { key: "sequencia", label: "segue sequência escrita", estado: "preenchido", valor: "sim" },
      ]},
      interesses: { label: "Interesses", campos: [
        { key: "fortes", label: "interesses fortes", estado: "preenchido", valor: "futebol" },
      ]},
      sensorial: { label: "Sensorial", campos: [
        { key: "som", label: "sensibilidade a som", estado: "negativo" },
      ]},
    }),
  },
  {
    id: "C · 7 anos · fala + apoio visual · animais · NÃO gosta de futebol nem carrinhos · sensível ao toque",
    nome: "Bia", idade: 7, perfil: "TEA", genero: "feminino",
    secoes: {
      essencial: "Bia, 7 anos. INTERESSES: animais. NÃO gosta de futebol nem de carrinhos. Mudanças inesperadas são difíceis.",
      comunicacao: "Usa fala combinada com apoio visual (figuras).",
      sensorial: "Sensibilidade tátil — reage a toque inesperado e a certas texturas.",
    },
    perfilConsultavel: perfilSintetico({
      comunicacao: { label: "Comunicação", campos: [
        { key: "expressao", label: "fala com apoio visual", estado: "preenchido", valor: "fala + figuras" },
        { key: "leitura", label: "lê", estado: "vazio" },
      ]},
      sensorial: { label: "Sensorial", campos: [
        { key: "tato", label: "sensibilidade tátil", estado: "preenchido", valor: "toque inesperado e texturas" },
        { key: "som", label: "sensibilidade a som", estado: "negativo" },
      ]},
      interesses: { label: "Interesses", campos: [
        { key: "fortes", label: "interesses fortes", estado: "preenchido", valor: "animais" },
        { key: "aversoes", label: "não gosta de", estado: "preenchido", valor: "futebol, carrinhos" },
      ]},
      rotina: { label: "Rotina", campos: [
        { key: "mudanca", label: "dificuldade com mudança inesperada", estado: "preenchido", valor: "sim" },
      ]},
    }),
  },
];

w(`PORTÃO C · personalização real · MESMO desafio, três crianças`);
w(`desafio: "${DESAFIO}"\n`);

const turno = await classificarIntencao({
  supabase: supabaseStub, familyId: FAMILIA_PILOTO, texto: DESAFIO,
  historico: [], temaAnterior: null,
});
w(`intenção (uma só, mesmo relato): ${turno.intencao} · tema ${turno.tema ?? "-"}\n`);

const SKILL = "foco";
const b2 = base2Real(SKILL);
const resultados = [];

for (const p of PERFIS) {
  w(`\n${linha()}\n${p.id}\n`);
  const bps = await recuperarReal({ skill: SKILL, idade: p.idade, relato: DESAFIO, comRanking: true });
  w(`  BPs ranqueadas (idade ${p.idade}): ${bps.map((b) => b.titulo.slice(0, 50)).join(" | ")}`);

  const ctx = ctxWeb({ ...p, base2: b2, bps });
  const web = await chamarWeb({ skill: SKILL, ctx, userInput: DESAFIO, intencao: turno.intencao, tema: turno.tema });
  const wpp = await chamarWhatsApp({
    nomeMae: "Ana", cuidador: { relacao: "mãe", genero: "feminino" },
    nomeMembro: p.nome, idadeMembro: p.idade, perfilMembro: p.perfil, generoMembro: p.genero,
    koloVivoResumo: Object.values(p.secoes).join("\n"), koloVivoLacunas: "",
    piloto4A: true, perfilConsultavel: p.perfilConsultavel, base2: b2,
    repertorio: blocoBoasPraticas(bps), historico: [], mensagem: DESAFIO,
    temaAtivo: turno.tema, sinais: { desafio: DESAFIO, conquista: null },
  });

  const sinais = (t) => ({
    carrinho: /carrinh/i.test(t), futebol: /futebol/i.test(t), animal: /animal|animais|bicho/i.test(t),
    visual: /figura|imagem|cartão|cartao|visual|desenh/i.test(t),
    escrito: /lista escrita|escrit[ao]|por escrito|checklist/i.test(t),
    umPasso: /uma etapa|um passo|uma coisa de cada vez|primeiro passo/i.test(t),
    toque: /toque|tátil|textura/i.test(t),
    barulho: /barulho|som|silêncio|silencio/i.test(t),
    aviso: /avisar antes|antecip|prever|o que vem depois/i.test(t),
    ch: t.length,
  });
  const sw = sinais(web.texto), sp = sinais(wpp.texto);
  w(`\n  WEB ${sw.ch} ch · WHATSAPP ${sp.ch} ch`);
  w(`  sinais WEB ......: ${Object.entries(sw).filter(([k, v]) => v === true).map(([k]) => k).join(", ") || "-"}`);
  w(`  sinais WHATSAPP .: ${Object.entries(sp).filter(([k, v]) => v === true).map(([k]) => k).join(", ") || "-"}`);
  w(`\n  ┌─ WEB\n${caixa(web.texto)}\n  └─`);
  w(`\n  ┌─ WHATSAPP\n${caixa(wpp.texto)}\n  └─\n`);
  resultados.push({ id: p.id, nome: p.nome, sw, sp, web: web.texto, wpp: wpp.texto });
}

w(`\n${linha()}\nPROVA DE PERSONALIZAÇÃO — o que apareceu em quem\n`);
const chaves = ["carrinho", "futebol", "animal", "visual", "escrito", "umPasso", "toque", "barulho", "aviso"];
w("sinal".padEnd(12) + resultados.map((r) => r.nome.padEnd(14)).join(""));
for (const k of chaves) {
  w(k.padEnd(12) + resultados.map((r) => `${r.sw[k] ? "web" : "   "} ${r.sp[k] ? "wa" : "  "}`.padEnd(14)).join(""));
}
w(`\nNEGATIVOS RESPEITADOS:`);
const bia = resultados[2];
w(`  Bia NÃO gosta de futebol/carrinhos → citou futebol? ${bia.sw.futebol || bia.sp.futebol ? "*** SIM — FALHA ***" : "NÃO"} · carrinho? ${bia.sw.carrinho || bia.sp.carrinho ? "*** SIM — FALHA ***" : "NÃO"}`);
const rafa = resultados[1];
w(`  Rafa NÃO tem sensibilidade a som (negativo) → sugeriu algo sobre barulho? ${rafa.sw.barulho || rafa.sp.barulho ? "citou (checar se é adequado)" : "não"}`);
w(`\nINFORMAÇÃO AUSENTE (Bia: 'lê' está VAZIO):`);
w(`  assumiu que lê? ${/\bela lê\b|que ela lê|sabe ler/i.test(bia.web + bia.wpp) ? "*** SIM — INVENTOU ***" : "NÃO"}`);

writeFileSync(`${process.cwd()}/docs/bancada/piloto-4a-portao-c-2026-08-10.txt`, out.join("\n"), "utf8");
console.log("\npronto → docs/bancada/piloto-4a-portao-c-2026-08-10.txt");
