# Animações do Timer (Lottie)

O timer lúdico mostra uma animação que **avança conforme o tempo passa** e
**termina exatamente no zero** (a borboleta abre as asas, o arco-íris se
completa, a criança mergulha = acabou).

Pra isso usamos **Lottie** — animações vetoriais (parecem vídeo, são leves).
O código procura os arquivos abaixo nesta pasta. Enquanto não existirem, o
timer mostra um anel de progresso simples com o emoji do tema.

## Como adicionar uma animação

1. Escolha a animação no [LottieFiles](https://lottiefiles.com) (tem muitas
   grátis — busque "caterpillar butterfly", "rainbow", "kid swimming").
   Prefira animações com **começo e fim claros** (ex.: a borboleta nasce do
   começo ao fim) — assim a sincronia com o tempo fica perfeita.
2. Baixe como **JSON** (não .lottie). Confira a licença (as "Free" servem).
3. Renomeie e solte aqui com **exatamente** estes nomes:

   | Filminho               | Arquivo nesta pasta      |
   | ---------------------- | ------------------------ |
   | 🌈 Arco-íris           | `arco-iris.json`         |
   | 🦋 Lagarta → Borboleta | `borboleta.json`         |
   | 🏊 Vamos nadar         | `nadar.json`             |

4. Faça o deploy. Pronto — o timer passa a usar a animação automaticamente,
   sincronizada com o tempo escolhido.

## Observações

- O timer NÃO toca a animação no ritmo dela: ele "trava" o quadro de acordo
  com o quanto do tempo já passou. Então uma animação com transformação
  contínua (lagarta→borboleta) é o ideal.
- Tamanho: prefira arquivos abaixo de ~300 KB pra carregar rápido no celular.
- Pra trocar a animação depois, é só substituir o arquivo com o mesmo nome.
