# Panduan Evaluasi & Pengujian Juri (5-Minute Evaluation Guide)

> **AutoCV — Intelligent Career Dossier & ATS Resume Builder**  
> *Automation Hackathon 2026 (Indosat Ooredoo Hutchison × UiPath × ONE Indonesia)*  
> Tema: **#HumanInTheLead** · Kategori: Enterprise Automation & GenAI Integration

Selamat datang Dewan Juri Automation Hackathon 2026. Dokumen ini dirancang sebagai panduan cepat (*quick-review checklist*) untuk menguji, memvalidasi integritas kode, dan mengevaluasi keandalan robot RPA **AutoCV** dalam waktu kurang dari 5 menit tanpa perlu melakukan konfigurasi cloud atau kredensial eksternal yang rumit.

---

## 1. Ringkasan Eksekutif & Value Proposition

AutoCV memecahkan tantangan kritis dalam pencarian kerja: **ketidakcocokan antara profil profesional kandidat dan algoritma Applicant Tracking System (ATS)**. 

Banyak kandidat berkualitas gugur di tahap screening awal karena format CV yang tidak standar (dua kolom, tabel kompleks, ikon grafis) dan narasi pencapaian yang pasif. AutoCV mengatasi masalah ini melalui kolaborasi harmonis antara **RPA (UiPath)**, **Generative AI (Gemini / GPT)**, dan **Human-in-the-Loop**:

```text
[Web Portal] ──▶ [Job 1: Robot Ingestion] ──▶ [AI Synthesis (STAR)] 
                        │
                        ▼
             [Human Curation Web Portal]  <── #HumanInTheLead (Kandidat Mengoreksi & Menyetujui)
                        │
                        ▼
                 [Job 2: Robot Render] ──▶ [Native OpenXML ATS DOCX/PDF] ──▶ [Email Delivery]
```

### Mengapa AutoCV Unggul untuk Kelas Enterprise?
1. **Smart Dual-Mode Dispatcher (`Main.xaml`)**: Menghemat lisensi unattended bot. Robot Job 1 tidak pernah *idle/sleep* di VM menunggu approval manusia. Job 1 selesai dalam hitungan detik setelah draf terkirim ke Web. Job 2 dipicu kembali hanya saat pengguna telah menyetujui hasil kurasi.
2. **Multi-Layer Resilience (Zero-Failure Execution)**:
   - Jika LinkedIn session belum login di VM $\rightarrow$ otomatis beralih ke *deterministic offline mock*.
   - Jika API Gemini limit/timeout $\rightarrow$ otomatis fallback ke OpenRouter (GPT-4o-mini), lalu fallback ke sintesis lokal.
   - Jika Microsoft Word tidak terinstal $\rightarrow$ engine PDF memanfaatkan browser Chromium (Edge/Chrome headless) bawaan Windows.
3. **Enterprise Package & Clean Architecture**: Pemisahan tegas antara Dispatcher, Pipeline Orkestrasi, Modul Fitur, dan Helper Scripts. Seluruh *path resolution* bersifat dinamis melalui `PathUtils.ps1`.

---

## 2. Uji Verifikasi Cepat (1-Liner Quick Verification)

Dewan Juri dapat memverifikasi seluruh komponen robot langsung melalui terminal PowerShell di root folder `robot/`:

### Tes 1: Validasi Integritas Seluruh File XAML (100% Valid XML)
Memverifikasi bahwa seluruh 16 file XAML (Main, Pipelines, Modules, Tests) memiliki struktur XML yang valid, bersih dari namespace rusak, dan siap dieksekusi di UiPath Studio:
```powershell
powershell -ExecutionPolicy Bypass -File Data\Scripts\Shared\ValidateAllXaml.ps1
```
*Ekspektasi Output:*
```text
VALID [OK]: ...\robot\Main.xaml (Root: Activity)
VALID [OK]: ...\robot\Modules\Pipelines\Pipeline_IngestionAndSynthesis.xaml
VALID [OK]: ...\robot\Modules\Pipelines\Pipeline_RenderAndDeliver.xaml
...
ALL XAML FILES ARE 100% VALID XML!
```

---

### Tes 2: Eksekusi Test Suite Robot (13/13 Green Test)
Menguji parser normalizer, generator OpenXML Word, template HTML ATS, browser PDF locator, GitHub username parser, dan end-to-end document engine:
```powershell
node Data\Scripts\test_modules.js
```
*Ekspektasi Output:*
```text
=== RUNNING AUTO-CV ROBOT MODULE TESTS ===
--- 1. Testing normalizer.js --- (5 tests passed)
--- 2. Testing openXmlBuilder.js --- (3 tests passed)
--- 3. Testing htmlTemplate.js --- (1 test passed)
--- 4. Testing pdfExporter.js --- (1 test passed)
--- 5. Testing FetchGitHubRepos.js --- (2 tests passed)
--- 6. Testing GenerateResumeDocument.js End-to-End --- (1 test passed)
==========================================
TEST RESULTS: 13 passed, 0 failed
==========================================
```

---

