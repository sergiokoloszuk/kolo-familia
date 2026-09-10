-- ============================================================
-- Kolo Família — Migração 0086
--   BIA · `pressupoe_ausencia_de`: o veto por habilidade já provada (PEND-196).
--
--   O DEFEITO QUE ORIGINOU ESTA COLUNA, medido em 10/09/2026 na bancada de 45
--   chunks: um adolescente de 15 anos que "fala muito bem e escreve redação
--   sozinho" recebia o chunk "a fala é o telhado" — a escada de pré-requisitos
--   PRÉ-VERBAIS — com score 88. No turno real do Mario (9 anos, conversa bem),
--   2 dos 5 chunks do bloco pressupunham linguagem ausente; num caso
--   multidomínio, 3 de 5.
--
--   É a mesma classe da PEND-192, do outro lado do sistema: lá o decisor de
--   lacuna escolhia "contato visual" para quem lê e escreve; aqui o recuperador
--   entregava a escada para quem argumenta. A causa é idêntica — nada no
--   mecanismo sabia que a criança JÁ PROVOU um degrau superior.
--
--   ⚠️ POR QUE UMA COLUNA NOVA, e não um campo existente. Conferido campo a
--   campo antes de escrever esta linha:
--     · `faixa_etaria_max_meses` — idade não é nível de linguagem. Existe
--       adolescente não-verbal, e vetar por idade apagaria justamente ele.
--     · `nivel_de_cautela = 'nao_usar_sem_contexto'` — já tem semântica e filtro
--       próprios ("núcleo ≠ domínio do turno"), que é outra pergunta.
--     · `habilidades_relacionadas` — hoje SOMA score. Marcar pré-requisito ali
--       daria duas semânticas opostas ao mesmo array: "fala sobre X" e "só vale
--       se X não existe". É exatamente o defeito de `transicoes` que o Gate A
--       cobrou (um conceito, um dono).
--
--   ⚠️ NADA AQUI LIGA A BIA. `BIA_PROMPT_ENABLED` continua desligada,
--   `bia_chunks` continua vazia em produção, e nenhum caminho do produto lê
--   esta coluna. A migração só abre o lugar onde a marcação vai morar.
-- ============================================================

alter table public.bia_chunks
  add column if not exists pressupoe_ausencia_de text[] not null default '{}';

-- O vocabulário é FECHADO — mesmo critério de `nucleo` e `tipo_conhecimento`.
-- Sem isto, "fala", "verbal", "linguagem" e "conversa" viram quatro conceitos
-- diferentes e o veto passa a depender de quem digitou a string. Com o CHECK, a
-- divergência aparece na importação e não em silêncio numa resposta.
--
-- ⚠️ ESPELHO EM TYPESCRIPT: `BIA_HABILIDADES` em `lib/bia/tipos.ts`. Se
-- divergirem, o banco recusa o INSERT — que é o comportamento desejado.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'bia_chunks_pressupoe_vocabulario'
  ) then
    alter table public.bia_chunks
      add constraint bia_chunks_pressupoe_vocabulario check (
        pressupoe_ausencia_de <@ array[
          'atencao_social',
          'atencao_compartilhada',
          'imitacao',
          'gestos_intencionais',
          'troca_de_turnos',
          'comunicacao_simbolica',
          'fala_funcional',
          'frases',
          'conversa_reciproca',
          'leitura_escrita'
        ]::text[]
      );
  end if;
end $$;

-- Filtro por sobreposição de array, igual aos outros. O veto roda no código
-- (lib/bia/pontuacao.ts, `filtrarDuro`), mas o índice serve a qualquer consulta
-- futura que queira cortar cedo — e custa pouco numa tabela deste tamanho.
create index if not exists bia_chunks_pressupoe_idx
  on public.bia_chunks using gin(pressupoe_ausencia_de);

comment on column public.bia_chunks.pressupoe_ausencia_de is
  'Habilidades que este conhecimento PRESSUPÕE ausentes. Se o contexto provar '
  'uma delas, o chunk é vetado — não rebaixado. Vocabulário fechado, espelhado '
  'em BIA_HABILIDADES (lib/bia/tipos.ts). PEND-196.';

-- ----- ROLLBACK -----
-- drop index if exists public.bia_chunks_pressupoe_idx;
-- alter table public.bia_chunks drop constraint if exists bia_chunks_pressupoe_vocabulario;
-- alter table public.bia_chunks drop column if exists pressupoe_ausencia_de;
