# Política de Seguridad

## Alcance

whisper-windows-mcp es una herramienta que prioriza lo local. Todo el procesamiento de audio ocurre en tu máquina — ningún audio, archivo de video ni dato personal es transmitido a ningún servidor. La superficie de ataque está limitada a:

- El sistema de archivos local (rutas de archivo pasadas a las herramientas)
- El binario whisper-cli.exe y sus dependencias
- La conexión MCP de Claude Desktop (solo IPC local)
- Texto de transcripción devuelto en respuestas de herramientas (ver Arquitectura de Privacidad abajo)

## Arquitectura de Privacidad

**Los archivos de audio nunca salen de tu máquina.** Esta garantía es incondicional.

**El texto de transcripción puede salir de tu máquina en modo estándar.** Cuando una respuesta de herramienta incluye texto de transcripción, ese texto es procesado por la API de Claude. Este es el comportamiento estándar de MCP, pero crea una brecha entre la filosofía de diseño "prioridad local" de la herramienta y el flujo de datos real para usuarios que manejan contenido regulado o confidencial.

**El modo de privacidad** (`WHISPER_PRIVACY_MODE=true` o `privacy_mode=true` por llamada) restringe todas las respuestas de herramientas solo a metadatos — ningún texto de transcripción devuelto a la API de Claude. Esta es la configuración correcta para implementaciones médicas, jurídicas, financieras y corporativas.

**Puerta de modo de privacidad:** Cuando el modo de privacidad está activo, se muestra una divulgación de confirmación explícita antes de cada operación de transcripción, vinculada por operación (herramienta + argumentos). El servidor impone el *bloqueo* — retiene la operación y devuelve la divulgación la primera vez que ve una operación dada. **No** impone que un humano haya respondido: la puerta se libera cuando la llamada idéntica se vuelve a emitir, bajo la suposición de que el host mostró la divulgación y el usuario respondió "sí". Un cliente que vuelve a emitir la misma llamada sin un humano en el bucle puede satisfacer la puerta por sí solo. Trátala como un control procedimental de consentimiento informado que depende de que el host MCP respete la divulgación, no como una barrera criptográfica.

**Puerta de consentimiento:** En modo estándar, se muestra una divulgación única por sesión antes de que el texto de transcripción sea devuelto a la API por primera vez en una sesión. Establece `WHISPER_CONSENT_ACKNOWLEDGED=true` en tu configuración para omitir esto en contenido no sensible. Ten en cuenta que esta es una puerta de *una vez por sesión*: tras la primera transcripción confirmada, las transcripciones posteriores en la misma sesión se devuelven sin volver a solicitar confirmación. Usa el modo de privacidad para contenido que nunca deba llegar a la API, independientemente del estado de la sesión.

Ver [PRIVACY.md](PRIVACY.md) para la descripción completa de la arquitectura de privacidad, orientación de marcos de cumplimiento (HIPAA, GDPR, privilegio abogado-cliente, FERPA, SOX, PCI-DSS) e instrucciones de configuración.

## Verificación del binario

Para verificar la integridad del binario `whisper-cli.exe` en el release precompilado, comprueba su hash SHA256 en PowerShell:

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

