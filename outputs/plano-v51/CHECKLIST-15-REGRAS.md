# Checklist V5.1 — evidência local, não liberação

| Regra | Situação | Evidência / pendência |
|---|---|---|
| 1. Entrada Ayla, convite e só conversar, um assunto | Parcial | Percurso UI passou; turnos livres ainda não persistem em conversas |
| 2. Três áreas; nome/etapa mobile; gaveta | Local aprovado | Prints desktop/390/320; chrome autenticado completo ainda não exercitado |
| 3. Contexto interno e ficha por natureza | Parcial | Contrato e âncora verificados; consumo real de Perfil/histórico pelo modelo pendente |
| 4. Perguntas adaptativas, uma por vez e não sei | Local aprovado | Domínio dispensa pergunta conhecida; UI exercitada; adaptação semântica real pendente |
| 5. Hipótese com frase de origem | Local aprovado | Origem não encontrada é rejeitada; qualidade semântica exige modelo real |
| 6. Cinco estados, resultado diferente de conquista | Local aprovado | Testes positivos/negativos e percurso browser com melhoria + confirmação |
| 7. Lembretes desligados e autorização | Parcial | Ativação pelo browser recusada; nenhum emissor conectado; não prova pausa de proativas existentes |
| 8. Risco atual, cuidado visível e urgência fora do plano | Pendente | Trava de domínio existe; triagem de entrada e texto revisado bloqueiam exposição às famílias |
| 9. Isolamento e Web–WhatsApp com origem | Parcial | Família/criança/plano testados com banco simulado; WhatsApp não conectado |
| 10. Avaliação separada do resultado | Local aprovado | Estrelas e resultado têm eventos separados |
| 11. O que dizer e evitar | Local aprovado | Componente e fixture; conteúdo de IA real ainda exige avaliação |
| 12. Experimentar em três blocos, dia 1 vazio, retorno no topo | Local aprovado | Browser em três tamanhos e datas calculadas |
| 13. Demonstração só interna | Local aprovado | Painel separado; página/actions conectadas restritas a staff; HTTP real ainda pendente |
| 14. Etapa feita só com evento | Local aprovado | Navegar não conclui Experimentar; resultado observado conclui |
| 15. 44×44, sem overflow, linguagem | Local aprovado | Medições browser desktop/390/320; nenhuma atribuição profissional à usuária |

Obrigatório antes de liberação: IA real e respostas completas; continuidade WhatsApp;
Postgres descartável com RLS/CAS; triagem/cuidado revisados; conversa livre persistente;
prioridade persistente, diário global e percurso dentro do chrome autenticado.

O PR inclui bloqueio de deploy automático SOMENTE para sua branch em
`apps/web/vercel.json`. Não muda runtime flags ou o comportamento de main.
Referência operacional: https://vercel.com/docs/project-configuration/git-configuration
