// InjectJsScript (UiPath.UIAutomation.Activities) mengeksekusi isi file ini
// sebagai EKSPRESI FUNGSI, lalu memanggilnya dengan (element, input) dan
// menulis return value-nya ke ScriptOutput. Bentuk IIFE akan membuat aktivitas
// memanggil hasil IIFE (string) -> "TypeError: n is not a function".
function (element, input) {
  try {
    var result = {
      debug: null,
      full_name: "",
      headline: "",
      about: "",
      experiences: [],
      education: [],
      certifications: [],
      skills: []
    };

    // ---------------------------------------------------------------------------
    // LinkedIn (2026): semua nama class di-hash oleh CSS-in-JS (mis. "k4dl1je"),
    // id anchor seperti getElementById("experience") sudah dihapus total, dan judul
    // section mengikuti bahasa browser ("Pendidikan", "Keahlian (8)", "Tentang").
    // Karena itu ekstraksi hanya mengandalkan dua hal yang stabil:
    //   1. teks <h2> judul section (multibahasa, pola "Judul (n)"),
    //   2. struktur tag polos: satu item = kumpulan <p> berurutan yang dipisah <hr>.
    // ---------------------------------------------------------------------------

    var SECTION_HEADINGS = {
      about: ["tentang", "about"],
      experience: ["pengalaman", "experience"],
      education: ["pendidikan", "education"],
      skills: ["keahlian", "skills", "keterampilan"],
      certifications: [
        "lisensi dan sertifikasi",
        "lisensi & sertifikasi",
        "licenses & certifications",
        "licenses and certifications"
      ]
    };

    // Elemen UI yang bukan konten: tombol/tautan tambah-edit-lihat semua.
    var EXCLUDE_START = /^(tambahkan|add\b|edit\b|lihat|tampilkan|show more|see more)/i;

    function norm(s) {
      return String(s == null ? "" : s).replace(/\s+/g, " ").trim();
    }

    // "Keahlian (8)" -> "keahlian"; "Licenses & Certifications (5)" -> teks polos.
    function bareHeading(s) {
      return norm(s).toLowerCase().replace(/\s*\(\d+\)\s*$/, "").trim();
    }

    function matchesKeyword(bare, keywords) {
      for (var i = 0; i < keywords.length; i++) {
        if (bare === keywords[i] || bare.indexOf(keywords[i]) === 0) return true;
      }
      return false;
    }

    function isSectionHeading(s) {
      var bare = bareHeading(s);
      if (!bare) return false;
      for (var key in SECTION_HEADINGS) {
        if (Object.prototype.hasOwnProperty.call(SECTION_HEADINGS, key) &&
            matchesKeyword(bare, SECTION_HEADINGS[key])) {
          return true;
        }
      }
      return false;
    }

    function visible(el) {
      return !!(el && el.getClientRects && el.getClientRects().length > 0);
    }

    // Cari wadah section dari judul <h2>-nya (id anchor sudah tidak ada).
    function findSection(key) {
      var kws = SECTION_HEADINGS[key] || [];
      var heads = document.querySelectorAll("h2");
      for (var i = 0; i < heads.length; i++) {
        var bare = bareHeading(heads[i].innerText);
        if (matchesKeyword(bare, kws)) {
          return heads[i].closest("section") || heads[i].parentElement.parentElement;
        }
      }
      return null;
    }

    // Nama: pakai <h1> klasik bila ada, selain itu <h2> pertama yang tampil dan
    // bukan judul section (nama selalu berada paling atas, sebelum section lain).
    function findName() {
      var legacy = document.querySelector("h1.text-heading-xlarge, h1.inline");
      if (legacy && norm(legacy.innerText)) return legacy;

      var scopes = [];
      var main = document.querySelector("main");
      if (main) scopes.push(main);
      scopes.push(document);

      for (var pass = 0; pass < 2; pass++) {
        for (var s = 0; s < scopes.length; s++) {
          var hs = scopes[s].querySelectorAll("h2");
          for (var i = 0; i < hs.length; i++) {
            var t = norm(hs[i].innerText);
            if (!t || t.length > 120 || isSectionHeading(t)) continue;
            if (pass === 0 && !visible(hs[i])) continue;
            return hs[i];
          }
        }
      }
      return null;
    }

    // Headline: paragraf pertama setelah nama di dalam section kartu identitas.
    function findHeadline(nameEl) {
      if (!nameEl) return "";
      var scope = nameEl.closest("section") || nameEl.parentElement.parentElement;
      var ps = scope.querySelectorAll("p");
      var after = false;
      for (var i = 0; i < ps.length; i++) {
        var p = ps[i];
        if (!after) {
          // 4 = Node.DOCUMENT_POSITION_FOLLOWING
          if (!(nameEl.compareDocumentPosition(p) & 4)) continue;
          after = true;
        }
        if (p.closest("a, button")) continue;
        var t = norm(p.innerText);
        if (!t || t.length > 300) continue;
        if (EXCLUDE_START.test(t)) continue;
        if (/^\d+\+?\s*(koneksi|connections)/i.test(t)) continue;
        return t;
      }
      return "";
    }

    function findAbout() {
      var sec = findSection("about");
      if (!sec) return "";
      var ps = sec.querySelectorAll("p");
      for (var i = 0; i < ps.length; i++) {
        var t = norm(ps[i].innerText);
        if (!t || t.length < 15) continue;
        if (EXCLUDE_START.test(t)) continue;
        // Buang label tombol "tampilkan selengkapnya" yang ikut terbaca.
        var cut = t.search(/\s(tampilkan|show more|see more|selengkapnya)\b/i);
        if (cut > 20) t = t.substring(0, cut).trim();
        if (t.length >= 15) return t;
      }
      return "";
    }

    // Satu item = semua <p> berurutan sebelum <hr> pemisah berikutnya.
    function collectGroups(section) {
      if (!section) return [];
      var nodes = section.querySelectorAll("p, hr");
      var groups = [];
      var cur = [];
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        if (el.tagName === "HR") {
          if (cur.length) groups.push(cur);
          cur = [];
          continue;
        }
        var t = norm(el.innerText);
        if (t) cur.push(t);
      }
      if (cur.length) groups.push(cur);

      // Buang duplikat berurutan (LinkedIn kadang merender entri dua kali).
      var out = [];
      for (i = 0; i < groups.length; i++) {
        if (i > 0 && groups[i].join(" | ") === groups[i - 1].join(" | ")) continue;
        out.push(groups[i]);
      }
      return out;
    }

    function isYearRange(t) {
      return /\d{4}/.test(t) && /(–|—|-|\sto\b|s\/d|hingga|sekarang|present|now)/i.test(t);
    }

    function hasYear(t) {
      return /(19|20)\d{2}/.test(t);
    }

    // --- Nama, headline, about -------------------------------------------------
    var nameEl = findName();
    if (nameEl) result.full_name = norm(nameEl.innerText);
    result.headline = findHeadline(nameEl);
    result.about = findAbout();

    // --- Pengalaman kerja ------------------------------------------------------
    collectGroups(findSection("experience")).forEach(function (g) {
      var pos = g[0] || "";
      var comp = "";
      var per = "";
      var rest = [];
      for (var i = 1; i < g.length; i++) {
        var t = g[i];
        if (!per && isYearRange(t)) { per = t; continue; }
        if (!comp) { comp = t; continue; }
        rest.push(t);
      }
      if (pos || comp) {
        result.experiences.push({
          position: pos,
          company: comp,
          period: per,
          description: rest.join("\n")
        });
      }
    });

    // --- Pendidikan ------------------------------------------------------------
    collectGroups(findSection("education")).forEach(function (g) {
      var inst = g[0] || "";
      var deg = "";
      var yr = "";
      var gpa = "";
      for (var i = 1; i < g.length; i++) {
        var t = g[i];
        var m = t.match(/^(?:ipk|gpa)\s*[:：]\s*(.+)$/i);
        if (m && !gpa) { gpa = m[1]; continue; }
        if (!yr && isYearRange(t)) { yr = t; continue; }
        if (!deg) { deg = t; continue; }
      }
      if (inst || deg || yr) {
        result.education.push({ institution: inst, degree: deg, year: yr, gpa: gpa });
      }
    });

    // --- Lisensi & sertifikasi -------------------------------------------------
    collectGroups(findSection("certifications")).forEach(function (g) {
      var name = g[0] || "";
      var issuer = "";
      var yr = "";
      for (var i = 1; i < g.length; i++) {
        var t = g[i];
        if (!yr && hasYear(t)) { yr = t; continue; }
        if (!issuer) { issuer = t; continue; }
      }
      if (name && !EXCLUDE_START.test(name)) {
        result.certifications.push({ name: name, issuer: issuer, year: yr });
      }
    });

    // --- Keahlian --------------------------------------------------------------
    // Elemen pertama tiap item adalah nama keahlian; sisanya badge/endorsement.
    collectGroups(findSection("skills")).forEach(function (g) {
      var name = g[0] || "";
      if (!name || name.length > 80) return;
      if (EXCLUDE_START.test(name)) return;
      if (/^(anda memiliki|and you have|maximum|max skills|keahlian unggulan)/i.test(name)) return;
      if (result.skills.indexOf(name) === -1) result.skills.push(name);
    });

    // --- Diagnostik: keadaan DOM saat ekstraksi (ditaruh di awal JSON supaya
    // tidak terpotong log bila payload besar) -------------------------------
    try {
      var dbgHeads = document.querySelectorAll("h2");
      var dbgList = [];
      for (var di = 0; di < dbgHeads.length && di < 25; di++) {
        dbgList.push(norm(dbgHeads[di].innerText));
      }
      result.debug = {
        url: String(location.href),
        title: String(document.title),
        viewport: String(window.innerWidth) + "x" + String(window.innerHeight),
        scroll: String(window.scrollY || document.documentElement.scrollTop || 0) + "/" +
          String(Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)),
        sections: document.querySelectorAll("section").length,
        iframes: document.querySelectorAll("iframe").length,
        dialogs: document.querySelectorAll('[role="dialog"]').length,
        body: String(document.body.innerText || "").replace(/\s+/g, " ").slice(0, 1400),
        headings: dbgList
      };
    } catch (dbgErr) {
      result.debug = { error: String(dbgErr && dbgErr.message) };
    }

    return JSON.stringify(result);
  } catch (err) {
    return JSON.stringify({
      error: err.message,
      full_name: "",
      headline: "",
      about: "",
      experiences: [],
      education: [],
      certifications: [],
      skills: []
    });
  }
}
