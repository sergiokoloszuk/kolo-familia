-- Kolo Família — incorporação cirúrgica da Pós em Neurodesenvolvimento
--
-- Fonte canônica:
--   docs/documentos-ayla/material-pos-neurodesenvolvimento-CANONICO-v1.md
-- Critério de comportamento (não fonte de conhecimento):
--   AYLA_KOLO_FAMILIA_PROMPT_MESTRE.pdf, transcrito em
--   docs/documentos-ayla/prompt-mestre-agencia-v1.md
--
-- Quatro mudanças editoriais somente. Brincadeira e mudança abrupta foram
-- deliberadamente preservadas: a bancada mostrou que a conduta desejada já
-- existe. Nenhuma mudança de Core, decisor, Perfil, prompt ou arquitetura.

insert into public.boas_praticas (
  id, texto_original, titulo, resumo, passos_praticos, quando_usar,
  erros_comuns, versao_curta, versao_conversa, versao_passos,
  skills_relacionadas, tags, faixa_etaria_min, faixa_etaria_max,
  perfis_aplicaveis, nivel, origem, peso_relevancia, versao, status,
  atividades_praticas, crencas_adulto
) values (
  'e1e083df-15ea-4297-9652-69530f8780e7',
  $bp$Curadoria da Base da Pós canônica: Manual §1/§3 (comunicação e escada pré-verbal) + Compêndio Tema 2 (perfil funcional da comunicação), com limites do Prompt Mestre da Agência.$bp$,
  $bp$Puxar pela mão, apontar ou entregar objeto já é comunicação funcional$bp$,
  $bp$Reconhecer a forma comunicativa que já funciona e modelar somente o próximo passo possível.$bp$,
  jsonb_build_array(
    $bp$Reconheça primeiro o significado da forma comunicativa que apareceu.$bp$,
    $bp$Cruze com o Perfil: se já usa palavras soltas, diga isso naturalmente e modele uma única palavra do item real; se usa gesto ou objeto, amplie a partir dessa forma.$bp$,
    $bp$Atenda ao pedido possível sem transformar fala ou olhar em condição para atender.$bp$,
    $bp$Observe qual forma a criança volta a usar espontaneamente em situação parecida.$bp$
  ),
  $bp$Quando a família diz que a criança não pede, mas relata gesto, objeto, som, aproximação de palavra, script ou ecolalia com função.$bp$,
  jsonb_build_array(
    $bp$dizer que a criança não se comunica quando o relato já mostra uma forma funcional$bp$,
    $bp$reter o item até obter fala ou contato visual$bp$,
    $bp$pedir várias habilidades novas de uma vez$bp$,
    $bp$listar fala, gesto, imagem e apontar quando o Perfil já mostra qual via está disponível$bp$,
    $bp$oferecer um menu de palavras genéricas em vez de escolher a palavra ligada ao pedido real$bp$
  ),
  $bp$Parta do gesto, objeto, aproximação de palavra ou ecolalia que já comunica algo; responda ao sentido e modele um passo pequeno.$bp$,
  $bp$Puxar pela mão, apontar, entregar um objeto, aproximar uma palavra ou usar uma ecolalia com função já comunica algo. Responda ao sentido e modele só um próximo passo. Quando o Perfil trouxer a forma que a criança já usa, torne isso perceptível com naturalidade: se já usa palavras soltas, ligue essa habilidade a UMA palavra do item pedido, não a um menu genérico. Nunca exija fala ou contato visual para atender.$bp$,
  '[]'::jsonb,
  '["comunicacao"]'::jsonb,
  '["comunicacao_funcional","pedir","puxa_pela_mao","apontar","entregar_objeto","aproximacao_de_palavra","ecolalia_funcional"]'::jsonb,
  1, 18, '[]'::jsonb, 'iniciante', 'admin', 0.5, 1, 'ativo',
  '[]'::jsonb,
  $bp$Só conta como pedido quando a criança fala ou olha para o adulto.$bp$
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from public.boas_praticas
    where id = 'e1e083df-15ea-4297-9652-69530f8780e7'
      and status = 'ativo'
      and versao = 1
      and titulo = $bp$Puxar pela mão, apontar ou entregar objeto já é comunicação funcional$bp$
  ) then
    raise exception '0089: BP de comunicação existente diverge do conteúdo aprovado';
  end if;
end $$;

do $$
declare
  alteradas integer;
