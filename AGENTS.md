# Kolo Família — instruções para agentes de IA

## Leitura obrigatória

**[docs/AI-ENGINEERING-PROTOCOL.md](docs/AI-ENGINEERING-PROTOCOL.md)** é a
fonte única das regras de engenharia deste repositório: investigação,
baseline, causa raiz, proposta, implementação, testes, regressão,
observabilidade, segurança, validação, deploy e fechamento de frente.

Ler antes de começar qualquer alteração relevante. O resumo abaixo não
substitui o documento.

## Os outros dois documentos permanentes

**[docs/PENDENCIAS.md](docs/PENDENCIAS.md)** é a **fonte oficial** do que está
aberto — memória de agente, conversa e relatório ajudam no contexto, mas o
estado válido está lá. Em toda missão:

- **ANTES:** consultar as pendências da categoria e dos arquivos que a missão
  toca. Pendência registrada é investigação anterior, com data e evidência.
- **DURANTE:** achado relevante fora do escopo vira pendência registrada — não
  correção silenciosa, e não ampliação da missão.
- **NO FINAL:** informar quais `PEND-XXX` foram criadas, atualizadas ou
  concluídas. Baixa só com o critério de conclusão comprovado.
- Antes de editar pendências, comparar checkout com `origin/main` e com o SHA
  remoto; preservar trabalho local de outras frentes. A ficha é a fonte do
  estado. Regenerar o painel com `node scripts/pendencias-index.mjs --write`,
  revisar o diff e rodar `--check`; o CI rejeita índice divergente e ID
  duplicado. Não atualizar manualmente só o painel.
- A partir de 04/10/2026, usar a **Regra de prova operacional** de
  `docs/PENDENCIAS.md`: CONCLUÍDO exige SHA/health e prova atual em produção;
  PARCIAL diz o que funciona e falta; PENDENTE não presume prova; FALHOU traz
  saída; BLOQUEADO nomeia dependência. Não dar baixa por teste local.

**[docs/FEATURE-DELIVERY-PROTOCOL.md](docs/FEATURE-DELIVERY-PROTOCOL.md)** vale
**quando a missão cria ou altera algo que uma família percebe** — e aí é de
leitura obrigatória antes de começar. Correção de defeito, refatoração e
investigação seguem só o protocolo de engenharia.

São oito portões — problema e dono · descoberta · conversa mínima e dados ·
jornada e canais · identidade e alvo · continuidade · quando dá errado · prova
e entrega — com dois níveis de escrutínio acima do mínimo (MÉDIA e CRÍTICA), e
duas perguntas que mandam no resto: **"funciona para quem não sabe que
existe?"** e **"o que acontece amanhã?"**. `IMPLEMENTADA ≠ PRONTA`.

**[docs/PROTOCOLO-TESTE-REAL.md](docs/PROTOCOLO-TESTE-REAL.md)** vale
**a partir do Gate B**, em todo teste humano no WhatsApp: reconstruir o turno
de ponta a ponta, rastrear as portas que NÃO dispararam, provar fala ≠ ação e
entregar o bloco "o que quase aconteceu". Nasceu do Gate A, em que seis
correções pareceram fechar o mesmo defeito e cinco não fecharam.

O comportamento de cada funcionalidade específica vive em
[docs/specs/](docs/specs/).

## O que ele exige, em uma tela

- **Investigar antes de alterar.** A ordem é INVESTIGAR → BASELINE → CAUSA
  RAIZ → PROPOR → IMPLEMENTAR → TESTAR → VALIDAR → AUDITAR → VEREDITO.
- **Missão marcada como INVESTIGAR, PROPOR ou AUDITAR não altera código
  funcional.** Investigação não é autorização.
- **Remover, simplificar, consolidar, restaurar, religar, corrigir — só então
  acrescentar.**
- **Escrita crítica confere o próprio resultado.** No cliente Supabase,
  `.update()` devolve o erro em vez de lançar; um `await` sem checar `error`
  engole a falha e o fluxo segue como sucesso.
- **Nada de `git add -A` cego.** Revisar `git status` e `git diff`; arquivos
  de outra frente ficam intocados.
- **Nunca afirmar que os testes passaram sem executá-los**, e nunca declarar
  produção validada quando só o build local passou.
- **Não disparar WhatsApp, cobrança ou e-mail em validação**, e não usar conta
  de família real como ambiente de teste. Dado de teste é apagado no fim.
- **Veredito só pode ser** PASSOU · PASSOU COM RESSALVAS · FALHOU · BLOQUEADO.

## Ambiente

- App Next.js em `apps/web/` — ver também
  [apps/web/AGENTS.md](apps/web/AGENTS.md), que trata das particularidades
  desta versão do Next.
- `dev` e `build` usam `--webpack`: o Turbopack quebra em caminho com
  não-ASCII no Windows.
- Manter `git config core.autocrlf false` — vários testes leem o próprio
  código-fonte e casam com `\n`.
- Visão geral do produto, stack e variáveis de ambiente: [README.md](README.md).
