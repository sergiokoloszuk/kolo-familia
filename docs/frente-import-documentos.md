# Frente — Importar laudos / relatórios → Kolo Vivo longitudinal

> Spec detalhado (backlog item 12). **Pré-requisito:** Storage funcionando
> (RLS 403 do bucket `imagens` precisa ser resolvido — mesmo bloqueio do
> avatar/imagem). Sem isso, não há onde guardar o arquivo.
>
> Status: desenhado, não implementado. Faseado pra emendar quando o Storage subir.

## 1. Objetivo e valor

Permitir anexar **laudo médico, relatório de terapeuta e relatório escolar**;
a IA **extrai** o que vale registrar, **organiza por data** e **cita a fonte**.
Com o tempo isso vira a **espinha longitudinal** da criança: dá pra ver a
evolução ("em 03/2025 a fono notou X; em 04/2026, Y"), alimentar o Kolo Vivo e
enriquecer os relatórios pra escola/terapeuta.

Princípio central: **cada fato carrega FONTE + DATA DO DOCUMENTO** (a data que
está no laudo, não a do upload). É isso que faz a linha do tempo funcionar.

## 2. Entrada (como a pessoa anexa)

Uma área única de "Adicionar documento" que aceita **todas** estas formas:

1. **Arrastar e soltar (drag-and-drop):** zona destacada "arraste o arquivo
   aqui". Realça no `dragover`. Aceita múltiplos arquivos de uma vez.
2. **Buscar no computador:** clicar na zona abre o seletor de arquivos do SO
   (`<input type="file" accept=".pdf,image/*" multiple>`).
3. **Foto (celular):** botão "Tirar foto" usa a câmera (`<input type="file"
   accept="image/*" capture="environment">`) e também a galeria. Útil pra laudo
   de papel. Permitir **várias fotos** (laudo de várias páginas = várias fotos).
4. **Colar (copiar e colar):**
   - **Texto colado:** um campo "ou cole o texto aqui" (e-mail/PDF/WhatsApp).
     Não gera arquivo — vira documento do tipo `texto`.
   - **Imagem da área de transferência:** colar (Ctrl+V) uma imagem
     (print/foto) na zona → tratada como foto.
5. **PDF:** aceito direto (inclusive **multipágina** e **escaneado**). Claude lê
   PDF nativamente (visão).

**Formatos aceitos:** PDF, JPG, PNG, WEBP, HEIC (foto de iPhone), e texto colado.
**Limites:** ~15 MB por arquivo, até N páginas/arquivos por envio (definir).
**Limite real conhecido:** **manuscrito** sai mal no OCR — avisar a usuária.

Cada item enviado mostra um preview (miniatura/ícone + nome) e um estado
(enviando → extraindo → pronto / erro).

## 3. Pipeline de processamento

1. **Upload** pro bucket **privado** `documentos` (novo; RLS por família). Texto
   colado não sobe arquivo.
2. **Extração por IA (visão):** PDF/imagem vão pro Claude (Sonnet, suporta
   PDF/imagem); texto colado vai como texto. Saída = JSON estruturado (§5).
3. A IA **detecta a data e a fonte** no próprio documento (cabeçalho, assinatura,
   carimbo). Se não achar, pede pra usuária confirmar.
4. Salva a linha em `documentos_membro` (status `extraido`).
5. **Revisão antes de gravar** (§6): a usuária confere o resumo, a data e a fonte
   (editáveis) e marca o que entra no Kolo Vivo.
6. No confirmar: fatos aprovados vão pro Kolo Vivo (anexando, com fonte+data); o
   documento fica no repositório.

## 4. Onde os dados vão

- **Repositório de documentos** (por criança): lista o arquivo + resumo + data +
  fonte. É o registro longitudinal bruto.
- **Kolo Vivo:** só o que for aprovado vira/atualiza seção (camada1/camada2),
  com a fonte e a data anotadas.
- **Evolução (timeline):** documentos aparecem como "avaliações" na data certa.
- **Relatórios (escola/terapeuta):** o Kolo reaproveita esses dados pra resumir.
- **Estratégias:** das "habilidades a desenvolver" do laudo, sugerir
  atividades/brincadeiras (fecha o ciclo).

## 5. Modelo de dados

Nova tabela `documentos_membro`:

| coluna | tipo | nota |
|---|---|---|
| id | uuid pk | |
| family_account_id | uuid fk → family_accounts (cascade) | |
| membro_atipico_id | uuid fk → membros_atipicos (cascade), nullable | laudo/escola = por criança; nullable p/ doc da família |
| tipo | text check (`laudo`,`terapeuta`,`escola`,`exame`,`outro`) | |
| fonte | text | "Dra. Fulana — Neuropediatra", "Escola X" |
| data_documento | date | data DO documento (extraída/confirmada) |
| arquivo_url | text null | no bucket privado; null se texto colado |
| arquivo_tipo | text check (`pdf`,`imagem`,`texto`) | |
| texto_extraido | text null | OCR/texto bruto (opcional, p/ busca) |
| resumo | jsonb | extração estruturada (abaixo) |
| status | text check (`processando`,`extraido`,`erro`) | |
| erro | text null | |
| created_at / updated_at | timestamptz | |

