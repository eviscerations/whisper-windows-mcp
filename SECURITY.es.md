# Política de Seguridad

## Alcance

whisper-windows-mcp es una herramienta que prioriza lo local. Todo el procesamiento de audio ocurre en tu máquina — ningún audio, archivo de video ni dato personal es transmitido a ningún servidor. La superficie de ataque está limitada a:

- El sistema de archivos local (rutas de archivo pasadas a las herramientas)
- El binario whisper-cli.exe y sus dependencias
- La conexión MCP de Claude Desktop (solo IPC local)
- Texto de transcripción devuelto en respuestas de herramientas (ver Arquitectura de Privacidad abajo)

## Arquitectura de Privacidad

**Los archivos de audio nunca salen de tu máquina.** Esta garantía es incondicional.

**El texto de transcripción puede salir de tu máquina.** Cuando una respuesta de herramienta incluye texto de transcripción, ese texto es procesado por la API de Claude. Este es el comportamiento estándar de MCP, pero crea una brecha entre la filosofía de diseño "prioridad local" de la herramienta y el flujo de datos real para usuarios que manejan contenido regulado o confidencial.

Una variable de entorno `WHISPER_PRIVACY_MODE` está planificada y restringirá todas las respuestas de herramientas solo a metadatos — ningún texto de transcripción devuelto a la API de Claude. Esta es la solución prevista para implementaciones médicas, jurídicas, financieras y corporativas.

Ver [PRIVACY.md](PRIVACY.md) para la descripción completa de la arquitectura de privacidad, orientación de marcos de cumplimiento (HIPAA, GDPR, privilegio abogado-cliente, FERPA, SOX, PCI-DSS) e instrucciones de configuración.

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

## Decisiones de diseño conocidas

- **Inyección de ruta de archivo:** Las herramientas aceptan rutas de archivo absolutas de Claude. Esto es por diseño — la herramienta está destinada a ser usada con Claude Desktop por el propietario de la máquina. No expongas este servidor MCP a acceso de red no confiable.
- **Sin sandbox:** whisper-cli.exe se ejecuta con los mismos permisos que Claude Desktop. Esto es estándar para herramientas MCP locales.
- **Archivos temporales:** Los archivos WAV intermedios se escriben en `%TEMP%\whisper_tmp_*.wav` y se eliminan tras la transcripción. Los archivos de estado de tareas se escriben en `%TEMP%\whisper-mcp-jobs\` y persisten hasta ser limpiados manualmente o hasta que la función de limpieza automática planificada esté disponible.
- **Contenido de transcripción:** El texto de transcripción devuelto en respuestas de herramientas es procesado por la API de Claude. Esto está documentado y podrá ser abordado via `WHISPER_PRIVACY_MODE` en un release futuro. Ver [PRIVACY.md](PRIVACY.md).
