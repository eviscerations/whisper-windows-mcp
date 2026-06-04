# Politică de securitate

## Domeniu de aplicare

whisper-windows-mcp este un instrument care prioritizează localul. Toată procesarea audio are loc pe calculatorul tău — niciun audio, fișier video sau date personale nu sunt transmise vreunui server. Suprafața de atac este limitată la:

- Sistemul de fișiere local (căi de fișiere transmise instrumentelor)
- Binarul whisper-cli.exe și dependențele sale
- Conexiunea MCP Claude Desktop (doar IPC local)
- Textul de transcriere returnat în răspunsurile instrumentelor (vezi Arhitectura de confidențialitate mai jos)

## Arhitectura de confidențialitate

**Fișierele audio nu părăsesc niciodată calculatorul tău.** Această garanție este necondiționată.

**Textul de transcriere poate părăsi calculatorul tău** în modul standard. Când un răspuns al instrumentului include text de transcriere, acel text este procesat de API-ul Claude. Acesta este comportamentul standard MCP, dar creează un decalaj între filosofia de proiectare "local prioritar" a instrumentului și fluxul real de date pentru utilizatorii care gestionează conținut reglementat sau confidențial.

**Modul de confidențialitate** (`WHISPER_PRIVACY_MODE=true` sau `privacy_mode=true` per apel) restricționează toate răspunsurile instrumentelor doar la metadate — niciun text de transcriere nu este returnat la API-ul Claude. Aceasta este configurația corectă pentru implementările medicale, juridice, financiare și corporative.

**Poarta modului de confidențialitate:** când modul de confidențialitate este activ, o dezvăluire de confirmare explicită este afișată înainte de fiecare operațiune de transcriere. Aceasta este intenționată și nu poate fi ocolită — conformitatea reglementară necesită consimțământ informat per operațiune.

**Poarta de consimțământ:** în modul standard, o dezvăluire unică per sesiune este afișată înainte ca orice text de transcriere să fie returnat la API pentru prima dată. Setează `WHISPER_CONSENT_ACKNOWLEDGED=true` în configurația ta pentru a suprima aceasta pentru conținut non-sensibil.

Vezi [PRIVACY.md](PRIVACY.md) pentru descrierea completă a arhitecturii de confidențialitate, îndrumări privind cadrele de conformitate (HIPAA, GDPR, privilegiu avocat-client, FERPA, SOX, PCI-DSS) și instrucțiuni de configurare.

## Verificarea binarului

Pentru a verifica integritatea binarului `whisper-cli.exe` din versiunea precompilată, verifică hash-ul său SHA256 în PowerShell:

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

Hash-ul așteptat pentru fiecare binar de versiune este publicat pe [pagina de versiuni](https://github.com/eviscerations/whisper-windows-mcp/releases). Nu folosi un binar al cărui hash nu corespunde.

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
- **Fișiere temporare:** Fișierele WAV intermediare sunt scrise în `%TEMP%\whisper_tmp_*.wav` și șterse după transcriere. Fișierele de stare a sarcinilor sunt scrise în `%TEMP%\whisper-mcp-jobs\` și curățate automat după 7 zile la pornirea serverului.
- **Conținut de transcriere:** Textul de transcriere returnat în răspunsurile instrumentelor este procesat de API-ul Claude în modul standard. Activează `WHISPER_PRIVACY_MODE=true` sau transmite `privacy_mode=true` per apel pentru a preveni aceasta. Vezi [PRIVACY.md](PRIVACY.md).
- **Injecție de transcriere:** Fișierele audio pot conține conținut vorbit care, atunci când este transcris, seamănă cu instrucțiuni. Apărările încorporate ale Claude gestionează acest lucru. Serverul MCP în sine marchează tot conținutul de transcriere ca date neautorizate și nu le interpretează niciodată ca instrucțiuni.
- **Descărcări de modele:** Instrumentul `download_model` descarcă doar din două spații de nume Hugging Face de încredere (`ggerganov/whisper.cpp` și `ggml-org`). Redirecționările sunt validate față de o listă de permise înainte de a fi urmate. URL-urile arbitrare sunt respinse la nivel de cod.
- **Schimbarea modelelor:** `switch_model` acceptă doar fișiere `.bin` în directorul de modele configurat. Căile din afara acelui director sunt respinse indiferent de modul în care sunt specificate.
