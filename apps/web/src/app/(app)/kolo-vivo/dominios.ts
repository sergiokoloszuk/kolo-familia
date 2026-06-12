/**
 * Os 9 domínios do Kolo Vivo (Retrato vivo da criança) — fonte única usada
 * pela tela visual, pela action de salvar e pelo carregamento na page.
 *
 * Cada domínio é guardado num campo do `perfil_vivo_membro`:
 * - `toplevel`: coluna jsonb dedicada (legado, mantida) — ex.: `sensorial`.
 * - `extras`:   chave dentro de `categorias_extras` (as skills leem via
 *   context.ts → resolveSecaoMembro). É onde moram os domínios novos.
 *
 * `legacyFallback` aponta pra um campo antigo cujo conteúdo aparece no card
 * enquanto o domínio novo estiver vazio (não migramos nada de forma
 * destrutiva — o texto antigo segue no banco e continua lido pela Ayla).
 */

export {
  MEMBRO_CAMPOS_TOPLEVEL,
  MEMBRO_CAMPOS_EXTRAS,
  membroCampoStorage,
  type MembroCampoToplevel,
  type MembroCampoExtras,
} from "@/lib/kolo-vivo/campos";
import { SUBCAMPOS_DOMINIO, type SubCampo } from "@/lib/kolo-vivo/subcampos";

export type { SubCampo };

export type DominioTone =
  | "sensorial"
  | "alimentacao"
  | "comunicacao"
  | "emocao"
  | "foco"
  | "sono"
  | "social"
  | "motor"
  | "rotina";

export type DominioKey =
  | "sensorial"
  | "nutricional"
  | "comunicacao"
  | "emocional"
  | "foco"
  | "sono"
  | "socializacao"
  | "motor"
  | "rotina"
  | "autonomia"
  | "aprendizado"
  | "imitacao"
  | "tela_midia"
  | "escola"
  | "saude_geral"
  | "gostos";

export type DominioDef = {
  key: DominioKey;
  storage: "toplevel" | "extras";
  label: string;
  tone: DominioTone;
  /** Campo legado lido como fallback enquanto `key` estiver vazio. */
  legacyFallback?: string;
  /** Microtexto sob o título quando o card está em edição. */
  descricao: string;
  placeholder: string;
  /** Sub-campos estruturados (opcional). Quando presentes, o card mostra um
   *  campo rotulado por dimensão em vez de um texto único. */
  campos?: SubCampo[];
};

