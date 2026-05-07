# whisper-windows-mcp

Servidor MCP (Model Context Protocol) nativo para Windows. Usa o [whisper.cpp](https://github.com/ggml-org/whisper.cpp) para transcrever arquivos de áudio e vídeo localmente no Claude Desktop — com aceleração por GPU, suporte a múltiplos idiomas e processamento em lote. Toda a transcrição é executada localmente — nenhum arquivo de áudio, vídeo ou caminho de arquivo é enviado para fora.

> **Por que este pacote existe?**
> O popular pacote `whisper-mcp` foi criado para macOS e assume um ambiente Unix. Ele não funciona no Windows. Este pacote foi escrito especificamente para usuários Windows que querem transcrição de IA local integrada ao Claude Desktop.

---

## O que você pode fazer

Após a instalação, basta falar diretamente no Claude Desktop:

- *"Transcreva C:\Users\Me\Downloads\meeting.mp3"*
- *"Transcreva todas as gravações nesta pasta e salve cada uma como arquivo de texto"*
- *"Crie legendas em português e inglês para este vídeo"*
- *"Inicie a transcrição em lote de todos os arquivos nesta pasta"*
- *"Quanto tempo vai levar para transcrever esses arquivos?"*
- *"Verifique se a aceleração por GPU está funcionando"*

---

## Requisitos

1. **Node.js 18 ou superior** — [nodejs.org](https://nodejs.org)
2. **Binário do whisper.cpp com suporte a Vulkan GPU** — veja o Passo 1
3. **Arquivo de modelo Whisper** — veja o Passo 2
4. **FFmpeg** — necessário para arquivos de vídeo e formatos de áudio que não sejam WAV/MP3

---

## Passo 1 — Instalar o binário do whisper.cpp

### Opção A — Release Vulkan pré-compilado (recomendado)

Baixe `whisper-vulkan-win-x64.zip` da [página de releases](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0).

Esta é uma build personalizada com **aceleração Vulkan GPU** ativada. Funciona com GPUs AMD, NVIDIA e Intel — sem necessidade de SDKs específicos de fabricante.

Extraia para `C:\whisper\Release\`. Você deverá ter:

```
C:\whisper\Release\whisper-cli.exe
C:\whisper\Release\ggml-vulkan.dll
C:\whisper\Release\ggml.dll
C:\whisper\Release\ggml-base.dll
C:\whisper\Release\ggml-cpu.dll
C:\whisper\Release\whisper.dll
```

A aceleração por GPU é ativada automaticamente — nenhuma configuração adicional é necessária.

### Opção B — Compilar do código-fonte

Necessário: Git, CMake, Visual Studio Build Tools 2022+ com "Desktop development with C++", Vulkan SDK do [lunarg.com](https://vulkan.lunarg.com/sdk/home#windows).

```
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target whisper-cli
```

Copie os binários de `build\bin\Release\` para `C:\whisper\Release\`.

> **Nota:** Os releases oficiais do whisper.cpp para Windows no GitHub não incluem build Vulkan. Use o release pré-compilado acima ou compile do código-fonte com `-DGGML_VULKAN=ON`.

---

## Passo 2 — Baixar o modelo Whisper

| Modelo | Tamanho | Velocidade | Precisão | Melhor para |
|---|---|---|---|---|
| `ggml-tiny.en.bin` | 75 MB | Muito rápido | Básica | Testes rápidos |
| `ggml-base.en.bin` | 142 MB | Rápido | Boa | Inglês do dia a dia |
| `ggml-small.en.bin` | 466 MB | Moderado | Melhor | Gravações importantes |
| `ggml-medium.en.bin` | 1,5 GB | Rápido na GPU | Muito boa | Inglês com máxima qualidade |
| `ggml-large-v3-turbo.bin` | 1,6 GB | Rápido na GPU | Excelente | **Recomendado para lote em GPU — ~6x mais rápido que large-v3 com perda mínima de precisão** |
| `ggml-large-v3.bin` | 2,9 GB | Rápido na GPU | Excelente | Multilíngue, precisão máxima |
| `ggml-medium.en-q5_0.bin` | 514 MB | Rápido | Muito boa | **Melhor escolha CPU-only para inglês — alta precisão com baixo consumo de memória** |
| `ggml-large-v3-turbo-q5_0.bin` | 547 MB | Rápido | Excelente | **Melhor escolha CPU-only multilíngue** |
| `ggml-large-v3-q5_0.bin` | 1,1 GB | Moderado na CPU | Excelente | Multilíngue, amigável à CPU |

Use `download_model` no Claude Desktop para instalar diretamente. Para **somente inglês**: `large-v3-turbo` (GPU) ou `medium.en-q5_0` (CPU). Para **multilíngue**: `large-v3-turbo` ou `large-v3-turbo-q5_0` (CPU). Modelos somente inglês (`*.en.bin`) geram `[FOREIGN]` em áudio que não seja inglês e não podem ser usados para outros idiomas.

---

## Passo 3 — Instalar o FFmpeg

O FFmpeg é necessário para arquivos de vídeo e formatos de áudio não nativos.

Instale via winget:
```
winget install ffmpeg
```

Ou baixe em [ffmpeg.org](https://ffmpeg.org/download.html) e adicione ao PATH.

Verifique:
```
ffmpeg -version
```

---

## Passo 4 — Instalar o servidor MCP

```
npm install -g whisper-windows-mcp
```

---

## Passo 5 — Configurar o Claude Desktop

Abra Claude Desktop → Configurações → Desenvolvedor → Editar Configuração.

Adicione a entrada `whisper`:

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-medium.en.bin"
      }
    }
  }
}
```

Local do arquivo de configuração: `C:\Users\SeuUsuário\AppData\Roaming\Claude\claude_desktop_config.json`

> Use **barras invertidas duplas** em todos os caminhos.

Salve e **reinicie completamente** o Claude Desktop. Você verá **whisper** listado com um emblema verde "em execução" em Configurações → Desenvolvedor.

---

## Passo 6 — Verificar a instalação

No Claude Desktop, pergunte:

> *"Verifique a configuração do whisper"*

Depois:

> *"Verifique o hardware do sistema"*

Isso confirma que sua GPU foi detectada e a aceleração Vulkan está ativa.

---

## Ferramentas disponíveis

### `transcribe_audio`
Transcreve um único arquivo. Suporta modo de bloqueio (padrão) ou em segundo plano para arquivos longos.

| Parâmetro | Descrição |
|---|---|
| `file_path` | Caminho absoluto para o arquivo (obrigatório) |
| `language` | Código do idioma (`pt`, `en`, `ja` etc.) ou `auto` para detecção automática. Padrão: `en` |
| `output_format` | `text` (padrão), `timestamps`, `json` ou `srt` |
| `save_to_file` | Salva a transcrição como .txt ao lado do arquivo de origem |
| `background` | Executa como tarefa separada — retorna ID da tarefa imediatamente. Use `check_progress` para monitorar. Recomendado para arquivos com mais de 10 minutos. |
| `threads` | Substitui o número de threads da CPU |
| `temperature` | Temperatura de amostragem 0,0–1,0. Padrão 0,0 (determinístico). Valores mais altos reduzem alucinações em áudio ruidoso. |
| `prompt` | String de contexto prévio — melhora a precisão para vocabulário específico de domínio ou nomes de falantes. Ex.: `"Nomes: Keemstar, DramaAlert."` |
| `condition_on_prev_text` | Reativa o condicionamento de contexto entre segmentos. Padrão false. |
| `beam_size` | Largura de busca beam. Maior = mais preciso, mais lento. Padrão 5. |
| `best_of` | Número de sequências candidatas avaliadas. Padrão 5. |
| `gpu_device` | Índice do dispositivo GPU para sistemas multi-GPU. Padrão 0. |
| `processors` | Número de processadores paralelos. Padrão 1. |
| `word_timestamps` | Uma palavra por segmento com carimbo de tempo. Útil para alinhamento de clipes. |
| `max_segment_length` | Comprimento máximo do segmento em caracteres. |
| `diarize` | Diarização de falantes estéreo — requer áudio estéreo com falantes em canais separados. |
| `vad_model` | Caminho para o arquivo .bin do modelo Silero VAD. Remove silêncio antes de transcrever — reduz alucinações em arquivos ruidosos. |
| `offset_t` | Deslocamento de início em milissegundos. |
| `duration` | Duração a processar em milissegundos a partir do deslocamento. |

---

### `check_progress`
Monitora uma tarefa de transcrição em segundo plano iniciada com `transcribe_audio` (background=true).

Retorna o tempo decorrido, o último carimbo de tempo processado, a porcentagem e a transcrição completa ao terminar.

| Parâmetro | Descrição |
|---|---|
| `job_id` | ID da tarefa retornado por `transcribe_audio` |

---

### `start_batch`
Transcreve automaticamente e em sequência todos os arquivos ainda não transcritos em uma pasta. Ordena por duração (mais curtos primeiro), processa um por um como tarefas em segundo plano e valida cada saída.

| Parâmetro | Descrição |
|---|---|
| `folder_path` | Caminho para a pasta (obrigatório) |
| `language` | Código do idioma. Padrão: `en` |
| `threads` | Substitui o número de threads da CPU |

---

### `check_batch_progress`
Monitora um lote em execução. Avança automaticamente para o próximo arquivo quando o atual termina. Retorna o progresso geral, o arquivo atual com carimbo de tempo, o ETA e os arquivos com falha.

| Parâmetro | Descrição |
|---|---|
| `batch_id` | ID do lote retornado por `start_batch` |

---

### `transcribe_batch` (interativo)
Processa arquivos um a um com visualização prévia e confirmação antes de cada um. Útil quando você quer revisar à medida que avança.

| Parâmetro | Descrição |
|---|---|
| `folder_path` | Caminho para a pasta (obrigatório) |
| `file_index` | Qual arquivo processar (começa em 1). Omita para listar os arquivos primeiro. |
| `language` | Código do idioma. Padrão: `en` |
| `recursive` | Incluir subpastas |

---

### `generate_subtitles`
Gera arquivos de legenda SRT. Suporta detecção automática de idioma e saída de tradução para inglês.

| Parâmetro | Descrição |
|---|---|
| `file_path` | Caminho para o arquivo (obrigatório) |
| `language` | Código do idioma ou `auto` para detecção automática. Padrão: `en` |
| `translate_to_english` | Também gera `.en.srt` com tradução para inglês. Aplicável apenas quando a fonte não for inglês. |
| `threads` | Substitui o número de threads da CPU |

Quando ambos são solicitados, dois arquivos são salvos ao lado da origem:
- `arquivo.pt.srt` — idioma original
- `arquivo.en.srt` — tradução para inglês

> A tradução integrada do Whisper apenas traduz **para o inglês**. Para outros idiomas de destino, processe o conteúdo do arquivo .srt separadamente.

---

### `analyze_media`
Analisa um arquivo antes de transcrever. Retorna duração, tamanho, codec e estimativa de tempo de transcrição na CPU e GPU. Para pastas, exibe todos os arquivos em uma tabela ordenável com status de transcrição.

| Parâmetro | Descrição |
|---|---|
| `path` | Caminho para um único arquivo ou pasta (obrigatório) |
| `sort_by` | Para pastas: `duration` (padrão), `name` ou `size` |

---

### `check_config`
Verifica se whisper-cli.exe, o arquivo de modelo e o FFmpeg estão todos acessíveis. Execute isso primeiro se algo não estiver funcionando.

---

### `list_models`
Lista todos os arquivos de modelo Whisper instalados no seu diretório de modelos. Exibe nome do arquivo, tamanho, se está ativo, status de quantização e casos de uso recomendados. Sem chamadas de rede — lê apenas o sistema de arquivos local.

---

### `download_model`
Baixa um modelo Whisper diretamente do Hugging Face para o seu diretório de modelos. Aceita o nome do modelo (ex.: `large-v3-turbo`, `medium.en-q5_0`) e gerencia o download automaticamente. Baixa apenas de namespaces confiáveis do Hugging Face. Após o download, use `switch_model` para ativar.

| Parâmetro | Descrição |
|---|---|
| `model_name` | Nome do modelo a baixar, ex.: `large-v3-turbo`, `large-v3-turbo-q5_0`, `medium.en-q5_0` |

---

### `switch_model`
Troca o modelo Whisper ativo para a sessão atual sem reiniciar o Claude Desktop. A mudança é válida apenas para a sessão — não persiste após reinicialização. Para torná-la permanente, atualize `WHISPER_MODEL` na sua configuração.

| Parâmetro | Descrição |
|---|---|
| `model_name` | Nome do arquivo de modelo (ex.: `ggml-large-v3-turbo.bin`) ou caminho completo. Deve ser um arquivo `.bin` no diretório de modelos configurado. |

---

### `check_system`
Detecta o hardware GPU e confirma se a aceleração Vulkan está disponível. Reporta o nome da GPU, VRAM, presença do `ggml-vulkan.dll` e recomenda o melhor tamanho de modelo para seu hardware.

---

## Formatos suportados

| Tipo | Formatos |
|---|---|
| Nativos (sem conversão) | `mp3`, `wav` |
| Vídeo (convertido automaticamente via FFmpeg) | `mp4`, `mkv`, `avi`, `mov`, `webm`, `flv`, `wmv`, `m4v`, `ts`, `3gp` |
| Áudio (convertido automaticamente via FFmpeg) | `m4a`, `ogg`, `flac` |

---

## Aceleração por GPU

O release Vulkan pré-compilado ativa a aceleração por GPU automaticamente. Testado em AMD Radeon RX Vega 56 (GCN 5ª geração). Qualquer GPU com suporte a Vulkan 1.0+ deve funcionar, incluindo NVIDIA e Intel Arc.

**Comparação de desempenho (modelo medium.en, arquivo de áudio ~5 minutos):**

| Hardware | Tempo |
|---|---|
| Somente CPU (Ryzen 7 2700x, 8 threads) | 8–12 minutos |
| GPU (Vega 56 via Vulkan) | 20–40 segundos |

A utilização da GPU durante a transcrição é tipicamente de 15–20%, voltando ao estado ocioso entre os arquivos. A CPU fica em torno de 15%.

---

## Suporte multilíngue

O Whisper pode detectar automaticamente o idioma falado e transcrever nesse idioma. O modelo de tradução integrado traduz apenas **para o inglês**.

Para a melhor precisão multilíngue, use o modelo `large-v3`. Modelos somente inglês (`*.en.bin`) não conseguem detectar ou transcrever outros idiomas.

**Exemplo — vídeo em língua estrangeira com legendas:**
1. Peça ao Claude para gerar legendas com `language=auto` e `translate_to_english=true`
2. O Whisper detecta o idioma e gera o SRT no idioma original
3. Uma segunda passagem gera o SRT com tradução para inglês
4. Carregue qualquer um dos arquivos no VLC via Legendas → Adicionar Arquivo de Legenda

---

## Projetado para usuários do plano gratuito

Esta ferramenta foi criada para minimizar as interações com a API do Claude. Todo o fluxo de trabalho de transcrição — varredura, análise, fila, execução, validação — é projetado para exigir o menor número possível de interações com o Claude. O trabalho pesado é feito localmente na sua máquina.

---

## Variáveis de ambiente opcionais

| Variável | Descrição |
|---|---|
| `WHISPER_CLI_PATH` | Caminho para whisper-cli.exe (obrigatório) |
| `WHISPER_MODEL` | Caminho para o arquivo de modelo .bin (obrigatório) |
| `WHISPER_THREADS` | Substitui o número de threads da CPU |
| `FFMPEG_PATH` | Caminho para o ffmpeg se não estiver no PATH do sistema |
| `WHISPER_PRIVACY_MODE` | **Planejado.** Quando definido como `true`, as respostas das ferramentas retornam apenas metadados — nenhum texto de transcrição é retornado ao Claude. Para conteúdo regulamentado ou confidencial. Veja [PRIVACY.md](PRIVACY.md). |

---

## Solução de problemas

Veja [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para soluções detalhadas. Veja [PRIVACY.md](PRIVACY.md) se você lida com conteúdo regulamentado.

Lista de verificação rápida:
- Caminhos na configuração usam **barras invertidas duplas** (`C:\\whisper\\...`)
- `whisper-cli.exe` existe no caminho configurado
- O arquivo de modelo `.bin` existe no caminho configurado
- FFmpeg instalado e no PATH (`ffmpeg -version` funciona)
- Claude Desktop foi **completamente reiniciado** após editar a configuração
- Whisper aparece como **em execução** (emblema verde) em Configurações → Desenvolvedor

---

## Segurança e privacidade

O whisper-windows-mcp foi projetado com segurança como princípio central.

**O áudio nunca sai da sua máquina.** Nenhum arquivo de áudio ou vídeo, caminho de arquivo ou telemetria é transmitido para qualquer servidor. Nenhuma API de nuvem é necessária para a funcionalidade principal.

**Texto de transcrição e o limite da API.** Quando uma resposta de ferramenta inclui texto de transcrição, esse texto é processado pela API do Claude — ele sai da sua máquina local. Para a maioria dos usuários (conteúdo público, podcasts, gravações de streaming) isso é um comportamento esperado. Se você lida com gravações médicas, jurídicas, financeiras ou outras regulamentadas, veja [PRIVACY.md](PRIVACY.md) para orientação de conformidade e opções de configuração.

A variável de ambiente `WHISPER_PRIVACY_MODE` está planejada e limitará todas as respostas das ferramentas apenas a metadados (nome do arquivo, duração, contagem de palavras) — nenhum texto de transcrição será retornado ao Claude. Esta é a configuração correta para conteúdo regulamentado ou confidencial.

**Validação de entrada.** Todos os caminhos de arquivo são validados antes do uso — caminhos UNC (`\\server\share`) e sequências de travessia de diretório (`..`) são rejeitados. Arquivos acima de 10 GB são rejeitados para evitar esgotamento de recursos.

**Consciência de injeção de transcrição.** Arquivos de áudio podem conter conteúdo falado que, quando transcrito, se assemelha a instruções. As defesas integradas do Claude lidam com isso, mas vale saber que o próprio servidor MCP trata o conteúdo de transcrição como dados — nunca como instruções.

**Downloads de modelos são restritos.** A ferramenta `download_model` baixa apenas de dois namespaces confiáveis do Hugging Face (`ggerganov/whisper.cpp` e `ggml-org`). URLs arbitrários são rejeitados. Redirecionamentos são validados contra uma lista de permissões antes de serem seguidos.

**Troca de modelos é isolada em sandbox.** `switch_model` aceita apenas arquivos `.bin` dentro do diretório de modelos configurado. Caminhos fora desse diretório são rejeitados.

**Sem novas dependências de rede.** Os downloads de modelos usam o `https` integrado do Node.js — nenhuma biblioteca HTTP externa é adicionada ao pacote.

---

## Licença

**Uso não comercial:** MIT — gratuito para uso pessoal, educacional e não comercial. Veja [LICENSE](LICENSE).

**Uso comercial:** É necessário um contrato de licença comercial separado para qualquer uso empresarial, profissional ou que gere receita. Veja [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md) para os termos e informações de contato.

## Contribuições

Pull requests são bem-vindos. Veja [ROADMAP.md](ROADMAP.md) para as funcionalidades planejadas.

Se você testou a aceleração por GPU em hardware não listado acima, abra uma issue com os resultados — modelo da GPU, VRAM, tamanho do modelo e throughput observado.
