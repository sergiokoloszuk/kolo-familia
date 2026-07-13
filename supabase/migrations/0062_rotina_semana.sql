-- Rotina da SEMANA: uma rotina por DIA da semana (dia_semana 0=Seg..6=Dom).
-- Reusa `rotinas` + `rotina_tarefas` + o gerador de cartões (por rotina/dia) que
-- já existe. `dia_semana` NULL = rotina avulsa (o comportamento antigo, intacto).
-- `hora` opcional por tarefa (a ORDEM é o que importa; o horário é um extra).

alter table public.rotinas
  add column if not exists dia_semana int;

alter table public.rotina_tarefas
  add column if not exists hora text;

create index if not exists rotinas_semana_idx
  on public.rotinas(membro_atipico_id, dia_semana);

notify pgrst, 'reload schema';
