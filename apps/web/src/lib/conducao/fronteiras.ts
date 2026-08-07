/**
 * O REGISTRO DE FRONTEIRAS — uma rede só, N fronteiras.
 *
 * A rede construída para o diagnóstico (detecta → regenera orientada pelo erro
 * → piso) resolveu um problema que não é exclusivo do diagnóstico. Quando a
 * fronteira clínica entrou, havia duas saídas:
 *
 *   (a) duplicar a rede — rede de diagnóstico, rede clínica, e depois rede de
 *       direitos, rede de escopo… cada uma com o seu `if` em `responder.ts` e
 *       em `engine.ts`, divergindo com o tempo;
 *   (b) tornar a rede genérica e a FRONTEIRA um dado.
 *
 * Esta é a (b), e é o menor formato possível: uma fronteira é um nome, um
 * detector, uma instrução de refazer e um piso. Acrescentar a próxima é
 * acrescentar uma entrada nesta lista — nada muda nos dois canais.
 *
 * ORDEM IMPORTA. A clínica vem primeiro: quando as duas disparam na mesma
 * resposta, o risco físico manda. `FRONTEIRA_CLINICA` no prompt diz a mesma
 * coisa ("havendo conflito, segurança clínica vence"), e o código não pode
 * discordar do prompt.
 */

import {
  acharConclusaoDiagnostica,
  confirmadosDoBloco,
  type AchadoDiagnostico,
  type ContextoDeteccao,
} from "./deteccao-diagnostico";
import { acharConclusaoClinica } from "./deteccao-clinica";
import {
  instrucaoRegenerar,
  respostaSeguraDeDiagnostico,
} from "./recuperacao-diagnostico";
import { instrucaoRegenerarClinica, respostaSeguraClinica } from "./recuperacao-clinica";

export type DadosDoPiso = {
  nomeCuidador?: string | null;
  nomeMembro?: string | null;
};

export type Fronteira = {
  /** Vai pro log — é por aqui que se acompanha qual fronteira dispara mais. */
  nome: string;
  achar: (texto: string, contexto?: ContextoDeteccao) => AchadoDiagnostico[];
  instrucao: (achados: AchadoDiagnostico[]) => string;
  piso: (dados: DadosDoPiso) => string;
};

export const FRONTEIRAS: readonly Fronteira[] = [
  {
    nome: "clinica",
    // A clínica não usa o contexto: o corpo não fica seguro porque um
    // diagnóstico está cadastrado. Assinatura compatível, e só.
    achar: acharConclusaoClinica,
    instrucao: instrucaoRegenerarClinica,
    piso: respostaSeguraClinica,
  },
  {
    nome: "diagnostico",
    achar: acharConclusaoDiagnostica,
    instrucao: instrucaoRegenerar,
    piso: respostaSeguraDeDiagnostico,
  },
];

export type Atravessamento = {
  fronteira: Fronteira;
  achados: AchadoDiagnostico[];
};

/**
 * A primeira fronteira atravessada, na ordem de prioridade acima. `null` quando
 * o texto está publicável.
 *
 * Uma só, e não todas: a regeneração recebe uma instrução por vez. Empilhar
 * duas correções num turno produz a resposta defensiva que as duas fronteiras
 * proíbem — e, na prática, quem atravessa a clínica costuma atravessar a de
 * diagnóstico pelo mesmo motivo.
 */
export function fronteiraAtravessada(
  texto: string,
  /**
   * O bloco `<diagnostico_registrado>` que o canal já monta e já manda pro
   * modelo. Passar o MESMO texto que o prompt lê é o ponto: enquanto o detector
   * lia só a resposta, ele proibia o que o prompt mandava fazer — confirmar um
   * diagnóstico que a própria família cadastrou. Omitir mantém o comportamento
   * antigo, que é o mais restritivo.
   */
  diagnosticoRegistrado?: string | null,
): Atravessamento | null {
  const contexto: ContextoDeteccao = {
    confirmados: confirmadosDoBloco(diagnosticoRegistrado),
  };
  for (const fronteira of FRONTEIRAS) {
    const achados = fronteira.achar(texto, contexto);
    if (achados.length > 0) return { fronteira, achados };
  }
  return null;
}
