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

**Poarta modului de confidențialitate:** când modul de confidențialitate este activ, o dezvăluire de confirmare explicită este afișată înainte de fiecare operațiune de transcriere, cheiată per operațiune (instrument + argumente). Serverul aplică *blocajul* — reține operațiunea și returnează dezvăluirea la prima apariție a unei anumite operațiuni. El **nu** impune ca un om să fi răspuns: bariera se ridică atunci când apelul identic este reemis, pe presupunerea că gazda a afișat dezvăluirea și utilizatorul a răspuns „da". Un client care reemite același apel fără un om în buclă poate satisface bariera de unul singur. Tratează-o ca pe un control procedural de consimțământ informat care depinde de onorarea dezvăluirii de către gazda MCP, nu ca pe o barieră criptografică.

**Poarta de consimțământ:** în modul standard, o dezvăluire unică per sesiune este afișată înainte ca orice text de transcriere să fie returnat la API pentru prima dată. Setează `WHISPER_CONSENT_ACKNOWLEDGED=true` în configurația ta pentru a suprima aceasta pentru conținut non-sensibil. Reține că aceasta este o barieră *o dată per sesiune*: după prima transcriere confirmată, transcrierile ulterioare din aceeași sesiune sunt returnate fără a solicita din nou. Folosește modul de confidențialitate pentru conținut care nu trebuie să ajungă niciodată la API, indiferent de starea sesiunii.

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

## Sandbox și aprobări

whisper-windows-mcp este un **instrument local, cu un singur utilizator, controlat de proprietarul calculatorului prin Claude Desktop.** Modelul său de amenințare este proprietarul care îl rulează pe propriul calculator — nu o implementare neautorizată, multi-tenant sau expusă la rețea.

- **Sandbox:** niciunul, prin design. `whisper-cli.exe` rulează la nivelul de permisiuni al proprietarului însuși, la fel ca orice server MCP local. Izolarea la nivel de SO nu este măsura de atenuare aici; domeniul de utilizare este — **nu expune acest server la acces de rețea neautorizat** (vezi „Injecție de cale de fișier" mai jos).
- **Aprobările sunt stratificate, nu bazate pe sandbox:**
  1. **Aprobarea gazdei** — stratul MCP al Claude Desktop controlează invocarea instrumentelor.
  2. **Bariere de consimțământ / confidențialitate** — o confirmare explicită este necesară înainte ca orice text de transcriere să părăsească calculatorul către API-ul Claude; `WHISPER_PRIVACY_MODE` / `privacy_mode` per apel returnează doar metadate pentru conținut reglementat. Bariera este cheiată per operațiune (instrument + argumente). Vezi [PRIVACY.md](PRIVACY.md).
  3. **Validarea intrărilor** — aplicată defensiv pe fiecare instrument care primește o cale sau un ID:
     - Căile de traversare a directoarelor (`..`) și UNC (`\\server\share`) sunt respinse pe **toate** intrările de fișiere/foldere, inclusiv `analyze_media` și `transcribe_batch` (ultimele două validau anterior doar existența — o cale UNC nevalidată ar putea induce o conexiune SMB de ieșire către o gazdă atacatoare).
     - `job_id` / `batch_id` sunt verificate față de formatul exact emis de server înainte de a fi folosite pentru a construi orice cale din sistemul de fișiere, astfel încât un ID fabricat să nu poată ieși prin traversare din directorul de sarcini în citire/scriere/ștergere arbitrară de fișiere.
     - Atât `switch_model`, **cât și** suprascrierea `model` din `transcribe_audio` sunt limitate la directorul de modele configurat prin conținere de cale normalizată — suprascrierea nu poate fi folosită pentru a furniza un fișier arbitrar către `whisper-cli` ca model al său.
     - Căile `vad_model` resping traversarea/UNC.
     - `download_model` este restricționat la o listă de permise de spații de nume Hugging Face de încredere (URL-ul inițial și fiecare redirecționare).
     - Binarele de sistem Windows invocate implicit de server (`tasklist`, `wmic`) sunt apelate prin calea absolută `System32`, astfel încât să nu poată fi umbrite de un executabil cu același nume plasat mai devreme pe `PATH`.

**O notă despre limita „agentului neautorizat".** Acest instrument este conceput pentru un singur proprietar care îl controlează prin Claude Desktop, nu ca infrastructură partajată sau expusă la rețea. Totuși, conținutul audio/video transcris este el însuși o intrare neautorizată care poate *semăna cu instrucțiuni* și poate influența ce instrumente sunt apelate în continuare și cu ce argumente (vezi „Injecție de transcriere" mai jos). Din acest motiv, validarea intrărilor de mai sus este aplicată defensiv, în loc să se bazeze exclusiv pe presupunerea de utilizator unic. O poziție complet neautorizat-agent sau multi-tenant ar necesita totuși sandbox de SO/container și o politică de ieșire — în afara domeniului unui instrument de transcriere local cu un singur utilizator.