`resumo` (jsonb) — formato da extração:
```json
{
  "resumo_curto": "string",
  "diagnosticos": ["..."],
  "recomendacoes": ["..."],
  "habilidades_desenvolver": ["..."],
  "medicacoes": ["..."],
  "observacoes": ["..."],
  "kolo_vivo": [{ "camada": "camada1|camada2", "campo": "...", "texto": "..." }]
}
```

Migrações necessárias:
- `documentos_membro` + RLS `for all` self (família).
- bucket `documentos` (privado) + policies de escrita p/ service_role (mesmo fix
  do Storage) e leitura via signed URL.
- `sugestao_perfil_vivos.origem`: adicionar `'documento'` ao CHECK (hoje só
  `ayla|skill|app|diario_parser`).

## 6. Revisão antes de gravar (sensível + acurácia)

Mesmo padrão do "Atualizar" da conversa: a IA **propõe**, a usuária **confere**.
- Mostra: tipo, **fonte** e **data** (editáveis — a IA pode errar a data).
- Lista os fatos pro Kolo Vivo com checkboxes (camada/campo + texto).
- Mostra diagnósticos/recomendações/habilidades como leitura.
- Confirmar → grava os marcados (anexando à seção, com "(fonte, data)") + mantém
  o documento no repositório.

## 7. Privacidade / LGPD

Laudo é **dado de saúde sensível**. Portanto:
- Bucket **privado**, acesso só via **signed URL** com expiração; RLS por família.
- **Excluir documento** apaga a linha **e** o arquivo do bucket.
- Entra no **export de dados** (/api/me/exportar) e na **exclusão de conta**.
- **Consentimento** na primeira vez ("você está enviando um documento de saúde…").
- Considerar **retenção** (quanto tempo guardar) e deixar claro o uso (só pra
  apoiar a família; não compartilhado).

## 8. IA — extração

- Modelo: **Claude Sonnet** (visão; lê PDF e imagem). Texto colado: mesmo prompt
  sem anexo.
- Prompt: papel de "extrator clínico-administrativo": ler o documento e devolver
  o JSON do §5; **só fatos do documento**, nunca inventar; detectar data/fonte;
  classificar `kolo_vivo` nas seções reais (essencial/como_e/corpo_rotina/
  desafios_regulacao/sensorial; família: composicao/rotina/recursos/dinamica).
- **Dedup:** receber o Kolo Vivo atual no prompt e não repetir o que já existe
  (casa com o item 19 do backlog — dedup inteligente).
- Custo: 1 chamada de visão por documento (alguns centavos). Multipágina ok.
- Limite: **manuscrito**; qualidade de foto ruim degrada.

## 9. UI / UX

- Entrada principal no **Kolo Vivo** (botão "Anexar documento" por criança) e
  atalho no repositório. Talvez também na Evolução.
- Fluxo: anexar (§2) → "extraindo…" → tela de revisão (§6) → confirma → aparece
  no repositório + Kolo Vivo + timeline.
- Estado vazio do repositório: editorial ("os documentos da [nome] aparecem
  aqui — laudos, relatórios da escola, da terapia").

## 10. Faseamento

- **Fase A (MVP):** entrada (colar / foto / arrastar / buscar / PDF) → extração →
  revisão → grava no Kolo Vivo + repositório (lista por criança). Depende do
  Storage.
- **Fase B:** timeline de avaliações na Evolução (por `data_documento`).
- **Fase C:** sugestão de atividades a partir de `habilidades_desenvolver`
  (puxa Estratégias/output_types).
- **Fase D:** entrar automaticamente nos Relatórios pra escola/terapeuta.

## 11. Dependências e riscos

- **Bloqueador:** Storage (RLS 403) — pré-requisito pra qualquer upload.
- Sensibilidade LGPD (saúde) — tratar com cuidado (§7).
- OCR de manuscrito/foto ruim — comunicar limite.
- Alucinação na extração — mitigada pela revisão (§6).
- Custo de IA por documento — aceitável (baixa frequência).

## 12. Decisões em aberto

- Guardar sempre o arquivo original? (recomendo sim, com exclusão.)
- Texto colado: guardar como documento sem arquivo (recomendo sim).
- Aplicar direto vs sugestão pendente? (recomendo **revisão** sempre — sensível.)
- Documento pode ser "da família" (sem criança) ou sempre por criança?
- Limite de tamanho/quantidade por envio.
