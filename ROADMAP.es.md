# whisper-windows-mcp — Hoja de Ruta

Versión actual: **v2.2.0**

---

## Principios de diseño

Estos principios rigen cada decisión en este proyecto y tienen prioridad sobre la velocidad de adición de funcionalidades.

**Minimizar el uso de la API de Claude.** Todo el flujo de trabajo de transcripción — escaneo, análisis, cola, ejecución, validación, cambio de modelos — debe ser ejecutable con el menor número posible de interacciones con Claude. Esta herramienta debe funcionar completamente para usuarios de Claude en el plan gratuito que no pagan por suscripciones Pro o Max. Cada llamada a herramienta consume presupuesto de uso. Diseña en consecuencia.

**Siempre una única instancia de whisper.** Nunca crees un segundo proceso whisper-cli.exe mientras uno esté en ejecución. El bloqueo de proceso es obligatorio e innegociable.

**Local primero, privado por defecto.** El audio nunca sale de la máquina. No se necesita ninguna API de nube para la funcionalidad principal. Las integraciones opcionales (ej.: descargas de modelos de Hugging Face) deben estar claramente documentadas como opcionales.

**Control explícito del usuario.** Sin operaciones masivas silenciosas. Las acciones destructivas o irreversibles requieren confirmación. El usuario debe saber siempre qué va a ocurrir antes de que ocurra.

**Rutas seguras para Unicode.** Toda E/S de archivo debe manejar correctamente nombres de archivo no-ASCII, incluyendo español, japonés, chino, emoji, corchetes y otros caracteres especiales.

**Modular y combinable.** Las herramientas son independientes. Los usuarios usan lo que necesitan. Ninguna funcionalidad debe requerir otra, a menos que sea inevitable.

**Optimización antes que funcionalidades.** Cuando haya dudas entre agregar una funcionalidad y reducir la carga del sistema o el número de llamadas a la API, reduce la carga. Las sesiones de optimización grandes son costosas. Diseña la arquitectura correctamente desde el principio.

---

## Completado

### ✅ v1.3.1 — Bloqueo de proceso
Añadida verificación `isWhisperRunning()` usando `tasklist /FI` antes de crear cualquier proceso de transcripción. Devuelve un error claro con instrucciones del Administrador de Tareas en lugar de crear un proceso concurrente.

### ✅ v1.4.0 — Aceleración GPU Vulkan
Compilado whisper.cpp desde el código fuente con `-DGGML_VULKAN=ON` usando VS Build Tools 2022 y Vulkan SDK. Binarios Vulkan precompilados distribuidos como `whisper-vulkan-win-x64.zip`.

**Resultados en AMD Radeon RX Vega 56:** Utilización media de GPU ~16%. Archivo de 58 minutos completado en ~4,5 minutos en GPU vs. ~88 minutos solo en CPU.

### ✅ v1.5.0 — Diagnóstico del sistema
Herramienta `check_system`: detección de GPU via `wmic`, verificación de DLL Vulkan, reporte de VRAM, recomendación de tamaño de modelo.

### ✅ v1.6.0 — Pre-análisis de archivo
Herramienta `analyze_media` via FFprobe: duración, tamaño, códec, estado de transcripción, estimaciones de tiempo de CPU y GPU. Escaneo de archivo único o carpeta con opciones de ordenación.

### ✅ v1.7.0 — Transcripción en segundo plano + Visibilidad del progreso
Arquitectura de proceso desconectado: `transcribe_audio` con `background=true` crea whisper como proceso desconectado y devuelve inmediatamente un ID de tarea. `check_progress` analiza las marcas de tiempo de segmento del stderr de whisper para porcentaje y ETA en tiempo real.

### ✅ v1.8.0 — Lote secuencial con validación
`start_batch` y `check_batch_progress`: procesamiento secuencial automático, validación de transcripción (detección de salida vacía/corta), avance automático de cola, marcas de tiempo de progreso por archivo.

### ✅ v1.9.0 — Soporte multilingüe y traducción
`generate_subtitles` con detección `language=auto` y salida SRT doble `translate_to_english=true`. Añadido soporte para formatos `.3gp` y `.ts`. `language=auto` también disponible en `transcribe_audio`.

