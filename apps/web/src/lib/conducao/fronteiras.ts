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
  type AchadoDiagnostico,
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
  achar: (texto: string) => AchadoDiagnostico[];
  instrucao: (achados: AchadoDiagnostico[]) => string;
  piso: (dados: DadosDoPiso) => string;
};

export const FRONTEIRAS: readonly Fronteira[] = [
  {
    nome: "clinica",
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
export function fronteiraAtravessada(texto: string): Atravessamento | null {
  for (const fronteira of FRONTEIRAS) {
    const achados = fronteira.achar(texto);
    if (achados.length > 0) return { fronteira, achados };
  }
  return null;
}
