# whisper-windows-mcp — Roadmap

Versão atual: **v2.2.0**

---

## Princípios de design

Estes princípios regem cada decisão neste projeto e têm prioridade sobre a velocidade de adição de funcionalidades.

**Minimizar o uso da API do Claude.** Todo o fluxo de trabalho de transcrição — varredura, análise, fila, execução, validação, troca de modelos — deve ser executável com o menor número possível de interações com o Claude. Esta ferramenta deve funcionar completamente para usuários do Claude no plano gratuito que não pagam por assinaturas Pro ou Max. Cada chamada de ferramenta consome orçamento de uso. Projete de acordo.

**Sempre uma única instância do whisper.** Nunca crie um segundo processo whisper-cli.exe enquanto um estiver em execução. O bloqueio de processo é obrigatório e inegociável.

**Local em primeiro lugar, privado por padrão.** O áudio nunca sai da máquina. Nenhuma API de nuvem é necessária para a funcionalidade principal. Integrações opcionais (ex.: downloads de modelos do Hugging Face) devem ser claramente documentadas como opcionais.

**Controle explícito do usuário.** Sem operações em massa silenciosas. Ações destrutivas ou irreversíveis exigem confirmação. O usuário deve sempre saber o que vai acontecer antes de acontecer.

**Caminhos seguros para Unicode.** Toda E/S de arquivo deve lidar corretamente com nomes de arquivo não-ASCII, incluindo português, japonês, chinês, emoji, colchetes e outros caracteres especiais.

**Modular e combinável.** As ferramentas são independentes. Os usuários usam o que precisam. Nenhuma funcionalidade deve exigir outra, a menos que seja inevitável.

**Otimização antes de funcionalidades.** Quando em dúvida entre adicionar uma funcionalidade e reduzir a carga do sistema ou o número de chamadas de API, reduza a carga. Sessões de otimização grandes são caras. Projete a arquitetura corretamente desde o início.

---

## Concluído

### ✅ v1.3.1 — Bloqueio de processo
Adicionada verificação `isWhisperRunning()` usando `tasklist /FI` antes de criar qualquer processo de transcrição. Retorna um erro claro com instruções do Gerenciador de Tarefas em vez de criar um processo concorrente.

### ✅ v1.4.0 — Aceleração GPU Vulkan
Compilado whisper.cpp a partir do código-fonte com `-DGGML_VULKAN=ON` usando VS Build Tools 2022 e Vulkan SDK. Binários Vulkan pré-compilados distribuídos como `whisper-vulkan-win-x64.zip`.

**Resultados no AMD Radeon RX Vega 56:** Utilização média de GPU ~16%. Arquivo de 58 minutos concluído em ~4,5 minutos na GPU vs. ~88 minutos apenas na CPU.

### ✅ v1.5.0 — Diagnóstico do sistema
Ferramenta `check_system`: detecção de GPU via `wmic`, verificação de DLL Vulkan, relatório de VRAM, recomendação de tamanho de modelo.

### ✅ v1.6.0 — Pré-análise de arquivo
Ferramenta `analyze_media` via FFprobe: duração, tamanho, codec, status de transcrição, estimativas de tempo de CPU e GPU. Varredura de arquivo único ou pasta com opções de ordenação.

### ✅ v1.7.0 — Transcrição em segundo plano + Visibilidade do progresso
Arquitetura de processo desanexado: `transcribe_audio` com `background=true` cria o whisper como um processo desanexado e retorna imediatamente um ID de tarefa. `check_progress` analisa os carimbos de tempo de segmento do stderr do whisper para porcentagem e ETA em tempo real.

### ✅ v1.8.0 — Lote sequencial com validação
`start_batch` e `check_batch_progress`: processamento sequencial automático, validação de transcrição (detecção de saída vazia/curta), avanço automático da fila, carimbos de tempo de progresso por arquivo.

### ✅ v1.9.0 — Suporte multilíngue e tradução
`generate_subtitles` com detecção `language=auto` e saída SRT dupla `translate_to_english=true`. Adicionado suporte para formatos `.3gp` e `.ts`. `language=auto` também disponível em `transcribe_audio`.

**Limitação conhecida:** A tradução integrada do Whisper é direcionada apenas ao inglês. Requer modelo `large-v3` para idiomas que não sejam inglês — modelos somente inglês (`*.en.bin`) geram `[FOREIGN]` em áudio que não seja inglês.

