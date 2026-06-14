# whisper-windows-mcp — Foaie de parcurs

Versiunea curentă: **v2.4.0**

---

## Principii de proiectare

Aceste principii guvernează fiecare decizie din acest proiect și au prioritate față de viteza de adăugare a funcțiilor.

**Minimizarea utilizării API-ului Claude.** Întregul flux de lucru de transcriere — scanare, analiză, coadă, execuție, validare, schimbare modele — trebuie să poată fi executat cu cât mai puține interacțiuni Claude posibil. Acest instrument trebuie să funcționeze complet pentru utilizatorii Claude cu plan gratuit care nu plătesc pentru abonamente Pro sau Max. Fiecare apel de instrument consumă buget de utilizare. Proiectează în consecință.

**Întotdeauna o singură instanță whisper.** Nu crea niciodată un al doilea proces whisper-cli.exe când unul rulează deja. Blocarea proceselor este obligatorie și nu poate fi negociată.

**Local prioritar, privat implicit.** Audio-ul nu părăsește niciodată calculatorul. Niciun API cloud nu este necesar pentru funcționalitatea de bază. Integrările opționale (ex.: descărcări de modele de la Hugging Face) trebuie documentate clar ca opționale.

**Control explicit al utilizatorului.** Fără operațiuni în masă silențioase. Acțiunile distructive sau ireversibile necesită confirmare. Utilizatorul trebuie să știe întotdeauna ce se va întâmpla înainte să se întâmple.

**Căi sigure pentru Unicode.** Toată I/O de fișiere trebuie să gestioneze corect numele de fișiere non-ASCII, inclusiv română, japoneză, chineză, emoji, paranteze și alte caractere speciale.

**Modular și combinabil.** Instrumentele sunt independente. Utilizatorii folosesc ce au nevoie. Nicio funcție nu ar trebui să necesite alta, cu excepția cazurilor inevitabile.

**Optimizare înainte de funcții.** Când ai îndoieli între adăugarea unei funcții și reducerea sarcinii sistemului sau a numărului de apeluri API — reduce sarcina. Sesiunile mari de optimizare sunt costisitoare. Proiectează arhitectura corect de la început.

---

## Finalizat

### ✅ v1.3.1 — Blocare procese
Adăugat verificarea `isWhisperRunning()` folosind `tasklist /FI` înainte de a crea orice proces de transcriere. Returnează o eroare clară cu instrucțiuni Task Manager în loc să creeze un proces concurent.

### ✅ v1.4.0 — Accelerare GPU Vulkan
Compilat whisper.cpp din sursă cu `-DGGML_VULKAN=ON` folosind VS Build Tools 2022 și Vulkan SDK. Binarele Vulkan precompilate distribuite ca `whisper-vulkan-win-x64.zip`.

**Rezultate pe AMD Radeon RX Vega 56:** Utilizare medie GPU ~16%. Fișier de 58 minute finalizat în ~4,5 minute pe GPU față de ~88 minute numai CPU.

### ✅ v1.5.0 — Diagnosticare sistem
Instrument `check_system`: detectare GPU prin `wmic`, verificare DLL Vulkan, raportare VRAM, recomandare dimensiune model.

### ✅ v1.6.0 — Pre-analiză fișier
Instrument `analyze_media` prin FFprobe: durată, dimensiune, codec, stare transcriere, estimări timp CPU și GPU. Scanare fișier unic sau folder cu opțiuni de sortare.

### ✅ v1.7.0 — Transcriere în fundal + Vizibilitate progres
Arhitectură proces detașat: `transcribe_audio` cu `background=true` pornește whisper ca proces detașat și returnează imediat ID-ul sarcinii. `check_progress` parsează marcajele de timp ale segmentelor stderr whisper pentru procent și ETA în timp real.

### ✅ v1.8.0 — Lot secvențial cu validare
`start_batch` și `check_batch_progress`: procesare secvențială automată, validare transcriere (detectare ieșire goală/scurtă), avansare automată coadă, marcaje de timp progres per fișier.

### ✅ v1.9.0 — Suport multilingv și traducere
`generate_subtitles` cu detecție `language=auto` și ieșire SRT dublă `translate_to_english=true`. Adăugat suport formate `.3gp` și `.ts`. `language=auto` disponibil și în `transcribe_audio`.

