# whisper-windows-mcp — Plan rozwoju

Aktualna wersja: **v2.4.0**

---

## Zasady projektowania

Zasady te kierują każdą decyzją w tym projekcie i mają pierwszeństwo przed szybkością dodawania funkcji.

**Minimalizacja użycia API Claude.** Cały przepływ pracy transkrypcji — skanowanie, analiza, kolejka, uruchamianie, weryfikacja, przełączanie modeli — musi być możliwy do wykonania przy jak najmniejszej liczbie interakcji z Claude. To narzędzie musi w pełni działać dla użytkowników darmowego planu Claude, którzy nie płacą za subskrypcje Pro lub Max. Każde wywołanie narzędzia zużywa budżet użytkowania. Projektuj odpowiednio.

**Zawsze tylko jedna instancja whisper.** Nigdy nie twórz drugiego procesu whisper-cli.exe gdy jeden już działa. Blokowanie procesów jest obowiązkowe i nie podlega negocjacjom.

**Lokalność jako priorytet, prywatność domyślnie.** Audio nigdy nie opuszcza komputera. Żadne API w chmurze nie są potrzebne do podstawowej funkcjonalności. Opcjonalne integracje (np. pobieranie modeli z Hugging Face) muszą być wyraźnie udokumentowane jako opcjonalne.

**Jawna kontrola użytkownika.** Bez cichych operacji masowych. Destrukcyjne lub nieodwracalne działania wymagają potwierdzenia. Użytkownik musi zawsze wiedzieć, co się stanie przed tym, jak to nastąpi.

**Bezpieczne ścieżki Unicode.** Cały I/O plików musi poprawnie obsługiwać nazwy plików zawierające znaki spoza ASCII, w tym polskie, japońskie, chińskie, emoji, nawiasy i inne znaki specjalne.

**Modularność i kombinowalność.** Narzędzia są niezależne. Użytkownicy używają tego, czego potrzebują. Żadna funkcja nie powinna wymagać innej, chyba że jest to nieuniknione.

**Optymalizacja przed funkcjami.** Gdy masz wątpliwości między dodaniem funkcji a zmniejszeniem obciążenia systemu lub liczby wywołań API — zmniejsz obciążenie. Duże sesje optymalizacji są kosztowne. Projektuj architekturę poprawnie od początku.

---

## Ukończone

### ✅ v1.3.1 — Blokowanie procesów
Dodano sprawdzanie `isWhisperRunning()` używające `tasklist /FI` przed uruchomieniem jakiegokolwiek procesu transkrypcji. Zwraca wyraźny błąd z instrukcjami Menedżera zadań zamiast tworzyć konkurujący proces.

### ✅ v1.4.0 — Akceleracja GPU Vulkan
Skompilowano whisper.cpp ze źródeł z `-DGGML_VULKAN=ON` używając VS Build Tools 2022 i Vulkan SDK. Gotowe binaria Vulkan dystrybuowane jako `whisper-vulkan-win-x64.zip`.

**Wyniki na AMD Radeon RX Vega 56:** Średnie wykorzystanie GPU ~16%. Plik 58-minutowy ukończony w ~4,5 minuty na GPU vs ~88 minut tylko na CPU.

### ✅ v1.5.0 — Diagnostyka systemu
Narzędzie `check_system`: wykrywanie GPU przez `wmic`, weryfikacja DLL Vulkan, raportowanie VRAM, rekomendacja rozmiaru modelu.

### ✅ v1.6.0 — Wstępna analiza pliku
Narzędzie `analyze_media` przez FFprobe: czas trwania, rozmiar, kodek, status transkrypcji, szacowanie czasu CPU i GPU. Skanowanie pojedynczego pliku lub folderu z opcjami sortowania.

### ✅ v1.7.0 — Transkrypcja w tle + Widoczność postępu
Architektura odłączonego procesu: `transcribe_audio` z `background=true` uruchamia whisper jako odłączony proces i natychmiast zwraca ID zadania. `check_progress` analizuje znaczniki czasu segmentów stderr whisper dla procentu i ETA w czasie rzeczywistym.