### ✅ v2.0.0 — Caminhos seguros para Unicode + SRT em segundo plano
**Nomes de arquivo Unicode:** Arquivos com caracteres não-ASCII nos nomes causavam falha silenciosa na transcrição em segundo plano. Corrigido roteando toda a saída por um caminho temporário sanitizado baseado em ID de tarefa, depois movendo o resultado para o destino correto após a conclusão.

**SRT no modo em segundo plano:** `spawnDetached` anteriormente codificava rigidamente `-otxt` independentemente do formato solicitado, e `generate_subtitles` bloqueava de forma síncrona e atingia o timeout MCP de 4 minutos em arquivos mais longos. Corrigido adicionando parâmetro `outputFormat` ao `spawnDetached`, suportando saída `text` e `srt` no modo em segundo plano.

### ✅ v2.0.1 — Correções de bugs (incluído no v2.2.0)
- `--max-context 0` fixo em `buildArgs` e `spawnDetached` — previne loops de alucinação em áudio longo. `--condition-on-previous-text` e `--no-context` não são flags válidos no binário atual (era v1.8.3) — `--max-context N` é o flag correto.
- `--no-speech-thold 0.6` fixo em ambas as funções — segmentos abaixo do limiar de confiança são tratados como silêncio em vez de conteúdo alucinado.
- Validação de caminho (`validateInputPath`) — rejeita caminhos UNC e travessias `..`.
- Proteção de tamanho de arquivo `MAX_FILE_SIZE_MB = 10240`.
- Comentário de segurança de injeção de transcrição em `transcribeSingle`.
- Comando CLI de lote corrigido no TROUBLESHOOTING.md — documentado o método correto de pré-conversão do FFmpeg e o método `Start-Process -RedirectStandardOutput`.

### ✅ v2.1.0 — Suite de gerenciamento de modelos (incluído no v2.2.0)
- `WHISPER_MODEL` alterado de `const` para `let` (mutável dentro da sessão).
- `MODEL_REGISTRY` — 16 modelos, variantes de precisão total e quantizadas, URLs de download do Hugging Face.
- `ALLOWED_HF_PREFIXES` — lista de permissões de URL que limita downloads aos namespaces `ggerganov/whisper.cpp` e `ggml-org`.
- Ferramenta `list_models` — varre o diretório de modelos, mostra o modelo ativo, tamanhos, casos de uso, downloads disponíveis.
- Ferramenta `download_model` — baixa do Hugging Face via `https` integrado do Node.js, renomeação atômica (corrige condição de corrida de liberação de handle de arquivo do Windows).
- Ferramenta `switch_model` — valida extensão `.bin`, restrição de diretório, verificação de bloqueio de processo.
- `recommendedModel()` atualizado para recomendar `large-v3-turbo` para VRAM de 6GB+.

