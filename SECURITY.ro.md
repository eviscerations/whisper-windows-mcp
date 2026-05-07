# Politică de securitate

## Domeniu de aplicare

whisper-windows-mcp este un instrument care prioritizează localul. Toată procesarea audio are loc pe calculatorul tău — niciun audio, fișier video sau date personale nu sunt transmise vreunui server. Suprafața de atac este limitată la:

- Sistemul de fișiere local (căi de fișiere transmise instrumentelor)
- Binarul whisper-cli.exe și dependențele sale
- Conexiunea MCP Claude Desktop (doar IPC local)
- Textul de transcriere returnat în răspunsurile instrumentelor (vezi Arhitectura de confidențialitate mai jos)

## Arhitectura de confidențialitate

**Fișierele audio nu părăsesc niciodată calculatorul tău.** Această garanție este necondiționată.

**Textul de transcriere poate părăsi calculatorul tău.** Când un răspuns al instrumentului include text de transcriere, acel text este procesat de API-ul Claude. Acesta este comportamentul standard MCP, dar creează un decalaj între filosofia de proiectare "local prioritar" a instrumentului și fluxul real de date pentru utilizatorii care gestionează conținut reglementat sau confidențial.

O variabilă de mediu `WHISPER_PRIVACY_MODE` este planificată care va restricționa toate răspunsurile instrumentelor doar la metadate — niciun text de transcriere nu este returnat la API-ul Claude. Aceasta este soluția prevăzută pentru implementările medicale, juridice, financiare și corporative.

Vezi [PRIVACY.md](PRIVACY.md) pentru descrierea completă a arhitecturii de confidențialitate, îndrumări privind cadrele de conformitate (HIPAA, GDPR, privilegiu avocat-client, FERPA, SOX, PCI-DSS) și instrucțiuni de configurare.

## Versiuni suportate

Corecțiile de securitate sunt aplicate doar celei mai recente versiuni publicate.

| Versiune | Suportată |
|---|---|
| 2.x (cea mai recentă) | ✅ |
| 1.x | ❌ |

## Raportarea unei vulnerabilități

**Nu deschide un issue public pentru vulnerabilități de securitate.**

Folosește raportarea privată a vulnerabilităților GitHub:
1. Mergi la [fila Security](https://github.com/eviscerations/whisper-windows-mcp/security)
2. Fă clic pe "Report a vulnerability"
3. Descrie problema cu suficiente detalii pentru a o reproduce

Vei primi un răspuns în 7 zile. Dacă vulnerabilitatea este confirmată, o corecție va fi lansată cât mai curând posibil și vei fi creditat în notele de lansare dacă dorești.

## Decizii de proiectare cunoscute

- **Injecție de cale de fișier:** Instrumentele acceptă căi absolute de fișiere de la Claude. Acesta este un design intenționat — instrumentul este destinat utilizării cu Claude Desktop de către proprietarul calculatorului. Nu expune acest server MCP la acces de rețea neautorizat.
- **Fără sandbox:** whisper-cli.exe rulează cu aceleași permisiuni ca Claude Desktop. Acesta este standard pentru instrumentele MCP locale.
- **Fișiere temporare:** Fișierele WAV intermediare sunt scrise în `%TEMP%\whisper_tmp_*.wav` și șterse după transcriere. Fișierele de stare a sarcinilor sunt scrise în `%TEMP%\whisper-mcp-jobs\` și persistă până la ștergerea manuală sau până la lansarea funcției de curățare automată planificate.
- **Conținut de transcriere:** Textul de transcriere returnat în răspunsurile instrumentelor este procesat de API-ul Claude. Acesta este documentat și va putea fi adresat prin `WHISPER_PRIVACY_MODE` într-o versiune viitoare. Vezi [PRIVACY.md](PRIVACY.md).
