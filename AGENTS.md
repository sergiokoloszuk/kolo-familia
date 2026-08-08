# Kolo Família — instruções para agentes de IA

## Leitura obrigatória

**[docs/AI-ENGINEERING-PROTOCOL.md](docs/AI-ENGINEERING-PROTOCOL.md)** é a
fonte única das regras de engenharia deste repositório: investigação,
baseline, causa raiz, proposta, implementação, testes, regressão,
observabilidade, segurança, validação, deploy e fechamento de frente.

Ler antes de começar qualquer alteração relevante. O resumo abaixo não
substitui o documento.

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
