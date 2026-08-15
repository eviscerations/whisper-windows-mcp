# whisper-windows-mcp — Hoja de Ruta

Versión actual: **v2.5.0**

---

## Principios de diseño

Estos principios rigen cada decisión de este proyecto y tienen prioridad sobre la velocidad de adición de funcionalidades.

**Minimizar el uso de la API de Claude.** Todo el flujo de trabajo de transcripción — escaneo, análisis, encolado, ejecución, validación, cambio de modelos — debe poder ejecutarse con la menor cantidad posible de interacciones con Claude. Esta herramienta debe ser plenamente funcional para los usuarios de Claude del plan gratuito que no pagan una suscripción Pro o Max. Cada llamada a una herramienta consume presupuesto de uso. Diseña en consecuencia.

**Una única instancia de whisper en todo momento.** Nunca crees un segundo proceso whisper-cli.exe mientras haya uno en ejecución. El bloqueo de proceso es obligatorio e innegociable.

**Local primero, privado por defecto.** El audio nunca sale de la máquina. No se requiere ninguna API de nube para la funcionalidad principal. Las integraciones opcionales (por ejemplo, las descargas de modelos de Hugging Face) deben documentarse claramente como opcionales.

**Control explícito del usuario.** Sin operaciones masivas silenciosas. Las acciones destructivas o irreversibles requieren confirmación. El usuario siempre debe saber qué va a ocurrir antes de que ocurra.

**Rutas seguras para Unicode.** Toda la E/S de archivos debe manejar correctamente los nombres de archivo no-ASCII, incluidos japonés, chino, emoji, corchetes y otros caracteres especiales.

**Modular y combinable.** Las herramientas son independientes. Los usuarios usan lo que necesitan. Ninguna funcionalidad debe requerir otra para funcionar, a menos que sea inevitable.

**Optimización antes que funcionalidades.** Ante la duda entre agregar una funcionalidad y reducir la carga del sistema o el número de llamadas a la API, reduce la carga. Las pasadas intensivas de optimización son costosas. Acierta con la arquitectura desde el primer momento.

---

## Completado

### ✅ v1.3.1 — Bloqueo de proceso
Añadida la verificación `isWhisperRunning()` mediante `tasklist /FI` antes de crear cualquier proceso de transcripción. Devuelve un error claro con instrucciones del Administrador de Tareas en lugar de crear un proceso concurrente.

### ✅ v1.4.0 — Aceleración GPU con Vulkan
Compilado whisper.cpp desde el código fuente con `-DGGML_VULKAN=ON` usando VS Build Tools 2022 y el Vulkan SDK. Binarios Vulkan precompilados distribuidos como `whisper-vulkan-win-x64.zip`.

**Resultados en una AMD Radeon RX Vega 56:** utilización media de GPU de ~16%. Un archivo de 58 minutos se completa en ~4,5 minutos en GPU frente a ~88 minutos solo con CPU.

### ✅ v1.5.0 — Diagnóstico del sistema
Herramienta `check_system`: detección de GPU mediante `wmic`, verificación de las DLL de Vulkan, reporte de VRAM y recomendación de tamaño de modelo.

### ✅ v1.6.0 — Pre-análisis de archivos
Herramienta `analyze_media` mediante FFprobe: duración, tamaño, códec, estado de transcripción y estimaciones de tiempo en CPU y GPU. Escaneo de un solo archivo o de una carpeta con opciones de ordenación.

### ✅ v1.7.0 — Transcripción en segundo plano + Visibilidad del progreso
Arquitectura de proceso desacoplado: `transcribe_audio` con `background=true` crea whisper como proceso desacoplado y devuelve de inmediato un ID de trabajo. `check_progress` analiza las marcas de tiempo de segmento del stderr de whisper para obtener el porcentaje y el ETA en tiempo real.

### ✅ v1.8.0 — Lote secuencial con validación
`start_batch` y `check_batch_progress`: procesamiento secuencial automatizado, validación de la transcripción (detección de salida vacía o corta), avance automático de la cola y marcas de tiempo de progreso por archivo.

### ✅ v1.9.0 — Soporte multilingüe y traducción
`generate_subtitles` con detección `language=auto` y salida SRT doble mediante `translate_to_english=true`. Añadido soporte para los formatos `.3gp` y `.ts`. `language=auto` también disponible en `transcribe_audio`.

