# whisper-windows-mcp — Roadmap

Versão atual: **v2.4.0**

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

**SRT no modo em segundo plano:** `spawnDetached` anteriormente codificava rigidamente `-otxt` independentemente do formato solicitado. Corrigido adicionando parâmetro `outputFormat` ao `spawnDetached`, suportando saída `text` e `srt` no modo em segundo plano.

### ✅ v2.0.1 — Correções de bugs (incluído no v2.2.0)
- `--max-context 0` fixo em `buildArgs` e `spawnDetached` — previne loops de alucinação em áudio longo.
- `--no-speech-thold 0.6` fixo em ambas as funções — segmentos abaixo do limiar de confiança são tratados como silêncio em vez de conteúdo alucinado.
- Validação de caminho (`validateInputPath`) — rejeita caminhos UNC e travessias `..`.
- Proteção de tamanho de arquivo `MAX_FILE_SIZE_MB = 10240`.
- Comentário de segurança de injeção de transcrição em `transcribeSingle`.
- Comando CLI de lote corrigido no TROUBLESHOOTING.md.

### ✅ v2.1.0 — Suite de gerenciamento de modelos (incluído no v2.2.0)
- `WHISPER_MODEL` alterado de `const` para `let` (mutável dentro da sessão).
- `MODEL_REGISTRY` — 16 modelos, variantes de precisão total e quantizadas, URLs de download do Hugging Face.
- `ALLOWED_HF_PREFIXES` — lista de permissões de URL que limita downloads aos namespaces `ggerganov/whisper.cpp` e `ggml-org`.
- Ferramenta `list_models` — varre o diretório de modelos, mostra o modelo ativo, tamanhos, casos de uso, downloads disponíveis.
- Ferramenta `download_model` — baixa do Hugging Face via `https` integrado do Node.js, renomeação atômica.
- Ferramenta `switch_model` — valida extensão `.bin`, restrição de diretório, verificação de bloqueio de processo.
- `recommendedModel()` atualizado para recomendar `large-v3-turbo` para VRAM de 6GB+.