### ✅ v1.8.0 — Sekwencyjna partia z weryfikacją
`start_batch` i `check_batch_progress`: automatyczne sekwencyjne przetwarzanie, weryfikacja transkrypcji (wykrywanie pustych/krótkich wyników), automatyczne przesuwanie kolejki, znaczniki czasu postępu per plik.

### ✅ v1.9.0 — Obsługa wielu języków i tłumaczenia
`generate_subtitles` z wykrywaniem `language=auto` i podwójnym wyjściem SRT `translate_to_english=true`. Dodano obsługę formatów `.3gp` i `.ts`. `language=auto` dostępne też w `transcribe_audio`.

**Znane ograniczenie:** Wbudowane tłumaczenie Whisper jest skierowane tylko na angielski. Wymaga modelu `large-v3` dla języków innych niż angielski — modele tylko angielskie (`*.en.bin`) generują `[FOREIGN]` dla audio w innych językach.

### ✅ v2.0.0 — Bezpieczne ścieżki Unicode + SRT w tle
**Nazwy plików Unicode:** Pliki z niezgodnymi z ASCII znakami w nazwach powodowały ciche niepowodzenia transkrypcji w tle. Naprawiono przez kierowanie całego wyjścia przez oczyszczoną tymczasową ścieżkę opartą na ID zadania, następnie przenoszenie wyniku do właściwego miejsca docelowego po zakończeniu.

**SRT w trybie tle:** `spawnDetached` wcześniej na stałe kodował `-otxt` niezależnie od żądanego formatu. Naprawiono dodając parametr `outputFormat` do `spawnDetached`, obsługując wyjście `text` i `srt` w trybie tle.

### ✅ v2.0.1 — Poprawki błędów (włączone do v2.2.0)
- `--max-context 0` zakodowane na stałe w `buildArgs` i `spawnDetached` — zapobiega pętlom halucynacji na długim audio.
- `--no-speech-thold 0.6` zakodowane na stałe w obu funkcjach — segmenty poniżej progu pewności są traktowane jako cisza.
- Walidacja ścieżki (`validateInputPath`) — odrzuca ścieżki UNC i przejścia `..`.
- Ochrona rozmiaru pliku `MAX_FILE_SIZE_MB = 10240`.
- Komentarz bezpieczeństwa iniekcji transkrypcji w `transcribeSingle`.
- Naprawiono uszkodzone polecenie CLI partii w TROUBLESHOOTING.md.

### ✅ v2.1.0 — Zestaw zarządzania modelami (włączony do v2.2.0)
- `WHISPER_MODEL` zmienione z `const` na `let` (mutowalne w sesji).
- `MODEL_REGISTRY` — 16 modeli, warianty pełnej precyzji i skwantyzowane, URL pobierania z Hugging Face.
- `ALLOWED_HF_PREFIXES` — lista dozwolonych URL ograniczająca pobieranie do przestrzeni nazw `ggerganov/whisper.cpp` i `ggml-org`.
- Narzędzie `list_models` — skanuje katalog modeli, pokazuje aktywny model, rozmiary, przypadki użycia, dostępne pobierania.
- Narzędzie `download_model` — pobiera z Hugging Face przez wbudowany `https` Node.js, atomowe przemianowanie.
- Narzędzie `switch_model` — waliduje rozszerzenie `.bin`, ograniczenie katalogu, sprawdzenie blokady procesu.
- Zaktualizowano `recommendedModel()` do rekomendowania `large-v3-turbo` dla VRAM 6GB+.

### ✅ v2.2.0 — Rozszerzenie jakości, parametrów i sprzętu
- Interfejs `WhisperOptions` zastępujący argumenty pozycyjne w `buildArgs`.
- Nowe parametry w `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Nowe parametry w `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- Zrefaktoryzowano `spawnDetached` — wszystkie flagi jakości są teraz stosowane w trybie tle/partia.
- Naprawiono wyjście partii — `readBatchProgress` teraz przenosi tymczasowe wyjście do końcowego miejsca docelowego przed weryfikacją.

