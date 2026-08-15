# whisper-windows-mcp — Plan rozwoju

Aktualna wersja: **v2.5.0**

---

## Zasady projektowania

Zasady te kierują każdą decyzją w tym projekcie i mają pierwszeństwo przed szybkością dodawania funkcji.

**Minimalizacja użycia API Claude.** Cały przepływ pracy transkrypcji — skanowanie, analiza, kolejkowanie, uruchamianie, weryfikacja, przełączanie modeli — musi być możliwy do wykonania przy jak najmniejszej liczbie interakcji z Claude. To narzędzie musi w pełni działać dla użytkowników darmowego planu Claude, którzy nie płacą za subskrypcje Pro lub Max. Każde wywołanie narzędzia zużywa budżet użytkowania. Projektuj odpowiednio.

**Zawsze tylko jedna instancja whisper.** Nigdy nie twórz drugiego procesu whisper-cli.exe, gdy jeden już działa. Blokada procesów jest obowiązkowa i nie podlega negocjacjom.

**Lokalność jako priorytet, prywatność domyślnie.** Audio nigdy nie opuszcza komputera. Żadne API w chmurze nie są potrzebne do podstawowej funkcjonalności. Opcjonalne integracje (np. pobieranie modeli z Hugging Face) muszą być wyraźnie udokumentowane jako opcjonalne.

**Jawna kontrola użytkownika.** Bez cichych operacji masowych. Destrukcyjne lub nieodwracalne działania wymagają potwierdzenia. Użytkownik musi zawsze wiedzieć, co się stanie, zanim to nastąpi.

**Bezpieczne ścieżki Unicode.** Cały I/O plików musi poprawnie obsługiwać nazwy plików zawierające znaki spoza ASCII, w tym japońskie, chińskie, emoji, nawiasy i inne znaki specjalne.

**Modularność i kombinowalność.** Narzędzia są niezależne. Użytkownicy używają tego, czego potrzebują. Żadna funkcja nie powinna wymagać innej, chyba że jest to nieuniknione.

**Optymalizacja przed funkcjami.** Gdy masz wątpliwości między dodaniem funkcji a zmniejszeniem obciążenia systemu lub liczby wywołań API — zmniejsz obciążenie. Duże sesje optymalizacji są kosztowne. Zaprojektuj architekturę poprawnie za pierwszym razem.

---

## Ukończone

### ✅ v1.3.1 — Blokada procesów
Dodano sprawdzanie `isWhisperRunning()` używające `tasklist /FI` przed uruchomieniem jakiegokolwiek procesu transkrypcji. Zwraca wyraźny błąd z instrukcjami Menedżera zadań, zamiast tworzyć konkurujący proces.

### ✅ v1.4.0 — Akceleracja GPU Vulkan
Skompilowano whisper.cpp ze źródeł z `-DGGML_VULKAN=ON` przy użyciu VS Build Tools 2022 i Vulkan SDK. Gotowe binaria Vulkan dystrybuowane jako `whisper-vulkan-win-x64.zip`.

**Wyniki na AMD Radeon RX Vega 56:** średnie wykorzystanie GPU ~16%. Plik 58-minutowy kończy się w ~4,5 minuty na GPU wobec ~88 minut na samym CPU.

### ✅ v1.5.0 — Diagnostyka systemu
Narzędzie `check_system`: wykrywanie GPU przez `wmic`, weryfikacja DLL Vulkan, raportowanie VRAM, rekomendacja rozmiaru modelu.

### ✅ v1.6.0 — Wstępna analiza pliku
Narzędzie `analyze_media` przez FFprobe: czas trwania, rozmiar, kodek, status transkrypcji, szacowanie czasu CPU i GPU. Skanowanie pojedynczego pliku lub folderu z opcjami sortowania.

### ✅ v1.7.0 — Transkrypcja w tle + widoczność postępu
Architektura odłączonego procesu: `transcribe_audio` z `background=true` uruchamia whisper jako odłączony proces i natychmiast zwraca ID zadania. `check_progress` analizuje znaczniki czasu segmentów ze stderr whisper, podając procent ukończenia i ETA w czasie rzeczywistym.

### ✅ v1.8.0 — Sekwencyjne przetwarzanie wsadowe z weryfikacją
`start_batch` i `check_batch_progress`: automatyczne przetwarzanie sekwencyjne, weryfikacja transkrypcji (wykrywanie pustych/krótkich wyników), automatyczne przesuwanie kolejki, znaczniki czasu postępu dla każdego pliku.

### ✅ v1.9.0 — Obsługa wielu języków i tłumaczenie
`generate_subtitles` z wykrywaniem `language=auto` oraz podwójnym wyjściem SRT przy `translate_to_english=true`. Dodano obsługę formatów `.3gp` i `.ts`. `language=auto` dostępne także w `transcribe_audio`.