## Decizii de proiectare cunoscute

- **Injecție de cale de fișier:** Instrumentele acceptă căi absolute de fișiere de la Claude. Acesta este un design intenționat — instrumentul este destinat utilizării cu Claude Desktop de către proprietarul calculatorului. Traversarea (`..`) și căile UNC sunt respinse pe toate instrumentele care primesc căi; căile locale absolute sunt altfel acceptate. Nu expune acest server MCP la acces de rețea neautorizat.
- **Validarea ID-urilor de sarcină/lot:** `job_id` și `batch_id` trebuie să corespundă formei exacte emise de server (`job_<epochMs>_<8 hex>` / `batch_<epochMs>_<8 hex>`) înainte de a fi folosite pentru a construi orice cale din sistemul de fișiere. Aceasta previne ca un ID fabricat să iasă prin traversare din directorul de sarcini în citire, scriere sau ștergere arbitrară de fișiere prin gestionarea finalizării sarcinilor.
- **Barierele de consimțământ/confidențialitate sunt procedurale:** Barierele depind de afișarea dezvăluirii de către gazda MCP și de răspunsul unui om înainte ca operațiunea să fie reemisă. Serverul aplică comportamentul de blocare-până-la-reemitere, dar nu poate verifica dacă un om a răspuns. Pentru conținut care nu trebuie să ajungă niciodată la API, bazează-te pe modul de confidențialitate (răspunsuri doar cu metadate), nu doar pe barieră.
- **Fără sandbox:** whisper-cli.exe rulează cu aceleași permisiuni ca Claude Desktop. Acesta este standard pentru instrumentele MCP locale.
- **Fișiere temporare:** Fișierele WAV intermediare sunt scrise în `%TEMP%\whisper_tmp_*.wav` și șterse după transcriere. Fișierele de stare a sarcinilor sunt scrise în `%TEMP%\whisper-mcp-jobs\` și curățate automat după 7 zile la pornirea serverului.
- **Conținut de transcriere:** Textul de transcriere returnat în răspunsurile instrumentelor este procesat de API-ul Claude în modul standard. Activează `WHISPER_PRIVACY_MODE=true` sau transmite `privacy_mode=true` per apel pentru a preveni aceasta. Vezi [PRIVACY.md](PRIVACY.md).
- **Injecție de transcriere:** Fișierele audio pot conține conținut vorbit care, atunci când este transcris, seamănă cu instrucțiuni. Apărările încorporate ale Claude gestionează acest lucru. Serverul MCP în sine marchează tot conținutul de transcriere ca date neautorizate și nu le interpretează niciodată ca instrucțiuni.
- **Descărcări de modele:** Instrumentul `download_model` descarcă doar din două spații de nume Hugging Face de încredere (`ggerganov/whisper.cpp` și `ggml-org`). Redirecționările sunt validate față de o listă de permise înainte de a fi urmate. URL-urile arbitrare sunt respinse la nivel de cod. Descărcările trunchiate/incomplete sunt respinse (verificare Content-Length) înainte ca un fișier `.part` să fie promovat la numele modelului. **De urmărit:** descărcările nu sunt încă verificate față de un digest SHA256 per model, așa că un upstream compromis sau un atacator pe traseu ar putea servi totuși un `.bin` malițios. Digest-urile fixate sunt planificate; verifică hash-urile manual față de pagina de versiuni pentru implementări cu asigurare ridicată.
- **Conținerea selectării modelelor:** Atât `switch_model`, cât și suprascrierea `model` din `transcribe_audio` acceptă doar fișiere `.bin` în directorul de modele configurat. Căile din afara lui sunt respinse prin izolare normalizată a căilor — un director cu prefix-frate precum `…\models-evil` nu poate satisface verificarea — indiferent de modul în care este specificată calea. Căile `vad_model` resping traversarea/UNC.
- **Binare de sistem implicite:** `tasklist` și `wmic` sunt invocate prin calea absolută `System32`, nu prin nume simplu, astfel încât să nu poată fi umbrite de un executabil cu același nume plasat mai devreme pe `PATH`.
- **Server de model persistent:** instrumentul opțional `whisper_server` rulează `whisper-server` din whisper.cpp ca proces rezident. Este legat doar la `127.0.0.1` — niciodată o interfață rutabilă — deci nu este accesibil din afara calculatorului. Este pornit și oprit explicit (niciodată pornit automat), iar procesul deținut este oprit la închidere. Deoarece un server rezident și un `whisper-cli` unic ar concura pentru același GPU/VRAM, cele două se exclud reciproc: o protecție dură în calea de lansare detașată împiedică lansarea oricărei sarcini CLI cât timp serverul este pornit, iar instrumentele de transcriere resping operațiunile care ar necesita CLI-ul până când serverul este oprit. `WHISPER_SERVER_PORT` selectează portul localhost; gazda nu este configurabilă prin design.
