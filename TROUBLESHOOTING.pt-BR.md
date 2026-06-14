# whisper-windows-mcp — Solução de Problemas

---

## Lista de verificação rápida

Antes de investigar mais fundo, verifique todos os itens a seguir:

- Caminhos em `claude_desktop_config.json` usam **barras invertidas duplas** (`C:\\whisper\\...`)
- `whisper-cli.exe` existe no caminho especificado em `WHISPER_CLI_PATH`
- O arquivo de modelo `.bin` existe no caminho especificado em `WHISPER_MODEL`
- FFmpeg está instalado e acessível (`ffmpeg -version` funciona no prompt de comando)
- O Claude Desktop foi **completamente reiniciado** após editar a configuração (saindo da bandeja do sistema, não apenas fechando a janela)
- O servidor whisper aparece como **em execução** (emblema verde) em Configurações → Desenvolvedor

---

## "whisper não está conectado" ou nenhuma ferramenta disponível

**Causa mais comum:** O Claude Desktop não foi completamente reiniciado após editar a configuração.

1. Clique com o botão direito no ícone do Claude na bandeja do sistema → Sair
2. Reabra o Claude Desktop
3. Vá para Configurações → Desenvolvedor e verifique o emblema verde **em execução** ao lado do whisper

Se ainda não aparecer:

1. Abra `claude_desktop_config.json` e verifique erros de sintaxe JSON (vírgulas faltando, chaves não correspondentes)
2. Certifique-se de que todos os caminhos usam barras invertidas duplas
3. Execute `check_config` no Claude Desktop para obter um diagnóstico

---

## download_model atinge timeout em modelos grandes

O Claude Desktop tem um timeout de 4 minutos em chamadas de ferramentas MCP. Downloads de modelos grandes em conexões lentas podem exceder esse limite.

**Tamanhos dos arquivos:**
- `large-v3` — 2,9 GB
- `large-v3-turbo` — 1,6 GB
- `large-v3-q5_0` — 1,1 GB
- `large-v3-turbo-q5_0` — 547 MB
- `medium.en` — 1,5 GB
- `medium.en-q5_0` — 514 MB

Em uma conexão rápida (100 Mbps+), até o large-v3 termina em menos de 4 minutos. Em conexões mais lentas, use um navegador ou PowerShell para baixar diretamente e coloque o arquivo no diretório de modelos manualmente:

```powershell
# Exemplo — baixar large-v3-turbo diretamente
Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin" `
  -OutFile "C:\whisper\models\ggml-large-v3-turbo.bin"
