# Correção de dado — rotina da Manu salva no Mario (03/08/2026)

**Executado em produção.** Uma coluna, uma linha. Nada mais foi tocado.

---

## O que aconteceu

Às 11:23 a mãe escreveu:

> *"Amanhã vai ser um dia bem importante porque a gente vai levar **ela** no médico"*

Pronome, sem nome. `membroMencionado` só procurava nome próprio, devolveu
`null`, e a cadeia caiu em `membroConversa` — que trazia o **Mario** da conversa
anterior (a rotina da semana dele tinha sido criada às 03:33 do mesmo dia).

O modelo leu o perfil dos dois filhos, entendeu "ela" e escreveu a rotina
inteira sobre a **Manu**. As tarefas provam:

```
0  Levar a vovó na padaria
1  Lição de casa com a Manu        ← o conteúdo diz de quem é
2  Banho e se arrumar
3  Conversa rápida sobre o médico — o que vai acontecer lá
4  Saída pro metrô
5  Consulta
6  Sorvete 🍦
```

Mas o `membro_atipico_id` do `INSERT` era o do Mario.

Às 11:30 a mãe corrigiu (*"Era para a minha filha..entao manu"*) e a Ayla
respondeu *"Corrijo aqui — tudo que montei era pra Manu, sim!"*. **Não corrigiu
nada** — a linha continuou no Mario até esta correção manual.

A causa de código está corrigida em `e92688a` (`lib/ayla/membro-alvo.ts`).

## Leitura antes

```
rotina id ........... 24129bb6-de4e-469b-9848-20e402d1498b
nome ................ "Amanhã — consulta médica"
membro_atipico_id ... 7da80c3a-2bd2-4844-bdf7-478d98970929  (Mario, masculino)
dia_semana .......... null (avulsa)
tema ................ null
cards_status ........ "nenhum"
mascote_url ......... null
tarefas ............. 7   (0 com imagem)
created_at .......... 2026-08-03T11:24:23.131053+00:00
duplicatas .......... nenhuma
PDF/cartões ......... nenhum vinculado
```

Membro correto: `0eedfdae-5e66-4179-a103-944bb99f4e1b` (**Manu**, feminino).

## SQL executado

```sql
UPDATE public.rotinas
SET membro_atipico_id = '0eedfdae-5e66-4179-a103-944bb99f4e1b',  -- Manu
    updated_at = now()
WHERE id = '24129bb6-de4e-469b-9848-20e402d1498b'
  AND membro_atipico_id = '7da80c3a-2bd2-4844-bdf7-478d98970929';  -- guarda: só se ainda estiver no Mario
```

A condição extra no `WHERE` é proposital: se alguém já tivesse corrigido, o
update não faria nada em vez de sobrescrever.

**1 linha afetada.** Nenhuma tarefa, texto, horário ou conteúdo foi alterado.

## Leitura depois

```
membro_atipico_id ... 0eedfdae-5e66-4179-a103-944bb99f4e1b  (Manu)
updated_at .......... 2026-08-03T11:42:23.206854+00:00
tarefas ............. 7   (inalteradas)
duplicatas .......... nenhuma
```

Rotinas da família agora:

| Rotina | Membro |
|---|---|
| Dia do circo | Mario |
| Dia de Praia | Mario |
| Dia do Passeio da Manu | Manu |
| Segunda a Sexta-feira | Mario |
| **Amanhã — consulta médica** | **Manu** ✅ |

## ROLLBACK

```sql
UPDATE public.rotinas
SET membro_atipico_id = '7da80c3a-2bd2-4844-bdf7-478d98970929',  -- Mario
    updated_at = now()
WHERE id = '24129bb6-de4e-469b-9848-20e402d1498b';
```

Risco de perda: **nenhum**. Não houve `DELETE`, nenhuma FK se moveu, e o
`id` da rotina não mudou — links e referências continuam válidos.
