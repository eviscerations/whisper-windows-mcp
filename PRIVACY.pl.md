# Architektura prywatności — whisper-windows-mcp

Ten dokument opisuje, jakie dane pozostają na twoim komputerze, jakie dane go opuszczają i jak skonfigurować narzędzie dla treści regulowanych lub wrażliwych.

---

## Podstawowa gwarancja

whisper-windows-mcp jest zbudowany na architekturze lokalnej. **Pliki audio i wideo nigdy nie opuszczają twojego komputera.** Transkrypcja przebiega całkowicie na twoim sprzęcie przy użyciu whisper.cpp — żadna usługa w chmurze, połączenie internetowe ani wywołanie API nie są zaangażowane w samą transkrypcję.

Ta gwarancja jest bezwarunkowa dla plików multimedialnych.

---

## Dane, które zawsze pozostają lokalnie

| Dane | Opuszcza komputer? |
|---|---|
| Pliki audio | ❌ Nigdy |
| Pliki wideo | ❌ Nigdy |
| Pliki modeli Whisper | ❌ Nigdy |
| Tymczasowe pliki WAV konwersji | ❌ Nigdy (usuwane po transkrypcji) |
| Pliki stanu partii i zadań | ❌ Nigdy |
| Pliki transkrypcji `.txt` / `.srt` / `.vtt` na dysku | ❌ Nigdy |

---

## Dane, które mogą opuścić komputer (tryb standardowy)

Gdy odpowiedź narzędzia zawiera tekst transkrypcji, tekst ten jest zwracany do Claude Desktop i przetwarzany przez API Anthropic. Jest to standardowe zachowanie MCP — tekst podróżuje z lokalnego serwera MCP do modelu Claude przez sieć.

| Dane | Opuszcza komputer? |
|---|---|
| Tekst transkrypcji zwracany inline w odpowiedziach narzędzi | ✅ Tak, w trybie standardowym |
| Tekst transkrypcji przesłany bezpośrednio do Claude jako plik | ✅ Tak (poza MCP — żadna kontrola prywatności nie ma zastosowania) |

Ta luka istnieje między gwarancją narzędzia "żadne dane nie opuszczają twojego komputera" a rzeczywistym zachowaniem, gdy prosisz Claude o odczytanie, podsumowanie lub analizę transkrypcji. Większość użytkowników — transkrybujących publiczne treści, takie jak filmy z YouTube, podcasty lub nagrania streamów — nie jest dotknięta tym rozróżnieniem.

Dla użytkowników obsługujących prywatne, poufne lub regulowane nagrania to rozróżnienie ma znaczenie.

---

## Tryb prywatności

`WHISPER_PRIVACY_MODE` ogranicza wszystkie odpowiedzi narzędzi tylko do metadanych. Po włączeniu:

- Odpowiedzi narzędzi zwracają tylko: nazwę pliku, liczbę słów, ścieżkę zapisu, status ukończenia
- Żaden tekst transkrypcji nie jest uwzględniany w żadnej odpowiedzi narzędzia
- Claude nie może odczytywać, analizować ani przekazywać treści transkrypcji w żadnej formie
- Transkrypcje istnieją tylko jako lokalne pliki na dysku

Tryb prywatności jest przeznaczony dla wdrożeń prawnych, medycznych, finansowych i korporacyjnych, gdzie treść transkrypcji nie może opuścić środowiska lokalnego w żadnych okolicznościach.

### Globalne włączenie (zmienna środowiskowa)

Ustaw w `claude_desktop_config.json`:

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

Wymaga restartu Claude Desktop, aby wejść w życie.

### Włączenie dla pojedynczego wywołania (bez restartu)

Przekaż `privacy_mode=true` bezpośrednio do dowolnego narzędzia transkrypcji:

- *"Transkrybuj ten plik w trybie prywatności"*
- *"Rozpocznij partię w tym folderze, privacy_mode=true"*
- *"Sprawdź postęp zadania job_123, privacy_mode=true"*

Parametr dla pojedynczego wywołania zastępuje globalną zmienną środowiskową w obu kierunkach. Przekaż `privacy_mode=false`, aby wyłączyć dla jednego wywołania, nawet gdy `WHISPER_PRIVACY_MODE=true` globalnie.

### Zachowanie bramy trybu prywatności

