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
  | "rotina";

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
};

export const DOMINIOS: DominioDef[] = [
  {
    key: "sensorial",
    storage: "toplevel",
    label: "Sensorial",
    tone: "sensorial",
    descricao: "Como o corpo dela percebe sons, texturas, luz e movimento.",
    placeholder:
      "Ex: hipersensível a sons agudos e texturas grudentas. Pressão profunda (abraço apertado) acalma.",
  },
  {
    key: "nutricional",
    storage: "extras",
    label: "Alimentação",
    tone: "alimentacao",
    descricao: "O que come bem, o que recusa, como prefere comer.",
    placeholder:
      "Ex: aceita ~12 alimentos. Recusa texturas moles. Come melhor com colher e quando vira brincadeira.",
  },
  {
    key: "comunicacao",
    storage: "extras",
    label: "Comunicação",
    tone: "comunicacao",
    descricao: "Como se expressa e como entende o que falam com ela.",
    placeholder:
      "Ex: fala em 2-3 palavras. Entende muito mais do que diz. Apontar e imagens ajudam.",
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
  },
  {
    key: "foco",
    storage: "extras",
    label: "Foco e atenção",
    tone: "foco",
    descricao: "Quando se concentra fácil e quando dispersa.",
    placeholder:
      "Ex: foco intenso nos hiperfocos (até 40min). Em outras atividades, varia muito. Funciona melhor em passos curtos.",
  },
  {
    key: "sono",
    storage: "extras",
    label: "Sono",
    tone: "sono",
    descricao: "Como adormece, como dorme, como acorda.",
    placeholder:
      "Ex: demora ~40min pra dormir. Luz baixa + som ambiente. Acorda 1x e volta sozinha.",
  },
  {
    key: "socializacao",
    storage: "extras",
    label: "Socialização",
    tone: "social",
    descricao: "Como se relaciona com outras crianças e adultos.",
    placeholder:
      "Ex: prefere adultos. Brinca lado a lado, não em interação. Conexão forte com uma priminha.",
  },
  {
    key: "motor",
    storage: "extras",
    label: "Motor",
    tone: "motor",
    descricao: "Coordenação do corpo todo e das mãos.",
    placeholder:
      "Ex: motricidade grossa boa (corre, pula). Fina em desenvolvimento. Começou a usar pincel há 3 semanas.",
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
  },
];