**Limitación conocida:** La traducción integrada de Whisper solo apunta al inglés. Requiere modelo `large-v3` para idiomas que no sean inglés — los modelos solo inglés (`*.en.bin`) generan `[FOREIGN]` en audio que no sea inglés.

### ✅ v2.0.0 — Rutas seguras para Unicode + SRT en segundo plano
**Nombres de archivo Unicode:** Los archivos con caracteres no-ASCII en los nombres causaban fallos silenciosos en la transcripción en segundo plano. Corregido enrutando toda la salida a través de una ruta temporal saneada basada en ID de tarea, luego moviendo el resultado al destino correcto tras completarse.

**SRT en modo en segundo plano:** `spawnDetached` anteriormente codificaba de forma rígida `-otxt` independientemente del formato solicitado, y `generate_subtitles` bloqueaba de forma síncrona y alcanzaba el timeout de MCP de 4 minutos en archivos más largos. Corregido añadiendo parámetro `outputFormat` a `spawnDetached`, soportando salida `text` y `srt` en modo en segundo plano.

### ✅ v2.0.1 — Correcciones de bugs (incluido en v2.2.0)
- `--max-context 0` fijo en `buildArgs` y `spawnDetached` — previene bucles de alucinación en audio largo.
- `--no-speech-thold 0.6` fijo en ambas funciones — segmentos por debajo del umbral de confianza son tratados como silencio.
- Validación de ruta (`validateInputPath`) — rechaza rutas UNC y traversales `..`.
- Guarda de tamaño de archivo `MAX_FILE_SIZE_MB = 10240`.
- Comentario de seguridad de inyección de transcripción en `transcribeSingle`.
- Comando CLI de lote corregido en TROUBLESHOOTING.md.

### ✅ v2.1.0 — Suite de gestión de modelos (incluido en v2.2.0)
- `WHISPER_MODEL` cambiado de `const` a `let` (mutable dentro de la sesión).
- `MODEL_REGISTRY` — 16 modelos, variantes de precisión total y cuantizadas, URLs de descarga de Hugging Face.
- `ALLOWED_HF_PREFIXES` — lista de permitidos de URL que limita las descargas a los espacios de nombres `ggerganov/whisper.cpp` y `ggml-org`.
- Herramienta `list_models` — escanea el directorio de modelos, muestra el modelo activo, tamaños, casos de uso, descargas disponibles.
- Herramienta `download_model` — descarga de Hugging Face via `https` integrado de Node.js, renombrado atómico.
- Herramienta `switch_model` — valida extensión `.bin`, restricción de directorio, verificación de bloqueo de proceso.
- `recommendedModel()` actualizado para recomendar `large-v3-turbo` para VRAM de 6GB+.

