# whisper-windows-mcp — Solución de Problemas

---

## Lista de verificación rápida

Antes de investigar más a fondo, verifica todos los siguientes puntos:

- Las rutas en `claude_desktop_config.json` usan **barras invertidas dobles** (`C:\\whisper\\...`)
- `whisper-cli.exe` existe en la ruta especificada en `WHISPER_CLI_PATH`
- El archivo de modelo `.bin` existe en la ruta especificada en `WHISPER_MODEL`
- FFmpeg está instalado y accesible (`ffmpeg -version` funciona en el símbolo del sistema)
- Claude Desktop fue **completamente reiniciado** tras editar la configuración (saliendo desde la bandeja del sistema, no solo cerrando la ventana)
- El servidor whisper aparece como **en ejecución** (insignia verde) en Configuración → Desarrollador

---

## "whisper no está conectado" o no hay herramientas disponibles

**Causa más común:** Claude Desktop no fue completamente reiniciado tras editar la configuración.

1. Clic derecho en el ícono de Claude en la bandeja del sistema → Salir
2. Vuelve a abrir Claude Desktop
3. Ve a Configuración → Desarrollador y verifica la insignia verde **en ejecución** junto a whisper

Si sigue sin aparecer:

1. Abre `claude_desktop_config.json` y verifica errores de sintaxis JSON (comas faltantes, llaves no coincidentes)
2. Asegúrate de que todas las rutas usen barras invertidas dobles
3. Ejecuta `check_config` en Claude Desktop para obtener un diagnóstico

---

## download_model alcanza timeout en modelos grandes

Claude Desktop tiene un timeout de 4 minutos en las llamadas a herramientas MCP. Las descargas de modelos grandes en conexiones lentas pueden exceder este límite.

**Tamaños de archivo:**
- `large-v3` — 2,9 GB
- `large-v3-turbo` — 1,6 GB
- `large-v3-q5_0` — 1,1 GB
- `large-v3-turbo-q5_0` — 547 MB
- `medium.en` — 1,5 GB
- `medium.en-q5_0` — 514 MB

En una conexión rápida (100 Mbps+), incluso large-v3 termina en menos de 4 minutos. En conexiones más lentas, usa un navegador o PowerShell para descargar directamente y coloca el archivo en tu directorio de modelos manualmente:

```powershell
# Ejemplo — descargar large-v3-turbo directamente
Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin" `
  -OutFile "C:\whisper\models\ggml-large-v3-turbo.bin"