**Limitare cunoscută:** Traducerea încorporată Whisper țintește doar engleza. Necesită model `large-v3` pentru limbi non-engleze — modelele numai engleză (`*.en.bin`) generează `[FOREIGN]` pentru audio non-englezesc.

### ✅ v2.0.0 — Căi sigure Unicode + SRT în fundal
**Nume fișiere Unicode:** Fișierele cu caractere non-ASCII în nume cauzau eșecuri silențioase ale transcrierii în fundal. Remediat prin direcționarea tuturor ieșirilor printr-o cale temporară igienizată bazată pe ID sarcină, apoi mutarea rezultatului la destinația corectă după finalizare.

**SRT în modul fundal:** `spawnDetached` anterior codifica rigid `-otxt` indiferent de formatul solicitat. Remediat prin adăugarea parametrului `outputFormat` la `spawnDetached`, suportând ieșire `text` și `srt` în modul fundal.

### ✅ v2.0.1 — Corecții erori (incluse în v2.2.0)
- `--max-context 0` codificat rigid în `buildArgs` și `spawnDetached` — previne buclele de halucinație pe audio lung.
- `--no-speech-thold 0.6` codificat rigid în ambele funcții — segmentele sub pragul de încredere sunt tratate ca tăcere.
- Validare cale (`validateInputPath`) — respinge căile UNC și traversările `..`.
- Gardă dimensiune fișier `MAX_FILE_SIZE_MB = 10240`.
- Comentariu securitate injecție transcriere în `transcribeSingle`.
- Comandă CLI lot coruptă corectată în TROUBLESHOOTING.md.

### ✅ v2.1.0 — Suită de gestionare modele (inclusă în v2.2.0)
- `WHISPER_MODEL` schimbat din `const` în `let` (mutabil în sesiune).
- `MODEL_REGISTRY` — 16 modele, variante de precizie completă și cuantizate, URL-uri de descărcare Hugging Face.
- `ALLOWED_HF_PREFIXES` — lista de permise URL care limitează descărcările la spațiile de nume `ggerganov/whisper.cpp` și `ggml-org`.
- Instrument `list_models` — scanează directorul de modele, arată modelul activ, dimensiuni, cazuri de utilizare, descărcări disponibile.
- Instrument `download_model` — descarcă de la Hugging Face prin `https` integrat Node.js, redenumire atomică.
- Instrument `switch_model` — validează extensia `.bin`, restricție director, verificare blocare proces.
- `recommendedModel()` actualizat pentru a recomanda `large-v3-turbo` pentru VRAM 6GB+.