begin
  update public.boas_praticas
  set
    titulo = $bp$Não quer fazer: distinguir compreender, começar, sustentar e pré-requisito$bp$,
    resumo = $bp$Reduzir o primeiro passo e usar o efeito como pista antes de atribuir a recusa a foco, motivação ou oposição.$bp$,
    versao_curta = $bp$Ajude com um primeiro passo pequeno e visível; a resposta ajuda a distinguir dificuldade de compreender, iniciar, sustentar ou executar.$bp$,
    versao_conversa = $bp$"Não quer fazer" ainda não explica a barreira. Ajude primeiro tornando só o começo pequeno e visível. Se precisar perguntar, escolha um único contraste que mude a próxima ajuda — por exemplo, se não sabe como começar ou se começa e logo para.$bp$,
    quando_usar = $bp$Quando a família relata recusa ampla de atividade, tarefa ou aprendizagem sem ainda localizar em que ponto a participação trava.$bp$,
    passos_praticos = jsonb_build_array(
      $bp$Mostre ou faça junto apenas o primeiro passo, em menos de um minuto.$bp$,
      $bp$Observe se a criança entra, permanece por pouco tempo ou continua sem conseguir executar.$bp$,
      $bp$Use essa diferença para escolher entre apoio de compreensão, início, permanência, pré-requisito, transição ou ambiente.$bp$
    ),
    atividades_praticas = '[]'::jsonb,
    erros_comuns = jsonb_build_array(
      $bp$despejar todas as hipóteses para a família$bp$,
      $bp$concluir preguiça, oposição ou falta de foco pelo relato amplo$bp$,
      $bp$investigar longamente antes de oferecer uma primeira ajuda reversível$bp$
    ),
    crencas_adulto = $bp$Se não faz, é porque não quer ou não presta atenção.$bp$,
    skills_relacionadas = '["foco","aprendizado","comunicacao","emocional","autonomia"]'::jsonb,
    tags = '["nao_quer_fazer","atividade","iniciar","sustentar","compreensao","pre_requisito","demanda"]'::jsonb,
    faixa_etaria_min = 1,
    faixa_etaria_max = 18,
    peso_relevancia = 0.5,
    versao = versao + 1
  where id = '4f7f16aa-f67a-44d1-bf4b-ce23c54f7e35'
    and status = 'ativo'
    and versao = 1;

  get diagnostics alteradas = row_count;
  if alteradas = 0 then
    if not exists (
      select 1
      from public.boas_praticas
      where id = '4f7f16aa-f67a-44d1-bf4b-ce23c54f7e35'
        and status = 'ativo'
        and versao = 2
        and titulo = $bp$Não quer fazer: distinguir compreender, começar, sustentar e pré-requisito$bp$
        and versao_conversa = $bp$"Não quer fazer" ainda não explica a barreira. Ajude primeiro tornando só o começo pequeno e visível. Se precisar perguntar, escolha um único contraste que mude a próxima ajuda — por exemplo, se não sabe como começar ou se começa e logo para.$bp$
    ) then
      raise exception '0089: BP de atividade divergiu do baseline e do estado final aprovado';
    end if;
  elsif alteradas <> 1 then
    raise exception '0089: BP de atividade alterou quantidade inesperada de linhas: %', alteradas;
  end if;
end $$;

do $$
declare
  alteradas integer;
begin
  update public.boas_praticas
  set
    titulo = $bp$No primeiro teste no mercado, mude só o ambiente antes de concluir desatenção$bp$,
    resumo = $bp$Em ambientes cheios, mudar uma variável do ambiente ou da demanda e comparar antes de concluir foco ou comportamento.$bp$,
    versao_curta = $bp$Teste uma única mudança ambiental, sem somar regra ou tarefa; compare o que muda, porque sensorial é hipótese, não conclusão.$bp$,
    versao_conversa = $bp$Em mercado, festa, escola barulhenta ou lugar cheio, correr ou parecer não escutar não prova falta de atenção. Ajude primeiro com UMA mudança ambiental, como ir num horário mais vazio. Nesse primeiro teste, não acrescente tarefa nem treino de regra. Observe se ele corre menos ou responde mais; se nada mudar, reduza o peso da hipótese sensorial.$bp$,
    quando_usar = $bp$Quando a dificuldade aparece em ambiente com muito som, luz, movimento ou pessoas e há no relato ou Perfil alguma pista sensorial.$bp$,
    passos_praticos = jsonb_build_array(
      $bp$Escolha uma só mudança possível; prefira horário mais vazio quando o relato for sobre mercado.$bp$,
      $bp$Sem adicionar regra ou tarefa, compare uma resposta observável naquele recorte: correr menos ou responder mais.$bp$,
      $bp$Se melhorar, trate como pista contextual; se não mudar, explore compreensão, espera, limite, interesse, cansaço ou outra barreira.$bp$
    ),
    atividades_praticas = '[]'::jsonb,
    erros_comuns = jsonb_build_array(
      $bp$chamar toda dificuldade de foco ou comportamento$bp$,
      $bp$chamar toda dificuldade em lugar cheio de sensorial$bp$,
      $bp$somar treino de regra ou resposta ao primeiro teste ambiental$bp$,
      $bp$mudar várias variáveis ao mesmo tempo e concluir uma causa$bp$
    ),
    crencas_adulto = $bp$Se não responde no mercado, está escolhendo não ouvir.$bp$,
    skills_relacionadas = '["sensorial","foco","emocional","rotina","comunicacao"]'::jsonb,
    tags = '["mercado","ambiente_cheio","barulho","luz","movimento","corre","nao_escuta","carga_sensorial"]'::jsonb,
    faixa_etaria_min = 1,
    faixa_etaria_max = 18,
    peso_relevancia = 0.5,
    versao = versao + 1
  where id = 'd5c505c5-03cf-4d5b-9dc9-562bfb6c327d'
    and status = 'ativo'
    and versao = 1;

  get diagnostics alteradas = row_count;
  if alteradas = 0 then
    if not exists (
      select 1
      from public.boas_praticas
      where id = 'd5c505c5-03cf-4d5b-9dc9-562bfb6c327d'
        and status = 'ativo'
        and versao = 2
        and titulo = $bp$No primeiro teste no mercado, mude só o ambiente antes de concluir desatenção$bp$
        and versao_conversa = $bp$Em mercado, festa, escola barulhenta ou lugar cheio, correr ou parecer não escutar não prova falta de atenção. Ajude primeiro com UMA mudança ambiental, como ir num horário mais vazio. Nesse primeiro teste, não acrescente tarefa nem treino de regra. Observe se ele corre menos ou responde mais; se nada mudar, reduza o peso da hipótese sensorial.$bp$
    ) then
      raise exception '0089: BP sensorial divergiu do baseline e do estado final aprovado';
    end if;
  elsif alteradas <> 1 then
    raise exception '0089: BP sensorial alterou quantidade inesperada de linhas: %', alteradas;
  end if;