El hash esperado para cada binario de release está publicado en la [página de releases](https://github.com/eviscerations/whisper-windows-mcp/releases). No uses un binario cuyo hash no coincida.

## Versiones soportadas

Las correcciones de seguridad solo se aplican a la versión publicada más reciente.

| Versión | Soportada |
|---|---|
| 2.x (más reciente) | ✅ |
| 1.x | ❌ |

## Reportar una vulnerabilidad

**No abras una issue pública para vulnerabilidades de seguridad.**

Usa el reporte privado de vulnerabilidades de GitHub:
1. Ve a la [pestaña Security](https://github.com/eviscerations/whisper-windows-mcp/security)
2. Haz clic en "Report a vulnerability"
3. Describe el problema con suficientes detalles para reproducirlo

Recibirás una respuesta en 7 días. Si la vulnerabilidad es confirmada, se lanzará una corrección lo antes posible y serás acreditado en las notas de release si lo deseas.

## Sandbox y aprobaciones

whisper-windows-mcp es una **herramienta local, de un solo usuario, controlada por el propietario de la máquina a través de Claude Desktop.** Su modelo de amenazas es el propietario ejecutándola en su propia máquina — no una implementación no confiable, multiinquilino o expuesta a la red.

- **Sandbox:** ninguno, por diseño. `whisper-cli.exe` se ejecuta con el propio nivel de permisos del propietario, igual que cualquier servidor MCP local. El aislamiento a nivel de SO no es la mitigación aquí; el ámbito de uso lo es — **no expongas este servidor a acceso de red no confiable** (consulta "Inyección de ruta de archivo" más abajo).
- **Las aprobaciones son por capas, no basadas en sandbox:**
  1. **Aprobación del host** — la capa MCP de Claude Desktop controla la invocación de herramientas.
  2. **Barreras de consentimiento / privacidad** — se requiere una confirmación explícita antes de que cualquier texto de transcripción salga de la máquina hacia la API de Claude; `WHISPER_PRIVACY_MODE` / `privacy_mode` por llamada devuelve solo metadatos para contenido regulado. La barrera está vinculada por operación (herramienta + argumentos). Ver [PRIVACY.md](PRIVACY.md).
  3. **Validación de entrada** — aplicada de forma defensiva en cada herramienta que acepta una ruta o un ID:
     - Las rutas con recorrido de directorios (`..`) y UNC (`\\server\share`) son rechazadas en **todas** las entradas de archivo/carpeta, incluyendo `analyze_media` y `transcribe_batch` (estas dos últimas antes solo validaban la existencia — una ruta UNC sin validar podía inducir una conexión SMB saliente hacia un host atacante).
     - `job_id` / `batch_id` se comprueban contra el formato exacto emitido por el servidor antes de usarse para construir cualquier ruta del sistema de archivos, de modo que un ID manipulado no pueda salir del directorio de tareas hacia lectura/escritura/borrado de archivos arbitrarios.
     - Tanto `switch_model` **como** la anulación `model` de `transcribe_audio` están contenidos al directorio de modelos configurado mediante contención de rutas normalizada — la anulación no puede usarse para entregar un archivo arbitrario a `whisper-cli` como su modelo.
     - Las rutas de `vad_model` rechazan recorrido/UNC.
     - `download_model` está restringido a una lista de permitidos de espacios de nombres de Hugging Face de confianza (URL inicial y cada redireccionamiento).
     - Los binarios del sistema Windows invocados implícitamente por el servidor (`tasklist`, `wmic`) son llamados por ruta absoluta de `System32` para que no puedan ser suplantados por un ejecutable con el mismo nombre situado antes en el `PATH`.

**Una nota sobre el límite del "agente no confiable".** Esta herramienta está diseñada para un único propietario que la controla a través de Claude Desktop, no como infraestructura compartida o expuesta a la red. Sin embargo, el contenido de audio/video transcrito es en sí mismo entrada no confiable que puede *asemejarse a instrucciones* e influir en qué herramientas se llaman a continuación y con qué argumentos (ver "Inyección de transcripción" más abajo). Por eso, la validación de entrada anterior se aplica de forma defensiva en lugar de depender únicamente de la suposición de un solo usuario. Una postura totalmente de agente no confiable o multiinquilino aún requeriría sandbox de SO/contenedor y una política de egreso — fuera del alcance de una herramienta de transcripción local de un solo usuario.

## Decisiones de diseño conocidas

- **Inyección de ruta de archivo:** Las herramientas aceptan rutas de archivo absolutas de Claude. Esto es por diseño — la herramienta está destinada a ser usada con Claude Desktop por el propietario de la máquina. El recorrido de directorios (`..`) y las rutas UNC son rechazados en todas las herramientas que aceptan rutas; por lo demás, las rutas locales absolutas son aceptadas. No expongas este servidor MCP a acceso de red no confiable.
- **Validación de ID de tarea/lote:** `job_id` y `batch_id` deben coincidir con la forma exacta emitida por el servidor (`job_<epochMs>_<8 hex>` / `batch_<epochMs>_<8 hex>`) antes de usarse para construir cualquier ruta del sistema de archivos. Esto evita que un ID manipulado salga del directorio de tareas hacia lectura, escritura o borrado de archivos arbitrarios a través del manejo de finalización de tareas.
- **Las puertas de consentimiento/privacidad son procedimentales:** Las puertas dependen de que el host MCP muestre la divulgación y de que un humano responda antes de que la operación se vuelva a emitir. El servidor impone el comportamiento de bloqueo-hasta-reemisión pero no puede verificar que un humano respondió. Para contenido que nunca deba llegar a la API, confía en el modo de privacidad (respuestas solo de metadatos), no en la puerta por sí sola.
- **Sin sandbox:** whisper-cli.exe se ejecuta con los mismos permisos que Claude Desktop. Esto es estándar para herramientas MCP locales.
- **Archivos temporales:** Los archivos WAV intermedios se escriben en `%TEMP%\whisper_tmp_*.wav` y se eliminan tras la transcripción. Los archivos de estado de tareas se escriben en `%TEMP%\whisper-mcp-jobs\` y se limpian automáticamente después de 7 días al iniciar el servidor.
- **Contenido de transcripción:** El texto de transcripción devuelto en respuestas de herramientas es procesado por la API de Claude en modo estándar. Para evitar esto, activa `WHISPER_PRIVACY_MODE=true` o pasa `privacy_mode=true` por llamada. Ver [PRIVACY.md](PRIVACY.md).
- **Inyección de transcripción:** Los archivos de audio pueden contener contenido hablado que, cuando se transcribe, se asemeja a instrucciones. Las defensas integradas de Claude manejan esto. El propio servidor MCP marca todo el contenido de transcripción como datos no confiables y nunca lo interpreta como instrucciones.
- **Las descargas de modelos están restringidas:** La herramienta `download_model` solo descarga desde dos espacios de nombres de Hugging Face de confianza (`ggerganov/whisper.cpp` y `ggml-org`). Los redireccionamientos son validados contra una lista de permitidos antes de seguirlos. Las URLs arbitrarias son rechazadas a nivel de código. Las descargas truncadas o incompletas se rechazan (comprobación de Content-Length) antes de que un archivo `.part` se promueva al nombre del modelo. **Seguimiento:** las descargas aún no se verifican contra un resumen SHA256 por modelo, por lo que un upstream comprometido o un atacante en la ruta aún podría servir un `.bin` malicioso. Se planean resúmenes fijados; verifica los hashes manualmente contra la página de releases para implementaciones de alta garantía.
- **Contención de selección de modelos:** Tanto `switch_model` como la anulación `model` de `transcribe_audio` solo aceptan archivos `.bin` dentro del directorio de modelos configurado. Las rutas fuera de él se rechazan mediante contención de rutas normalizada — un directorio con prefijo hermano como `…\models-evil` no puede satisfacer la comprobación — independientemente de cómo se especifique la ruta. Las rutas de `vad_model` rechazan recorrido/UNC.
- **Binarios del sistema implícitos:** `tasklist` y `wmic` son invocados por ruta absoluta de `System32`, no por nombre simple, para que no puedan ser suplantados por un ejecutable con el mismo nombre situado antes en el `PATH`.
- **Servidor de modelo persistente:** la herramienta opcional `whisper_server` ejecuta el `whisper-server` de whisper.cpp como un proceso residente. Está vinculado solo a `127.0.0.1` — nunca a una interfaz enrutable — por lo que no es accesible desde fuera de la máquina. Se inicia y detiene explícitamente (nunca se inicia automáticamente), y el proceso propiedad del servidor se termina al apagarse. Dado que un servidor residente y un `whisper-cli` de un solo uso competirían por la misma GPU/VRAM, ambos son mutuamente excluyentes: un respaldo estricto en la ruta de creación de proceso desconectado evita que cualquier tarea de la CLI se lance mientras el servidor está activo, y las herramientas de transcripción rechazan las operaciones que necesitarían la CLI hasta que el servidor se detenga. `WHISPER_SERVER_PORT` selecciona el puerto de localhost; el host no es configurable por diseño.