**Limitación conocida:** la traducción integrada de Whisper solo apunta al inglés. Requiere el modelo `large-v3` para idiomas distintos del inglés — los modelos solo en inglés (`*.en.bin`) producen `[FOREIGN]` con audio que no está en inglés.

### ✅ v2.0.0 — Rutas seguras para Unicode + SRT en segundo plano
**Nombres de archivo Unicode:** los archivos con caracteres no-ASCII en el nombre provocaban que la transcripción en segundo plano fallara silenciosamente. Corregido enrutando toda la salida a través de una ruta temporal saneada basada en el ID de trabajo y moviendo después el resultado al destino correcto una vez completado.

**SRT en modo en segundo plano:** `spawnDetached` codificaba antes de forma rígida `-otxt` sin importar el formato solicitado. Corregido añadiendo un parámetro `outputFormat` a `spawnDetached`, con soporte de salida `text` y `srt` en modo en segundo plano.

### ✅ v2.0.1 — Correcciones de errores (incluidas en v2.2.0)
- `--max-context 0` fijado tanto en `buildArgs` como en `spawnDetached` — previene los bucles de alucinación en audio de larga duración.
- `--no-speech-thold 0.6` fijado en ambas funciones — los segmentos por debajo del umbral de confianza se tratan como silencio en lugar de como contenido alucinado.
- Validación de rutas (`validateInputPath`) — rechaza rutas UNC y el recorrido `..`.
- Guarda de tamaño de archivo `MAX_FILE_SIZE_MB = 10240`.
- Comentario de seguridad sobre inyección de transcripción en `transcribeSingle`.
- Comando CLI de lote roto corregido en TROUBLESHOOTING.md.

### ✅ v2.1.0 — Suite de gestión de modelos (incluida en v2.2.0)
- `WHISPER_MODEL` cambiado de `const` a `let` (mutable dentro de la sesión).
- `MODEL_REGISTRY` — 16 modelos, variantes de precisión completa y cuantizadas, URLs de descarga de Hugging Face.
- `ALLOWED_HF_PREFIXES` — lista de permitidos de URL que restringe las descargas a los espacios de nombres `ggerganov/whisper.cpp` y `ggml-org`.
- Herramienta `list_models` — escanea el directorio de modelos y muestra el modelo activo, los tamaños, los casos de uso y las descargas disponibles.
- Herramienta `download_model` — descarga desde Hugging Face mediante el módulo `https` integrado de Node.js, con renombrado atómico.
- Herramienta `switch_model` — valida la extensión `.bin`, la restricción de directorio y la verificación del bloqueo de proceso.
- `recommendedModel()` actualizado para recomendar `large-v3-turbo` con 6GB o más de VRAM.