### ✅ v2.2.0 — Extindere calitate, parametri și hardware
- Interfață `WhisperOptions` înlocuind argumentele poziționale în `buildArgs`.
- Parametri noi în `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Parametri noi în `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` refactorizat — toate indicatoarele de calitate sunt acum aplicate în modul fundal/lot.
- Ieșire lot corectată — `readBatchProgress` acum mută ieșirea temporară la destinația finală înainte de validare.

**Notă compatibilitate indicatoare:** `gpu_device` / `--device` a fost adăugat în whisper.cpp v1.8.4. Binarul Vulkan precompilat în versiuni este de generație v1.8.3 — acest parametru este acceptat de instrument dar nu va avea efect până când utilizatorii nu actualizează la un binar v1.8.4+.

### ✅ v2.2.2 — Patch
- Corecție licență duală — LICENSE și LICENSE-COMMERCIAL.md corectate.
- Corecții minore de documentație.

### ✅ v2.3.0 — Avansare automată lot, arhitectură confidențialitate, extindere formate de ieșire

**Avansare automată lot (corecție bug critic):** `start_batch` necesita anterior interogare activă pentru a avansa coada. Un handler `on('exit')` este acum atașat fiecărui proces copil whisper-cli pornit. Când procesul iese, lotul avansează automat prin callback-ul de ieșire cu zero costuri de interogare și zero apeluri API consumate. Un mutex previne lansarea dublă între handler-ul de ieșire concurrent și apelurile `check_batch_progress`.

**Arhitectură confidențialitate:**
- Variabila de mediu `WHISPER_PRIVACY_MODE` — când `true`, toate răspunsurile instrumentelor returnează doar metadate (numele fișierului, numărul de cuvinte, calea de salvare). Niciun text de transcriere nu este transmis vreodată la API-ul Claude. Transcrierile există doar ca fișiere locale.
- Variabila de mediu `WHISPER_CONSENT_ACKNOWLEDGED` — când `true`, suprimă poarta de consimțământ unică per sesiune pentru conținut non-sensibil.
- Parametrul `privacy_mode` per apel în `transcribe_audio`, `transcribe_batch`, `start_batch` și `check_progress`. Suprascrie variabila de mediu globală în ambele direcții. Nu necesită repornire pentru a comuta per apel.
- Poarta modului de confidențialitate (`checkPrivacyGate()`) — se activează înainte de fiecare operațiune când modul de confidențialitate efectiv este activ.
- Poarta de consimțământ sesiune (`transcriptPolicy()`) — se activează o dată per sesiune înainte de primul apel care returnează transcriere în modul standard.
- `PRIVACY.md` — documentație completă de conformitate acoperind HIPAA, GDPR, privilegiu avocat-client, FERPA, SOX, PCI-DSS și NDA/secret comercial.

**Extindere formate de ieșire:**
- `vtt` — ieșire WebVTT prin `-ovtt`. Disponibil în `transcribe_audio`, `generate_subtitles`, `start_batch` și modul fundal.
- `lrc` — format LRC versuri/karaoke prin `-olrc`. Disponibil în `transcribe_audio` și modul fundal.
- `csv` — CSV cu marcaje de timp prin `-ocsv`. Disponibil în `transcribe_audio` și modul fundal.
- `output_format` implicit schimbat din `"text"` în `"timestamps"` în toate instrumentele și căile de cod.

**Corecții bug:**
- Bug 1: `output_format` nu era transmis sarcinilor în fundal — implicit `"text"` era folosit indiferent de formatul solicitat. Remediat prin schimbarea implicită la `"timestamps"` și transmitere corectă.
- Bug 2: `catch {}` silențios în operațiunea de mutare a ieșirii sarcinii în fundal înghițea eșecurile. Adăugat verificare explicită `existsSync` cu mesaj de eșec detaliat după mutare.
- Bug 3: Comentariu de design adăugat la punctul de lansare în fundal documentând de ce poarta de consimțământ este intenționat amânată la `check_progress` pentru sarcinile în fundal fără mod de confidențialitate.

**Suplimentar:**
- Curățare automată director temporar — `cleanupOldJobFiles()` rulează la pornire, șterge fișierele `.json` și `.log` mai vechi de 7 zile din `%TEMP%\whisper-mcp-jobs\`.
- `check_config` raportează acum starea modului de confidențialitate.
- Jurnalul de pornire raportează modul de confidențialitate activat/dezactivat.

### ✅ v2.4.0 — Întărire, gardă de expirare în prim-plan, suită de teste și CI

O trecere de securitate/robustețe; migrarea la Bun planificată a fost mutată la v2.5.0.

**Securitate și corectitudine:**
- Remediere a izolării căilor în `switch_model` — un director cu prefix-frate (de ex. `…\models-evil`) putea anterior satisface verificarea „în interiorul directorului de modele” printr-un `startsWith` naiv; înlocuit cu izolare normalizată bazată pe `relative()`. Închide evadarea pe care o descrie SECURITY.md.
- Bariera de confidențialitate/consimțământ cheiată **per operațiune** (instrument + argumente) — confirmarea unei transcrieri nu mai poate satisface bariera unei alte operațiuni.
- `download_model` respinge descărcările trunchiate (verificare Content-Length) înainte de a promova un fișier `.part`. (Verificarea completă a digestului SHA256 este urmărită pentru o trecere ulterioară.)
- Coerciția intrărilor — parametrii numerici de instrument care nu sunt numere reale sunt eliminați în loc să fie predați lui whisper-cli ca `NaN`.

**Robustețe:**
- **Gardă de expirare în prim-plan** — un fișier suficient de lung încât să depășească expirarea de ~4 minute a instrumentului MCP al Claude Desktop în mod blocant este detectat din timp și direcționat în fundal în loc să expire în tăcere. Prag configurabil prin `WHISPER_FOREGROUND_MAX_SEC`. Estimările de timp corectate (vechea estimare GPU subestima grav; costul dominant de reîncărcare a modelului este acum modelat — măsurat, nu ghicit).
- Scrieri atomice ale stării lucrărilor/loturilor (fișier temporar + redenumire) astfel încât un cititor concurent să nu poată observa un fișier JSON rupt.
- ID-uri de lucrare/lot/temporare rezistente la coliziuni (cu sufix UUID).
- Oprire grațioasă la SIGINT/SIGTERM care curăță fișierele temporare ale modului blocant.

**Selectarea dispozitivului GPU:**
- Variabila de mediu `WHISPER_GPU_DEVICE`, iar `gpu_device` este acum transmis prin `generate_subtitles` și prin trecerea de detectare a limbii (anterior doar `transcribe_audio`). `check_config` raportează dispozitivul activ. `check_system` nu mai raportează greșit o problemă de driver atunci când `wmic` (depreciat în Windows 11 24H2+) nu returnează nimic.

**Calitate:**
- O suită de teste unitare `node:test` peste logica pură (izolarea căilor, cheierea barierei, scrieri atomice, coerciția intrărilor, estimarea expirării), zero dependențe adăugate, plus un flux de lucru CI GitHub Actions care o rulează la fiecare push/PR.

**Identificat pentru o versiune viitoare:** o cale de model persistentă (de ex. `whisper-server` din whisper.cpp) pentru a elimina costul de reîncărcare a modelului plătit la fiecare transcriere — un câștig mare de debit pentru lucrul în lot/de arhivă.

---

## Planificat — v2.5.0: Migrare la Bun

Migrează runtime-ul de la Node.js la [Bun](https://bun.sh).

Deoarece Claude Desktop pornește serverul MCP din nou la fiecare pornire de sesiune, timpul de pornire este pe calea critică. Bun rulează TypeScript nativ fără pas de compilare, pornește semnificativ mai rapid decât Node și are I/O mai rapid.

**Ce se schimbă:**
- Elimină pasul de build `tsc` și directorul `dist/`
- Utilizatorii rulează direct codul sursă TypeScript
- `tsconfig.json` devine opțional
- Scripturi `package.json` actualizate
- Flux de lucru publicare npm actualizat

**Ce nu se schimbă:**
- Codul sursă `src/index.ts` — Bun este compatibil cu TypeScript existent și API-urile Node.js integrate
- Tot comportamentul instrumentelor și formatele de ieșire
- Configurația Claude Desktop pentru utilizatorii finali

---

## Planificat — v2.6.0: Formate de ieșire îmbunătățite pentru integrarea instrumentelor externe

Suport extins pentru formate de ieșire destinat fluxurilor de lucru de analiză și integrare din aval. Domeniul exact va fi definit pe baza feedback-ului utilizatorilor după v2.3.0.

---

## Planificat — v2.7.0: Modul de transcriere live din microfon

Transcriere în timp real din intrare microfon live. Transmite audio de la un dispozitiv de înregistrare selectat la whisper în bucăți, returnând segmente de transcriere continue pe măsură ce se finalizează.

**Constrângeri de proiectare:**
- Selecția dispozitivului trebuie să fie explicită — fără captare silențioasă a dispozitivului implicit
- Utilizatorul trebuie să poată opri fluxul printr-o interacțiune Claude Desktop
- Nu trebuie să intre în conflict cu constrângerea unei singure instanțe whisper simultan
- Compromisul latență vs precizie trebuie să fie configurabil de utilizator

**Status:** Faza de proiectare. Depinde de un API de streaming stabil în whisper.cpp.

---

## Planificat — Versiuni viitoare

### TinyDiarize
Suport pentru indicatorul `--tinydiarize` cu variante de model care suportă `tdrz` (ex.: `large-v2-tdrz`). Spre deosebire de indicatorul `--diarize` stereo, TinyDiarize funcționează pe înregistrări mono. Necesită descărcarea unui variant de model special. Precizie mai mică decât diarizarea bazată pe pyannote, dar zero dependențe suplimentare în afara fișierului model.

**Status:** Planificat. Depinde de `download_model` care suportă variantele de model tdrz.

### Transcriere URL YouTube
Transcriere directă din URL-uri YouTube prin yt-dlp. Descarcă audio și transcrie într-un singur pas. Necesită yt-dlp instalat și în PATH.

**Constrângere de proiectare:** yt-dlp este opțional. Instrumentul trebuie să degradeze elegant cu instrucțiuni clare de instalare dacă nu este găsit. Fără modificări ale funcționalității de bază pentru utilizatorii care nu au nevoie de aceasta.

### Instrumente flux de lucru proiect video
Pentru utilizatorii care gestionează proiecte mari de editare video cu directoare de clipuri sursă și editate:

1. Scanează directorul sursă și subdirectorul de clipuri
2. Potrivire fuzzy a transcrierilor clipurilor editate față de transcrierile sursă pentru a localiza punctele de origine
3. Afișează nume de fișiere descriptive sugerate de Claude bazate pe conținutul transcrierii, necesitând confirmarea explicită a utilizatorului înainte de orice redenumire
4. Căutare transcrieri în directorul proiectului cu rezultate în coduri de timp

**Constrângeri de proiectare:**
- Fișierele sursă nu sunt **niciodată redenumite sau modificate**
- Toate redenumirile necesită **confirmarea explicită a utilizatorului**
- Căutarea este un instrument independent, utilizabil independent
- Analiza și potrivirea au loc local — Claude este invocat doar când utilizatorul revizuiește rezultatele, minimizând apelurile API

**Status:** Faza de proiectare.

### Diarizare vorbitori (pyannote-audio)
Diarizare completă mono cu etichete ID vorbitor — marchează tranzițiile vorbitorilor pe toată înregistrarea indiferent de configurația canalelor. Diferit de indicatorul `--diarize` stereo integrat (v2.2.0) și TinyDiarize.

**Implementare:** Necesită [pyannote-audio](https://github.com/pyannote/pyannote-audio) — bibliotecă bazată pe Python cu cerință de token acces modele Hugging Face. Stivă de dependențe complet separată.

**Status:** Funcție avansată opțională cu propria documentație de configurare. Nu este inclusă în pachetul principal.

### Traducere în limbi non-engleze
Indicatorul `--translate` al Whisper țintește doar engleza. Suportarea limbilor țintă arbitrare necesită un API de traducere extern sau un model de traducere local.

**Opțiuni luate în considerare:** LibreTranslate (auto-găzduit, local prioritar), traducere LLM local sau documentație explicită în afara domeniului.

**Status:** Amânat în așteptarea deciziei de proiectare privind local prioritar vs dependența API.

### Curățare și formatare transcrieri
Pipeline de post-procesare:
- Eliminarea cuvintelor de umplutură și a pornirilor false (opțional, controlat de utilizator)
- Pauze de paragraf la granițele naturale ale subiectelor
- Formatare conștientă de vorbitor combinată cu ieșire diarizare
- Export în PDF sau DOCX

**Status:** Planificat. Varianta conștientă de vorbitor depinde de diarizare.

---

## Licențiere

whisper-windows-mcp folosește licențiere duală.

**Utilizare non-comercială:** MIT — gratuit pentru uz personal, educațional și non-comercial. Vezi [LICENSE](LICENSE).

**Utilizare comercială:** Este necesar un acord de licență comercială separat pentru orice utilizare în afaceri, profesională sau generatoare de venituri. Vezi [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md) pentru termeni și informații de contact.

---

## Distribuție

Disponibil pe [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), [Glama](https://glama.ai) și [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers).

---

## Documentație multilingvă

După fiecare versiune, următoarele fișiere trebuie actualizate pentru a corespunde documentelor în engleză:

**Japoneză (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Coreeană (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Vietnameză (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Indoneziană (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Ucraineană (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Portugheză braziliană (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Spaniolă (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

**Poloneză (`*.pl.md`)** — `README.pl.md` / `TROUBLESHOOTING.pl.md` / `ROADMAP.pl.md` / `PRIVACY.pl.md` / `SECURITY.pl.md`

**Română (`*.ro.md`)** — `README.ro.md` / `TROUBLESHOOTING.ro.md` / `ROADMAP.ro.md` / `PRIVACY.ro.md` / `SECURITY.ro.md`

Contribuțiile comunității pentru alte limbi sunt binevenite.

---

## Contribuții

Pull request-urile sunt binevenite. Verifică issue-urile existente înainte de a începe lucrul.

Dacă ai testat accelerarea GPU pe hardware nelistat mai sus, deschide un issue cu modelul GPU, VRAM, dimensiunea modelului și debitul observat. Aceasta ajută la construirea unei referințe de performanță precise pentru alți utilizatori.