Gdy tryb prywatności jest aktywny, potwierdzenie ujawnienia jest wyświetlane **przed każdą operacją**. Jest to celowe — zgodność z przepisami wymaga świadomej zgody przed każdym zdarzeniem przetwarzania, a nie tylko raz na sesję.

Tekst ujawnienia jest identyczny za każdym razem z projektu. Powtórzenie jest istotą: jeśli obsługujesz wrażliwe treści, powinieneś jawnie potwierdzać każdą operację.

Potwierdzenie jest powiązane z **konkretną operacją** — narzędziem wraz z jego dokładnymi argumentami. Potwierdzenie jednej transkrypcji nie może spełnić bramki innej operacji, a zmiana dowolnego parametru jest traktowana jako nowa operacja wymagająca własnego potwierdzenia.

Dla `start_batch` z trybem prywatności: przed rozpoczęciem partii wymagane jest jedno potwierdzenie. Następnie wszystkie pliki są przetwarzane bez nadzoru. Tekst transkrypcji nie jest zwracany w żadnym momencie — tylko metadane postępu partii.

---

## Brama zgody (tryb standardowy)

Gdy tryb prywatności nie jest aktywny, jednorazowe ujawnienie dla sesji jest wyświetlane przed pierwszym zwróceniem tekstu transkrypcji do API Claude w sesji.

Ujawnienie obejmuje:
- Że tekst transkrypcji zostanie przesłany do API Anthropic
- Ramy regulacyjne, które mogą mieć zastosowanie do twoich treści
- Jak włączyć tryb prywatności w razie potrzeby
- Jak trwale pominąć bramę dla treści niepoufnych

Po potwierdzeniu brama nie uruchamia się ponownie przez resztę sesji. Restart Claude Desktop resetuje sesję i brama uruchamia się ponownie przy następnym wywołaniu zwracającym transkrypcję.

**Dla zadań w tle:** brama zgody uruchamia się przy ukończeniu `check_progress`, a nie przy wywołaniu `transcribe_audio`. W momencie wywołania tekst transkrypcji jeszcze nie istnieje — nie ma czego blokować. Brama uruchamia się w momencie, gdy tekst transkrypcji byłby po raz pierwszy zwrócony do API.

### Trwałe pomijanie bramy

Jeśli regularnie transkrybujesz treści niepoufne i nie potrzebujesz już przypomnienia, ustaw w konfiguracji:

```json
"WHISPER_CONSENT_ACKNOWLEDGED": "true"
```

Nie ma to żadnego efektu, gdy tryb prywatności jest aktywny. Tryb prywatności używa własnej bramy per operację, która zawsze uruchamia się niezależnie od tego ustawienia.

---

## Podsumowanie przepływu danych

| Tryb | Audio | Tekst transkrypcji | Wymagane potwierdzenie |
|---|---|---|---|
| Standardowy | Tylko lokalnie | Wysyłany do API Anthropic | Raz na sesję (brama zgody) |
| Tryb prywatności (zm. środow.) | Tylko lokalnie | Nigdy nie przesyłany | Przed każdą operacją |
| Tryb prywatności (jedn. wywołanie) | Tylko lokalnie | Nie dla tego wywołania | Przed tą operacją |
| `WHISPER_CONSENT_ACKNOWLEDGED=true` | Tylko lokalnie | Wysyłany do API Anthropic | Nigdy (pominięte) |

---

## Przesyłanie plików transkrypcji bezpośrednio do Claude

Gdy przesyłasz plik transkrypcji `.txt` bezpośrednio do Claude jako załącznik — całkowicie poza narzędziem MCP — serwer MCP nie ma wglądu i nie może zastosować żadnych kontroli prywatności.

Przesłanie transkrypcji bezpośrednio do Claude jest równoznaczne z wysłaniem treści audio do Anthropic. Tryb prywatności i wszystkie zabezpieczenia na poziomie MCP są całkowicie omijane przez bezpośrednie przesyłanie plików.

Użytkownicy obsługujący treści regulowane nie powinni przesyłać transkrypcji bezpośrednio do Claude. Jedyną bezpieczną ścieżką analizy treści regulowanych są lokalne narzędzia do przetwarzania, które nie przesyłają treści na zewnątrz.

---

## Wskazówki dla regulowanych branż

Poniższe informacje mają charakter wyłącznie ogólny. Autorzy tego narzędzia nie są prawnikami. Użytkownicy ponoszą wyłączną odpowiedzialność za przestrzeganie obowiązujących przepisów prawa i regulacji. W razie wątpliwości skonsultuj się z wykwalifikowanym prawnikiem przed transkrypcją regulowanych treści.

