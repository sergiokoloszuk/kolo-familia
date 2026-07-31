# Ficha de auditoria humana — por fato

Trabalhe por `id`. **Não copie o texto do fato para planilha externa** — é
conteúdo clínico sobre uma criança. Comentário curto, no máximo uma linha.

Listagens de apoio: [`consultas-amostra.sql`](consultas-amostra.sql), bloco 4.

| Campo | |
|---|---|
| `id` do fato | |
| Revisor | |
| Data | |

## Fidelidade

- [ ] fiel ao relato
- [ ] contraditório com o relato
- [ ] inventado — afirma o que ninguém disse
- [ ] generalização indevida — um evento virou característica
- [ ] perdeu condição importante ("na escola", "quando cansado")
- [ ] informação insuficiente para avaliar

> **Afirmação infiel** = qualquer uma das quatro do meio. Uma só já é vermelho.

## Atomicidade

- [ ] atômico
- [ ] parcialmente composto
- [ ] composto — duas ou mais afirmações
- [ ] contém mais de um sujeito
- [ ] mistura evento e interpretação

## Pessoa

- [ ] membro correto
- [ ] é sobre a cuidadora
- [ ] é sobre irmão ou outro membro
- [ ] é sobre terceira pessoa
- [ ] ambíguo

> Qualquer coisa que não seja "membro correto", **em fato ativo**, é motivo de
> interrupção imediata da coleta.

## Conceito e domínio

- [ ] correto
- [ ] aceitável, mas genérico
- [ ] conceito errado
- [ ] domínio errado
- [ ] `conceito === dominio` (amplo por falta de subcampo)
- [ ] taxonomia insuficiente — não existe conceito que sirva

## Temporalidade

- [ ] correta
- [ ] expressão temporal preservada em `tempo_original`
- [ ] data inventada
- [ ] data imprecisa tratada como precisa
- [ ] informação temporal perdida

## Evidência

- [ ] recuperável
- [ ] parcialmente recuperável
- [ ] inexistente
- [ ] conteúdo divergente da origem

## Comentário

> uma linha, sem citar conteúdo sensível

---

## Revisão cega (segundo revisor)

Preencher **sem ver** a classificação acima. Depois comparar.

| Dimensão | Revisor 1 | Revisor 2 | Divergiu? |
|---|---|---|---|
| Fidelidade | | | |
| Atomicidade | | | |
| Pessoa | | | |
| Conceito | | | |
| Domínio | | | |

Divergência acima de ~1 em 4 significa que **os critérios não estão claros** —
as taxas não são confiáveis até alinhar as definições. Não é falha do revisor.
