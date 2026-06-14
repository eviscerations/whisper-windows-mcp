# Arhitectura de confidențialitate — whisper-windows-mcp

Acest document descrie ce date rămân pe calculatorul tău, ce date îl părăsesc și cum să configurezi instrumentul pentru conținut reglementat sau sensibil.

---

## Garanția de bază

whisper-windows-mcp este construit pe o arhitectură care prioritizează localul. **Fișierele audio și video nu părăsesc niciodată calculatorul tău.** Transcrierea rulează în întregime pe hardware-ul tău folosind whisper.cpp — niciun serviciu cloud, conexiune la internet sau apel API nu este implicat în transcrierea în sine.

Această garanție este necondiționată pentru fișierele media.

---

## Date care rămân întotdeauna local

| Date | Părăsește calculatorul? |
|---|---|
| Fișiere audio | ❌ Niciodată |
| Fișiere video | ❌ Niciodată |
| Fișiere model Whisper | ❌ Niciodată |
| Fișiere WAV temporare de conversie | ❌ Niciodată (șterse după transcriere) |
| Fișiere de stare lot și sarcini | ❌ Niciodată |
| Fișiere transcriere `.txt` / `.srt` / `.vtt` pe disc | ❌ Niciodată |

---

## Date care pot părăsi calculatorul (modul standard)

Când un răspuns al instrumentului include text de transcriere, acel text este returnat la Claude Desktop și procesat de API-ul Anthropic. Acesta este comportamentul standard MCP — textul călătorește de la serverul MCP local la modelul Claude prin rețea.

| Date | Părăsește calculatorul? |
|---|---|
| Text de transcriere returnat inline în răspunsurile instrumentelor | ✅ Da, în modul standard |
| Text de transcriere încărcat direct la Claude ca fișier | ✅ Da (în afara MCP — niciun control de confidențialitate nu se aplică) |

Acest decalaj există între garanția instrumentului "nicio dată nu părăsește calculatorul tău" și comportamentul real când ceri lui Claude să citească, să rezume sau să analizeze o transcriere. Majoritatea utilizatorilor — cei care transcriu conținut public precum videoclipuri YouTube, podcasturi sau înregistrări streaming — nu sunt afectați de această distincție.

Pentru utilizatorii care gestionează înregistrări private, confidențiale sau reglementate, această distincție contează.

---

## Modul de confidențialitate

`WHISPER_PRIVACY_MODE` restricționează toate răspunsurile instrumentelor doar la metadate. Când este activ:

- Răspunsurile instrumentelor returnează doar: numele fișierului, numărul de cuvinte, calea de salvare, starea de finalizare
- Niciun text de transcriere nu este inclus în niciun răspuns al instrumentului
- Claude nu poate citi, analiza sau retransmite conținut de transcriere în nicio formă
- Transcrierile există doar ca fișiere locale pe disc

Modul de confidențialitate este conceput pentru implementări juridice, medicale, financiare și corporative unde conținutul de transcriere nu trebuie să părăsească mediul local în nicio circumstanță.

### Activare globală (variabilă de mediu)

Setează în `claude_desktop_config.json`:

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

Necesită repornirea Claude Desktop pentru a intra în vigoare.

### Activare per apel (fără repornire)

Transmite `privacy_mode=true` direct oricărui instrument de transcriere:

- *"Transcrie acest fișier în modul de confidențialitate"*
- *"Începe un lot în acest folder, privacy_mode=true"*
- *"Verifică progresul sarcinii job_123, privacy_mode=true"*

Parametrul per apel suprascrie variabila de mediu globală în ambele direcții. Transmite `privacy_mode=false` pentru a dezactiva pentru un singur apel chiar și când `WHISPER_PRIVACY_MODE=true` global.

### Comportamentul porții modului de confidențialitate

Când modul de confidențialitate este activ, o dezvăluire de confirmare este afișată **înainte de fiecare operațiune**. Aceasta este intenționată — conformitatea reglementară necesită consimțământ informat înainte de fiecare eveniment de procesare, nu doar o dată pe sesiune.

