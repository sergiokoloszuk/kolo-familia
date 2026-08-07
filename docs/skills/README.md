# Skills temáticas — a arquitetura de duas camadas

As 7 skills que estavam desligadas por terem template placeholder
(`aprendizado`, `foco`, `nutricional`, `socializacao`, `autonomia`, `motor`,
`imitacao`) têm conteúdo aprovado. Cada uma vira **duas coisas diferentes**, e
misturá-las quebra o produto de um jeito ou de outro.

> **CAMADA 1 — o template curto.** Entra no system prompt quando a skill é
> roteada. Orienta **COMO PENSAR**.
>
> **CAMADA 2 — o repertório rico.** Todo o resto do documento. Fica preservado
> para **recuperação temática**, junto da lógica das boas práticas. Entrega **O
> QUE SABER** naquele caso.

## Por que não pode ser uma camada só

`specialist_prompt_templates` tem quatro campos de texto, e `buildIdentityBlock`
os injeta **literalmente** no prompt, por skill roteada:

```
## Skill 1: Emocional
- Objetivo: …  - Tom: …  - Escopo: …  - Limites: …
```

Medido na skill madura de referência (`emocional`, ativa): 123 + 23 + 89 + 106 =
**~341 caracteres**. Os documentos aprovados têm 8.000 a 13.000 cada, e a web
roteia até 3 skills por turno. Carregar o documento inteiro multiplicaria o
prompt — num núcleo que já está em 53.852 de um teto de 54.000.

E o caminho oposto — resumir a skill até caber — destrói justamente o que a
torna útil: as diferenciações, as progressões e as perguntas que mudam a
conduta.

Daí as duas camadas. Nenhuma das duas é o documento inteiro no prompt.

## Regras da arquitetura

1. **A skill não carrega o documento inteiro no system prompt.** A Camada 1 é
   uma destilação do DNA de raciocínio, não um mini-documento.
2. **O repertório não é para ser recitado.** Ele é insumo para escolher, não
   texto para despejar. Nada de respostas com cabeçalhos "Quando usar", "Erros
   comuns", "Passos".
3. **Poucas unidades relevantes por turno.** A recuperação traz 3 a 4 itens, não
   o tema inteiro.
4. **Informação nova muda a orientação.** Se a família disser "já faço isso", a
   resposta seguinte não repete a estratégia com outras palavras — avança para o
   próximo ponto do repertório.
5. **A skill orienta raciocínio, não resposta formatada.** Ela decide o que
   perguntar, o que entregar e quando parar de investigar — não o layout.
6. **Skill não é gaveta.** Os cruzamentos ficam no repertório (escrita →
   aprendizado/motor/foco; banho → autonomia/sensorial; alimentação →
   nutricional/sensorial; brincadeira → socialização/comunicação/imitação; não
   iniciar → foco/autonomia; imitar movimento → imitação/motor). A Camada 1 não
   precisa listá-los, mas não pode criar fronteira rígida.

## A pergunta funcional de cada skill

O que distingue uma skill da outra não é o tema — é a pergunta que ela faz.

| skill | pergunta funcional |
|---|---|
| aprendizado | Em qual etapa da habilidade a pessoa está travando? |
| foco | O que impede entrar, sustentar ou concluir a atividade? |
| nutricional | Em qual etapa da aproximação está a barreira, e qual característica sustenta a recusa? |
| socializacao | Em qual micro-habilidade da interação está a dificuldade? |
| autonomia | Em qual etapa ainda existe dependência, e qual é a menor ajuda necessária? |
| motor | Qual componente funcional do movimento/tarefa está difícil? |
| imitacao | Onde a imitação já aparece, e como usar isso como via de aprendizagem? |

Se duas Camadas 1 puderem trocar de nome sem estranheza, uma delas está genérica.

## Estado

| skill | documento | Camada 1 | formato | ativa |
|---|---|---|---|---|
| aprendizado | ✅ | ✅ | **verbatim** | não |
| foco | ✅ (+ triagem das 2 perguntas) | ✅ | **verbatim** | não |
| nutricional | ✅ | ✅ | **verbatim** | não |
| socializacao | ✅ | ✅ | **verbatim** | não |
| autonomia | ✅ | ✅ | **verbatim** | não |
| motor | ✅ | ✅ | **verbatim** | não |
| imitacao | ✅ | ✅ | **verbatim** | não |

Os 7 documentos são **fonte canônica editorial**, salvos exatamente como
aprovados — estrutura, quebras, listas, exemplos, progressões, perguntas,
cruzamentos e ênfases. Só o bloco YAML do fim é editável.

## Onde o repertório mora — e por que NÃO ganha coluna nova

Decisão de 06/08/2026: **não criar coluna de repertório da skill**. Teríamos dois
acervos concorrendo — skill longa e boas práticas — e logo a dúvida de qual
vence, qual está atualizado e qual deve ser recuperado. É a complexidade que
esta arquitetura existe para eliminar.

| onde | o quê | função |
|---|---|---|
| `specialist_prompt_templates` | destilação curta | ensina COMO RACIOCINAR |
| `boas_praticas` | `versao_conversa`, `quando_usar`, `erros_comuns`, `passos_praticos`, tags | dá O QUE SABER naquele caso |
| `docs/skills/*.md` | documento completo | fonte editorial — valida BPs, acha lacunas, revisa a destilação |

Os documentos **não entram inteiros no prompt** e **não precisam de coluna**.
Servem para validar o acervo daquela skill, encontrar lacunas, enriquecer e
criar BPs quando faltar conteúdo, e revisar a Camada 1.

⚠️ **Não transformar cada parágrafo do documento em BP nova.** Já existem
centenas de BPs dessas 7 skills. Antes de criar qualquer uma, cruzar documento ×
acervo e criar só para lacuna REAL — duas versões da mesma orientação
competindo na recuperação é pior que uma lacuna.

**Nada foi ativado.** Nenhum `UPDATE` em `specialist_prompt_templates`, nenhuma
boa prática publicada, nenhuma mudança de provider. Os documentos são a fonte de
revisão; o banco continua com os placeholders antigos.