### ✅ v2.2.0 — Expansión de calidad, parámetros y hardware
- Interfaz `WhisperOptions` que reemplaza los argumentos posicionales en `buildArgs`.
- Nuevos parámetros en `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Nuevos parámetros en `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` refactorizado — todos los flags de calidad se aplican en el modo en segundo plano/por lotes.
- Salida de lote corregida — `readBatchProgress` ahora mueve la salida temporal al destino final antes de validar.

**Nota de compatibilidad de flags:** `gpu_device` / `--device` se añadió en whisper.cpp v1.8.4. El binario Vulkan precompilado de los releases es de la generación v1.8.3 — este parámetro es aceptado por la herramienta, pero no tendrá efecto hasta que el usuario actualice a un binario v1.8.4+.

### ✅ v2.2.2 — Parche
- Corrección de la licencia dual — LICENSE y LICENSE-COMMERCIAL.md corregidos.
- Correcciones menores de documentación.

### ✅ v2.3.0 — Avance automático de lote, arquitectura de privacidad, expansión de formatos de salida

**Avance automático de lote (corrección de error crítico):** `start_batch` requería antes un sondeo activo para avanzar por la cola. Ahora se adjunta un handler `on('exit')` a cada proceso hijo whisper-cli creado. Cuando el proceso finaliza, el lote avanza de inmediato por sí mismo a través del callback de salida, sin coste de sondeo y sin consumir llamadas a la API. Un mutex previene la doble creación entre el handler de salida concurrente y las llamadas a `check_batch_progress`.

**Arquitectura de privacidad:**
- Variable de entorno `WHISPER_PRIVACY_MODE` — cuando es `true`, todas las respuestas de las herramientas devuelven solo metadatos (nombre de archivo, conteo de palabras, ruta de guardado). Ningún texto de transcripción se transmite jamás a la API de Claude. Las transcripciones existen únicamente como archivos locales.
- Variable de entorno `WHISPER_CONSENT_ACKNOWLEDGED` — cuando es `true`, suprime la puerta de consentimiento única por sesión para el contenido no sensible.
- Parámetro `privacy_mode` por llamada en `transcribe_audio`, `transcribe_batch`, `start_batch` y `check_progress`. Anula la variable de entorno global en cualquiera de los dos sentidos. No requiere reinicio para alternarlo por llamada.
- Puerta de modo de privacidad (`checkPrivacyGate()`) — se dispara antes de cada operación cuando el modo de privacidad efectivo está activo. Se arma en la primera llamada (muestra la divulgación) y se libera en la segunda (permite). Se reinicia tras cada operación. Es completamente independiente de la puerta de consentimiento de sesión.
- Puerta de consentimiento de sesión (`transcriptPolicy()`) — se dispara una vez por sesión antes de la primera llamada que devuelve transcripción en modo estándar. La consume el flag `sessionConsentGiven`.
- `PRIVACY.md` — documentación de cumplimiento completa que cubre HIPAA, GDPR, privilegio abogado-cliente, FERPA, SOX, PCI-DSS y NDA/secreto comercial.
- Avisos de privacidad en la descripción de todas las herramientas que devuelven transcripción.

**Expansión de formatos de salida:**
- `vtt` — salida de subtítulos WebVTT mediante `-ovtt`. Disponible en `transcribe_audio`, `generate_subtitles`, `start_batch` y el modo en segundo plano.
- `lrc` — formato de letras/karaoke LRC mediante `-olrc`. Disponible en `transcribe_audio` y el modo en segundo plano.
- `csv` — CSV con marcas de tiempo mediante `-ocsv`. Disponible en `transcribe_audio` y el modo en segundo plano.
- El valor por defecto de `output_format` cambió de `"text"` a `"timestamps"` en todas las herramientas y rutas de código. El texto plano ahora es opcional.

**Correcciones de errores:**
- Error 1: `output_format` no se reenviaba a los trabajos en segundo plano — se usaba el valor por defecto `"text"` sin importar el formato solicitado. Corregido cambiando el valor por defecto a `"timestamps"` y reenviándolo correctamente.
- Error 2: un `catch {}` silencioso en la operación de movimiento de la salida del trabajo en segundo plano se tragaba los fallos. Añadida una verificación explícita con `existsSync`, con un mensaje de fallo detallado, tras el movimiento.
- Error 3: añadido un comentario de diseño en el punto de creación en segundo plano que documenta por qué la puerta de consentimiento se difiere intencionadamente a `check_progress` para los trabajos en segundo plano no privados.

**Adicional:**
- Limpieza automática del directorio temporal — `cleanupOldJobFiles()` se ejecuta al arrancar y elimina los archivos `.json` y `.log` con más de 7 días de antigüedad de `%TEMP%\whisper-mcp-jobs\`.
- `check_config` ahora reporta el estado del modo de privacidad.
- El log de arranque reporta si el modo de privacidad está activado o desactivado.
- La interfaz `Job` se amplía con el campo `privacyMode: boolean`.
- La interfaz `BatchState` se amplía con el campo `privacyMode: boolean`.
- El tipo `BackgroundFormat` excluye `json` (json en modo en segundo plano sigue sin estar soportado — recurre a `text`).

### ✅ v2.4.0 — Fortalecimiento, guarda de primer plano, suite de pruebas y CI

Una pasada de seguridad/robustez; la migración a Bun planificada se trasladó a v2.5.0.

**Seguridad y corrección:**
- Corrección de contención de rutas en `switch_model` — un directorio con prefijo hermano (por ejemplo, `…\models-evil`) podía antes satisfacer la comprobación de "dentro del directorio de modelos" mediante un `startsWith` ingenuo; reemplazado por una contención normalizada basada en `relative()`. Cierra la fuga que describe SECURITY.md.
- Puerta de privacidad/consentimiento vinculada **por operación** (herramienta + argumentos) — confirmar una transcripción ya no puede satisfacer la puerta de otra operación distinta.
- `download_model` rechaza las descargas truncadas (comprobación de Content-Length) antes de promover un archivo `.part`. (La verificación completa del hash SHA256 queda registrada para una pasada posterior.)
- Coerción de entrada — los parámetros numéricos de las herramientas que no son números reales se descartan en lugar de entregarse a whisper-cli como `NaN`.

**Robustez:**
- **Guarda de tiempo de espera en primer plano** — un archivo lo bastante largo como para superar el tiempo de espera de herramienta MCP de ~4 minutos de Claude Desktop en modo bloqueante se detecta de antemano y se enruta a segundo plano en lugar de agotar el tiempo silenciosamente. Umbral configurable mediante `WHISPER_FOREGROUND_MAX_SEC`. Estimaciones de tiempo corregidas (la antigua estimación de GPU subestimaba gravemente; ahora se modela el coste dominante de recarga del modelo — medido, no adivinado).
- Escrituras atómicas del estado de trabajos/lotes (archivo temporal + renombrado) para que un lector concurrente no pueda observar un archivo JSON a medio escribir.
- IDs de trabajo/lote/temporales a prueba de colisiones (con sufijo UUID).
- Apagado controlado ante SIGINT/SIGTERM que limpia los archivos temporales del modo bloqueante.

**Selección de dispositivo GPU:**
- Variable de entorno `WHISPER_GPU_DEVICE`, y `gpu_device` ahora propagado a través de `generate_subtitles` y la pasada de detección de idioma (antes solo en `transcribe_audio`). `check_config` reporta el dispositivo activo. `check_system` ya no reporta erróneamente un problema de controlador cuando `wmic` (obsoleto en Windows 11 24H2+) no devuelve nada.

**Calidad:**
- Una suite de pruebas unitarias con `node:test` sobre la lógica pura (contención de rutas, clave de las puertas, escrituras atómicas, coerción de entrada y la estimación de tiempo de espera), con cero dependencias añadidas, más un flujo de trabajo de CI de GitHub Actions que la ejecuta en cada push/PR.

**Identificado para una versión futura:** una ruta de modelo persistente (por ejemplo, el `whisper-server` de whisper.cpp) para eliminar el coste de recarga del modelo que se paga en cada transcripción — una gran mejora de rendimiento para el trabajo por lotes/de archivo.

### ✅ v2.5.0 — Servidor de modelo persistente + TinyDiarize

**Servidor de modelo persistente (Fase 1).** whisper-cli es de un solo uso: recarga el modelo completo en cada llamada — v2.4.0 midió esa recarga en ~110 s en una GPU con memoria limitada, un impuesto fijo por archivo que domina el tiempo total de ejecución en el trabajo por lotes/de archivo. v2.5.0 añade un modo opcional de modelo residente que mantiene el modelo en memoria entre transcripciones.
- Herramienta `whisper_server` (`start` / `stop` / `status`). El servidor residente *se convierte* en la única instancia, preservando la regla de una única instancia de whisper: las solicitudes se serializan contra él, sin introducir concurrencia.
- Los `transcribe_audio` y `transcribe_batch` bloqueantes se enrutan a través del servidor residente por localhost (`127.0.0.1`) mediante `POST /inference`, evitando el coste de recarga. La guarda de tiempo de espera en primer plano se omite en modo servidor (no hay recarga que pagar).
- `switch_model` intercambia en caliente el modelo residente mediante `POST /load` sin reinicio. `check_config` reporta el estado del servidor; el servidor propio se termina al apagar para liberar la VRAM.
- La regla de un solo motor / VRAM compartida se impone con un respaldo estricto en la ruta de creación desacoplada, más rechazos amistosos: mientras el servidor está activo, los trabajos en segundo plano, `start_batch`, `generate_subtitles`, la salida `lrc`/`csv` y las opciones por solicitud que la API HTTP no respeta (`beam_size`, `best_of`, `word_timestamps`, `diarize`, `tinydiarize`, `vad_model`, `offset_t`, `duration`, etc.) se rechazan con un mensaje de "detén el servidor primero" en lugar de degradarse silenciosamente.
- Configuración: `WHISPER_SERVER_PATH`, `WHISPER_SERVER_PORT` (por defecto 8571, solo localhost).

**Restricciones de diseño:**
- Ciclo de vida explícito: start / stop / status, con una verificación de salud. El servidor nunca se inicia silenciosamente como efecto secundario de una llamada no relacionada.
- Vincular solo a localhost — nunca a una interfaz enrutable. Sin exposición de red (coherente con el principio de local primero y con el fortalecimiento de v2.4.0).
- Reserva elegante: si el servidor no está en ejecución, la transcripción sigue funcionando a través de la ruta existente de whisper-cli de un solo uso. El servidor es una optimización, no una dependencia obligatoria.
- `switch_model` recarga el modelo en el servidor residente (aún mucho más barato amortizado que recargar por archivo).
- Las puertas de privacidad y consentimiento no cambian — se sitúan por encima del mecanismo de transcripción.
- Selección de puerto con manejo de colisiones; apagado limpio ante SIGINT/SIGTERM junto con la limpieza existente de archivos temporales.

**TinyDiarize.** Soporte de `--tinydiarize` con modelos habilitados para `tdrz`. A diferencia del flag `--diarize` estéreo (v2.2.0), TinyDiarize marca los turnos de hablante en grabaciones **mono** y no necesita nada más allá del archivo de modelo — ni Python, ni servicio externo.
- Parámetro `tinydiarize` en `transcribe_audio` y `generate_subtitles` (modos bloqueante y en segundo plano); `--tinydiarize` propagado a través de ambos constructores de argumentos.
- `small.en-tdrz` añadido a `MODEL_REGISTRY` para que `download_model` pueda obtenerlo de los espacios de nombres de confianza existentes de Hugging Face.

---

## Planificado — v2.6.0: Servidor de modelo persistente — Fase 2

Enrutar los trabajos en segundo plano y `start_batch` a través del servidor residente. La Fase 1 (v2.5.0) cubre solo la transcripción bloqueante; esta es la mayor mejora de archivo/rendimiento, y requiere rehacer la capa de trabajos/cola en torno a solicitudes HTTP en lugar de PIDs desacoplados — seguimiento del progreso sin un PID, y cancelación basada en HTTP.

Las **restricciones de diseño** del servidor residente establecidas en v2.5.0 siguen rigiendo la Fase 2 — vinculación solo a localhost, ciclo de vida explícito, reserva elegante de un solo uso y puertas de privacidad/consentimiento sin cambios. La Fase 2 añade el enrutamiento de trabajos/cola sin relajar ninguna de ellas.

**Estado:** Planificado.

---

## Planificado — v2.7.0: Búsqueda de transcripciones en todo el proyecto

Una herramienta independiente para buscar una frase o un patrón en cada transcripción de un directorio de proyecto y devolver las coincidencias con su archivo de origen y su timecode. Descompuesta del flujo de trabajo mayor de proyecto de video (ver "Más adelante / En consideración") — esta mitad es útil de forma independiente, de bajo riesgo y ligera en API: la búsqueda se ejecuta localmente, y Claude solo interviene cuando el usuario revisa los resultados.

**Estado:** Planificado.

---

## Planificado — v2.8.0: Salida importable en editores y formatos de integración

Convertir las transcripciones en artefactos que un editor de video importa directamente, de modo que la transcripción alimente la edición en lugar de detenerse en un archivo de texto — la motivación central del proyecto: hacer manejable un gran archivo de metraje en bruto para un creador en solitario.

- **CSV de marcadores primero** — los inicios de segmento como un CSV de marcadores/capítulos que Premiere, Resolve y YouTube importan de forma nativa. Aporta la mayor parte del valor de "meterlo en mi editor" a una fracción del coste y la fragilidad entre versiones de un formato de línea de tiempo completo.
- **Datos de tiempo a nivel de palabra** — exponer el JSON de tokens completos de whisper.cpp (`--output-json-full` / `-ojf`) y las marcas de tiempo de palabra alineadas con DTW (`--dtw <preset>`, emparejado automáticamente con el modelo activo; existen presets para todas las familias, incluida `large.v3.turbo`, y se aplican a los modelos cuantizados). Esta es la capa de tiempo preciso sobre la que se asientan el SRT a nivel de palabra, la colocación de marcadores y la alineación de clips; el JSON por token también incluye valores de confianza para quien los quiera. Nota: `--dtw` es un **flag de carga/contexto** (se establece en la inicialización del modelo, no por solicitud), por lo que reside en la ruta CLI de un solo uso — la API `/inference` del `whisper-server` residente no puede aplicarlo por solicitud, coherente con el rechazo del nivel de palabra en modo servidor de v2.5.0.
- **Cerrar la brecha de JSON en segundo plano** — JSON actualmente recurre a texto en modo en segundo plano.
- **FCPXML / EDL — diferido:** verbosos, sensibles a la versión y arrastran hacia el alcance de la integración con el editor. Reconsiderar solo si el CSV de marcadores resulta insuficiente.

**Límite de alcance:** esto genera archivos que el editor *importa* — no automatiza la interfaz del editor. El intercambio estándar está alineado con la filosofía y es ligero en dependencias; controlar la aplicación es una cuestión aparte.

Combina con v2.7.0: busca en el archivo para encontrar el momento y luego entrega al editor un archivo de marcadores para saltar directamente a él.

---

## Planificado — v2.9.0: Calidad y ajuste de la transcripción

Profundidad en la precisión y el control de la transcripción — todos son passthroughs de cero dependencias de flags de whisper.cpp que el wrapper aún no expone. Cada opción de aquí es un parámetro de transcripción de un solo uso: sin sobrecarga adicional de llamadas a herramientas, plenamente funcional para los usuarios del plan gratuito.

- **Ajuste de VAD** — los controles de detección de actividad de voz (`--vad-threshold`, duración mínima de habla / mínima de silencio / máxima de habla, relleno de habla, solapamiento de muestras). El VAD ya está activo pero no es ajustable; estos corrigen la sobre- y sub-segmentación que hay detrás de la mayoría de las quejas de calidad del mundo real.
- **Supresión de tokens no de habla** (`--suppress-nst`) — descarta los artefactos de `[music]`/ruido para transcripciones más limpias.
- **Solo detección de idioma** (`--detect-language`) — una sonda barata de "¿qué idioma es este?" que retorna sin una pasada de transcripción completa. Valiosa para la audiencia multilingüe y para el enrutamiento previo a la transcripción.
- **Umbrales de robustez / decodificación** — `--entropy-thold`, `--logprob-thold`, `--word-thold`, `--no-fallback`, `--temperature-inc`, `--carry-initial-prompt`, `--suppress-regex` para audio difícil.
- **Controles de rendimiento** — flash attention (ahora **activo por defecto** en el whisper.cpp actual; exponer la vía de desactivación `--no-flash-attn` / `-nfa` en lugar de tratarlo como opcional), solo CPU (`--no-gpu`), tamaño del contexto de audio (`--audio-ctx`).

**Estado:** Planificado.

---

## Planificado — v3.0.0: Suite de post-procesamiento de subtítulos

Una capa de procesamiento por lotes en TypeScript puro sobre el SRT / VTT / JSON que el servidor ya emite — sin re-transcripción, sin nuevas dependencias, con un único parser/serializador compartido. Refleja la cadena de "conversión por lotes" de los editores de subtítulos dedicados (Subtitle Edit, Aegisub), que ningún MCP de transcripción competidor ofrece. La pasada de reparación de tiempos, en particular, apunta a los defectos que exhibe la salida cruda de Whisper — cues en blanco sobre el silencio, segmentos solapados o demasiado cortos, duplicados por bucle de repetición, líneas demasiado largas — de modo que la suite limpia la *propia* salida de este servidor, no solo los archivos importados.

- **Reparación y validación de tiempos** — imponer una duración mínima / máxima de cue; corregir los cues solapados; aplicar un intervalo mínimo entre cues; salvar los intervalos por debajo del umbral (extender hasta el siguiente); descartar los cues vacíos; fusionar los cues duplicados (bucles de repetición de whisper); limitar a dos líneas; ordenar y renumerar. Más un **informe de lint** no mutante que señala, por cue, las infracciones de velocidad de lectura (CPS), caracteres por línea y número de líneas frente a un perfil seleccionable (por ejemplo, YouTube 42 CPL / 20 CPS, Netflix 42 / 17) — el entregable que los editores realmente quieren antes de importar.
- **Re-temporización** — desplazar / ajustar todos los cues; re-temporizar por velocidad de fotogramas (por ejemplo, 23.976 ↔ 25).
- **Reflujo** — fusionar los cues cortos; dividir las líneas largas hasta un máximo de caracteres por línea / caracteres por segundo, equilibrando las dos líneas en lugar de una división voraz.
- **Conversión de formato** — convertir archivos existentes entre SRT / VTT / LRC / CSV / Markdown / texto plano, más salida ASS/SSA (con estilo por defecto), sin re-transcribir. Normalización de UTF-8 / fin de línea al escribir (satisface el requisito de UTF-8 de YouTube, evita el mojibake al re-importar).
- **Limpieza de texto** — buscar/reemplazar (regex opcional), eliminación de muletillas a partir de una lista de palabras estática (no un LLM), normalización de mayúsculas/minúsculas, eliminación de anotaciones para personas con discapacidad auditiva. Estrictamente mecánica — cualquier cosa que requiera juicio (reparación de OCR, inferencia de puntuación) queda fuera; el Claude anfitrión se encarga de eso sobre el texto devuelto.
- **Formateo de etiquetas de hablante** — formatear los turnos existentes de estéreo / TinyDiarize como bloques con prefijo de hablante.
- **Estadísticas de resumen** — conteo de palabras, duración, PPM, CPS medio, proporción de silencio.

**Restricciones de diseño:**
- TypeScript puro sobre el SRT / VTT / JSON que el servidor ya emite — sin re-transcripción, sin nuevas dependencias en tiempo de ejecución, con un único parser/serializador compartido.
- Opera solo sobre archivos de subtítulos/transcripción existentes — nunca invoca whisper ni ffmpeg, nunca toca el audio.
- Determinista y basada únicamente en reglas — sin LLM, sin nube, sin reparación "inteligente". Cualquier cosa que requiera juicio (correcciones de OCR, inferencia de puntuación) queda fuera; el Claude anfitrión se encarga de eso sobre el texto devuelto.
- No destructiva — escribe archivos nuevos; nunca sobrescribe un archivo de origen in situ sin la confirmación explícita del usuario.
- La pasada de lint / validación es no mutante — informa de las infracciones, nunca reescribe silenciosamente.
- Solo formatos de intercambio estándar — nunca controla la interfaz de un editor.

**Estado:** Planificado.

---

## Más adelante / En consideración

Sin programar, pero fiel a la filosofía y revisado según lo permita la capacidad.

### Migración a Bun
Migrar el runtime de Node.js a [Bun](https://bun.sh) para recortar el tiempo de arranque en frío del servidor MCP y eliminar el paso de compilación `tsc` (el código fuente se ejecuta directamente). Degradada de su antiguo puesto en v2.5.0: dado que el coste de recarga del modelo por invocación es el verdadero cuello de botella (ver v2.5.0 arriba), recortar el arranque de Node es una ganancia marginal, y la madurez de Bun en Windows más un cambio en el modelo de distribución conllevan riesgo. Vale la pena hacerlo eventualmente como una optimización opcional, no como una prioridad.

### Flujo de trabajo de renombrado y coincidencia de proyecto de video
La mitad más pesada de las herramientas de proyecto, una vez que aterrice la Búsqueda de transcripciones en todo el proyecto (v2.7.0): coincidencia aproximada de las transcripciones de clips editados con las transcripciones fuente para localizar los puntos de origen, y presentar nombres de archivo descriptivos sugeridos por Claude.

**Restricciones de diseño:**
- Los archivos fuente **nunca se renombran ni se modifican**
- Todos los renombrados requieren **confirmación explícita del usuario**
- El análisis y la coincidencia ocurren localmente — Claude solo se invoca cuando el usuario revisa los resultados, minimizando las llamadas a la API

**Estado:** Fase de diseño.

### Limpieza de transcripciones basada en reglas
Post-procesamiento local y determinista — eliminación de muletillas y falsos comienzos, controlada por el usuario. Más valiosa para los usuarios del modo de privacidad, donde la transcripción nunca llega a Claude para su limpieza. Deliberadamente acotada: los saltos de párrafo y la segmentación por temas son cosas que Claude ya hace bien sobre el texto devuelto, y la exportación a PDF/DOCX es un desbordamiento de alcance hacia la generación de documentos — ambos fuera de alcance aquí.

**Estado:** Promovida — la limpieza determinista está programada en la Suite de post-procesamiento de subtítulos de v3.0.0; las notas sobre lo fuera de alcance (saltos de párrafo, PDF/DOCX) siguen vigentes.

### Diarización de hablantes (pyannote-audio)
Diarización de hablantes mono completa con etiquetas de ID de hablante a lo largo de toda la grabación. Distinta del flag `--diarize` estéreo integrado (v2.2.0) y de TinyDiarize (v2.5.0).

**Implementación:** requiere [pyannote-audio](https://github.com/pyannote/pyannote-audio) — una biblioteca de Python con un requisito de token de acceso a Hugging Face, un stack de dependencias completamente aparte. Despriorizada: choca con la filosofía de local primero / cero dependencias, y TinyDiarize ya cubre el caso mono de cero dependencias. Si se persigue, se distribuiría como un complemento avanzado opcional con su propia documentación de configuración, nunca en el paquete principal.

**Estado:** Despriorizada / opcional.

### Traducción a idiomas distintos del inglés
El flag `--translate` de Whisper solo apunta al inglés. Los idiomas de destino arbitrarios necesitan una API de traducción externa o un modelo de traducción local.

**Opciones bajo consideración:** LibreTranslate (autoalojable, local primero), traducción con un LLM local, o documentación explícita como fuera de alcance.

**Estado:** Aplazado pendiente de una decisión de local primero frente a dependencia de API.

---

## Fuera de alcance / No planificado

Funcionalidades excluidas intencionadamente, registradas aquí para que la decisión sea explícita y no resurja repetidamente.

### Transcripción de micrófono en vivo — no planificada
La transcripción en tiempo real desde un micrófono en vivo estaba antes prevista para v2.7.0. Descartada porque choca con el diseño central del proyecto:
- **Desajuste de arquitectura:** MCP es de solicitud/respuesta, no de streaming. La captura en vivo requeriría o bien un sondeo continuo (que quema presupuesto de API) o bien una llamada de bloqueo prolongado que alcanza la guarda de tiempo de espera en primer plano de v2.4.0.
- **Principios de una única instancia / minimizar API:** devolver segmentos continuos a Claude es una rotación constante de llamadas a herramientas — lo opuesto a "funcional para los usuarios del plan gratuito" — y un proceso de streaming de larga duración tensiona el bloqueo de proceso.
- **Dependencia externa:** requeriría una dependencia externa adicional.

El subtitulado en vivo es una categoría de producto distinta (baja latencia, gestión de dispositivos, VAD) de una herramienta de transcripción de archivos/lotes. Los usuarios que lo necesiten están mejor servidos por una herramienta dedicada en tiempo real.

### Transcripción de URL de YouTube (yt-dlp) — no planificada como herramienta incluida
La transcripción directa de YouTube a texto mediante yt-dlp estaba antes planificada. Descartada como funcionalidad de primera clase porque:
- **Superficie de seguridad:** añade la obtención de URLs arbitrarias y una llamada a subproceso con entrada controlada por el usuario, revirtiendo el fortalecimiento de v2.4.0 que redujo exactamente esa superficie.
- **Mantenimiento:** yt-dlp se rompe con frecuencia a medida que YouTube cambia — un compromiso de mantenimiento continuo.
- **Local primero y licencias:** la adquisición de contenido por red se sitúa fuera del alcance de local primero, y empaquetar un descargador en un proyecto con licencia comercial es una zona gris de ToS/responsabilidad.
- **Redundante:** los usuarios pueden ejecutar yt-dlp por sí mismos y apuntar `transcribe_audio` al archivo resultante.

**Alternativa:** documentada como una receta (ejecuta yt-dlp, luego transcribe el archivo) en README / TROUBLESHOOTING, en lugar de una herramienta mantenida — el flujo de trabajo sigue disponible sin poseer la dependencia ni la superficie de ataque.

---

## Licenciamiento

whisper-windows-mcp tiene licencia dual.

**Uso no comercial:** MIT — gratuito para uso personal, educativo y no comercial. Ver [LICENSE](LICENSE).

**Uso comercial:** se requiere una licencia comercial separada para cualquier uso empresarial, profesional o que genere ingresos. Ver [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) para los términos y la información de contacto.

---

## Distribución

Disponible en [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), [Glama](https://glama.ai) y [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) (PR enviado).

---

## Documentación multilingüe

Los siguientes archivos deben actualizarse para coincidir con los documentos en inglés tras cada release:

**Japonés (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Coreano (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Vietnamita (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Indonesio (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Ucraniano (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Portugués brasileño (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Español (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

**Polaco (`*.pl.md`)** — `README.pl.md` / `TROUBLESHOOTING.pl.md` / `ROADMAP.pl.md` / `PRIVACY.pl.md` / `SECURITY.pl.md`

**Rumano (`*.ro.md`)** — `README.ro.md` / `TROUBLESHOOTING.ro.md` / `ROADMAP.ro.md` / `PRIVACY.ro.md` / `SECURITY.ro.md`

Las contribuciones de la comunidad para otros idiomas son bienvenidas.

---

## Contribuciones

Los pull requests son bienvenidos. Revisa las issues existentes antes de empezar a trabajar.

Si has probado la aceleración por GPU en hardware no listado arriba, abre una issue con el modelo de tu GPU, la VRAM, el tamaño del modelo y el throughput observado. Esto ayuda a construir una referencia de rendimiento precisa para otros usuarios.
