# whisper-windows-mcp — Foaie de parcurs

Versiunea curentă: **v2.5.0**

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

## Planificat — v2.5.0: Server de model persistent

Menține modelul Whisper rezident între transcrieri în loc să-l reîncarci la fiecare invocare.

Acesta este cel mai mare câștig de debit disponibil. whisper-cli este unic: reîncarcă modelul complet la fiecare apel, iar v2.4.0 a măsurat acea reîncărcare la ~110s pe un GPU cu memorie limitată — o taxă fixă plătită per fișier, independentă de lungimea audio. Pentru sarcinile de lot și de arhivă domină timpul de execuție mai mult decât transcrierea în sine.

**Abordare:** rulează `whisper-server` (HTTP) livrat cu whisper.cpp ca un singur proces de lungă durată cu modelul păstrat în memorie. Serverul MCP trimite fiecare transcriere către el prin localhost și primește rezultatele înapoi fără a plăti din nou costul de reîncărcare.

**Reconciliere cu „o singură instanță whisper în orice moment":** principiul este păstrat, mecanismul evoluează. Serverul rezident *devine* singura instanță; blocarea proceselor se schimbă din „nu crea niciodată un al doilea whisper-cli" în „serializează cererile față de singurul server rezident". Nu se introduce nicio concurență.

**Constrângeri de proiectare:**
- Ciclu de viață explicit: start / stop / status, cu o verificare de sănătate. Serverul nu este pornit niciodată în tăcere ca efect secundar al unui apel fără legătură.
- Legat doar la localhost — niciodată o interfață rutabilă. Fără expunere în rețea (coerent cu principiul local-prioritar și cu întărirea din v2.4.0).
- Rezervă grațioasă: dacă serverul nu rulează, transcrierea funcționează în continuare prin calea whisper-cli unică existentă. Serverul este o optimizare, nu o dependență obligatorie.
- `switch_model` reîncarcă modelul în serverul rezident (tot mult mai ieftin amortizat decât reîncărcarea per fișier).
- Barierele de confidențialitate și consimțământ sunt neschimbate — se află deasupra mecanismului de transcriere.
- Selectarea portului cu gestionarea coliziunilor; închidere curată la SIGINT/SIGTERM alături de curățarea existentă a fișierelor temporare.

**Status — Faza 1 ✅ implementată (în așteptarea lansării):** instrumentul `whisper_server` (`start` / `stop` / `status`); `transcribe_audio` și `transcribe_batch` în mod blocant sunt direcționate prin serverul rezident prin localhost (`127.0.0.1`, verificat față de API-ul HTTP actual al `whisper-server` din whisper.cpp); `switch_model` schimbă la cald modelul rezident prin `POST /load` fără repornire; garda de expirare în prim-plan este sărită în modul server (nicio reîncărcare de plătit); `check_config` raportează starea serverului; serverul deținut este oprit la închidere pentru a elibera VRAM. Regula un-singur-motor / VRAM-partajat este aplicată cu o protecție dură în calea de lansare detașată plus refuzuri prietenoase: cât timp serverul este pornit, sarcinile în fundal, `start_batch`, `generate_subtitles`, ieșirea `lrc`/`csv` și opțiunile per cerere pe care API-ul HTTP nu le onorează (`beam_size`, `best_of`, `word_timestamps`, `diarize`, `tinydiarize`, `vad_model`, `offset_t`, `duration` etc.) sunt refuzate cu un mesaj „oprește serverul mai întâi" în loc să degradeze în tăcere. Configurare: `WHISPER_SERVER_PATH`, `WHISPER_SERVER_PORT` (implicit 8571, doar localhost).

**Status — Faza 2 (planificată):** direcționează fundal/`start_batch` prin serverul rezident. Acesta este câștigul mai mare de arhivă/debit și necesită rescrierea stratului de sarcini/coadă în jurul cererilor HTTP în loc de PID-uri detașate (progres fără PID, anulare). Reevaluat după ce Faza 1 este livrată.

---

