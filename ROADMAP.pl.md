# whisper-windows-mcp — Plan rozwoju

Aktualna wersja: **v2.2.0**

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

**SRT w trybie tle:** `spawnDetached` wcześniej na stałe kodował `-otxt` niezależnie od żądanego formatu, a `generate_subtitles` blokował synchronicznie i osiągał 4-minutowy limit czasu MCP na dłuższych plikach. Naprawiono dodając parametr `outputFormat` do `spawnDetached`, obsługując wyjście `text` i `srt` w trybie tle.

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

### ✅ v2.2.0 — Rozszerzenie jakości, parametrów i sprzętu (aktualna)
- Interfejs `WhisperOptions` zastępujący argumenty pozycyjne w `buildArgs`.
- Nowe parametry w `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Nowe parametry w `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- Zrefaktoryzowano `spawnDetached` — wszystkie flagi jakości są teraz stosowane w trybie tle/partia.
- Naprawiono wyjście partii — `readBatchProgress` teraz przenosi tymczasowe wyjście do końcowego miejsca docelowego przed weryfikacją.

---

## Krytyczny błąd — Automatyczne przesuwanie partii (potwierdzony, oczekuje naprawy)

### Partia nie przesuwa się bez aktywnego odpytywania

`start_batch` nie przesuwa kolejki autonomicznie między plikami. Partia przesuwa się tylko gdy wywoływane jest `check_batch_progress`. Bez odpytywania partia zatrzymuje się na czas nieokreślony po każdym pliku.

**Planowana naprawa — Opcja B (callback wyjścia):** Dołącz handler `on('exit')` do uruchomionego procesu potomnego whisper-cli. Gdy proces wyjdzie, natychmiast wywołaj logikę postępu, aby zweryfikować wyjście i uruchomić następne zadanie.

**Aktualne obejście:** Wywołuj `check_batch_progress` wielokrotnie aż partia się ukończy.

---

## Planowane — Architektura prywatności (przed migracją do Bun)

### Zmienna środowiskowa `WHISPER_PRIVACY_MODE`
Dodaj `WHISPER_PRIVACY_MODE` jako zmienną środowiskową w `claude_desktop_config.json`. Po włączeniu wszystkie odpowiedzi narzędzi zwracają tylko metadane — żaden tekst transkrypcji nie jest uwzględniany.

### Brama zgody dla treści transkrypcji
Gdy `WHISPER_PRIVACY_MODE` nie jest włączony (domyślnie), każda odpowiedź narzędzia zawierająca tekst transkrypcji musi być poprzedzona ujawnieniem przy pierwszym użyciu w sesji.

### Dokumentacja `PRIVACY.md`
Utwórz `PRIVACY.md` w katalogu głównym repozytorium obejmujący pełne wskazówki dotyczące prywatności i ramy zgodności.

### Automatyczne czyszczenie katalogu tymczasowego
Dodaj automatyczne czyszczenie ukończonych plików zadań po konfigurowalnym oknie retencji (domyślnie: 7 dni).

---

## Planowane — Migracja do Bun