```

Luego usa `switch_model ggml-large-v3-turbo.bin` para activarlo.

---

## `check_config` reporta que whisper-cli.exe no fue encontrado

La ruta en tu configuración no coincide con la ubicación real del archivo.

Verifica que el archivo existe:
```
dir C:\whisper\Release\whisper-cli.exe
```

Si está en otro lugar, actualiza `WHISPER_CLI_PATH` en tu configuración para que coincida con la ruta real.

---

## `check_config` reporta que FFmpeg no fue encontrado

FFmpeg no está instalado o no está en el PATH del sistema.

Instala via winget:
```
winget install ffmpeg
```

O descarga desde [ffmpeg.org](https://ffmpeg.org/download.html), extrae y agrega la carpeta `bin` al PATH del sistema.

Tras instalar, abre un nuevo símbolo del sistema y verifica:
```
ffmpeg -version
```

Si instalaste FFmpeg en una ubicación no estándar, establece la variable de entorno `FFMPEG_PATH` en tu configuración de Claude Desktop:
```json
"env": {
  "FFMPEG_PATH": "C:\\ffmpeg\\bin\\ffmpeg.exe"
}
```

---

## La salida de transcripción está llena de etiquetas `[FOREIGN]`

**Causa:** Estás usando un modelo solo inglés (ej.: `ggml-medium.en.bin`) en audio que no es inglés. Los modelos solo inglés no pueden procesar otros idiomas y generan `[FOREIGN]` como marcador para cada segmento que no pueden manejar.

**Solución:** Descarga y usa `ggml-large-v3.bin` — el modelo multilingüe. Esto es necesario para cualquier transcripción que no sea inglés, detección automática de idioma o traducción.

```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
```

Guarda en `C:\whisper\models\` y actualiza tu configuración:
```json
"WHISPER_MODEL": "C:\\whisper\\models\\ggml-large-v3.bin"
```

O anula por transcripción usando el parámetro `model` en `transcribe_audio` o `generate_subtitles`.

> **Nota:** Los modelos solo inglés (`*.en.bin`) son más rápidos y precisos para contenido en inglés, pero son completamente incapaces de manejar otros idiomas. Si trabajas con contenido multilingüe, `large-v3` es el modelo correcto independientemente del hardware.

---

## La transcripción no produce salida o el archivo está vacío

**Posibles causas:**

1. **Modelo incorrecto para el idioma** — Los modelos solo inglés (`*.en.bin`) no pueden transcribir otros idiomas. Usa `ggml-large-v3.bin` para contenido multilingüe.

2. **Calidad de audio muy baja** — Los archivos con tasa de bits muy baja (ej.: grabaciones antiguas de celular `.3gp` usando códec AMR-NB a ~12kbps) pueden estar en el límite de lo que whisper puede procesar. Los entornos ruidosos (ruido de fondo, eco, hablantes distantes) también son desafiantes. Prueba `large-v3`, que maneja mejor el audio degradado que los modelos más pequeños.

3. **Archivo silencioso o corrupto** — Ejecuta `analyze_media` en el archivo para verificar si FFprobe detecta un flujo de audio válido.

4. **Fallo en la conversión** — El archivo puede no estar convirtiéndose a WAV correctamente. Intenta convertir manualmente primero:
```
ffmpeg -i yourfile.3gp -ar 16000 -ac 1 output.wav
```
Luego transcribe el WAV directamente.

---

## "Este archivo dura ~X — ejecútalo en segundo plano" / la transcripción en primer plano agota el tiempo

Claude Desktop impone un tiempo de espera de ~4 minutos en cualquier llamada individual a una herramienta MCP. Un archivo largo transcrito en modo **primer plano** (bloqueante) puede superarlo — la transcripción aún termina y se escribe en disco, pero la propia llamada a la herramienta da error. Para evitar ese fallo silencioso, `transcribe_audio` y `generate_subtitles` estiman el tiempo de ejecución de antemano y, si probablemente cruzaría el límite, devuelven un mensaje indicándote que vuelvas a ejecutar con `background=true`. El modo en segundo plano devuelve un ID de tarea de inmediato y no tiene ese límite — monitorízalo con `check_progress`.

Gran parte del tiempo real de una transcripción es **carga del modelo**, no transcripción: whisper-cli recarga el modelo en cada invocación, y un modelo grande (p. ej. `large-v3`, 2,9 GB) en una GPU con memoria limitada puede tardar ~2 minutos en cargar antes de que siquiera comience la transcripción (un modelo más pequeño o cuantizado carga más rápido). El umbral de la guarda es configurable con `WHISPER_FOREGROUND_MAX_SEC` (segundos; predeterminado 210).

## La tarea en segundo plano falla en archivos con caracteres especiales o Unicode en el nombre

**Causa:** whisper-cli.exe no puede escribir el archivo de salida cuando la ruta contiene caracteres Unicode (español, japonés, chino, emoji, corchetes, etc.) o ciertos caracteres especiales.

**Corregido en v2.0.0.** Si estás ejecutando la versión actual, este problema no debería ocurrir. Si sigue ocurriendo, actualiza con `npm install -g whisper-windows-mcp` y reinicia Claude Desktop.

Si usas una versión anterior, la solución alternativa es renombrar el archivo para usar solo caracteres ASCII antes de transcribir, luego renombra de vuelta si es necesario.

```
ren "archivo_español.mp4" "temp_transcribe.mp4"
```

---

## La tarea en segundo plano muestra "fallo" sin salida

**Posibles causas:**

1. **Ruta del modelo incorrecta** — El proceso separado no hereda las rutas corregidas. Ejecuta `check_config` para verificar las rutas.

2. **Proceso fue terminado** — Si whisper-cli.exe fue terminado manualmente a mitad de una tarea, no existirá ningún archivo de salida. Vuelve a intentarlo.

3. **VRAM insuficiente** — Los modelos grandes en GPUs con poca VRAM pueden fallar silenciosamente. Prueba un modelo más pequeño.

4. **Fallo en la conversión del archivo** — Intenta transcribir un archivo WAV directamente para aislar si el problema está en la conversión o en la transcripción.

---

## La GPU no está siendo usada (CPU atascada por encima del 50%)

**Causa:** Estás ejecutando el binario solo CPU que viene con el release estándar de whisper.cpp.

**Solución:** Descarga la build con Vulkan activado desde la [página de releases](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0) y extrae en `C:\whisper\Release\`.

Verifica que la aceleración GPU está activa:
- Pide a Claude ejecutar `check_system`
- Busca `✅ Vulkan binary: ggml-vulkan.dll found` en la salida
- Observa el Administrador de Tareas → Rendimiento → GPU durante una transcripción — la utilización de GPU debería subir al 15–30%

---

## La transcripción se ejecuta en la GPU equivocada (sistemas multi-GPU)

Por defecto, whisper-cli usa el dispositivo Vulkan 0. En una máquina con múltiples GPU, puede que no sea la tarjeta que quieres. Fija un dispositivo específico con la variable de entorno `WHISPER_GPU_DEVICE` (o el parámetro `gpu_device` por llamada, que ahora también funciona en `generate_subtitles`):

```json
"env": { "WHISPER_GPU_DEVICE": "1" }
```

⚠️ **El índice es el orden de enumeración de Vulkan, NO el orden "GPU 0 / GPU 1" de Windows** — a menudo difieren. Para encontrar el número correcto, ejecuta `whisper-cli.exe` sobre cualquier archivo una vez y lee su registro de inicio: imprime `ggml_vulkan: 0 = <nombre>`, `ggml_vulkan: 1 = <nombre>`. Usa el índice que liste tu tarjeta objetivo. `check_config` muestra el dispositivo activo para que puedas confirmar que la fijación surtió efecto.

## `check_system` reporta cantidad de VRAM incorrecta

Esta es una limitación conocida de Windows. El comando `wmic` lee la VRAM del registro, que en muchas tarjetas AMD reporta la mitad de la VRAM física. Una Vega 56 con 8GB HBM2 típicamente mostrará 4GB. Esto es solo un problema de visualización — whisper usa toda la VRAM física durante la inferencia.

---

## Error "Transcripción ya en progreso"

Hay un proceso `whisper-cli.exe` ejecutándose de una tarea anterior. Espera a que termine, o:

1. Abre el Administrador de Tareas → pestaña Detalles
2. Encuentra `whisper-cli.exe`
3. Clic derecho → Finalizar tarea

Luego vuelve a intentarlo.

---

## La detección automática de idioma es incorrecta

La detección automática de Whisper se ejecuta en los primeros 30 segundos del audio. Si el archivo comienza en un idioma diferente al de la mayoría de su contenido, la detección puede ser incorrecta.

**Solución:** Especifica el idioma explícitamente (ej.: `language=es`) en lugar de depender de la detección automática.

---

## La generación de subtítulos produce "(hablando en idioma extranjero)" en todo el video

Whisper detectó habla pero no pudo transcribir. Causas más comunes:

1. **Modelo incorrecto** — Usando un modelo solo inglés en audio que no es inglés. Usa `large-v3`.

2. **Calidad de audio** — Los entornos ruidosos (cocinas, multitudes, eco) pueden superar al modelo medium. Prueba `large-v3`.

3. **Idioma mixto** — Los archivos con dos idiomas alternando tendrán el idioma minoritario reemplazado por marcadores con una configuración de idioma único.

---

## La traducción de subtítulos solo produce inglés

Este es el comportamiento esperado. El flag `--translate` integrado de Whisper solo traduce **al inglés**. Para traducción a otros idiomas de destino, procesa el contenido del archivo `.srt` por separado.

---

## La transcripción por lotes dejó de avanzar

Llama a `check_batch_progress` nuevamente. Si sigue atascado:

1. Verifica en el Administrador de Tareas si hay un proceso `whisper-cli.exe` en ejecución
2. Revisa los logs de tareas en `%TEMP%\whisper-mcp-jobs\`
3. Los archivos con error están marcados en el informe del lote — ejecútalos individualmente con `transcribe_audio`

---

## Limpiar el directorio temporal de tareas

whisper-windows-mcp escribe archivos de estado de tareas y logs en `%TEMP%\whisper-mcp-jobs\` durante la transcripción. El servidor limpia automáticamente los archivos con más de 7 días de antigüedad al arrancar. Para limpiar manualmente, una vez que un lote o tarea esté completo y hayas verificado las transcripciones de salida, puedes eliminar de forma segura todo en este directorio:

```powershell
Remove-Item "$env:TEMP\whisper-mcp-jobs\*" -Recurse -Force
```

El directorio se recreará automáticamente en la siguiente transcripción. Ningún archivo de salida de transcripción se almacena permanentemente aquí — se mueven al directorio de origen al completarse. Solo quedan metadatos de tareas y logs.

**Nota:** No elimines este directorio mientras una transcripción esté en progreso — los archivos de estado del lote son necesarios para que `check_batch_progress` funcione.

---

## Lote grande sin supervisión desde la línea de comandos

Para lotes muy grandes donde quieres ejecutar durante la noche sin Claude, usa PowerShell.

**Importante:** whisper-cli.exe no puede leer MP4, MKV ni la mayoría de los formatos de video directamente. FFmpeg debe pre-convertir cada archivo a WAV primero. Whisper también escribe la transcripción al stdout y la salida de diagnóstico al stderr — usa `Start-Process -RedirectStandardOutput` para capturar la transcripción correctamente. Usar pipe con `|` o redirigir stderr con `2>$null` no captura nada.

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

Cambia `*.mp4` por `*.mkv`, `*.m4a` etc. para que coincida con tus tipos de archivo. La verificación de salto `Test-Path` significa que volver a ejecutar el script tras una interrupción no reprocesará los archivos ya completados.

Esto escribe archivos `.txt` junto a cada fuente. Las herramientas MCP los reconocerán como ya transcritos cuando ejecutes `analyze_media` o `start_batch` después.

---

## Ubicación del archivo de configuración

```
C:\Users\TuUsuario\AppData\Roaming\Claude\claude_desktop_config.json
```

Si `AppData` no es visible: Ver → Mostrar → Elementos ocultos en el Explorador de archivos.

---

## Ejemplo de configuración completa funcionando

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

`FFMPEG_PATH` tiene como predeterminado `ffmpeg` (asume que está en el PATH). Establécelo explícitamente solo si FFmpeg está instalado en una ubicación no estándar.
