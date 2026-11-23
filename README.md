# AutoCV-Robot

> Robot RPA UiPath untuk **AutoCV** — mengekstrak profil LinkedIn dan repositori GitHub,
> menyintesis CV ATS-friendly dengan AI, merender DOCX/PDF, lalu mengirim email.

Proyek ini adalah sisi otomasi dari ekosistem AutoCV. Portal web (`../AutoCV-Web`) memicu robot
lewat UiPath Orchestrator dan menerima hasil melalui webhook.

---

## 1. Teknologi

| Komponen | Versi / Keterangan |
|---|---|
| UiPath Studio | 26.10 (`studioVersion: 26.10.0.0`) |
| Target framework | Windows (`net10.0`), ekspresi Visual Basic |
| Entry point | `Main.xaml` |
| Activities | System 26.10, Mail 2.12, Excel 3.6, Testing 25.10, UIAutomation 26.10, WebAPI 2.5 |
| AI | Gemini `gemini-3.5-flash-lite` (primary) → OpenRouter `openai/gpt-4o-mini` (fallback) |
| Helper | Node.js (scrape/DOCX/PDF) + PowerShell runner |

---

## 2. Kebutuhan

- Windows 10/11 64-bit.
- UiPath Studio 26.10 dan CLI `uip`.
- Node.js ≥ 20 di `PATH` (dipakai `Data/Scripts/*.js`).
- Ekstensi UiPath Web Automation untuk Chrome/Edge.
- Sesi LinkedIn yang sudah login (mode live).
- API key AI dan kredensial SMTP (lokal, tidak di-commit).

---

## 3. Konfigurasi

Robot membaca konfigurasi dari dua sumber (prioritas: `ai_settings.json` → `.env` → key file lama):

1. `Data/Config/ai_settings.json` — salin dari template:
   ```powershell
   Copy-Item "Data\Config\ai_settings.example.json" "Data\Config\ai_settings.json"
   ```
2. `.env` di root proyek — salin dari template:
   ```powershell
   Copy-Item ".env.example" ".env"
   ```

Isi nilai asli secara lokal. **Jangan commit** `.env` atau `ai_settings.json`.

```env
AI_PROVIDER=Gemini
AI_FALLBACK_PROVIDER=OpenAI

OPENAI_API_KEY=<openrouter-api-key>
OPENAI_BASE_URL=https://openrouter.ai/api/v1
OPENAI_CHAT_MODEL=openai/gpt-4o-mini

GEMINI_API_KEY=<gemini-api-key>
GEMINI_CHAT_MODEL=gemini-3.5-flash-lite
```

Jika provider utama gagal (mis. HTTP 429/503), modul `03_AI_SynthesizePortfolio` otomatis
mencoba provider fallback sebelum memakai mock.

---

## 4. Cara Menjalankan

### 4.1 UiPath Studio

1. Buka folder ini (`AutoCV-Robot`) di UiPath Studio.
2. Jalankan `Main.xaml`.
3. Isi argumen input (semua opsional; ada nilai default):

| Argumen | Tipe | Keterangan |
|---|---|---|
| `in_JobId` | String | ID job dari web |
| `in_LinkedInUrl` | String | URL profil LinkedIn |
| `in_GitHubUrl` | String | URL profil atau username GitHub |
| `in_TargetJobRole` | String | Role target untuk tailoring CV |
| `in_RecipientEmail` | String | Email penerima PDF |
| `in_ApprovedResumePayload` | String | Diisi ⇒ mode Job 2 (render + kirim) |
| `in_WebhookBaseUrl` | String | Base URL web untuk callback |
| `in_UseMockFallback` | Boolean | Pakai fixture mock bila scraping gagal |
| `in_RequireManualApproval` | Boolean | `False` ⇒ lanjut otomatis ke Job 2 |

Output: `out_JobStatus`, `out_DraftResumePayload`, `out_OutputPdfPath`.

### 4.2 CLI

```powershell
uip login
uip rpa validate --file-path "Main.xaml" --project-dir "."
uip rpa build "."
uip rpa pack "." "../_AutoCV-Pack-Out" --package-version <x.y.z>
uip rpa publish "../_AutoCV-Pack-Out/AutoCV.Deployment.<x.y.z>.nupkg"
```