end $$;

insert into public.boas_praticas (
  id, texto_original, titulo, resumo, passos_praticos, quando_usar,
  erros_comuns, versao_curta, versao_conversa, versao_passos,
  skills_relacionadas, tags, faixa_etaria_min, faixa_etaria_max,
  perfis_aplicaveis, nivel, origem, peso_relevancia, versao, status,
  atividades_praticas, crencas_adulto
) values (
  '60263003-e70e-4246-a2dc-cc7e49caa37e',
  $bp$Curadoria da Base da Pós canônica: Compêndio Tema 6 (sociometria escolar e mediação ativa de pares), com limites do Prompt Mestre da Agência.$bp$,
  $bp$Fica sozinho no recreio: observar a entrada e construir uma ponte concreta$bp$,
  $bp$Distinguir ausência de tentativa, tentativa sem entrada e conflito, e pedir mediação concreta ao adulto.$bp$,
  jsonb_build_array(
    $bp$Peça ao adulto uma observação concreta do que acontece antes de a criança ficar sozinha.$bp$,
    $bp$Teste uma entrada estruturada com uma criança possível e papéis complementares ligados a um interesse real.$bp$,
    $bp$Observe aproximação, troca ou permanência, sem usar quantidade de fala como único critério.$bp$
  ),
  $bp$Quando a família relata isolamento, dificuldade de brincar com pares ou conflitos repetidos no recreio ou em outro grupo.$bp$,
  jsonb_build_array(
    $bp$dizer apenas para incentivar a socialização$bp$,
    $bp$esperar que proximidade física produza participação sozinha$bp$,
    $bp$forçar grupo grande sem saber como a criança tenta entrar$bp$
  ),
  $bp$No recreio, uma dupla, papel definido e adulto iniciando a ponte são mais acionáveis do que apenas incentivar socialização.$bp$,
  $bp$Ficar sozinho não mostra, por si só, se a criança prefere aquele momento, tenta entrar e não consegue ou encontra conflito. Ajude primeiro pedindo ao adulto uma ponte concreta: uma dupla possível, dois papéis claros e apoio apenas para iniciar a atividade.$bp$,
  '[]'::jsonb,
  '["socializacao","comunicacao","emocional"]'::jsonb,
  '["recreio","fica_sozinho","pares","entrada_na_brincadeira","mediacao_adulto","dupla","papel_definido"]'::jsonb,
  4, 18, '[]'::jsonb, 'iniciante', 'admin', 0.5, 1, 'ativo',
  '[]'::jsonb,
  $bp$Basta colocar a criança perto das outras para ela aprender a participar.$bp$
)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1
    from public.boas_praticas
    where id = '60263003-e70e-4246-a2dc-cc7e49caa37e'
      and status = 'ativo'
      and versao = 1
      and titulo = $bp$Fica sozinho no recreio: observar a entrada e construir uma ponte concreta$bp$
  ) then
    raise exception '0089: BP social existente diverge do conteúdo aprovado';
  end if;
end $$;

notify pgrst, 'reload schema';