## Planificat — v2.6.0: TinyDiarize (schimbări de vorbitor pe mono, zero dependențe suplimentare)

Suport `--tinydiarize` cu variante de model activate `tdrz` (ex.: `ggml-small.en-tdrz.bin`). Spre deosebire de indicatorul stereo `--diarize` (v2.2.0), TinyDiarize marchează schimbările de vorbitor pe înregistrări **mono** și nu necesită nimic în afara fișierului model — fără Python, fără serviciu extern.

**Domeniu:**
- Adaugă variantele de model `tdrz` în `MODEL_REGISTRY` astfel încât `download_model` să le poată prelua din spațiile de nume Hugging Face de încredere existente.
- Conectează o opțiune `tinydiarize` prin `buildArgs` și `spawnDetached` astfel încât să funcționeze în modurile blocant, fundal și lot.

**Status:** ✅ Implementat (în așteptarea lansării) — parametrul `tinydiarize` în `transcribe_audio` și `generate_subtitles` (funcționează în modurile blocant și fundal), `--tinydiarize` conectat prin ambele constructoare de argumente și `small.en-tdrz` adăugat în `MODEL_REGISTRY` pentru `download_model`. Pe-etos: local-prioritar, zero dependențe suplimentare.

---

## Planificat — v2.7.0: Căutare transcrieri la nivel de proiect

