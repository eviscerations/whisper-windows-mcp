# whisper-windows-mcp — Roadmap

Versão atual: **v2.5.0**

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

## Planejado — v2.5.0: Servidor de modelo persistente

Manter o modelo Whisper residente entre transcrições em vez de recarregá-lo a cada invocação.

Este é o maior ganho de throughput disponível. O whisper-cli é de uma passagem: ele recarrega o modelo completo a cada chamada, e o v2.4.0 mediu essa recarga em ~110s em uma GPU com memória limitada — um imposto fixo pago por arquivo, independentemente da duração do áudio. Para cargas de trabalho de lote e arquivo, isso domina o tempo total mais do que a própria transcrição.

**Abordagem:** executar o `whisper-server` (HTTP) que acompanha o whisper.cpp como um único processo de longa duração com o modelo mantido em memória. O servidor MCP envia cada transcrição a ele por localhost e recebe os resultados de volta sem pagar novamente o custo de recarga.

**Reconciliação com "sempre uma única instância do whisper":** o princípio é preservado, o mecanismo evolui. O servidor residente *se torna* a instância única; o bloqueio de processo muda de "nunca criar um segundo whisper-cli" para "serializar requisições contra o único servidor residente". Nenhuma concorrência é introduzida.

**Restrições de design:**
- Ciclo de vida explícito: start / stop / status, com verificação de saúde. O servidor nunca é iniciado silenciosamente como efeito colateral de uma chamada não relacionada.
- Vincular apenas a localhost — nunca a uma interface roteável. Sem exposição na rede (consistente com o princípio local em primeiro lugar e o fortalecimento do v2.4.0).
- Fallback gracioso: se o servidor não estiver em execução, a transcrição ainda funciona pelo caminho existente do whisper-cli de uma passagem. O servidor é uma otimização, não uma dependência obrigatória.
- `switch_model` recarrega o modelo no servidor residente (ainda muito mais barato de forma amortizada do que recarregar por arquivo).
- As barreiras de privacidade e consentimento permanecem inalteradas — elas ficam acima do mecanismo de transcrição.
- Seleção de porta com tratamento de colisão; encerramento limpo em SIGINT/SIGTERM junto com a limpeza de arquivos temporários existente.

**Status — Fase 1 ✅ implementada (aguardando release):** ferramenta `whisper_server` (`start` / `stop` / `status`); `transcribe_audio` e `transcribe_batch` em modo de bloqueio passam pelo servidor residente por localhost (`127.0.0.1`, verificado contra a API HTTP atual do `whisper-server` do whisper.cpp); `switch_model` troca o modelo residente em tempo real via `POST /load` sem reinicialização; a guarda de tempo limite em primeiro plano é ignorada no modo servidor (não há recarga a pagar); `check_config` reporta o estado do servidor; o servidor próprio é encerrado no desligamento para liberar a VRAM. A regra de um único motor / VRAM compartilhada é aplicada com uma barreira rígida no caminho de criação de processo desanexado, além de recusas amigáveis: enquanto o servidor está ativo, tarefas em segundo plano, `start_batch`, `generate_subtitles`, saída `lrc`/`csv` e opções por requisição que a API HTTP não respeita (`beam_size`, `best_of`, `word_timestamps`, `diarize`, `tinydiarize`, `vad_model`, `offset_t`, `duration` etc.) são recusadas com uma mensagem "pare o servidor primeiro" em vez de degradar silenciosamente. Configuração: `WHISPER_SERVER_PATH`, `WHISPER_SERVER_PORT` (padrão 8571, apenas localhost).

**Status — Fase 2 (planejada):** rotear tarefas em segundo plano/`start_batch` pelo servidor residente. Este é o maior ganho de arquivo/throughput e requer a reformulação da camada de tarefas/fila em torno de requisições HTTP em vez de PIDs desanexados (progresso sem PID, cancelamento). Reavaliar após a Fase 1 ser lançada.

---

