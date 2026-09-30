# Avatar e história ilustrada a partir do WhatsApp

**Nível:** CRÍTICA
**Pendência:** PEND-218

## Problema e dono

A responsável pede no WhatsApp um avatar ou uma história, mas hoje recebe um
link genérico, pode cair na criança ativa errada e ainda precisa reconstruir o
pedido na Web. A frase que deve desaparecer é: **“eu já expliquei; por que
preciso começar de novo?”**

## Contrato da experiência

1. A Ayla resolve a criança usando Perfil e conversa; se houver ambiguidade,
   pergunta antes de criar o link.
2. O link abre autenticado e na criança correta.
3. A tela mostra o que já sabe, permite revisar e editar, e só gera depois de
   confirmação humana.
4. Avatar oferece estilos originais 3D adequados à idade, inclusive opções
   gamer, anime, fantasia e ficção científica, sem copiar franquias.
5. Uma alteração cria nova versão; a anterior continua recuperável.
6. História mostra situação, objetivo, tom, protagonista e extensão antes de gerar.
   Avatar é opcional: animais, dinossauros, robôs e pessoas fictícias são
   alternativas completas. O cenário segue o mesmo estilo 3D escolhido.
7. Depois do clique, há estado de geração claro. A história pronta aparece
   antes de qualquer pergunta de enriquecimento.
8. Amanhã, avatar e história continuam na galeria e a Ayla pode apontar o
   caminho de volta.

## Identidade e segurança

- O UUID transportado pelo link é conferido contra a família do token.
- Um UUID de outra família falha fechado e volta para a área segura.
- O formulário de história só aceita avatar pertencente à mesma criança e à
  mesma família.
- Nenhuma característica infantil é colocada na URL.

## Estados

`revisão → gerando → pronto | erro`. Fechar durante a geração não apaga o
artefato persistido. Reabrir leva ao estado salvo. Clique repetido no botão é
bloqueado pela transição do cliente; persistência e provedor devem continuar
checando o próprio resultado.

## Corpus de descoberta

### Deve reconhecer

- “Quero criar o avatar da Manu.”
- “Dá para mudar o cabelo do Mario?”
- “Quero uma versão gamer, mais jovem.”
- “Faz uma história para preparar o Bento para o dentista.”
- “Quero uma historinha sobre esperar a vez.”

### Não deve transformar automaticamente em avatar/história

- “Ele ficou parecendo um personagem hoje.”
- “A professora contou uma história.”
- “O cabelo dela embaraça muito.”
- Desabafo, risco ou urgência.

## Provas obrigatórias antes de produção

- família com duas crianças: link e artefato corretos para cada uma;
- UUID de outra família recusado;
- avatar novo, mudança de aparência, roupa e estilo preservando a versão anterior;
- história com dados revisados e avatar correto;
- clique antecipado, retry e falha da geração;
- retorno no dia seguinte e reabertura;
- mobile, acessibilidade, testes, typecheck e build;
- canal real apenas em conta autorizada de QA.

## Rollback

Reverter o commit restaura as telas e links anteriores. Nenhum avatar anterior é
alterado ou apagado pela nova experiência. Mudanças de schema, quando houver,
devem ser aditivas e permanecer compatíveis durante o rollback.