### Tes 3: Uji Pembuatan Dokumen Resume ATS Nyata (End-to-End)
Menghasilkan dokumen resmi ATS-friendly (DOCX & PDF) secara langsung dari mock payload kurasi manusia:
```powershell
powershell -ExecutionPolicy Bypass -File Data\Scripts\Document\RunResumeGeneration.ps1 -PayloadFile "Data\Mocks\CuratedResumeMock.json"
```
*Ekspektasi Output:*
```json
{
  "success": true,
  "docxPath": "...\\robot\\Data\\Outputs\\CV_Jane_Mustika_Pratama_<timestamp>.docx",
  "pdfPath": "...\\robot\\Data\\Outputs\\CV_Jane_Mustika_Pratama_<timestamp>.pdf",
  "candidateName": "Jane Mustika Pratama",
  "pdfGenerated": true,
  "exportMethod": "chrome_headless (atau word_com)"
}
```
*Hasil dokumen dapat langsung dibuka dan diperiksa di folder:* [Data/Outputs/](../Data/Outputs)

---

### Tes 4: Uji Pengambilan Portofolio GitHub (Live & Fallback)
Menguji modul scraper/fetcher repositori publik GitHub:
```powershell
powershell -ExecutionPolicy Bypass -File Data\Scripts\GitHub\RunGitHubFetch.ps1 -GitHubInput "octocat" -UseMockFallback "true"
```
*Ekspektasi Output:* Mengembalikan struktur JSON profil dan repositori GitHub yang terformat rapi dan siap disintesis oleh AI.

---

## 3. Matriks Pemenuhan Kriteria Penilaian Hackathon

| Kriteria Penilaian | Implementasi Nyata pada AutoCV-Robot | Bukti / Lokasi Kode |
|---|---|---|
| **Inovasi & Relevansi Solusi** | Mengubah resume informal/mentah menjadi ATS-Compliant Career Dossier dengan standar Harvard & Stanford. Menjunjung filosofi **#HumanInTheLead** di mana AI menyusun draf, namun manusia memegang kendali kurasi akhir. | [03_AI_SynthesizePortfolio.xaml](../Modules/AI/03_AI_SynthesizePortfolio.xaml) |
| **Kematangan Arsitektur UiPath** | Menggunakan arsitektur *Smart Dual-Mode Dispatcher* berprinsip Single Responsibility (SRP). Memisahkan fase Ingestion (`Pipeline_IngestionAndSynthesis.xaml`) dan Render (`Pipeline_RenderAndDeliver.xaml`). | [Main.xaml](../Main.xaml), [Pipelines/](../Modules/Pipelines/) |
| **Ketahanan & Robustness (Zero Break)** | Tidak pernah membiarkan robot crash saat network putus atau kredensial kosong. Menggunakan flag `in_UseMockFallback` dan multi-provider LLM fallback (Gemini $\rightarrow$ OpenRouter $\rightarrow$ Local Mock). | `01_LinkedIn`, `02_GitHub`, `03_AI` |
| **Dokumentasi & Standar OpenXML** | Membuat dokumen DOCX murni melalui manipulasi XML WordprocessingML tanpa lisensi berbayar Word, serta mengonversinya ke PDF ATS via Edge/Chrome headless. | [Data/Scripts/Document/lib/](../Data/Scripts/Document/lib/) |
| **Keamanan & Kepatuhan Enterprise** | Nol credential leak. Seluruh API key dan token diisolasi di `.env` (di-ignore git), serta disiapkan kompatibel dengan *UiPath Orchestrator Assets*. | [.gitignore](../.gitignore) |

---

## 4. Panduan Eksekusi di UiPath Studio (Opsi Pengujian Studio)

Bagi Dewan Juri yang ingin menginspeksi alur kerja secara visual di **UiPath Studio 26.10**:

1. Buka project dengan memilih berkas [project.json](../project.json).
2. Buka berkas [Main.xaml](../Main.xaml).
3. **Skenario 1: Menjalankan Fase 1 (Ingestion & AI Synthesis)**
   Klik *Run with Arguments* pada `Main.xaml` dengan parameter:
   - `in_JobId`: `"test-job-001"`
   - `in_LinkedInUrl`: `"https://www.linkedin.com/in/jane-doe"`
   - `in_GitHubUrl`: `"https://github.com/janedoe"`
   - `in_TargetJobRole`: `"Senior Fullstack Engineer"`
   - `in_RecipientEmail`: `"juri@hackathon2026.id"`
   - `in_UseMockFallback`: `True`
   - `in_RequireManualApproval`: `True`
   - `in_ApprovedResumePayload`: `""` *(biarkan kosong)*
   *Robot akan mengekstrak data, menyintesis narasi STAR, dan memicu webhook `/draft` atau menyelesaikan status `CURATING`.*

4. **Skenario 2: Menjalankan Fase 2 (Rendering Dokumen & Pengiriman Email)**
   Klik *Run with Arguments* dengan mengisi:
   - `in_ApprovedResumePayload`: Salin isi dari berkas [CuratedResumeMock.json](../Data/Mocks/CuratedResumeMock.json).
   - `in_UseMockFallback`: `True`
   *Robot langsung memproses dokumen, menghasilkan PDF/DOCX di `Data/Outputs/`, dan mencatat notifikasi email sukses.*

---

## 5. Ringkasan File & Tautan Referensi Cepat

- **Arsitektur Lengkap & Rincian Modul**: [Architecture-and-Workflows.md](./Architecture-and-Workflows.md)
- **Spesifikasi Engine Dokumen ATS**: [Document-Engine-Technical-Spec.md](./Document-Engine-Technical-Spec.md)
- **Spesifikasi Integrasi GenAI & Multi-LLM**: [GenAI-Integration.md](./GenAI-Integration.md)
- **Keputusan Tata Kelola Automation Hub**: [AutomationHub-URL-Decision.md](./AutomationHub-URL-Decision.md)
