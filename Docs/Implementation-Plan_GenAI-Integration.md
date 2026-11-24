# Implementation Plan: Integrasi UiPath GenAI ke AutoCV

**Tanggal:** 2026-11-20
**Project:** AutoCV
**Modul Target:** `Modules\03_AI_SynthesizePortfolio.xaml`
**Status Saat Ini:** Mock synthesis (string concatenation tanpa AI)

---

## 1. Ringkasan

Mengganti mock synthesis di modul `03_AI_SynthesizePortfolio.xaml` dengan integrasi AI
sesungguhnya menggunakan **HTTP Request ke Google Gemini API** melalui paket
`UiPath.WebAPI.Activities` (`NetHttpRequest`).

### Mengapa HTTP Request ke Gemini, bukan UiPath GenAI Activities?

| Opsi | Status | Keterangan |
|------|--------|------------|
| **UiPath GenAI Activities** (`UiPath.GenAI.Activities`) | ❌ Tidak tersedia | Paket ini belum terinstal, belum ada di `.local/docs`, dan **memerlukan konfigurasi LLM Gateway di tenant UiPath Cloud** (BYO LLM). Lisensi Studio saat ini juga terbatas. |
| **HTTP Request ke Gemini API** | ✅ Tersedia & mandiri | Menggunakan `NetHttpRequest` dari `UiPath.WebAPI.Activities`. Tidak memerlukan konfigurasi tenant. API key Gemini gratis tersedia. |

**Keputusan:** Gunakan **HTTP Request ke Google Gemini API** (`gemini-2.0-flash`) sebagai
pendekatan yang langsung bisa diimplementasi dan dites tanpa hambatan lisensi.

---

## 2. Arsitektur Perubahan

### 2.1 Alur Sebelumnya (Mock)

```
LinkedIn JSON ──┐
                ├──▶ String Concatenation ──▶ Mock JSON Contract
GitHub JSON  ───┘
```

### 2.2 Alur Sesudahnya (GenAI)

```
LinkedIn JSON ──┐
                ├──▶ Build AI Prompt ──▶ HTTP POST Gemini API ──▶ Parse Response
GitHub JSON  ───┘        │                      │                      │
Target Role  ───────────┘                      │                      │
Personal Info ──────────────────────────────────┘                      │
                                                                       ▼
                                                        Synthesized Resume JSON
                                                     (ATS-ready, STAR/XYZ format)
```

### 2.3 Output JSON Contract (Kompatibel dengan `04_Document_GeneratePdf`)

Output AI harus menghasilkan JSON yang kompatibel dengan
`CuratedResumeMock.json` — schema yang digunakan oleh modul berikutnya:

```json
{
  "profile": {
    "fullName": "...",
    "headline": "...",
    "email": "...",
    "phone": "...",
    "location": "...",
    "summary": "...",
    "linkedinUrl": "...",
    "githubUrl": "..."
  },
  "experiences": [
    {
      "id": "exp1",
      "company": "...",
      "role": "...",
      "startDate": "...",
      "endDate": "...",
      "bulletPoints": ["STAR/XYZ formatted achievement..."]
    }
  ],
  "projects": [
    {
      "id": "proj1",
      "name": "...",
      "repoUrl": "...",
      "stars": 0,
      "language": "...",
      "techStack": ["..."],
      "starSummary": "...",
      "isSelected": true
    }
  ],
  "skills": [
    { "category": "Languages", "items": ["..."] },
    { "category": "Frameworks & Libraries", "items": ["..."] },
    { "category": "Cloud & DevOps", "items": ["..."] }
  ],
  "education": [
    {
      "institution": "...",
      "degree": "...",
      "graduationYear": "...",
      "gpa": "..."
    }
  ]
}
```

---

## 3. Prasyarat

### 3.1 Paket NuGet yang Diperlukan

| Paket | Versi Min | Fungsi | Status |
|-------|-----------|--------|--------|
| `UiPath.WebAPI.Activities` | ≥ 2.5.1 | `NetHttpRequest` untuk HTTP POST ke Gemini | ❌ **Perlu install** |
| `UiPath.System.Activities` | 26.10.0 | Sudah ada (Read/Write/LogMessage/etc.) | ✅ Sudah ada |

### 3.2 Konfigurasi Gemini API