Textul dezvăluirii este identic de fiecare dată prin design. Repetiția este intenționată: dacă gestionezi conținut sensibil, ar trebui să confirmi explicit fiecare operațiune.

Confirmarea este legată de **operațiunea specifică** — instrumentul împreună cu argumentele sale exacte. Confirmarea unei transcrieri nu poate satisface bariera unei alte operațiuni, iar modificarea oricărui parametru este tratată ca o operațiune nouă care necesită propria confirmare.

Pentru `start_batch` cu modul de confidențialitate: o confirmare este necesară înainte de începerea lotului. Toate fișierele sunt apoi procesate nesupravegheate. Niciun text de transcriere nu este returnat în niciun moment — doar metadate de progres ale lotului.

---

## Poarta de consimțământ (modul standard)

Când modul de confidențialitate nu este activ, o dezvăluire unică per sesiune este afișată înainte ca orice text de transcriere să fie returnat la API-ul Claude pentru prima dată în sesiune.

Dezvăluirea acoperă:
- Că textul de transcriere va fi transmis la API-ul Anthropic
- Cadrele reglementare care pot fi aplicabile conținutului tău
- Cum să activezi modul de confidențialitate dacă este necesar
- Cum să suprimezi permanent poarta pentru conținut non-sensibil

După confirmare, poarta nu se mai activează pentru restul sesiunii. Repornirea Claude Desktop resetează sesiunea și poarta se activează din nou la următorul apel care returnează transcriere.

**Pentru sarcini în fundal:** poarta de consimțământ se activează la finalizarea `check_progress`, nu la apelul `transcribe_audio`. La momentul apelului, textul de transcriere nu există încă — nu este nimic de blocat. Poarta se activează în momentul în care textul de transcriere ar fi returnat pentru prima dată la API.

### Suprimarea permanentă a porții

Dacă transcrii în mod regulat conținut non-sensibil și nu mai ai nevoie de memento, setează în configurația ta:

```json
"WHISPER_CONSENT_ACKNOWLEDGED": "true"
```

Aceasta nu are niciun efect când modul de confidențialitate este activ. Modul de confidențialitate folosește propria sa poartă per operațiune care se activează întotdeauna indiferent de această setare.

---

## Rezumat flux de date

| Mod | Audio | Text de transcriere | Confirmare necesară |
|---|---|---|---|
| Standard | Doar local | Trimis la API-ul Anthropic | O dată per sesiune (poarta de consimțământ) |
| Mod confidențialitate (var. mediu) | Doar local | Niciodată transmis | Înainte de fiecare operațiune |
| Mod confidențialitate (per apel) | Doar local | Nu pentru acest apel | Înainte de această operațiune |
| `WHISPER_CONSENT_ACKNOWLEDGED=true` | Doar local | Trimis la API-ul Anthropic | Niciodată (suprimate) |

---

## Încărcarea fișierelor de transcriere direct la Claude

Când încarci un fișier de transcriere `.txt` direct la Claude ca atașament — complet în afara instrumentului MCP — serverul MCP nu are vizibilitate și nu poate aplica niciun control de confidențialitate.

Încărcarea unei transcrieri direct la Claude este echivalentă cu trimiterea conținutului audio către Anthropic. Modul de confidențialitate și toate protecțiile la nivel MCP sunt ocolite complet de încărcările directe de fișiere.

Utilizatorii care gestionează conținut reglementat nu trebuie să încarce transcrieri direct la Claude. Singura cale de analiză sigură pentru conținut reglementat sunt instrumentele de procesare locale care nu transmit conținut extern.

---

## Îndrumare pentru sectoarele reglementate

Următoarele sunt doar informații generale. Autorii acestui instrument nu sunt avocați. Utilizatorii sunt singurii responsabili pentru respectarea legilor și reglementărilor aplicabile. În caz de îndoială, consultați un avocat calificat înainte de a transcriere conținut reglementat.

