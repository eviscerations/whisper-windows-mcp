# whisper-windows-mcp

[![CI](https://github.com/eviscerations/whisper-windows-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/eviscerations/whisper-windows-mcp/actions/workflows/ci.yml)

[![whisper-windows-mcp MCP server](https://glama.ai/mcp/servers/eviscerations/whisper-windows-mcp/badges/card.svg)](https://glama.ai/mcp/servers/eviscerations/whisper-windows-mcp)

Servidor MCP (Model Context Protocol) nativo para Windows. Utiliza [whisper.cpp](https://github.com/ggml-org/whisper.cpp) para transcribir archivos de audio y video localmente en Claude Desktop — con aceleración por GPU, soporte multilingüe y procesamiento por lotes. Toda la transcripción se ejecuta localmente — ningún archivo de audio, video ni ruta de archivo se envía al exterior.

> **¿Por qué existe este paquete?**
> El popular paquete `whisper-mcp` fue creado para macOS y asume un entorno Unix. No funciona en Windows. Este paquete fue escrito específicamente para usuarios de Windows que desean transcripción de IA local integrada con Claude Desktop.

---

## Qué puedes hacer

Después de instalar, simplemente habla en Claude Desktop:

- *"Transcribe C:\Users\Me\Downloads\meeting.mp3"*
- *"Transcribe todas las grabaciones en esta carpeta y guarda cada una como archivo de texto"*
- *"Crea subtítulos en español e inglés para este video"*
- *"Inicia la transcripción por lotes de todos los archivos en esta carpeta"*
- *"¿Cuánto tiempo tardará en transcribir estos archivos?"*
- *"Verifica si la aceleración por GPU está funcionando"*
- *"Transcribe este archivo en modo de privacidad"*

---

## Requisitos

1. **Node.js 18 o superior** — [nodejs.org](https://nodejs.org)
2. **Binario de whisper.cpp con soporte Vulkan GPU** — ver Paso 1
3. **Archivo de modelo Whisper** — ver Paso 2
4. **FFmpeg** — necesario para archivos de video y formatos de audio que no sean WAV/MP3

---

## Paso 1 — Instalar el binario de whisper.cpp

### Opción A — Release Vulkan precompilado (recomendado)

Descarga `whisper-vulkan-win-x64.zip` desde la [página de releases](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0).

Esta es una build personalizada con **aceleración Vulkan GPU** activada. Funciona con GPUs AMD, NVIDIA e Intel — sin necesidad de SDKs específicos del fabricante.

Extrae en `C:\whisper\Release\`. Deberías tener:

```
C:\whisper\Release\whisper-cli.exe
C:\whisper\Release\ggml-vulkan.dll
C:\whisper\Release\ggml.dll
C:\whisper\Release\ggml-base.dll
C:\whisper\Release\ggml-cpu.dll
C:\whisper\Release\whisper.dll
```

La aceleración por GPU se activa automáticamente — no se necesita configuración adicional.

### Opción B — Compilar desde el código fuente

Necesario: Git, CMake, Visual Studio Build Tools 2022+ con "Desktop development with C++", Vulkan SDK de [lunarg.com](https://vulkan.lunarg.com/sdk/home#windows).

```
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target whisper-cli
```

Copia los binarios de `build\bin\Release\` a `C:\whisper\Release\`.

> **Nota:** Los releases oficiales de whisper.cpp para Windows en GitHub no incluyen la build Vulkan. Usa el release precompilado de arriba o compila desde el código fuente con `-DGGML_VULKAN=ON`.

---

## Paso 2 — Descargar el modelo Whisper

| Modelo | Tamaño | Velocidad | Precisión | Mejor para |
|---|---|---|---|---|
| `ggml-tiny.en.bin` | 75 MB | Muy rápido | Básica | Pruebas rápidas |
| `ggml-base.en.bin` | 142 MB | Rápido | Buena | Inglés del día a día |
| `ggml-small.en.bin` | 466 MB | Moderado | Mejor | Grabaciones importantes |
| `ggml-medium.en.bin` | 1,5 GB | Rápido en GPU | Muy buena | Inglés con máxima calidad |
| `ggml-large-v3-turbo.bin` | 1,6 GB | Rápido en GPU | Excelente | **Recomendado para lotes en GPU — ~6x más rápido que large-v3 con mínima pérdida de precisión** |
| `ggml-large-v3.bin` | 2,9 GB | Rápido en GPU | Excelente | Multilingüe, máxima precisión |
| `ggml-medium.en-q5_0.bin` | 514 MB | Rápido | Muy buena | **Mejor opción solo CPU para inglés — alta precisión con bajo consumo de memoria** |
| `ggml-large-v3-turbo-q5_0.bin` | 547 MB | Rápido | Excelente | **Mejor opción solo CPU multilingüe** |
| `ggml-large-v3-q5_0.bin` | 1,1 GB | Moderado en CPU | Excelente | Multilingüe, amigable con CPU |

Usa `download_model` en Claude Desktop para instalar directamente. Para **solo inglés**: `large-v3-turbo` (GPU) o `medium.en-q5_0` (CPU). Para **multilingüe**: `large-v3-turbo` o `large-v3-turbo-q5_0` (CPU). Los modelos solo inglés (`*.en.bin`) generan `[FOREIGN]` en audio que no sea inglés y no pueden usarse para otros idiomas.

---

## Paso 3 — Instalar FFmpeg

FFmpeg es necesario para archivos de video y formatos de audio no nativos.

Instala via winget:
```
winget install ffmpeg
```

O descarga desde [ffmpeg.org](https://ffmpeg.org/download.html) y agrega al PATH.

Verifica:
```
ffmpeg -version
```

---

## Paso 4 — Instalar el servidor MCP

```
npm install -g whisper-windows-mcp
```

---

## Paso 5 — Configurar Claude Desktop

Abre Claude Desktop → Configuración → Desarrollador → Editar Configuración.

Agrega la entrada `whisper`:

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

Ubicación del archivo de configuración: `C:\Users\TuUsuario\AppData\Roaming\Claude\claude_desktop_config.json`

> Usa **barras invertidas dobles** en todas las rutas.

Guarda y **reinicia completamente** Claude Desktop. Verás **whisper** listado con una insignia verde "en ejecución" en Configuración → Desarrollador.

---

## Paso 6 — Verificar la instalación

En Claude Desktop, pregunta:

> *"Verifica la configuración de whisper"*

Luego:

> *"Verifica el hardware del sistema"*

Esto confirma que tu GPU fue detectada y la aceleración Vulkan está activa.

---

## Herramientas disponibles

### `transcribe_audio`
Transcribe un único archivo. Soporta modo de bloqueo (predeterminado) o en segundo plano para archivos largos.

| Parámetro | Descripción |
|---|---|
| `file_path` | Ruta absoluta al archivo (obligatorio) |
| `language` | Código de idioma (`es`, `en`, `ja` etc.) o `auto` para detección automática. Predeterminado: `en` |
| `output_format` | `timestamps` (predeterminado), `text`, `json`, `srt`, `vtt`, `lrc` o `csv` |
| `save_to_file` | Guarda la transcripción como .txt junto al archivo de origen |
| `background` | Ejecuta como tarea separada — devuelve ID de tarea inmediatamente. Usa `check_progress` para monitorear. Recomendado para archivos de más de 10 minutos. |
| `privacy_mode` | Anula el modo de privacidad para esta llamada. `true` = solo metadatos, sin texto de transcripción transmitido. `false` = devuelve texto incluso si `WHISPER_PRIVACY_MODE=true` globalmente. Omite para usar la configuración global. |
| `threads` | Anula el número de hilos de CPU |
| `temperature` | Temperatura de muestreo 0,0–1,0. Predeterminado 0,0 (determinista). |
| `prompt` | Cadena de contexto previo — mejora la precisión para vocabulario de dominio específico o nombres de hablantes. Ej.: `"Nombres: Keemstar, DramaAlert."` |
| `condition_on_prev_text` | Reactiva el condicionamiento de contexto entre segmentos. Predeterminado false. |
| `beam_size` | Anchura de búsqueda en haz. Mayor = más preciso, más lento. Predeterminado 5. |
| `best_of` | Secuencias candidatas evaluadas. Predeterminado 5. |
| `gpu_device` | Índice de dispositivo GPU para sistemas multi-GPU. Predeterminado 0. |
| `processors` | Recuento de procesadores paralelos. Predeterminado 1. |
| `word_timestamps` | Una palabra por segmento con marca de tiempo. Útil para alineación de clips. |
| `max_segment_length` | Longitud máxima de segmento en caracteres. |
| `diarize` | Diarización de hablantes estéreo — requiere audio estéreo con hablantes en canales separados. |
| `vad_model` | Ruta al archivo .bin del modelo Silero VAD. Elimina silencios antes de transcribir — reduce alucinaciones en archivos ruidosos. |
| `offset_t` | Desplazamiento de inicio en milisegundos. |
| `duration` | Duración a procesar desde el desplazamiento en milisegundos. |

---

### `check_progress`
Monitorea una tarea de transcripción en segundo plano iniciada con `transcribe_audio` (background=true).

Devuelve el tiempo transcurrido, la última marca de tiempo procesada y la transcripción completa al finalizar.

| Parámetro | Descripción |
|---|---|
| `job_id` | ID de tarea devuelto por `transcribe_audio` |
| `privacy_mode` | Anula el modo de privacidad para esta llamada. |

---

### `start_batch`
Transcribe automáticamente en secuencia todos los archivos no transcritos en una carpeta. Ordena cronológicamente (los más cortos primero), procesa uno a uno como tarea en segundo plano y valida cada salida.

| Parámetro | Descripción |
|---|---|
| `folder_path` | Ruta a la carpeta (obligatorio) |
| `language` | Código de idioma. Predeterminado: `en` |
| `output_format` | `timestamps` (predeterminado), `text`, `srt`, `vtt`, `lrc`, `csv` |
| `privacy_mode` | Anula el modo de privacidad para este lote. |
| `threads` | Anula el número de hilos de CPU |

---

### `check_batch_progress`
Monitorea un lote en ejecución. Avanza automáticamente al siguiente archivo cuando el actual se completa. Devuelve el progreso general, el archivo actual con marca de tiempo, ETA y archivos fallidos.

| Parámetro | Descripción |
|---|---|
| `batch_id` | ID de lote devuelto por `start_batch` |

---

### `transcribe_batch` (interactivo)
Procesa archivos uno a uno con vista previa y confirmación antes de cada archivo. Útil cuando quieres revisar sobre la marcha.

| Parámetro | Descripción |
|---|---|
| `folder_path` | Ruta a la carpeta (obligatorio) |
| `file_index` | Archivo a procesar (empieza en 1). Omite para listar archivos primero. |
| `language` | Código de idioma. Predeterminado: `en` |
| `recursive` | Incluir subcarpetas |

---

### `generate_subtitles`
Genera archivos de subtítulos. Soporta detección automática de idioma y salida de traducción al inglés.

| Parámetro | Descripción |
|---|---|
| `file_path` | Ruta al archivo (obligatorio) |
| `language` | Código de idioma o `auto` para detección automática. Predeterminado: `en` |
| `output_format` | `srt` (predeterminado) o `vtt` |
| `translate_to_english` | También genera un archivo de subtítulos con traducción al inglés. Solo aplica cuando el origen no es inglés. |
| `background` | Ejecuta como tarea en segundo plano separada. Devuelve un ID de tarea para `check_progress`. |
| `threads` | Anula el número de hilos de CPU |

Cuando ambos son solicitados, dos archivos se guardan junto al origen:
- `archivo.es.srt` — idioma original
- `archivo.en.srt` — traducción al inglés

> La traducción integrada de Whisper solo traduce **al inglés**. Para otros idiomas de destino, procesa el contenido del archivo `.srt` por separado.

---

### `analyze_media`
Analiza un archivo antes de transcribir. Devuelve duración, tamaño, códec y tiempo estimado de transcripción en CPU y GPU. Para carpetas, muestra todos los archivos en una tabla ordenable con estado de transcripción.

| Parámetro | Descripción |
|---|---|
| `path` | Ruta a un único archivo o carpeta (obligatorio) |
| `sort_by` | Para carpetas: `duration` (predeterminado), `name` o `size` |

---

### `check_config`
Verifica que whisper-cli.exe, el archivo de modelo y FFmpeg sean todos accesibles. Ejecuta esto primero si algo no funciona.

---

### `list_models`
Lista todos los archivos de modelo Whisper instalados en tu directorio de modelos. Muestra nombre de archivo, tamaño, si está activo, estado de cuantización y casos de uso recomendados. Sin llamadas de red — solo lee el sistema de archivos local.

---

### `download_model`
Descarga un modelo Whisper directamente desde Hugging Face a tu directorio de modelos. Solo descarga desde espacios de nombres de Hugging Face de confianza. Después de descargar, usa `switch_model` para activar.

| Parámetro | Descripción |
|---|---|
| `model_name` | Nombre del modelo a descargar, ej.: `large-v3-turbo`, `large-v3-turbo-q5_0`, `medium.en-q5_0` |

---

### `switch_model`
Cambia el modelo Whisper activo para la sesión actual sin reiniciar Claude Desktop. El cambio es solo para la sesión — no persiste después de reiniciar. Para hacerlo permanente, actualiza `WHISPER_MODEL` en tu configuración.

| Parámetro | Descripción |
|---|---|
| `model_name` | Nombre del archivo de modelo (ej.: `ggml-large-v3-turbo.bin`) o ruta completa. Debe ser un archivo `.bin` en el directorio de modelos configurado. |

---

### `check_system`
Detecta el hardware GPU y confirma si la aceleración Vulkan está disponible. Reporta el nombre de la GPU, VRAM, presencia de `ggml-vulkan.dll` y recomienda el mejor tamaño de modelo para tu hardware.

---

## Formatos soportados

| Tipo | Formatos |
|---|---|
| Nativos (sin conversión) | `mp3`, `wav` |
| Video (convertido automáticamente via FFmpeg) | `mp4`, `mkv`, `avi`, `mov`, `webm`, `flv`, `wmv`, `m4v`, `ts`, `3gp` |
| Audio (convertido automáticamente via FFmpeg) | `m4a`, `ogg`, `flac` |

---

## Aceleración por GPU

El release Vulkan precompilado activa la aceleración por GPU automáticamente. Probado en AMD Radeon RX Vega 56 (GCN 5ª generación). Cualquier GPU con soporte Vulkan 1.0+ debería funcionar, incluyendo NVIDIA e Intel Arc.

**Comparación de rendimiento (modelo large-v3, archivo de audio ~14 minutos):**

| Hardware | Tiempo |
|---|---|
| Solo CPU (Ryzen 7 2700x, 8 hilos) | ~22 minutos (estimado) |
| GPU (Vega 56 via Vulkan) | ~3 min 22 seg |

La utilización de GPU durante la transcripción es típicamente del 15–20%, volviendo al estado inactivo entre archivos.

Compatible con Windows 10 y Windows 11. No se requiere configuración específica para Windows 11 — la herramienta no realiza llamadas directas a la API Win32 y funciona en ambos sistemas operativos.

---

## Soporte multilingüe

Whisper puede detectar automáticamente el idioma hablado y transcribir en ese idioma. El modelo de traducción integrado traduce solo **al inglés**.

Para la mejor precisión multilingüe, usa el modelo `large-v3`. Los modelos solo inglés (`*.en.bin`) no pueden detectar ni transcribir otros idiomas.

**Ejemplo — video en idioma extranjero con subtítulos:**
1. Pide a Claude generar subtítulos con `language=auto` y `translate_to_english=true`
2. Whisper detecta el idioma y genera el SRT o VTT en el idioma original
3. Un segundo pase genera la traducción al inglés
4. Carga el SRT en VLC via Subtítulos → Agregar Archivo de Subtítulos, o usa el VTT en cualquier reproductor web

---

## Privacidad y cumplimiento

whisper-windows-mcp incluye una arquitectura de privacidad integrada para contenido sensible y regulado.

**El audio y video nunca salen de tu máquina.** Esta garantía es incondicional.

**El texto de transcripción** es diferente — cuando se devuelve en línea en una respuesta de herramienta, es procesado por la API de Claude. Para la mayoría de los usuarios esto es el comportamiento esperado. Para contenido regulado (médico, jurídico, financiero, corporativo), el modo de privacidad lo previene.

**El modo de privacidad** restringe todas las respuestas de herramientas solo a metadatos (nombre de archivo, conteo de palabras, ruta de guardado). Ningún texto de transcripción es transmitido a la API de Claude bajo ninguna circunstancia. Actívalo por llamada con `privacy_mode=true` en cualquier herramienta de transcripción, o globalmente via `WHISPER_PRIVACY_MODE=true` en tu configuración.

**Puerta de consentimiento** — en el primer uso por sesión en modo estándar, se muestra una divulgación de privacidad completa antes de que se devuelva cualquier texto de transcripción. Debes confirmar explícitamente antes de continuar. Establece `WHISPER_CONSENT_ACKNOWLEDGED=true` en tu configuración para omitir esto en contenido no sensible.

Ver [PRIVACY.md](PRIVACY.md) para orientación de cumplimiento completa (HIPAA, GDPR, privilegio abogado-cliente, FERPA, SOX, PCI-DSS).

---

## Diseñado para usuarios del plan gratuito

Esta herramienta fue creada para minimizar las interacciones con la API de Claude. Todo el flujo de trabajo de transcripción — escaneo, análisis, cola, ejecución, validación — está diseñado para requerir el menor número posible de interacciones con Claude. El trabajo pesado se realiza localmente en tu máquina.

---

## Variables de entorno opcionales

| Variable | Descripción |
|---|---|
| `WHISPER_CLI_PATH` | Ruta a whisper-cli.exe (obligatorio) |
| `WHISPER_MODEL` | Ruta al archivo de modelo .bin (obligatorio) |
| `WHISPER_THREADS` | Anula el número de hilos de CPU |
| `WHISPER_GPU_DEVICE` | Índice del dispositivo Vulkan al que fijar la transcripción, para sistemas con múltiples GPU (el índice de enumeración de Vulkan — consulta el registro de inicio de whisper-cli; no el orden de GPU de Windows). Anulable por llamada con `gpu_device`. Ver [TROUBLESHOOTING.md](TROUBLESHOOTING.md). |
| `WHISPER_FOREGROUND_MAX_SEC` | Límite de la transcripción en primer plano en segundos (predeterminado 210). Los archivos cuya ejecución se estima más larga se enrutan al modo en segundo plano en lugar de arriesgar el tiempo de espera de herramienta de ~4 minutos de Claude Desktop. |
| `FFMPEG_PATH` | Ruta a ffmpeg si no está en el PATH del sistema |
| `WHISPER_PRIVACY_MODE` | Establece en `true` para que todas las respuestas de herramientas devuelvan solo metadatos — ningún texto de transcripción devuelto a Claude. Para contenido regulado o confidencial. Puede anularse por llamada con el parámetro `privacy_mode`. Ver [PRIVACY.md](PRIVACY.md). |
| `WHISPER_CONSENT_ACKNOWLEDGED` | Establece en `true` para omitir la divulgación de consentimiento única por sesión que se muestra antes de devolver texto de transcripción. Establécelo cuando entiendas los límites de privacidad y ya no necesites el recordatorio. Sin efecto cuando el modo de privacidad está activo. |

---

## Seguridad

**Verificación del binario.** Para verificar la integridad del binario whisper-cli.exe en el release precompilado, comprueba su hash SHA256 en PowerShell:

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

El hash esperado está documentado en la [página de releases](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0).

**Validación de entrada.** Todas las rutas de archivo son validadas antes de su uso — las rutas UNC (`\\server\share`) y las secuencias de traversal de directorio (`..`) son rechazadas. Los archivos de más de 10 GB son rechazados para prevenir el agotamiento de recursos.

**Conciencia de inyección de transcripción.** Los archivos de audio pueden contener contenido hablado que, cuando se transcribe, se asemeja a instrucciones. Las defensas integradas de Claude manejan esto, pero vale la pena saber que el propio servidor MCP trata el contenido de transcripción como datos — nunca como instrucciones.

**Las descargas de modelos están restringidas.** La herramienta `download_model` solo descarga desde dos espacios de nombres de Hugging Face de confianza (`ggerganov/whisper.cpp` y `ggml-org`). Las URLs arbitrarias son rechazadas. Los redireccionamientos son validados contra una lista de permitidos antes de seguirlos.

**El cambio de modelos está en sandbox.** `switch_model` solo acepta archivos `.bin` dentro del directorio de modelos configurado. Las rutas fuera de ese directorio son rechazadas.

Ver [SECURITY.md](SECURITY.md) para la política de seguridad completa.

---

## Solución de problemas

Ver [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para soluciones detalladas. Ver [PRIVACY.md](PRIVACY.md) si manejas contenido regulado.

Lista de verificación rápida:
- Las rutas en la configuración usan **barras invertidas dobles** (`C:\\whisper\\...`)
- `whisper-cli.exe` existe en la ruta configurada
- El archivo de modelo `.bin` existe en la ruta configurada
- FFmpeg instalado y en el PATH (`ffmpeg -version` funciona)
- Claude Desktop fue **completamente reiniciado** después de editar la configuración
- Whisper aparece como **en ejecución** (insignia verde) en Configuración → Desarrollador

---

## Licencia

**Uso no comercial:** MIT — gratuito para uso personal, educativo y no comercial. Ver [LICENSE](LICENSE).

**Uso comercial:** Se requiere un acuerdo de licencia comercial separado para cualquier uso empresarial, profesional o que genere ingresos. Ver [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) para los términos e información de contacto.

## Contribuciones

Los pull requests son bienvenidos. Ver [ROADMAP.md](ROADMAP.md) para las funcionalidades planificadas.

Si has probado la aceleración por GPU en hardware no listado arriba, abre una issue con los resultados — modelo de GPU, VRAM, tamaño de modelo y throughput observado.
