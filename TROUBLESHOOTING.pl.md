# whisper-windows-mcp — Rozwiązywanie problemów

---

## Szybka lista kontrolna

Przed głębszym śledztwem zweryfikuj wszystkie poniższe punkty:

- Ścieżki w `claude_desktop_config.json` używają **podwójnych ukośników odwrotnych** (`C:\\whisper\\...`)
- `whisper-cli.exe` istnieje pod ścieżką podaną w `WHISPER_CLI_PATH`
- Plik modelu `.bin` istnieje pod ścieżką podaną w `WHISPER_MODEL`
- FFmpeg jest zainstalowany i dostępny (`ffmpeg -version` działa w wierszu poleceń)
- Claude Desktop został **w pełni uruchomiony ponownie** po edycji konfiguracji (wyjście z zasobnika systemowego, a nie tylko zamknięcie okna)
- Serwer whisper wyświetla się jako **uruchomiony** (zielony znaczek) w Ustawieniach → Deweloper

---

## Instalacja i uruchamianie

### Whisper nie pojawia się w Claude Desktop → Ustawienia → Deweloper

1. Otwórz Claude Desktop → Ustawienia → Deweloper → Edytuj konfigurację
2. Sprawdź, czy JSON jest prawidłowy — wklej go na [jsonlint.com](https://jsonlint.com) w razie wątpliwości
3. Upewnij się, że `WHISPER_CLI_PATH` i `WHISPER_MODEL` wskazują na pliki, które faktycznie istnieją
4. Wyjdź z Claude Desktop z zasobnika systemowego (kliknij prawym przyciskiem myszy ikonę w zasobniku → Wyjdź)
5. Uruchom ponownie Claude Desktop i sprawdź ponownie

Jeśli whisper pojawia się, ale pokazuje znaczek błędu zamiast zielonego:
- Zapytaj Claude: *"Sprawdź konfigurację whisper"* — narzędzie `check_config` zwraca konkretny komunikat błędu
- Sprawdź Claude Desktop → Ustawienia → Deweloper → kliknij nazwę serwera dla dziennika błędów

### Błąd "whisper-cli.exe nie znaleziony"

Ścieżka w `WHISPER_CLI_PATH` nie odpowiada miejscu, gdzie binarium zostało rozpakowane.

Domyślna oczekiwana ścieżka: `C:\whisper\Release\whisper-cli.exe`

Sprawdź istnienie pliku:
```powershell
Test-Path "C:\whisper\Release\whisper-cli.exe"
```

Powinno zwrócić `True`. Jeśli zwraca `False`, albo rozpakuj plik zip wydania do `C:\whisper\Release\` albo zaktualizuj `WHISPER_CLI_PATH` w konfiguracji, aby odpowiadał rzeczywistej lokalizacji.

### Błąd "Model nie znaleziony"

Ścieżka w `WHISPER_MODEL` nie odpowiada rzeczywistej lokalizacji lub nazwie pliku modelu.

Sprawdź katalog modeli:
```powershell
Get-ChildItem "C:\whisper\models\"
```

Nazwa pliku musi zawierać pełną nazwę z sufiksem kwantyzacji, np. `ggml-large-v3-turbo-q5_0.bin`, a nie `ggml-large-v3-turbo.bin`. Jeśli nie ma zainstalowanych modeli, użyj `download_model` w Claude Desktop.

---

## Akceleracja GPU

### Transkrypcja jest wolna — tylko CPU, bez GPU

Zapytaj Claude: *"Sprawdź sprzęt systemowy"*

Narzędzie `check_system` potwierdza, czy `ggml-vulkan.dll` jest obecny w katalogu binariów whisper. Jeśli DLL brakuje, działasz tylko na CPU niezależnie od GPU.

**Rozwiązanie:** Pobierz `whisper-vulkan-win-x64.zip` ze [strony wydań](https://github.com/eviscerations/whisper-windows-mcp/releases/tag/v1.4.0) i rozpakuj do `C:\whisper\Release\`. Zip zawiera DLL — musi być w tym samym katalogu co `whisper-cli.exe`.

### GPU wykryte, ale wykorzystanie 0% podczas transkrypcji

Binarium działa, ale nie wysyła zadań do GPU. Zazwyczaj oznacza to:
- Vulkan SDK nie jest zainstalowany lub sterownik GPU nie udostępnia interfejsu Vulkan
- GPU jest starszy niż Vulkan 1.0 (rzadkie — większość GPU od 2016 roku to obsługuje)

Sprawdź obsługę Vulkan:
```powershell
vulkaninfo
```

Jakikolwiek wynik potwierdza dostępność Vulkan. Jeśli `vulkaninfo` nie działa, zainstaluj najnowszy sterownik GPU ze strony producenta.

### Transkrypcja działa na niewłaściwym GPU (systemy z wieloma GPU)

Domyślnie whisper-cli używa urządzenia Vulkan 0. Na maszynie z wieloma GPU może to nie być karta, której chcesz. Przypnij konkretne urządzenie zmienną środowiskową `WHISPER_GPU_DEVICE` (lub parametrem `gpu_device` dla pojedynczego wywołania, który teraz działa również w `generate_subtitles`):

```json
"env": { "WHISPER_GPU_DEVICE": "1" }
```

⚠️ **Indeks to kolejność enumeracji Vulkan, a NIE kolejność „GPU 0 / GPU 1" w Windows** — często się różnią. Aby znaleźć właściwy numer, uruchom `whisper-cli.exe` na dowolnym pliku raz i przeczytaj jego log startowy: wypisuje `ggml_vulkan: 0 = <nazwa>`, `ggml_vulkan: 1 = <nazwa>`. Użyj indeksu, który wymienia docelową kartę. `check_config` wyświetla aktywne urządzenie, więc możesz potwierdzić, że przypięcie zadziałało.

### VRAM raportowany jako połowa rzeczywistego rozmiaru (AMD)

Jest to znany nюanс raportowania Windows dla GPU AMD. Rzeczywisty dostępny VRAM do przetwarzania jest zazwyczaj dwukrotnie większy niż to, co raportuje `wmic`. Rekomendacja modelu może być nadmiernie konserwatywna — możesz spróbować większego modelu niż zalecany.

---

## Jakość transkrypcji

### Wyjście zawiera halucynowany tekst lub powtarzające się frazy

Whisper czasem halucynuje na cichych lub niskiej jakości segmentach audio. Narzędzie domyślnie stosuje `--max-context 0` i `--no-speech-thold 0.6`, aby to zminimalizować.

Dodatkowe podejścia:
- Użyj `temperature=0.2` — niewielka losowość pomaga przerwać pętle halucynacji na hałaśliwym audio
- Użyj modelu VAD: pobierz plik `.bin` modelu Silero VAD i przekaż jego ścieżkę jako `vad_model`. Usuwa ciszę przed transkrypcją — najskuteczniejsza naprawa halucynacji na nagraniach z przerwami.
- Użyj większego modelu (`large-v3` lub `large-v3-turbo`) — mniejsze modele halucynują bardziej na trudnym audio
- Użyj `prompt` do ustawienia kontekstu: *"To jest wywiad podcastowy o inżynierii oprogramowania."*

### Wyjście transkrypcji jest puste lub bardzo krótkie

Zapytaj Claude: *"Przeanalizuj ten plik"* (`analyze_media`), aby potwierdzić, że plik ma zawartość audio i jest rozpoznanym formatem.

Jeśli FFprobe raportuje audio, ale transkrypcja nie daje nic:
- Plik może być w języku, który nie odpowiada skonfigurowanemu parametrowi `language`
- Spróbuj `language=auto`, aby Whisper wykrył język
- Audio może być zbyt ciche lub mocno przetworzone — transkrypcja wymaga wyraźnej mowy

---

## Tryb prywatności i brama zgody

### Nie widzę monitu o zgodę przed transkrypcją

Brama zgody uruchamia się **raz na sesję** w trybie standardowym. Jeśli już potwierdziłeś transkrypcję w tej sesji (od ostatniego restartu Claude Desktop), nie uruchomi się ponownie.

Inne powody, dla których brama może się nie pojawić:
- `WHISPER_CONSENT_ACKNOWLEDGED=true` jest ustawione w konfiguracji — całkowicie pomija bramę
- `WHISPER_PRIVACY_MODE=true` jest ustawione — tryb prywatności używa własnej osobnej bramy per operację
- Sprawdzasz postęp blokującej transkrypcji, która już się zakończyła — brama została zużyta na początku zadania

**Aby zresetować i ponownie zobaczyć bramę:** w pełni uruchom ponownie Claude Desktop (wyjdź z zasobnika systemowego, uruchom ponownie).

### Claude przetwarza mój plik bez pytania

Jeśli `WHISPER_CONSENT_ACKNOWLEDGED=true` jest w konfiguracji, brama jest pomijana celowo. Jest to zamierzone zachowanie dla użytkowników, którzy zapoznali się z implikacjami dla prywatności.

Jeśli nie jest ustawione, a Claude kontynuował bez pytania, brama sesji została już zużyta przez wcześniejszą transkrypcję w tej samej sesji. Brama uruchamia się raz na sesję.

### Tryb prywatności jest aktywny, ale chcę przeczytać jedną transkrypcję

Przekaż `privacy_mode=false` bezpośrednio do narzędzia transkrypcji dla tego konkretnego wywołania. Zastępuje globalne ustawienie `WHISPER_PRIVACY_MODE=true` tylko dla tego jednego wywołania:

- *"Transkrybuj ten plik, privacy_mode=false"*

Restart nie jest wymagany. Zastąpienie dotyczy tylko tego jednego wywołania narzędzia.

### Tryb prywatności prosi o potwierdzenie przed każdym plikiem

Jest to prawidłowe i celowe zachowanie. Tryb prywatności wymaga zgody per operację — brama uruchamia się przed każdą transkrypcją i nie może być pominięta gdy tryb prywatności jest aktywny.

### Zadania w tle i brama zgody

Dla transkrypcji w tle (`background=true`) w trybie standardowym brama zgody uruchamia się przy `check_progress`, gdy zwracana jest transkrypcja — **nie** przy `transcribe_audio`, gdy zadanie się uruchamia. W momencie uruchamiania tekst transkrypcji jeszcze nie istnieje. Brama uruchamia się w momencie, gdy tekst transkrypcji byłby po raz pierwszy zwrócony do API.

Dla zadań w tle w trybie prywatności brama uruchamia się **przed uruchomieniem** — przed jakimkolwiek przetwarzaniem audio.

### Jak trwale pominąć bramę zgody?

Ustaw `WHISPER_CONSENT_ACKNOWLEDGED=true` w sekcji env pliku `claude_desktop_config.json`. Pomija to jednorazowe ujawnienie dla sesji w trybie standardowym.

Uwaga: nie ma efektu gdy tryb prywatności jest aktywny.

---

## Transkrypcja w tle i partia

### "Ten plik trwa ~X — uruchom go w tle" / transkrypcja na pierwszym planie przekracza limit czasu

Claude Desktop wymusza limit czasu ~4 minut na każde pojedyncze wywołanie narzędzia MCP. Długi plik transkrybowany w trybie **pierwszego planu** (blokującym) może go przekroczyć — transkrypcja i tak się kończy i jest zapisywana na dysku, ale samo wywołanie narzędzia kończy się błędem. Aby zapobiec temu cichemu niepowodzeniu, `transcribe_audio` i `generate_subtitles` szacują czas wykonania z góry i, jeśli prawdopodobnie przekroczyłby pułap, zwracają komunikat nakazujący ponowne uruchomienie z `background=true`. Tryb w tle natychmiast zwraca identyfikator zadania i nie ma takiego limitu — monitoruj go za pomocą `check_progress`.

Duża część rzeczywistego czasu transkrypcji to **ładowanie modelu**, a nie transkrypcja: whisper-cli ponownie ładuje model przy każdym wywołaniu, a duży model (np. `large-v3`, 2,9 GB) na GPU z ograniczoną pamięcią może ładować się ~2 minuty, zanim transkrypcja w ogóle się zacznie (mniejszy lub skwantyzowany model ładuje się szybciej). Próg strażnika jest konfigurowalny za pomocą `WHISPER_FOREGROUND_MAX_SEC` (sekundy; domyślnie 210).

### Zadanie w tle nigdy nie pokazuje się jako ukończone

Stan zadania jest śledzony przez wyjście procesu whisper-cli.exe. Sprawdź:

1. Zapytaj Claude: *"Sprawdź postęp job_id"* — jeśli proces nadal działa, narzędzie zwraca "W toku" z czasem, który upłynął i ostatnim znacznikiem czasu segmentu
2. Jeśli plik jest bardzo długi (2+ godziny), daj więcej czasu — transkrypcja GPU 2-godzinnego pliku zajmuje około 15–20 minut na średnim GPU
3. Jeśli czas wydaje się nieprawidłowy, otwórz Menedżer zadań → Szczegóły i sprawdź, czy `whisper-cli.exe` jest na liście

### Zadanie w tle ukończone, ale brak pliku wyjściowego lub jest w złym miejscu

Zadania w tle zapisują wyjście do tymczasowej ścieżki w `%TEMP%\whisper-mcp-jobs\` podczas przetwarzania, następnie przenoszą plik do katalogu źródłowego po zakończeniu. Jeśli przeniesienie nie powiedzie się, `check_progress` zwraca konkretny błąd.

Sprawdź:
- Katalog źródłowy istnieje i jest zapisywalny
- Jest wystarczająco dużo miejsca na dysku
- Docelowa ścieżka nie jest zbyt długa (Windows domyślnie ma limit ścieżki 260 znaków)

### Partia utknęła lub nie przechodzi do następnego pliku

`start_batch` używa callbacku wyjścia do samodzielnego przesuwania bez odpytywania. Jeśli partia wydaje się utknięta:

1. Wywołaj `check_batch_progress` — wymusza sprawdzenie postępu i ponownie ocenia bieżący stan
2. Jeśli bieżący plik nadal działa, pozwól mu się zakończyć — sprawdź Menedżer zadań na `whisper-cli.exe`
3. Jeśli `check_batch_progress` pokazuje bieżący plik jako nieudany, spróbuje przejść do następnego pliku

### Partia raportuje plik jako "nieudany", choć wygląda na ukończony

Walidator sprawdza, że plik wyjściowy nie jest pusty i ma co najmniej jeden wiersz na każde 30 sekund audio. Krótkie pliki lub nagrania z długimi cichymi sekcjami mogą dać wyjście, które walidator uważa za podejrzanie krótkie.

Jeśli transkrypcja wygląda poprawnie po otwarciu — uruchom ją ponownie przez `transcribe_audio` indywidualnie i sprawdź wynik ręcznie.

---

## Generowanie napisów

### Plik SRT zapisany, ale z nieprawidłową nazwą lub w złym miejscu

Pliki SRT i VTT są zapisywane obok pliku źródłowego z kodem języka dodanym gdy język źródłowy nie jest angielski:
- Źródło angielskie: `nazwapliku.srt`
- Źródło polskie: `nazwapliku.pl.srt`
- Z tłumaczeniem na angielski: `nazwapliku.pl.srt` + `nazwapliku.en.srt`

### Wyjście VTT dla web — jak wczytać w odtwarzaczu desktopowym?

VLC obsługuje VTT przez Napisy → Dodaj plik napisów → wybierz plik `.vtt`. Większość innych odtwarzaczy desktopowych lepiej obsługuje SRT niż VTT. Użyj `output_format=srt` dla maksymalnej kompatybilności z odtwarzaczami desktopowymi.

VTT najlepiej nadaje się dla elementów HTML5 `<video>` i webowych odtwarzaczy wideo.

### Pliki LRC nie wyświetlają się w odtwarzaczu

Pliki LRC (`.lrc`) są przeznaczone dla odtwarzaczy z funkcjami wyświetlania tekstu/karaoke: foobar2000, Winamp, AIMP i różne odtwarzacze mobilne. Standardowe odtwarzacze wideo nie wyświetlają LRC. Jeśli potrzebujesz zsynchronizowanych napisów do wideo, użyj `srt` lub `vtt`.

### Generowanie napisów przekracza limit czasu z błędem 4 minut

`generate_subtitles` domyślnie działa synchronicznie i może osiągnąć 4-minutowy limit czasu MCP Claude Desktop na długich plikach. Użyj `background=true` dla plików dłuższych niż 10 minut:

- *"Wygeneruj napisy do tego pliku, background=true"*

Następnie sprawdzaj postęp przez `check_progress`. Uwaga: `translate_to_english=true` nie jest dostępne w trybie tle. Uruchom drugi przebieg po zakończeniu zadania w tle, aby wygenerować tłumaczenie.

---

## Zarządzanie modelami

### `download_model` kończy się błędem sieci

Narzędzie pobiera z Hugging Face. Upewnij się, że komputer ma dostęp do internetu i `huggingface.co` nie jest zablokowane przez zaporę lub proxy.

Jeśli pobieranie zaczyna się, ale nie kończy, plik `.part` jest usuwany automatycznie. Uruchom ponownie `download_model`, aby spróbować ponownie.

### `switch_model` mówi, że model nie jest w katalogu modeli

Narzędzie `switch_model` akceptuje tylko pliki w katalogu skonfigurowanym w `WHISPER_MODEL` (konkretnie katalog zawierający ten plik).

Jeśli model jest w innej lokalizacji, albo przenieś go do katalogu modeli, albo zaktualizuj `WHISPER_MODEL` w konfiguracji, aby wskazywał na plik w tym samym katalogu co twoje modele.

### Aktywny model wraca do modelu z konfiguracji po restarcie Claude Desktop

`switch_model` jest zasięgiem sesji z projektu. Aby uczynić przełączenie modelu trwałym, zaktualizuj `WHISPER_MODEL` w `claude_desktop_config.json` i uruchom ponownie Claude Desktop.

---

## Ścieżki plików i formaty

### Nazwy plików Unicode powodują ciche niepowodzenia transkrypcji

Transkrypcja w tle kieruje całe wyjście przez oczyszczoną ścieżkę tymczasową opartą na ID zadania w ASCII, która poprawnie obsługuje nazwy plików Unicode. Jeśli widzisz niepowodzenie z nazwą pliku Unicode w trybie blokującym, sprawdź, czy plik jest dostępny:

```powershell
Test-Path "C:\Users\NazwaUżytkownika\Documents\nagranie_po_polsku.mp4"
```

Powinno zwrócić `True`. Jeśli ścieżka jest niedostępna dla PowerShell, będzie też niedostępna dla serwera MCP.

### Plik wideo nie daje wyjścia lub natychmiastowy błąd

FFmpeg jest wymagany dla wszystkich formatów wideo. Sprawdź, czy FFmpeg jest zainstalowany:
```
ffmpeg -version
```

Jeśli FFmpeg nie jest w PATH, ustaw `FFMPEG_PATH` w konfiguracji na pełną ścieżkę do `ffmpeg.exe`.

Jeśli FFmpeg jest zainstalowany, ale konkretne wideo nie działa, może to być uszkodzony plik lub nietypowy wariant kodeka. Spróbuj ręcznie przekonwertować:
```
ffmpeg -i input.mp4 -ar 16000 -ac 1 output.wav
```
Następnie transkrybuj plik WAV bezpośrednio.

### Błąd "Plik zbyt duży"

Narzędzie odrzuca pliki powyżej 10 GB. Jest to limit bezpieczeństwa zapobiegający nadmiernemu zużyciu pamięci. Pliki zbliżające się do tego rozmiaru powinny być podzielone przed transkrypcją.

### Odrzucenie ścieżki UNC

Ścieżki zaczynające się od `\\server\share` (ścieżki UNC do udziałów sieciowych) są odrzucane przez walidator wejść. Zamontuj udział sieciowy jako literę dysku (np. `Z:\`) i użyj tej ścieżki.

---

## Czyszczenie plików tymczasowych

Pliki stanu zadań (`.json` i `.log`) w `%TEMP%\whisper-mcp-jobs\` są automatycznie czyszczone przy uruchomieniu dla plików starszych niż 7 dni. Ręczne czyszczenie jest nadal możliwe w razie potrzeby:

```powershell
Remove-Item "$env:TEMP\whisper-mcp-jobs\*" -Force
```

Tymczasowe pliki WAV konwersji (`whisper_tmp_*.wav` w `%TEMP%`) są usuwane natychmiast po każdej transkrypcji. Jeśli transkrypcja ulegnie awarii w trakcie, mogą pozostać. Usuń je ręcznie:

```powershell
Remove-Item "$env:TEMP\whisper_tmp_*.wav" -Force
```

---

## Duża nienadzorowana partia z wiersza poleceń

Dla bardzo dużych partii bez Claude użyj PowerShell bezpośrednio.

**Ważne:** whisper-cli.exe nie może bezpośrednio odczytywać MP4, MKV ani większości formatów wideo. FFmpeg musi wcześniej przekonwertować każdy plik do WAV. Whisper zapisuje transkrypcję do stdout, a diagnostykę do stderr — użyj `Start-Process -RedirectStandardOutput` do poprawnego przechwycenia.

```powershell
$whisper = "C:\whisper\Release\whisper-cli.exe"
$model   = "C:\whisper\models\ggml-medium.en.bin"
$dir     = "C:\ścieżka\do\twojego\folderu"
$ffmpeg  = "ffmpeg"
$tmp     = "$env:TEMP\whisper_convert.wav"

Get-ChildItem "$dir\*.mp4" | ForEach-Object {
    $out = ($_.FullName -replace '\.mp4$', '') + ".txt"
    if (Test-Path $out) {
        Write-Host "POMIŃ (istnieje): $($_.Name)"
        return
    }
    Write-Host "Konwertowanie:    $($_.Name)"
    & $ffmpeg -y -i $_.FullName -ar 16000 -ac 1 -c:a pcm_s16le $tmp 2>$null
    Write-Host "Transkrypcja:  $($_.Name)"
    $wArgs = "-m `"$model`" -f `"$tmp`" --threads 8 --max-context 0 --no-speech-thold 0.6"
    Start-Process -FilePath $whisper -ArgumentList $wArgs -RedirectStandardOutput $out -Wait -NoNewWindow
    Write-Host "Gotowe:          $($_.BaseName).txt"
}

Remove-Item $tmp -ErrorAction SilentlyContinue
Write-Host "Wszystko gotowe."
```

Zmień `*.mp4` na `*.mkv`, `*.m4a` itp., aby dopasować do typów plików. Sprawdzenie pominięcia `Test-Path` oznacza, że ponowne uruchomienie skryptu po przerwaniu nie będzie ponownie przetwarzać już ukończonych plików.

---

## Lokalizacja pliku konfiguracyjnego

```
C:\Users\NazwaUżytkownika\AppData\Roaming\Claude\claude_desktop_config.json
```

Jeśli `AppData` nie jest widoczne: Widok → Pokaż → Ukryte elementy w Eksploratorze plików.

---

## Pełny przykład działającej konfiguracji

```json
{
  "mcpServers": {
    "whisper": {
      "command": "npx",
      "args": ["-y", "whisper-windows-mcp"],
      "env": {
        "WHISPER_CLI_PATH": "C:\\whisper\\Release\\whisper-cli.exe",
        "WHISPER_MODEL": "C:\\whisper\\models\\ggml-medium.en.bin",
        "FFMPEG_PATH": "ffmpeg"
      }
    }
  }
}
```

`FFMPEG_PATH` domyślnie przyjmuje wartość `ffmpeg` (zakłada obecność w PATH). Ustaw jawnie tylko jeśli FFmpeg jest zainstalowany w niestandardowej lokalizacji.
