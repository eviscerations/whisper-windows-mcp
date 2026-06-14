# Arquitectura de Privacidad — whisper-windows-mcp

Este documento describe qué datos permanecen en tu máquina, qué datos la abandonan y cómo configurar la herramienta para contenido regulado o sensible.

---

## La garantía central

whisper-windows-mcp está construido sobre una arquitectura que prioriza lo local. **Los archivos de audio y video nunca salen de tu máquina.** La transcripción se ejecuta completamente en tu hardware usando whisper.cpp — ningún servicio en la nube, conexión a internet ni llamada a API están involucrados en la transcripción en sí.

Esta garantía es incondicional para archivos multimedia.

---

## Datos que siempre permanecen locales

| Datos | ¿Sale de la máquina? |
|---|---|
| Archivos de audio | ❌ Nunca |
| Archivos de video | ❌ Nunca |
| Archivos de modelo Whisper | ❌ Nunca |
| Archivos WAV de conversión temporal | ❌ Nunca (eliminados tras la transcripción) |
| Archivos de estado de lotes y tareas | ❌ Nunca |
| Archivos de transcripción `.txt` / `.srt` / `.vtt` en disco | ❌ Nunca |

---

## Datos que pueden salir de la máquina (modo estándar)

Cuando una respuesta de herramienta incluye texto de transcripción, ese texto es devuelto a Claude Desktop y procesado por la API de Anthropic. Este es el comportamiento estándar de MCP — el texto viaja desde el servidor MCP local al modelo de Claude a través de la red.

| Datos | ¿Sale de la máquina? |
|---|---|
| Texto de transcripción devuelto en línea en respuestas de herramientas | ✅ Sí, en modo estándar |
| Texto de transcripción subido directamente a Claude como archivo | ✅ Sí (fuera del MCP — no se aplican controles de privacidad) |

Esta brecha existe entre la garantía "ningún dato sale de tu máquina" de la herramienta y el comportamiento real cuando le pides a Claude que lea, resuma o analice una transcripción. La mayoría de los usuarios — quienes transcriben contenido público como videos de YouTube, podcasts o grabaciones de streaming — no se ven afectados por esta distinción.

Para usuarios que manejan grabaciones privadas, confidenciales o reguladas, esta distinción importa.

---

## Modo de Privacidad

`WHISPER_PRIVACY_MODE` restringe todas las respuestas de herramientas solo a metadatos. Cuando está activado:

- Todas las respuestas de herramientas devuelven solo: nombre de archivo, conteo de palabras, ruta de guardado, estado de completado
- Ningún texto de transcripción es incluido en ninguna respuesta de herramienta
- Claude no puede leer, analizar ni retransmitir contenido de transcripción de ninguna forma
- Las transcripciones existen solo como archivos locales en disco

Este modo está diseñado para implementaciones jurídicas, médicas, financieras y corporativas donde el contenido de transcripción no debe salir del entorno local bajo ninguna circunstancia.

### Activar globalmente (variable de entorno)

Establece en `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-large-v3.bin",
        "WHISPER_PRIVACY_MODE": "true"
      }
    }
  }
}
```

Requiere reiniciar Claude Desktop para que tenga efecto.

### Activar por llamada (sin reinicio)

Pasa `privacy_mode=true` directamente a cualquier herramienta de transcripción:

- *"Transcribe este archivo en modo de privacidad"*
- *"Inicia un lote en esta carpeta, privacy_mode=true"*
- *"Verifica el progreso del job_123, privacy_mode=true"*

El parámetro por llamada anula la variable de entorno global en ambas direcciones. Pasa `privacy_mode=false` para desactivar en una sola llamada incluso cuando `WHISPER_PRIVACY_MODE=true` esté establecido globalmente.

### Comportamiento de la puerta de modo de privacidad

Cuando el modo de privacidad está activo, se muestra una divulgación de confirmación **antes de cada operación**. Esto es intencional — el cumplimiento normativo requiere consentimiento informado antes de cada evento de procesamiento, no solo una vez por sesión.

El texto de la divulgación es idéntico cada vez por diseño. La repetición es el punto: si estás manejando contenido sensible, debes confirmar explícitamente cada operación.

La confirmación está vinculada a la **operación específica** — la herramienta junto con sus argumentos exactos. Confirmar una transcripción no puede satisfacer la barrera de una operación diferente, y cambiar cualquier parámetro se trata como una nueva operación que requiere su propia confirmación.

Para `start_batch` con modo de privacidad: se requiere una confirmación antes de que el lote comience. Todos los archivos se procesan entonces de forma autónoma. No se devuelve texto de transcripción en ningún momento — solo metadatos de progreso del lote.

---

## Puerta de consentimiento (modo estándar)

Cuando el modo de privacidad no está activo, se muestra una divulgación única por sesión antes de que el texto de transcripción sea devuelto a la API de Claude por primera vez en una sesión.

La divulgación cubre:
- Que el texto de transcripción será transmitido a la API de Anthropic
- Los marcos normativos que pueden aplicarse a tu contenido
- Cómo activar el modo de privacidad si es necesario
- Cómo omitir permanentemente la puerta para contenido no sensible

Después de que confirmas, la puerta no se activa de nuevo durante el resto de la sesión. Reiniciar Claude Desktop restablece la sesión y la puerta se activa de nuevo en la siguiente llamada que devuelva transcripción.

**Para tareas en segundo plano:** La puerta de consentimiento se activa al completar `check_progress`, no al momento de llamar a `transcribe_audio`. En el momento de la llamada, aún no existe texto de transcripción — la puerta se activa en el momento en que el texto de transcripción sería devuelto a la API por primera vez.

