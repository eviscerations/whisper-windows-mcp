# whisper-windows-mcp — Depanare

---

## Listă de verificare rapidă

Înainte de a investiga mai profund, verifică toate punctele de mai jos:

- Căile din `claude_desktop_config.json` folosesc **bare oblice inverse duble** (`C:\\whisper\\...`)
- `whisper-cli.exe` există la calea specificată în `WHISPER_CLI_PATH`
- Fișierul model `.bin` există la calea specificată în `WHISPER_MODEL`
- FFmpeg este instalat și accesibil (`ffmpeg -version` funcționează în linia de comandă)
- Claude Desktop a fost **repornit complet** după editarea configurației (ieșit din bara de sistem, nu doar închis fereastra)
- Serverul whisper apare ca **în execuție** (insignă verde) în Setări → Dezvoltator

---

## Instalare și pornire

### Whisper nu apare în Claude Desktop → Setări → Dezvoltator

1. Deschide Claude Desktop → Setări → Dezvoltator → Editează configurația
2. Verifică dacă JSON-ul este valid — lipește-l pe [jsonlint.com](https://jsonlint.com) dacă ai îndoieli
3. Asigură-te că `WHISPER_CLI_PATH` și `WHISPER_MODEL` indică fișiere care există efectiv
4. Ieși din Claude Desktop din bara de sistem (fă clic dreapta pe pictogramă → Ieși)
5. Repornește Claude Desktop și verifică din nou

Dacă whisper apare dar afișează o insignă de eroare în loc de verde:
- Întreabă Claude: *"Verifică configurația whisper"* — instrumentul `check_config` returnează un mesaj de eroare specific
- Verifică Claude Desktop → Setări → Dezvoltator → fă clic pe numele serverului pentru jurnalul de erori

### Eroarea "whisper-cli.exe nu a fost găsit"

Calea din `WHISPER_CLI_PATH` nu corespunde locului unde a fost extras binarul.

Calea implicită așteptată: `C:\whisper\Release\whisper-cli.exe`

Verifică dacă fișierul există:
```powershell
Test-Path "C:\whisper\Release\whisper-cli.exe"
```

Ar trebui să returneze `True`. Dacă returnează `False`, fie extrage zip-ul versiunii în `C:\whisper\Release\`, fie actualizează `WHISPER_CLI_PATH` în configurație pentru a corespunde locației reale.

### Eroarea "Model negăsit"

Calea din `WHISPER_MODEL` nu corespunde locației reale sau numelui fișierului model.

Verifică directorul de modele:
```powershell
Get-ChildItem "C:\whisper\models\"
```

Numele fișierului trebuie să includă numele complet cu sufixul de cuantizare, ex. `ggml-large-v3-turbo-q5_0.bin`, nu `ggml-large-v3-turbo.bin`. Dacă nu sunt instalate modele, folosește `download_model` în Claude Desktop.

---

## Accelerare GPU

### Transcrierea este lentă — doar CPU, fără GPU

Întreabă Claude: *"Verifică hardware-ul sistemului"*

Instrumentul `check_system` confirmă dacă `ggml-vulkan.dll` este prezent în directorul binarelor whisper. Dacă DLL-ul lipsește, rulezi doar pe CPU indiferent de GPU-ul tău.

**Soluție:** Descarcă `whisper-vulkan-win-x64.zip` de pe [pagina de versiuni](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0) și extrage în `C:\whisper\Release\`. Zip-ul conține DLL-ul — trebuie să fie în același director cu `whisper-cli.exe`.

### GPU detectat, dar utilizare 0% în timpul transcrierii

Binarul rulează, dar nu trimite sarcini la GPU. De obicei înseamnă:
- Vulkan SDK nu este instalat sau driverul GPU nu expune o interfață Vulkan
- GPU-ul este mai vechi decât Vulkan 1.0 (rar — majoritatea GPU-urilor din 2016+ îl suportă)

Verifică suportul Vulkan:
```powershell
vulkaninfo
```

Orice ieșire confirmă disponibilitatea Vulkan. Dacă `vulkaninfo` nu funcționează, instalează cel mai recent driver GPU de pe site-ul producătorului.

### Transcrierea rulează pe GPU-ul greșit (sisteme cu mai multe GPU-uri)

În mod implicit, whisper-cli folosește dispozitivul Vulkan 0. Pe o mașină cu mai multe GPU-uri, este posibil să nu fie placa pe care o dorești. Fixează un anumit dispozitiv cu variabila de mediu `WHISPER_GPU_DEVICE` (sau parametrul `gpu_device` per apel, care acum funcționează și pe `generate_subtitles`):

```json
"env": { "WHISPER_GPU_DEVICE": "1" }
```

⚠️ **Indexul este ordinea de enumerare Vulkan, NU ordinea „GPU 0 / GPU 1" din Windows** — adesea diferă. Pentru a găsi numărul corect, rulează `whisper-cli.exe` pe orice fișier o dată și citește jurnalul său de pornire: tipărește `ggml_vulkan: 0 = <nume>`, `ggml_vulkan: 1 = <nume>`. Folosește indexul care listează placa țintă. `check_config` afișează dispozitivul activ, astfel încât poți confirma că fixarea a avut efect.

### VRAM raportat ca jumătate din dimensiunea reală (AMD)

Aceasta este o nuanță de raportare Windows pentru GPU-uri AMD. VRAM-ul real disponibil pentru procesare este de obicei de două ori mai mare decât ceea ce raportează `wmic`. Recomandarea modelului poate fi excesiv de conservatoare — poți încerca un model mai mare decât cel recomandat.

---

## Calitatea transcrierii

### Ieșirea conține text halucinat sau fraze repetate

Whisper uneori halucinează pe segmente audio silențioase sau de calitate scăzută. Instrumentul aplică implicit `--max-context 0` și `--no-speech-thold 0.6` pentru a minimiza aceasta.

Abordări suplimentare:
- Folosește `temperature=0.2` — o mică aleatoritate ajută la spargerea buclelor de halucinație pe audio zgomotos
- Folosește un model VAD: descarcă un fișier `.bin` al modelului Silero VAD și transmite calea sa ca `vad_model`. Elimină tăcerea înainte de transcriere — cea mai eficientă remediere pentru halucinații pe înregistrări cu pauze.
- Folosește un model mai mare (`large-v3` sau `large-v3-turbo`) — modelele mai mici halucinează mai mult pe audio dificil
- Folosește `prompt` pentru a seta contextul: *"Aceasta este un interviu podcast despre inginerie software."*

### Ieșirea transcrierii este goală sau foarte scurtă

Întreabă Claude: *"Analizează acest fișier"* (`analyze_media`) pentru a confirma că fișierul are conținut audio și este un format recunoscut.

Dacă FFprobe raportează audio dar transcrierea nu produce nimic:
- Fișierul poate fi într-o limbă care nu corespunde parametrului `language` configurat
- Încearcă `language=auto` pentru ca Whisper să detecteze limba
- Audio-ul poate fi prea silențios sau puternic procesat — transcrierea necesită vorbire inteligibilă

---

## Modul de confidențialitate și poarta de consimțământ

### Nu văd un prompt de consimțământ înainte de transcriere

Poarta de consimțământ se activează **o dată per sesiune** în modul standard. Dacă ai confirmat deja o transcriere în această sesiune (de la ultima repornire Claude Desktop), nu se va activa din nou.

Alte motive pentru care poarta poate să nu apară:
- `WHISPER_CONSENT_ACKNOWLEDGED=true` este setat în configurația ta — suprimă complet poarta
- `WHISPER_PRIVACY_MODE=true` este setat — modul de confidențialitate folosește propria sa poartă separată per operațiune
- Verifici progresul unei transcrieri de blocare care s-a terminat deja — poarta a fost consumată la începutul sarcinii

**Pentru a reseta și a vedea din nou poarta:** repornește complet Claude Desktop (ieși din bara de sistem, repornește).

### Claude procesează fișierul meu fără a întreba

Dacă `WHISPER_CONSENT_ACKNOWLEDGED=true` este în configurația ta, poarta este suprimată intenționat. Acesta este comportamentul intenționat pentru utilizatorii care au revizuit implicațiile de confidențialitate.

Dacă nu este setat și Claude a continuat fără a întreba, poarta sesiunii a fost deja consumată de o transcriere anterioară în aceeași sesiune. Poarta se activează o dată per sesiune.

### Modul de confidențialitate este activ, dar vreau să citesc o transcriere

Transmite `privacy_mode=false` direct instrumentului de transcriere pentru acel apel specific. Suprascrie setarea globală `WHISPER_PRIVACY_MODE=true` doar pentru acel singur apel:

- *"Transcrie acest fișier, privacy_mode=false"*

Nu este necesară repornirea. Suprascrierea se aplică doar acelui singur apel de instrument.

### Modul de confidențialitate solicită confirmare înainte de fiecare fișier

Acesta este comportamentul corect și intenționat. Modul de confidențialitate necesită consimțământ per operațiune — poarta se activează înainte de fiecare transcriere și nu poate fi ocolită când modul de confidențialitate este activ.

### Sarcini în fundal și poarta de consimțământ

Pentru transcrierea în fundal (`background=true`) în modul standard, poarta de consimțământ se activează la finalizarea `check_progress`, nu la apelul `transcribe_audio`. La momentul apelului, textul de transcriere nu există încă. Poarta se activează în momentul în care textul de transcriere ar fi returnat pentru prima dată la API.

Pentru sarcinile în fundal în modul de confidențialitate, poarta se activează **înainte de pornire** — înainte de orice procesare audio.

### Cum suprim permanent poarta de consimțământ?

Setează `WHISPER_CONSENT_ACKNOWLEDGED=true` în secțiunea env a fișierului `claude_desktop_config.json`. Aceasta suprimă dezvăluirea unică per sesiune în modul standard.

Notă: nu are efect când modul de confidențialitate este activ.

---

## Transcriere în fundal și lot

### "Acest fișier durează ~X — rulează-l în fundal" / transcrierea în prim-plan expiră

Claude Desktop impune o expirare de ~4 minute pentru orice apel individual al unui instrument MCP. Un fișier lung transcris în mod **prim-plan** (blocant) îl poate depăși — transcrierea tot se finalizează și este scrisă pe disc, dar apelul instrumentului în sine eșuează. Pentru a preveni acea eșuare tăcută, `transcribe_audio` și `generate_subtitles` estimează timpul de rulare din timp și, dacă ar trece probabil de plafon, returnează un mesaj care îți spune să rulezi din nou cu `background=true`. Modul în fundal returnează imediat un ID de sarcină și nu are o astfel de limită — monitorizează-l cu `check_progress`.

O mare parte din timpul real al unei transcrieri este **încărcarea modelului**, nu transcrierea: whisper-cli reîncarcă modelul la fiecare invocare, iar un model mare (de ex. `large-v3`, 2,9 GB) pe un GPU cu memorie limitată poate dura ~2 minute să se încarce înainte ca transcrierea să înceapă măcar (un model mai mic sau cuantizat se încarcă mai rapid). Pragul gărzii este configurabil cu `WHISPER_FOREGROUND_MAX_SEC` (secunde; implicit 210).

### Sarcina în fundal nu apare niciodată ca finalizată

Starea sarcinii este urmărită prin ieșirea procesului whisper-cli.exe. Verifică:

1. Întreabă Claude: *"Verifică progresul job_id"* — dacă procesul încă rulează, instrumentul returnează "În progres" cu timpul scurs și ultimul marcaj de timp al segmentului
2. Dacă fișierul este foarte lung (2+ ore), oferă mai mult timp — transcrierea GPU a unui fișier de 2 ore durează aproximativ 15–20 de minute pe un GPU mediu
3. Dacă timpul scurs pare greșit, deschide Task Manager → Detalii și verifică dacă `whisper-cli.exe` este listat

### Sarcina în fundal finalizată, dar lipsește fișierul de ieșire sau este în locul greșit

Sarcinile în fundal scriu ieșirea la o cale temporară în `%TEMP%\whisper-mcp-jobs\` în timpul procesării, apoi mută fișierul în directorul sursă la finalizare. Dacă mutarea eșuează, `check_progress` returnează o eroare specifică.

Verifică:
- Directorul sursă există și este scriibil
- Există suficient spațiu pe disc
- Calea țintă nu este prea lungă (Windows are implicit o limită de cale de 260 de caractere)

### Lotul s-a blocat sau nu trece la fișierul următor

`start_batch` folosește un callback de ieșire pentru a avansa automat fără interogare. Dacă lotul pare blocat:

1. Apelează `check_batch_progress` — forțează verificarea progresului și reevaluează starea curentă
2. Dacă fișierul curent încă rulează, lasă-l să se termine — verifică Task Manager pentru `whisper-cli.exe`
3. Dacă `check_batch_progress` arată fișierul curent ca eșuat, va încerca să treacă la fișierul următor

### Lotul raportează fișierul ca "eșuat" deși pare finalizat

Validatorul verifică că fișierul de ieșire nu este gol și are cel puțin un rând la fiecare 30 de secunde de audio. Fișierele scurte sau înregistrările cu secțiuni lungi silențioase pot produce ieșiri pe care validatorul le consideră suspect de scurte.

Dacă transcrierea pare corectă la deschidere — rulează-o din nou prin `transcribe_audio` individual și verifică rezultatul manual.

---

## Generarea subtitrărilor

### Fișierul SRT salvat, dar cu nume greșit sau în locul greșit

Fișierele SRT și VTT sunt salvate lângă fișierul sursă cu codul de limbă adăugat când limba sursă nu este engleza:
- Sursă engleză: `numefisier.srt`
- Sursă română: `numefisier.ro.srt`
- Cu traducere în engleză: `numefisier.ro.srt` + `numefisier.en.srt`

### Ieșire VTT pentru web — cum încarc în player desktop?

VLC suportă VTT prin Subtitrări → Adaugă fișier de subtitrări → selectează fișierul `.vtt`. Majoritatea celorlalte playere desktop suportă mai bine SRT decât VTT. Folosește `output_format=srt` pentru compatibilitate maximă cu playerele desktop.

VTT este cel mai bun pentru elemente HTML5 `<video>` și playere video web.

### Fișierele LRC nu se afișează în player

Fișierele LRC (`.lrc`) sunt destinate playerelor cu funcții de afișare versuri/karaoke: foobar2000, Winamp, AIMP și diverse playere mobile. Playerele video standard nu afișează LRC. Dacă ai nevoie de subtitrări sincronizate pentru video, folosește `srt` sau `vtt`.

### Generarea subtitrărilor atinge limita de timp cu eroare de 4 minute

`generate_subtitles` rulează implicit sincron și poate atinge limita de timp MCP de 4 minute a Claude Desktop pe fișiere lungi. Folosește `background=true` pentru fișiere de peste 10 minute:

- *"Generează subtitrări pentru acest fișier, background=true"*

Apoi monitorizează progresul prin `check_progress`. Notă: `translate_to_english=true` nu este disponibil în modul fundal. Rulează o a doua trecere după finalizarea sarcinii în fundal pentru a genera traducerea.

---

## Gestionarea modelelor

### `download_model` eșuează cu eroare de rețea

Instrumentul descarcă de la Hugging Face. Asigură-te că calculatorul tău are acces la internet și că `huggingface.co` nu este blocat de firewall sau proxy.

Dacă descărcarea începe dar nu se termină, fișierul `.part` este șters automat. Rulează din nou `download_model` pentru a reîncerca.

### `switch_model` spune că modelul nu este în directorul de modele

Instrumentul `switch_model` acceptă doar fișiere în directorul configurat în `WHISPER_MODEL` (mai exact, directorul care conține acel fișier).

Dacă modelul tău este într-o altă locație, fie mută-l în directorul de modele, fie actualizează `WHISPER_MODEL` în configurație pentru a indica un fișier din același director cu modelele tale.

### Modelul activ revine la modelul din configurație după repornirea Claude Desktop

`switch_model` este cu domeniu de sesiune prin design. Pentru a face schimbarea modelului permanentă, actualizează `WHISPER_MODEL` în `claude_desktop_config.json` și repornește Claude Desktop.

---

## Căi de fișiere și formate

### Numele de fișiere Unicode cauzează eșecuri silențioase ale transcrierii

Transcrierea în fundal direcționează toată ieșirea printr-o cale temporară igienizată ASCII bazată pe ID sarcină, care gestionează corect numele de fișiere Unicode. Dacă vezi un eșec cu un nume de fișier Unicode în modul de blocare, verifică dacă fișierul este accesibil:

```powershell
Test-Path "C:\Users\NumeUtilizator\Documents\inregistrare_romana.mp4"
```

Ar trebui să returneze `True`. Dacă calea este inaccesibilă pentru PowerShell, va fi inaccesibilă și pentru serverul MCP.

### Fișierul video nu produce ieșire sau eroare imediată

FFmpeg este necesar pentru toate formatele video. Verifică dacă FFmpeg este instalat:
```
ffmpeg -version
```

Dacă FFmpeg nu este în PATH, setează `FFMPEG_PATH` în configurație la calea completă a `ffmpeg.exe`.

Dacă FFmpeg este instalat dar un anumit video eșuează, poate fi un fișier corupt sau un variant de codec neobișnuit. Încearcă să convertești manual:
```
ffmpeg -i input.mp4 -ar 16000 -ac 1 output.wav
```
Apoi transcrie WAV-ul direct.

### Eroarea "Fișier prea mare"

Instrumentul respinge fișierele peste 10 GB. Aceasta este o limită de securitate pentru a preveni epuizarea resurselor. Fișierele care se apropie de această dimensiune trebuie împărțite înainte de transcriere.

### Respingere cale UNC

Căile care încep cu `\\server\share` (căi UNC la partajări de rețea) sunt respinse de validatorul de intrări. Montează partajarea de rețea ca literă de unitate (ex. `Z:\`) și folosește acea cale.

---

## Curățarea fișierelor temporare

Fișierele de stare a sarcinilor (`.json` și `.log`) din `%TEMP%\whisper-mcp-jobs\` sunt curățate automat la pornire pentru fișierele mai vechi de 7 zile. Curățarea manuală rămâne posibilă dacă este necesar:

```powershell
Remove-Item "$env:TEMP\whisper-mcp-jobs\*" -Force
```

Fișierele WAV temporare de conversie (`whisper_tmp_*.wav` în `%TEMP%`) sunt șterse imediat după fiecare transcriere. Dacă o transcriere a căzut la mijloc, pot rămâne. Șterge-le manual:

```powershell
Remove-Item "$env:TEMP\whisper_tmp_*.wav" -Force
```

---

## Lot mare nesupravegheit din linia de comandă

Pentru loturi foarte mari fără Claude, folosește direct PowerShell.

**Important:** whisper-cli.exe nu poate citi direct MP4, MKV sau majoritatea formatelor video. FFmpeg trebuie să preconvertească fiecare fișier la WAV mai întâi. Whisper scrie transcrierea la stdout și diagnosticele la stderr — folosește `Start-Process -RedirectStandardOutput` pentru a capta corect.

```powershell
$whisper = "C:\whisper\Release\whisper-cli.exe"
$model   = "C:\whisper\models\ggml-medium.en.bin"
$dir     = "C:\calea\catre\folderul\tau"
$ffmpeg  = "ffmpeg"
$tmp     = "$env:TEMP\whisper_convert.wav"

Get-ChildItem "$dir\*.mp4" | ForEach-Object {
    $out = ($_.FullName -replace '\.mp4$', '') + ".txt"
    if (Test-Path $out) {
        Write-Host "SARI (există): $($_.Name)"
        return
    }
    Write-Host "Conversie:    $($_.Name)"
    & $ffmpeg -y -i $_.FullName -ar 16000 -ac 1 -c:a pcm_s16le $tmp 2>$null
    Write-Host "Transcriere:  $($_.Name)"
    $wArgs = "-m `"$model`" -f `"$tmp`" --threads 8 --max-context 0 --no-speech-thold 0.6"
    Start-Process -FilePath $whisper -ArgumentList $wArgs -RedirectStandardOutput $out -Wait -NoNewWindow
    Write-Host "Gata:         $($_.BaseName).txt"
}

Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host "Totul gata."
```

Schimbă `*.mp4` cu `*.mkv`, `*.m4a` etc. pentru a corespunde tipurilor tale de fișiere. Verificarea de sărire `Test-Path` înseamnă că rularea din nou a scriptului după o întrerupere nu va reprocesa fișierele deja finalizate.

---

## Locația fișierului de configurare

```
C:\Users\NumeUtilizator\AppData\Roaming\Claude\claude_desktop_config.json
```

Dacă `AppData` nu este vizibil: Vizualizare → Afișare → Elemente ascunse în File Explorer.

---

## Exemplu de configurare completă funcțională

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-medium.en.bin",
        "FFMPEG_PATH": "ffmpeg"
      }
    }
  }
}
```

`FFMPEG_PATH` are implicit valoarea `ffmpeg` (presupune că este în PATH). Setează explicit doar dacă FFmpeg este instalat într-o locație non-standard.
