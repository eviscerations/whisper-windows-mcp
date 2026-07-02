# Polityka bezpieczeństwa

## Zakres

whisper-windows-mcp jest narzędziem priorytetyzującym lokalność. Całe przetwarzanie audio odbywa się na twoim komputerze — żadne audio, pliki wideo ani dane osobowe nie są przesyłane na żaden serwer. Powierzchnia ataku jest ograniczona do:

- Lokalnego systemu plików (ścieżki plików przekazywane do narzędzi)
- Binarnego pliku whisper-cli.exe i jego zależności
- Połączenia MCP Claude Desktop (tylko lokalny IPC)
- Tekstu transkrypcji zwracanego w odpowiedziach narzędzi (patrz Architektura prywatności poniżej)

## Architektura prywatności

**Pliki audio nigdy nie opuszczają twojego komputera.** Ta gwarancja jest bezwarunkowa.

**Tekst transkrypcji może opuścić twój komputer** w trybie standardowym. Gdy odpowiedź narzędzia zawiera tekst transkrypcji, tekst ten jest przetwarzany przez API Claude. Jest to standardowe zachowanie MCP, ale tworzy lukę między filozofią projektowania "priorytet lokalny" narzędzia a rzeczywistym przepływem danych dla użytkowników obsługujących treści regulowane lub poufne.

**Tryb prywatności** (`WHISPER_PRIVACY_MODE=true` lub `privacy_mode=true` dla pojedynczego wywołania) ogranicza wszystkie odpowiedzi narzędzi tylko do metadanych — żaden tekst transkrypcji nie jest zwracany do API Claude. Jest to właściwa konfiguracja dla wdrożeń medycznych, prawnych, finansowych i korporacyjnych.

**Brama trybu prywatności:** gdy tryb prywatności jest aktywny, przed każdą operacją transkrypcji wyświetlane jest wyraźne potwierdzenie ujawnienia, kluczowane per operacja (narzędzie + argumenty). Serwer wymusza *blokadę* — wstrzymuje operację i zwraca ujawnienie przy pierwszym napotkaniu danej operacji. **Nie** wymusza tego, że odpowiedział człowiek: brama zwalnia się, gdy identyczne wywołanie zostanie ponowione, przy założeniu, że host wyświetlił ujawnienie, a użytkownik odpowiedział „tak". Klient, który ponawia to samo wywołanie bez udziału człowieka, może sam spełnić warunek bramy. Traktuj to jako proceduralną kontrolę świadomej zgody, która zależy od uhonorowania ujawnienia przez hosta MCP, a nie jako barierę kryptograficzną.

**Brama zgody:** w trybie standardowym jednorazowe ujawnienie dla sesji jest wyświetlane przed pierwszym zwróceniem tekstu transkrypcji do API. Ustaw `WHISPER_CONSENT_ACKNOWLEDGED=true` w konfiguracji, aby pominąć to dla treści niepoufnych. Zauważ, że jest to brama *raz na sesję*: po pierwszej potwierdzonej transkrypcji kolejne transkrypcje w tej samej sesji są zwracane bez ponownego pytania. Dla treści, która nigdy nie może trafić do API, użyj trybu prywatności niezależnie od stanu sesji.

Zobacz [PRIVACY.md](PRIVACY.md) dla pełnego opisu architektury prywatności, wskazówek dotyczących ram zgodności (HIPAA, RODO, tajemnica adwokacka, FERPA, SOX, PCI-DSS) i instrukcji konfiguracji.

## Weryfikacja binarną

Aby zweryfikować integralność binarium `whisper-cli.exe` w gotowym wydaniu, sprawdź jego skrót SHA256 w PowerShell:

```powershell
Get-FileHash "C:\whisper\Release\whisper-cli.exe" -Algorithm SHA256
```

