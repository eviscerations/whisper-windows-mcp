# whisper-windows-mcp — Plan rozwoju

Aktualna wersja: **v2.5.0**

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

## Planowane — v2.5.0: Trwały serwer modelu

Utrzymanie modelu Whisper rezydentnego między transkrypcjami zamiast przeładowywania go przy każdym wywołaniu.

Jest to pojedynczy największy dostępny zysk przepustowości. whisper-cli jest jednorazowy: przeładowuje pełny model przy każdym wywołaniu, a v2.4.0 zmierzyła to przeładowanie na ~110s na GPU z ograniczoną pamięcią — stały podatek płacony per plik, niezależnie od długości audio. Dla pracy wsadowej i archiwalnej dominuje on czas rzeczywisty bardziej niż sama transkrypcja.

**Podejście:** uruchomienie dołączonego do whisper.cpp `whisper-server` (HTTP) jako pojedynczego długo żyjącego procesu z modelem trzymanym w pamięci. Serwer MCP wysyła każdą transkrypcję do niego przez localhost i otrzymuje wyniki bez ponownego płacenia kosztu przeładowania.

**Pogodzenie z zasadą „zawsze tylko jedna instancja whisper":** zasada jest zachowana, mechanizm ewoluuje. Serwer rezydentny *staje się* pojedynczą instancją; blokada procesu zmienia się z „nigdy nie twórz drugiego whisper-cli" na „serializuj żądania względem jednego serwera rezydentnego". Nie wprowadza się współbieżności.

**Ograniczenia projektowe:**
- Jawny cykl życia: start / stop / status, ze sprawdzeniem stanu. Serwer nigdy nie jest uruchamiany po cichu jako efekt uboczny niepowiązanego wywołania.
- Powiązanie tylko z localhost — nigdy z routowalnym interfejsem. Brak wystawienia na sieć (spójne z zasadą lokalnego priorytetu i wzmocnieniem z v2.4.0).
- Łagodna degradacja: jeśli serwer nie działa, transkrypcja nadal działa przez istniejącą jednorazową ścieżkę whisper-cli. Serwer jest optymalizacją, a nie twardą zależnością.
- `switch_model` przeładowuje model w serwerze rezydentnym (nadal znacznie tańsze amortyzowane niż przeładowywanie per plik).
- Bramki prywatności i zgody pozostają bez zmian — znajdują się ponad mechanizmem transkrypcji.
- Wybór portu z obsługą kolizji; czyste zamknięcie przy SIGINT/SIGTERM obok istniejącego czyszczenia plików tymczasowych.

**Status — Faza 1 ✅ zaimplementowana (oczekuje na wydanie):** narzędzie `whisper_server` (`start` / `stop` / `status`); blokujące `transcribe_audio` i `transcribe_batch` kierowane przez serwer rezydentny przez localhost (`127.0.0.1`, zweryfikowane względem aktualnego API HTTP `whisper-server` z whisper.cpp); `switch_model` podmienia w locie model rezydentny przez `POST /load` bez restartu; strażnik limitu czasu pierwszego planu jest pomijany w trybie serwera (brak przeładowania do opłacenia); `check_config` raportuje stan serwera; posiadany serwer jest zabijany przy zamknięciu, aby zwolnić VRAM. Zasada jednego silnika / współdzielonego VRAM jest wymuszana twardym zabezpieczeniem w ścieżce odłączonego uruchamiania plus przyjazne odrzucenia: gdy serwer działa, zadania w tle, `start_batch`, `generate_subtitles`, wyjście `lrc`/`csv` oraz opcje per żądanie, których nie obsługuje API HTTP (`beam_size`, `best_of`, `word_timestamps`, `diarize`, `tinydiarize`, `vad_model`, `offset_t`, `duration` itd.) są odrzucane z komunikatem „najpierw zatrzymaj serwer" zamiast po cichu degradować. Konfiguracja: `WHISPER_SERVER_PATH`, `WHISPER_SERVER_PORT` (domyślnie 8571, tylko localhost).

**Status — Faza 2 (planowana):** kierowanie zadań w tle/`start_batch` przez serwer rezydentny. Jest to większy zysk archiwalny/przepustowości i wymaga przerobienia warstwy zadań/kolejki wokół żądań HTTP zamiast odłączonych PID (postęp bez PID, anulowanie). Ponowna ocena po wdrożeniu Fazy 1.

---

## Planowane — v2.6.0: TinyDiarize (zmiany mówcy mono, zero dodatkowych zależności)