## Planejado — v2.6.0: TinyDiarize (turnos de fala em mono, zero dependências extras)

Suporte a `--tinydiarize` com variantes de modelo habilitadas para `tdrz` (ex.: `ggml-small.en-tdrz.bin`). Ao contrário do flag `--diarize` estéreo (v2.2.0), o TinyDiarize marca turnos de fala em gravações **mono** e não precisa de nada além do arquivo de modelo — sem Python, sem serviço externo.

**Escopo:**
- Adicionar a(s) variante(s) de modelo `tdrz` ao `MODEL_REGISTRY` para que `download_model` possa buscá-las nos namespaces confiáveis existentes do Hugging Face.
- Encaminhar uma opção `tinydiarize` por `buildArgs` e `spawnDetached` para que funcione nos modos de bloqueio, segundo plano e lote.

**Status:** ✅ Implementado (aguardando release) — parâmetro `tinydiarize` em `transcribe_audio` e `generate_subtitles` (funciona nos modos de bloqueio e segundo plano), `--tinydiarize` encaminhado por ambos os construtores de argumentos e `small.en-tdrz` adicionado ao `MODEL_REGISTRY` para `download_model`. Fiel ao ethos: local em primeiro lugar, zero dependências extras.

---

## Planejado — v2.7.0: Pesquisa de transcrição em todo o projeto

Uma ferramenta autônoma para pesquisar uma frase ou padrão em cada transcrição de um diretório de projeto e retornar as correspondências com seu arquivo de origem e timecode. Decomposta do fluxo de trabalho maior de projeto de vídeo (veja "Mais tarde / Em consideração") — esta metade é independentemente útil, de baixo risco e leve em API: a pesquisa é executada localmente, e o Claude só é envolvido quando o usuário revisa os resultados.

**Status:** Planejado.

---

## Planejado — v2.8.0: Formatos de saída aprimorados e integração

Saída expandida para fluxos de trabalho de análise e integração downstream. Uma lacuna concreta a fechar: a saída JSON atualmente não é suportada no modo em segundo plano (cai de volta para texto). JSON em nível de palavra para alinhamento de clipes e outros formatos de integração a serem definidos com base no feedback dos usuários.

---

## Mais tarde / Em consideração

Não agendado, mas fiel ao ethos e revisitado conforme a capacidade permitir.

