-- ============================================================
-- Kolo Família — Seeds iniciais
-- Migração 0003: dados que precisam existir desde o início.
-- ============================================================

-- ----- 7 tipos de botão de apoio (PRD §7.12) -----
insert into public.output_types (key, label, icone, prompt_template, gera_imagem_opcional, ordem, ativo) values
  ('brincadeiras',        'Brincadeiras',           'gamepad-2',   'Sugira 2 a 3 brincadeiras concretas alinhadas ao perfil sensorial e interesses do membro atípico em foco. Inclua materiais simples e duração estimada para cada uma.', true,  10, true),
  ('atividades',          'Atividades',             'sparkles',    'Sugira 2 a 3 atividades do dia a dia que apoiam o neurodesenvolvimento, alinhadas ao perfil e à rotina familiar.',                                                  true,  20, true),
  ('crencas',             'Crenças',                'lightbulb',   'Apresente 2 a 3 crenças/mitos comuns sobre o tema, com contraposição prática baseada em observação. Sem afirmar causas.',                                       false, 30, true),
  ('o_que_fazer_diferente','O que fazer diferente', 'route',       'A partir do diário recente, sugira uma mudança concreta de abordagem para um desafio recorrente. Aberto a hipóteses, sem afirmar a causa.',                       false, 40, true),
  ('historias_sociais',   'Histórias sociais',      'book-open',   'Crie uma mini-história social ilustrada em 3 a 5 cenas para preparar o membro atípico para a situação descrita. Linguagem concreta, perspectiva da criança.',     true,  50, true),
  ('frases_prontas',      'Frases prontas',         'message-square','Forneça 5 a 8 frases que a mãe pode usar literalmente em situações específicas. Tom calmo, firme, acolhedor. Sem "eu sei como você se sente".',                  false, 60, true),
  ('rotinas',             'Rotinas',                'calendar-clock','Sugira uma rotina ou ajuste em rotina existente, considerando perfil sensorial, interesses e energia do membro atípico.',                                       false, 70, true)
on conflict (key) do update set
  label = excluded.label,
  icone = excluded.icone,
  prompt_template = excluded.prompt_template,
  gera_imagem_opcional = excluded.gera_imagem_opcional,
  ordem = excluded.ordem,
  ativo = excluded.ativo;

-- ----- Skills iniciais (PRD §7.4.5) -----
-- objective/tone/scope/limits guiados pelo PRD; routing_keywords/priority/kolo_vivo_fields definidos pelo time.
-- Estas são minutas iniciais — ajustar via editor visual quando a Fase 11 chegar.

insert into public.specialist_prompt_templates
  (name, display_name, objective, tone, scope, limits, kolo_vivo_fields, knowledge_tags, routing_keywords, routing_priority, fallback_questions, ativo)