### HIPAA (USA — opieka zdrowotna)
Świadczeniodawcy opieki zdrowotnej, ubezpieczyciele i ich partnerzy biznesowi mają zakaz przesyłania Chronionych Informacji Zdrowotnych (PHI) do nieautoryzowanych stron trzecich bez Umowy Partnera Biznesowego (BAA). Anthropic nie oferuje HIPAA BAA dla korzystania z konsumenckiego API Claude.

**Dotyczy przypadków użycia:** Konsultacje pacjentów, notatki kliniczne, sesje terapeutyczne, połączenia dotyczące roszczeń ubezpieczeniowych, administracyjne nagrania szpitalne.

**Zalecenie:** Włącz `WHISPER_PRIVACY_MODE=true` przed transkrypcją jakiegokolwiek audio pacjentów. Nie wyłączaj w trakcie sesji.

### RODO (UE/EOG)
Dane osobowe rezydentów UE nie mogą być przekazywane podmiotom przetwarzającym będącym stronami trzecimi bez wyraźnej zgody i podstawy prawnej przetwarzania. Tekst transkrypcji zawierający imiona, lokalizacje lub jakiekolwiek dane identyfikacyjne stanowi dane osobowe zgodnie z RODO.

**Dotyczy przypadków użycia:** Wywiady, spotkania, nagrania call center, postępowania sądowe z udziałem rezydentów UE.

**Zalecenie:** Włącz tryb prywatności dla każdego nagrania, które może zawierać dane osobowe rezydentów UE/EOG.

### Tajemnica adwokacka (USA, Wielka Brytania, Australia i większość jurysdykcji common law)
Komunikacja między adwokatami a klientami jest prawnie chroniona. Ujawnienie nieautoryzowanym stronom trzecim może znieść tę ochronę. Nie ma ugruntowanego precedensu prawnego chroniącego komunikację adwokacką przetwarzaną przez komercyjne API AI.

**Dotyczy przypadków użycia:** Zeznania prawne, konsultacje z klientami, wewnętrzne nagrania strategiczne, wywiady ze świadkami.

**Zalecenie:** Adwokaci transkrybujący chronioną komunikację powinni włączyć tryb prywatności. Nie wyłączaj do analizy — używaj lokalnych edytorów tekstu lub narzędzi do przetwarzania dla chronionych treści.

### FERPA (USA — edukacja)
Dokumentacja edukacyjna uczniów jest chroniona. Szkoły i uczelnie nie mogą ujawniać możliwych do zidentyfikowania informacji o uczniach stronom trzecim bez zgody.

**Dotyczy przypadków użycia:** Nagrane wykłady, sesje doradcze dla studentów, przesłuchania akademickie, spotkania IEP.

### SOX (USA — spółki publiczne)
Komunikacja finansowa spółek publicznych podlega wymogom dotyczącym przechowywania dokumentacji i poufności. Istotne informacje niepubliczne (MNPI) nie mogą być ujawniane selektywnie.

**Dotyczy przypadków użycia:** Nagrania konferencji wynikowych, protokoły posiedzeń zarządu, komunikacja z inwestorami, wewnętrzne dyskusje strategii finansowej.

### PCI-DSS
Dane kart płatniczych nie mogą być przechowywane ani przesyłane w niezabezpieczonych środowiskach. Nagrania głosowe numerów kart podczas transakcji są objęte zakresem.

**Dotyczy przypadków użycia:** Nagrania call center, rozmowy obsługi klienta dotyczące przetwarzania płatności.

### Ochrona tajemnicy handlowej / NDA
Poufne informacje biznesowe, zastrzeżone formuły, szczegóły nieopublikowanych produktów i informacje personalne mogą być chronione umową lub prawem.

**Dotyczy przypadków użycia:** Spotkania dotyczące strategii korporacyjnej, dyskusje R&D, rozmowy due diligence M&A, postępowania HR.

---

## Zgłaszanie problemów z prywatnością

Jeśli zidentyfikujesz problem z prywatnością lub lukę architektoniczną nieomówioną tutaj, użyj prywatnego raportowania podatności GitHub zamiast otwierania publicznego zgłoszenia. Instrukcje raportowania znajdziesz w [SECURITY.md](SECURITY.md).
