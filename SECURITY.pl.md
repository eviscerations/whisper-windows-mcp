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

**Brama trybu prywatności:** gdy tryb prywatności jest aktywny, przed każdą operacją transkrypcji wyświetlane jest wyraźne potwierdzenie ujawnienia. Jest to celowe i nie może być pominięte — zgodność z przepisami wymaga świadomej zgody przed każdą operacją.

**Brama zgody:** w trybie standardowym jednorazowe ujawnienie dla sesji jest wyświetlane przed pierwszym zwróceniem tekstu transkrypcji do API. Ustaw `WHISPER_CONSENT_ACKNOWLEDGED=true` w konfiguracji, aby pominąć to dla treści niepoufnych.

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
  3. **Walidacja danych wejściowych** — ścieżki z przejściem katalogu i UNC są odrzucane; `switch_model` jest ograniczone do skonfigurowanego katalogu modeli; `download_model` jest ograniczone do listy dozwolonych zaufanych przestrzeni nazw Hugging Face.

To narzędzie **nie** jest zaprojektowane do sterowania przez niezaufanego agenta ani do uruchamiania jako współdzielona infrastruktura. Taka postawa wymagałaby piaskownicy systemu operacyjnego/kontenera oraz polityki ruchu wychodzącego — poza zakresem lokalnego, jednoużytkownikowego narzędzia do transkrypcji.

## Znane decyzje projektowe

- **Iniekcja ścieżki pliku:** Narzędzia akceptują bezwzględne ścieżki plików od Claude. Jest to celowy projekt — narzędzie jest przeznaczone do użytku z Claude Desktop przez właściciela komputera. Nie wystawiaj tego serwera MCP na niezaufany dostęp sieciowy.
- **Brak piaskownicy:** whisper-cli.exe działa z tymi samymi uprawnieniami co Claude Desktop. Jest to standardowe dla lokalnych narzędzi MCP.
- **Pliki tymczasowe:** Pośrednie pliki WAV są zapisywane w `%TEMP%\whisper_tmp_*.wav` i usuwane po transkrypcji. Pliki stanu zadań są zapisywane w `%TEMP%\whisper-mcp-jobs\` i automatycznie czyszczone po 7 dniach przy uruchomieniu serwera.
- **Treść transkrypcji:** Tekst transkrypcji zwracany w odpowiedziach narzędzi jest przetwarzany przez API Claude w trybie standardowym. Włącz `WHISPER_PRIVACY_MODE=true` lub przekaż `privacy_mode=true` dla pojedynczego wywołania, aby temu zapobiec. Zobacz [PRIVACY.md](PRIVACY.md).
- **Iniekcja transkrypcji:** Pliki audio mogą zawierać wypowiadaną treść, która po transkrypcji przypomina instrukcje. Wbudowane mechanizmy obronne Claude obsługują to. Sam serwer MCP oznacza całą treść transkrypcji jako niezaufane dane i nigdy nie interpretuje jej jako instrukcji.
- **Pobieranie modeli:** Narzędzie `download_model` pobiera tylko z dwóch zaufanych przestrzeni nazw Hugging Face (`ggerganov/whisper.cpp` i `ggml-org`). Przekierowania są weryfikowane względem listy dozwolonych przed wykonaniem. Dowolne URL są odrzucane na poziomie kodu. Obcięte/niekompletne pobrania są odrzucane (sprawdzenie Content-Length), zanim plik `.part` zostanie awansowany do nazwy modelu.
- **Przełączanie modeli:** `switch_model` akceptuje tylko pliki `.bin` w skonfigurowanym katalogu modeli. Ścieżki poza nim są odrzucane poprzez znormalizowane ograniczenie ścieżek — katalog z prefiksem-rodzeństwem taki jak `…\models-evil` nie może spełnić sprawdzenia — niezależnie od sposobu podania ścieżki.
