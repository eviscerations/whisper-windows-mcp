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

## "whisper nu este conectat" sau niciun instrument disponibil

**Cauza cea mai frecventă:** Claude Desktop nu a fost repornit complet după editarea configurației.

1. Fă clic dreapta pe pictograma Claude din bara de sistem → Ieși
2. Redeschide Claude Desktop
3. Mergi la Setări → Dezvoltator și verifică insigna verde **în execuție** de lângă whisper

Dacă tot nu apare:

1. Deschide `claude_desktop_config.json` și verifică erorile de sintaxă JSON (virgule lipsă, acolade nepotrivite)
2. Asigură-te că toate căile folosesc bare oblice inverse duble
3. Rulează `check_config` în Claude Desktop pentru a obține o diagnosticare

---

## download_model atinge limita de timp pentru modele mari

Claude Desktop are o limită de timp de 4 minute pentru apelurile instrumentelor MCP. Descărcările de modele mari pe conexiuni lente pot depăși acest lucru.

**Dimensiunile fișierelor:**
- `large-v3` — 2,9 GB
- `large-v3-turbo` — 1,6 GB
- `large-v3-q5_0` — 1,1 GB
- `large-v3-turbo-q5_0` — 547 MB
- `medium.en` — 1,5 GB
- `medium.en-q5_0` — 514 MB

Pe o conexiune rapidă (100 Mbps+), chiar și large-v3 se descarcă în mai puțin de 4 minute. Pe conexiuni mai lente, folosește un browser sau PowerShell pentru a descărca direct și plasează fișierul în directorul de modele manual:

```powershell
# Exemplu — descărcare directă large-v3-turbo
Invoke-WebRequest -Uri "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo.bin" `
  -OutFile "C:\whisper\models\ggml-large-v3-turbo.bin"
