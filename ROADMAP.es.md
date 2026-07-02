# whisper-windows-mcp — Hoja de Ruta

Versión actual: **v2.5.0**

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

## Planificado — v2.5.0: Servidor de modelo persistente

Mantener el modelo Whisper residente entre transcripciones en lugar de recargarlo en cada invocación.

Esta es la mayor mejora de rendimiento disponible. whisper-cli es de un solo uso: recarga el modelo completo en cada llamada, y v2.4.0 midió esa recarga en ~110 s en una GPU con memoria limitada — un impuesto fijo pagado por archivo, independiente de la duración del audio. Para cargas de trabajo por lotes y de archivo, domina el tiempo total de ejecución más que la propia transcripción.

**Enfoque:** ejecutar el `whisper-server` (HTTP) incluido en whisper.cpp como un único proceso de larga duración con el modelo mantenido en memoria. El servidor MCP envía cada transcripción a él a través de localhost y recupera los resultados sin volver a pagar el coste de recarga.

**Conciliación con "una única instancia de whisper en todo momento":** el principio se preserva, el mecanismo evoluciona. El servidor residente *se convierte* en la única instancia; el bloqueo de proceso cambia de "nunca crear un segundo whisper-cli" a "serializar las solicitudes contra el único servidor residente". No se introduce concurrencia.

**Restricciones de diseño:**
- Ciclo de vida explícito: start / stop / status, con una verificación de salud. El servidor nunca se inicia silenciosamente como efecto secundario de una llamada no relacionada.
- Vincular solo a localhost — nunca a una interfaz enrutable. Sin exposición de red (coherente con el principio de local primero y el fortalecimiento de v2.4.0).
- Reserva elegante: si el servidor no está en ejecución, la transcripción sigue funcionando a través de la ruta existente de whisper-cli de un solo uso. El servidor es una optimización, no una dependencia obligatoria.
- `switch_model` recarga el modelo en el servidor residente (aún mucho más barato amortizado que recargar por archivo).
- Las puertas de privacidad y consentimiento no cambian — se sitúan por encima del mecanismo de transcripción.
- Selección de puerto con manejo de colisiones; apagado limpio ante SIGINT/SIGTERM junto con la limpieza existente de archivos temporales.

**Estado — Fase 1 ✅ implementada (pendiente de release):** herramienta `whisper_server` (`start` / `stop` / `status`); `transcribe_audio` y `transcribe_batch` bloqueantes se enrutan a través del servidor residente por localhost (`127.0.0.1`, verificado contra la API HTTP actual del `whisper-server` de whisper.cpp); `switch_model` intercambia en caliente el modelo residente mediante `POST /load` sin reinicio; la guarda de tiempo de espera en primer plano se omite en modo servidor (no hay recarga que pagar); `check_config` reporta el estado del servidor; el servidor propio se termina al apagarse para liberar la VRAM. La regla de un solo motor / VRAM compartida se impone con un respaldo estricto en la ruta de creación de proceso desconectado más rechazos amistosos: mientras el servidor está activo, las tareas en segundo plano, `start_batch`, `generate_subtitles`, salida `lrc`/`csv` y opciones por solicitud que la API HTTP no respeta (`beam_size`, `best_of`, `word_timestamps`, `diarize`, `tinydiarize`, `vad_model`, `offset_t`, `duration`, etc.) son rechazadas con un mensaje de "detén el servidor primero" en lugar de degradarse silenciosamente. Configuración: `WHISPER_SERVER_PATH`, `WHISPER_SERVER_PORT` (predeterminado 8571, solo localhost).

**Estado — Fase 2 (planificada):** enrutar segundo plano/`start_batch` a través del servidor residente. Esta es la mayor mejora de archivo/rendimiento y necesita rehacer la capa de tareas/cola en torno a solicitudes HTTP en lugar de PIDs desconectados (progreso sin un PID, cancelación). Reevaluar tras aterrizar la Fase 1.

---

