# whisper-windows-mcp — Hoja de Ruta

Versión actual: **v2.4.0**

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

**SRT en modo en segundo plano:** `spawnDetached` anteriormente codificaba de forma rígida `-otxt` independientemente del formato solicitado. Corregido añadiendo parámetro `outputFormat` a `spawnDetached`, soportando salida `text` y `srt` en modo en segundo plano.

### ✅ v2.0.1 — Correcciones de bugs (incluido en v2.2.0)
- `--max-context 0` fijo en `buildArgs` y `spawnDetached` — previene bucles de alucinación en audio largo.
- `--no-speech-thold 0.6` fijo en ambas funciones — segmentos por debajo del umbral de confianza son tratados como silencio en lugar de contenido alucinado.
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

### ✅ v2.2.0 — Expansión de calidad, parámetros y hardware
- Interfaz `WhisperOptions` reemplazando argumentos posicionales en `buildArgs`.
- Nuevos parámetros en `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Nuevos parámetros en `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` refactorizado — todos los flags de calidad ahora se aplican en modo en segundo plano/lote.
- Salida de lote corregida — `readBatchProgress` ahora mueve la salida temporal al destino final antes de validar.

**Nota de compatibilidad de flags:** `gpu_device` / `--device` fue añadido en whisper.cpp v1.8.4. Los binarios Vulkan precompilados en los releases son de la generación v1.8.3 — este parámetro es aceptado por la herramienta pero no tendrá efecto hasta que el usuario actualice a binarios v1.8.4+.

### ✅ v2.2.2 — Parche
- Corrección de licencia dual — revisión de LICENSE y LICENSE-COMMERCIAL.md.
- Correcciones menores de documentación.

### ✅ v2.3.0 — Avance automático de lote, arquitectura de privacidad, expansión de formatos de salida

**Avance automático de lote (corrección de bug crítico):** `start_batch` antes requería polling activo para avanzar la cola. Ahora cada proceso hijo whisper-cli creado tiene un handler `on('exit')` adjunto. Cuando el proceso termina, el lote avanza inmediatamente de forma autónoma a través del callback de salida — sin coste de polling ni llamadas a la API. Un mutex previene la creación doble entre el handler de salida y llamadas simultáneas a `check_batch_progress`.

**Arquitectura de privacidad:**
- Variable de entorno `WHISPER_PRIVACY_MODE` — cuando se establece en `true`, todas las respuestas de herramientas devuelven solo metadatos (nombre de archivo, conteo de palabras, ruta de guardado). Ningún texto de transcripción es enviado a la API de Claude. Las transcripciones existen solo como archivos locales.
- Variable de entorno `WHISPER_CONSENT_ACKNOWLEDGED` — cuando se establece en `true`, omite la puerta de consentimiento única por sesión para contenido no sensible.
- Parámetro `privacy_mode` por llamada en `transcribe_audio`, `transcribe_batch`, `start_batch`, `check_progress`. Anula la variable de entorno global en ambas direcciones. No requiere reinicio para activar/desactivar.
- Puerta de modo de privacidad (`checkPrivacyGate()`) — se ejecuta antes de cada operación cuando el modo de privacidad efectivo está activo. Primera llamada activa (muestra divulgación), segunda llamada libera (permite). Se reinicia tras cada operación. Completamente independiente de la puerta de consentimiento de sesión.
- Puerta de consentimiento de sesión (`transcriptPolicy()`) — se ejecuta una vez por sesión antes de la primera llamada que devuelva transcripción en modo estándar. Consumida por el flag `sessionConsentGiven`.
- `PRIVACY.md` — documentación de cumplimiento completa que cubre HIPAA, GDPR, privilegio abogado-cliente, FERPA, SOX, PCI-DSS, NDA/secreto comercial.
- Avisos de privacidad en las descripciones de herramientas de todas las herramientas que devuelven texto de transcripción.

**Expansión de formatos de salida:**
- `vtt` — salida de subtítulos WebVTT via `-ovtt`. Disponible en `transcribe_audio`, `generate_subtitles`, `start_batch` y modo en segundo plano.
- `lrc` — formato de letras/karaoke LRC via `-olrc`. Disponible en `transcribe_audio` y modo en segundo plano.
- `csv` — CSV con marcas de tiempo via `-ocsv`. Disponible en `transcribe_audio` y modo en segundo plano.
- El valor predeterminado de `output_format` cambia de `"text"` a `"timestamps"` en todas las herramientas y rutas de código. El texto plano ahora es opcional.

**Correcciones de bugs:**
- Bug 1: `output_format` no era pasado a las tareas en segundo plano — se usaba `"text"` predeterminado independientemente del formato solicitado. Corregido cambiando el predeterminado a `"timestamps"` y pasándolo correctamente.
- Bug 2: `catch {}` silencioso en la operación de movimiento de salida de tarea en segundo plano tragaba fallos. Añadida verificación `existsSync` explícita después del movimiento con mensaje de fallo detallado.
- Bug 3: Añadido comentario de diseño en el punto de creación en segundo plano explicando por qué la puerta de consentimiento es diferida intencionalmente a `check_progress` para tareas en segundo plano no privadas.

**Adiciones:**
- Limpieza automática del directorio temporal — `cleanupOldJobFiles()` se ejecuta al arrancar y elimina archivos `.json` y `.log` con más de 7 días de antigüedad en `%TEMP%\whisper-mcp-jobs\`.
- `check_config` ahora reporta el estado del modo de privacidad.
- El log de arranque reporta modo de privacidad activado/desactivado.
- Campo `privacyMode: boolean` añadido a la interfaz `Job`.
- Campo `privacyMode: boolean` añadido a la interfaz `BatchState`.
- El tipo `BackgroundFormat` excluye `json` (json en modo en segundo plano no está soportado — cae de vuelta a `text`).

### ✅ v2.4.0 — Fortalecimiento, guarda de tiempo de espera en primer plano, conjunto de pruebas y CI

Una pasada de seguridad/robustez; la migración a Bun planificada se trasladó a v2.5.0.

**Seguridad y corrección:**
- Corrección de contención de rutas en `switch_model` — un directorio con prefijo hermano (p. ej. `…\models-evil`) antes podía satisfacer la comprobación de "dentro del directorio de modelos" mediante un `startsWith` ingenuo; reemplazado por contención normalizada basada en `relative()`. Cierra la fuga que describe SECURITY.md.
- Barrera de privacidad/consentimiento vinculada **por operación** (herramienta + argumentos) — confirmar una transcripción ya no puede satisfacer la barrera de una operación diferente.
- `download_model` rechaza descargas truncadas (comprobación de Content-Length) antes de promover un archivo `.part`. (La verificación completa del resumen SHA256 queda pendiente para una pasada posterior.)
- Coerción de entrada — los parámetros numéricos de herramientas que no son números reales se descartan en lugar de entregarse a whisper-cli como `NaN`.

**Robustez:**
- **Guarda de tiempo de espera en primer plano** — un archivo lo bastante largo como para superar el tiempo de espera de herramienta MCP de ~4 minutos de Claude Desktop en modo bloqueante se detecta de antemano y se enruta a segundo plano en lugar de agotar el tiempo silenciosamente. Umbral configurable mediante `WHISPER_FOREGROUND_MAX_SEC`. Estimaciones de tiempo corregidas (la antigua estimación de GPU subestimaba notablemente; ahora se modela el coste dominante de recarga del modelo — medido, no adivinado).
- Escrituras atómicas del estado de trabajos/lotes (archivo temporal + renombrado) para que un lector concurrente no pueda observar un archivo JSON a medio escribir.
- IDs de trabajo/lote/temporales a prueba de colisiones (con sufijo UUID).
- Apagado controlado ante SIGINT/SIGTERM que limpia los archivos temporales del modo bloqueante.

**Selección de dispositivo GPU:**
- Variable de entorno `WHISPER_GPU_DEVICE`, y `gpu_device` ahora propagado a través de `generate_subtitles` y la pasada de detección de idioma (antes solo `transcribe_audio`). `check_config` informa el dispositivo activo. `check_system` ya no informa erróneamente un problema de controlador cuando `wmic` (obsoleto en Windows 11 24H2+) no devuelve nada.

**Calidad:**
- Un conjunto de pruebas unitarias con `node:test` sobre la lógica pura (contención de rutas, clave de barrera, escrituras atómicas, coerción de entrada, la estimación de tiempo de espera), cero dependencias añadidas, además de un flujo de trabajo de CI de GitHub Actions que lo ejecuta en cada push/PR.

**Identificado para una versión futura:** una ruta de modelo persistente (p. ej. `whisper-server` de whisper.cpp) para eliminar el coste de recarga del modelo que se paga en cada transcripción — una gran mejora de rendimiento para trabajo por lotes/de archivo.

---

## Planificado — v2.5.0: Migración a Bun

Migrar el runtime de Node.js a [Bun](https://bun.sh).

Claude Desktop crea un nuevo servidor MCP en cada inicio de sesión, por lo que el tiempo de arranque está en la ruta crítica. Bun ejecuta TypeScript de forma nativa sin paso de compilación, arranca significativamente más rápido que Node y tiene E/S más rápida.

**Qué cambia:**
- Paso de compilación `tsc` y directorio `dist/` eliminados
- Los usuarios ejecutan el código fuente TypeScript directamente
- `tsconfig.json` se vuelve opcional
- Scripts de `package.json` actualizados
- Flujo de publicación en npm actualizado

**Qué no cambia:**
- Código fuente `src/index.ts` — Bun es compatible con el TypeScript existente y las APIs integradas de Node.js
- Todos los comportamientos de herramientas y formatos de salida
- Configuración de Claude Desktop para usuarios finales

---

## Planificado — v2.6.0: Formatos de salida mejorados para integración con herramientas externas

Soporte ampliado de formatos de salida orientado a flujos de trabajo de análisis e integración downstream. El alcance exacto se definirá basándose en los comentarios de usuarios tras v2.3.0.

---

## Planificado — v2.7.0: Modo de transcripción de micrófono en vivo

Transcripción en tiempo real desde entrada de micrófono en vivo. Transmite audio en fragmentos desde el dispositivo de grabación seleccionado a whisper, devolviendo segmentos de transcripción completados de forma continua.

**Restricciones de diseño:**
- La selección del dispositivo debe ser explícita — sin captura silenciosa del micrófono predeterminado
- El usuario debe poder detener el stream a través de la interacción con Claude Desktop
- No debe violar la restricción de una única instancia de whisper a la vez
- La compensación entre latencia y precisión debe ser configurable por el usuario

**Estado:** Fase de diseño. Depende de una API de streaming estable de whisper.cpp.

---

## Planificado — Releases futuros

### TinyDiarize
Soporte al flag `--tinydiarize` con variantes de modelo que soportan `tdrz` (ej.: `large-v2-tdrz`). A diferencia del flag `--diarize` estéreo, TinyDiarize funciona en grabaciones mono. Requiere descarga de variante de modelo especial. Menor precisión que la diarización basada en pyannote pero sin dependencias adicionales fuera del archivo de modelo.

**Estado:** Planificado. Depende de que `download_model` soporte variantes de modelo tdrz.

### Transcripción de URL de YouTube
Transcripción directa desde URLs de YouTube via yt-dlp. Descarga de audio y transcripción en un solo paso. Requiere yt-dlp instalado y en el PATH.

**Restricciones de diseño:** yt-dlp es opcional. La herramienta debe degradarse de forma elegante con instrucciones claras de instalación si no se encuentra. Sin cambios en la funcionalidad principal para usuarios que no lo necesiten.

### Herramientas de flujo de trabajo de proyecto de video
Para usuarios que gestionan proyectos grandes de edición de video con directorios de clips fuente y editados:

1. Escanear directorio fuente y subdirectorios de clips
2. Coincidencia aproximada de transcripciones de clips editados con transcripciones fuente para encontrar el punto de origen
3. Mostrar nombres de archivo descriptivos sugeridos por Claude basados en el contenido de la transcripción, requiriendo confirmación explícita del usuario antes de ejecutar cualquier renombrado
4. Búsqueda de transcripciones en el directorio del proyecto con resultados de timecode

**Restricciones de diseño:**
- Los archivos fuente **nunca son renombrados ni modificados**
- Todos los renombrados requieren **confirmación explícita del usuario**
- La búsqueda es una herramienta independiente, utilizable de forma autónoma
- El análisis y la coincidencia ocurren localmente — Claude solo es llamado cuando el usuario revisa los resultados, minimizando llamadas a la API

**Estado:** Fase de diseño.

### Diarización de hablantes (pyannote-audio)
Diarización de hablantes mono completa con etiquetas de ID de hablante — marca transiciones de hablante a lo largo de toda la grabación independientemente de la configuración de canales. Diferente del flag `--diarize` estéreo integrado (v2.2.0) y TinyDiarize.

**Implementación:** Requiere [pyannote-audio](https://github.com/pyannote/pyannote-audio) — biblioteca basada en Python con requisito de token de acceso a modelos de Hugging Face. Stack de dependencias completamente separado.

**Estado:** Planificado como funcionalidad avanzada opcional con documentación de configuración propia. No incluido en el paquete principal.

### Traducción a idiomas que no sean inglés
El flag `--translate` de Whisper solo apunta al inglés. Soportar idiomas de destino arbitrarios requiere una API de traducción externa o modelo de traducción local.

**Opciones bajo consideración:** LibreTranslate (puede ser autoalojado, prioridad local), traducción LLM local, o documentación explícita como fuera de alcance.

**Estado:** Aplazado pendiente de decisión de diseño sobre local primero vs. dependencia de API.

### Limpieza y formateo de transcripciones
Pipeline de post-procesamiento:
- Eliminación de muletillas y titubeos (opcional, controlado por el usuario)
- Saltos de párrafo en límites de temas naturales
- Formateo con conciencia de hablante combinado con salida de diarización
- Exportación a PDF o DOCX

**Estado:** Planificado. La variante con conciencia de hablante depende de la diarización de hablantes.

---

## Licenciamiento

whisper-windows-mcp usa licencia dual.

**Uso no comercial:** MIT — gratuito para uso personal, educativo y no comercial. Ver [LICENSE](LICENSE).

**Uso comercial:** Se requiere un acuerdo de licencia comercial separado para cualquier uso empresarial, profesional o que genere ingresos. Ver [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

---

## Distribución

Disponible en [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), [Glama](https://glama.ai) y [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) (PR enviado).

---

## Documentación multilingüe

Los siguientes archivos deben ser actualizados para coincidir con los documentos en inglés tras cada release:

**Japonés (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Coreano (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Vietnamita (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Indonesio (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Ucraniano (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Portugués Brasileño (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Español (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

**Polaco (`*.pl.md`)** — `README.pl.md` / `TROUBLESHOOTING.pl.md` / `ROADMAP.pl.md` / `PRIVACY.pl.md` / `SECURITY.pl.md`

**Rumano (`*.ro.md`)** — `README.ro.md` / `TROUBLESHOOTING.ro.md` / `ROADMAP.ro.md` / `PRIVACY.ro.md` / `SECURITY.ro.md`

Las contribuciones de la comunidad para otros idiomas son bienvenidas.

---

## Contribuciones

Los pull requests son bienvenidos. Revisa las issues existentes antes de comenzar a trabajar.

Si has probado la aceleración por GPU en hardware no listado arriba, abre una issue con el modelo de GPU, VRAM, tamaño de modelo y throughput observado. Esto ayuda a construir una referencia de rendimiento precisa para otros usuarios.