| Item | Detail |
|------|--------|
| **API Key** | Didapat gratis dari [Google AI Studio](https://aistudio.google.com/apikey) |
| **Model** | `gemini-2.0-flash` (cepat, gratis, mendukung JSON structured output) |
| **Endpoint** | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={API_KEY}` |
| **Penyimpanan Key** | UiPath Orchestrator Asset (tipe Credential) atau Orchestrator Secret, dibaca via `GetRobotAsset`/`GetSecret`. Untuk pengembangan lokal: Orchestrator Asset lokal atau hardcode sementara. |

### 3.3 Lisensi Studio

> ⚠️ **BLOCKER:** Saat ini akun `falhasan217@gmail.com` tidak memiliki lisensi Studio aktif.
> `uip rpa activities find` dan `uip rpa packages install` memerlukan lisensi.
>
> **Solusi:**
> 1. Minta admin untuk assign lisensi Studio ke akun ini di Orchestrator, **ATAU**
> 2. Jalankan `uip login` untuk berpindah ke akun yang berlisensi, **ATAU**
> 3. Instal paket secara manual via UiPath Studio Desktop (Manage Packages).

---

## 4. Langkah Implementasi

### Task 1: Instal Paket `UiPath.WebAPI.Activities`

- [ ] Pastikan lisensi Studio aktif (prasyarat 3.3)
- [ ] Jalankan:
  ```bash
  uip rpa packages install --packages "id=UiPath.WebAPI.Activities" \
    --project-dir "C:\Users\ASUS\OneDrive\Dokumen\UiPath\AutoCV" --output json
  ```
- [ ] Verifikasi paket muncul di `project.json` dependencies

### Task 2: Siapkan Gemini API Key sebagai Orchestrator Asset

- [ ] Buat asset di Orchestrator: `AutoCV_GeminiApiKey` (tipe Text)
- [ ] Atau untuk dev lokal, simpan key di `Data\Config\gemini_api_key.txt`
  (file ini sudah ada di `.gitignore`)

### Task 3: Rewrite `03_AI_SynthesizePortfolio.xaml`

Modul akan diubah sepenuhnya. Struktur baru:

#### 3a. Variabel Baru

| Variabel | Tipe | Fungsi |
|----------|------|--------|
| `strGeminiApiKey` | String | API key Gemini |
| `strSystemPrompt` | String | System prompt untuk LLM |
| `strUserPrompt` | String | User prompt berisi data LinkedIn + GitHub |
| `strRequestBody` | String | JSON body untuk Gemini API |
| `httpResponse` | HttpResponseSummary | Response dari HTTP Request |
| `strRawAIResponse` | String | Raw response text dari Gemini |
| `strExtractedJson` | String | JSON yang diekstrak dari respons AI |
| `intRetryCount` | Int32 | Counter untuk retry logic |

#### 3b. Alur Workflow Baru

```
Sequence "AI Synthesize Portfolio"
│
├── 1. Log Start
│
├── 2. Get Gemini API Key
│   └── TryCatch: GetRobotAsset "AutoCV_GeminiApiKey"
│       └── Catch: Read from local file fallback
│
├── 3. Build System Prompt
│   └── Assign strSystemPrompt (instruksi ATS, STAR/XYZ, output JSON schema)
│
├── 4. Build User Prompt
│   └── Assign strUserPrompt (gabungkan LinkedIn + GitHub + TargetRole + PersonalInfo)
│
├── 5. Build Gemini API Request Body
│   └── Assign strRequestBody (JSON structure untuk Gemini API)
│
├── 6. TryCatch: Call Gemini API via HTTP POST
│   ├── NetHttpRequest POST ke Gemini endpoint
│   ├── Check httpResponse.StatusCode = 200
│   ├── Extract "text" dari response JSON
│   └── Catch: Set fallback mock + warning
│
├── 7. Parse & Validate AI Response
│   ├── Extract JSON block dari response (between ``` markers if any)
│   ├── Validate JSON is parseable
│   └── If invalid: fallback to mock with warning
│
├── 8. Set Outputs
│   ├── out_SynthesizedResumeJson = extracted JSON
│   ├── out_AIStatus = "GEMINI_SYNTHESIS" atau "MOCK_FALLBACK"
│   └── out_AIWarning = any warning messages
│
└── 9. Log Completion
```

#### 3c. System Prompt (Inti AI)

```text
You are a professional career consultant and ATS resume optimization expert.

TASK: Analyze the provided LinkedIn profile and GitHub repositories data,
then synthesize an ATS-optimized resume JSON for the target job role.

RULES:
1. Use STAR/XYZ format for experience bullet points:
   - "Accomplished [X] as measured by [Y] by doing [Z]"
2. Select the most relevant non-fork GitHub projects (max 3)
3. Extract and categorize skills into: Languages, Frameworks & Libraries,
   Cloud & DevOps, and any domain-specific category
4. Write a concise professional summary (2-3 sentences)
5. All content must be in English
6. Output ONLY valid JSON — no markdown, no explanation, no code fences

OUTPUT JSON SCHEMA:
{
  "profile": {
    "fullName": "string",
    "headline": "string (optimized for target role)",
    "email": "string",
    "phone": "string or empty",
    "location": "string",
    "summary": "string (2-3 sentences, ATS keywords)",
    "linkedinUrl": "string",
    "githubUrl": "string"
  },
  "experiences": [{
    "id": "expN",
    "company": "string",
    "role": "string",
    "startDate": "string",
    "endDate": "string or Present",
    "bulletPoints": ["STAR/XYZ formatted strings"]
  }],
  "projects": [{
    "id": "projN",
    "name": "string",
    "repoUrl": "string",
    "stars": number,
    "language": "string",
    "techStack": ["string"],
    "starSummary": "string (1-2 sentences, impact focused)",
    "isSelected": true
  }],
  "skills": [{
    "category": "string",
    "items": ["string"]
  }],
  "education": [{
    "institution": "string",
    "degree": "string",
    "graduationYear": "string",
    "gpa": "string or empty"
  }]
}
```

#### 3d. Argumen (Tidak Berubah)

Interface argumen tetap identik:

| Argumen | Direction | Type | Keterangan |
|---------|-----------|------|------------|
| `in_LinkedInDataJson` | In | String | Data LinkedIn mentah |
| `in_GitHubDataJson` | In | String | Data GitHub mentah |
| `in_TargetJobRole` | In | String | Target posisi kerja |
| `in_PersonalInfoJson` | In | String | Info pribadi (email, URL) |
| `out_SynthesizedResumeJson` | Out | String | Resume JSON hasil AI |
| `out_AIStatus` | Out | String | Status: GEMINI_SYNTHESIS / MOCK_FALLBACK |
| `out_AIWarning` | Out | String | Pesan warning jika ada |

### Task 4: Validasi & Build

- [ ] `uip rpa validate --file-path "Modules\03_AI_SynthesizePortfolio.xaml"`
- [ ] `uip rpa build "C:\Users\ASUS\OneDrive\Dokumen\UiPath\AutoCV"`
- [ ] Fix semua error hingga 0 errors

### Task 5: Smoke Test

- [ ] `uip rpa run` dengan input mock data
- [ ] Verifikasi output JSON sesuai schema `CuratedResumeMock.json`
- [ ] Verifikasi pipeline end-to-end: AI → Document → PDF tergenerate

---

## 5. Fallback & Error Handling

| Skenario | Penanganan |
|----------|------------|
| API key tidak ditemukan | Gunakan mock synthesis + warning |
| Gemini API error (5xx) | Retry 2x dengan delay 3 detik |
| Gemini API error (4xx) | Log error detail + fallback ke mock |
| Response bukan JSON valid | Coba parse ulang (strip markdown fences) → fallback mock |
| Response JSON tidak sesuai schema | Gunakan respons apa adanya + warning |
| Network timeout | Timeout 30 detik + fallback mock |

**Prinsip:** Pipeline TIDAK BOLEH gagal total karena AI error. Mock fallback selalu tersedia.

---

## 6. Risiko & Mitigasi

| Risiko | Dampak | Mitigasi |
|--------|--------|---------|
| Lisensi Studio tidak aktif | Tidak bisa instal paket atau validate | Solve lisensi dulu (prasyarat 3.3) |
| Gemini API rate limit | AI call gagal pada volume tinggi | Retry logic + mock fallback |
| Response AI tidak konsisten | PDF generation gagal | JSON schema enforcement di prompt + validation |
| API key terekspos di git | Security breach | Simpan di Orchestrator Asset / .gitignore file |
| Gemini model deprecated | Endpoint berubah | Model configurable via asset/argument |

---

## 7. Estimasi Effort

| Task | Estimasi |
|------|----------|
| Instal paket + config key | 10 menit |
| Rewrite XAML workflow | 30 menit |
| Validate + fix errors | 15 menit |
| Smoke test + debug | 15 menit |
| **Total** | **~70 menit** |

---

## 8. Checklist Selesai

- [ ] Paket `UiPath.WebAPI.Activities` terinstal
- [ ] Gemini API key tersimpan aman (asset/file)
- [ ] `03_AI_SynthesizePortfolio.xaml` menggunakan HTTP POST ke Gemini
- [ ] System prompt menghasilkan output JSON sesuai schema
- [ ] Fallback ke mock jika AI gagal
- [ ] `uip rpa validate` = 0 errors
- [ ] `uip rpa build` = 0 errors
- [ ] Pipeline end-to-end berjalan: Scrape → AI → PDF → Email
- [ ] Tidak ada API key yang di-commit ke git

---

## 9. Langkah Selanjutnya (Future)

Setelah integrasi Gemini berjalan, pertimbangkan:

1. **UiPath LLM Gateway / GenAI Activities** — Jika lisensi tersedia, migrasi ke
   GenAI activities native untuk governance, logging, dan model switching yang lebih baik.
2. **Prompt versioning** — Simpan prompt di file terpisah (`Data\Prompts\system_prompt.txt`)
   agar bisa diubah tanpa edit XAML.
3. **Multi-model support** — Argumen `in_AIModel` untuk memilih Gemini/GPT/Claude.
4. **Response caching** — Cache hasil AI untuk kombinasi input yang sama.
5. **A/B testing prompt** — Bandingkan variasi prompt untuk kualitas output terbaik.