values
  (
    'sensorial',
    'Perfil Sensorial',
    'Apoiar a mãe a entender e ajustar o ambiente e estímulos para o perfil sensorial do membro atípico, abrindo hipóteses para observar.',
    'Acolhedor, prático, direto. Trata a mãe como adulta competente.',
    'Sensibilidades táteis, auditivas, visuais, vestibulares. Ajustes de ambiente. Brincadeiras sensoriais.',
    'Não diagnostica. Não substitui terapeuta ocupacional. Não recomenda intervenção clínica. Abre hipóteses, não afirma causas.',
    '["sensorial","desafios_regulacao","corpo_rotina"]'::jsonb,
    '["sensorial","ambiente","estimulo","textura","som","luz"]'::jsonb,
    '["barulho","tecido","luz","cheiro","textura","comida","banho","crise","desregulada","sobrecarregada","estimulo"]'::jsonb,
    70,
    '["O que ele/ela está fazendo agora?","Onde costuma reagir mais — em casa, na escola, no transporte?","Algum estímulo (som, luz, textura) que você notou em comum nas crises?","O que costuma acalmar?"]'::jsonb,
    true
  ),
  (
    'regulacao_emocional',
    'Regulação Emocional',
    'Apoiar a leitura e regulação emocional do membro atípico e do adulto cuidador, com foco em leveza e estratégias aplicáveis.',
    'Calmo, sereno, prático.',
    'Crises, ansiedade, medo, transições, frustração. Regulação compartilhada (mãe + criança).',
    'Não diagnostica transtornos. Não substitui psicólogo/psiquiatra. Não interpreta como saúde mental clínica.',
    '["desafios_regulacao","como_e","essencial"]'::jsonb,
    '["regulacao","emocao","crise","transicao","ansiedade","medo"]'::jsonb,
    '["crise","chorou","ataque","explodiu","gritou","ansioso","ansiosa","não consigo","perdeu o controle","desregulou","fica nervoso"]'::jsonb,
    80,
    '["O que veio antes da crise (sono, fome, transição, contrariedade)?","O que costuma ajudar a sair da crise?","Como você está agora?","Quer ideias do que tentar quando isso voltar?"]'::jsonb,
    true
  ),
  (
    'comunicacao',
    'Comunicação',
    'Apoiar comunicação verbal/não-verbal entre a mãe e o membro atípico, com frases prontas e estratégias de linguagem clara.',
    'Direto, concreto. Ensina sem tom didático.',
    'Comunicação alternativa, frases-pronto, redirecionamento, escuta ativa, instruções claras.',
    'Não substitui fonoaudiólogo. Não recomenda dispositivos CAA sem profissional.',
    '["como_e","essencial"]'::jsonb,
    '["comunicacao","linguagem","frases","conversa"]'::jsonb,
    '["não fala","não responde","não escuta","como falar","o que dizer","fala pouco","não entende"]'::jsonb,
    60,
    '["Como ele/ela costuma se comunicar quando está bem?","Em quais momentos a comunicação fica mais difícil?","Você quer uma frase pronta para usar agora?","Quer pensar junto sobre como abordar?"]'::jsonb,
    true
  ),
  (
    'transicoes',
    'Transições e Rotina',
    'Apoiar transições difíceis (escola, banho, sono, mudanças) com previsibilidade e ferramentas visuais.',
    'Estruturado, calmo, prático.',
    'Transições do dia a dia, mudanças de rotina, antecipação visual, rotinas previsíveis.',
    'Não prescreve rotina rígida sem considerar contexto da família.',
    '["corpo_rotina","desafios_regulacao"]'::jsonb,
    '["transicao","rotina","previsibilidade","sono","escola"]'::jsonb,
    '["transição","muda","mudança","escola","banho","dormir","sono","acordar","sair","escola pra casa","horário"]'::jsonb,
    60,
    '["Qual transição você está pensando agora?","Você usa algum aviso prévio (5 minutos, timer, imagem)?","Como ele/ela costuma reagir nessa transição?","Quer ideias do que ajustar?"]'::jsonb,
    true
  ),
  (
    'sono',
    'Sono',
    'Apoiar a higiene de sono do membro atípico e da mãe, com ajustes de ambiente e ritmo.',
    'Prático, sereno.',
    'Hora de dormir, despertares, ambiente do quarto, ritmo circadiano, regulação noturna.',
    'Não diagnostica distúrbios do sono. Não substitui pediatra/neurologista.',
    '["corpo_rotina","sensorial"]'::jsonb,
    '["sono","dormir","melatonina","acordar","ambiente"]'::jsonb,
    '["sono","dorme","dormir","acordou","desperta","insônia","cansado","cansada","exausta","não pega no sono"]'::jsonb,
    65,
    '["A que horas ele/ela costuma dormir e acordar?","Como está a rotina antes de dormir (telas, banho, jantar)?","O quarto tem o que (luz, som, textura)?","Você está conseguindo descansar também?"]'::jsonb,
    true
  ),
  (
    'meu_bem_estar',
    'Meu bem-estar',
    'Apoiar o bem-estar emocional e a regulação da própria mãe — porque o ajuste de mindset do adulto influencia diretamente o membro atípico.',
    'Acolhedor, sem performar empatia. Direto. "Isso cansa mesmo."',
    'Esgotamento, culpa, sobrecarga, autocuidado realista, regulação do adulto cuidador.',
    'Não substitui psicólogo. Em sinais de risco, redireciona para profissional. Não trata depressão/ansiedade clinicamente.',
    '["camada2_dinamica","camada2_recursos"]'::jsonb,
    '["mae","cuidador","exaustao","regulacao_adulto","bem_estar"]'::jsonb,
    '["cansada","exausta","não aguento","minha culpa","sozinha","ninguém entende","triste","ansiosa","esgotada","sobrecarregada"]'::jsonb,
    85,
    '["Como você está agora, em uma palavra?","O que você fez hoje só para você?","Tem alguém com quem dividir essa carga?","Quer pensar em uma micro-pausa para o resto do dia?"]'::jsonb,
    true
  ),
  (
    'comportamento_e_limites',
    'Comportamento e Limites',
    'Apoiar leitura de comportamentos desafiadores e estabelecimento de limites firmes e acolhedores.',
    'Firme, acolhedor, prático.',
    'Birras, agressividade, oposicionismo, limites, consequências naturais, reforço positivo.',
    'Não diagnostica transtornos de conduta. Não recomenda punição. Não compara crianças.',
    '["desafios_regulacao","como_e"]'::jsonb,
    '["comportamento","limite","birra","agressao","oposicao","reforco"]'::jsonb,
    '["bate","bateu","mordeu","grita","desafiador","não obedece","faz birra","joga as coisas","quebra"]'::jsonb,
    70,
    '["O que aconteceu antes do comportamento?","Como você reagiu (sem julgamento, só descrição)?","Que limite você quer firmar?","Quer ideias de como dizer isso na hora?"]'::jsonb,
    true
  )
