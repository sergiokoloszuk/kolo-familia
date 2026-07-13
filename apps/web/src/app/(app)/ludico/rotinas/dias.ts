// Constantes puras da rotina — NÃO pode viver em actions.ts ("use server"),
// que só pode exportar funções async. Importado pela página da semana e pelas
// actions.
export const DIAS_SEMANA = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];