## Planificado — v2.6.0: TinyDiarize (turnos de hablante en mono, cero dependencias adicionales)

Soporte a `--tinydiarize` con variantes de modelo habilitadas para `tdrz` (ej.: `ggml-small.en-tdrz.bin`). A diferencia del flag `--diarize` estéreo (v2.2.0), TinyDiarize marca los turnos de hablante en grabaciones **mono**, y no necesita nada más allá del archivo de modelo — ni Python, ni servicio externo.

**Alcance:**
- Añadir la(s) variante(s) de modelo `tdrz` a `MODEL_REGISTRY` para que `download_model` pueda obtenerlas de los espacios de nombres de Hugging Face de confianza existentes.
- Propagar una opción `tinydiarize` a través de `buildArgs` y `spawnDetached` para que funcione en modos bloqueante, en segundo plano y por lotes.

**Estado:** ✅ Implementado (pendiente de release) — parámetro `tinydiarize` en `transcribe_audio` y `generate_subtitles` (funciona en modos bloqueante y en segundo plano), `--tinydiarize` propagado a través de ambos constructores de argumentos, y `small.en-tdrz` añadido a `MODEL_REGISTRY` para `download_model`. Fiel a la filosofía: local primero, cero dependencias adicionales.

---

## Planificado — v2.7.0: Búsqueda de transcripciones en todo el proyecto

Una herramienta independiente para buscar una frase o patrón en cada transcripción de un directorio de proyecto y devolver las coincidencias con su archivo de origen y timecode. Descompuesta del flujo de trabajo mayor de proyecto de video (ver "Más adelante / En consideración") — esta mitad es útil de forma independiente, de bajo riesgo y ligera en API: la búsqueda se ejecuta localmente, y Claude solo interviene cuando el usuario revisa los resultados.

**Estado:** Planificado.

---

## Planificado — v2.8.0: Formatos de salida mejorados e integración

Salida ampliada para flujos de trabajo de análisis e integración downstream. Una brecha concreta que cerrar: la salida JSON actualmente no está soportada en modo en segundo plano (cae de vuelta a texto). JSON a nivel de palabra para alineación de clips y otros formatos de integración se definirán a partir de los comentarios de usuarios.

---

## Más adelante / En consideración

No programado, pero fiel a la filosofía y revisado según lo permita la capacidad.