**Znane ograniczenie:** wbudowane tłumaczenie Whisper obsługuje wyłącznie angielski jako język docelowy. Wymaga modelu `large-v3` dla języków innych niż angielski — modele wyłącznie angielskie (`*.en.bin`) generują `[FOREIGN]` przy audio nieanglojęzycznym.

### ✅ v2.0.0 — Bezpieczne ścieżki Unicode + SRT w tle
**Nazwy plików Unicode:** pliki ze znakami spoza ASCII w nazwie powodowały ciche niepowodzenie transkrypcji w tle. Naprawiono przez kierowanie całego wyjścia przez oczyszczoną, tymczasową ścieżkę opartą na ID zadania, a następnie przenoszenie wyniku do właściwego miejsca docelowego po zakończeniu.

**SRT w trybie w tle:** `spawnDetached` wcześniej na stałe kodowało `-otxt` niezależnie od żądanego formatu. Naprawiono przez dodanie parametru `outputFormat` do `spawnDetached`, obsługując wyjście `text` i `srt` w trybie w tle.

### ✅ v2.0.1 — Poprawki błędów (dostarczone w v2.2.0)
- `--max-context 0` zakodowane na stałe zarówno w `buildArgs`, jak i w `spawnDetached` — zapobiega pętlom halucynacji na długim audio.
- `--no-speech-thold 0.6` zakodowane na stałe w obu funkcjach — segmenty poniżej progu pewności są traktowane jako cisza, a nie jako halucynowana treść.
- Walidacja ścieżki (`validateInputPath`) — odrzuca ścieżki UNC i przejścia `..`.
- Zabezpieczenie rozmiaru pliku `MAX_FILE_SIZE_MB = 10240`.
- Komentarz bezpieczeństwa dotyczący iniekcji transkrypcji w `transcribeSingle`.
- Naprawiono uszkodzone polecenie CLI przetwarzania wsadowego w TROUBLESHOOTING.md.

### ✅ v2.1.0 — Zestaw zarządzania modelami (dostarczony w v2.2.0)
- `WHISPER_MODEL` zmienione z `const` na `let` (mutowalne w obrębie sesji).
- `MODEL_REGISTRY` — 16 modeli, warianty pełnej precyzji i skwantyzowane, adresy URL pobierania z Hugging Face.
- `ALLOWED_HF_PREFIXES` — lista dozwolonych adresów URL ograniczająca pobieranie do przestrzeni nazw `ggerganov/whisper.cpp` i `ggml-org`.
- Narzędzie `list_models` — skanuje katalog modeli, pokazuje aktywny model, rozmiary, przypadki użycia oraz dostępne pobrania.
- Narzędzie `download_model` — pobiera z Hugging Face przez wbudowany moduł `https` Node.js, z atomową zmianą nazwy.
- Narzędzie `switch_model` — waliduje rozszerzenie `.bin`, ograniczenie do katalogu oraz sprawdza blokadę procesu.
- Zaktualizowano `recommendedModel()`, aby rekomendował `large-v3-turbo` dla VRAM 6GB+.

### ✅ v2.2.0 — Rozszerzenie jakości, parametrów i obsługi sprzętu
- Interfejs `WhisperOptions` zastępujący argumenty pozycyjne w `buildArgs`.
- Nowe parametry w `transcribe_audio`: `temperature`, `prompt`, `condition_on_prev_text`, `no_speech_thold`, `beam_size`, `best_of`, `gpu_device`, `processors`, `word_timestamps`, `max_segment_length`, `split_on_word`, `diarize`, `vad_model`, `offset_t`, `duration`.
- Nowe parametry w `generate_subtitles`: `temperature`, `prompt`, `beam_size`, `best_of`, `diarize`, `vad_model`.
- Zrefaktoryzowano `spawnDetached` — wszystkie flagi jakości stosowane w trybie w tle/wsadowym.
- Poprawka wyjścia wsadowego — `readBatchProgress` przenosi teraz wyjście tymczasowe do końcowego miejsca docelowego przed weryfikacją.

**Uwaga dotycząca zgodności flag:** `gpu_device` / `--device` zostało dodane w whisper.cpp v1.8.4. Gotowe binarium Vulkan w wydaniach pochodzi z okresu v1.8.3 — ten parametr jest akceptowany przez narzędzie, ale nie odniesie żadnego efektu, dopóki użytkownicy nie zaktualizują binarium do wersji v1.8.4+.

### ✅ v2.2.2 — Łatka
- Poprawka podwójnej licencji — LICENSE i LICENSE-COMMERCIAL.md skorygowane.
- Drobne poprawki dokumentacji.

### ✅ v2.3.0 — Automatyczne przesuwanie kolejki wsadowej, architektura prywatności, rozszerzenie formatów wyjściowych