Migracja środowiska uruchomieniowego z Node.js do [Bun](https://bun.sh) po zakończeniu architektury prywatności i przed dodaniem funkcji v2.3.0. Bun uruchamia TypeScript natywnie bez kroku kompilacji i startuje znacznie szybciej niż Node.

---

## Licencjonowanie

whisper-windows-mcp używa podwójnego licencjonowania.

**Użytek niekomercyjny:** MIT — bezpłatny do użytku osobistego, edukacyjnego i niekomercyjnego. Zobacz [LICENSE](LICENSE).

**Użytek komercyjny:** Wymagana jest osobna umowa licencji komercyjnej. Zobacz [LICENSE-COMMERCIAL.md](LICENSE-COMMERCIAL.md).

`WHISPER_PRIVACY_MODE` dla wdrożeń w regulowanych branżach jest w trakcie opracowywania i planowany na przyszłe wydanie. Zobacz [PRIVACY.md](PRIVACY.md) dla aktualnych wskazówek.

## Planowane — v2.3.0: Rozszerzenie formatów wyjściowych

### Format napisów VTT
Wyjście WebVTT (`.vtt`) wraz z SRT. Standard internetowy używany przez YouTube, HTML5 `<video>` i większość nowoczesnych odtwarzaczy.

### Format LRC
Wyjście w formacie LRC (`.lrc`) tekstu piosenek/karaoke przez `-olrc`.

### Format CSV
Wyjście CSV (`.csv`) przez `-ocsv`. Strukturalne dane tabelaryczne z synchronizacją segmentów.

---

## Planowane — Przyszłe wydania

### TinyDiarize
Obsługa flagi `--tinydiarize` z wariantami modeli obsługującymi `tdrz`. Działa na nagraniach mono w przeciwieństwie do flagi `--diarize` stereo.

### Transkrypcja URL YouTube
Bezpośrednia transkrypcja z URL YouTube przez yt-dlp. Wymaga zainstalowanego yt-dlp w PATH.

### Narzędzia przepływu pracy projektów wideo
Dla użytkowników zarządzających dużymi projektami edycji wideo z folderami klipów źródłowych i edytowanych. Pliki źródłowe nigdy nie są zmieniane bez jawnego potwierdzenia użytkownika.

### Diaryzacja mówców (pyannote-audio)
Pełna diaryzacja mówców mono z etykietami ID mówcy. Wymaga pyannote-audio — biblioteki opartej na Pythonie z wymogiem tokenu dostępu do modeli Hugging Face.

### Tłumaczenie na języki inne niż angielski
Flaga `--translate` Whisper jest skierowana tylko na angielski. Obsługa dowolnych języków docelowych wymaga zewnętrznego API tłumaczenia lub lokalnego modelu tłumaczenia.

### Czyszczenie i formatowanie transkrypcji
Pipeline post-przetwarzania: usuwanie słów wypełniaczy, podziały akapitów na naturalnych granicach tematów, formatowanie uwzględniające mówców, eksport do PDF lub DOCX.

---

## Dystrybucja

Dostępne na [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org) i [Glama](https://glama.ai).

---

## Dokumentacja wielojęzyczna

Dokumentacja w językach japońskim, koreańskim, wietnamskim, indonezyjskim, ukraińskim, brazylijskim portugalskim, hiszpańskim i polskim jest utrzymywana równolegle z angielską. Następujące pliki muszą być aktualizowane, aby odpowiadać dokumentacji angielskiej po każdym wydaniu:

**Japoński (`*.ja.md`)** — `README.ja.md` / `TROUBLESHOOTING.ja.md` / `ROADMAP.ja.md` / `PRIVACY.ja.md` / `SECURITY.ja.md`

**Koreański (`*.ko.md`)** — `README.ko.md` / `TROUBLESHOOTING.ko.md` / `ROADMAP.ko.md` / `PRIVACY.ko.md` / `SECURITY.ko.md`

**Wietnamski (`*.vi.md`)** — `README.vi.md` / `TROUBLESHOOTING.vi.md` / `ROADMAP.vi.md` / `PRIVACY.vi.md` / `SECURITY.vi.md`

**Indonezyjski (`*.id.md`)** — `README.id.md` / `TROUBLESHOOTING.id.md` / `ROADMAP.id.md` / `PRIVACY.id.md` / `SECURITY.id.md`

**Ukraiński (`*.uk.md`)** — `README.uk.md` / `TROUBLESHOOTING.uk.md` / `ROADMAP.uk.md` / `PRIVACY.uk.md` / `SECURITY.uk.md`

**Brazylijski portugalski (`*.pt-BR.md`)** — `README.pt-BR.md` / `TROUBLESHOOTING.pt-BR.md` / `ROADMAP.pt-BR.md` / `PRIVACY.pt-BR.md` / `SECURITY.pt-BR.md`

**Hiszpański (`*.es.md`)** — `README.es.md` / `TROUBLESHOOTING.es.md` / `ROADMAP.es.md` / `PRIVACY.es.md` / `SECURITY.es.md`

**Polski (`*.pl.md`)** — `README.pl.md` / `TROUBLESHOOTING.pl.md` / `ROADMAP.pl.md` / `PRIVACY.pl.md` / `SECURITY.pl.md`

Wkład społeczności dla innych języków jest mile widziany.

---

## Wkład

Pull requesty są mile widziane. Sprawdź istniejące zgłoszenia przed rozpoczęciem pracy.

Jeśli testowałeś akcelerację GPU na sprzęcie niewymienionym powyżej, otwórz zgłoszenie z modelem GPU, VRAM, rozmiarem modelu i obserwowaną przepustowością. Pomaga to budować dokładne odniesienie wydajności dla innych użytkowników.
