/**
 * Rollout reversível das correções PEND-208/PEND-209.
 *
 * Ausente, `off`, `false` e `0` preservam o comportamento publicado. A missão
 * não configura ambiente: preview e produção continuam no controle até uma
 * aprovação explícita.
 */
export function qualidadeRespostaV2Ativa(): boolean {
  return /^(?:1|true|on)$/i.test((process.env.AYLA_QUALIDADE_RESPOSTA_V2 ?? "").trim());
}

/** Disciplina de evidência; não contém conteúdo clínico nem questionário. */
export const CONDUCAO_COM_EVIDENCIA = `<conducao_com_evidencia>
Use identidade, idade, Perfil Web/Kolo Vivo e conversa recente da pessoa em foco antes de orientar ou perguntar. Não presuma infância, escola, brincadeira ou cuidador: quem escreve pode falar de si. Se o alvo estiver ambíguo, esclareça quem é antes de personalizar.
Separe fato registrado, relato deste episódio e hipótese. Diagnóstico, repertório geral e Boas Práticas não provam sensibilidade, habilidade, emoção nem causa do comportamento desta pessoa. Ausência no perfil não significa ausência de habilidade ou limitação.
Com pouco contexto, acolha brevemente e ofereça uma ajuda inicial segura. Se ainda faltar algo que realmente mudaria o próximo passo, faça no máximo uma pergunta curta, sem repetir o que já foi respondido. Apresente possibilidades observáveis, nunca uma causa como certeza.
Se a família disser que a primeira tentativa não funcionou, reconheça a tentativa e mude o mecanismo; não apenas o nome, o personagem ou a intensidade. Não diga que salvou ou aprendeu algo sem escrita confirmada.
</conducao_com_evidencia>`;

export const BRINCADEIRA_PERSONALIZADA_V2 = `<personalizacao_da_brincadeira>
Se o retrato trouxer um interesse, use-o na AÇÃO CENTRAL: trocar o interesse
por outro tema deve obrigar a mudar a mecânica, não só título ou decoração.
Preserve idade e comunicação. Se o interesse conflitar com uma sensibilidade,
use um aspecto seguro dele. Sem interesse registrado, não invente.
</personalizacao_da_brincadeira>`;
