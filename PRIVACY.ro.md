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
| Fișiere transcriere `.txt` / `.srt` pe disc | ❌ Niciodată |

---

## Date care pot părăsi calculatorul (comportament implicit)

Când un răspuns al instrumentului include text de transcriere, acel text este returnat la Claude Desktop și procesat de API-ul Anthropic. Acesta este comportamentul standard MCP — textul călătorește de la serverul MCP local la modelul Claude prin rețea.

| Date | Părăsește calculatorul? |
|---|---|
| Text de transcriere returnat inline în răspunsurile instrumentelor | ✅ Da, implicit |
| Text de transcriere încărcat direct la Claude ca fișier | ✅ Da (în afara MCP) |

Acest decalaj există între garanția instrumentului "nicio dată nu părăsește calculatorul tău" și comportamentul real când ceri lui Claude să citească, să rezume sau să analizeze o transcriere. Majoritatea utilizatorilor — cei care transcriu conținut public precum videoclipuri YouTube, podcasturi sau înregistrări streaming — nu sunt afectați de această distincție.

Pentru utilizatorii care gestionează înregistrări private, confidențiale sau reglementate, această distincție contează.

---

## Modul de confidențialitate (planificat — nu este încă implementat)

O variabilă de mediu `WHISPER_PRIVACY_MODE` este planificată pentru o versiune viitoare. Când este activată:

- Toate răspunsurile instrumentelor returnează doar metadate: numele fișierului, durata, numărul de cuvinte, starea de finalizare
- Niciun text de transcriere nu este inclus în niciun răspuns al instrumentului
- Claude nu poate citi, analiza sau retransmite conținut de transcriere în nicio formă
- Transcrierile există doar ca fișiere `.txt` locale pe disc

Acest mod este conceput pentru implementări juridice, medicale, financiare și corporative unde conținutul de transcriere nu trebuie să părăsească mediul local în nicio circumstanță.

**Configurație planificată:**

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

Până la lansarea acestei funcții: dacă trebuie să analizezi conținut de transcriere fără a-l transmite la API-ul Claude, deschide fișierul `.txt` direct într-un editor de text local sau instrument de procesare.

---

## Îndrumare pentru sectoarele reglementate

Următoarele sunt doar informații generale. Autorii acestui instrument nu sunt avocați. Utilizatorii sunt singurii responsabili pentru respectarea legilor și reglementărilor aplicabile. În caz de îndoială, consultați un avocat calificat înainte de a transcriere conținut reglementat.

### HIPAA (SUA — îngrijire medicală)
Furnizorii de servicii medicale, asigurătorii și partenerii lor de afaceri au interdicția de a transmite Informații de Sănătate Protejate (PHI) unor terți neautorizați fără un Acord de Partener de Afaceri (BAA). Anthropic nu oferă HIPAA BAA pentru utilizarea API-ului de consum Claude.

**Cazuri de utilizare afectate:** Consultații cu pacienții, note clinice, sesiuni de terapie, apeluri de revendicări de asigurări, înregistrări administrative ale spitalelor.

**Recomandare curentă:** Nu transcriere audio de pacienți și nu cere lui Claude să rezume sau să analizeze transcrierea dacă organizația ta nu a stabilit un aranjament de procesare conform. Folosește `WHISPER_PRIVACY_MODE` când devine disponibil.

### GDPR (UE/SEE)
Datele personale ale rezidenților UE nu pot fi transferate procesorilor terți fără consimțământ explicit și bază legală pentru procesare. Textul de transcriere care conține nume, locații sau orice informații de identificare constituie date personale conform GDPR.

**Cazuri de utilizare afectate:** Interviuri, întâlniri, înregistrări call center, proceduri judiciare care implică rezidenți UE.

**Recomandare curentă:** Fii conștient că încărcarea transcrierilor care conțin date personale ale rezidenților UE la Claude poate avea implicații GDPR în funcție de rolul și scopul tău de procesare.

### Privilegiul avocat-client (SUA, Marea Britanie, Australia și majoritatea jurisdicțiilor de drept comun)
Comunicările dintre avocați și clienți sunt privilegiate legal. Divulgarea către terți neautorizați poate renunța la privilegiu. Nu există un precedent legal stabilit care să protejeze comunicările avocat-client atunci când sunt procesate de API-uri AI comerciale.

**Cazuri de utilizare afectate:** Depoziții legale, consultații cu clienți, înregistrări de strategie internă, interviuri cu martori.

**Recomandare curentă:** Avocații care transcriu comunicări privilegiate nu ar trebui să încarce acele transcrieri la Claude pentru analiză fără o revizuire juridică independentă a implicațiilor privilegiului.

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

## Încărcarea fișierelor de transcriere direct la Claude

Când încarci un fișier de transcriere `.txt` direct la Claude ca atașament — complet în afara instrumentului MCP — serverul MCP nu are vizibilitate și nu poate aplica niciun control de confidențialitate.

Încărcarea unei transcrieri direct la Claude este echivalentă cu trimiterea conținutului audio către Anthropic. Niciun mod de confidențialitate sau protecție viitoare la nivel MCP nu se va aplica încărcărilor directe de fișiere.

Utilizatorii care gestionează conținut reglementat nu trebuie să încarce transcrieri direct la Claude. Singura cale de analiză sigură pentru conținut reglementat sunt instrumentele de procesare locale care nu transmit conținut extern.

---

## Raportarea preocupărilor de confidențialitate

Dacă identifici o problemă de confidențialitate sau o lacună arhitecturală neacoperită aici, folosește raportarea privată a vulnerabilităților GitHub în loc să deschizi un issue public. Vezi [SECURITY.md](SECURITY.md) pentru instrucțiuni de raportare.
