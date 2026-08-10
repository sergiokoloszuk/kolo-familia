/**
 * BANCADA DAS TRÊS CORREÇÕES — rebaixamento, recitação, receita estrutural.
 * 8 contrastes que mordem as regras + 2 chamadas de juízo em lote.
 */
import { mod, chamarWeb, ctxWeb, perfilSintetico, recuperarReal, base2Real,
  supabaseStub, FAMILIA_PILOTO, linha, caixa } from "./comum.mjs";
import { writeFileSync } from "node:fs";
const { classificarIntencao } = await mod("lib/ia/intencao.ts");
const { gerarConversacional, MODELO_CONVERSA } = await mod("lib/ia/provider.ts");
const out=[]; const w=(s)=>{out.push(s);console.log(s);};

const T=[
 {id:"1 · VERBAL + timidez (figuras=NEGATIVO)",skill:"comunicacao",
  relato:"A Manu conversa bem com a gente e com a prima, mas com gente de fora trava. Queria ajudar nisso.",
  nome:"Manu",idade:6,perfil:"TEA",genero:"feminino",
  secoes:{essencial:"Manu, 6 anos. INTERESSES: mercadinho.",comunicacao:"Fala frases completas em casa e com a prima. Com desconhecidos, trava."},
  pcs:{comunicacao:{label:"Comunicação",campos:[{key:"a",label:"fala frases completas",estado:"preenchido"},{key:"b",label:"usa figuras/apontar",estado:"negativo"},{key:"c",label:"fala com desconhecidos",estado:"vazio"}]}}},
 {id:"2 · MULTIMODAL de verdade (mesma dificuldade)",skill:"comunicacao",
  relato:"O Dudu quase não fala com gente de fora. Queria ajudar nisso.",
  nome:"Dudu",idade:6,perfil:"TEA",genero:"masculino",
  secoes:{essencial:"Dudu, 6 anos.",comunicacao:"Usa poucas palavras. Aponta e usa figuras para pedir. Comunica-se por gesto e imagem."},
  pcs:{comunicacao:{label:"Comunicação",campos:[{key:"a",label:"usa figuras e gestos",estado:"preenchido"},{key:"b",label:"fala frases completas",estado:"negativo"}]}}},
 {id:"3 · PERFIL RICO, pedido comum",skill:"foco",
  relato:"Como faço pra ele render melhor na lição?",
  nome:"Théo",idade:9,perfil:"TDAH",genero:"masculino",
  secoes:{essencial:"Théo, 9 anos. INTERESSES: futebol, skate. Lê bem.",foco:"Trava para começar tarefa que não gosta."},
  pcs:{interesses:{label:"Interesses",campos:[{key:"f",label:"futebol e skate",estado:"preenchido"}]},aprendizado:{label:"Aprendizado",campos:[{key:"l",label:"lê bem",estado:"preenchido"}]}}},
 {id:"4 · MÃE PEDE o que a Ayla sabe",skill:"foco",
  relato:"Com o que você já sabe dele, o que você faria?",
  nome:"Théo",idade:9,perfil:"TDAH",genero:"masculino",
  secoes:{essencial:"Théo, 9 anos. INTERESSES: futebol, skate. Lê bem.",foco:"Trava para começar tarefa que não gosta."},
  pcs:{interesses:{label:"Interesses",campos:[{key:"f",label:"futebol e skate",estado:"preenchido"}]},aprendizado:{label:"Aprendizado",campos:[{key:"l",label:"lê bem",estado:"preenchido"},{key:"x",label:"como é na escola",estado:"vazio"}]}}},
 {id:"5 · PEDIDO SIMPLES",skill:"sono",relato:"Ele pode dormir com a luz acesa?",
  nome:"Téo",idade:6,perfil:"TEA",genero:"masculino",secoes:{essencial:"Téo, 6 anos."},pcs:{}},
 {id:"6 · TAREFA REALMENTE SEQUENCIAL",skill:"rotina",
  relato:"Toda manhã é um caos: acordar, escovar, vestir, tomar café e sair. Como organizo essa sequência?",
  nome:"Téo",idade:6,perfil:"TEA",genero:"masculino",
  secoes:{essencial:"Téo, 6 anos.",rotina:"Precisa saber o que vem depois."},
  pcs:{rotina:{label:"Rotina",campos:[{key:"p",label:"precisa de previsibilidade",estado:"preenchido"}]}}},
 {id:"7 · RELATO VAGO",skill:"comunicacao",relato:"Ela não conversa direito.",
  nome:"Bela",idade:7,perfil:"TEA",genero:"feminino",secoes:{essencial:"Bela, 7 anos. INTERESSES: gatos."},
  pcs:{comunicacao:{label:"Comunicação",campos:[{key:"a",label:"como se comunica",estado:"vazio"}]}}},
 {id:"8 · OBJETIVO AMPLO",skill:"comunicacao",
  relato:"Queria trabalhar a comunicação dela de forma mais completa, ao longo dos próximos meses.",
  nome:"Manu",idade:6,perfil:"TEA",genero:"feminino",
  secoes:{essencial:"Manu, 6 anos. INTERESSES: mercadinho.",comunicacao:"Fala frases completas em casa. Com desconhecidos, trava."},
  pcs:{comunicacao:{label:"Comunicação",campos:[{key:"a",label:"fala frases completas",estado:"preenchido"}]}}},
];

