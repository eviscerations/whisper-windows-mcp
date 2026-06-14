# whisper-windows-mcp

[![CI](https://github.com/eviscerations/whisper-windows-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/eviscerations/whisper-windows-mcp/actions/workflows/ci.yml)

[![whisper-windows-mcp MCP server](https://glama.ai/mcp/servers/eviscerations/whisper-windows-mcp/badges/card.svg)](https://glama.ai/mcp/servers/eviscerations/whisper-windows-mcp)

Natywny serwer MCP (Model Context Protocol) dla Windows. Używa [whisper.cpp](https://github.com/ggml-org/whisper.cpp) do lokalnej transkrypcji plików audio i wideo w Claude Desktop — z akceleracją GPU, obsługą wielu języków i przetwarzaniem wsadowym. Cała transkrypcja odbywa się lokalnie — żadne pliki audio, wideo ani ścieżki do plików nie są wysyłane na zewnątrz.

> **Dlaczego ten pakiet istnieje?**
> Popularny pakiet `whisper-mcp` został stworzony dla macOS i zakłada środowisko Unix. Na Windows nie działa. Ten pakiet został napisany specjalnie dla użytkowników Windows, którzy chcą lokalnej transkrypcji AI zintegrowanej z Claude Desktop.

---

## Co możesz robić

Po instalacji możesz po prostu powiedzieć w Claude Desktop:

- *"Transkrybuj C:\Users\Me\Downloads\meeting.mp3"*
- *"Transkrybuj wszystkie nagrania w tym folderze i zapisz każde jako plik tekstowy"*
- *"Utwórz polskie i angielskie napisy do tego wideo"*
- *"Rozpocznij wsadową transkrypcję wszystkich plików w tym folderze"*
- *"Ile czasu zajmie transkrypcja tych plików?"*
- *"Sprawdź, czy akceleracja GPU działa"*
- *"Transkrybuj ten plik w trybie prywatności"*

---

## Wymagania

1. **Node.js 18 lub nowszy** — [nodejs.org](https://nodejs.org)
2. **Binaria whisper.cpp z obsługą Vulkan GPU** — patrz Krok 1
3. **Plik modelu Whisper** — patrz Krok 2
4. **FFmpeg** — wymagany dla plików wideo i formatów audio innych niż WAV/MP3

---

## Krok 1 — Instalacja binariów whisper.cpp

### Opcja A — Gotowa kompilacja Vulkan (zalecana)

Pobierz `whisper-vulkan-win-x64.zip` ze [strony wydań](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0).

Jest to niestandardowa kompilacja z włączoną **akceleracją Vulkan GPU**. Działa z GPU AMD, NVIDIA i Intel — bez potrzeby instalowania dodatkowych SDK producenta.

Rozpakuj do `C:\whisper\Release\`. Powinieneś mieć następujące pliki:

```
C:\whisper\Release\whisper-cli.exe
C:\whisper\Release\ggml-vulkan.dll
C:\whisper\Release\ggml.dll
C:\whisper\Release\ggml-base.dll
C:\whisper\Release\ggml-cpu.dll
C:\whisper\Release\whisper.dll
```

Akceleracja GPU jest włączana automatycznie — nie wymaga dodatkowej konfiguracji.

### Opcja B — Kompilacja ze źródeł

Wymagane: Git, CMake, Visual Studio Build Tools 2022+ z komponentem "Desktop development with C++", Vulkan SDK z [lunarg.com](https://vulkan.lunarg.com/sdk/home#windows).

```
git clone https://github.com/ggml-org/whisper.cpp
cd whisper.cpp
cmake -B build -DGGML_VULKAN=ON -DCMAKE_BUILD_TYPE=Release
cmake --build build --config Release --target whisper-cli
```

Skopiuj binaria z `build\bin\Release\` do `C:\whisper\Release\`.

> **Uwaga:** Oficjalne wydania whisper.cpp dla Windows na GitHub nie zawierają kompilacji Vulkan. Użyj gotowej kompilacji powyżej lub skompiluj ze źródeł z flagą `-DGGML_VULKAN=ON`.

---

## Krok 2 — Pobranie modelu Whisper

| Model | Rozmiar | Szybkość | Dokładność | Najlepszy do |
|---|---|---|---|---|
| `ggml-tiny.en.bin` | 75 MB | Bardzo szybki | Podstawowa | Szybkie testy |
| `ggml-base.en.bin` | 142 MB | Szybki | Dobra | Codzienny angielski |
| `ggml-small.en.bin` | 466 MB | Umiarkowany | Lepsza | Ważne nagrania |
| `ggml-medium.en.bin` | 1,5 GB | Szybki na GPU | Bardzo dobra | Najwyższa jakość angielskiego |
| `ggml-large-v3-turbo.bin` | 1,6 GB | Szybki na GPU | Doskonała | **Zalecany do wsadowego przetwarzania GPU — ~6x szybszy niż large-v3 przy minimalnej utracie dokładności** |
| `ggml-large-v3.bin` | 2,9 GB | Szybki na GPU | Doskonała | Wielojęzyczny, maksymalna dokładność |
| `ggml-medium.en-q5_0.bin` | 514 MB | Szybki | Bardzo dobra | **Najlepszy wybór CPU-only dla angielskiego — wysoka dokładność przy niskim zużyciu pamięci** |
| `ggml-large-v3-turbo-q5_0.bin` | 547 MB | Szybki | Doskonała | **Najlepszy wybór CPU-only wielojęzyczny** |
| `ggml-large-v3-q5_0.bin` | 1,1 GB | Umiarkowany na CPU | Doskonała | Wielojęzyczny, przyjazny dla CPU |

Użyj `download_model` w Claude Desktop do bezpośredniej instalacji. Dla **tylko angielskiego**: `large-v3-turbo` (GPU) lub `medium.en-q5_0` (CPU). Dla **wielojęzycznego**: `large-v3-turbo` lub `large-v3-turbo-q5_0` (CPU). Modele tylko angielskie (`*.en.bin`) generują `[FOREIGN]` dla audio w innych językach i nie mogą być używane dla innych języków.

---

## Krok 3 — Instalacja FFmpeg

FFmpeg jest wymagany dla plików wideo i nienatywnych formatów audio.

Instalacja przez winget:
```
winget install ffmpeg
```

Lub pobierz z [ffmpeg.org](https://ffmpeg.org/download.html) i dodaj do PATH.

Weryfikacja:
```
ffmpeg -version
```

---

## Krok 4 — Instalacja serwera MCP

```
npm install -g whisper-windows-mcp
```

---

## Krok 5 — Konfiguracja Claude Desktop

Otwórz Claude Desktop → Ustawienia → Deweloper → Edytuj konfigurację.

Dodaj wpis `whisper`:

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

Lokalizacja pliku konfiguracyjnego: `C:\Users\NazwaUżytkownika\AppData\Roaming\Claude\claude_desktop_config.json`

> Używaj **podwójnych ukośników odwrotnych** we wszystkich ścieżkach.

Zapisz i **w pełni uruchom ponownie** Claude Desktop. Powinieneś zobaczyć **whisper** na liście z zielonym znaczkiem "uruchomiony" w Ustawieniach → Deweloper.

---

## Krok 6 — Weryfikacja instalacji

W Claude Desktop zapytaj:

> *"Sprawdź konfigurację whisper"*

Następnie:

> *"Sprawdź sprzęt systemowy"*

Potwierdzi to, że GPU zostało wykryte i akceleracja Vulkan jest aktywna.

---

## Dostępne narzędzia

### `transcribe_audio`
Transkrybuje pojedynczy plik. Obsługuje tryb blokujący (domyślny) lub działający w tle dla długich plików.

| Parametr | Opis |
|---|---|
| `file_path` | Bezwzględna ścieżka do pliku (wymagana) |
| `language` | Kod języka (`pl`, `en`, `ja` itp.) lub `auto` do automatycznego wykrywania. Domyślnie: `en` |
| `output_format` | `timestamps` (domyślnie), `text`, `json`, `srt`, `vtt`, `lrc` lub `csv` |
| `save_to_file` | Zapisz transkrypcję jako .txt obok pliku źródłowego |
| `background` | Uruchom jako osobne zadanie — natychmiast zwraca ID zadania. Używaj `check_progress` do monitorowania. Zalecane dla plików dłuższych niż 10 minut. |
| `privacy_mode` | Zastąp tryb prywatności dla tego wywołania. `true` = tylko metadane, żaden tekst transkrypcji nie jest przesyłany. `false` = zwróć tekst nawet gdy `WHISPER_PRIVACY_MODE=true` globalnie. Pomiń, aby użyć globalnego ustawienia. |
| `threads` | Zastąp liczbę wątków CPU |
| `temperature` | Temperatura próbkowania 0,0–1,0. Domyślnie 0,0 (deterministyczny). |
| `prompt` | Ciąg kontekstu poprzedniego — poprawia dokładność dla słownictwa dziedzinowego lub imion mówców. |
| `condition_on_prev_text` | Ponownie włącz warunkowanie kontekstem między segmentami. Domyślnie false. |
| `beam_size` | Szerokość wyszukiwania wiązką. Wyższa = dokładniejsza, wolniejsza. Domyślnie 5. |
| `best_of` | Liczba ocenianych sekwencji kandydatów. Domyślnie 5. |
| `gpu_device` | Indeks urządzenia GPU dla systemów wielokartowych. Domyślnie 0. |
| `processors` | Liczba równoległych procesorów. Domyślnie 1. |
| `word_timestamps` | Jedno słowo na segment ze znacznikiem czasu. Przydatne do wyrównywania klipów. |
| `max_segment_length` | Maksymalna długość segmentu w znakach. |
| `diarize` | Diaryzacja mówców stereo — wymaga audio stereo z mówcami na osobnych kanałach. |
| `vad_model` | Ścieżka do pliku .bin modelu Silero VAD. Usuwa ciszę przed transkrypcją — redukuje halucynacje w hałaśliwych plikach. |
| `offset_t` | Przesunięcie początkowe w milisekundach. |
| `duration` | Czas przetwarzania w milisekundach od przesunięcia. |

**Formaty wyjściowe:**
- `timestamps` — segmenty ze znacznikami czasu, np. `[00:00:01.230 --> 00:00:04.560]  Witaj` (domyślnie)
- `text` — czysty tekst bez kodów czasowych
- `json` — strukturalny JSON (tylko tryb blokujący)
- `srt` — plik napisów SubRip zapisany obok źródła
- `vtt` — plik napisów WebVTT zapisany obok źródła
- `lrc` — format LRC tekstu/karaoke zapisany obok źródła
- `csv` — CSV ze znacznikami czasu zapisany obok źródła

---

### `check_progress`
Monitoruje zadanie transkrypcji w tle uruchomione przez `transcribe_audio` (background=true).

Zwraca czas, który upłynął, ostatni przetworzony znacznik czasu i kompletną transkrypcję po zakończeniu.

| Parametr | Opis |
|---|---|
| `job_id` | ID zadania zwrócone przez `transcribe_audio` |
| `privacy_mode` | Zastąp tryb prywatności dla tego sprawdzenia. `true` = tylko metadane, niezależnie od sposobu uruchomienia zadania. |

---

### `start_batch`
Automatycznie i sekwencyjnie transkrybuje wszystkie jeszcze niestranstrybuowane pliki w folderze. Sortuje według czasu trwania (najkrótsze pierwsze), przetwarza jeden po drugim jako zadania w tle i weryfikuje każdy wynik. Partia samodzielnie przesuwa się po zakończeniu każdego pliku — odpytywanie nie jest wymagane.

| Parametr | Opis |
|---|---|
| `folder_path` | Ścieżka do folderu (wymagana) |
| `language` | Kod języka. Domyślnie: `en` |
| `threads` | Zastąp liczbę wątków CPU |
| `output_format` | `timestamps` (domyślnie) lub `text` |
| `privacy_mode` | Zastąp tryb prywatności. Przed rozpoczęciem partii wymagane jest jedno potwierdzenie; następnie wszystkie pliki są przetwarzane bez nadzoru. Tekst transkrypcji nie jest zwracany. |

---

### `check_batch_progress`
Monitoruje uruchomioną partię. Automatycznie przechodzi do następnego pliku po zakończeniu bieżącego. Zwraca ogólny postęp, bieżący plik ze znacznikiem czasu i pliki z błędami.

| Parametr | Opis |
|---|---|
| `batch_id` | ID partii zwrócone przez `start_batch` |

---

### `transcribe_batch` (interaktywny)
Przetwarza pliki jeden po jednym z podglądem i potwierdzeniem przed każdym. Przydatne gdy chcesz przeglądać wyniki w trakcie.

| Parametr | Opis |
|---|---|
| `folder_path` | Ścieżka do folderu (wymagana) |
| `file_index` | Który plik przetworzyć (numeracja od 1). Pomiń, aby najpierw wyświetlić listę plików. |
| `language` | Kod języka. Domyślnie: `en` |
| `recursive` | Uwzględnij podfoldery |
| `output_format` | `timestamps` (domyślnie) lub `text` |
| `privacy_mode` | Zastąp tryb prywatności. Potwierdzenie wymagane przed każdym plikiem; zwracane są tylko metadane. |

---

### `generate_subtitles`
Generuje pliki napisów. Obsługuje automatyczne wykrywanie języka i wyjście z tłumaczeniem na angielski. Generuje SRT (największa kompatybilność) lub WebVTT (web i HTML5 wideo).

| Parametr | Opis |
|---|---|
| `file_path` | Ścieżka do pliku (wymagana) |
| `language` | Kod języka lub `auto` do automatycznego wykrywania. Domyślnie: `en` |
| `output_format` | `srt` (domyślnie) lub `vtt` |
| `translate_to_english` | Generuj też plik napisów z tłumaczeniem na angielski. Dotyczy tylko gdy źródło nie jest po angielsku. |
| `background` | Uruchom jako zadanie w tle. Zwraca ID zadania dla `check_progress`. |
| `threads` | Zastąp liczbę wątków CPU |

Gdy oba są żądane, dwa pliki są zapisywane obok źródła:
- `nazwapliku.pl.srt` — oryginalny język
- `nazwapliku.en.srt` — tłumaczenie na angielski

> Wbudowane tłumaczenie Whisper tłumaczy tylko **na angielski**. Dla innych języków docelowych przetłumacz zawartość pliku .srt osobno.

---

### `analyze_media`
Analizuje pliki przed transkrypcją. Zwraca czas trwania, rozmiar, kodek i szacowany czas transkrypcji na CPU i GPU. Dla folderów wyświetla wszystkie pliki w sortowalnej tabeli ze statusem transkrypcji.

| Parametr | Opis |
|---|---|
| `path` | Ścieżka do pojedynczego pliku lub folderu (wymagana) |
| `sort_by` | Dla folderów: `duration` (domyślnie), `name` lub `size` |

---

### `check_config`
Weryfikuje, czy whisper-cli.exe, plik modelu i FFmpeg są dostępne. Uruchom to najpierw, jeśli coś nie działa.

---

### `list_models`
Wyświetla wszystkie zainstalowane pliki modeli Whisper w katalogu modeli. Pokazuje nazwę pliku, rozmiar, czy jest aktywny, status kwantyzacji i zalecane przypadki użycia. Bez połączeń sieciowych — odczytuje tylko lokalny system plików.

---

### `download_model`
Pobiera model Whisper bezpośrednio z Hugging Face do katalogu modeli. Pobiera tylko z zaufanych przestrzeni nazw Hugging Face. Po pobraniu aktywuj przez `switch_model`.

| Parametr | Opis |
|---|---|
| `model_name` | Nazwa modelu do pobrania, np. `large-v3-turbo`, `large-v3-turbo-q5_0`, `medium.en-q5_0` |

---

### `switch_model`
Przełącza aktywny model Whisper dla bieżącej sesji bez restartu Claude Desktop. Zmiana obowiązuje tylko w sesji — nie jest zachowywana po restarcie. Aby zmiana była trwała, zaktualizuj `WHISPER_MODEL` w konfiguracji.

| Parametr | Opis |
|---|---|
| `model_name` | Nazwa pliku modelu (np. `ggml-large-v3-turbo.bin`) lub pełna ścieżka. Musi być plikiem `.bin` w skonfigurowanym katalogu modeli. |

---

### `check_system`
Wykrywa sprzęt GPU i potwierdza dostępność akceleracji Vulkan. Raportuje nazwę GPU, VRAM, obecność `ggml-vulkan.dll` i zaleca najlepszy rozmiar modelu dla twojego sprzętu.

---

## Obsługiwane formaty

| Typ | Formaty |
|---|---|
| Natywne (bez konwersji) | `mp3`, `wav` |
| Wideo (automatyczna konwersja przez FFmpeg) | `mp4`, `mkv`, `avi`, `mov`, `webm`, `flv`, `wmv`, `m4v`, `ts`, `3gp` |
| Audio (automatyczna konwersja przez FFmpeg) | `m4a`, `ogg`, `flac` |

---

## Akceleracja GPU

Gotowa kompilacja Vulkan automatycznie włącza akcelerację GPU. Przetestowano na AMD Radeon RX Vega 56 (GCN 5. generacji). Każdy GPU z obsługą Vulkan 1.0+ powinien działać, w tym NVIDIA i Intel Arc.

**Porównanie wydajności (model large-v3, plik audio ~14 minut):**

| Sprzęt | Czas |
|---|---|
| Tylko CPU (Ryzen 7 2700x, 8 wątków) | ~22 minuty (szacunkowo) |
| GPU (Vega 56 przez Vulkan) | ~3min 22s |

Wykorzystanie GPU podczas transkrypcji wynosi zazwyczaj 15–20% i wraca do stanu bezczynności między plikami.

Obsługuje Windows 10 i Windows 11.

---

## Obsługa wielu języków

Whisper może automatycznie wykrywać mówiony język i transkrybować w tym języku. Wbudowany model tłumaczenia tłumaczy tylko **na angielski**.

Dla najlepszej dokładności wielojęzycznej używaj modelu `large-v3`. Modele tylko angielskie (`*.en.bin`) nie mogą wykrywać ani transkrybować innych języków.

**Przykład — obcojęzyczne wideo z napisami:**
1. Poproś Claude o wygenerowanie napisów z `language=auto` i `translate_to_english=true`
2. Whisper wykrywa język i generuje SRT lub VTT w oryginalnym języku
3. Drugi przebieg generuje tłumaczenie na angielski
4. Wczytaj SRT w VLC przez Napisy → Dodaj plik napisów, lub użyj VTT w dowolnym odtwarzaczu webowym

---

## Prywatność i zgodność

whisper-windows-mcp zawiera wbudowaną architekturę prywatności dla wrażliwych i regulowanych treści.

**Audio i wideo nigdy nie opuszczają twojego komputera.** Ta gwarancja jest bezwarunkowa.

**Tekst transkrypcji** jest inną kwestią — gdy jest zwracany inline w odpowiedzi narzędzia, jest przetwarzany przez API Claude. Dla większości użytkowników jest to oczekiwane zachowanie. Dla treści regulowanych (medycznych, prawnych, finansowych, korporacyjnych) tryb prywatności temu zapobiega.

**Tryb prywatności** ogranicza wszystkie odpowiedzi narzędzi tylko do metadanych (nazwa pliku, liczba słów, ścieżka zapisu). Żaden tekst transkrypcji nie jest przesyłany do API Claude w żadnych okolicznościach. Włącz per wywołanie przez `privacy_mode=true` w dowolnym narzędziu transkrypcji, lub globalnie przez `WHISPER_PRIVACY_MODE=true` w konfiguracji.

**Brama zgody** — przy pierwszym użyciu w sesji w trybie standardowym, przed zwróceniem jakiegokolwiek tekstu transkrypcji wyświetlane jest pełne ujawnienie prywatności. Musisz jawnie potwierdzić przed kontynuowaniem. Ustaw `WHISPER_CONSENT_ACKNOWLEDGED=true` w konfiguracji, aby pominąć to dla treści niepoufnych.

Zobacz [PRIVACY.md](PRIVACY.md) dla pełnego przewodnika zgodności (HIPAA, RODO, tajemnica adwokacka, FERPA, SOX, PCI-DSS).

---

## Zaprojektowany dla użytkowników darmowego planu

To narzędzie zostało stworzone, aby zminimalizować interakcje z API Claude. Cały przepływ pracy transkrypcji — skanowanie, analiza, kolejka, uruchamianie, weryfikacja — jest zaprojektowany tak, aby wymagać jak najmniej interakcji z Claude. Ciężka praca jest wykonywana lokalnie na twoim komputerze.

---

## Opcjonalne zmienne środowiskowe

| Zmienna | Opis |
|---|---|
| `WHISPER_CLI_PATH` | Ścieżka do whisper-cli.exe (wymagana) |
| `WHISPER_MODEL` | Ścieżka do pliku modelu .bin (wymagana) |
| `WHISPER_THREADS` | Zastąp liczbę wątków CPU |
| `WHISPER_GPU_DEVICE` | Indeks urządzenia Vulkan, do którego przypiąć transkrypcję, dla systemów z wieloma GPU (indeks enumeracji Vulkan — sprawdź log startowy whisper-cli; nie kolejność GPU w Windows). Możliwe do zastąpienia per wywołanie przez `gpu_device`. Zobacz [TROUBLESHOOTING.md](TROUBLESHOOTING.md). |
| `WHISPER_FOREGROUND_MAX_SEC` | Limit transkrypcji na pierwszym planie w sekundach (domyślnie 210). Pliki, których czas wykonania szacuje się na dłuższy, są kierowane do trybu w tle zamiast ryzykować ~4-minutowy limit czasu narzędzia w Claude Desktop. |
| `FFMPEG_PATH` | Ścieżka do ffmpeg jeśli nie ma go w systemowym PATH |
| `WHISPER_PRIVACY_MODE` | Gdy `true`, odpowiedzi narzędzi zwracają tylko metadane — żaden tekst transkrypcji nie jest przesyłany do Claude. Dla treści regulowanych lub poufnych. Może być zastąpione per wywołanie przez parametr `privacy_mode`. Zobacz [PRIVACY.md](PRIVACY.md). |
| `WHISPER_CONSENT_ACKNOWLEDGED` | Gdy `true`, pomija jednorazowe ujawnienie zgody dla sesji przed zwróceniem tekstu transkrypcji. Ustaw po zapoznaniu się z granicami prywatności, gdy przypomnienie nie jest już potrzebne. Nie ma efektu gdy tryb prywatności jest aktywny. |

---

## Bezpieczeństwo

**Weryfikacja binarną.** Aby zweryfikować integralność binarium whisper-cli.exe w gotowym wydaniu, sprawdź jego skrót SHA256 w PowerShell:

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

Oczekiwany skrót dla binarnego wydania jest udokumentowany na [stronie wydań](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0).

**Walidacja danych wejściowych.** Wszystkie ścieżki plików są weryfikowane przed użyciem — ścieżki UNC (`\\server\share`) i sekwencje przechodzenia katalogów (`..`) są odrzucane. Pliki powyżej 10 GB są odrzucane, aby zapobiec wyczerpaniu zasobów.

**Świadomość iniekcji transkrypcji.** Pliki audio mogą zawierać wypowiadaną treść, która po transkrypcji przypomina instrukcje. Wbudowane mechanizmy obronne Claude obsługują to, ale warto wiedzieć, że sam serwer MCP traktuje treść transkrypcji jako dane — nigdy jako instrukcje.

**Pobieranie modeli jest ograniczone.** Narzędzie `download_model` pobiera tylko z dwóch zaufanych przestrzeni nazw Hugging Face (`ggerganov/whisper.cpp` i `ggml-org`). Dowolne URL są odrzucane. Przekierowania są weryfikowane względem listy dozwolonych przed wykonaniem.

**Przełączanie modeli jest piaskownicowane.** `switch_model` akceptuje tylko pliki `.bin` w skonfigurowanym katalogu modeli. Ścieżki poza tym katalogiem są odrzucane.

Zobacz [SECURITY.md](SECURITY.md) dla pełnej polityki bezpieczeństwa.

---

## Rozwiązywanie problemów

Zobacz [TROUBLESHOOTING.md](TROUBLESHOOTING.md) dla szczegółowych rozwiązań. Zobacz [PRIVACY.md](PRIVACY.md) jeśli obsługujesz treści regulowane.

Szybka lista kontrolna:
- Ścieżki w konfiguracji używają **podwójnych ukośników odwrotnych** (`C:\\whisper\\...`)
- `whisper-cli.exe` istnieje pod skonfigurowaną ścieżką
- Plik modelu `.bin` istnieje pod skonfigurowaną ścieżką
- FFmpeg zainstalowany i dostępny w PATH (`ffmpeg -version` działa)
- Claude Desktop został **w pełni uruchomiony ponownie** po edycji konfiguracji
- Whisper wyświetla się jako **uruchomiony** (zielony znaczek) w Ustawieniach → Deweloper

---

## Licencja

**Użytek niekomercyjny:** MIT — bezpłatny do użytku osobistego, edukacyjnego i niekomercyjnego. Zobacz [LICENSE](LICENSE).

**Użytek komercyjny:** Do użytku biznesowego, zawodowego lub generującego przychody wymagana jest osobna umowa licencji komercyjnej. Warunki i dane kontaktowe — w [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

## Wkład

Pull requesty są mile widziane. Zobacz [ROADMAP.md](ROADMAP.md) dla planowanych funkcji.

Jeśli testowałeś akcelerację GPU na sprzęcie niewymienionym powyżej, otwórz zgłoszenie z wynikami — model GPU, VRAM, rozmiar modelu i obserwowana przepustowość.
