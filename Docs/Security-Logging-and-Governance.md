# Keamanan, Tata Kelola Logging & Governance

> **AutoCV-Robot Enterprise Security, Logging & Governance Policy**  
> Standar Kepatuhan: Zero-PII Logging, UiPath Credential Assets (SecureString), Dummy Test Data Policy.

Dokumen ini memuat standar keamanan, kebijakan tata kelola logging, penanganan kredensial, dan keputusan arsitektur pada robot RPA **AutoCV**.

---

## 1. Kebijakan Data Uji (Dummy Test Data Policy)

Sesuai dengan ketentuan lisensi **UiPath Community Edition** (yang diperuntukkan bagi pengembangan, pembelajaran, dan pengujian personal/hackathon):
1. **Semua Data Uji Bersifat Fiktif (Dummy Data)**: 
   - Fixture pengujian pada folder [Data/Mocks/](file:///d:/KULIAHHHH_PENSSS/Hackathon/Automation/robot/Data/Mocks) (seperti `CuratedResumeMock.json`, `LinkedInProfileMock.json`, dan `GitHubReposMock.json`) menggunakan nama persona rekaan (*Jane Mustika Pratama*) dan riwayat kerja fiktif.
   - Tidak ada data pribadi riil (*Personally Identifiable Information - PII*) milik individu nyata yang disimpan di dalam repository ini.
2. **Pengujian Mandiri (Self-Contained Testing)**:
   - Dewan Juri dan penguji dapat memverifikasi seluruh alur kerja menggunakan flag `in_UseMockFallback = True` tanpa perlu menghubungkan akun LinkedIn asli atau token berbayar.

---

## 2. Standar Sanitasi Logging (Zero-PII in Logs)

Salah satu prinsip utama otomatisasi enterprise adalah **mencegah kebocoran data sensitif ke berkas log**. Mentor Hackathon secara khusus menekankan bahwa log tidak boleh mencetak data profil kandidat atau token autentikasi.

### Kebijakan Logging AutoCV:
- **Hanya Mencatat Metadata & Ukuran Payload**: 
  Setiap modul dilarang mencetak isi teks mentah (*raw JSON*) ke dalam aktivitas `ui:LogMessage`. Modul hanya mencatat status operasi, kode status HTTP, dan panjang karakter (`Length`).
  *Contoh Implementasi pada [01_LinkedIn_ScrapeProfile.xaml](file:///d:/KULIAHHHH_PENSSS/Hackathon/Automation/robot/Modules/LinkedIn/01_LinkedIn_ScrapeProfile.xaml):*
  ```vb
  "[01_LinkedIn_ScrapeProfile] Extractor raw output received. Status: " & If(String.IsNullOrEmpty(strScrapedJsonRaw), "<empty>", "SUCCESS") & " | Size: " & strScrapedJsonRaw.Length.ToString() & " chars."
  ```
- **Zero Token/Password Logging**: Tidak ada variabel API Key (Gemini/OpenRouter), token GitHub, atau kata sandi SMTP yang dimasukkan ke parameter `Message` pada `LogMessage` maupun `WriteLine`.

### Lokasi Penyimpanan Log:
1. **Log Lokal (Local Execution Logs)**:
   - Tersimpan di direktori Windows pengguna:  
     `%LocalAppData%\UiPath\Logs\` (contoh: `C:\Users\<User>\AppData\Local\UiPath\Logs\YYYY-MM-DD_Execution.log`).
   - Berkas log lokal ini hanya dapat diakses oleh user pemilik sesi mesin Windows.
2. **Log Cloud (Orchestrator Cloud Logs)**:
   - Log yang dikirimkan robot saat terhubung ke UiPath Orchestrator disimpan secara terenkripsi di cloud.
   - Akses log dibatasi secara ketat berdasarkan Role-Based Access Control (RBAC) tenant UiPath dengan hak akses `OR.Monitoring` dan `OR.Jobs`.

---

## 3. Manajemen Rahasia & Kredensial (Secrets Management)

AutoCV menerapkan pemisahan tegas antara lingkungan pengembangan lokal dan lingkungan produksi:

| Lingkungan | Mekanisme Penyimpanan Kredensial | Praktik Keamanan |
|---|---|---|
| **Lokal (Studio / CLI)** | Berkas `robot/.env` atau `Data/Config/ai_settings.json` | Terdaftar secara ketat di [.gitignore](file:///d:/KULIAHHHH_PENSSS/Hackathon/Automation/robot/.gitignore). Tersedia berkas template `ai_settings.example.json` tanpa nilai rahasia. |
| **Produksi (Orchestrator Unattended)** | **UiPath Orchestrator Assets** (Tipe `Credential` & `Text`) | Kredensial diambil menggunakan aktivitas `GetCredential` yang menghasilkan tipe data `SecureString` terenkripsi dalam memori, mencegah kebocoran via memori dump. |

---

## 4. Keputusan Tata Kelola: `automationHubUrl` pada `project.json`

Pada berkas [project.json](file:///d:/KULIAHHHH_PENSSS/Hackathon/Automation/robot/project.json), atribut `automationHubUrl` saat ini dibiarkan kosong (`""`):

### Alasan Keputusan:
1. **Integritas Referensi**: URL dasar organisasi (misal `https://cloud.uipath.com/my-org/`) atau URL Orchestrator bukanlah URL Automation Hub yang valid. Memasukkan URL dummy semata-mata demi menghilangkan warning analyzer merupakan praktik yang keliru (*anti-pattern*).
2. **Konteks Hackathon**: Proyek ini dikembangkan dalam rangka **Automation Hackathon 2026** di mana ide dan alur dievaluasi langsung melalui repositori kode dan demo, bukan melalui pipeline tata kelola korporasi internal.
3. **Kemandirian Build**: Ketiadaan URL Automation Hub sama sekali tidak memengaruhi validitas eksekusi di Studio, compiler XAML, maupun penerbitan paket (*publish*) ke Orchestrator.