### ✅ v2.2.0 — Expansión de calidad, parámetros y hardware (actual)
- Interfaz `WhisperOptions` reemplazando argumentos posicionales en `buildArgs`.
- Nuevos parámetros en `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Nuevos parámetros en `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` refactorizado — todos los flags de calidad ahora se aplican en modo en segundo plano/lote.
- Salida de lote corregida — `readBatchProgress` ahora mueve la salida temporal al destino final antes de validar.

---

## Bug crítico — Avance automático del lote (confirmado, pendiente de corrección)

### El lote no avanza sin polling activo

`start_batch` no avanza la cola de forma autónoma entre archivos. El lote solo avanza cuando se llama a `check_batch_progress`. Sin polling, el lote se detiene indefinidamente tras cada archivo.

**Corrección planificada — Opción B (callback de salida):** Adjuntar un handler `on('exit')` al proceso hijo whisper-cli creado. Cuando el proceso salga, llamar inmediatamente a la lógica de avance para validar la salida y crear la siguiente tarea.

**Solución alternativa (actual):** Llama a `check_batch_progress` repetidamente hasta que el lote se complete.

---

## Planificado — Arquitectura de Privacidad (antes de la migración a Bun)

### Variable de entorno `WHISPER_PRIVACY_MODE`
Añadir `WHISPER_PRIVACY_MODE` como variable de entorno en `claude_desktop_config.json`. Cuando esté activado, todas las respuestas de herramientas solo devuelven metadatos — ningún texto de transcripción incluido en ninguna respuesta.

### Gateway de consentimiento para contenido de transcripción
Cuando `WHISPER_PRIVACY_MODE` no está activado (predeterminado), cualquier respuesta de herramienta que incluya texto de transcripción debe estar precedida de una divulgación en el primer uso por sesión.

### Documentación `PRIVACY.md`
Crear `PRIVACY.md` en la raíz del repositorio con orientación completa de privacidad y marcos de cumplimiento.

### Limpieza automática del directorio temporal
Añadir limpieza automática de archivos de tareas completadas tras un período de retención configurable (predeterminado: 7 días).

---

## Planificado — Migración a Bun

Migrar el runtime de Node.js a [Bun](https://bun.sh) tras la conclusión de la arquitectura de privacidad y antes de las adiciones de funcionalidades del v2.3.0. El Bun ejecuta TypeScript nativamente sin paso de compilación, inicia significativamente más rápido que Node y tiene E/S más rápida.

---

## Planificado — Revisión de licencia (tras la migración a Bun)

La licencia MIT actual permite uso comercial irrestrito. Se planifica una licencia dual: MIT para uso personal y no comercial, licencia comercial separada para uso empresarial y corporativo.

---

## Planificado — v2.3.0: Expansión de formatos de salida

### Formato de subtítulos VTT
Salida WebVTT (`.vtt`) junto con SRT. Estándar web usado por YouTube, HTML5 `<video>` y la mayoría de los reproductores modernos.

### Formato LRC
Salida en formato LRC (`.lrc`) de letras/karaoke via `-olrc`.

### Formato CSV
Salida CSV (`.csv`) via `-ocsv`. Datos tabulares estructurados con timing de segmentos.

---

## Planificado — Releases futuros

### TinyDiarize
Soporte al flag `--tinydiarize` con variantes de modelo que soportan `tdrz`. Funciona en grabaciones mono a diferencia del flag `--diarize` estéreo.

### Transcripción de URL de YouTube
Transcripción directa desde URLs de YouTube via yt-dlp. Requiere yt-dlp instalado y en el PATH.

### Herramientas de flujo de trabajo de proyecto de video
Para usuarios que gestionan proyectos grandes de edición de video con directorios de clips fuente y editados. Los archivos fuente nunca son renombrados ni modificados sin confirmación explícita del usuario.

### Diarización de hablantes (pyannote-audio)
Diarización de hablantes mono completa con etiquetas de ID de hablante. Requiere pyannote-audio — biblioteca basada en Python con requisito de token de acceso a modelos de Hugging Face.

### Traducción a idiomas que no sean inglés
El flag `--translate` de Whisper solo apunta al inglés. Soportar idiomas de destino arbitrarios requiere una API de traducción externa o modelo de traducción local.

### Limpieza y formateo de transcripciones
Pipeline de post-procesamiento: eliminación de muletillas, saltos de párrafo en límites de temas naturales, formateo con conciencia de hablante, exportación a PDF o DOCX.

---

## Distribución

Disponible en [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org) y [Glama](https://glama.ai).

---

## Documentación multilingüe

La documentación en japonés, coreano, vietnamita, indonesio, ucraniano, portugués brasileño y español se mantiene en paralelo con el inglés. Los siguientes archivos deben ser actualizados para coincidir con los documentos en inglés tras cada release:

**Japonés (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Coreano (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Vietnamita (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Indonesio (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Ucraniano (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Portugués Brasileño (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Español (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

**Polish (`*.pl.md`)** — `README.pl.md` / `TROUBLESHOOTING.pl.md` / `ROADMAP.pl.md` / `PRIVACY.pl.md` / `SECURITY.pl.md`

**Romanian (`*.ro.md`)** — `README.ro.md` / `TROUBLESHOOTING.ro.md` / `ROADMAP.ro.md` / `PRIVACY.ro.md` / `SECURITY.ro.md`

Las contribuciones de la comunidad para otros idiomas son bienvenidas.

---

## Contribuciones

Los pull requests son bienvenidos. Revisa las issues existentes antes de comenzar a trabajar.

Si has probado la aceleración por GPU en hardware no listado arriba, abre una issue con el modelo de GPU, VRAM, tamaño de modelo y throughput observado.
