# Keputusan Tata Kelola: `automationHubUrl` pada AutoCV-Robot

> **UiPath Project Governance & Automation Hub Policy**  
> Status: Keputusan Disengaja (*Intentional Architecture Decision*) · Tanggal Evaluasi: 2026-11-24

Dokumen ini mencatat alasan teknis dan kebijakan tata kelola terkait nilai `automationHubUrl` pada berkas konfigurasi [project.json](file:///d:/KULIAHHHH_PENSSS/Hackathon/Automation/robot/project.json).

---

## 1. Status Konfigurasi

Pada `project.json`, atribut `automationHubUrl` saat ini dibiarkan kosong (`""`):

```json
"designOptions": {
  "projectProfile": "Developement",
  "outputType": "Process",
  "libraryOptions": {
    "includeOriginalXaml": false,
    "privateWorkflows": []
  },
  "processOptions": {
    "ignoredFiles": []
  },
  "fileInfoCollection": [],
  "saveToCloud": false
}
```

---

## 2. Latar Belakang & Klarifikasi Service UiPath

Saat menjalankan UiPath Workflow Analyzer, beberapa kebijakan organisasi mewajibkan pendaftaran ke Automation Hub sehingga analyzer menampilkan peringatan (*warning*):

Penting untuk membedakan peran masing-masing layanan pada ekosistem UiPath:
1. **UiPath Studio / Local Project**: Tempat alur kerja dibangun, divalidasi, dan diuji secara modular.
2. **UiPath Orchestrator**: Layanan untuk menyimpan paket proses (*Packages*), mengatur antrean (*Queues*), kredensial (*Assets*), dan menjalankan robot (*Jobs*).
3. **UiPath AI Model Hub / AI Center**: Layanan untuk mengelola model ML dan AI skill.
4. **UiPath Automation Hub**: Layanan tata kelola portofolio otomatisasi untuk mendaftarkan ide (*Idea Pipeline*), analisis kelayakan ROI, dan dokumentasi siklus hidup otomasi.

---

## 3. Alasan Keputusan

1. **Integritas Referensi**: URL dasar organisasi (misal `https://cloud.uipath.com/my-org/`) atau URL Orchestrator bukanlah Automation Hub URL yang valid. Memasukkan URL yang salah semata-mata demi menghilangkan warning analyzer merupakan praktik yang keliru (*anti-pattern*).
2. **Fase Siklus Hidup**: Proyek ini dikembangkan dalam rangka **Automation Hackathon 2026**. Ide otomasi dievaluasi langsung melalui kode sumber mandiri dan demo interaktif, bukan melalui pendaftaran ide korporasi internal.
3. **Zero Impact on Execution**: Ketiadaan URL Automation Hub sama sekali tidak memengaruhi keabsahan build, validasi XAML, eksekusi lokal di Studio, maupun deployment paket proses ke Orchestrator.

---

## 4. Prosedur Deployment Produksi Enterprise

Apabila AutoCV diterapkan pada skala enterprise setelah kompetisi:
1. Administrator RPA mendaftarkan proses *"AutoCV - Intelligent Career Dossier"* pada modul **Automation Hub** organisasi.
2. Salin URL resmi halaman ide/proses tersebut (misal `https://automation-hub.uipath.com/idea/...`).
3. Masukkan URL tersebut melalui **Project Settings > General > Automation Hub URL** di UiPath Studio.
4. Simpan `project.json` dan lakukan build/publish versi rilis resmi.