Un instrument independent pentru a căuta o frază sau un tipar în fiecare transcriere dintr-un director de proiect și a returna potrivirile cu fișierul sursă și codul de timp. Descompus din fluxul de lucru mai amplu de proiect video (vezi „Mai târziu / În considerare") — această jumătate este utilă independent, cu risc scăzut și puțin dependentă de API: căutarea rulează local, iar Claude este implicat doar când utilizatorul revizuiește rezultatele.

**Status:** Planificat.

---

## Planificat — v2.8.0: Formate de ieșire îmbunătățite și integrare

Ieșire extinsă pentru fluxurile de lucru de analiză și integrare din aval. Un decalaj concret de închis: ieșirea JSON nu este momentan suportată în modul fundal (revine la text). JSON la nivel de cuvânt pentru alinierea clipurilor și alte formate de integrare urmează să fie definite pe baza feedback-ului utilizatorilor.

---

## Mai târziu / În considerare

Neprogramat, dar pe-etos și reevaluat pe măsură ce capacitatea permite.

### Migrare la Bun
Migrează runtime-ul de la Node.js la [Bun](https://bun.sh) pentru a reduce timpul de pornire la rece al serverului MCP și a elimina pasul de build `tsc` (sursa rulează direct). Retrogradat din fostul său loc v2.5.0: cu costul de reîncărcare a modelului per invocare fiind adevăratul blocaj (vezi v2.5.0 mai sus), reducerea timpului de pornire al Node este un câștig marginal, iar maturitatea Bun-pe-Windows plus o schimbare a modelului de distribuție implică risc. Merită făcut eventual ca o optimizare opțională, nu ca o prioritate.

### Flux de lucru redenumire și potrivire proiect video
Jumătatea mai grea a instrumentelor de proiect, odată ce Căutarea transcrierilor la nivel de proiect (v2.7.0) este livrată: potrivire fuzzy a transcrierilor clipurilor editate față de transcrierile sursă pentru a localiza punctele de origine și afișarea numelor de fișiere descriptive sugerate de Claude.

**Constrângeri de proiectare:**
- Fișierele sursă nu sunt **niciodată redenumite sau modificate**
- Toate redenumirile necesită **confirmarea explicită a utilizatorului**
- Analiza și potrivirea au loc local — Claude este invocat doar când utilizatorul revizuiește rezultatele, minimizând apelurile API

**Status:** Faza de proiectare.

### Curățare transcrieri bazată pe reguli
Post-procesare locală, deterministă — eliminarea cuvintelor de umplutură și a pornirilor false, controlată de utilizator. Cea mai valoroasă pentru utilizatorii modului de confidențialitate, unde transcrierea nu ajunge niciodată la Claude pentru curățare. Deliberat îngustă: împărțirea în paragrafe și segmentarea pe subiecte sunt lucruri pe care Claude le face deja bine pe textul returnat, iar exportul PDF/DOCX este o extindere de domeniu în generarea de documente — ambele în afara domeniului aici.

**Status:** În considerare.

### Diarizare vorbitori (pyannote-audio)
Diarizare completă mono cu etichete ID vorbitor pe toată înregistrarea. Diferit de indicatorul stereo `--diarize` integrat (v2.2.0) și TinyDiarize (v2.6.0).

**Implementare:** necesită [pyannote-audio](https://github.com/pyannote/pyannote-audio) — o bibliotecă Python cu cerință de token de acces Hugging Face, o stivă de dependențe complet separată. Deprioritizat: intră în conflict cu etosul local-prioritar / zero-dependențe, iar TinyDiarize acoperă deja cazul mono zero-dependențe. Dacă este urmărit, se livrează ca un add-on avansat opțional cu propriile documente de configurare, niciodată în pachetul principal.

**Status:** Deprioritizat / opțional.

### Traducere în limbi non-engleze
Indicatorul `--translate` al Whisper țintește doar engleza. Limbile țintă arbitrare necesită un API de traducere extern sau un model de traducere local.

**Opțiuni luate în considerare:** LibreTranslate (auto-găzduit, local-prioritar), traducere LLM local sau documentație explicită în afara domeniului.

**Status:** Amânat în așteptarea unei decizii local-prioritar vs dependență-API.

---

## În afara domeniului / Neplanificat

Funcții excluse intenționat, consemnate aici astfel încât decizia să fie explicită și să nu reapară în mod repetat.

### Transcriere live din microfon — neplanificată
Transcrierea în timp real dintr-un microfon live era anterior programată pentru v2.7.0. Eliminată deoarece intră în conflict cu designul de bază al proiectului:
- **Nepotrivire de arhitectură:** MCP este cerere/răspuns, nu streaming. Captura live ar necesita fie interogare continuă (consumă buget API), fie un apel blocant de lungă durată care atinge garda de expirare în prim-plan din v2.4.0.
- **Principii o-singură-instanță / minimizare-API:** returnarea segmentelor continue către Claude este un flux constant de apeluri de instrument — opusul „funcțional pentru utilizatorii planului gratuit" — iar un proces de streaming de lungă durată solicită blocarea proceselor.
- **Dependență externă:** ar depinde de un API de streaming stabil în whisper.cpp care nu ne aparține pentru a-l programa.

Subtitrarea live este o categorie de produs distinctă (latență scăzută, gestionarea dispozitivelor, VAD) față de un instrument de transcriere fișier/lot. Utilizatorii care au nevoie de ea sunt mai bine serviți de un instrument dedicat în timp real.

### Transcriere URL YouTube (yt-dlp) — neplanificată ca instrument inclus
YouTube-la-transcriere direct prin yt-dlp era anterior planificat. Abandonat ca funcție de primă clasă deoarece:
- **Suprafață de securitate:** adaugă preluarea de URL-uri arbitrare și un apel de subproces cu intrare controlată de utilizator, inversând întărirea din v2.4.0 care a redus exact acea suprafață.
- **Întreținere:** yt-dlp se strică frecvent pe măsură ce YouTube se schimbă — un angajament de întreținere continuu.
- **Local-prioritar și licențiere:** achiziția de conținut din rețea se află în afara domeniului local-prioritar, iar includerea unui descărcător într-un proiect cu licență comercială este o zonă gri de ToS/răspundere.
- **Redundant:** utilizatorii pot rula yt-dlp ei înșiși și îndrepta `transcribe_audio` către fișierul rezultat.

**Alternativă:** documentat ca o rețetă (rulează yt-dlp, apoi transcrie fișierul) în README / TROUBLESHOOTING, în loc de un instrument întreținut — fluxul de lucru rămâne disponibil fără a deține dependența sau suprafața de atac.

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