**Uwaga dotycząca zgodności flag:** `gpu_device` / `--device` zostało dodane w whisper.cpp v1.8.4. Gotowe binarium Vulkan w wydaniach jest w wersji v1.8.3 — ten parametr jest akceptowany przez narzędzie, ale nie będzie miał efektu dopóki użytkownicy nie zaktualizują do binarium v1.8.4+.

### ✅ v2.2.2 — Łatka
- Naprawa podwójnej licencji — LICENSE i LICENSE-COMMERCIAL.md poprawione.
- Drobne poprawki dokumentacji.

### ✅ v2.3.0 — Automatyczne przesuwanie partii, architektura prywatności, rozszerzenie formatów wyjściowych

**Automatyczne przesuwanie partii (krytyczna naprawa błędu):** `start_batch` wcześniej wymagało aktywnego odpytywania do przesuwania kolejki. Do każdego uruchomionego procesu potomnego whisper-cli jest teraz dołączony handler `on('exit')`. Gdy proces wychodzi, partia samodzielnie przesuwa się przez callback wyjścia z zerowym kosztem odpytywania i zerowymi wywołaniami API. Mutex zapobiega podwójnemu uruchomieniu między równoległym handlerem wyjścia a wywołaniami `check_batch_progress`.

**Architektura prywatności:**
- Zmienna środowiskowa `WHISPER_PRIVACY_MODE` — gdy `true`, wszystkie odpowiedzi narzędzi zwracają tylko metadane (nazwa pliku, liczba słów, ścieżka zapisu). Żaden tekst transkrypcji nie jest nigdy przesyłany do API Claude. Transkrypcje istnieją tylko jako lokalne pliki.
- Zmienna środowiskowa `WHISPER_CONSENT_ACKNOWLEDGED` — gdy `true`, pomija jednorazową bramę zgody dla sesji dla treści niepoufnych.
- Parametr `privacy_mode` dla pojedynczego wywołania w `transcribe_audio`, `transcribe_batch`, `start_batch` i `check_progress`. Zastępuje globalną zmienną środowiskową w obu kierunkach. Nie wymaga restartu do przełączania per wywołanie.
- Brama trybu prywatności (`checkPrivacyGate()`) — uruchamia się przed każdą operacją, gdy efektywny tryb prywatności jest aktywny.
- Brama zgody sesji (`transcriptPolicy()`) — uruchamia się raz na sesję przed pierwszym wywołaniem zwracającym transkrypcję w trybie standardowym.
- `PRIVACY.md` — pełna dokumentacja zgodności obejmująca HIPAA, RODO, tajemnicę adwokacką, FERPA, SOX, PCI-DSS i NDA/tajemnicę handlową.

**Rozszerzenie formatów wyjściowych:**
- `vtt` — wyjście WebVTT przez `-ovtt`. Dostępne w `transcribe_audio`, `generate_subtitles`, `start_batch` i trybie tle.
- `lrc` — format LRC tekstu/karaoke przez `-olrc`. Dostępne w `transcribe_audio` i trybie tle.
- `csv` — CSV ze znacznikami czasu przez `-ocsv`. Dostępne w `transcribe_audio` i trybie tle.
- Domyślny `output_format` zmieniony z `"text"` na `"timestamps"` we wszystkich narzędziach i ścieżkach kodu.

**Naprawki błędów:**
- Błąd 1: `output_format` nie był przekazywany do zadań w tle — niezależnie od żądanego formatu używany był domyślny `"text"`. Naprawiono przez zmianę domyślnego na `"timestamps"` i poprawne przekazywanie.
- Błąd 2: Cichy `catch {}` w operacji przenoszenia wyjścia zadania w tle ukrywał niepowodzenia. Dodano jawne sprawdzenie `existsSync` ze szczegółowym komunikatem o błędzie po przeniesieniu.
- Błąd 3: Dodano komentarz projektowy w punkcie uruchamiania w tle dokumentujący, dlaczego brama zgody jest celowo odroczona do `check_progress` dla zadań w tle bez trybu prywatności.