### Migración a Bun
Migrar el runtime de Node.js a [Bun](https://bun.sh) para recortar el tiempo de arranque en frío del servidor MCP y eliminar el paso de compilación `tsc` (el código fuente se ejecuta directamente). Degradada de su antiguo puesto en v2.5.0: dado que el coste de recarga del modelo por invocación es el verdadero cuello de botella (ver v2.5.0 arriba), recortar el arranque de Node es una ganancia marginal, y la madurez de Bun en Windows más un cambio en el modelo de distribución conllevan riesgo. Vale la pena hacerlo eventualmente como una optimización opcional, no como una prioridad.

### Flujo de trabajo de renombrado y coincidencia de proyecto de video
La mitad más pesada de las herramientas de proyecto, una vez que aterrice la Búsqueda de transcripciones en todo el proyecto (v2.7.0): coincidencia aproximada de transcripciones de clips editados con transcripciones fuente para encontrar los puntos de origen, y mostrar nombres de archivo descriptivos sugeridos por Claude.

**Restricciones de diseño:**
- Los archivos fuente **nunca son renombrados ni modificados**
- Todos los renombrados requieren **confirmación explícita del usuario**
- El análisis y la coincidencia ocurren localmente — Claude solo es llamado cuando el usuario revisa los resultados, minimizando llamadas a la API

**Estado:** Fase de diseño.

### Limpieza de transcripciones basada en reglas
Post-procesamiento local y determinista — eliminación de muletillas y falsos comienzos, controlado por el usuario. Más valioso para usuarios del modo de privacidad, donde la transcripción nunca llega a Claude para su limpieza. Deliberadamente acotado: los saltos de párrafo y la segmentación por temas son cosas que Claude ya hace bien sobre el texto devuelto, y la exportación a PDF/DOCX es un desbordamiento de alcance hacia la generación de documentos — ambos fuera de alcance aquí.

**Estado:** En consideración.

### Diarización de hablantes (pyannote-audio)
Diarización de hablantes mono completa con etiquetas de ID de hablante a lo largo de toda la grabación. Diferente del flag `--diarize` estéreo integrado (v2.2.0) y TinyDiarize (v2.6.0).

**Implementación:** requiere [pyannote-audio](https://github.com/pyannote/pyannote-audio) — una biblioteca de Python con requisito de token de acceso a Hugging Face, un stack de dependencias completamente separado. Despriorizada: choca con la filosofía de local primero / cero dependencias, y TinyDiarize ya cubre el caso mono de cero dependencias. Si se persigue, se distribuiría como un complemento avanzado opcional con su propia documentación de configuración, nunca en el paquete principal.

**Estado:** Despriorizada / opcional.

### Traducción a idiomas que no sean inglés
El flag `--translate` de Whisper solo apunta al inglés. Los idiomas de destino arbitrarios necesitan una API de traducción externa o un modelo de traducción local.

**Opciones bajo consideración:** LibreTranslate (puede ser autoalojado, local primero), traducción LLM local, o documentación explícita como fuera de alcance.

**Estado:** Aplazado pendiente de una decisión de local primero vs. dependencia de API.

---

## Fuera de alcance / No planificado

Funcionalidades excluidas intencionalmente, registradas aquí para que la decisión sea explícita y no resurja repetidamente.

### Transcripción de micrófono en vivo — no planificada
La transcripción en tiempo real desde un micrófono en vivo estaba antes prevista para v2.7.0. Descartada porque choca con el diseño central del proyecto:
- **Desajuste de arquitectura:** MCP es de solicitud/respuesta, no de streaming. La captura en vivo requeriría o bien polling continuo (consume presupuesto de API) o bien una llamada de larga duración que alcanza la guarda de tiempo de espera en primer plano de v2.4.0.
- **Principios de una única instancia / minimizar API:** devolver segmentos continuos a Claude es una constante rotación de llamadas a herramientas — lo opuesto a "funcional para usuarios del plan gratuito" — y un proceso de streaming de larga duración tensiona el bloqueo de proceso.
- **Dependencia externa:** dependería de una API de streaming estable en whisper.cpp que no está en nuestras manos programar.

El subtitulado en vivo es una categoría de producto distinta (baja latencia, gestión de dispositivos, VAD) de una herramienta de transcripción de archivos/lotes. Los usuarios que lo necesiten están mejor servidos por una herramienta dedicada en tiempo real.

### Transcripción de URL de YouTube (yt-dlp) — no planificada como herramienta incluida
La transcripción directa de YouTube a texto via yt-dlp estaba antes planificada. Descartada como funcionalidad de primera clase porque:
- **Superficie de seguridad:** añade la obtención de URLs arbitrarias y una llamada a subproceso con entrada controlada por el usuario, revirtiendo el fortalecimiento de v2.4.0 que redujo exactamente esa superficie.
- **Mantenimiento:** yt-dlp se rompe con frecuencia a medida que YouTube cambia — un compromiso de mantenimiento continuo.
- **Local primero y licencias:** la adquisición de contenido por red se sitúa fuera del alcance de local primero, y empaquetar un descargador en un proyecto con licencia comercial es una zona gris de ToS/responsabilidad.
- **Redundante:** los usuarios pueden ejecutar yt-dlp por sí mismos y apuntar `transcribe_audio` al archivo resultante.

**Alternativa:** documentada como una receta (ejecuta yt-dlp, luego transcribe el archivo) en README / TROUBLESHOOTING, en lugar de una herramienta mantenida — el flujo de trabajo sigue disponible sin poseer la dependencia ni la superficie de ataque.

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