on conflict (name) do nothing;

-- ----- Boas Práticas iniciais (exemplos curados) -----
-- Ficam ativas para o roteamento testar. Substituir pela curadoria real da Karina.

insert into public.boas_praticas
  (texto_original, titulo, resumo, versao_curta, versao_conversa,
   skills_relacionadas, tags, perfis_aplicaveis, nivel,
   origem, status, peso_relevancia)
values
  (
    'Antes de uma transição (banho, escola, sair de casa), avise com 5 minutos de antecedência usando palavras concretas e, se possível, uma imagem ou objeto. Em vez de "vamos sair logo", diga "em 5 minutos vamos colocar o casaco e ir para a escola".',
    'Aviso prévio de 5 minutos com linguagem concreta',
    'Transições ficam mais fáceis quando o cérebro tem tempo para se preparar e palavras concretas para se ancorar.',
    'Antes da transição: avise com 5 minutos e use palavras concretas (não abstratas).',
    'Uma coisa que costuma ajudar muito: avisar 5 minutos antes da transição, com palavras bem concretas. Em vez de "vamos sair logo", diga "em 5 minutos a gente coloca o casaco e vai para a escola". Pode ser ainda mais simples se você mostrar o casaco enquanto fala.',
    '["transicoes","comunicacao"]'::jsonb,
    '["transicao","aviso","linguagem_concreta"]'::jsonb,
    '["TEA","TDAH","Outro"]'::jsonb,
    'iniciante',
    'admin',
    'ativo',
    0.7
  ),
  (
    'Em momentos de desregulação, baixe a quantidade de estímulo antes de tentar conversar: luz mais baixa, som desligado, sua voz mais grave e devagar. O sistema nervoso precisa sair da sobrecarga antes de processar palavras.',
    'Baixar o estímulo antes de tentar conversar',
    'Quando o sistema nervoso está sobrecarregado, palavras viram mais ruído. Reduzir antes de explicar funciona melhor.',
    'Crise: primeiro reduza estímulo, depois converse — não no inverso.',
    'Em crise, antes de qualquer conversa, baixe os estímulos: luz mais baixa, som desligado, sua voz mais grave e devagar. Quando o sistema nervoso está sobrecarregado, mais palavras viram mais ruído. Você fala depois.',
    '["regulacao_emocional","sensorial"]'::jsonb,
    '["crise","desregulacao","estimulo","ambiente"]'::jsonb,
    '["TEA","TDAH","Outro"]'::jsonb,
    'iniciante',
    'admin',
    'ativo',
    0.8
  ),
  (
    'Limites firmes e acolhedores se constroem na frase: "Eu vejo que você está com raiva. Eu não vou deixar você bater. Vou ficar aqui com você." A criança recebe o limite e a presença juntos.',
    'Limite firme + acolhimento na mesma frase',
    'A criança aprende que limite e amor não são opostos quando os dois aparecem juntos.',
    'Limite + acolhimento na mesma frase: "vejo + não deixo + fico aqui".',
    'Quando precisar firmar um limite numa hora difícil, tente colocar três coisas na mesma frase: o que você vê (vejo que você está com raiva), o limite (não vou deixar você bater) e a presença (vou ficar aqui com você). A criança recebe o limite e o cuidado juntos — não como opostos.',
    '["comportamento_e_limites","comunicacao"]'::jsonb,
    '["limite","acolhimento","frase_pronta"]'::jsonb,
    '["TEA","TDAH","Outro"]'::jsonb,
    'iniciante',
    'admin',
    'ativo',
    0.7
  )
on conflict do nothing;

-- ----- Configuração de preços (PRD §5.1, valor real fica em doc operacional) -----
insert into public.configuracao_precos (chave, valor_centavos, moeda, descricao) values
  ('plano_mensal', 5300, 'BRL', 'Plano mensal padrão (placeholder — atualizar conforme doc operacional).'),
  ('plano_anual',  50880, 'BRL', 'Plano anual com ~20% de desconto (placeholder).')
on conflict (chave) do nothing;

-- ----- Sobre a plataforma (placeholders mínimos para landing renderizar) -----
insert into public.sobre_plataforma (chave, conteudo_md, publicado) values
  ('promessa', '# Estratégia personalizada para o dia a dia da família atípica\n\nCom mais clareza e leveza, em qualquer hora do dia.', true),
  ('disclaimer_clinico', 'O Kolo Família não substitui profissionais da saúde. Complementa o cuidado da família.', true)
on conflict (chave) do nothing;

-- ============================================================
-- FIM dos seeds.
-- ============================================================
