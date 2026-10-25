/** Exportação mecânica das saídas reais; não reescreve respostas. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
const raiz = process.cwd();
const entrada = resolve(raiz, "docs/auditorias/ayla-temas-modelo-2026-10-25-referencias-base44.json");
const dados = JSON.parse(readFileSync(entrada, "utf8"));
const referencias = {
  ref_alimentacao: { nome: "Alimentação da Isabela", antigo: "Acolhe o medo de nunca ampliar o repertório; trabalha essa crença; relaciona autonomia, sensibilidade a cheiros e alimentos já conhecidos; oferece alternativas concretas e um próximo caminho.", avaliar: "A candidata utiliza o perfil e oferece falas prontas. Ainda concentra a ajuda em um único caminho e acolhe menos a mãe, especialmente na web. Não considero equivalência editorial comprovada." },
  ref_socializacao: { nome: "Amigas conversa e autoimagem", antigo: "Separa os três pontos relatados, oferece perguntas para conversar, apoia a autoimagem e propõe aproximações sociais ligadas aos interesses. Inclui reflexão da cuidadora e continuidade.", avaliar: "A web entrega ações para conversa, encontro e autoimagem; o WhatsApp reúne tudo em uma orientação mais curta. A web ainda afirma uma interpretação sobre a evitação antes de confirmá-la; a próxima pergunta reconhece essa lacuna." },
  ref_autonomia_8: { nome: "Autonomia aos oito anos", antigo: "Acolhe a mãe, explica possibilidades, organiza uma habilidade por vez e oferece um plano detalhado para escovação, falas e manejo da raiva.", avaliar: "A candidata traz etapas e participação com ajuda, mas escolhe começar por dentes sem conhecer a prioridade da família. A web ainda inclui enxaguar na sequência; a orientação odontológica não foi validada neste ensaio. O caso precisa de revisão, não aprovação automática." },
  ref_comunicacao_4: { nome: "Compreensão e expressão aos quatro anos", antigo: "Organiza a ajuda em compreender e expressar, com apoios visuais, linguagem simples, gestos, CAA, atividade prática e perguntas finais.", avaliar: "A web já separa compreensão e expressão e oferece exemplos executáveis. Não herda como fato a afirmação sem confirmação do exemplo antigo de que a filha fala mamãe. O WhatsApp preserva as duas frentes, mas continua mais resumido." },
  ref_brincadeira_adulta: { nome: "Brincadeira para uma jovem adulta", antigo: "Propõe Trilha Sonora da Vida, usa cinema e música e organiza duração, convite, execução, explicação e continuidade.", avaliar: "A candidata usa cinema e respeita a idade adulta, mas o formato ainda vazou instruções internas como Título curto ou participação possível da pessoa. Adaptar para não fala é desnecessário para este perfil fluente. Ainda não atingiu a naturalidade pretendida." },
  ref_introducao_foco: { nome: "Introdução de Atenção e Concentração", antigo: "Apresenta identidade e missão, reconhece atenção em interesses, planos de vestibular/trabalho e oferece retrato, orientações, atividades e crenças.", avaliar: "A candidata usa fatos e áudio, mas a abertura precisa melhorar: a web pergunta novamente sobre atenção em interesses, já registrada. O menu também não cobre os quatro caminhos de forma tão clara quanto a referência. Reprova a régua de não repetir pergunta respondida." },
};
const ids = [...new Set(dados.resultados.map((r) => r.id))];
if (ids.length !== 6 || dados.resultados.length !== 12) throw new Error("Aguardar as seis perguntas nos dois canais antes de exportar.");
const partes = [
  "# Comparativo da candidata Ayla com os exemplos do Base44",
  "25/10/2026. Veredito da equivalência editorial pretendida: **FALHOU**. Há ganho de estrutura e uso do perfil, mas a candidata ainda não alcançou a referência de forma consistente. Introdução de Foco e naturalidade das brincadeiras precisam de correção. Este veredito é do texto, não da compilação ou dos testes de código.",
  "## Como ler",
  "São as mesmas perguntas e os dados de demonstração trazidos na conversa. Não houve acesso a contas familiares. O Base44 não foi executado novamente: a referência abaixo resume a resposta original fornecida pela responsável. As respostas da candidata foram geradas pelo modelo real, sem edição ou melhora manual.",
  "O contexto e os prompts reais da web e o produtor oficial do WhatsApp foram exercitados com área fixada e dados em memória. Isto avalia o texto retornado pelos motores, antes da apresentação na interface; não prova roteamento, gravação, entrega no WhatsApp ou produção. As perguntas são de teste de produto, não planos clínicos validados.",
];
for (const id of ids) {
  const r = referencias[id]; const linhas = dados.resultados.filter((x) => x.id === id);
  partes.push(`## ${r.nome}`, `**Pergunta usada**\n\n> ${linhas[0].mensagem.replaceAll("\n", "\n> ")}`,
    `**Referência do app antigo**\n\n${r.antigo}`,
    `**Comparação honesta**\n\n${r.avaliar}`);
  for (const canal of ["web", "whatsapp"]) {
    const linha = linhas.find((x) => x.canal === canal);
    partes.push(`### Resposta da candidata na ${canal === "web" ? "web" : "Ayla no WhatsApp"}`, linha.texto);
  }
}
partes.push("## Evidência", "As 12 saídas integrais, perfis de demonstração, modelos e tempos estão em [dados da rodada](ayla-temas-modelo-2026-10-25-referencias-base44.json). A leitura editorial acima não é uma nota automática nem resultado de teste humano na Preview.");
const destino = resolve(raiz, "docs/auditorias/ayla-comparativo-base44-2026-10-25.md");
writeFileSync(destino, partes.join("\n\n") + "\n");
console.log(JSON.stringify({ arquivo: destino, perguntas: ids.length, respostas: dados.resultados.length }));
