/**
 * Lê os itens do array `system:` de um arquivo-fonte, na ordem.
 *
 * ⚠️ POR QUE ISTO EXISTE. Quatro testes guardavam a ordem dos blocos do prompt
 * casando a string literal `"[core.conteudo, bloco, …]"` inteira. A guarda era
 * boa e a implementação era frágil: bastava o array ser quebrado em várias
 * linhas — o que não muda comportamento nenhum — para os quatro caírem juntos.
 *
 * O que precisa ser guardado é a ORDEM. Um bloco de repertório antes do
 * contexto faz a resposta nascer da Boa Prática em vez de nascer da criança;
 * uma regra de formato que não seja a última perde para o markdown que o
 * próprio documento `core` demonstra. Nada disso depende de onde caem as
 * quebras de linha.
 */
export function itensDoSystem(fonte: string): string[] {
  const semComentarios = fonte
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
  const m = semComentarios.match(/system: \[([^\]]*)\]/);
  if (!m) throw new Error("array do `system` não encontrado no fonte");
  return (
    m[1]
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean)
      // ⚠️ `instrucaoExtra ?? ""` NÃO é um bloco do prompt (24/08/2026). É o
      // slot da correção que a rede de fronteiras injeta na SEGUNDA passada, e
      // vale `""` em todo turno normal — o `.filter(Boolean)` do próprio código
      // o remove antes de o system existir. Contá-lo aqui faria os testes de
      // ordem medirem uma linha que nunca chega ao modelo, e foi o que
      // aconteceu: quatro guardas caíram dizendo que o último bloco era ele.
      .filter((x) => !x.startsWith("instrucaoExtra"))
  );
}
