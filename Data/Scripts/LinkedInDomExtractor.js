(function (e) {
  try {
    var result = {
      full_name: "",
      headline: "",
      about: "",
      experiences: [],
      education: [],
      certifications: [],
      skills: []
    };

    // 1. Ekstraksi Nama Lengkap & Headline
    var nameElement = document.querySelector("h1.text-heading-xlarge, h1.inline, h1");
    if (nameElement && nameElement.innerText) {
      result.full_name = nameElement.innerText.trim();
    }

    var headlineElement = document.querySelector(".text-body-medium.break-words, div.text-body-medium");
    if (headlineElement && headlineElement.innerText) {
      result.headline = headlineElement.innerText.trim();
    }

    // 2. Ekstraksi About / Summary
    var aboutAnchor = document.getElementById("about");
    if (aboutAnchor) {
      var aboutSection = aboutAnchor.closest("section");
      if (aboutSection) {
        var aboutText = aboutSection.querySelector(".inline-show-more-text, div.display-flex");
        if (aboutText && aboutText.innerText) {
          result.about = aboutText.innerText.trim();
        }
      }
    }

    // Helper: Mencari elemen section berdasarkan ID anchor
    function getSectionItems(sectionId) {
      var anchor = document.getElementById(sectionId);
      if (!anchor) return [];
      var section = anchor.closest("section");
      if (!section) return [];
      
      var listItems = section.querySelectorAll("li.artdeco-list__item, li.pvs-list__paged-list-item");
      var parsedItems = [];
      listItems.forEach(function (li) {
        var spans = Array.from(li.querySelectorAll('span[aria-hidden="true"]'))
          .map(function (s) { return s.innerText ? s.innerText.trim() : ""; })
          .filter(Boolean);
        if (spans.length > 0) {
          parsedItems.push(spans);
        }
      });
      return parsedItems;
    }

    // 3. Ekstraksi Pengalaman Kerja (Experiences)
    var rawExperiences = getSectionItems("experience");
    rawExperiences.forEach(function (spans) {
      result.experiences.push({
        position: spans[0] || "",
        company: spans[1] || "",
        period: spans[2] || "",
        description: spans.slice(3).join("\n") || ""
      });
    });

    // 4. Ekstraksi Pendidikan (Education)
    var rawEducation = getSectionItems("education");
    rawEducation.forEach(function (spans) {
      result.education.push({
        institution: spans[0] || "",
        degree: spans[1] || "",
        year: spans[2] || ""
      });
    });

    // 5. Ekstraksi Sertifikasi (Licenses & Certifications)
    var rawCertifications = getSectionItems("certifications");
    if (rawCertifications.length === 0) {
      rawCertifications = getSectionItems("licenses_and_certifications");
    }
    rawCertifications.forEach(function (spans) {
      result.certifications.push({
        name: spans[0] || "",
        issuer: spans[1] || "",
        year: spans[2] || ""
      });
    });

    // 6. Ekstraksi Top Skills
    var rawSkills = getSectionItems("skills");
    rawSkills.forEach(function (spans) {
      if (spans[0]) {
        result.skills.push(spans[0]);
      }
    });

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
})