Obsługa `--tinydiarize` z wariantami modeli obsługującymi `tdrz` (np. `ggml-small.en-tdrz.bin`). W przeciwieństwie do flagi `--diarize` stereo (v2.2.0), TinyDiarize oznacza zmiany mówcy na nagraniach **mono** i nie wymaga niczego poza plikiem modelu — bez Pythona, bez usługi zewnętrznej.

**Zakres:**
- Dodanie wariantu(ów) modelu `tdrz` do `MODEL_REGISTRY`, aby `download_model` mógł je pobierać z istniejących zaufanych przestrzeni nazw Hugging Face.
- Przeprowadzenie opcji `tinydiarize` przez `buildArgs` i `spawnDetached`, aby działała w trybie blokującym, w tle i wsadowym.

**Status:** ✅ Zaimplementowane (oczekuje na wydanie) — parametr `tinydiarize` w `transcribe_audio` i `generate_subtitles` (działa w trybie blokującym i w tle), `--tinydiarize` przeprowadzone przez oba buildery argumentów, a `small.en-tdrz` dodane do `MODEL_REGISTRY` dla `download_model`. Zgodne z etosem: lokalny priorytet, zero dodatkowych zależności.

---

## Planowane — v2.7.0: Wyszukiwanie transkrypcji w całym projekcie