### Migração para Bun
Migrar o runtime de Node.js para o [Bun](https://bun.sh) para reduzir o tempo de inicialização a frio do servidor MCP e eliminar a etapa de compilação `tsc` (o código-fonte é executado diretamente). Rebaixado de seu antigo espaço na v2.5.0: sendo o custo de recarga do modelo por invocação o verdadeiro gargalo (veja v2.5.0 acima), reduzir a inicialização do Node é um ganho marginal, e a maturidade do Bun no Windows mais uma mudança no modelo de distribuição trazem risco. Vale a pena fazer eventualmente como otimização opcional, não como prioridade.

### Fluxo de trabalho de renomeação e correspondência de projeto de vídeo
A metade mais pesada das ferramentas de projeto, uma vez que a Pesquisa de transcrição em todo o projeto (v2.7.0) for lançada: fazer correspondência fuzzy de transcrições de clipes editados com transcrições fonte para encontrar pontos de origem, e exibir nomes de arquivo descritivos sugeridos pelo Claude.

**Restrições de design:**
- Arquivos fonte **nunca são renomeados ou modificados**
- Todas as renomeações exigem **confirmação explícita do usuário**
- A análise e correspondência acontecem localmente — o Claude é chamado apenas quando o usuário revisa os resultados, minimizando chamadas de API

**Status:** Fase de design.

### Limpeza de transcrições baseada em regras
Pós-processamento local e determinístico — remoção de palavras de preenchimento e falsos começos, controlado pelo usuário. Mais valioso para usuários do modo de privacidade, onde a transcrição nunca chega ao Claude para limpeza. Deliberadamente restrito: quebra de parágrafos e segmentação de tópicos são coisas que o Claude já faz bem no texto retornado, e a exportação para PDF/DOCX é escopo excessivo em direção à geração de documentos — ambos fora do escopo aqui.

**Status:** Em consideração.

### Diarização de falantes (pyannote-audio)
Diarização de falantes mono completa com rótulos de ID de falante em toda a gravação. Diferente do flag `--diarize` estéreo integrado (v2.2.0) e do TinyDiarize (v2.6.0).

**Implementação:** requer [pyannote-audio](https://github.com/pyannote/pyannote-audio) — biblioteca Python com requisito de token de acesso do Hugging Face, uma pilha de dependências completamente separada. Despriorizado: entra em conflito com o ethos local em primeiro lugar / zero dependências, e o TinyDiarize já cobre o caso mono sem dependências. Se for realizado, será distribuído como um complemento avançado opcional com sua própria documentação de configuração, nunca no pacote principal.

**Status:** Despriorizado / opcional.

### Tradução para idiomas que não sejam inglês
O flag `--translate` do Whisper é direcionado apenas ao inglês. Idiomas de destino arbitrários precisam de uma API de tradução externa ou de um modelo de tradução local.

**Opções em consideração:** LibreTranslate (pode ser auto-hospedado, local em primeiro lugar), tradução via LLM local ou documentação explícita de fora do escopo.

**Status:** Adiado aguardando uma decisão entre local em primeiro lugar e dependência de API.

---

## Fora do escopo / Não planejado

Funcionalidades excluídas intencionalmente, registradas aqui para que a decisão seja explícita e não ressurja repetidamente.

### Transcrição de microfone ao vivo — não planejado
A transcrição em tempo real de um microfone ao vivo estava anteriormente prevista para a v2.7.0. Cortada porque entra em conflito com o design central do projeto:
- **Incompatibilidade de arquitetura:** o MCP é requisição/resposta, não streaming. A captura ao vivo exigiria polling contínuo (consome orçamento de API) ou uma chamada de bloqueio longo que atinge a guarda de tempo limite em primeiro plano do v2.4.0.
- **Princípios de instância única / minimizar API:** retornar segmentos contínuos ao Claude é uma constante enxurrada de chamadas de ferramentas — o oposto de "funcional para usuários do plano gratuito" — e um processo de streaming de longa duração sobrecarrega o bloqueio de processo.
- **Dependência externa:** dependeria de uma API de streaming estável do whisper.cpp que não é nossa para agendar.

A legendagem ao vivo é uma categoria de produto distinta (baixa latência, gerenciamento de dispositivos, VAD) de uma ferramenta de transcrição de arquivos/lote. Usuários que precisam disso são melhor atendidos por uma ferramenta dedicada em tempo real.

### Transcrição de URL do YouTube (yt-dlp) — não planejada como ferramenta empacotada
A transcrição direta de YouTube para transcrição via yt-dlp estava anteriormente planejada. Descartada como funcionalidade de primeira classe porque:
- **Superfície de segurança:** adiciona busca de URL arbitrária e uma chamada de subprocesso com entrada controlada pelo usuário, revertendo o fortalecimento do v2.4.0 que reduziu exatamente essa superfície.
- **Manutenção:** o yt-dlp quebra com frequência conforme o YouTube muda — um compromisso de manutenção contínuo.
- **Local em primeiro lugar e licenciamento:** a aquisição de conteúdo pela rede fica fora do escopo local em primeiro lugar, e empacotar um downloader em um projeto de licença comercial é uma área cinzenta de ToS/responsabilidade.
- **Redundante:** os usuários podem executar o yt-dlp por conta própria e apontar `transcribe_audio` para o arquivo resultante.

**Alternativa:** documentada como uma receita (executar o yt-dlp e depois transcrever o arquivo) no README / TROUBLESHOOTING, em vez de uma ferramenta mantida — o fluxo de trabalho permanece disponível sem assumir a dependência ou a superfície de ataque.

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