Oczekiwany skrót dla każdego binarnego wydania jest opublikowany na [stronie wydań](https://github.com/eviscerations/whisper-windows-mcp/releases). Nie używaj binarnego pliku, którego skrót nie odpowiada oczekiwanemu.

## Obsługiwane wersje

Poprawki bezpieczeństwa są stosowane tylko do najnowszej opublikowanej wersji.

| Wersja | Obsługiwana |
|---|---|
| 2.x (najnowsza) | ✅ |
| 1.x | ❌ |

## Zgłaszanie podatności

**Nie otwieraj publicznych zgłoszeń dla podatności bezpieczeństwa.**

Użyj prywatnego raportowania podatności GitHub:
1. Przejdź do [zakładki Security](https://github.com/eviscerations/whisper-windows-mcp/security)
2. Kliknij "Report a vulnerability"
3. Opisz problem z wystarczającymi szczegółami do odtworzenia

Otrzymasz odpowiedź w ciągu 7 dni. Jeśli podatność zostanie potwierdzona, poprawka zostanie wydana tak szybko, jak to możliwe, a ty zostaniesz wymieniony w notatkach wydania, jeśli sobie życzysz.

## Piaskownica i zatwierdzenia

whisper-windows-mcp to **lokalne, jednoużytkownikowe narzędzie sterowane przez właściciela komputera za pośrednictwem Claude Desktop.** Jego model zagrożeń to właściciel uruchamiający je na własnym komputerze — nie niezaufane, wielodostępne ani wystawione na sieć wdrożenie.

- **Piaskownica:** brak, z założenia. `whisper-cli.exe` działa na poziomie uprawnień samego właściciela, tak samo jak każdy lokalny serwer MCP. Izolacja na poziomie systemu operacyjnego nie jest tu środkiem zaradczym; jest nim zakres użycia — **nie wystawiaj tego serwera na niezaufany dostęp sieciowy** (zobacz „Iniekcja ścieżki pliku" poniżej).
- **Zatwierdzenia są warstwowe, a nie oparte na piaskownicy:**
  1. **Zatwierdzenie hosta** — warstwa MCP Claude Desktop kontroluje wywoływanie narzędzi.
  2. **Bramki zgody / prywatności** — wymagane jest jawne potwierdzenie, zanim jakikolwiek tekst transkrypcji opuści komputer w kierunku API Claude; `WHISPER_PRIVACY_MODE` / `privacy_mode` dla pojedynczego wywołania zwraca tylko metadane dla treści regulowanych. Bramka jest kluczowana per operacja (narzędzie + argumenty). Zobacz [PRIVACY.md](PRIVACY.md).
  3. **Walidacja danych wejściowych** — stosowana obronnie w każdym narzędziu, które przyjmuje ścieżkę lub identyfikator:
     - Ścieżki z przejściem katalogu (`..`) i UNC (`\\server\share`) są odrzucane dla **wszystkich** danych wejściowych plików/folderów, w tym `analyze_media` i `transcribe_batch` (te dwa ostatnie wcześniej sprawdzały tylko istnienie — niezweryfikowana ścieżka UNC mogła wywołać wychodzące połączenie SMB do hosta atakującego).
     - `job_id` / `batch_id` są dopasowywane do dokładnego formatu wygenerowanego przez serwer, zanim zostaną użyte do zbudowania jakiejkolwiek ścieżki w systemie plików, więc spreparowany identyfikator nie może wyjść poza katalog zadań do dowolnego odczytu/zapisu/usunięcia pliku.
     - `switch_model` **oraz** zastąpienie `model` w `transcribe_audio` są oba ograniczone do skonfigurowanego katalogu modeli przez znormalizowane sprawdzanie zawierania ścieżki — zastąpienie nie może zostać użyte do podania dowolnego pliku do `whisper-cli` jako jego modelu.
     - Ścieżki `vad_model` odrzucają przejście katalogu/UNC.
     - `download_model` jest ograniczone do listy dozwolonych zaufanych przestrzeni nazw Hugging Face (początkowy URL i każde przekierowanie).
     - Binaria systemowe Windows wywoływane niejawnie przez serwer (`tasklist`, `wmic`) są uruchamiane po bezwzględnej ścieżce `System32`, więc nie mogą zostać przesłonięte przez plik wykonywalny o tej samej nazwie umieszczony wcześniej na `PATH`.

**Uwaga o granicy „niezaufanego agenta".** To narzędzie jest zaprojektowane dla pojedynczego właściciela sterującego nim za pośrednictwem Claude Desktop, a nie jako współdzielona lub wystawiona na sieć infrastruktura. Jednak transkrybowana treść audio/wideo sama w sobie jest niezaufanym wejściem, które może *przypominać instrukcje* i wpływać na to, które narzędzia zostaną wywołane dalej i z jakimi argumentami (zobacz „Iniekcja transkrypcji" poniżej). Z tego powodu powyższa walidacja danych wejściowych jest stosowana obronnie, zamiast polegać wyłącznie na założeniu pojedynczego użytkownika. W pełni niezaufana postawa agenta lub wielodostępna nadal wymagałaby piaskownicy systemu operacyjnego/kontenera oraz polityki ruchu wychodzącego — poza zakresem lokalnego, jednoużytkownikowego narzędzia do transkrypcji.

## Znane decyzje projektowe

- **Iniekcja ścieżki pliku:** Narzędzia akceptują bezwzględne ścieżki plików od Claude. Jest to celowy projekt — narzędzie jest przeznaczone do użytku z Claude Desktop przez właściciela komputera. Ścieżki z przejściem katalogu (`..`) i UNC są odrzucane we wszystkich narzędziach przyjmujących ścieżki; bezwzględne ścieżki lokalne są poza tym akceptowane. Nie wystawiaj tego serwera MCP na niezaufany dostęp sieciowy.
- **Walidacja identyfikatorów zadań/wsadów:** `job_id` i `batch_id` muszą pasować do dokładnego kształtu wygenerowanego przez serwer (`job_<epochMs>_<8 hex>` / `batch_<epochMs>_<8 hex>`), zanim zostaną użyte do zbudowania jakiejkolwiek ścieżki w systemie plików. Zapobiega to wyjściu spreparowanego identyfikatora poza katalog zadań do dowolnego odczytu, zapisu lub usunięcia pliku poprzez obsługę zakończenia zadania.
- **Bramki zgody/prywatności są proceduralne:** Bramki zależą od wyświetlenia ujawnienia przez hosta MCP i odpowiedzi człowieka przed ponowieniem operacji. Serwer wymusza zachowanie blokowania-do-ponowienia, ale nie może zweryfikować, że odpowiedział człowiek. Dla treści, która nigdy nie może trafić do API, polegaj na trybie prywatności (odpowiedzi tylko z metadanymi), a nie na samej bramce.
- **Brak piaskownicy:** whisper-cli.exe działa z tymi samymi uprawnieniami co Claude Desktop. Jest to standardowe dla lokalnych narzędzi MCP.
- **Pliki tymczasowe:** Pośrednie pliki WAV są zapisywane w `%TEMP%\whisper_tmp_*.wav` i usuwane po transkrypcji. Pliki stanu zadań są zapisywane w `%TEMP%\whisper-mcp-jobs\` i automatycznie czyszczone po 7 dniach przy uruchomieniu serwera.
- **Treść transkrypcji:** Tekst transkrypcji zwracany w odpowiedziach narzędzi jest przetwarzany przez API Claude w trybie standardowym. Włącz `WHISPER_PRIVACY_MODE=true` lub przekaż `privacy_mode=true` dla pojedynczego wywołania, aby temu zapobiec. Zobacz [PRIVACY.md](PRIVACY.md).
- **Iniekcja transkrypcji:** Pliki audio mogą zawierać wypowiadaną treść, która po transkrypcji przypomina instrukcje. Wbudowane mechanizmy obronne Claude obsługują to. Sam serwer MCP oznacza całą treść transkrypcji jako niezaufane dane i nigdy nie interpretuje jej jako instrukcji.
- **Pobieranie modeli:** Narzędzie `download_model` pobiera tylko z dwóch zaufanych przestrzeni nazw Hugging Face (`ggerganov/whisper.cpp` i `ggml-org`). Przekierowania są weryfikowane względem listy dozwolonych przed wykonaniem. Dowolne URL są odrzucane na poziomie kodu. Obcięte/niekompletne pobrania są odrzucane (sprawdzenie Content-Length), zanim plik `.part` zostanie awansowany do nazwy modelu. **Do zrobienia:** pobrania nie są jeszcze weryfikowane względem skrótu SHA256 per model, więc skompromitowany upstream lub atakujący na ścieżce mógłby nadal podać złośliwy `.bin`. Przypięte skróty są planowane; weryfikuj skróty ręcznie względem strony wydań dla wdrożeń o wysokim poziomie zaufania.
- **Ograniczenie wyboru modelu:** Zarówno `switch_model`, jak i zastąpienie `model` w `transcribe_audio` akceptują tylko pliki `.bin` w skonfigurowanym katalogu modeli. Ścieżki poza nim są odrzucane poprzez znormalizowane ograniczenie ścieżek — katalog z prefiksem-rodzeństwem taki jak `…\models-evil` nie może spełnić sprawdzenia — niezależnie od sposobu podania ścieżki. Ścieżki `vad_model` odrzucają przejście katalogu/UNC.
- **Niejawne binaria systemowe:** `tasklist` i `wmic` są wywoływane po bezwzględnej ścieżce `System32`, a nie po samej nazwie, więc nie mogą zostać przesłonięte przez plik wykonywalny o tej samej nazwie umieszczony wcześniej na `PATH`.
- **Trwały serwer modelu:** opcjonalne narzędzie `whisper_server` uruchamia `whisper-server` z whisper.cpp jako proces rezydentny. Jest powiązany tylko z `127.0.0.1` — nigdy z routowalnym interfejsem — więc nie jest osiągalny spoza komputera. Jest uruchamiany i zatrzymywany jawnie (nigdy nie auto-uruchamiany), a posiadany proces jest zabijany przy zamknięciu. Ponieważ serwer rezydentny i jednorazowy `whisper-cli` rywalizowałyby o ten sam GPU/VRAM, oba wykluczają się wzajemnie: twarde zabezpieczenie w ścieżce odłączonego uruchamiania zapobiega uruchomieniu jakiegokolwiek zadania CLI, gdy serwer działa, a narzędzia transkrypcji odrzucają operacje, które wymagałyby CLI, dopóki serwer nie zostanie zatrzymany. `WHISPER_SERVER_PORT` wybiera port localhost; host nie jest konfigurowalny z założenia.