### HIPAA (SUA — îngrijire medicală)
Furnizorii de servicii medicale, asigurătorii și partenerii lor de afaceri au interdicția de a transmite Informații de Sănătate Protejate (PHI) unor terți neautorizați fără un Acord de Partener de Afaceri (BAA). Anthropic nu oferă HIPAA BAA pentru utilizarea API-ului de consum Claude.

**Cazuri de utilizare afectate:** Consultații cu pacienții, note clinice, sesiuni de terapie, apeluri de revendicări de asigurări, înregistrări administrative ale spitalelor.

**Recomandare:** Activează `WHISPER_PRIVACY_MODE=true` înainte de a transcriere orice audio al pacienților. Nu dezactiva în mijlocul sesiunii.

### GDPR (UE/SEE)
Datele personale ale rezidenților UE nu pot fi transferate procesorilor terți fără consimțământ explicit și bază legală pentru procesare. Textul de transcriere care conține nume, locații sau orice informații de identificare constituie date personale conform GDPR.

**Cazuri de utilizare afectate:** Interviuri, întâlniri, înregistrări call center, proceduri judiciare care implică rezidenți UE.

**Recomandare:** Activează modul de confidențialitate pentru orice înregistrare care poate conține date personale ale rezidenților UE/SEE.

### Privilegiul avocat-client (SUA, Marea Britanie, Australia și majoritatea jurisdicțiilor de drept comun)
Comunicările dintre avocați și clienți sunt privilegiate legal. Divulgarea către terți neautorizați poate renunța la privilegiu. Nu există un precedent legal stabilit care să protejeze comunicările avocat-client atunci când sunt procesate de API-uri AI comerciale.

**Cazuri de utilizare afectate:** Depoziții legale, consultații cu clienți, înregistrări de strategie internă, interviuri cu martori.

**Recomandare:** Avocații care transcriu comunicări privilegiate ar trebui să activeze modul de confidențialitate. Nu dezactiva pentru analiză — folosește editori de text locali sau instrumente de procesare pentru conținut privilegiat.

### FERPA (SUA — educație)
Înregistrările educaționale ale elevilor sunt protejate. Școlile și universitățile nu pot dezvălui informații identificabile ale elevilor unor terți fără consimțământ.

**Cazuri de utilizare afectate:** Prelegeri înregistrate, sesiuni de consiliere a studenților, audieri academice, întâlniri IEP.

### SOX (SUA — companii publice)
Comunicările financiare ale companiilor publice sunt supuse cerințelor de păstrare a înregistrărilor și confidențialitate. Informațiile materiale nepublice (MNPI) nu pot fi dezvăluite selectiv.

**Cazuri de utilizare afectate:** Înregistrări ale conferințelor de rezultate, transcrieri ale ședințelor consiliului, comunicări cu investitorii, discuții interne de strategie financiară.

### PCI-DSS
Datele cardurilor de plată nu pot fi stocate sau transmise în medii nesecurizate. Înregistrările vocale ale numerelor de card în timpul tranzacțiilor sunt în domeniu.

**Cazuri de utilizare afectate:** Înregistrări call center, apeluri de serviciu clienți care implică procesarea plăților.

### Protecții secrete comerciale / NDA
Informațiile comerciale confidențiale, formulele proprietare, detaliile produselor nelansate și informațiile de personal pot fi protejate prin contract sau lege.

**Cazuri de utilizare afectate:** Întâlniri de strategie corporativă, discuții de C&D, apeluri de due diligence M&A, proceduri HR.

---

## Raportarea preocupărilor de confidențialitate

Dacă identifici o problemă de confidențialitate sau o lacună arhitecturală neacoperită aici, folosește raportarea privată a vulnerabilităților GitHub în loc să deschizi un issue public. Vezi [SECURITY.md](SECURITY.md) pentru instrucțiuni de raportare.
