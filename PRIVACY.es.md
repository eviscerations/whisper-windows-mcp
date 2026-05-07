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
| Archivos de transcripción `.txt` / `.srt` en disco | ❌ Nunca |

---

## Datos que pueden salir de la máquina (comportamiento predeterminado)

Cuando una respuesta de herramienta incluye texto de transcripción, ese texto es devuelto a Claude Desktop y procesado por la API de Anthropic. Este es el comportamiento estándar de MCP — el texto viaja desde el servidor MCP local al modelo de Claude a través de la red.

| Datos | ¿Sale de la máquina? |
|---|---|
| Texto de transcripción devuelto en línea en respuestas de herramientas | ✅ Sí, de forma predeterminada |
| Texto de transcripción subido directamente a Claude como archivo | ✅ Sí (fuera del MCP) |

Esta brecha existe entre la garantía "ningún dato sale de tu máquina" de la herramienta y el comportamiento real cuando le pides a Claude que lea, resuma o analice una transcripción. La mayoría de los usuarios — quienes transcriben contenido público como videos de YouTube, podcasts o grabaciones de streaming — no se ven afectados por esta distinción.

Para usuarios que manejan grabaciones privadas, confidenciales o reguladas, esta distinción importa.

---

## Modo de Privacidad (planificado — aún no implementado)

Una variable de entorno `WHISPER_PRIVACY_MODE` está planificada para un release futuro. Cuando esté activada:

- Todas las respuestas de herramientas devolverán solo metadatos: nombre de archivo, duración, conteo de palabras, estado de completado
- Ningún texto de transcripción será incluido en ninguna respuesta de herramienta
- Claude no podrá leer, analizar ni retransmitir contenido de transcripción de ninguna forma
- Las transcripciones existirán solo como archivos `.txt` locales en disco

Este modo está diseñado para implementaciones jurídicas, médicas, financieras y corporativas donde el contenido de transcripción no debe salir del entorno local bajo ninguna circunstancia.

**Configuración planificada:**

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

Hasta que este recurso esté disponible: si necesitas analizar contenido de transcripción sin transmitirlo a la API de Claude, abre el archivo `.txt` directamente en un editor de texto local o herramienta de procesamiento.

---

## Orientación para sectores regulados

Lo siguiente es solo información general. Los autores de esta herramienta no son abogados. Los usuarios son los únicos responsables del cumplimiento de las leyes y regulaciones aplicables. En caso de duda, consulta con un abogado calificado antes de transcribir contenido regulado.

### HIPAA (EE.UU. — salud)
Los proveedores de salud, aseguradoras y sus socios comerciales tienen prohibido transmitir Información de Salud Protegida (PHI) a terceros no autorizados sin un Acuerdo de Socio Comercial (BAA). Anthropic no ofrece HIPAA BAA para el uso de la API de consumidor de Claude.

**Casos de uso afectados:** Consultas de pacientes, notas clínicas, sesiones de terapia, llamadas de reclamaciones de seguros, grabaciones administrativas de hospitales.

**Recomendación actual:** No transcribas audio de pacientes y luego pidas a Claude que resuma o analice la transcripción a menos que tu organización haya establecido un arreglo de procesamiento compatible. Usa `WHISPER_PRIVACY_MODE` cuando esté disponible.

### GDPR (UE/EEE)
Los datos personales de residentes de la UE no pueden transferirse a procesadores terceros sin consentimiento explícito y base legal para el procesamiento. El texto de transcripción que contenga nombres, ubicaciones o cualquier información de identificación constituye datos personales bajo el GDPR.

**Casos de uso afectados:** Entrevistas, reuniones, grabaciones de call center, procedimientos judiciales que involucren a residentes de la UE.

**Recomendación actual:** Ten en cuenta que subir transcripciones que contengan datos personales de residentes de la UE a Claude puede tener implicaciones en el GDPR dependiendo de tu rol y propósito de procesamiento.

### Privilegio Abogado-Cliente (EE.UU., Reino Unido, Australia y la mayoría de las jurisdicciones de derecho común)
Las comunicaciones entre abogados y clientes son legalmente privilegiadas. La divulgación a terceros no autorizados puede renunciar al privilegio. No existe precedente legal establecido que proteja las comunicaciones abogado-cliente cuando son procesadas por APIs de IA comerciales.

**Casos de uso afectados:** Deposiciones legales, consultas con clientes, grabaciones de estrategia interna, entrevistas con testigos.

**Recomendación actual:** Los abogados que transcriban comunicaciones privilegiadas no deben subir esas transcripciones a Claude para análisis sin revisión legal independiente de las implicaciones para el privilegio.

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

## Subir archivos de transcripción directamente a Claude

Cuando subes un archivo de transcripción `.txt` directamente a Claude como adjunto — completamente fuera de la herramienta MCP — el servidor MCP no tiene visibilidad y no puede aplicar ningún control de privacidad.

Subir una transcripción directamente a Claude es equivalente a enviar el contenido de audio a Anthropic. Ningún modo de privacidad ni protección futura a nivel de MCP se aplicará a subidas directas de archivos.

Los usuarios que manejan contenido regulado no deben subir transcripciones directamente a Claude. El único camino de análisis seguro para contenido regulado son las herramientas de procesamiento local que no transmiten contenido externamente.

---

## Reportar preocupaciones de privacidad

Si identificas un problema de privacidad o una brecha arquitectónica no cubierta aquí, usa el reporte privado de vulnerabilidades de GitHub en lugar de abrir una issue pública. Ver [SECURITY.md](SECURITY.md) para las instrucciones de reporte.
