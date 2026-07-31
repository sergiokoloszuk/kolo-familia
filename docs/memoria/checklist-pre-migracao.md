# Checklist pré-migração — amostra controlada

Preencher **na hora**, não de memória. Nenhum item é opcional.

> ## Sem snapshot confirmado, não aplicar migração.

> ⚠️ **O restore deste banco nunca foi testado.** O snapshot da Hostinger
> recuperou o banco no incidente de 08/06/2026 — funcionou uma vez, mas nunca
> foi exercitado deliberadamente. **Risco aceito e declarado**, não resolvido.
> Não é pendência da Memória Viva; é anterior a ela e vale para qualquer
> migração deste projeto.

## Backup

- [ ] Snapshot do dia existe no painel da Hostinger
- [ ] Data do snapshot: `____-__-__ __:__`
- [ ] Localização / identificador: `________________`
- [ ] Tamanho plausível (não é arquivo de 0 byte)
- [ ] Procedimento de restauração conhecido por quem está aplicando —
      ver [`ambiente-minimo-de-teste.md`](ambiente-minimo-de-teste.md)
- [ ] Quem restauraria, se preciso: `________________`

## Ambiente

- [ ] Versão do PostgreSQL de produção: `______`
      (`select version();`)
- [ ] Espaço em disco disponível: `______`
- [ ] Conexão confirmada **no banco certo** — conferir o host, não confiar na
      variável de ambiente da máquina
- [ ] Acesso por sessão SQL no host, **não** pelo painel do Easypanel

## Aplicação

- [ ] Commit implantado em produção: `________________`
- [ ] Igual ao commit de referência do protocolo (`cdfafb2`)? Se não, anotar a
      diferença: `________________`
- [ ] `PERFIL_FATOS_SHADOW_WRITE` **ausente ou desligada** — conferir no painel
      da Vercel, não só no `.env.local`
- [ ] Nenhum leitor do fact store:
      `grep -rn "perfil_fatos" apps/web/src --include=*.ts | grep -v "lib/kolo-vivo/fatos/" | grep -v "\.test\."`
      → deve retornar **vazio**
- [ ] Consultas de validação abertas e prontas
      ([`consultas-amostra.sql`](consultas-amostra.sql), bloco 1)
- [ ] Responsável técnico presente durante toda a aplicação: `______________`
- [ ] Janela de baixo tráfego

## Interrupção

- [ ] Plano de interrupção conhecido: parar na primeira falha, **não** avançar
      para a migração seguinte
- [ ] Rollback de cada migração localizado:
      `supabase/migrations/0071_rollback.sql` (a `0072` e a `0073` só criam
      tabelas novas — `drop table … cascade` reverte)
- [ ] Sabe-se que **nenhum dado de família é tocado** por nenhuma das três

## Assinatura

| | |
|---|---|
| Data e hora | |
| Responsável técnico | |
| Snapshot conferido por | |
| Resultado | ( ) aplicado ( ) abortado — motivo: |