```

Apoi folosește `switch_model ggml-large-v3-turbo.bin` pentru activare.

---

## `check_config` raportează că whisper-cli.exe nu a fost găsit

Calea din configurația ta nu corespunde locației reale a fișierului.

Verifică dacă fișierul există:
```
dir C:\whisper\Release\whisper-cli.exe
```

Dacă este altundeva, actualizează `WHISPER_CLI_PATH` în configurația ta pentru a corespunde căii reale.

---

## `check_config` raportează că FFmpeg nu a fost găsit

FFmpeg nu este instalat sau nu este în PATH-ul sistemului.

Instalare via winget:
```
winget install ffmpeg
```

Sau descarcă de la [ffmpeg.org](https://ffmpeg.org/download.html), extrage și adaugă folderul `bin` la PATH-ul sistemului.

După instalare, deschide o nouă linie de comandă și verifică:
```
ffmpeg -version
```

Dacă ai instalat FFmpeg într-o locație non-standard, setează variabila de mediu `FFMPEG_PATH` în configurația Claude Desktop:
```json
"env": {
  "FFMPEG_PATH": "C:\\ffmpeg\\bin\\ffmpeg.exe"
}
```

---

## Ieșirea transcrierii este plină de etichete `[FOREIGN]`

**Cauza:** Folosești un model numai engleză (ex.: `ggml-medium.en.bin`) pe audio în altă limbă decât engleza. Modelele numai engleză nu pot procesa alte limbi și generează `[FOREIGN]` ca substituent pentru fiecare segment pe care nu îl pot gestiona.

**Soluție:** Descarcă și folosește `ggml-large-v3.bin` — modelul multilingv. Acesta este necesar pentru orice transcriere non-engleză, detectarea automată a limbii sau traducere.

```
https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin
```

Salvează în `C:\whisper\models\` și actualizează configurația:
```json
"WHISPER_MODEL": "C:\\whisper\\models\\ggml-large-v3.bin"
```

Sau suprascrie per-transcriere folosind parametrul `model` în `transcribe_audio` sau `generate_subtitles`.

> **Notă:** Modelele numai engleză (`*.en.bin`) sunt mai rapide și mai precise pentru conținut în engleză, dar sunt complet incapabile să gestioneze alte limbi. Dacă lucrezi cu conținut multilingv, `large-v3` este modelul corect indiferent de hardware.

---

## Transcrierea nu produce ieșire sau fișier gol

**Cauze posibile:**

1. **Model greșit pentru limbă** — Modelele numai engleză (`*.en.bin`) nu pot transcriere alte limbi. Folosește `ggml-large-v3.bin` pentru conținut multilingv.

2. **Calitate audio prea scăzută** — Fișierele cu rată de biți foarte mică (ex.: înregistrări vechi de telefon `.3gp` folosind codec AMR-NB ~12kbps) pot fi la limita a ceea ce whisper poate procesa. Mediile zgomotoase (zgomot de fundal, ecou, vorbitori depărtați) sunt de asemenea dificile. Încearcă `large-v3` care gestionează mai bine audio degradat.

3. **Fișier silențios sau corupt** — Rulează `analyze_media` pe fișier pentru a verifica dacă FFprobe detectează un flux audio valid.

4. **Eșec de conversie** — Fișierul poate să nu se convertească corect la WAV. Încearcă să convertești manual mai întâi:
```
ffmpeg -i yourfile.3gp -ar 16000 -ac 1 output.wav
```
Apoi transcrie WAV-ul direct.

---

## Sarcina în fundal eșuează pe fișiere cu caractere speciale sau Unicode în nume

**Cauza:** whisper-cli.exe nu poate scrie fișierul de ieșire când calea conține caractere Unicode (română, japoneză, chineză, emoji, paranteze etc.) sau anumite caractere speciale.

**Soluție temporară curentă:** Redenumește fișierul pentru a folosi doar caractere ASCII înainte de transcriere, apoi redenumește înapoi dacă este necesar.

```
ren "fisier_romanesc.mp4" "temp_transcribe.mp4"
```

**Status:** Acesta este un bug cunoscut. O corecție este planificată care va direcționa ieșirea printr-o cale temporară igienizată și va muta rezultatul la destinația corectă după finalizare.

---

## Sarcina în fundal arată "eșuat" fără ieșire

**Cauze posibile:**

1. **Nume de fișier Unicode** — Vezi mai sus.

2. **Cale model greșită** — Procesul detașat nu moștenește căile corectate. Rulează `check_config` pentru a verifica căile.

3. **Procesul a fost terminat** — Dacă whisper-cli.exe a fost terminat manual în mijlocul unei sarcini, nu va exista niciun fișier de ieșire. Încearcă din nou.

4. **VRAM insuficient** — Modelele mari pe GPU-uri cu VRAM redus pot eșua silențios. Încearcă un model mai mic.

5. **Eșec de conversie a fișierului** — Încearcă să transcrii direct un fișier WAV pentru a izola dacă problema este la conversie sau transcriere.

---

## Transcrierea în fundal nu produce ieșire SRT

**Cauza:** Modul în fundal (`background=true` în `transcribe_audio`) produce în prezent doar ieșire `.txt`. Formatul SRT în modul fundal nu a fost încă implementat.

**Soluție temporară:** Pentru fișiere sub ~4 minute, folosește `generate_subtitles` în modul de blocare. Pentru fișiere mai lungi, transcrie mai întâi în modul fundal pentru a obține `.txt`, apoi dacă este nevoie de SRT, folosește `generate_subtitles` pe același fișier (va transcriere din nou).

**Status:** Suportul SRT în modul fundal este planificat pentru o versiune viitoare.

---

## GPU-ul nu este folosit (CPU blocat peste 50%)

**Cauza:** Rulezi binarul numai CPU care vine cu versiunea standard whisper.cpp.

**Soluție:** Descarcă compilarea cu Vulkan activat de pe [pagina de versiuni](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0) și extrage în `C:\whisper\Release\`.

Verifică că accelerarea GPU este activă:
- Cere lui Claude să ruleze `check_system`
- Caută `✅ Vulkan binary: ggml-vulkan.dll found` în ieșire
- Urmărește Task Manager → Performanță → GPU în timpul unei transcrieri — utilizarea GPU ar trebui să urce la 15–30%

---

## `check_system` raportează cantitatea greșită de VRAM

Aceasta este o limitare cunoscută Windows. Comanda `wmic` citește VRAM din registry, care pe multe plăci AMD raportează jumătate din VRAM-ul fizic. Un Vega 56 cu 8GB HBM2 va arăta de obicei 4GB. Aceasta este doar o problemă de afișare — whisper folosește tot VRAM-ul fizic în timpul inferenței.

---

## Eroarea "Transcrierea este deja în curs"

Un proces `whisper-cli.exe` rulează dintr-o sarcină anterioară. Așteaptă să se termine, sau:

1. Deschide Task Manager → fila Detalii
2. Găsește `whisper-cli.exe`
3. Fă clic dreapta → Încheie sarcina

Apoi încearcă din nou.

---

## Detectarea automată a limbii este greșită

Detectarea automată a Whisper rulează pe primele 30 de secunde de audio. Dacă fișierul începe într-o limbă diferită față de cea mai mare parte a conținutului său, detectarea poate fi greșită.

**Soluție:** Specifică limba explicit (ex.: `language=ro`) în loc să te bazezi pe detectarea automată.

---

## Generarea subtitrărilor produce "(vorbind în limbă străină)" pe tot videoclipul

Whisper a detectat vorbire, dar nu a putut transcriere. Cele mai frecvente cauze:

1. **Model greșit** — Folosind un model numai engleză pe audio non-englezesc. Folosește `large-v3`.

2. **Calitate audio** — Mediile zgomotoase (bucătării, mulțimi, ecou) pot depăși modelul medium. Încearcă `large-v3`.

3. **Limbă mixtă** — Fișierele cu două limbi alternante vor avea limba minoritară înlocuită cu substituenți cu setare de limbă unică.

---

## Traducerea subtitrărilor produce doar engleză

Acesta este comportamentul intenționat. Indicatorul `--translate` integrat al Whisper traduce doar **în engleză**. Pentru traducere în alte limbi țintă, procesează conținutul fișierului `.srt` separat.

---

## Transcrierea în lot a încetat să avanseze

Apelează din nou `check_batch_progress`. Dacă tot este blocată:

1. Verifică Task Manager pentru un proces `whisper-cli.exe` care rulează
2. Verifică jurnalele sarcinilor în `%TEMP%\whisper-mcp-jobs\`
3. Fișierele cu erori sunt marcate în raportul lotului — rulează-le individual cu `transcribe_audio`

---

## Curățarea directorului temporar de sarcini

whisper-windows-mcp scrie fișiere de stare a sarcinilor și jurnale în `%TEMP%\whisper-mcp-jobs\` în timpul transcrierii. Acestea se acumulează în timp și pot consuma spațiu pe disc, în special fișierele `.log` din sarcinile lungi de transcriere.

Odată ce un lot sau o sarcină este finalizată și ai verificat transcrierile de ieșire, poți șterge în siguranță totul din acest director:

```powershell
Remove-Item "$env:TEMP\whisper-mcp-jobs\*" -Recurse -Force
```

Directorul va fi recreat automat la următoarea transcriere. Niciun fișier de ieșire a transcrierii nu este stocat permanent aici — sunt mutate în directorul sursă la finalizare. Rămân doar metadate ale sarcinilor și jurnale.

**Notă:** Nu șterge acest director în timp ce o transcriere este în curs — fișierele de stare a lotului sunt necesare pentru funcționarea `check_batch_progress`.

---

## Lot mare nesupravegheit din linia de comandă

Pentru loturi foarte mari în care vrei să rulezi peste noapte fără Claude, folosește PowerShell.

**Important:** whisper-cli.exe nu poate citi direct MP4, MKV sau majoritatea formatelor video. FFmpeg trebuie să preconvertească fiecare fișier la WAV mai întâi. Whisper scrie de asemenea transcrierea la stdout și ieșirea de diagnosticare la stderr — folosește `Start-Process -RedirectStandardOutput` pentru a capta corect transcrierea. Folosirea pipe `|` sau redirecționarea stderr cu `2>$null` nu capturează nimic.

```powershell
$whisper = "C:\whisper\Release\whisper-cli.exe"
$model   = "C:\whisper\models\ggml-medium.en.bin"
$dir     = "C:\path\to\your\folder"
$ffmpeg  = "ffmpeg"
$tmp     = "$env:TEMP\whisper_convert.wav"