### 4.3 Mode mock

Jalankan dengan `in_UseMockFallback=True` untuk memakai data dari `Data/Mocks/`
(`LinkedInMock.json`, `mock_github_repos.json`, `CuratedResumeMock.json`) tanpa browser/API.

---

## 5. Contoh Input & Output

### 5.1 Input — argumen `Main.xaml`

```json
{
  "in_JobId": "9f6c1f0e-0000-4a00-8000-000000000000",
  "in_LinkedInUrl": "https://www.linkedin.com/in/jane-doe",
  "in_GitHubUrl": "https://github.com/janedoe",
  "in_TargetJobRole": "Fullstack Software Engineer",
  "in_RecipientEmail": "jane.doe@example.com",
  "in_ApprovedResumePayload": "",
  "in_WebhookBaseUrl": "http://localhost:3000",
  "in_UseMockFallback": false,
  "in_RequireManualApproval": true
}
```

- `in_ApprovedResumePayload` kosong ⇒ mode **Job 1** (scrape → sintesis → kirim draf).
- `in_ApprovedResumePayload` terisi ⇒ mode **Job 2** (render dokumen → email → callback).

### 5.2 Output — `out_DraftResumePayload` (dipotong, data fiktif)

```json
{
  "profile": {
    "fullName": "Jane Doe",
    "headline": "Fullstack Software Engineer",
    "email": "jane.doe@example.com",
    "summary": "Software engineer focused on scalable web applications...",
    "linkedinUrl": "https://www.linkedin.com/in/jane-doe",
    "githubUrl": "https://github.com/janedoe"
  },
  "projects": [
    {
      "id": 1,
      "name": "inventory-service",
      "repoUrl": "https://github.com/janedoe/inventory-service",
      "techStack": ["TypeScript", "Node.js", "PostgreSQL"],
      "starSummary": "Reduced checkout latency by 35%...",
      "isSelected": true
    }
  ],
  "experiences": [],
  "skills": [],
  "education": []
}
```

### 5.3 Output — file & status

| Output | Nilai / Lokasi |
|---|---|
| `out_JobStatus` | `PENDING → SCRAPING → SYNTHESIZING → CURATING → COMPLETED` |
| `out_OutputPdfPath` | Path PDF hasil render |
| PDF | `Data/Outputs/CV_<Nama>_<timestamp>.pdf` |
| DOCX | `Data/Outputs/CV_<Nama>_<timestamp>.docx` |
| Email | Terkirim ke `in_RecipientEmail`, atau log `Mode: SIMULATION` |
| Log job | UiPath Orchestrator |

---

## 6. Modul

| File | Fungsi |
|---|---|
| `Modules/00_ValidateAndNormalizeInputs.xaml` | Validasi URL/email/role |
| `Modules/01_LinkedIn_ScrapeProfile.xaml` | Scrape profil LinkedIn via browser |
| `Modules/02_GitHub_FetchUserRepos.xaml` | Ambil repositori non-fork via GitHub API |
| `Modules/03_AI_SynthesizePortfolio.xaml` | Sintesis CV (Gemini → OpenRouter → mock) |
| `Modules/04_Document_GeneratePdf.xaml` | Render DOCX/PDF ATS |
| `Modules/05_Notification_SendMail.xaml` | Kirim email (live/simulasi) |
| `Modules/06_Webhook_NotifyWeb.xaml` | Callback status ke web |

---

## 7. Keamanan

- `.env`, `Data/Config/.env`, `Data/Config/ai_settings.json`, dan
  `Data/Config/gemini_api_key.txt` diabaikan oleh git.
- Gunakan `ai_settings.example.json` dan `.env.example` sebagai template.
- Di produksi, simpan kredensial di **Orchestrator Assets** berjenis Credential.

Dokumentasi lengkap robot ada pada bundel submission: `Automation-CV/Docs/AutoCV-Robot/`.
Ringkasan seluruh proyek (web + robot): `Automation-CV/README.md`.
