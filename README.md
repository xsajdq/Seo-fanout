# SEO Fanout Analyzer

Aplikacja do analizy SEO pojedynczych podstron oraz audytu całych domen. Obsługuje: techniczne SEO, E-E-A-T, GEO/AEO (optymalizacja pod AI Overviews), query fan-out, encje (Hugging Face) i live-crawl przez sitemapę.

## Instalacja na Linuxie

### 1. Zainstaluj Node.js 20+

**Ubuntu / Debian:**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Fedora / RHEL / CentOS:**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo dnf install -y nodejs
```

**Arch Linux:**
```bash
sudo pacman -S nodejs npm
```

Sprawdź wersję:
```bash
node --version   # powinno być >= 20
npm --version
```

### 2. Pobierz repozytorium

```bash
git clone https://github.com/xsajdq/seo-fanout.git
cd seo-fanout
```

Przełącz na branch deweloperski (jeśli potrzebny):
```bash
git checkout claude/seo-analysis-app-kq6101
```

### 3. Zainstaluj zależności

```bash
npm install
```

### 4. Uruchom aplikację

**Tryb deweloperski (z hot-reload):**
```bash
npm run dev
```

**Tryb produkcyjny:**
```bash
npm run build
npm start
```

Otwórz przeglądarkę: `http://localhost:3000`

---

## Konfiguracja Hugging Face (opcjonalna)

Token HF zwiększa limity API i poprawia jakość analizy encji/tematów.

1. Utwórz konto na [huggingface.co](https://huggingface.co)
2. Wejdź w **Settings → Access Tokens → New token** (typ: Read)
3. Skopiuj token (`hf_...`)
4. W aplikacji kliknij „Ustawienia zaawansowane" i wklej token

Token nie jest wymagany — bez niego NLP działa w trybie ograniczonym (lub jest pomijane).

---

## Funkcje

| Moduł | Opis |
|-------|------|
| **Analiza strony** (`/analyze`) | Meta tagi, nagłówki, słowa kluczowe, linki, schema.org |
| **E-E-A-T** | Autor, daty, linki zaufania, NAP, luki w schema |
| **GEO / AEO** | Format Q→A, bezpośrednie odpowiedzi dla AI Overviews |
| **Content Depth** | Nagłówki-pytania, listy, tabele, FAQ, multimedia |
| **Page Experience** | Viewport, WebP/AVIF, lazy loading, blokujące skrypty |
| **Query Fan-out** | 37 szablonów zapytań × 4 intencje, pokrycie fraz |
| **Encje i tematy** | NER i klasyfikacja zero-shot via Hugging Face |
| **Audyt domeny** (`/domain`) | Crawl przez sitemapę, live-progress SSE, CSV export |

## Wymagania systemowe

- Node.js 20+
- 512 MB RAM minimum
- Dostęp do internetu (crawlowanie URL-i i opcjonalnie HF API)