### Omitir la puerta permanentemente

Si regularmente transcribes contenido no sensible y ya no necesitas el recordatorio, establece en tu configuración:

```json
"WHISPER_CONSENT_ACKNOWLEDGED": "true"
```

No tiene efecto cuando el modo de privacidad está activo. El modo de privacidad usa su propia puerta por operación que siempre se activa independientemente de esta configuración.

---

## Resumen del flujo de datos

| Modo | Audio | Texto de transcripción | Confirmación requerida |
|---|---|---|---|
| Estándar | Solo local | Enviado a la API de Anthropic | Una vez por sesión (puerta de consentimiento) |
| Modo de privacidad (var. de entorno) | Solo local | Nunca transmitido | Antes de cada operación |
| Modo de privacidad (por llamada) | Solo local | No transmitido en esta llamada | Antes de esta operación |
| `WHISPER_CONSENT_ACKNOWLEDGED=true` | Solo local | Enviado a la API de Anthropic | Nunca (omitido) |

---

## Subir archivos de transcripción directamente a Claude

Cuando subes un archivo de transcripción `.txt` directamente a Claude como adjunto — completamente fuera de la herramienta MCP — el servidor MCP no tiene visibilidad y no puede aplicar ningún control de privacidad.

Subir una transcripción directamente a Claude es equivalente a enviar el contenido de audio a Anthropic. El modo de privacidad y todas las protecciones a nivel de MCP son completamente eludidas por las subidas directas de archivos.

Los usuarios que manejan contenido regulado no deben subir transcripciones directamente a Claude. El único camino de análisis seguro para contenido regulado son las herramientas de procesamiento local que no transmiten contenido externamente.

---

## Orientación para sectores regulados

Lo siguiente es solo información general. Los autores de esta herramienta no son abogados. Los usuarios son los únicos responsables del cumplimiento de las leyes y regulaciones aplicables. En caso de duda, consulta con un abogado calificado antes de transcribir contenido regulado.

### HIPAA (EE.UU. — salud)
Los proveedores de salud, aseguradoras y sus socios comerciales tienen prohibido transmitir Información de Salud Protegida (PHI) a terceros no autorizados sin un Acuerdo de Socio Comercial (BAA). Anthropic no ofrece HIPAA BAA para el uso de la API de consumidor de Claude.

**Casos de uso afectados:** Consultas de pacientes, notas clínicas, sesiones de terapia, llamadas de reclamaciones de seguros, grabaciones administrativas de hospitales.

**Recomendación:** Activa `WHISPER_PRIVACY_MODE=true` antes de transcribir cualquier audio de pacientes. No lo desactives a mitad de sesión.

### GDPR (UE/EEE)
Los datos personales de residentes de la UE no pueden transferirse a procesadores terceros sin consentimiento explícito y base legal para el procesamiento. El texto de transcripción que contenga nombres, ubicaciones o cualquier información de identificación constituye datos personales bajo el GDPR.

**Casos de uso afectados:** Entrevistas, reuniones, grabaciones de call center, procedimientos judiciales que involucren a residentes de la UE.

**Recomendación:** Activa el modo de privacidad para cualquier grabación que pueda contener datos personales de residentes de la UE/EEE.

### Privilegio Abogado-Cliente (EE.UU., Reino Unido, Australia y la mayoría de las jurisdicciones de derecho común)
Las comunicaciones entre abogados y clientes son legalmente privilegiadas. La divulgación a terceros no autorizados puede renunciar al privilegio. No existe precedente legal establecido que proteja las comunicaciones abogado-cliente cuando son procesadas por APIs de IA comerciales.

**Casos de uso afectados:** Deposiciones legales, consultas con clientes, grabaciones de estrategia interna, entrevistas con testigos.

**Recomendación:** Los abogados que transcriban comunicaciones privilegiadas deben activar el modo de privacidad. No lo desactives para análisis — usa editores de texto locales o herramientas de procesamiento para contenido privilegiado.

### FERPA (EE.UU. — educación)
Los registros educativos de estudiantes están protegidos. Las escuelas y universidades no pueden divulgar información identificable de estudiantes a terceros sin consentimiento.

**Casos de uso afectados:** Clases grabadas, sesiones de orientación de estudiantes, audiencias académicas, reuniones de IEP.

### SOX (EE.UU. — empresas públicas)
Las comunicaciones financieras de empresas públicas están sujetas a requisitos de mantenimiento de registros y confidencialidad. La información material no pública (MNPI) no puede divulgarse de forma selectiva.

**Casos de uso afectados:** Grabaciones de earnings calls, transcripciones de reuniones del consejo, comunicaciones con inversores, discusiones de estrategia financiera interna.

### PCI-DSS
Los datos de tarjetas de pago no pueden almacenarse ni transmitirse en entornos no seguros. Las grabaciones de voz de números de tarjeta durante transacciones están en el alcance.

**Casos de uso afectados:** Grabaciones de call center, llamadas de atención al cliente que involucren procesamiento de pagos.

### Protecciones de Secreto Comercial / NDA
La información comercial confidencial, fórmulas propietarias, detalles de productos no lanzados e información de personal pueden estar protegidos por contrato o ley.

**Casos de uso afectados:** Reuniones de estrategia corporativa, discusiones de I+D, llamadas de due diligence de M&A, procedimientos de RRHH.

---

## Reportar preocupaciones de privacidad

Si identificas un problema de privacidad o una brecha arquitectónica no cubierta aquí, usa el reporte privado de vulnerabilidades de GitHub en lugar de abrir una issue pública. Ver [SECURITY.md](SECURITY.md) para las instrucciones de reporte.
