/**
 * ⚠️ ESTE ARQUIVO MUDOU DE ENDEREÇO, NÃO DE COMPORTAMENTO.
 *
 * A extração de conhecimento vive agora em `@/lib/conhecimento/extrair` —
 * módulo NEUTRO DE CANAL. Enquanto morava aqui, dentro de `lib/ia/` (que é
 * território da conversa web), o WhatsApp não tinha como chamá-la sem importar
 * a web inteira, e por isso ganhou um extrator próprio, mais fraco: um fato por
 * turno, sem ver o perfil, e com uma segunda chamada de modelo só pra descobrir
 * o sub-campo.
 *
 * O reexport fica porque os chamadores da web não têm nada a ver com essa
 * mudança, e trocar import em quatro arquivos só pra provar que houve mudança
 * seria diff sem informação.
 *
 * Para código NOVO: importe de `@/lib/conhecimento/extrair`.
 */
export {
  extrairAtualizacoes,
  CAMPOS_CAMADA1,
  CAMPOS_CAMADA2,
  type ItemKoloVivo,
  type PropostaAtualizacao,
  type ParamsExtracao,
} from "@/lib/conhecimento/extrair";