export const DOMINIOS: DominioDef[] = [
  {
    key: "sensorial",
    storage: "toplevel",
    label: "Sensorial",
    tone: "sensorial",
    descricao: "Como o corpo percebe sons, texturas, luz e movimento.",
    placeholder:
      "Ex: hipersensível a sons agudos e texturas grudentas. Pressão profunda (abraço apertado) acalma.",
    campos: SUBCAMPOS_DOMINIO.sensorial,
  },
  {
    key: "nutricional",
    storage: "extras",
    label: "Alimentação",
    tone: "alimentacao",
    descricao: "O que come bem, o que recusa, como prefere comer.",
    placeholder:
      "Ex: aceita ~12 alimentos. Recusa texturas moles. Come melhor com colher e quando vira brincadeira.",
    campos: SUBCAMPOS_DOMINIO.nutricional,
  },
  {
    key: "comunicacao",
    storage: "extras",
    label: "Comunicação",
    tone: "comunicacao",
    descricao: "Como se expressa e como entende o que falam.",
    placeholder:
      "Ex: fala em 2-3 palavras. Entende muito mais do que diz. Apontar e imagens ajudam.",
    campos: SUBCAMPOS_DOMINIO.comunicacao,
  },
  {
    key: "emocional",
    storage: "extras",
    legacyFallback: "desafios_regulacao",
    label: "Regulação emocional",
    tone: "emocao",
    descricao: "Gatilhos, sinais quando está difícil e o que ajuda a passar.",
    placeholder:
      "Ex: crises depois de TV, transições e barulho. Sinais: bate as mãos. Acalma com peso/abraço e música baixa.",
    campos: SUBCAMPOS_DOMINIO.emocional,
  },
  {
    key: "foco",
    storage: "extras",
    label: "Foco e atenção",
    tone: "foco",
    descricao: "Quando se concentra fácil e quando dispersa.",
    placeholder:
      "Ex: foco intenso nos hiperfocos (até 40min). Em outras atividades, varia muito. Funciona melhor em passos curtos.",
    campos: SUBCAMPOS_DOMINIO.foco,
  },
  {
    key: "sono",
    storage: "extras",
    label: "Sono",
    tone: "sono",
    descricao: "Como adormece, como dorme, como acorda.",
    placeholder:
      "Ex: demora ~40min pra dormir. Luz baixa + som ambiente. Acorda 1x e volta sozinha.",
    campos: SUBCAMPOS_DOMINIO.sono,
  },
  {
    key: "socializacao",
    storage: "extras",
    label: "Socialização",
    tone: "social",
    descricao: "Como se relaciona com outras pessoas.",
    placeholder:
      "Ex: prefere adultos. Brinca lado a lado, não em interação. Conexão forte com uma priminha.",
    campos: SUBCAMPOS_DOMINIO.socializacao,
  },
  {
    key: "motor",
    storage: "extras",
    label: "Motor",
    tone: "motor",
    descricao: "Coordenação do corpo todo e das mãos.",
    placeholder:
      "Ex: motricidade grossa boa (corre, pula). Fina em desenvolvimento. Começou a usar pincel há 3 semanas.",
    campos: SUBCAMPOS_DOMINIO.motor,
  },
  {
    key: "rotina",
    storage: "extras",
    legacyFallback: "corpo_rotina",
    label: "Rotina",
    tone: "rotina",
    descricao: "Como atravessa as transições e o ritmo do dia.",
    placeholder:
      "Ex: boa com previsibilidade. Aceita aviso de 5min antes de trocar de atividade. Tablet sem preparo vira gatilho.",
    campos: SUBCAMPOS_DOMINIO.rotina,
  },
  // Domínios previstos no Adendo PRD — antes existiam só como dado, agora viram card.
  {
    key: "autonomia",
    storage: "extras",
    label: "Autonomia",
    tone: "motor",
    descricao: "O que já faz sem ajuda e onde ainda precisa de apoio.",
    placeholder:
      "Ex: come e veste sozinha; ainda precisa de ajuda no banho e pra calçar.",
    campos: SUBCAMPOS_DOMINIO.autonomia,
  },
  {
    key: "aprendizado",
    storage: "extras",
    label: "Aprendizado",
    tone: "foco",
    descricao: "Como aprende e o que ajuda a aprender.",
    placeholder:
      "Ex: aprende vendo e repetindo. Números fáceis, letras ainda custam. Gosta de aprender brincando.",
    campos: SUBCAMPOS_DOMINIO.aprendizado,
  },
  {
    key: "imitacao",
    storage: "extras",
    label: "Imitação",
    tone: "social",
    descricao: "O que imita — gestos, sons, brincadeiras de faz de conta.",
    placeholder:
      "Ex: imita gestos e sons de bichos. Faz de conta começando a aparecer.",
    campos: SUBCAMPOS_DOMINIO.imitacao,
  },
  {
    key: "tela_midia",
    storage: "extras",
    label: "Tela e mídia",
    tone: "comunicacao",
    descricao: "Relação com telas — o que assiste, quanto, como reage.",
    placeholder:
      "Ex: ama desenhos de dinossauro. Difícil desligar; sem aviso, vira gatilho.",
    campos: SUBCAMPOS_DOMINIO.tela_midia,
  },
  {
    key: "escola",
    storage: "extras",
    label: "Escola",
    tone: "rotina",
    descricao: "Como é a escola — adaptações, o que funciona, queixas.",
    placeholder:
      "Ex: escola inclusiva, tem acompanhante. Barulho do recreio pesa. Professora parceira.",
    campos: SUBCAMPOS_DOMINIO.escola,
  },
  {
    key: "saude_geral",
    storage: "extras",
    label: "Saúde geral",
    tone: "sensorial",
    descricao: "Saúde, acompanhamentos, alergias, sono do ponto médico.",
    placeholder:
      "Ex: acompanha com neuro e TO. Alergia a amendoim. Sono irregular.",
    campos: SUBCAMPOS_DOMINIO.saude_geral,
  },
  {
    key: "gostos",
    storage: "extras",
    label: "Gostos & arte",
    tone: "social",
    descricao: "Filmes, brincadeiras e arte que ama — e o que não gosta.",
    placeholder:
      "Ex: ama dinossauros e a Patrulha Canina. Adora massinha e tinta guache. Não gosta de cola na mão.",
    campos: SUBCAMPOS_DOMINIO.gostos,
  },
];