Samodzielne narzędzie do wyszukiwania frazy lub wzorca we wszystkich transkrypcjach w katalogu projektu i zwracania dopasowań z ich plikiem źródłowym i kodem czasowym. Wydzielone z większego przepływu pracy projektów wideo (zobacz „Później / W rozważaniu") — ta połowa jest niezależnie użyteczna, niskiego ryzyka i lekka dla API: wyszukiwanie działa lokalnie, a Claude jest zaangażowany tylko gdy użytkownik przegląda wyniki.

**Status:** Planowane.

---

## Planowane — v2.8.0: Rozszerzone formaty wyjściowe i integracja

Rozszerzone wyjście dla przepływów pracy analizy i integracji. Jedna konkretna luka do zamknięcia: wyjście JSON jest obecnie nieobsługiwane w trybie tle (wraca do tekstu). JSON na poziomie słów do wyrównywania klipów i inne formaty integracji zostaną określone na podstawie opinii użytkowników.

---

## Później / W rozważaniu

Nie zaplanowane, ale zgodne z etosem i rewidowane w miarę możliwości.

### Migracja do Bun
Migracja środowiska uruchomieniowego z Node.js do [Bun](https://bun.sh), aby skrócić czas zimnego startu serwera MCP i porzucić krok budowania `tsc` (kod źródłowy uruchamiany bezpośrednio). Zdegradowana z dawnego miejsca v2.5.0: skoro rzeczywistym wąskim gardłem jest koszt przeładowania modelu przy każdym wywołaniu (zobacz v2.5.0 powyżej), skrócenie startu Node jest marginalnym zyskiem, a dojrzałość Bun na Windows plus zmiana modelu dystrybucji niosą ryzyko. Warte zrobienia z czasem jako opcjonalna optymalizacja, nie priorytet.

### Przepływ pracy przemianowania i dopasowania projektów wideo
Cięższa połowa narzędzi projektowych, po wdrożeniu Wyszukiwania transkrypcji w całym projekcie (v2.7.0): rozmyte dopasowywanie transkrypcji edytowanych klipów do transkrypcji źródłowych w celu zlokalizowania punktów pochodzenia oraz wyświetlanie opisowych nazw plików sugerowanych przez Claude.

**Ograniczenia projektowe:**
- Pliki źródłowe są **nigdy nie przemianowywane ani modyfikowane**
- Wszystkie przemianowania wymagają **jawnego potwierdzenia użytkownika**
- Analiza i dopasowywanie odbywają się lokalnie — Claude jest wywoływany tylko gdy użytkownik przegląda wyniki, minimalizując wywołania API

**Status:** Faza projektowania.

### Czyszczenie transkrypcji oparte na regułach
Lokalne, deterministyczne post-przetwarzanie — usuwanie słów wypełniaczy i fałszywych startów, kontrolowane przez użytkownika. Najbardziej wartościowe dla użytkowników trybu prywatności, gdzie transkrypcja nigdy nie dociera do Claude do czyszczenia. Celowo wąskie: podział na akapity i segmentacja tematyczna to rzeczy, które Claude już dobrze robi na zwracanym tekście, a eksport PDF/DOCX to rozszerzanie zakresu w kierunku generowania dokumentów — oba poza zakresem tutaj.

**Status:** W rozważaniu.

### Diaryzacja mówców (pyannote-audio)
Pełna diaryzacja mówców mono z etykietami ID mówcy przez całe nagranie. Różni się od wbudowanej flagi `--diarize` stereo (v2.2.0) i TinyDiarize (v2.6.0).

**Implementacja:** wymaga [pyannote-audio](https://github.com/pyannote/pyannote-audio) — biblioteki Pythona z wymogiem tokenu dostępu Hugging Face, całkowicie oddzielnego stosu zależności. Zdeprioryzowane: kłóci się z etosem lokalnego priorytetu / zero zależności, a TinyDiarize już pokrywa przypadek mono bez zależności. Jeśli zostanie podjęte, dostarczone jako opcjonalny zaawansowany dodatek z własną dokumentacją konfiguracji, nigdy w głównym pakiecie.

**Status:** Zdeprioryzowane / opcjonalne.

### Tłumaczenie na języki inne niż angielski
Flaga `--translate` Whisper jest skierowana tylko na angielski. Dowolne języki docelowe wymagają zewnętrznego API tłumaczenia lub lokalnego modelu tłumaczenia.

**Opcje rozważane:** LibreTranslate (samohosted, lokalny priorytet), lokalny LLM tłumaczący lub jawna dokumentacja poza zakresem.

**Status:** Odroczone, oczekuje decyzji dotyczącej lokalnego priorytetu vs zależności API.

---

## Poza zakresem / Nieplanowane

Funkcje celowo wykluczone, zapisane tutaj, aby decyzja była jawna i nie powracała wielokrotnie.

### Transkrypcja na żywo z mikrofonu — nieplanowana
Transkrypcja w czasie rzeczywistym z mikrofonu na żywo była wcześniej przewidziana na v2.7.0. Wycięta, ponieważ kłóci się z podstawowym projektem projektu:
- **Niezgodność architektury:** MCP jest żądanie/odpowiedź, nie strumieniowanie. Przechwytywanie na żywo wymagałoby albo ciągłego odpytywania (spala budżet API), albo długo blokującego wywołania, które trafia w strażnika limitu czasu pierwszego planu z v2.4.0.
- **Zasady jednej instancji / minimalizacji API:** zwracanie kolejnych segmentów do Claude to ciągła nawałnica wywołań narzędzi — przeciwieństwo „działa dla użytkowników darmowego planu" — a długo żyjący proces strumieniowania obciąża blokadę procesu.
- **Zależność zewnętrzna:** zależałaby od stabilnego API strumieniowania w whisper.cpp, którego harmonogram nie jest w naszej gestii.

Napisy na żywo to odrębna kategoria produktu (niskie opóźnienie, zarządzanie urządzeniami, VAD) niż narzędzie do transkrypcji plików/wsadowej. Użytkownicy, którzy tego potrzebują, są lepiej obsłużeni przez dedykowane narzędzie czasu rzeczywistego.

### Transkrypcja URL YouTube (yt-dlp) — nieplanowana jako dołączone narzędzie
Bezpośrednia transkrypcja YouTube do tekstu przez yt-dlp była wcześniej planowana. Porzucona jako funkcja pierwszej klasy, ponieważ:
- **Powierzchnia bezpieczeństwa:** dodaje pobieranie dowolnych URL i wywołanie podprocesu z danymi kontrolowanymi przez użytkownika, odwracając wzmocnienie z v2.4.0, które zredukowało dokładnie tę powierzchnię.
- **Utrzymanie:** yt-dlp psuje się często, gdy YouTube się zmienia — ciągłe zobowiązanie do utrzymania.
- **Lokalny priorytet i licencjonowanie:** pozyskiwanie treści sieciowych leży poza zakresem lokalnego priorytetu, a dołączanie narzędzia pobierającego do projektu licencjonowanego komercyjnie to szara strefa ToS/odpowiedzialności.
- **Zbędna:** użytkownicy mogą sami uruchomić yt-dlp i skierować `transcribe_audio` na powstały plik.

**Alternatywa:** udokumentowane jako przepis (uruchom yt-dlp, następnie transkrybuj plik) w README / TROUBLESHOOTING, zamiast utrzymywanego narzędzia — przepływ pracy pozostaje dostępny bez posiadania zależności ani powierzchni ataku.

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