```

Depois use `switch_model ggml-large-v3-turbo.bin` para ativá-lo.

---

## `check_config` reporta que whisper-cli.exe não foi encontrado

O caminho na sua configuração não corresponde ao local real do arquivo.

Verifique se o arquivo existe:
```
dir C:\whisper\Release\whisper-cli.exe
```

Se estiver em outro lugar, atualize `WHISPER_CLI_PATH` na sua configuração para corresponder ao caminho real.

---

## `check_config` reporta que FFmpeg não foi encontrado

O FFmpeg não está instalado ou não está no PATH do sistema.

Instale via winget:
```
winget install ffmpeg
```

Ou baixe em [ffmpeg.org](https://ffmpeg.org/download.html), extraia e adicione a pasta `bin` ao PATH do sistema.

Após instalar, abra um novo prompt de comando e verifique:
```
ffmpeg -version
```

Se você instalou o FFmpeg em um local não padrão, defina a variável de ambiente `FFMPEG_PATH` na sua configuração do Claude Desktop:
```json
"env": {
  "FFMPEG_PATH": "C:\\ffmpeg\\bin\\ffmpeg.exe"
}
```

---

## A saída da transcrição está cheia de tags `[FOREIGN]`

**Causa:** Você está usando um modelo somente inglês (ex.: `ggml-medium.en.bin`) em áudio que não é inglês. Modelos somente inglês não conseguem processar outros idiomas e geram `[FOREIGN]` como marcador para cada segmento que não conseguem processar.

**Correção:** Baixe e use `ggml-large-v3.bin` — o modelo multilíngue. Isso é necessário para qualquer transcrição que não seja em inglês, detecção automática de idioma ou tradução.

```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
```

Salve em `C:\whisper\models\` e atualize sua configuração:
```json
"WHISPER_MODEL": "C:\\whisper\\models\\ggml-large-v3.bin"
```

Ou substitua por transcrição usando o parâmetro `model` em `transcribe_audio` ou `generate_subtitles`.

> **Nota:** Modelos somente inglês (`*.en.bin`) são mais rápidos e precisos para conteúdo em inglês, mas são completamente incapazes de processar outros idiomas. Se você trabalha com conteúdo multilíngue, `large-v3` é o modelo correto independentemente do hardware.

---

## A transcrição não produz saída ou arquivo vazio

**Possíveis causas:**

1. **Modelo errado para o idioma** — Modelos somente inglês (`*.en.bin`) não conseguem transcrever outros idiomas. Use `ggml-large-v3.bin` para conteúdo multilíngue.

2. **Qualidade de áudio muito baixa** — Arquivos com taxa de bits muito baixa (ex.: gravações antigas de celular `.3gp` usando codec AMR-NB a ~12kbps) podem estar no limite do que o whisper consegue processar. Ambientes ruidosos (ruído de fundo, eco, falantes distantes) também são desafiadores. Tente `large-v3`, que lida melhor com áudio degradado que modelos menores.

3. **Arquivo silencioso ou corrompido** — Execute `analyze_media` no arquivo para verificar se o FFprobe detecta um fluxo de áudio válido.

4. **Falha na conversão** — O arquivo pode não estar sendo convertido para WAV corretamente. Tente converter manualmente primeiro:
```
ffmpeg -i yourfile.3gp -ar 16000 -ac 1 output.wav
```
Depois transcreva o WAV diretamente.

---

## "Este arquivo dura ~X — execute-o em segundo plano" / a transcrição em primeiro plano expira

O Claude Desktop impõe um tempo limite de ~4 minutos em qualquer chamada individual de ferramenta MCP. Um arquivo longo transcrito em modo **primeiro plano** (bloqueante) pode excedê-lo — a transcrição ainda termina e é gravada no disco, mas a própria chamada da ferramenta dá erro. Para evitar essa falha silenciosa, `transcribe_audio` e `generate_subtitles` estimam o tempo de execução de antemão e, se ele provavelmente cruzaria o teto, retornam uma mensagem dizendo para você reexecutar com `background=true`. O modo em segundo plano retorna um ID de tarefa imediatamente e não tem esse limite — monitore-o com `check_progress`.

Grande parte do tempo real de uma transcrição é **carregamento do modelo**, não transcrição: o whisper-cli recarrega o modelo a cada invocação, e um modelo grande (p. ex. `large-v3`, 2,9 GB) em uma GPU com memória limitada pode levar ~2 minutos para carregar antes mesmo de a transcrição começar (um modelo menor ou quantizado carrega mais rápido). O limite da guarda é configurável com `WHISPER_FOREGROUND_MAX_SEC` (segundos; padrão 210).

## Tarefa em segundo plano falha em arquivos com caracteres especiais ou Unicode no nome

**Causa:** O whisper-cli.exe não consegue gravar o arquivo de saída quando o caminho contém caracteres Unicode (português, japonês, chinês, emoji, colchetes etc.) ou certos caracteres especiais.

**Corrigido na v2.0.0.** Se você está executando a versão atual, este problema não deve ocorrer. Se ainda ocorrer, atualize com `npm install -g whisper-windows-mcp` e reinicie o Claude Desktop.

Se você estiver usando uma versão mais antiga, a solução alternativa é renomear o arquivo para usar apenas caracteres ASCII antes de transcrever, depois renomeie de volta se necessário.

```
ren "arquivo_português.mp4" "temp_transcribe.mp4"
```

---

## Tarefa em segundo plano mostra "falha" sem saída

**Possíveis causas:**

1. **Caminho do modelo incorreto** — O processo separado não herda os caminhos corrigidos. Execute `check_config` para verificar os caminhos.

2. **Processo foi encerrado** — Se o whisper-cli.exe foi manualmente encerrado no meio de uma tarefa, nenhum arquivo de saída existirá. Tente novamente.

3. **VRAM insuficiente** — Modelos grandes em GPUs com pouca VRAM podem falhar silenciosamente. Tente um modelo menor.

4. **Falha na conversão do arquivo** — Tente transcrever um arquivo WAV diretamente para isolar se o problema está na conversão ou na transcrição.

---

## GPU não está sendo usada (CPU travada acima de 50%)

**Causa:** Você está executando o binário somente CPU que acompanha o release padrão do whisper.cpp.

**Correção:** Baixe a build com Vulkan ativado da [página de releases](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0) e extraia para `C:\whisper\Release\`.

Verifique se a aceleração GPU está ativa:
- Peça ao Claude para executar `check_system`
- Procure `✅ Vulkan binary: ggml-vulkan.dll found` na saída
- Observe o Gerenciador de Tarefas → Desempenho → GPU durante uma transcrição — a utilização da GPU deve subir para 15–30%

---

## A transcrição é executada na GPU errada (sistemas com múltiplas GPUs)

Por padrão, o whisper-cli usa o dispositivo Vulkan 0. Em uma máquina com múltiplas GPUs, essa pode não ser a placa que você quer. Fixe um dispositivo específico com a variável de ambiente `WHISPER_GPU_DEVICE` (ou o parâmetro `gpu_device` por chamada, que agora também funciona em `generate_subtitles`):

```json
"env": { "WHISPER_GPU_DEVICE": "1" }
```

⚠️ **O índice é a ordem de enumeração do Vulkan, NÃO a ordem "GPU 0 / GPU 1" do Windows** — elas frequentemente diferem. Para encontrar o número certo, execute o `whisper-cli.exe` em qualquer arquivo uma vez e leia seu log de inicialização: ele imprime `ggml_vulkan: 0 = <nome>`, `ggml_vulkan: 1 = <nome>`. Use o índice que lista a placa desejada. O `check_config` exibe o dispositivo ativo para você confirmar que a fixação funcionou.

## `check_system` reporta quantidade de VRAM incorreta

Esta é uma limitação conhecida do Windows. O comando `wmic` lê a VRAM do registro, que em muitas placas AMD reporta metade da VRAM física. Uma Vega 56 com 8GB HBM2 normalmente mostrará 4GB. Este é apenas um problema de exibição — o whisper usa toda a VRAM física durante a inferência.

---

## Erro "Transcrição já em andamento"

Um processo `whisper-cli.exe` está sendo executado de uma tarefa anterior. Aguarde-o terminar, ou:

1. Abra o Gerenciador de Tarefas → aba Detalhes
2. Encontre `whisper-cli.exe`
3. Clique com o botão direito → Encerrar tarefa

Depois tente novamente.

---

## Detecção automática de idioma incorreta

A detecção automática do Whisper é executada nos primeiros 30 segundos do áudio. Se o arquivo começar em um idioma diferente da maior parte do seu conteúdo, a detecção pode estar errada.

**Correção:** Especifique o idioma explicitamente (ex.: `language=pt`) em vez de depender da detecção automática.

---

## A geração de legendas produz "(falando em língua estrangeira)" em todo o vídeo

O Whisper detectou fala mas não conseguiu transcrever. Causas mais comuns:

1. **Modelo errado** — Usando um modelo somente inglês em áudio que não é inglês. Use `large-v3`.

2. **Qualidade do áudio** — Ambientes ruidosos (cozinhas, multidões, eco) podem superar o modelo medium. Tente `large-v3`.

3. **Idioma misto** — Arquivos com dois idiomas alternando terão o idioma minoritário substituído por marcadores com configuração de idioma único.

---

## A tradução de legendas só produz inglês

Este é o comportamento esperado. O flag `--translate` integrado do Whisper traduz apenas **para o inglês**. Para tradução para outros idiomas de destino, processe o conteúdo do arquivo `.srt` separadamente.

---

## A transcrição em lote parou de avançar

Chame `check_batch_progress` novamente. Se ainda estiver travado:

1. Verifique no Gerenciador de Tarefas se há um processo `whisper-cli.exe` em execução
2. Verifique os logs de tarefas em `%TEMP%\whisper-mcp-jobs\`
3. Arquivos com falha são sinalizados no relatório do lote — execute-os individualmente com `transcribe_audio`

---

## Limpando o diretório temporário de tarefas

O whisper-windows-mcp grava arquivos de estado de tarefas e logs em `%TEMP%\whisper-mcp-jobs\` durante a transcrição. O servidor limpa automaticamente arquivos com mais de 7 dias na inicialização. Para limpar manualmente, depois que um lote ou tarefa estiver concluído e você tiver verificado as transcrições de saída, você pode excluir com segurança tudo neste diretório:

```powershell
Remove-Item "$env:TEMP\whisper-mcp-jobs\*" -Recurse -Force
```

O diretório será recriado automaticamente na próxima transcrição. Nenhum arquivo de saída de transcrição é armazenado permanentemente aqui — eles são movidos para o diretório de origem na conclusão. Apenas metadados de tarefas e logs permanecem.

**Nota:** Não exclua este diretório enquanto uma transcrição estiver em andamento — os arquivos de estado do lote são necessários para que `check_batch_progress` funcione.

---

## Lote grande sem supervisão pela linha de comando

Para lotes muito grandes onde você quer executar durante a noite sem o Claude, use o PowerShell.

**Importante:** O whisper-cli.exe não consegue ler MP4, MKV ou a maioria dos formatos de vídeo diretamente. O FFmpeg deve pré-converter cada arquivo para WAV primeiro. O whisper também grava a transcrição no stdout e a saída de diagnóstico no stderr — use `Start-Process -RedirectStandardOutput` para capturar a transcrição corretamente. Usar pipe com `|` ou redirecionar stderr com `2>$null` não captura nada.

```powershell
$whisper = "C:\whisper\Release\whisper-cli.exe"
$model   = "C:\whisper\models\ggml-medium.en.bin"
$dir     = "C:\path\to\your\folder"
$ffmpeg  = "ffmpeg"
$tmp     = "$env:TEMP\whisper_convert.wav"

