/**
 * Tipos compartilhados do produto Ayla — PRD §12.
 *
 * Importante: este módulo NÃO importa nada de /lib/ia. A Ayla e as skills
 * são produtos separados; comunicação entre eles é apenas via banco.
 */

export type AylaCategoria = "proativa" | "reativa";

export type AylaTipoProativa =
  | "boas_vindas"
  | "rotina"
  | "engajamento_2dias"
  | "engajamento_5dias"
  | "insight"
  | "repertorio_sugestao"
  | "trial_d3"
  | "trial_d0"
  | "emocional_streak"
  | "emocional_conquista"
  | "plano_seguimento"
  /** "aquela sequência ajudou?" — UMA vez por rotina, ver 0075. */
  | "rotina_seguimento"
  | "recuperacao_plano"
  | "recuperacao_rotina"
  | "fim_de_semana"
  /**
   * Campanha única do vídeo institucional (06/08/2026). Não é recorrente:
   * cada família recebe UMA vez, e a prova disso é o próprio link no texto
   * já enviado — ver `jaRecebeuVideoGuia`.
   */
  | "video_guia"
  | "dass21_convite"
  | "dass21_resultado_moderado"
  | "dass21_resultado_severo"
  | "campanha_informacional"
  | "campanha_promocional"
  | "campanha_avaliacao"
  | "campanha_operacional"
  /** Convite pra definir UMA criança específica (nome + idade) — o campo do
   *  nome veio com recado em vez de nome. Ver crianca-especifica.ts. */
  | "crianca_especifica";

export type AylaTipoReativa =
  /** O menu de temas da entrada guiada. Tipo próprio porque o texto dele É o
   *  estado: é dele que sai a numeração quando a mãe responde só "2". */
  | "entrada_guiada"
  | "resposta_registro"
  | "clarificacao_identificacao"
  | "clarificacao_conteudo"
  | "resposta_comando"
  | "confirmacao_sugestao"
  | "plano_pergunta"
  | "rotina_pergunta"
  | "rotina_conversa"
  /**
   * A Ayla PROPÔS uma sequência e está esperando a família responder — 17/08/2026.
   *
   * Tipo próprio porque o texto sozinho não diz que há uma decisão em aberto, e
   * porque a sequência proposta viaja em `ayla_messages.metadata.proposta`: é
   * ela que dá referente a um "sim" e é ela que vira o quadro depois do aceite.
   *
   * Caso real que o obrigou a existir (Manu, 17/08/2026): a mãe perguntou "o que
   * você sugere?" para uma sequência de vacina, e recebeu o quadro pronto em 22
   * segundos, com etapas que a Ayla inventou. Não havia onde guardar uma
   * proposta, então não havia como esperar por ela.
   */
  | "rotina_proposta"
  /** A rotina FICOU PRONTA e foi entregue. Tipo próprio de propósito: a ponte
   *  do plano dispara em "resposta_registro", e uma rotina entregue com aquele
   *  tipo acionava o gerador de PLANO logo em seguida — a mãe pedia rotina e
   *  recebia um PDF de plano por cima (caso real, 03/08/2026). */
  | "rotina_pronta"
  /** O PISO acionou por risco ATUAL à vida. É o marcador operacional de que há
   *  uma situação de segurança ABERTA — ver `estado-seguranca.ts`. Enquanto
   *  aberta, artefatos não disparam e a condução prioriza o próximo passo. */
  | "seguranca"
  /** A família confirmou atendimento/contato. Fecha o estado. */
  | "seguranca_encerrada"
  /** Chegou mídia que a Ayla não consegue ler (hoje: vídeo) e não havia texto
   *  junto. O recado é FIXO e não passa por modelo nenhum.
   *
   *  Tipo próprio pelo mesmo motivo de `rotina_pronta` e `plano_reenviado`: a
   *  ponte do Plano dispara em `resposta_registro`, e um vídeo marcado assim
   *  faria a mãe receber um PDF de plano por ter mandado um vídeo. */
  | "midia_nao_suportada"
  | "assinatura_nudge"
  /**
   * Conversa pós-Trial SEM link — Onda 1, 18/08/2026.
   *
   * ⚠️ Tipo próprio, e a razão é o cooldown. `reservarConviteAssinatura` procura
   * por `assinatura_nudge` nas últimas 12h para não repetir o LINK. Marcar com
   * `assinatura_nudge` um turno que não levou link nenhum consumiria a janela e
   * emudeceria o convite seguinte — que é justamente o defeito que esta onda
   * corrige, ressurgindo pela porta de trás.
   *
   * Também não é `resposta_registro`: aquele tipo dispara a ponte do Plano.
   */
  | "pos_trial";

export type AylaTipo = AylaTipoProativa | AylaTipoReativa;

/**
 * Resultado do parser — PRD §12.7.
 */
export type ParserResult = {
  // Identificação do foco (em famílias com 2+ membros atípicos)
  membro_atipico_id: string | null;
  confianca_identificacao: number; // 0-100

  // Conteúdo
  conquista: string | null;
  desafio: string | null;
  emocao_mae:
    | "muito_bem"
    | "bem"
    | "neutro"
    | "triste"
    | "cansada"
    | "ansiosa_estressada"
    | null;
  possivel_gatilho: string | null;
  observacao_livre: string | null;

  // Camada B (adulto cuidador)
  quem_estava:
    | "mae"
    | "pai"
    | "avo_a"
    | "avo_o"
    | "irmao_a"
    | "baba"
    | "professor_a"
    | "outro"
    | null;
  estado_adulto:
    | "calmo"
    | "firme"
    | "cansado"
    | "ansioso"
    | "impaciente"
    | null;
  reacao_adulto:
    | "acolhedor"
    | "esperou"
    | "interveio"
    | "impositivo"
    | "chamou_ajuda"
    | "outro"
    | null;
  confianca_camada_adulto: number; // 0-100

  // Sugestão Kolo Vivo
  sugestao_kolo_vivo: boolean;
  campo_kolo_vivo_sugerido?: string | null;
  texto_kolo_vivo_sugerido?: string | null;

  // Expansão de repertório (Fatia 3.3)
  experimentou?: string | null;
  experimentou_resultado?: "amou" | "gostou" | "neutro" | "nao_gostou" | null;

  // Confiança geral
  confianca: number; // 0-100
  precisa_clarificar?: string | null;
};

/**
 * Estado da família carregado pelo orquestrador antes de enviar.
 */
export type FamiliaContexto = {
  family_account_id: string;
  whatsapp_e164: string;
  timezone: string;
  user_id: string;
  membros: Array<{ id: string; nome: string; idade: number }>;
};

/**
 * Comandos textuais reconhecidos da mãe — PRD §12.5.
 */
export type Comando =
  | { tipo: "pausar"; dias: number }
  | { tipo: "mudar_horario"; hora: string }
  | { tipo: "sair" }
  | { tipo: "ajuda" };
