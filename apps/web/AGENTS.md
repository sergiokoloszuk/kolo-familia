<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- Fora dos marcadores acima de propósito: o bloco é regerado pelo Next.js e
     qualquer coisa escrita lá dentro se perde. -->

# Protocolo de engenharia

As regras de engenharia deste repositório — investigação, baseline, causa
raiz, proposta, testes, regressão, observabilidade, segurança, validação,
deploy e fechamento de frente — estão em
[../../docs/AI-ENGINEERING-PROTOCOL.md](../../docs/AI-ENGINEERING-PROTOCOL.md).

É leitura obrigatória antes de qualquer alteração relevante, e vale também
para quem estiver trabalhando só dentro de `apps/web/`.

Junto com ele, dois documentos permanentes valem aqui dentro do mesmo jeito:
[../../docs/PENDENCIAS.md](../../docs/PENDENCIAS.md) (fonte oficial do que está
aberto — consultar antes, registrar achado fora de escopo durante, informar os
IDs no final) e
[../../docs/FEATURE-DELIVERY-PROTOCOL.md](../../docs/FEATURE-DELIVERY-PROTOCOL.md)
(obrigatório quando a mudança cria ou altera algo que uma família percebe).