Get-ChildItem "$dir\*.mp4" | ForEach-Object {
    $out = ($_.FullName -replace '\.mp4$', '') + ".txt"
    if (Test-Path $out) {
        Write-Host "SKIP (exists): $($_.Name)"
        return
    }
    Write-Host "Converting:    $($_.Name)"
    & $ffmpeg -y -i $_.FullName -ar 16000 -ac 1 -c:a pcm_s16le $tmp 2>$null
    Write-Host "Transcribing:  $($_.Name)"
    $wArgs = "-m `"$model`" -f `"$tmp`" --threads 8 --condition-on-previous-text 0 --no-speech-thold 0.6"
    Start-Process -FilePath $whisper -ArgumentList $wArgs -RedirectStandardOutput $out -Wait -NoNewWindow
    Write-Host "Done:          $($_.BaseName).txt"
}

Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host "All done."
```

Altere `*.mp4` para `*.mkv`, `*.m4a` etc. para corresponder aos seus tipos de arquivo. A verificação de pulo `Test-Path` significa que executar novamente o script após uma interrupção não reprocessará arquivos já concluídos.

Isso grava arquivos `.txt` ao lado de cada fonte. As ferramentas MCP os reconhecerão como já transcritos quando você executar `analyze_media` ou `start_batch` depois.

---

## Local do arquivo de configuração

```
C:\Users\SeuUsuário\AppData\Roaming\Claude\claude_desktop_config.json
```

Se `AppData` não estiver visível: Exibir → Mostrar → Itens ocultos no Explorador de Arquivos.

---

## Exemplo de configuração completa funcionando

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-medium.en.bin",
        "FFMPEG_PATH": "ffmpeg"
      }
    }
  }
}
```

`FFMPEG_PATH` tem como padrão `ffmpeg` (assume que está no PATH). Defina explicitamente apenas se o FFmpeg estiver instalado em um local não padrão.
