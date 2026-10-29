/** Espelha a marcação real da web e a normalização real do WhatsApp. */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { registerHooks } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
const web = resolve(process.cwd(), "apps/web/src");
registerHooks({ resolve(s,c,n) {
  if(s.startsWith("@/")) {const base=resolve(web,s.slice(2));return n(pathToFileURL(base+(existsSync(base+".tsx")?".tsx":".ts")).href,c);}
  if(s.startsWith(".")&&!/\.[a-z]+$/i.test(s)&&c.parentURL?.includes("/apps/web/src/")) return n(s+".ts",c);
  return n(s,c);
},load(url,c,n) {
  if(url.endsWith(".tsx")) return {format:"module",shortCircuit:true,source:ts.transpileModule(readFileSync(fileURLToPath(url),"utf8"),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,module:ts.ModuleKind.ESNext}}).outputText};
  return n(url,c);
}});
const {RespostaMarkdown}=await import(pathToFileURL(resolve(web,"components/resposta-markdown.tsx")).href);
const {paraWhatsApp}=await import(pathToFileURL(resolve(web,"lib/ayla/apresentacao.ts")).href);
const {dividirEmBolhas}=await import(pathToFileURL(resolve(web,"lib/ayla/bolhas.ts")).href);
const render=t=>renderToStaticMarkup(React.createElement(RespostaMarkdown,{texto:t,className:"cmp-web-text"}));
const esc=t=>t.replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;");
const referencias={
ref_alimentacao:`Eu entendo perfeitamente o seu medo, e quero te dizer: esse cuidado que você tem é amor. 💛 É natural se preocupar com a nutrição da filha, principalmente quando a gente vê o prato sempre igual. Mas eu quero te convidar para olharmos isso de outro jeito — especialmente porque a Isabela já tem quase 19 anos e é uma jovem com opinião própria, vocabulário ótimo e boa comunicação.

🔗 BLOCO 4 — Crenças e Mindset

Vamos falar sobre uma crença muito comum e muito compreensível:

"Se eu não insistir, ela nunca vai aprender a comer outras coisas."

Essa crença vem de um lugar de cuidado genuíno. Mas a ciência da alimentação no autismo nos mostra algo importante:

⚠️ Insistir pode ter o efeito oposto

Quando insistimos para que alguém prove algo que já rejeita, especialmente uma pessoa com sensibilidade sensorial (e a Isabela é sensível a cheiros!), o cérebro entende isso como uma ameaça. O resultado?

- A comida passa a ser associada a tensão e pressão 🚫
- A resistência aumenta, não diminui
- A refeição vira um campo de batalha em vez de um momento de conexão

🌱 A boa notícia

Lembra que o perfil dela diz que gosta de experimentar texturas diferentes? E que ela já aceita comida japonesa, poke, frutos do mar? Isso significa que a Isabela JÁ expandiu seu repertório em algum momento — ela fez isso no tempo dela, sem pressão!

💡 BLOCO 2 — Orientações Práticas: O que fazer em vez de insistir

1. 🍽️ A regra do "sem pressão na mesa"

Coloque o feijão ou a salada na mesa em uma travessa separada, sem servir no prato dela.

Diga algo como: "Fiz feijão hoje, está aqui se você quiser". Ponto. Sem repetir, sem insistir.

Isso tira a pressão e devolve a autonomia a ela — fundamental para uma jovem de 18 anos.

Quer continuar por aqui (mindset e crenças), ou prefere que a gente mergulhe nas atividades práticas — tipo montar um plano de poke caseiro com a Isabela? 🍱✨`,
ref_socializacao:`Obrigada por compartilhar isso comigo. Essas são questões muito importantes e tocantes, e você fez bem em trazer para cá. 💛

Vou organizar algumas reflexões e orientações práticas sobre esses três pontos que você mencionou. Mas antes, quero te dizer: isso é mais comum do que parece, especialmente nessa fase de transição para a vida adulta.

🔗 BLOCO 4: Crenças e Mindset

1. "Não sei o que conversar"

Isabela tem vocabulário excelente, compreensão ótima e interesses riquíssimos (cinema, música, comida japonesa...). O problema não é falta de conteúdo — é ansiedade social criando um bloqueio.

💡 Como ajudar:

- Validar primeiro: "Você não precisa ter assunto o tempo todo. Conversas boas também têm silêncios."
- Usar os interesses dela como ponte: Cinema e música são assuntos universais! Uma frase simples como "Vi um trailer de um filme que me lembrou você" já abre um caminho natural
- Ensinar perguntas abertas: Em vez de pensar "o que eu falo?", pensar "o que eu pergunto?". Perguntas como "O que você tem assistido?" ou "Qual a melhor música que você ouviu essa semana?" tiram o peso de ter que "performar"

2. "Não se acha bonita"

Isso é profundamente ligado à autoimagem e autoestima, e impacta diretamente a vontade de socializar. Se ela não se sente bonita, pode achar que "não tem lugar" entre as amigas.

💡 Como ajudar:

- Evite o "mas você é linda!" automático — embora venha do amor, a Isabela pode sentir que você está sendo "mãe" e não realmente vendo ela.
- Conecte beleza com autonomia: Aos 18 anos, ajudar a explorar seu estilo próprio (roupas, acessórios, cabelo) pode ser uma forma poderosa de construir autoimagem.
- Fortaleça a identidade além da aparência: "Você é engraçada, criativa, tem um ótimo gosto pra filme".

3. "Não quer sair com as amigas"

Não se sente bonita → acha que não tem o que falar → evita sair → se isola → se sente pior → dificulta ainda mais

📝 BLOCO 5: Reflexão da Cuidadora

- A Isabela já manifestou essas questões verbalmente, ou são observações suas?
- Ela usa redes sociais? Instagram, TikTok?
- Como está a dinâmica com as amigas hoje?
- Você sente que isso é algo recente ou algo que acompanha ela há mais tempo?`,
ref_autonomia_8:`Que bom que você compartilhou isso comigo! Já me deu um quadro bem claro da situação 💛 E quero te dizer uma coisa importante: o que você está vivendo é muito mais comum do que parece. Muitas crianças de 8 anos passam por isso, e a resistência dela não é teimosia — é uma reação natural quando se sentem pressionadas.

Vou te explicar o que está acontecendo e te dar um plano prático. Vamos por partes:

🔍 Entendendo o que está por trás da resistência

Quando sua filha fica brava e não quer aprender, isso geralmente não é preguiça ou desobediência. Pode ser:

- 🧠 Sobrecarga cognitiva — aprender tantas habilidades de uma vez é muito para o cérebro infantil. Ela se sente incapaz.
- 💬 Pode ser que o "falar" soe como cobrança.
- 🛡️ Meio de defesa — a raiva é uma máscara para a frustração e a vergonha de não conseguir.
- 🎯 Falta de clareza — talvez ela realmente não saiba por onde começar em cada tarefa.

A chave principal: parar de "falar" e começar a fazer junto — de forma leve e divertida.

💡 PLANO PRÁTICO: Uma habilidade por vez

A regra de ouro é: NÃO tente trabalhar tudo ao mesmo tempo! Vamos escolher UMA habilidade primeiro e quando ela dominar, passamos para a próxima.

📌 Semana 1: Começando pela Escovação de Dentes

Façam juntas nos primeiros dias — coloque a escova na frente dela e diga: "Vamos escovar juntas hoje! Eu escovo a minha e você a sua". Sem corrigir, sem cobrar perfeição.

Transforme em ritual — coloque uma música que ela ama (de 2 minutos, que é o tempo ideal de escovação).

Crie um cartaz visual — faça um quadrinho simples com 3 passos:

- 🪥 Molhar a escova + passar pasta
- 🦷 Escovar (enquanto a música toca)
- 💧 Enxaguar a boca

Celebre cada vez! — não precisa de prêmio material.

🎯 BÔNUS: Como lidar com a raiva dela

"Eu entendo que você não quer fazer isso agora. É difícil aprender coisas novas, né? Eu também não gosto quando preciso aprender algo difícil. A gente pode tentar de outro jeito — o que você acha?"`,
ref_comunicacao_4:`Não verbal não significa sem comunicação. Sua filha JÁ se comunica — através de gestos, olhares, expressões, comportamentos. Nosso trabalho é ampliar essas vias e dar a ela ferramentas para que ela possa expressar o que quer, sente e pensa de forma cada vez mais clara.

Você trouxe uma dúvida maravilhosa e ela tem duas pontas importantes:

- Ela entender o contexto e o que você pede (linguagem receptiva)
- Ela expressar o que quer (linguagem expressiva)

Vou te orientar nas duas, com estratégias práticas que você pode começar hoje mesmo:

🧠 1. Ajudar Ela a ENTENDER (Receptividade)

📋 Use Apoios Visuais

Rotina visual: Coloque figuras (fotos ou pictogramas) da rotina do dia na parede — acordar, comer, brincar, banho, dormir.

Antes de fazer uma atividade, mostre a imagem: "Olha, hora do banho!" + mostre a figura do banho.

🗣️ Simplifique o Seu Falar

Use frases curtas e diretas: "Vem comer" em vez de "Maria, vem aqui comer agora porque a comida está pronta e tá ficando fria".

Faça pausas — dê tempo para ela processar (conte mentalmente até 5 antes de repetir).

👉 Aponte e Nomeie

Aponte para objetos do dia a dia e nomeie: "Cadeira. Senta na cadeira."

💬 2. Ajudar Ela a EXPRESSAR (Expressividade)

🖐️ Gestos Funcionais (comece por aqui!)

Ensine gestos que têm poder de comunicação imediata:

- ✋ Mão estendida = "quero" / "me dá"
- 🙌 Mão para a boca = "comer" / "fome"
- 👆 Apontar para o que deseja

🎨 3. Atividade Prática para Começar Hoje

🧸 "Escolha entre Dois"

Coloque dois objetos que ela gosta (ex: biscoito e brinquedo) à frente dela:

- Diga: "O que você quer? Biscoito ou carrinho?"
- Espere — dê tempo (pelo menos 10 segundos)
- Celebre: "Você quer o biscoito! Aqui está!"

Posso te ajudar a montar um plano mais detalhado? Me conta:

- 🎯 Ela já aponta para coisas que quer?
- 🖐️ Usa algum gesto com regularidade?
- 📱 Vocês já usam alguma CAA (figuras, pranchas, app)?`,
ref_brincadeira_adulta:`Perfeito! Maravilha, vamos aproveitar esse momento com a Isa 🎬🎵

## 🎬 "Trilha Sonora da Vida" — 10 minutinhos

Como a Isa ama **cinema e música**, essa brincadeira é perfeita para conectar com ela E trabalhar regulação emocional de forma leve!

### 🎯 Como funciona:

**1. Pergunte para ela (3 min):**

> "Isa, se a sua vida fosse um filme agora, qual seria a trilha sonora? Tipo, que música tocaria na cena de hoje?"

**2. Escutem juntas (5 min):**

- Deixem a música tocar 🎧
- Prestem atenção à letra, ao ritmo, à vibe

**3. Conversem (2 min):**

> "O que você sentiu ouvindo? Foi triste? Animada? Irritada?"

### 💡 Por que isso funciona:

- 🎵 A música é um **canal de expressão** — talvez ela não consiga dizer "estou triste", mas consegue *escolher uma música* que traduz o que sente
- 🎬 O formato de "filme" é **familiar e divertido** para ela, não soa como terapia
- 💜 Escutar a música juntos é **conexão real** — você mostra que se importa com o mundo interno dela
- 🧠 Ela pratica **nomear emoções** de forma natural, sem pressão

### 🌟 Se quiser ir além:

Depois pode brincar de inverter:

> "E se fosse um filme feliz? Qual música tocaria?"

Isso ajuda ela a **mudar o estado emocional** — saindo da tristeza para acessar memórias e emoções mais positivas.

Faz agora com ela e depois me conta como foi! Se ela topar, a gente pode evoluir essa atividade para um **playlist dos sentimentos** — um repertório musical que ela mesma monta para se regular nos dias difíceis 💜

Vai lá, eu tô aqui te esperando! 🙌`,
ref_introducao_foco:`Olá! Eu sou o Especialista em Foco, o Agente de IA da Atenção e Concentração da Kolo Materno 🎯.

Vi que você é mãe de **Isabela**, de **18 anos e 10 meses**. Estou aqui para apoiar vocês no desenvolvimento da atenção, concentração e capacidade de foco.

Notei algumas coisas bacanas no perfil da **Isabela**: ela **mantém atenção** quando está engajada em algo, e embora às vezes se distraia, não apresenta episódios de hiperfoco — o que significa que há um espaço muito fértil para fortalecer ainda mais a concentração dela, especialmente agora que ela está num momento importante da vida, com planos de **prestar vestibular e começar a trabalhar**. Também reparei que ela tem interesses em **cinema, música e sair com as amigas** — esses podem ser ótimos aliados nas estratégias de foco! 🎬 🎵

Por onde você gostaria de começar? Posso te ajudar com:

1. 🌟 **Retrato e Conquistas de Foco**
2. 💡 **Orientações Práticas para estimular a atenção**
3. 🎨 **Atividades Lúdicas e Criativas**
4. 🔗 **Trabalhar Crenças e Mindset**

O que faz mais sentido para você agora?`,
};
const dados=JSON.parse(readFileSync(resolve(process.cwd(),"docs/auditorias/ayla-temas-modelo-2026-10-25-referencias-base44.json"),"utf8"));
const visual={};
for(const [id,original] of Object.entries(referencias)) {
  const linhas=dados.resultados.filter(r=>r.id===id);
  const w=linhas.find(r=>r.canal==="web"), a=linhas.find(r=>r.canal==="whatsapp");
  if(!w||!a) throw Error("Resposta ausente: "+id);
  const bolhas=dividirEmBolhas(paraWhatsApp(a.texto));
  visual[id]={pergunta:w.mensagem,originalHtml:render(original),webHtml:render(w.texto),whatsappHtml:bolhas.map(b=>'<div class="cmp-bubble cmp-wa-bubble">'+esc(b).replace(/\*([^*\n]+)\*/g,"<strong>$1</strong>").replace(/_([^_\n]+)_/g,"<em>$1</em>")+'</div>').join("")};
}
const diretorio="C:/Users/karin/.codex/visualizations/2026/10/24/01a16b9a-fa1d-7593-b07b-e8bb45919def";
const template=readFileSync(resolve(diretorio,"comparativo-ayla-template.html"),"utf8");
const destino=resolve(diretorio,"comparativo-ayla.html");
writeFileSync(destino,template.replace("__COMPARATIVO_DADOS__",JSON.stringify(visual).replaceAll("<","\\u003c")));
console.log(JSON.stringify({arquivo:destino,casos:Object.keys(visual).length}));