Get-ChildItem "$dir\*.mp4" | ForEach-Object {
    $out = ($_.FullName -replace '\.mp4$', '') + ".txt"
    if (Test-Path $out) {
        Write-Host "SKIP (exists): $($_.Name)"
        return
    }
    Write-Host "Converting:    $($_.Name)"
    & $ffmpeg -y -i $_.FullName -ar 16000 -ac 1 -c:a pcm_s16le $tmp 2>$null
    Write-Host "Transcribing:  $($_.Name)"
    $wArgs = "-m `"$model`" -f `"$tmp`" --threads 8 --condition-on-previous-text 0 --no-speech-thold 0.6"
    Start-Process -FilePath $whisper -ArgumentList $wArgs -RedirectStandardOutput $out -Wait -NoNewWindow
    Write-Host "Done:          $($_.BaseName).txt"
}

Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host "All done."
```

Schimbă `*.mp4` cu `*.mkv`, `*.m4a` etc. pentru a corespunde tipurilor tale de fișiere. Verificarea de sărire `Test-Path` înseamnă că rularea din nou a scriptului după o întrerupere nu va reprocesa fișierele deja finalizate.

Aceasta scrie fișiere `.txt` lângă fiecare sursă. Instrumentele MCP le vor recunoaște ca deja transcrise când rulezi ulterior `analyze_media` sau `start_batch`.

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
