# whisper-windows-mcp

[![CI](https://github.com/eviscerations/whisper-windows-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/eviscerations/whisper-windows-mcp/actions/workflows/ci.yml)

[![whisper-windows-mcp MCP server](https://glama.ai/mcp/servers/eviscerations/whisper-windows-mcp/badges/card.svg)](https://glama.ai/mcp/servers/eviscerations/whisper-windows-mcp)

Server MCP (Model Context Protocol) nativ pentru Windows. Folosește [whisper.cpp](https://github.com/ggml-org/whisper.cpp) pentru transcrierea locală a fișierelor audio și video în Claude Desktop — cu accelerare GPU, suport multilingv și procesare în lot. Toată transcrierea se execută local — niciun fișier audio, video sau cale de fișier nu este trimis în exterior.

> **De ce există acest pachet?**
> Pachetul popular `whisper-mcp` a fost creat pentru macOS și presupune un mediu Unix. Nu funcționează pe Windows. Acest pachet a fost scris special pentru utilizatorii Windows care doresc transcriere AI locală integrată cu Claude Desktop.

---

## Ce poți face

După instalare, poți spune direct în Claude Desktop:

- *"Transcrie C:\Users\Me\Downloads\meeting.mp3"*
- *"Transcrie toate înregistrările din acest folder și salvează fiecare ca fișier text"*
- *"Creează subtitrări în română și engleză pentru acest video"*
- *"Începe transcrierea în lot a tuturor fișierelor din acest folder"*
- *"Cât timp va dura să transcrii aceste fișiere?"*
- *"Verifică dacă accelerarea GPU funcționează"*
- *"Transcrie acest fișier în modul de confidențialitate"*

---

## Cerințe

1. **Node.js 18 sau mai nou** — [nodejs.org](https://nodejs.org)
2. **Binar whisper.cpp cu suport Vulkan GPU** — vezi Pasul 1
3. **Fișier model Whisper** — vezi Pasul 2
4. **FFmpeg** — necesar pentru fișiere video și formate audio altele decât WAV/MP3

---

## Pasul 1 — Instalarea binarelor whisper.cpp

### Opțiunea A — Versiune Vulkan precompilată (recomandat)

Descarcă `whisper-vulkan-win-x64.zip` de pe [pagina de versiuni](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0).

Aceasta este o compilare personalizată cu **accelerare Vulkan GPU** activată. Funcționează cu GPU-uri AMD, NVIDIA și Intel — fără a necesita SDK-uri specifice producătorului.

Extrage în `C:\whisper\Release\`. Ar trebui să ai:

```
C:\whisper\Release\whisper-cli.exe
C:\whisper\Release\ggml-vulkan.dll
C:\whisper\Release\ggml.dll
C:\whisper\Release\ggml-base.dll
C:\whisper\Release\ggml-cpu.dll
C:\whisper\Release\whisper.dll
```

Accelerarea GPU este activată automat — nu este necesară configurație suplimentară.

### Opțiunea B — Compilare din sursă

Necesar: Git, CMake, Visual Studio Build Tools 2022+ cu "Desktop development with C++", Vulkan SDK de la [lunarg.com](https://vulkan.lunarg.com/sdk/home#windows).

```
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target whisper-cli
```

Copiază binarele din `build\bin\Release\` în `C:\whisper\Release\`.

> **Notă:** Versiunile oficiale whisper.cpp pentru Windows pe GitHub nu includ compilarea Vulkan. Folosește versiunea precompilată de mai sus sau compilează din sursă cu `-DGGML_VULKAN=ON`.

---

## Pasul 2 — Descărcarea modelului Whisper

| Model | Dimensiune | Viteză | Precizie | Cel mai bun pentru |
|---|---|---|---|---|
| `ggml-tiny.en.bin` | 75 MB | Foarte rapid | De bază | Teste rapide |
| `ggml-base.en.bin` | 142 MB | Rapid | Bună | Engleză zilnică |
| `ggml-small.en.bin` | 466 MB | Moderat | Mai bună | Înregistrări importante |
| `ggml-medium.en.bin` | 1,5 GB | Rapid pe GPU | Foarte bună | Engleză de cea mai înaltă calitate |
| `ggml-large-v3-turbo.bin` | 1,6 GB | Rapid pe GPU | Excelentă | **Recomandat pentru lot GPU — ~6x mai rapid decât large-v3 cu pierdere minimă de precizie** |
| `ggml-large-v3.bin` | 2,9 GB | Rapid pe GPU | Excelentă | Multilingv, precizie maximă |
| `ggml-medium.en-q5_0.bin` | 514 MB | Rapid | Foarte bună | **Cea mai bună alegere CPU-only pentru engleză — precizie ridicată cu memorie redusă** |
| `ggml-large-v3-turbo-q5_0.bin` | 547 MB | Rapid | Excelentă | **Cea mai bună alegere CPU-only multilingv** |
| `ggml-large-v3-q5_0.bin` | 1,1 GB | Moderat pe CPU | Excelentă | Multilingv, prietenos cu CPU |

Folosește `download_model` în Claude Desktop pentru instalare directă. Pentru **numai engleză**: `large-v3-turbo` (GPU) sau `medium.en-q5_0` (CPU). Pentru **multilingv**: `large-v3-turbo` sau `large-v3-turbo-q5_0` (CPU). Modelele numai engleză (`*.en.bin`) generează `[FOREIGN]` pentru audio care nu este în engleză și nu pot fi folosite pentru alte limbi.

---

## Pasul 3 — Instalarea FFmpeg

FFmpeg este necesar pentru fișiere video și formate audio non-native.

Instalare via winget:
```
winget install ffmpeg
```

Sau descarcă de la [ffmpeg.org](https://ffmpeg.org/download.html) și adaugă la PATH.

Verificare:
```
ffmpeg -version
```

---

## Pasul 4 — Instalarea serverului MCP

```
npm install -g whisper-windows-mcp
```

---

## Pasul 5 — Configurarea Claude Desktop

Deschide Claude Desktop → Setări → Dezvoltator → Editează configurația.

Adaugă intrarea `whisper`:

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-medium.en.bin"
      }
    }
  }
}
```

Locația fișierului de configurare: `C:\Users\NumeUtilizator\AppData\Roaming\Claude\claude_desktop_config.json`

> Folosește **bare oblice inverse duble** în toate căile.

Salvează și **repornește complet** Claude Desktop. Vei vedea **whisper** listat cu o insignă verde "în execuție" în Setări → Dezvoltator.

---

## Pasul 6 — Verificarea instalării

În Claude Desktop, întreabă:

> *"Verifică configurația whisper"*

Apoi:

> *"Verifică hardware-ul sistemului"*

Aceasta confirmă că GPU-ul tău a fost detectat și accelerarea Vulkan este activă.

---

## Instrumente disponibile

### `transcribe_audio`
Transcrie un singur fișier. Suportă modul de blocare (implicit) sau în fundal pentru fișiere lungi.

| Parametru | Descriere |
|---|---|
| `file_path` | Calea absolută către fișier (obligatoriu) |
| `language` | Cod limbă (`ro`, `en`, `ja` etc.) sau `auto` pentru detectare automată. Implicit: `en` |
| `output_format` | `timestamps` (implicit), `text`, `json`, `srt`, `vtt`, `lrc` sau `csv` |
| `save_to_file` | Salvează transcrierea ca .txt lângă fișierul sursă |
| `background` | Rulează ca sarcină separată — returnează imediat ID-ul sarcinii. Folosește `check_progress` pentru monitorizare. Recomandat pentru fișiere de peste 10 minute. |
| `privacy_mode` | Suprascrie modul de confidențialitate pentru acest apel. `true` = doar metadate, niciun text de transcriere nu este transmis. `false` = returnează text chiar dacă `WHISPER_PRIVACY_MODE=true` global. Omite pentru a folosi setarea globală. |
| `threads` | Suprascrie numărul de fire CPU |
| `temperature` | Temperatura de eșantionare 0,0–1,0. Implicit 0,0 (determinist). |
| `prompt` | Șir de context anterior — îmbunătățește precizia pentru vocabular specific domeniului sau nume de vorbitori. |
| `condition_on_prev_text` | Reactivează condiționarea contextului între segmente. Implicit false. |
| `beam_size` | Lățimea de căutare beam. Mai mare = mai precis, mai lent. Implicit 5. |
| `best_of` | Numărul de secvențe candidate evaluate. Implicit 5. |
| `gpu_device` | Indexul dispozitivului GPU pentru sisteme multi-GPU. Implicit 0. |
| `processors` | Numărul de procesoare paralele. Implicit 1. |
| `word_timestamps` | Un cuvânt pe segment cu marcaj de timp. Util pentru alinierea clipurilor. |
| `max_segment_length` | Lungimea maximă a segmentului în caractere. |
| `diarize` | Diarizare vorbitori stereo — necesită audio stereo cu vorbitori pe canale separate. |
| `vad_model` | Calea către fișierul .bin al modelului Silero VAD. Elimină tăcerea înainte de transcriere — reduce halucinațiile în fișierele zgomotoase. |
| `offset_t` | Decalajul de pornire în milisecunde. |
| `duration` | Durata de procesat în milisecunde de la decalaj. |

**Formate de ieșire:**
- `timestamps` — segmente cu marcaje de timp, ex. `[00:00:01.230 --> 00:00:04.560]  Bună ziua` (implicit)
- `text` — text simplu fără coduri de timp
- `json` — JSON structurat (doar modul de blocare)
- `srt` — fișier subtitrări SubRip salvat lângă sursă
- `vtt` — fișier subtitrări WebVTT salvat lângă sursă
- `lrc` — format LRC versuri/karaoke salvat lângă sursă
- `csv` — CSV cu marcaje de timp salvat lângă sursă

---

### `check_progress`
Monitorizează o sarcină de transcriere în fundal pornită cu `transcribe_audio` (background=true).

Returnează timpul scurs, ultimul marcaj de timp procesat și transcrierea completă la finalizare.

| Parametru | Descriere |
|---|---|
| `job_id` | ID-ul sarcinii returnat de `transcribe_audio` |
| `privacy_mode` | Suprascrie modul de confidențialitate pentru această verificare. `true` = doar metadate, indiferent de modul în care sarcina a fost pornită. |

---

### `start_batch`
Transcrie automat și secvențial toate fișierele netranscrise dintr-un folder. Sortează după durată (cele mai scurte primele), procesează câte unul ca sarcini în fundal și validează fiecare ieșire. Lotul avansează automat după finalizarea fiecărui fișier — nu este necesară interogare.

| Parametru | Descriere |
|---|---|
| `folder_path` | Calea către folder (obligatoriu) |
| `language` | Cod limbă. Implicit: `en` |
| `threads` | Suprascrie numărul de fire CPU |
| `output_format` | `timestamps` (implicit) sau `text` |
| `privacy_mode` | Suprascrie modul de confidențialitate. O confirmare este necesară înainte de începerea lotului; toate fișierele sunt apoi procesate nesupravegheate. Niciun text de transcriere nu este returnat. |

---

### `check_batch_progress`
Monitorizează un lot în execuție. Avansează automat la fișierul următor când cel curent se termină. Returnează progresul general, fișierul curent cu marcaj de timp și fișierele cu erori.

| Parametru | Descriere |
|---|---|
| `batch_id` | ID-ul lotului returnat de `start_batch` |

---

### `transcribe_batch` (interactiv)
Procesează fișierele unul câte unul cu previzualizare și confirmare înaintea fiecăruia. Util când vrei să revizuiești pe parcurs.

| Parametru | Descriere |
|---|---|
| `folder_path` | Calea către folder (obligatoriu) |
| `file_index` | Ce fișier să proceseze (începând de la 1). Omite pentru a lista fișierele mai întâi. |
| `language` | Cod limbă. Implicit: `en` |
| `recursive` | Include subdirectoare |
| `output_format` | `timestamps` (implicit) sau `text` |
| `privacy_mode` | Suprascrie modul de confidențialitate. Confirmare necesară înainte de fiecare fișier; sunt returnate doar metadate. |

---

### `generate_subtitles`
Generează fișiere de subtitrări. Suportă detectarea automată a limbii și ieșire cu traducere în engleză. Generează SRT (compatibilitate maximă) sau WebVTT (web și video HTML5).

| Parametru | Descriere |
|---|---|
| `file_path` | Calea către fișier (obligatoriu) |
| `language` | Cod limbă sau `auto` pentru detectare automată. Implicit: `en` |
| `output_format` | `srt` (implicit) sau `vtt` |
| `translate_to_english` | Generează și un fișier de subtitrări cu traducere în engleză. Se aplică doar când sursa nu este în engleză. |
| `background` | Rulează ca sarcină în fundal. Returnează ID sarcină pentru `check_progress`. |
| `threads` | Suprascrie numărul de fire CPU |

Când ambele sunt solicitate, două fișiere sunt salvate lângă sursă:
- `numefisier.ro.srt` — limba originală
- `numefisier.en.srt` — traducere în engleză

> Traducerea încorporată Whisper traduce doar **în engleză**. Pentru alte limbi țintă, procesează conținutul fișierului .srt separat.

---

### `analyze_media`
Analizează fișierele înainte de transcriere. Returnează durata, dimensiunea, codecul și timpul estimat de transcriere pe CPU și GPU. Pentru foldere, afișează toate fișierele într-un tabel sortabil cu starea transcrierii.

| Parametru | Descriere |
|---|---|
| `path` | Calea către un singur fișier sau folder (obligatoriu) |
| `sort_by` | Pentru foldere: `duration` (implicit), `name` sau `size` |

---

### `check_config`
Verifică dacă whisper-cli.exe, fișierul model și FFmpeg sunt toate accesibile. Rulează aceasta mai întâi dacă ceva nu funcționează.

---

### `list_models`
Listează toate fișierele model Whisper instalate în directorul tău de modele. Afișează numele fișierului, dimensiunea, dacă este activ, starea de cuantizare și cazurile de utilizare recomandate. Fără apeluri de rețea — citește doar sistemul de fișiere local.

---

### `download_model`
Descarcă un model Whisper direct de la Hugging Face în directorul tău de modele. Descarcă doar din spații de nume Hugging Face de încredere. După descărcare, folosește `switch_model` pentru activare.

| Parametru | Descriere |
|---|---|
| `model_name` | Numele modelului de descărcat, ex.: `large-v3-turbo`, `large-v3-turbo-q5_0`, `medium.en-q5_0` |

---

### `switch_model`
Schimbă modelul Whisper activ pentru sesiunea curentă fără a reporni Claude Desktop. Modificarea este valabilă doar pentru sesiune — nu persistă după repornire. Pentru a face permanentă, actualizează `WHISPER_MODEL` în configurația ta.

| Parametru | Descriere |
|---|---|
| `model_name` | Numele fișierului model (ex.: `ggml-large-v3-turbo.bin`) sau calea completă. Trebuie să fie un fișier `.bin` în directorul de modele configurat. |

---

### `check_system`
Detectează hardware-ul GPU și confirmă dacă accelerarea Vulkan este disponibilă. Raportează numele GPU, VRAM, prezența `ggml-vulkan.dll` și recomandă cea mai bună dimensiune de model pentru hardware-ul tău.

---

## Formate suportate

| Tip | Formate |
|---|---|
| Native (fără conversie) | `mp3`, `wav` |
| Video (convertit automat prin FFmpeg) | `mp4`, `mkv`, `avi`, `mov`, `webm`, `flv`, `wmv`, `m4v`, `ts`, `3gp` |
| Audio (convertit automat prin FFmpeg) | `m4a`, `ogg`, `flac` |

---

## Accelerare GPU

Versiunea Vulkan precompilată activează automat accelerarea GPU. Testat pe AMD Radeon RX Vega 56 (GCN generația 5). Orice GPU cu suport Vulkan 1.0+ ar trebui să funcționeze, inclusiv NVIDIA și Intel Arc.

**Comparație performanță (model large-v3, fișier audio ~14 minute):**

| Hardware | Timp |
|---|---|
| Numai CPU (Ryzen 7 2700x, 8 fire) | ~22 minute (estimat) |
| GPU (Vega 56 prin Vulkan) | ~3min 22s |

Utilizarea GPU în timpul transcrierii este de obicei 15–20%, revenind la inactiv între fișiere.

Suportă Windows 10 și Windows 11.

---

## Suport multilingv

Whisper poate detecta automat limba vorbită și transcriere în acea limbă. Modelul de traducere încorporat traduce doar **în engleză**.

Pentru cea mai bună precizie multilingvă, folosește modelul `large-v3`. Modelele numai engleză (`*.en.bin`) nu pot detecta sau transcriere alte limbi.

**Exemplu — video în limbă străină cu subtitrări:**
1. Cere lui Claude să genereze subtitrări cu `language=auto` și `translate_to_english=true`
2. Whisper detectează limba și generează SRT sau VTT în limba originală
3. O a doua trecere generează traducerea în engleză
4. Încarcă SRT în VLC prin Subtitrări → Adaugă fișier de subtitrări, sau folosește VTT în orice player web

---

## Confidențialitate și conformitate

whisper-windows-mcp include o arhitectură de confidențialitate integrată pentru conținut sensibil și reglementat.

**Audio și video nu părăsesc niciodată calculatorul tău.** Această garanție este necondiționată.

**Textul de transcriere** este altceva — când este returnat inline într-un răspuns al instrumentului, este procesat de API-ul Claude. Pentru majoritatea utilizatorilor acesta este comportamentul așteptat. Pentru conținut reglementat (medical, juridic, financiar, corporativ) modul de confidențialitate previne aceasta.

**Modul de confidențialitate** restricționează toate răspunsurile instrumentelor doar la metadate (numele fișierului, numărul de cuvinte, calea de salvare). Niciun text de transcriere nu este transmis la API-ul Claude în nicio circumstanță. Activează per apel prin `privacy_mode=true` în orice instrument de transcriere, sau global prin `WHISPER_PRIVACY_MODE=true` în configurație.

**Poarta de consimțământ** — la prima utilizare per sesiune în modul standard, înainte de returnarea oricărui text de transcriere este afișată o dezvăluire completă de confidențialitate. Trebuie să confirmi explicit înainte de a continua. Setează `WHISPER_CONSENT_ACKNOWLEDGED=true` în configurație pentru a sări aceasta pentru conținut non-sensibil.

Vezi [PRIVACY.md](PRIVACY.md) pentru ghidul complet de conformitate (HIPAA, GDPR, privilegiu avocat-client, FERPA, SOX, PCI-DSS).

---

## Proiectat pentru utilizatorii planului gratuit

Acest instrument a fost creat pentru a minimiza interacțiunile cu API-ul Claude. Întregul flux de lucru de transcriere — scanare, analiză, coadă, execuție, validare — este proiectat să necesite cât mai puține interacțiuni Claude posibil. Munca grea se face local pe calculatorul tău.

---

## Variabile de mediu opționale

| Variabilă | Descriere |
|---|---|
| `WHISPER_CLI_PATH` | Calea către whisper-cli.exe (obligatoriu) |
| `WHISPER_MODEL` | Calea către fișierul model .bin (obligatoriu) |
| `WHISPER_THREADS` | Suprascrie numărul de fire CPU |
| `WHISPER_GPU_DEVICE` | Indexul dispozitivului Vulkan la care se fixează transcrierea, pentru sisteme cu mai multe GPU-uri (indexul de enumerare Vulkan — verifică jurnalul de pornire al whisper-cli; nu ordinea GPU din Windows). Suprascriabil per apel cu `gpu_device`. Vezi [TROUBLESHOOTING.md](TROUBLESHOOTING.md). |
| `WHISPER_FOREGROUND_MAX_SEC` | Limita transcrierii în prim-plan în secunde (implicit 210). Fișierele estimate să ruleze mai mult sunt direcționate către modul în fundal în loc să riște timpul de expirare al instrumentului de ~4 minute al Claude Desktop. |
| `FFMPEG_PATH` | Calea către ffmpeg dacă nu este în PATH-ul sistemului |
| `WHISPER_PRIVACY_MODE` | Când `true`, răspunsurile instrumentelor returnează doar metadate — niciun text de transcriere nu este transmis lui Claude. Pentru conținut reglementat sau confidențial. Poate fi suprascris per apel prin parametrul `privacy_mode`. Vezi [PRIVACY.md](PRIVACY.md). |
| `WHISPER_CONSENT_ACKNOWLEDGED` | Când `true`, suprimă dezvăluirea de consimțământ unică per sesiune înainte de returnarea textului de transcriere. Setează după ce ai revizuit limitele de confidențialitate când memento-ul nu mai este necesar. Nu are efect când modul de confidențialitate este activ. |

---

## Securitate

**Verificarea binarului.** Pentru a verifica integritatea binarului whisper-cli.exe din versiunea precompilată, verifică hash-ul său SHA256 în PowerShell:

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

Hash-ul așteptat pentru binarul de versiune este documentat pe [pagina de versiuni](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0).

**Validarea intrărilor.** Toate căile de fișiere sunt validate înainte de utilizare — căile UNC (`\\server\share`) și secvențele de traversare a directoarelor (`..`) sunt respinse. Fișierele peste 10 GB sunt respinse pentru a preveni epuizarea resurselor.

**Conștientizarea injecției de transcriere.** Fișierele audio pot conține conținut vorbit care, atunci când este transcris, seamănă cu instrucțiuni. Apărările încorporate ale Claude gestionează acest lucru, dar serverul MCP în sine tratează conținutul de transcriere ca date — niciodată ca instrucțiuni.

**Descărcările de modele sunt restricționate.** Instrumentul `download_model` descarcă doar din două spații de nume Hugging Face de încredere (`ggerganov/whisper.cpp` și `ggml-org`). URL-urile arbitrare sunt respinse. Redirecționările sunt validate față de o listă de permise înainte de a fi urmate.

**Schimbarea modelelor este sandboxată.** `switch_model` acceptă doar fișiere `.bin` în directorul de modele configurat. Căile din afara acelui director sunt respinse.

Vezi [SECURITY.md](SECURITY.md) pentru politica completă de securitate.

---

## Depanare

Vezi [TROUBLESHOOTING.md](TROUBLESHOOTING.md) pentru soluții detaliate. Vezi [PRIVACY.md](PRIVACY.md) dacă gestionezi conținut reglementat.

Listă de verificare rapidă:
- Căile din configurație folosesc **bare oblice inverse duble** (`C:\\whisper\\...`)
- `whisper-cli.exe` există la calea configurată
- Fișierul model `.bin` există la calea configurată
- FFmpeg instalat și în PATH (`ffmpeg -version` funcționează)
- Claude Desktop a fost **repornit complet** după editarea configurației
- Whisper apare ca **în execuție** (insignă verde) în Setări → Dezvoltator

---

## Licență

**Utilizare non-comercială:** MIT — gratuit pentru uz personal, educațional și non-comercial. Vezi [LICENSE](LICENSE).

**Utilizare comercială:** Este necesar un acord de licență comercială separat pentru orice utilizare în afaceri, profesională sau generatoare de venituri. Vezi [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) pentru termeni și informații de contact.

## Contribuții

Pull request-urile sunt binevenite. Vezi [ROADMAP.md](ROADMAP.md) pentru funcțiile planificate.

Dacă ai testat accelerarea GPU pe hardware nelistat mai sus, deschide un issue cu rezultatele — modelul GPU, VRAM, dimensiunea modelului și debitul observat.