### ✅ v2.2.0 — Expansão de qualidade, parâmetros e hardware (atual)
- Interface `WhisperOptions` substituindo argumentos posicionais em `buildArgs`.
- Novos parâmetros em `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Novos parâmetros em `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` refatorado — todos os flags de qualidade agora são aplicados no modo em segundo plano/lote.
- `runSrtPass` atualizado para aceitar `extraOpts`.
- Saída de lote corrigida — `readBatchProgress` agora move a saída temporária para o destino final antes de validar (esta era a causa raiz de todos os resultados de lote "com falha").

**Nota de compatibilidade de flags:** `gpu_device` / `-g` foi adicionado no whisper.cpp v1.8.4. O binário Vulkan pré-compilado nos releases é da era v1.8.3 — este parâmetro é aceito pela ferramenta mas não terá efeito até que os usuários atualizem para binários v1.8.4+.

**Flags válidos confirmados no binário atual (era v1.8.3):**
`--max-context`, `--no-speech-thold`, `--processors`, `--offset-t`, `--duration`, `--best-of`, `--beam-size`, `--diarize`, `--tinydiarize`, `--temperature`, `--prompt`, flags VAD.

**Ausentes no binário atual:** `--no-context` (use `--max-context 0`), `--condition-on-previous-text` (apenas nome da API Python), `--gpu-device` / `-g` (v1.8.4+).

---

## Bug crítico — Avanço automático do lote (confirmado, aguardando correção)

### Lote não avança sem polling ativo

`start_batch` não avança a fila autonomamente entre os arquivos. O lote só avança quando `check_batch_progress` é chamado. Sem polling, o lote fica parado indefinidamente após cada arquivo — o whisper-cli.exe sai, nenhum novo processo é criado e a fila não avança.

Isso destrói o objetivo de design central de processamento em lote autônomo durante a noite e viola diretamente o princípio de design de minimizar chamadas à API do Claude. Um lote de 95 clipes curtos exigiu cerca de 200 chamadas de polling ao longo de 100 minutos para ser concluído.

**Causa raiz:** `readBatchProgress` contém toda a lógica de avanço de fila. Ele só é executado quando `check_batch_progress` é chamado explicitamente. Não há timer em segundo plano, observador de arquivo ou loop autônomo.

**Correção planejada — Opção B (callback de saída, fortemente preferido):** Attach de um handler `on('exit')` ao processo filho whisper-cli criado. Quando o processo sair, imediatamente chamar a lógica de avanço para validar a saída e criar a próxima tarefa. Baseado em eventos, disparado exatamente uma vez por conclusão de arquivo, sem overhead de polling, sem chamadas de API consumidas.

**Opção A (somente fallback):** `setInterval` em segundo plano com intervalo de polling baseado em duração derivado dos dados de duração do FFprobe já presentes no JSON de estado do lote. O tamanho do arquivo não é um substituto confiável para a duração.

**Restrição adicional:** A correção não deve criar um segundo whisper-cli.exe quando um já está em execução — o bloqueio de processo deve ser respeitado no caminho de avanço automático.

**Solução alternativa (atual):** Chame `check_batch_progress` repetidamente até que o lote seja concluído. Cerca de um polling por arquivo é necessário.

---

## Planejado — Arquitetura de Privacidade (antes da migração para o Bun)

Essas mudanças devem ser lançadas antes da migração para o Bun e antes de quaisquer mudanças de licença que facilitem a adoção comercial ou empresarial. Lançar uma ferramenta de nível empresarial sem proteções de conformidade resolvidas cria responsabilidade para usuários em setores regulamentados.

### Variável de ambiente `WHISPER_PRIVACY_MODE`
A ferramenta atualmente garante que nenhum **áudio** sai da máquina. Ela não estende essa garantia ao **texto de transcrição** — quando o conteúdo de transcrição é retornado inline em uma resposta de ferramenta, esse texto é processado pela API do Claude e sai do ambiente local.

Essa lacuna é invisível para usuários que razoavelmente interpretam "nenhum dado sai da sua máquina" como cobrindo todo o conteúdo derivado do seu áudio.

Adicionar `WHISPER_PRIVACY_MODE` como variável de ambiente em `claude_desktop_config.json`. Quando ativado:
- Todas as respostas das ferramentas retornam apenas metadados: nome do arquivo, duração, contagem de palavras, status de conclusão
- Nenhum texto de transcrição é incluído em qualquer resposta de ferramenta
- O Claude não pode ler, analisar ou retransmitir conteúdo de transcrição de nenhuma forma
- As transcrições existem apenas como arquivos `.txt` locais

Esta é a configuração correta para implantações médicas, jurídicas, financeiras e corporativas. Zero chamadas de API, zero transmissão de dados, zero risco de conformidade.

### Gateway de consentimento para conteúdo de transcrição
Quando `WHISPER_PRIVACY_MODE` não está ativado (padrão), qualquer resposta de ferramenta que inclua texto de transcrição deve ser precedida de uma divulgação no primeiro uso por sessão. A divulgação deve comunicar claramente que o texto de transcrição é enviado à API da Anthropic, que isso está fora da garantia "nenhum dado sai da sua máquina", e que usuários que lidam com conteúdo regulamentado devem verificar suas obrigações de conformidade antes de prosseguir.

Implementação: variável de ambiente `WHISPER_CONSENT_ACKNOWLEDGED` com padrão `false`. No primeiro retorno de transcrição por sessão, se não reconhecido, o Claude apresenta a divulgação e solicita confirmação explícita. Uma vez reconhecido para a sessão, as transcrições subsequentes são retornadas sem solicitar novamente.

### Documentação `PRIVACY.md`
Criar `PRIVACY.md` na raiz do repositório cobrindo:
- Quais dados sempre ficam locais: arquivos de áudio, vídeo, modelos
- Quais dados podem sair do local (por padrão): texto de transcrição em respostas de ferramentas
- Quais dados nunca saem do local (com modo de privacidade): tudo
- Orientação de framework de conformidade por setor (HIPAA, GDPR, privilégio advogado-cliente, FERPA, SOX, PCI-DSS, NDA/segredo comercial)
- Como configurar o modo de privacidade
- Isenção de responsabilidade de que os autores da ferramenta não são consultores jurídicos

### Avisos de privacidade no esquema de ferramentas
Atualizar as descrições de ferramentas `ListToolsRequestSchema` para incluir uma nota de privacidade em qualquer ferramenta que retorne texto de transcrição. Isso aparece nas descrições de ferramentas do Claude Desktop e cria consciência no ponto de uso.

### Limpeza automática do diretório temporário
`%TEMP%\whisper-mcp-jobs\` acumula arquivos de estado de tarefas e logs ao longo do tempo. Adicionar limpeza automática de arquivos de tarefas concluídas após uma janela de retenção configurável (padrão: 7 dias). Atualmente requer `Remove-Item` manual pelo usuário.

---

## Planejado — Migração para o Bun

Migrar o runtime do Node.js para o [Bun](https://bun.sh) após a conclusão da arquitetura de privacidade e antes das adições de funcionalidades do v2.3.0.

Como o Claude Desktop cria um novo servidor MCP a cada início de sessão, o tempo de inicialização está no caminho crítico. O Bun executa TypeScript nativamente sem etapa de compilação, inicia significativamente mais rápido que o Node e tem E/S mais rápida.

**O que muda:**
- Eliminação da etapa de build `tsc` e do diretório `dist/`
- Os usuários executam o código TypeScript fonte diretamente
- `tsconfig.json` torna-se opcional
- Scripts `package.json` atualizados
- Fluxo de trabalho de publicação no npm atualizado

**O que não muda:**
- Código-fonte `src/index.ts` — o Bun é compatível com o TypeScript existente e as APIs integradas do Node.js
- Todos os comportamentos de ferramentas e formatos de saída
- Configuração do Claude Desktop para usuários finais

**Por que após a privacidade, antes do v2.3.0:** O código-fonte está em seu estado mais fácil de migrar agora. Migrar após adicionar mais ferramentas apenas aumenta a área de superfície sem benefício. A arquitetura de privacidade deve ser lançada primeiro conforme observado acima.

---

## Planejado — Revisão de licença (após a migração para o Bun)

A licença MIT atual permite uso comercial irrestrito. Antes que a ferramenta alcance mercados profissionais e empresariais em escala, a situação de licenciamento deve ser avaliada.

**Abordagem planejada — Licença dupla:**
- MIT para uso pessoal e não comercial (sem mudanças para usuários existentes)
- Licença comercial separada para uso empresarial e corporativo
- Ponto de transição: próximo release de versão principal após a migração para o Bun

**Por que não agora:** Mudar a licença antes que a arquitetura de privacidade seja concluída significaria vender licenças comerciais para uma ferramenta com lacunas de conformidade HIPAA/GDPR não resolvidas. A privacidade é lançada primeiro. A revisão de licença segue.

A licença comercial, os avisos de privacidade no esquema de ferramentas e o `PRIVACY.md` juntos formam a história mínima viável de conformidade para compradores empresariais.

---

## Planejado — v2.3.0: Expansão de formatos de saída

### Formato de legenda VTT
Saída WebVTT (`.vtt`) junto com SRT. VTT é o padrão web usado pelo YouTube, HTML5 `<video>` e a maioria dos players modernos. O whisper-cli o suporta nativamente. Adicionar `vtt` como formato de saída válido em `transcribe_audio`, `generate_subtitles` e `spawnDetached`. Atualizar `buildArgs` e todos os esquemas de ferramentas relevantes, README e documentação multilíngue.

### Formato LRC
Saída no formato LRC (`.lrc`) de letras/karaokê via `-olrc`. Usado por players de mídia para exibição sincronizada de letras. Custo de implementação zero — flag CLI nativo.

### Formato CSV
Saída CSV (`.csv`) via `-ocsv`. Dados tabulares estruturados com timing de segmentos — útil para análise downstream, fluxos de trabalho de alinhamento de clipes e importação em ferramentas de planilha. Custo de implementação zero — flag CLI nativo.

---

## Planejado — Releases futuros

### TinyDiarize
Suporte ao flag `--tinydiarize` com variantes de modelo que suportam `tdrz` (ex.: `large-v2-tdrz`). Ao contrário do flag `--diarize` estéreo, o TinyDiarize funciona em gravações mono. Requer download de variante de modelo especial. Precisão menor que a diarização baseada em pyannote, mas sem dependências adicionais além do arquivo de modelo.

**Status:** Planejado. Depende do `download_model` suportar variantes de modelo tdrz.

### Transcrição de URL do YouTube
Transcrição direta de URLs do YouTube via yt-dlp. Baixa áudio e transcreve em uma única etapa. Requer yt-dlp instalado e no PATH.

**Restrições de design:** yt-dlp é opcional. A ferramenta deve degradar graciosamente com instruções claras de instalação se não encontrado. Sem mudanças na funcionalidade principal para usuários que não precisam disso.

### Ferramentas de fluxo de trabalho de projeto de vídeo
Para usuários que gerenciam grandes projetos de edição de vídeo com diretórios de clipes fonte e editados:

1. Varrer diretório fonte e subdiretórios de clipes
2. Fazer correspondência fuzzy de transcrições de clipes editados com transcrições fonte para encontrar pontos de origem
3. Exibir nomes de arquivo descritivos sugeridos pelo Claude com base no conteúdo de transcrição, exigindo confirmação explícita do usuário antes de executar qualquer renomeação
4. Pesquisa de transcrição em todo o diretório do projeto com resultados de timecode

**Restrições de design:**
- Arquivos fonte **nunca são renomeados ou modificados**
- Todas as renomeações exigem **confirmação explícita do usuário**
- A pesquisa é uma ferramenta autônoma utilizável de forma independente
- A análise e correspondência acontecem localmente — o Claude é chamado apenas quando o usuário revisa os resultados, minimizando chamadas de API

**Status:** Fase de design.

### Diarização de falantes (pyannote-audio)
Diarização de falantes mono completa com rótulos de ID de falante — marca transições de falantes em toda a gravação independentemente da configuração de canal. Diferente do flag `--diarize` estéreo integrado (v2.2.0) e do TinyDiarize.

**Implementação:** Requer [pyannote-audio](https://github.com/pyannote/pyannote-audio) — biblioteca baseada em Python com requisito de token de acesso a modelos do Hugging Face. Pilha de dependências completamente separada do pipeline whisper.cpp.

**Status:** Funcionalidade avançada opcional com sua própria documentação de configuração. Não incluída no pacote principal.

### Tradução para idiomas que não sejam inglês
O flag `--translate` do Whisper é direcionado apenas ao inglês. Suportar idiomas de destino arbitrários requer uma API de tradução externa ou modelo de tradução local.

**Opções em consideração:** LibreTranslate (pode ser auto-hospedado, local em primeiro lugar), tradução via LLM local ou documentação explícita de fora do escopo.

**Status:** Adiado aguardando decisão de design sobre local em primeiro lugar vs. dependência de API.

### Limpeza e formatação de transcrições
Pipeline de pós-processamento:
- Remoção de palavras de preenchimento e falsos começos (opcional, controlado pelo usuário)
- Quebras de parágrafo em limites de tópicos naturais
- Formatação com consciência de falante combinada com saída de diarização
- Exportação para PDF ou DOCX

**Status:** Planejado. A variante com consciência de falante depende da diarização.

---

## Distribuição

Disponível no [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org) e [Glama](https://glama.ai).

---

## Documentação multilíngue

A documentação em japonês, coreano, vietnamita, indonésio, ucraniano, português brasileiro e espanhol é mantida em paralelo com o inglês. Os seguintes arquivos devem ser atualizados para corresponder aos documentos em inglês após cada release:

**Japonês (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Coreano (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Vietnamita (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Indonésio (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Ucraniano (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Português Brasileiro (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Espanhol (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

Contribuições da comunidade para outros idiomas são bem-vindas.

---

## Contribuições

Pull requests são bem-vindos. Verifique as issues existentes antes de começar a trabalhar.

Se você testou a aceleração por GPU em hardware não listado acima, abra uma issue com o modelo da GPU, VRAM, tamanho do modelo e throughput observado. Isso ajuda a construir uma referência de desempenho precisa para outros usuários.
