# whisper-windows-mcp — Foaie de parcurs

Versiunea curentă: **v2.2.0**

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

**SRT în modul fundal:** `spawnDetached` anterior codifica rigid `-otxt` indiferent de formatul solicitat, iar `generate_subtitles` bloca sincron și atingea limita de timp MCP de 4 minute pe fișiere mai lungi. Remediat prin adăugarea parametrului `outputFormat` la `spawnDetached`, suportând ieșire `text` și `srt` în modul fundal.

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

### ✅ v2.2.0 — Extindere calitate, parametri și hardware (curent)
- Interfață `WhisperOptions` înlocuind argumentele poziționale în `buildArgs`.
- Parametri noi în `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Parametri noi în `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- `spawnDetached` refactorizat — toate indicatoarele de calitate sunt acum aplicate în modul fundal/lot.
- Ieșire lot corectată — `readBatchProgress` acum mută ieșirea temporară la destinația finală înainte de validare.

---

## Bug critic — Avansare automată lot (confirmat, în așteptarea remedierii)

### Lotul nu avansează fără interogare activă

`start_batch` nu avansează autonom coada între fișiere. Lotul avansează doar când este apelat `check_batch_progress`. Fără interogare, lotul se oprește pe termen nedefinit după fiecare fișier.

**Remediere planificată — Opțiunea B (callback ieșire):** Atașează un handler `on('exit')` la procesul copil whisper-cli pornit. Când procesul iese, apelează imediat logica de avansare pentru a valida ieșirea și a porni sarcina următoare.

**Soluție temporară curentă:** Apelează `check_batch_progress` în mod repetat până când lotul se finalizează.

---

## Planificat — Arhitectură confidențialitate (înainte de migrarea la Bun)

### Variabila de mediu `WHISPER_PRIVACY_MODE`
Adaugă `WHISPER_PRIVACY_MODE` ca variabilă de mediu în `claude_desktop_config.json`. Când este activată, toate răspunsurile instrumentelor returnează doar metadate — niciun text de transcriere nu este inclus.

### Poartă de consimțământ pentru conținut de transcriere
Când `WHISPER_PRIVACY_MODE` nu este activat (implicit), orice răspuns al instrumentului care include text de transcriere trebuie precedat de o dezvăluire la prima utilizare per sesiune.

### Documentația `PRIVACY.md`
Creează `PRIVACY.md` în rădăcina depozitului cu îndrumări complete privind confidențialitatea și cadre de conformitate.

### Curățare automată director temporar
Adaugă curățare automată a fișierelor de sarcini finalizate după o fereastră de retenție configurabilă (implicit: 7 zile).

---

## Planificat — Migrare la Bun

Migrează runtime-ul de la Node.js la [Bun](https://bun.sh) după finalizarea arhitecturii de confidențialitate și înainte de adăugările de funcții v2.3.0. Bun rulează TypeScript nativ fără pas de compilare și pornește semnificativ mai rapid decât Node.

---

## Planificat — Revizuire licență (după migrarea la Bun)

Licența MIT actuală permite utilizarea comercială nelimitată. Licențiere duală planificată: MIT pentru uz personal și non-comercial, licență comercială separată pentru uz de afaceri și corporativ.

---

## Planificat — v2.3.0: Extindere formate de ieșire

### Format subtitrări VTT
Ieșire WebVTT (`.vtt`) împreună cu SRT. Standard web folosit de YouTube, HTML5 `<video>` și majoritatea playerelor moderne.

### Format LRC
Ieșire în format LRC (`.lrc`) versuri/karaoke prin `-olrc`.

### Format CSV
Ieșire CSV (`.csv`) prin `-ocsv`. Date tabulare structurate cu sincronizare segmente.

---

## Planificat — Versiuni viitoare

### TinyDiarize
Suport pentru indicatorul `--tinydiarize` cu variante de model care suportă `tdrz`. Funcționează pe înregistrări mono spre deosebire de indicatorul `--diarize` stereo.

### Transcriere URL YouTube
Transcriere directă din URL-uri YouTube prin yt-dlp. Necesită yt-dlp instalat și în PATH.

### Instrumente flux de lucru proiect video
Pentru utilizatorii care gestionează proiecte mari de editare video cu directoare de clipuri sursă și editate. Fișierele sursă nu sunt niciodată redenumite sau modificate fără confirmarea explicită a utilizatorului.

### Diarizare vorbitori (pyannote-audio)
Diarizare completă mono cu etichete ID vorbitor. Necesită pyannote-audio — bibliotecă bazată pe Python cu cerință de token acces modele Hugging Face.

### Traducere în limbi non-engleze
Indicatorul `--translate` al Whisper țintește doar engleza. Suportarea limbilor țintă arbitrare necesită un API de traducere extern sau un model de traducere local.

### Curățare și formatare transcrieri
Pipeline de post-procesare: eliminarea cuvintelor de umplutură, pauze de paragraf la granițele naturale ale subiectelor, formatare conștientă de vorbitor, export în PDF sau DOCX.

---

## Distribuție

Disponibil pe [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org) și [Glama](https://glama.ai).

---

## Documentație multilingvă

Documentația în japoneză, coreeană, vietnameză, indoneziană, ucraineană, portugheză braziliană, spaniolă, poloneză și română este menținută în paralel cu engleza. Următoarele fișiere trebuie actualizate pentru a corespunde documentelor în engleză după fiecare versiune:

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