**Automatyczne przesuwanie kolejki wsadowej (krytyczna poprawka błędu):** `start_batch` wcześniej wymagało aktywnego odpytywania, aby przesuwać kolejkę. Do każdego uruchomionego procesu potomnego whisper-cli dołączany jest teraz handler `on('exit')`. Gdy proces kończy działanie, kolejka wsadowa przesuwa się natychmiast poprzez callback wyjścia, z zerowym narzutem odpytywania i zerowym zużyciem wywołań API. Mutex zapobiega podwójnemu uruchomieniu między współbieżnym handlerem wyjścia a wywołaniami `check_batch_progress`.

**Architektura prywatności:**
- Zmienna środowiskowa `WHISPER_PRIVACY_MODE` — gdy `true`, wszystkie odpowiedzi narzędzi zwracają wyłącznie metadane (nazwa pliku, liczba słów, ścieżka zapisu). Żaden tekst transkrypcji nigdy nie jest przesyłany do API Claude. Transkrypcje istnieją wyłącznie jako lokalne pliki.
- Zmienna środowiskowa `WHISPER_CONSENT_ACKNOWLEDGED` — gdy `true`, pomija jednorazową bramkę zgody sesji dla treści niewrażliwych.
- Parametr `privacy_mode` dla pojedynczego wywołania w `transcribe_audio`, `transcribe_batch`, `start_batch` i `check_progress`. Zastępuje globalną zmienną środowiskową w obu kierunkach. Nie wymaga restartu do przełączania per wywołanie.
- Bramka trybu prywatności (`checkPrivacyGate()`) — uruchamia się przed każdą operacją, gdy efektywny tryb prywatności jest aktywny. Uzbraja się przy pierwszym wywołaniu (pokazuje informację), zwalnia przy drugim (zezwala). Resetuje się po każdej operacji. Całkowicie niezależna od bramki zgody sesji.
- Bramka zgody sesji (`transcriptPolicy()`) — uruchamia się raz na sesję, przed pierwszym wywołaniem zwracającym transkrypcję w trybie standardowym. Konsumowana przez flagę `sessionConsentGiven`.
- `PRIVACY.md` — pełna dokumentacja zgodności obejmująca HIPAA, RODO, tajemnicę adwokacką, FERPA, SOX, PCI-DSS oraz NDA/tajemnicę handlową.
- Ostrzeżenia o prywatności w opisach wszystkich narzędzi zwracających transkrypcję.

**Rozszerzenie formatów wyjściowych:**
- `vtt` — wyjście napisów WebVTT przez `-ovtt`. Dostępne w `transcribe_audio`, `generate_subtitles`, `start_batch` i trybie w tle.
- `lrc` — format tekstów/karaoke LRC przez `-olrc`. Dostępne w `transcribe_audio` i trybie w tle.
- `csv` — CSV ze znacznikami czasu przez `-ocsv`. Dostępne w `transcribe_audio` i trybie w tle.
- Domyślny `output_format` zmieniony z `"text"` na `"timestamps"` we wszystkich narzędziach i ścieżkach kodu. Zwykły tekst jest teraz włączany opcjonalnie.

**Poprawki błędów:**
- Błąd 1: `output_format` nie był przekazywany do zadań w tle — niezależnie od żądanego formatu używany był domyślny `"text"`. Naprawiono przez zmianę wartości domyślnej na `"timestamps"` i poprawne przekazywanie.
- Błąd 2: cichy `catch {}` w operacji przenoszenia wyjścia zadania w tle ukrywał niepowodzenia. Dodano jawne sprawdzenie `existsSync` ze szczegółowym komunikatem o błędzie po przeniesieniu.
- Błąd 3: dodano komentarz projektowy w punkcie uruchamiania w tle, dokumentujący, dlaczego bramka zgody jest celowo odroczona do `check_progress` dla zadań w tle bez trybu prywatności.