const R=[];
for(const c of T){
  const turno=await classificarIntencao({supabase:supabaseStub,familyId:FAMILIA_PILOTO,texto:c.relato,historico:[],temaAnterior:null});
  const b2=base2Real(c.skill);
  const bps=await recuperarReal({skill:c.skill,idade:c.idade,relato:c.relato,comRanking:true});
  const ctx=ctxWeb({nome:c.nome,idade:c.idade,perfil:c.perfil,genero:c.genero,secoes:c.secoes,perfilConsultavel:Object.keys(c.pcs).length?perfilSintetico(c.pcs):null,base2:b2,bps});
  const r=await chamarWeb({skill:c.skill,ctx,userInput:c.relato,intencao:turno.intencao,tema:turno.tema});
  R.push({...c,texto:r.texto,ch:r.texto.length});
  w(`\n${linha()}\n${c.id}\n"${c.relato}"\n  ${r.texto.length} ch · intenção ${turno.intencao}\n`);
  w(caixa(r.texto));
}

const CRIT=[
 "NÃO rebaixa: não propõe apoio mais básico do que a criança já demonstra (ex.: apontar/figuras para quem fala frases)",
 "respeita o que o perfil marca como 'a família já disse que NÃO é o caso'",
 "mantém o objetivo que a família trouxe",
 "a personalização aparece na PROPOSTA, sem recitar de volta os dados do perfil",
 "quando (e só quando) a mãe pergunta o que a Ayla sabe, resume os fatos relevantes",
 "NÃO usa o formato 'passos numerados + o que observar' como fórmula",
 "usa lista/passos apenas quando a ordem realmente importa",
 "a forma é a menor que ajuda naquele turno",
 "traz brincadeira/atividade/treino quando pertinente",
 "ajuda a localizar o problema quando o relato é vago",
 "reconhece quando o objetivo é amplo e um Plano organizaria melhor (sem empurrar)",
 "conversa com naturalidade",
];
async function julgar(lote,rot){
  const sys=`Você avalia respostas de uma assistente que apoia famílias de crianças neurodivergentes.
Para CADA resposta e CADA critério responda SIM ou NAO com justificativa de até 12 palavras.
Critérios:
${CRIT.map((c,i)=>`${i+1}. ${c}`).join("\n")}
Formato EXATO:
### R1
1|SIM|...
...
12|NAO|...
### R2
...
Rigoroso. Na dúvida, NAO. Se um critério não se aplica ao caso, responda SIM.`;
  const user=lote.map((r,i)=>`### R${i+1}\nRELATO: "${r.relato}"\nPERFIL: ${Object.values(r.secoes).join(" ")}\nRESPOSTA:\n"""\n${r.texto}\n"""`).join("\n\n");
  const res=await gerarConversacional({provider:"openai",model:MODELO_CONVERSA.openai,system:sys,messages:[{role:"user",content:user}],maxTokens:3000,cacheSystem:true});
  w(`\n\n${linha()}\nJUÍZO — ${rot}\n`); w(caixa(res.texto.trim()));
  return res.texto.split(/###\s*R\d+/).slice(1).map(b=>{const n=[];for(const l of b.split("\n")){const m=l.match(/^\s*(\d+)\s*\|\s*(SIM|NAO)/i);if(m)n[Number(m[1])-1]=m[2].toUpperCase()==="SIM";}return n;});
}
const notas=[...await julgar(R.slice(0,4),"testes 1-4"),...await julgar(R.slice(4),"testes 5-8")];
w(`\n${linha()}\nPLACAR\n`);
notas.forEach((n,i)=>{const nao=n.map((v,j)=>v?null:j+1).filter(Boolean);
  w((R[i]?.id??"?").padEnd(46)+`${n.filter(Boolean).length}/12`.padEnd(8)+(nao.join(", ")||"-"));});
w(`\nPOR CRITÉRIO`);
for(let i=0;i<CRIT.length;i++) w(`  ${String(i+1).padStart(2)}. ${CRIT[i].slice(0,66).padEnd(68)}${notas.filter(x=>x[i]).length}/${notas.length}`);
writeFileSync(`${process.cwd()}/docs/bancada/piloto-4a-correcoes-abc-2026-08-10.txt`,out.join("\n"),"utf8");
