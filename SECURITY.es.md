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

**Puerta de modo de privacidad:** Cuando el modo de privacidad está activo, se muestra una divulgación de confirmación explícita antes de cada operación de transcripción. Esto es intencional y no puede omitirse — el cumplimiento normativo requiere consentimiento informado por operación.

**Puerta de consentimiento:** En modo estándar, se muestra una divulgación única por sesión antes de que el texto de transcripción sea devuelto a la API por primera vez en una sesión. Establece `WHISPER_CONSENT_ACKNOWLEDGED=true` en tu configuración para omitir esto en contenido no sensible.

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
  3. **Validación de entrada** — las rutas con recorrido de directorios y UNC son rechazadas; `switch_model` está contenido al directorio de modelos configurado; `download_model` está restringido a una lista de permitidos de espacios de nombres de Hugging Face de confianza.

Esta herramienta **no** está diseñada para ser controlada por un agente no confiable ni para ejecutarse como infraestructura compartida. Esa postura requeriría sandbox de SO/contenedor y una política de egreso — fuera del alcance de una herramienta de transcripción local de un solo usuario.

## Decisiones de diseño conocidas

- **Inyección de ruta de archivo:** Las herramientas aceptan rutas de archivo absolutas de Claude. Esto es por diseño — la herramienta está destinada a ser usada con Claude Desktop por el propietario de la máquina. No expongas este servidor MCP a acceso de red no confiable.
- **Sin sandbox:** whisper-cli.exe se ejecuta con los mismos permisos que Claude Desktop. Esto es estándar para herramientas MCP locales.
- **Archivos temporales:** Los archivos WAV intermedios se escriben en `%TEMP%\whisper_tmp_*.wav` y se eliminan tras la transcripción. Los archivos de estado de tareas se escriben en `%TEMP%\whisper-mcp-jobs\` y se limpian automáticamente después de 7 días al iniciar el servidor.
- **Contenido de transcripción:** El texto de transcripción devuelto en respuestas de herramientas es procesado por la API de Claude en modo estándar. Para evitar esto, activa `WHISPER_PRIVACY_MODE=true` o pasa `privacy_mode=true` por llamada. Ver [PRIVACY.md](PRIVACY.md).
- **Inyección de transcripción:** Los archivos de audio pueden contener contenido hablado que, cuando se transcribe, se asemeja a instrucciones. Las defensas integradas de Claude manejan esto. El propio servidor MCP marca todo el contenido de transcripción como datos no confiables y nunca lo interpreta como instrucciones.
- **Las descargas de modelos están restringidas:** La herramienta `download_model` solo descarga desde dos espacios de nombres de Hugging Face de confianza (`ggerganov/whisper.cpp` y `ggml-org`). Los redireccionamientos son validados contra una lista de permitidos antes de seguirlos. Las URLs arbitrarias son rechazadas a nivel de código. Las descargas truncadas o incompletas se rechazan (comprobación de Content-Length) antes de que un archivo `.part` se promueva al nombre del modelo.
- **El cambio de modelos está en sandbox:** `switch_model` solo acepta archivos `.bin` dentro del directorio de modelos configurado. Las rutas fuera de él se rechazan mediante contención de rutas normalizada — un directorio con prefijo hermano como `…\models-evil` no puede satisfacer la comprobación — independientemente de cómo se especifique la ruta.