**Dodatkowo:**
- Automatyczne czyszczenie katalogu tymczasowego — `cleanupOldJobFiles()` uruchamia się przy starcie, usuwając pliki `.json` i `.log` starsze niż 7 dni z `%TEMP%\whisper-mcp-jobs\`.
- `check_config` raportuje teraz status trybu prywatności.
- Dziennik startowy raportuje włączenie/wyłączenie trybu prywatności.
- Interfejs `Job` rozszerzony o pole `privacyMode: boolean`.
- Interfejs `BatchState` rozszerzony o pole `privacyMode: boolean`.
- Typ `BackgroundFormat` wyklucza `json` (json w trybie w tle pozostaje nieobsługiwany — powraca do `text`).

### ✅ v2.4.0 — Wzmocnienie, strażnik pierwszego planu, zestaw testów i CI

Przegląd pod kątem bezpieczeństwa/odporności; planowana migracja do Bun została przeniesiona na v2.5.0.

**Bezpieczeństwo i poprawność:**
- Poprawka ograniczenia ścieżki w `switch_model` — katalog o prefiksie-rodzeństwie (np. `…\models-evil`) mógł wcześniej spełnić sprawdzenie „wewnątrz katalogu modeli” przez naiwne `startsWith`; zastąpione znormalizowanym ograniczeniem opartym na `relative()`. Zamyka lukę opisaną w SECURITY.md.
- Bramka prywatności/zgody kluczowana **per operacja** (narzędzie + argumenty) — potwierdzenie jednej transkrypcji nie może już spełnić bramki innej operacji.
- `download_model` odrzuca obcięte pobrania (sprawdzenie Content-Length) przed promowaniem pliku `.part`. (Pełna weryfikacja skrótu SHA256 przewidziana na późniejszy przegląd.)
- Koercja danych wejściowych — numeryczne parametry narzędzi, które nie są prawdziwymi liczbami, są odrzucane zamiast przekazywane do whisper-cli jako `NaN`.

**Odporność:**
- **Strażnik limitu czasu pierwszego planu** — plik na tyle długi, by w trybie blokującym przekroczyć ~4-minutowy limit czasu narzędzia MCP w Claude Desktop, jest wykrywany z góry i kierowany do tła, zamiast po cichu przekraczać limit czasu. Próg konfigurowalny przez `WHISPER_FOREGROUND_MAX_SEC`. Skorygowano szacunki czasu (stary szacunek GPU mocno zaniżał; dominujący koszt ponownego ładowania modelu jest teraz modelowany — zmierzony, a nie zgadywany).
- Atomowe zapisy stanu zadań/kolejki wsadowej (plik tymczasowy + zmiana nazwy), aby współbieżny czytelnik nie mógł zobaczyć rozdartego pliku JSON.
- Odporne na kolizje identyfikatory zadań/kolejki/plików tymczasowych (z sufiksem UUID).
- Łagodne zamknięcie przy SIGINT/SIGTERM, które czyści pliki tymczasowe trybu blokującego.

**Wybór urządzenia GPU:**
- Zmienna środowiskowa `WHISPER_GPU_DEVICE` oraz `gpu_device` są teraz przekazywane przez `generate_subtitles` i przebieg wykrywania języka (wcześniej tylko `transcribe_audio`). `check_config` raportuje aktywne urządzenie. `check_system` nie raportuje już błędnie problemu ze sterownikiem, gdy `wmic` (przestarzałe w Windows 11 24H2+) nic nie zwraca.

**Jakość:**
- Zestaw testów jednostkowych `node:test` obejmujący czystą logikę (ograniczenie ścieżek, kluczowanie bramki, zapisy atomowe, koercja danych wejściowych, szacowanie limitu czasu), zero dodatkowych zależności, plus przepływ pracy CI GitHub Actions uruchamiający go przy każdym push/PR.

**Zidentyfikowane do przyszłego wydania:** trwała ścieżka modelu (np. `whisper-server` z whisper.cpp), aby wyeliminować koszt ponownego ładowania modelu ponoszony przy każdej transkrypcji — duży zysk przepustowości dla pracy wsadowej/archiwalnej.

### ✅ v2.5.0 — Trwały serwer modelu + TinyDiarize

**Trwały serwer modelu (Faza 1).** whisper-cli jest jednorazowy: przeładowuje pełny model przy każdym wywołaniu — v2.4.0 zmierzyła to przeładowanie na ~110s na GPU z ograniczoną pamięcią, stały podatek na plik, który dominuje czas rzeczywisty pracy wsadowej/archiwalnej. v2.5.0 dodaje opcjonalny tryb modelu rezydentnego, który utrzymuje model w pamięci między transkrypcjami.
- Narzędzie `whisper_server` (`start` / `stop` / `status`). Serwer rezydentny *staje się* pojedynczą instancją, zachowując zasadę jednej instancji whisper: żądania są względem niego serializowane, bez wprowadzania współbieżności.
- Blokujące `transcribe_audio` i `transcribe_batch` kierowane są przez serwer rezydentny po localhost (`127.0.0.1`) za pomocą `POST /inference`, pomijając koszt przeładowania. Strażnik limitu czasu pierwszego planu jest pomijany w trybie serwera (brak przeładowania do opłacenia).
- `switch_model` podmienia model rezydentny w locie przez `POST /load`, bez restartu. `check_config` raportuje stan serwera; posiadany serwer jest zabijany przy zamknięciu, aby zwolnić VRAM.
- Zasada jednego silnika / współdzielonego VRAM wymuszana twardym zabezpieczeniem w ścieżce odłączonego uruchamiania plus przyjazne odrzucenia: gdy serwer działa, zadania w tle, `start_batch`, `generate_subtitles`, wyjście `lrc`/`csv` oraz opcje per żądanie, których API HTTP nie honoruje (`beam_size`, `best_of`, `word_timestamps`, `diarize`, `tinydiarize`, `vad_model`, `offset_t`, `duration` itd.), są odrzucane z komunikatem „najpierw zatrzymaj serwer”, zamiast po cichu degradować.
- Konfiguracja: `WHISPER_SERVER_PATH`, `WHISPER_SERVER_PORT` (domyślnie 8571, tylko localhost).

**Ograniczenia projektowe:**
- Jawny cykl życia: start / stop / status, ze sprawdzeniem stanu. Serwer nigdy nie jest uruchamiany po cichu jako efekt uboczny niepowiązanego wywołania.
- Powiązanie tylko z localhost — nigdy z routowalnym interfejsem. Brak wystawienia na sieć (spójne z zasadą lokalnego priorytetu i wzmocnieniem z v2.4.0).
- Łagodna degradacja: jeśli serwer nie działa, transkrypcja nadal działa przez istniejącą jednorazową ścieżkę whisper-cli. Serwer jest optymalizacją, a nie twardą zależnością.
- `switch_model` przeładowuje model w serwerze rezydentnym (wciąż znacznie tańsze w amortyzacji niż przeładowywanie na plik).
- Bramki prywatności i zgody pozostają bez zmian — znajdują się ponad mechanizmem transkrypcji.
- Wybór portu z obsługą kolizji; czyste zamknięcie przy SIGINT/SIGTERM obok istniejącego czyszczenia plików tymczasowych.

**TinyDiarize.** Obsługa `--tinydiarize` z modelami obsługującymi `tdrz`. W przeciwieństwie do stereofonicznej flagi `--diarize` (v2.2.0), TinyDiarize oznacza zmiany mówcy na nagraniach **mono** i nie wymaga niczego poza plikiem modelu — bez Pythona, bez usługi zewnętrznej.
- Parametr `tinydiarize` w `transcribe_audio` i `generate_subtitles` (tryb blokujący i w tle); `--tinydiarize` przeprowadzone przez oba buildery argumentów.
- `small.en-tdrz` dodane do `MODEL_REGISTRY`, aby `download_model` mógł je pobrać z istniejących zaufanych przestrzeni nazw Hugging Face.

---

## Planowane — v2.6.0: Trwały serwer modelu — Faza 2

Kierowanie zadań w tle i `start_batch` przez serwer rezydentny. Faza 1 (v2.5.0) obejmuje wyłącznie transkrypcję blokującą; to jest większy zysk archiwalny/przepustowości i wymaga przerobienia warstwy zadań/kolejki wokół żądań HTTP zamiast odłączonych PID — śledzenie postępu bez PID oraz anulowanie oparte na HTTP.

**Ograniczenia projektowe** serwera rezydentnego ustanowione w v2.5.0 nadal rządzą Fazą 2 — powiązanie tylko z localhost, jawny cykl życia, łagodna jednorazowa degradacja oraz niezmienione bramki prywatności/zgody. Faza 2 dodaje kierowanie zadań/kolejki, nie rozluźniając żadnego z nich.

**Status:** Planowane.

---

## Planowane — v2.7.0: Wyszukiwanie transkrypcji w całym projekcie

Samodzielne narzędzie do wyszukiwania frazy lub wzorca we wszystkich transkrypcjach w katalogu projektu i zwracania dopasowań wraz z ich plikiem źródłowym i kodem czasowym. Wydzielone z większego przepływu pracy projektów wideo (zobacz „Później / W rozważaniu”) — ta połowa jest niezależnie użyteczna, niskiego ryzyka i lekka dla API: wyszukiwanie działa lokalnie, a Claude jest angażowany tylko wtedy, gdy użytkownik przegląda wyniki.

**Status:** Planowane.

---

## Planowane — v2.8.0: Wyjście importowalne do edytorów i formaty integracji

Zamiana transkrypcji w artefakty, które edytor wideo importuje bezpośrednio, tak aby transkrypcja zasilała montaż, a nie kończyła się na pliku tekstowym — to jest główna motywacja projektu: uczynienie dużego archiwum surowego materiału użytecznym dla twórcy pracującego w pojedynkę.

- **Najpierw marker CSV** — początki segmentów jako plik CSV markerów/rozdziałów, który Premiere, Resolve i YouTube importują natywnie. Dostarcza większości wartości „wrzuć to do mojego edytora” przy ułamku kosztu i podatności na zmiany wersji, jakie niesie pełny format osi czasu.
- **Dane taktowania na poziomie słów** — udostępnienie pełnotokenowego JSON z whisper.cpp (`--output-json-full` / `-ojf`) oraz znaczników czasu słów wyrównanych DTW (`--dtw <preset>`, automatycznie dopasowywane do aktywnego modelu; presety istnieją dla każdej rodziny, w tym `large.v3.turbo`, i mają zastosowanie do modeli skwantyzowanych). To jest warstwa dokładnego taktowania, na której opierają się SRT na poziomie słów, rozmieszczanie markerów i wyrównywanie klipów; JSON per token niesie także wartości pewności dla każdego, kto ich potrzebuje. Uwaga: `--dtw` to **flaga czasu ładowania/kontekstu** (ustawiana przy inicjalizacji modelu, nie per żądanie), więc funkcjonuje w jednorazowej ścieżce CLI — rezydentne API `/inference` serwera `whisper-server` nie może jej zastosować per żądanie, zgodnie z odrzuceniem opcji na poziomie słów w trybie serwera z v2.5.0.
- **Zamknięcie luki JSON-w-tle** — JSON obecnie powraca do tekstu w trybie w tle.
- **FCPXML / EDL — odroczone:** rozwlekłe, wrażliwe na wersje i ciągnące w stronę zakresu integracji z edytorem. Wrócić do tego tylko, jeśli marker CSV okaże się niewystarczający.

**Granica zakresu:** to generuje pliki, które edytor *importuje* — nie automatyzuje interfejsu edytora. Standardowa wymiana danych jest zgodna z etosem i lekka pod względem zależności; sterowanie aplikacją to osobne zagadnienie.

Współgra z v2.7.0: przeszukaj archiwum, aby znaleźć moment, a następnie przekaż edytorowi plik markerów, by przeskoczyć prosto do niego.

---

## Planowane — v2.9.0: Jakość i strojenie transkrypcji

Pogłębienie dokładności i kontroli transkrypcji — wszystko to bezzależnościowe przekazania flag whisper.cpp, których wrapper jeszcze nie udostępnia. Każda opcja tutaj jest jednorazowym parametrem transkrypcji: żadnego dodatkowego narzutu wywołań narzędzi, w pełni funkcjonalne dla użytkowników darmowego planu.

- **Strojenie VAD** — pokrętła wykrywania aktywności głosowej (`--vad-threshold`, minimalny czas mowy / minimalny czas ciszy / maksymalny czas mowy, wypełnienie mowy, nakładanie próbek). VAD jest już włączone, ale nie da się go stroić; te opcje naprawiają nad- i pod-segmentację stojącą za większością rzeczywistych skarg na jakość.
- **Tłumienie tokenów niemownych** (`--suppress-nst`) — usuwanie artefaktów `[music]` / szumu dla czystszych transkrypcji.
- **Tylko wykrywanie języka** (`--detect-language`) — tania sonda „w jakim to języku?”, która zwraca wynik bez pełnego przebiegu transkrypcji. Wartościowe dla odbiorców wielojęzycznych i do routingu przed transkrypcją.
- **Progi odporności / dekodowania** — `--entropy-thold`, `--logprob-thold`, `--word-thold`, `--no-fallback`, `--temperature-inc`, `--carry-initial-prompt`, `--suppress-regex` dla trudnego audio.
- **Pokrętła wydajności** — flash attention (obecnie **domyślnie włączone** w aktualnym whisper.cpp; udostępnij ścieżkę wyłączania `--no-flash-attn` / `-nfa`, zamiast traktować to jako opcję do włączenia), tryb tylko CPU (`--no-gpu`), rozmiar kontekstu audio (`--audio-ctx`).

**Status:** Planowane.

---

## Planowane — v3.0.0: Zestaw post-przetwarzania napisów

Warstwa wsadowa w czystym TypeScript nad SRT / VTT / JSON, które serwer już emituje — bez ponownej transkrypcji, bez nowych zależności, jeden współdzielony parser/serializator. Odzwierciedla łańcuch „konwersji wsadowej” dedykowanych edytorów napisów (Subtitle Edit, Aegisub), którego nie oferuje żaden konkurencyjny MCP do transkrypcji. Szczególnie przebieg naprawy taktowania celuje w wady, jakie wykazuje surowe wyjście Whisper — puste linie na ciszy, nakładające się lub zbyt krótkie segmenty, duplikaty z pętli powtórzeń, zbyt długie wersy — tak że zestaw czyści *własne* wyjście tego serwera, a nie tylko pliki importowane.

- **Naprawa taktowania i walidacja** — wymuszanie minimalnego / maksymalnego czasu trwania linii; naprawa nakładających się linii; stosowanie minimalnej przerwy między liniami; mostkowanie przerw poniżej progu (rozciągnięcie do następnej); usuwanie pustych linii; scalanie zduplikowanych linii (pętle powtórzeń Whisper); ograniczenie do dwóch wersów; sortowanie + ponowna numeracja. Plus niemutujący **raport lint**, który flaguje dla każdej linii prędkość czytania (CPS), znaki na wers oraz naruszenia liczby wersów wobec wybieralnego profilu (np. YouTube 42 CPL / 20 CPS, Netflix 42 / 17) — właśnie tego edytorzy chcą przed importem.
- **Ponowne taktowanie** — przesunięcie / przesuwanie wszystkich linii; ponowne taktowanie do liczby klatek (np. 23.976 ↔ 25).
- **Reflow** — scalanie krótkich linii; dzielenie długich wersów do maksymalnej liczby znaków na wers / znaków na sekundę, z równoważeniem dwóch wersów zamiast zachłannego podziału.
- **Konwersja formatów** — konwersja istniejących plików między SRT / VTT / LRC / CSV / Markdown / zwykłym tekstem, plus wyjście ASS/SSA (z domyślnym stylem), bez ponownej transkrypcji. Normalizacja UTF-8 / zakończeń wierszy przy zapisie (spełnia wymóg UTF-8 YouTube, zapobiega mojibake przy ponownym imporcie).
- **Czyszczenie tekstu** — znajdź/zamień (regex opcjonalnie), usuwanie słów wypełniaczy ze statycznej listy słów (nie LLM), normalizacja wielkości liter, usuwanie adnotacji dla niedosłyszących. Ściśle mechaniczne — wszystko, co wymaga osądu (naprawa OCR, wnioskowanie interpunkcji), pozostaje poza zakresem; host Claude zajmuje się tym na zwróconym tekście.
- **Formatowanie etykiet mówców** — formatowanie istniejących zmian mówcy stereo / TinyDiarize jako bloków z prefiksem mówcy.
- **Statystyki podsumowujące** — liczba słów, czas trwania, WPM, średnie CPS, współczynnik ciszy.

**Ograniczenia projektowe:**
- Czysty TypeScript nad SRT / VTT / JSON, które serwer już emituje — bez ponownej transkrypcji, bez nowych zależności uruchomieniowych, jeden współdzielony parser/serializator.
- Działa wyłącznie na istniejących plikach napisów/transkrypcji — nigdy nie wywołuje whisper ani ffmpeg, nigdy nie dotyka audio.
- Wyłącznie deterministyczne i oparte na regułach — bez LLM, bez chmury, bez „inteligentnej” naprawy. Wszystko, co wymaga osądu (naprawa OCR, wnioskowanie interpunkcji), pozostaje poza zakresem; host Claude zajmuje się tym na zwróconym tekście.
- Nieniszczące — zapisuje nowe pliki; nigdy nie nadpisuje pliku źródłowego w miejscu bez jawnego potwierdzenia użytkownika.
- Przebieg lint / walidacji jest niemutujący — raportuje naruszenia, nigdy po cichu nie przepisuje.
- Wyłącznie standardowe formaty wymiany — nigdy nie steruje interfejsem edytora.

**Status:** Planowane.

---

## Później / W rozważaniu

Nie zaplanowane, ale zgodne z etosem i rewidowane w miarę dostępności zasobów.

### Migracja do Bun
Migracja środowiska uruchomieniowego z Node.js do [Bun](https://bun.sh), aby skrócić czas zimnego startu serwera MCP i porzucić krok budowania `tsc` (kod źródłowy uruchamiany bezpośrednio). Zdegradowana z dawnego miejsca v2.5.0: skoro rzeczywistym wąskim gardłem jest koszt przeładowania modelu przy każdym wywołaniu (zobacz v2.5.0 powyżej), skrócenie startu Node jest marginalnym zyskiem, a dojrzałość Bun na Windows plus zmiana modelu dystrybucji niosą ryzyko. Warte zrobienia z czasem jako opcjonalna optymalizacja, nie priorytet.

### Przepływ pracy przemianowania i dopasowania projektów wideo
Cięższa połowa narzędzi projektowych, po wdrożeniu Wyszukiwania transkrypcji w całym projekcie (v2.7.0): rozmyte dopasowywanie transkrypcji zmontowanych klipów do transkrypcji źródłowych w celu zlokalizowania punktów pochodzenia oraz proponowanie opisowych nazw plików sugerowanych przez Claude.

**Ograniczenia projektowe:**
- Pliki źródłowe **nigdy nie są przemianowywane ani modyfikowane**
- Wszystkie przemianowania wymagają **jawnego potwierdzenia użytkownika**
- Analiza i dopasowywanie odbywają się lokalnie — Claude jest wywoływany tylko wtedy, gdy użytkownik przegląda wyniki, minimalizując wywołania API

**Status:** Faza projektowania.

### Czyszczenie transkrypcji oparte na regułach
Lokalne, deterministyczne post-przetwarzanie — usuwanie słów wypełniaczy i fałszywych startów, kontrolowane przez użytkownika. Najbardziej wartościowe dla użytkowników trybu prywatności, gdzie transkrypcja nigdy nie dociera do Claude w celu czyszczenia. Celowo wąskie: podział na akapity i segmentacja tematyczna to rzeczy, które Claude już dobrze robi na zwróconym tekście, a eksport PDF/DOCX to rozszerzanie zakresu w kierunku generowania dokumentów — oba poza zakresem tutaj.

**Status:** Awansowane — deterministyczne czyszczenie jest zaplanowane w Zestawie post-przetwarzania napisów w v3.0.0; uwagi o tym, co poza zakresem (podział na akapity, PDF/DOCX), pozostają aktualne.

### Diaryzacja mówców (pyannote-audio)
Pełna diaryzacja mówców mono z etykietami ID mówcy przez całe nagranie. Różni się od wbudowanej flagi `--diarize` stereo (v2.2.0) i TinyDiarize (v2.5.0).

**Implementacja:** wymaga [pyannote-audio](https://github.com/pyannote/pyannote-audio) — biblioteki Pythona z wymogiem tokenu dostępu Hugging Face, całkowicie oddzielnego stosu zależności. Zdeprioryzowane: kłóci się z etosem lokalnego priorytetu / zero zależności, a TinyDiarize już pokrywa bezzależnościowy przypadek mono. Jeśli zostanie podjęte, dostarczone jako opcjonalny zaawansowany dodatek z własną dokumentacją konfiguracji, nigdy w głównym pakiecie.

**Status:** Zdeprioryzowane / opcjonalne.

### Tłumaczenie na języki inne niż angielski
Flaga `--translate` Whisper obsługuje wyłącznie angielski jako język docelowy. Dowolne języki docelowe wymagają zewnętrznego API tłumaczenia lub lokalnego modelu tłumaczenia.

**Rozważane opcje:** LibreTranslate (możliwy do samodzielnego hostowania, lokalny priorytet), lokalny LLM tłumaczący lub jawna dokumentacja poza zakresem.

**Status:** Odroczone, oczekuje decyzji dotyczącej lokalnego priorytetu vs zależności od API.

---

## Poza zakresem / Nieplanowane

Funkcje celowo wykluczone, zapisane tutaj, aby decyzja była jawna i nie powracała wielokrotnie.

### Transkrypcja na żywo z mikrofonu — nieplanowana
Transkrypcja w czasie rzeczywistym z mikrofonu na żywo była wcześniej przewidziana na v2.7.0. Wycięta, ponieważ kłóci się z podstawowym projektem projektu:
- **Niezgodność architektury:** MCP jest żądanie/odpowiedź, nie strumieniowanie. Przechwytywanie na żywo wymagałoby albo ciągłego odpytywania (spala budżet API), albo długo blokującego wywołania, które trafia w strażnika limitu czasu pierwszego planu z v2.4.0.
- **Zasady jednej instancji / minimalizacji API:** zwracanie kolejnych segmentów do Claude to ciągła nawałnica wywołań narzędzi — przeciwieństwo „funkcjonalne dla użytkowników darmowego planu” — a długo żyjący proces strumieniowania obciąża blokadę procesu.
- **Zależność zewnętrzna:** wymagałoby to dodatkowej zewnętrznej zależności.

Napisy na żywo to odrębna kategoria produktu (niskie opóźnienie, zarządzanie urządzeniami, VAD) niż narzędzie do transkrypcji plików/wsadowej. Użytkownicy, którzy tego potrzebują, są lepiej obsłużeni przez dedykowane narzędzie czasu rzeczywistego.

### Transkrypcja URL YouTube (yt-dlp) — nieplanowana jako dołączone narzędzie
Bezpośrednia transkrypcja YouTube do tekstu przez yt-dlp była wcześniej planowana. Porzucona jako funkcja pierwszej klasy, ponieważ:
- **Powierzchnia bezpieczeństwa:** dodaje pobieranie dowolnych URL i wywołanie podprocesu z danymi kontrolowanymi przez użytkownika, odwracając wzmocnienie z v2.4.0, które zredukowało dokładnie tę powierzchnię.
- **Utrzymanie:** yt-dlp psuje się często, gdy YouTube się zmienia — ciągłe zobowiązanie utrzymaniowe.
- **Lokalny priorytet i licencjonowanie:** pozyskiwanie treści sieciowych leży poza zakresem lokalnego priorytetu, a dołączanie narzędzia pobierającego do projektu licencjonowanego komercyjnie to szara strefa ToS/odpowiedzialności.
- **Zbędne:** użytkownicy mogą sami uruchomić yt-dlp i skierować `transcribe_audio` na powstały plik.

**Alternatywa:** udokumentowane jako przepis (uruchom yt-dlp, następnie transkrybuj plik) w README / TROUBLESHOOTING, zamiast utrzymywanego narzędzia — przepływ pracy pozostaje dostępny bez posiadania zależności ani powierzchni ataku.

---

## Licencjonowanie

whisper-windows-mcp jest licencjonowany podwójnie.

**Użytek niekomercyjny:** MIT — bezpłatny do użytku osobistego, edukacyjnego i niekomercyjnego. Zobacz [LICENSE](LICENSE).

**Użytek komercyjny:** dla jakiegokolwiek użytku biznesowego, zawodowego lub generującego przychody wymagana jest osobna licencja komercyjna. Warunki i dane kontaktowe — w [COMMERCIAL-LICENSE.md](COMMERCIAL-LICENSE.md).

---

## Dystrybucja

Dostępne na [npm](https://www.npmjs.com/package/whisper-windows-mcp), [mcpservers.org](https://mcpservers.org), [Glama](https://glama.ai) oraz [awesome-mcp-servers](https://github.com/punkpeye/awesome-mcp-servers) (PR zgłoszony).

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
