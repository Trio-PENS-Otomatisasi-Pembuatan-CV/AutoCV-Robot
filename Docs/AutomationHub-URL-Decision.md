# Keputusan `automationHubUrl` AutoCV

**Tanggal:** 2026-11-12  
**Project:** AutoCV-Robot  
**Lokasi project:** `D:\Portofolio\Automation-CV\AutoCV-Robot`

## Status

Project AutoCV saat ini belum memiliki `automationHubUrl` pada `project.json`.

Keputusan ini disengaja karena pipeline AutoCV sedang dikembangkan dan diuji sebagai project UiPath lokal. Belum ada URL idea atau process resmi AutoCV di UiPath Automation Hub yang dapat dijadikan referensi.

## Klarifikasi service UiPath

- **Project lokal:** tempat workflow AutoCV dibangun, divalidasi, dan diuji.
- **Orchestrator:** service untuk menyimpan package, membuat process, dan menjalankan automation setelah dipublish.
- **Model Hub:** service untuk mengelola dan menyediakan model AI/ML. Model Hub bukan Automation Hub.
- **Automation Hub:** service untuk mendaftarkan idea/process automation, mengelola pipeline governance, serta menyimpan dokumentasi dan metadata lifecycle automation.

URL dasar organisasi atau URL Orchestrator tidak dapat digunakan sebagai `automationHubUrl`. Contoh URL yang tidak valid untuk tujuan ini:

```text
https://cloud.uipath.com/triopens
```

URL yang dibutuhkan, apabila tersedia nanti, harus mengarah ke idea/process AutoCV tertentu di Automation Hub.

## Alasan warning build dipertahankan

Organisasi mewajibkan project memiliki Automation Hub URL, sehingga analyzer menampilkan warning. Warning tersebut tidak memblokir validasi, build, atau pengembangan pipeline lokal.

Saat ini warning dipertahankan karena:

1. Automation Hub idea/process resmi untuk AutoCV belum dibuat atau belum ditemukan.
2. Menambahkan URL organisasi, URL Orchestrator, atau URL Model Hub akan memberikan referensi yang salah.
3. URL yang benar harus berasal dari halaman idea/process AutoCV di Automation Hub dan perlu dikonfirmasi oleh owner/admin organisasi.

## Tindakan berikutnya

Setelah idea/process AutoCV resmi tersedia:

1. Salin URL lengkap dari halaman idea/process tersebut.
2. Masukkan URL melalui **Project Settings > General > Automation Hub URL** di UiPath Studio.
3. Simpan project.
4. Jalankan validasi dan build ulang.
5. Perbarui dokumen ini dengan tanggal konfigurasi dan referensi idea/process.

Sampai tindakan tersebut dilakukan, pipeline tetap dikelola dari project lokal dan dapat dipublikasikan ke Orchestrator secara terpisah apabila sudah disetujui.