### ✅ v2.2.0 — Expansão de qualidade, parâmetros e hardware
- Interface `WhisperOptions` substituindo argumentos posicionais em `buildArgs`.
- Novos parâmetros em `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Novos parâmetros em `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` refatorado — todos os flags de qualidade agora são aplicados no modo em segundo plano/lote.
- Saída de lote corrigida — `readBatchProgress` agora move a saída temporária para o destino final antes de validar.

**Nota de compatibilidade de flags:** `gpu_device` / `--device` foi adicionado no whisper.cpp v1.8.4. Os binários Vulkan pré-compilados nos releases são da era v1.8.3 — este parâmetro é aceito pela ferramenta mas não terá efeito até que os usuários atualizem para binários v1.8.4+.

### ✅ v2.2.2 — Patch
- Correção de licença dual — revisão de LICENSE e LICENSE-COMMERCIAL.md.
- Correções menores de documentação.

### ✅ v2.3.0 — Avanço automático de lote, arquitetura de privacidade, expansão de formatos de saída

**Avanço automático de lote (correção de bug crítico):** `start_batch` antes exigia polling ativo para avançar a fila. Agora cada processo filho whisper-cli criado tem um handler `on('exit')` anexado. Quando o processo termina, o lote avança imediatamente de forma autônoma através do callback de saída — sem custo de polling nem chamadas de API. Um mutex previne a criação dupla entre o handler de saída e chamadas simultâneas a `check_batch_progress`.

**Arquitetura de privacidade:**
- Variável de ambiente `WHISPER_PRIVACY_MODE` — quando definida como `true`, todas as respostas das ferramentas retornam apenas metadados (nome do arquivo, contagem de palavras, caminho de salvamento). Nenhum texto de transcrição é enviado à API do Claude. As transcrições existem apenas como arquivos locais.
- Variável de ambiente `WHISPER_CONSENT_ACKNOWLEDGED` — quando definida como `true`, suprime a porta de consentimento única por sessão para conteúdo não sensível.
- Parâmetro `privacy_mode` por chamada em `transcribe_audio`, `transcribe_batch`, `start_batch`, `check_progress`. Substitui a variável de ambiente global em ambas as direções. Não requer reinicialização para ativar/desativar.
- Porta do modo de privacidade (`checkPrivacyGate()`) — executada antes de cada operação quando o modo de privacidade efetivo está ativo. Primeira chamada ativa (exibe divulgação), segunda chamada libera (permite). Reinicia após cada operação. Completamente independente da porta de consentimento de sessão.
- Porta de consentimento de sessão (`transcriptPolicy()`) — executada uma vez por sessão antes da primeira chamada que retorne transcrição no modo padrão. Consumida pelo flag `sessionConsentGiven`.
- `PRIVACY.md` — documentação de conformidade completa cobrindo HIPAA, GDPR, privilégio advogado-cliente, FERPA, SOX, PCI-DSS, NDA/segredo comercial.
- Avisos de privacidade nas descrições de ferramentas de todas as ferramentas que retornam texto de transcrição.

**Expansão de formatos de saída:**
- `vtt` — saída de legenda WebVTT via `-ovtt`. Disponível em `transcribe_audio`, `generate_subtitles`, `start_batch` e modo em segundo plano.
- `lrc` — formato de letras/karaokê LRC via `-olrc`. Disponível em `transcribe_audio` e modo em segundo plano.
- `csv` — CSV com carimbos de tempo via `-ocsv`. Disponível em `transcribe_audio` e modo em segundo plano.
- O valor padrão de `output_format` muda de `"text"` para `"timestamps"` em todas as ferramentas e caminhos de código. Texto simples agora é opcional.

**Correções de bugs:**
- Bug 1: `output_format` não era passado para tarefas em segundo plano — `"text"` padrão era usado independentemente do formato solicitado. Corrigido mudando o padrão para `"timestamps"` e passando corretamente.
- Bug 2: `catch {}` silencioso na operação de movimentação de saída de tarefa em segundo plano engolia falhas. Adicionada verificação `existsSync` explícita após a movimentação com mensagem de falha detalhada.
- Bug 3: Adicionado comentário de design no ponto de criação em segundo plano explicando por que a porta de consentimento é adiada intencionalmente para `check_progress` para tarefas em segundo plano não privadas.

**Adições:**
- Limpeza automática do diretório temporário — `cleanupOldJobFiles()` é executado na inicialização e exclui arquivos `.json` e `.log` com mais de 7 dias em `%TEMP%\whisper-mcp-jobs\`.
- `check_config` agora reporta o status do modo de privacidade.
- O log de inicialização reporta modo de privacidade ativado/desativado.
- Campo `privacyMode: boolean` adicionado à interface `Job`.
- Campo `privacyMode: boolean` adicionado à interface `BatchState`.
- O tipo `BackgroundFormat` exclui `json` (json no modo em segundo plano não é suportado — cai de volta para `text`).

### ✅ v2.4.0 — Fortalecimento, guarda de tempo limite em primeiro plano, suíte de testes e CI

Uma passagem de segurança/robustez; a migração para Bun planejada foi movida para v2.5.0.

**Segurança e correção:**
- Correção de contenção de caminho em `switch_model` — um diretório com prefixo-irmão (p. ex. `…\models-evil`) podia antes satisfazer a verificação de "dentro do diretório de modelos" por meio de um `startsWith` ingênuo; substituído por contenção normalizada baseada em `relative()`. Fecha a fuga que o SECURITY.md descreve.
- Barreira de privacidade/consentimento chaveada **por operação** (ferramenta + argumentos) — confirmar uma transcrição não pode mais satisfazer a barreira de uma operação diferente.
- `download_model` rejeita downloads truncados (verificação de Content-Length) antes de promover um arquivo `.part`. (A verificação completa do digest SHA256 fica para uma passagem posterior.)
- Coerção de entrada — parâmetros numéricos de ferramentas que não são números reais são descartados em vez de entregues ao whisper-cli como `NaN`.

**Robustez:**
- **Guarda de tempo limite em primeiro plano** — um arquivo longo o suficiente para exceder o tempo limite de ferramenta MCP de ~4 minutos do Claude Desktop em modo de bloqueio é detectado de antemão e roteado para segundo plano em vez de esgotar o tempo silenciosamente. Limite configurável via `WHISPER_FOREGROUND_MAX_SEC`. Estimativas de tempo corrigidas (a antiga estimativa de GPU subestimava muito; o custo dominante de recarga do modelo agora é modelado — medido, não adivinhado).
- Gravações atômicas do estado de trabalhos/lotes (arquivo temporário + renomeação) para que um leitor concorrente não possa observar um arquivo JSON parcialmente escrito.
- IDs de trabalho/lote/temporários à prova de colisão (com sufixo UUID).
- Encerramento gracioso em SIGINT/SIGTERM que limpa os arquivos temporários do modo de bloqueio.

**Seleção de dispositivo GPU:**
- Variável de ambiente `WHISPER_GPU_DEVICE`, e `gpu_device` agora propagado por `generate_subtitles` e pela passagem de detecção de idioma (antes apenas `transcribe_audio`). `check_config` reporta o dispositivo ativo. `check_system` não reporta mais erroneamente um problema de driver quando o `wmic` (descontinuado no Windows 11 24H2+) não retorna nada.

**Qualidade:**
- Uma suíte de testes unitários `node:test` sobre a lógica pura (contenção de caminho, chaveamento da barreira, gravações atômicas, coerção de entrada, a estimativa de tempo limite), zero dependências adicionadas, além de um fluxo de trabalho de CI do GitHub Actions executando-a a cada push/PR.

**Identificado para um lançamento futuro:** um caminho de modelo persistente (p. ex. o `whisper-server` do whisper.cpp) para eliminar o custo de recarga do modelo pago em cada transcrição — um grande ganho de throughput para trabalho em lote/de arquivo.

---

## Planejado — v2.5.0: Migração para Bun

Migrar o runtime de Node.js para o [Bun](https://bun.sh).

O Claude Desktop cria um novo servidor MCP a cada início de sessão, portanto o tempo de inicialização está no caminho crítico. O Bun executa TypeScript nativamente sem etapa de compilação, inicia significativamente mais rápido que o Node e tem E/S mais rápida.

**O que muda:**
- Etapa de compilação `tsc` e diretório `dist/` removidos
- Os usuários executam o código-fonte TypeScript diretamente
- `tsconfig.json` torna-se opcional
- Scripts do `package.json` atualizados
- Fluxo de publicação no npm atualizado

**O que não muda:**
- Código-fonte `src/index.ts` — o Bun é compatível com o TypeScript existente e as APIs integradas do Node.js
- Todos os comportamentos de ferramentas e formatos de saída
- Configuração do Claude Desktop para usuários finais

---

## Planejado — v2.6.0: Formatos de saída aprimorados para integração com ferramentas externas

Suporte expandido de formatos de saída voltado para fluxos de trabalho de análise e integração downstream. O escopo exato será definido com base no feedback dos usuários após o v2.3.0.

---

## Planejado — v2.7.0: Modo de transcrição de microfone ao vivo

Transcrição em tempo real a partir de entrada de microfone ao vivo. Transmite áudio em fragmentos do dispositivo de gravação selecionado para o whisper, retornando segmentos de transcrição concluídos de forma contínua.

**Restrições de design:**
- A seleção do dispositivo deve ser explícita — sem captura silenciosa do microfone padrão
- O usuário deve poder parar o stream através da interação com o Claude Desktop
- Não deve violar a restrição de uma única instância do whisper por vez
- O trade-off entre latência e precisão deve ser configurável pelo usuário

**Status:** Fase de design. Depende de uma API de streaming estável do whisper.cpp.

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

**Implementação:** Requer [pyannote-audio](https://github.com/pyannote/pyannote-audio) — biblioteca baseada em Python com requisito de token de acesso a modelos do Hugging Face. Pilha de dependências completamente separada.

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

## Licenciamento

O whisper-windows-mcp usa licença dupla.

**Uso não comercial:** MIT — gratuito para uso pessoal, educacional e não comercial. Veja [LICENSE](LICENSE).

**Uso comercial:** É necessário um contrato de licença comercial separado para qualquer uso empresarial, profissional ou que gere receita. Veja [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

---

## Distribuição

Disponível no [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), [Glama](https://glama.ai) e [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) (PR enviado).

---

## Documentação multilíngue

Os seguintes arquivos devem ser atualizados para corresponder aos documentos em inglês após cada release:

**Japonês (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Coreano (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Vietnamita (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Indonésio (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Ucraniano (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Português Brasileiro (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Espanhol (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

**Polonês (`*.pl.md`)** — `README.pl.md` / `TROUBLESHOOTING.pl.md` / `ROADMAP.pl.md` / `PRIVACY.pl.md` / `SECURITY.pl.md`

**Romeno (`*.ro.md`)** — `README.ro.md` / `TROUBLESHOOTING.ro.md` / `ROADMAP.ro.md` / `PRIVACY.ro.md` / `SECURITY.ro.md`

Contribuições da comunidade para outros idiomas são bem-vindas.

---

## Contribuições

Pull requests são bem-vindos. Verifique as issues existentes antes de começar a trabalhar.

Se você testou a aceleração por GPU em hardware não listado acima, abra uma issue com o modelo da GPU, VRAM, tamanho do modelo e throughput observado. Isso ajuda a construir uma referência de desempenho precisa para outros usuários.