**Dodatkowo:**
- Automatyczne czyszczenie katalogu tymczasowego — `cleanupOldJobFiles()` uruchamia się przy starcie, usuwa pliki `.json` i `.log` starsze niż 7 dni z `%TEMP%\whisper-mcp-jobs\`.
- `check_config` teraz raportuje status trybu prywatności.
- Dziennik startowy raportuje włączenie/wyłączenie trybu prywatności.

### ✅ v2.4.0 — Wzmocnienie, strażnik limitu czasu pierwszego planu, zestaw testów i CI

Przegląd pod kątem bezpieczeństwa/odporności; planowana migracja do Bun została przeniesiona na v2.5.0.

**Bezpieczeństwo i poprawność:**
- Poprawka ograniczenia ścieżek w `switch_model` — katalog z prefiksem-rodzeństwem (np. `…\models-evil`) mógł wcześniej spełnić sprawdzenie „wewnątrz katalogu modeli” poprzez naiwne `startsWith`; zastąpione znormalizowanym ograniczeniem opartym na `relative()`. Zamyka lukę opisaną w SECURITY.md.
- Bramka prywatności/zgody kluczowana **per operacja** (narzędzie + argumenty) — potwierdzenie jednej transkrypcji nie może już spełnić bramki innej operacji.
- `download_model` odrzuca obcięte pobrania (sprawdzenie Content-Length) przed promowaniem pliku `.part`. (Pełna weryfikacja skrótu SHA256 zaplanowana na późniejszy przegląd.)
- Koercja danych wejściowych — numeryczne parametry narzędzi, które nie są prawdziwymi liczbami, są odrzucane zamiast przekazywane do whisper-cli jako `NaN`.

**Odporność:**
- **Strażnik limitu czasu pierwszego planu** — plik na tyle długi, by przekroczyć ~4-minutowy limit czasu narzędzia MCP Claude Desktop w trybie blokującym, jest wykrywany z góry i kierowany do tła zamiast po cichu przekraczać limit czasu. Próg konfigurowalny przez `WHISPER_FOREGROUND_MAX_SEC`. Skorygowano szacunki czasu (stary szacunek GPU mocno zaniżał; dominujący koszt ponownego ładowania modelu jest teraz modelowany — zmierzony, nie zgadywany).
- Atomowe zapisy stanu zadań/partii (plik tymczasowy + zmiana nazwy), aby równoległy czytelnik nie mógł zobaczyć rozdartego pliku JSON.
- Odporne na kolizje identyfikatory zadań/partii/tymczasowe (z sufiksem UUID).
- Łagodne zamknięcie przy SIGINT/SIGTERM, które czyści pliki tymczasowe trybu blokującego.

**Wybór urządzenia GPU:**
- Zmienna środowiskowa `WHISPER_GPU_DEVICE` oraz `gpu_device` są teraz przekazywane przez `generate_subtitles` i przebieg wykrywania języka (wcześniej tylko `transcribe_audio`). `check_config` raportuje aktywne urządzenie. `check_system` nie raportuje już błędnie problemu ze sterownikiem, gdy `wmic` (przestarzałe w Windows 11 24H2+) nic nie zwraca.

**Jakość:**
- Zestaw testów jednostkowych `node:test` obejmujący czystą logikę (ograniczenie ścieżek, kluczowanie bramki, zapisy atomowe, koercja danych wejściowych, szacowanie limitu czasu), zero dodatkowych zależności, plus przepływ pracy CI GitHub Actions uruchamiający go przy każdym push/PR.

**Zidentyfikowane do przyszłego wydania:** trwała ścieżka modelu (np. `whisper-server` z whisper.cpp), aby wyeliminować koszt ponownego ładowania modelu ponoszony przy każdej transkrypcji — duży zysk przepustowości dla pracy wsadowej/archiwalnej.

---

## Planowane — v2.5.0: Migracja do Bun

Migracja środowiska uruchomieniowego z Node.js do [Bun](https://bun.sh).

Ponieważ Claude Desktop uruchamia serwer MCP na nowo przy każdym starcie sesji, czas uruchamiania jest na ścieżce krytycznej. Bun uruchamia TypeScript natywnie bez kroku kompilacji, startuje znacznie szybciej niż Node i ma szybszy I/O.

**Co się zmienia:**
- Eliminacja kroku budowania `tsc` i katalogu `dist/`
- Użytkownicy uruchamiają kod TypeScript bezpośrednio
- `tsconfig.json` staje się opcjonalny
- Aktualizacja skryptów `package.json`
- Aktualizacja przepływu pracy publikacji npm

**Co się nie zmienia:**
- Kod źródłowy `src/index.ts` — Bun jest kompatybilny z istniejącym TypeScript i wbudowanymi API Node.js
- Całe zachowanie narzędzi i formaty wyjściowe
- Konfiguracja Claude Desktop dla użytkowników końcowych

---

## Planowane — v2.6.0: Rozszerzone formaty wyjściowe dla integracji zewnętrznych narzędzi

Rozszerzona obsługa formatów wyjściowych skierowana na przepływy pracy analizy i integracji. Dokładny zakres zostanie określony na podstawie opinii użytkowników po v2.3.0.

---

## Planowane — v2.7.0: Tryb transkrypcji na żywo z mikrofonu

Transkrypcja w czasie rzeczywistym z wejścia mikrofonu na żywo. Strumieniowanie audio z wybranego urządzenia nagrywającego do whisper w fragmentach, zwracając kolejne segmenty transkrypcji w miarę ich ukończenia.

**Ograniczenia projektowe:**
- Wybór urządzenia musi być jawny — bez cichego przechwytywania domyślnego urządzenia
- Użytkownik musi mieć możliwość zatrzymania strumienia przez interakcję z Claude Desktop
- Nie może kolidować z ograniczeniem jednej instancji whisper jednocześnie
- Kompromis między opóźnieniem a dokładnością musi być konfigurowalny przez użytkownika

**Status:** Faza projektowania. Zależy od stabilnego API strumieniowania w whisper.cpp.

---

## Planowane — Przyszłe wydania

### TinyDiarize
Obsługa flagi `--tinydiarize` z wariantami modeli obsługującymi `tdrz` (np. `large-v2-tdrz`). W przeciwieństwie do flagi `--diarize` stereo, TinyDiarize działa na nagraniach mono. Wymaga pobrania specjalnego wariantu modelu. Niższa dokładność niż diaryzacja oparta na pyannote, ale zero dodatkowych zależności poza plikiem modelu.

**Status:** Planowane. Zależy od obsługi wariantów modeli tdrz w `download_model`.

### Transkrypcja URL YouTube
Bezpośrednia transkrypcja z URL YouTube przez yt-dlp. Pobieranie audio i transkrypcja w jednym kroku. Wymaga zainstalowanego yt-dlp w PATH.

**Ograniczenie projektowe:** yt-dlp jest opcjonalny. Narzędzie musi degradować się elegancko z jasnymi instrukcjami instalacji jeśli nie zostanie znalezione. Brak zmian w podstawowej funkcjonalności dla użytkowników, którzy tego nie potrzebują.

### Narzędzia przepływu pracy projektów wideo
Dla użytkowników zarządzających dużymi projektami edycji wideo z folderami klipów źródłowych i edytowanych:

1. Skanowanie folderu źródłowego i podfolderu klipów
2. Rozmyte dopasowywanie transkrypcji edytowanych klipów do transkrypcji źródłowych w celu zlokalizowania punktów pochodzenia
3. Wyświetlanie opisowych nazw plików sugerowanych przez Claude na podstawie treści transkrypcji, wymagające jawnego potwierdzenia użytkownika przed wykonaniem jakiegokolwiek przemianowania
4. Wyszukiwanie transkrypcji w katalogu projektu z wynikami w kodach czasowych

**Ograniczenia projektowe:**
- Pliki źródłowe są **nigdy nie przemianowywane ani modyfikowane**
- Wszystkie przemianowania wymagają **jawnego potwierdzenia użytkownika**
- Wyszukiwanie jest osobnym narzędziem, używalnym niezależnie
- Analiza i dopasowywanie odbywają się lokalnie — Claude jest wywoływany tylko gdy użytkownik przegląda wyniki, minimalizując wywołania API

**Status:** Faza projektowania.

### Diaryzacja mówców (pyannote-audio)
Pełna diaryzacja mówców mono z etykietami ID mówcy — oznacza przejścia mówców przez całe nagranie niezależnie od konfiguracji kanałów. Różni się od wbudowanej flagi `--diarize` stereo (v2.2.0) i TinyDiarize.

**Implementacja:** Wymaga [pyannote-audio](https://github.com/pyannote/pyannote-audio) — biblioteki opartej na Pythonie z wymogiem tokenu dostępu do modeli Hugging Face. Całkowicie oddzielny stos zależności.

**Status:** Opcjonalna zaawansowana funkcja z własną dokumentacją konfiguracji. Nie jest włączona do głównego pakietu.

### Tłumaczenie na języki inne niż angielski
Flaga `--translate` Whisper jest skierowana tylko na angielski. Obsługa dowolnych języków docelowych wymaga zewnętrznego API tłumaczenia lub lokalnego modelu tłumaczenia.

**Opcje rozważane:** LibreTranslate (samohosted, lokalny priorytet), lokalny LLM tłumaczący lub jawna dokumentacja poza zakresem.

**Status:** Odroczone, oczekuje decyzji projektowej dotyczącej lokalnego priorytetu vs zależności API.

### Czyszczenie i formatowanie transkrypcji
Pipeline post-przetwarzania:
- Usuwanie słów wypełniaczy i fałszywych startów (opcjonalne, kontrolowane przez użytkownika)
- Podziały akapitów na naturalnych granicach tematów
- Formatowanie uwzględniające mówców w połączeniu z wyjściem diaryzacji
- Eksport do PDF lub DOCX

**Status:** Planowane. Wariant uwzględniający mówców zależy od diaryzacji.

---

## Licencjonowanie

whisper-windows-mcp używa podwójnego licencjonowania.

**Użytek niekomercyjny:** MIT — bezpłatny do użytku osobistego, edukacyjnego i niekomercyjnego. Zobacz [LICENSE](LICENSE).

**Użytek komercyjny:** Wymagana jest osobna umowa licencji komercyjnej dla jakiegokolwiek użytku biznesowego, zawodowego lub generującego przychody. Warunki i dane kontaktowe — w [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

---

## Dystrybucja

Dostępne na [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), [Glama](https://glama.ai) i [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers).

---

## Dokumentacja wielojęzyczna

Po każdym wydaniu należy zaktualizować następujące pliki, aby odpowiadały dokumentacji angielskiej:

**Japoński (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Koreański (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Wietnamski (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Indonezyjski (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Ukraiński (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Brazylijski portugalski (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Hiszpański (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

**Polski (`*.pl.md`)** — `README.pl.md` / `TROUBLESHOOTING.pl.md` / `ROADMAP.pl.md` / `PRIVACY.pl.md` / `SECURITY.pl.md`

**Rumuński (`*.ro.md`)** — `README.ro.md` / `TROUBLESHOOTING.ro.md` / `ROADMAP.ro.md` / `PRIVACY.ro.md` / `SECURITY.ro.md`

Wkład społeczności dla innych języków jest mile widziany.

---

## Wkład

Pull requesty są mile widziane. Sprawdź istniejące zgłoszenia przed rozpoczęciem pracy.

Jeśli testowałeś akcelerację GPU na sprzęcie niewymienionym powyżej, otwórz zgłoszenie z modelem GPU, VRAM, rozmiarem modelu i obserwowaną przepustowością. Pomaga to budować dokładne odniesienie wydajności dla innych użytkowników.
