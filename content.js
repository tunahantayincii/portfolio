const STORAGE_KEY = "tunahan-tayinci-portfolio-v1";

const DEFAULT_CONTENT = {
  settings: {
    studioName: "Tunahan Tayıncı Portfolio",
    heroTitle: "Düşünüyor,<br><em>çiziyor</em> ve üretiyorum.",
    heroLocation: "Mimarlık Öğrencisi · İstanbul",
    heroImage: "assets/hero-residence.png",
    heroSlides: [
      { image: "assets/hero-residence.png", label: "Seçili Proje 01", title: "Mazı Konutu / 2023" },
      { image: "assets/courtyard-center.png", label: "Seçili Proje 02", title: "Avlu Sanat Merkezi / 2024" },
      { image: "assets/lake-pavilion.png", label: "Seçili Proje 03", title: "Göl Pavyonu / 2025" }
    ],
    intro: "Bu portfolyo; mimarlık eğitimim boyunca geliştirdiğim fikirleri, tasarım süreçlerini, araştırmaları ve temsil denemelerini bir araya getirir.",
    studioTitle: "Mimarlığı, sürekli gelişen bir <em>öğrenme alanı</em> olarak görüyorum.",
    studioDescription: "Mekân, malzeme ve kullanıcı deneyimi üzerine çalışan bir mimarlık öğrencisiyim. Tasarım sürecimde araştırma, eskiz, maket ve dijital üretimi birlikte kullanıyor; her projeyi yeni sorular sormak için bir fırsat olarak görüyorum.",
    email: "hello@tunahantayinci.com",
    contactText: "Tanışalım.",
    contactUrl: "mailto:hello@tunahantayinci.com",
    phone: "+90 555 000 00 00",
    address: "İstanbul, Türkiye",
    skills: [
      "Araştırma & Konsept",
      "Eskiz & Maket",
      "Modelleme & Görselleştirme"
    ],
    stats: [
      { value: "06", label: "Akademik proje" },
      { value: "04", label: "Katıldığım atölye" },
      { value: "08", label: "Kullandığım araç" }
    ],
    socials: [
      { label: "LinkedIn", url: "https://www.linkedin.com/" },
      { label: "Instagram", url: "https://www.instagram.com/" }
    ]
  },
  feedback: [],
  projects: [
    {
      id: "avlu-sanat-merkezi", title: "Avlu Sanat Merkezi", location: "Tasarım Stüdyosu IV", category: "Akademik Proje", year: "2024",
      cover: "assets/courtyard-center.png", color: "#d7cfc0",
      description: "Tasarım Stüdyosu IV kapsamında geliştirilen proje, taşın dinginliği ile ışığın gün boyunca değişen hareketini aynı avluda buluşturmayı araştırıyor.",
      pages: ["assets/courtyard-center.png", "assets/hero-residence.png", "assets/lake-pavilion.png"]
    },
    {
      id: "gol-pavyonu", title: "Göl Pavyonu", location: "Yapı Bilgisi", category: "Stüdyo Çalışması", year: "2025",
      cover: "assets/lake-pavilion.png", color: "#667064",
      description: "Hafif ahşap strüktür ve detay çözümü üzerine yapılan çalışma, göl kıyısında doğanın ritmine eklemlenen bir pavyon öneriyor.",
      pages: ["assets/lake-pavilion.png", "assets/courtyard-center.png", "assets/hero-residence.png"]
    },
    {
      id: "kiyi-evi", title: "Kıyı Evi", location: "Tasarım Stüdyosu V", category: "Akademik Proje", year: "2025",
      cover: "assets/hero-residence.png", color: "#383936",
      description: "Topoğrafya ve barınma ilişkisini inceleyen stüdyo projesi, deniz ile gökyüzü arasındaki sınırı sakin bir yaşam çizgisine dönüştürüyor.",
      pages: ["assets/hero-residence.png", "assets/lake-pavilion.png", "assets/courtyard-center.png"]
    }
  ]
};

function normalizeContent(content) {
  const normalized = structuredClone(content || DEFAULT_CONTENT);
  normalized.settings = { ...DEFAULT_CONTENT.settings, ...(normalized.settings || {}) };
  normalized.settings.contactText = normalized.settings.contactText || "Tanışalım.";
  normalized.settings.contactUrl = normalized.settings.contactUrl || `mailto:${normalized.settings.email}`;
  normalized.settings.socials = Array.isArray(normalized.settings.socials) ? normalized.settings.socials : DEFAULT_CONTENT.settings.socials;
  normalized.settings.skills = Array.isArray(normalized.settings.skills) ? normalized.settings.skills : DEFAULT_CONTENT.settings.skills;
  normalized.settings.stats = Array.isArray(normalized.settings.stats)
    ? normalized.settings.stats.map((item, index) => ({
      value: item.value || DEFAULT_CONTENT.settings.stats[index]?.value || "",
      label: item.label || DEFAULT_CONTENT.settings.stats[index]?.label || ""
    }))
    : DEFAULT_CONTENT.settings.stats;
  const oldHeroItems = Array.isArray(normalized.settings.heroFeaturedProjects) ? normalized.settings.heroFeaturedProjects : [];
  normalized.settings.heroSlides = Array.isArray(normalized.settings.heroSlides)
    ? normalized.settings.heroSlides.slice(0, 3).map((item, index) => ({
      image: item.image || item.src || (index === 0 ? normalized.settings.heroImage : DEFAULT_CONTENT.settings.heroSlides[index]?.image) || DEFAULT_CONTENT.settings.heroImage,
      label: item.label || `Seçili Proje ${String(index + 1).padStart(2, "0")}`,
      title: item.title || ""
    }))
    : DEFAULT_CONTENT.settings.heroSlides.map((slide, index) => ({
      ...slide,
      image: index === 0 ? (normalized.settings.heroImage || slide.image) : slide.image,
      label: oldHeroItems[index]?.label || slide.label,
      title: oldHeroItems[index]?.title || slide.title
    }));
  while (normalized.settings.heroSlides.length < 3) {
    const next = normalized.settings.heroSlides.length;
    normalized.settings.heroSlides.push({
      image: DEFAULT_CONTENT.settings.heroSlides[next]?.image || normalized.settings.heroImage || DEFAULT_CONTENT.settings.heroImage,
      label: `Seçili Proje ${String(next + 1).padStart(2, "0")}`,
      title: ""
    });
  }
  normalized.settings.heroImage = normalized.settings.heroSlides[0]?.image || normalized.settings.heroImage || DEFAULT_CONTENT.settings.heroImage;
  normalized.settings.heroFeaturedProjects = normalized.settings.heroSlides.map(({ label, title }) => ({ label, title }));
  normalized.projects = Array.isArray(normalized.projects) ? normalized.projects : [];
  normalized.feedback = Array.isArray(normalized.feedback)
    ? normalized.feedback.map((item) => ({
      id: item.id || `feedback-${Date.now()}`,
      projectId: item.projectId || "",
      projectTitle: item.projectTitle || "",
      name: item.name || "",
      email: item.email || "",
      message: item.message || "",
      approved: Boolean(item.approved),
      createdAt: item.createdAt || new Date().toISOString()
    })).filter((item) => item.projectId && item.name && item.message)
    : [];
  return normalized;
}

function getLocalContent() {
  try { return normalizeContent(JSON.parse(localStorage.getItem(STORAGE_KEY)) || DEFAULT_CONTENT); }
  catch { return normalizeContent(DEFAULT_CONTENT); }
}

async function getContent() {
  try {
    const response = await fetch("/api/content", { headers: { "Accept": "application/json" } });
    if (response.ok) {
      const content = normalizeContent(await response.json());
      localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
      return content;
    }
  } catch {}
  return getLocalContent();
}

async function saveContent(content) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(content));
  const response = await fetch("/api/content", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(content)
  });
  if (!response.ok) throw new Error("Content could not be saved");
}

function resetContent() {
  localStorage.removeItem(STORAGE_KEY);
}

function imageFileToDataUrl(file, maxSize = 1800, quality = .82) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const img = new Image();
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => { img.src = reader.result; };
    img.onerror = reject;
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/webp", quality));
    };
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file) return resolve("");
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

async function uploadFile(file, prefix = "project") {
  const isPdf = file.type === "application/pdf" || (file.name || "").toLowerCase().endsWith(".pdf");
  if (isPdf) {
    return uploadPdf(file, prefix);
  }
  const endpoint = "/api/media";
  const response = await fetch(`${endpoint}?prefix=${encodeURIComponent(prefix)}&name=${encodeURIComponent(file.name || "file")}`, {
    method: "POST",
    headers: { "Content-Type": isPdf ? "application/pdf" : (file.type || "application/octet-stream"), "X-File-Name": file.name || "file" },
    body: file
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Yükleme başarısız (${response.status})`);
  return result.url;
}

async function uploadPdf(file, prefix = "pages") {
  const response = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      kind: "pdf",
      dataUrl: await fileToDataUrl(file),
      prefix,
      name: file.name || "document.pdf"
    })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Yükleme başarısız (${response.status})`);
  return result.url;
}

async function uploadImage(dataUrl, prefix = "project") {
  const response = await fetch("/api/media", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind: "image", dataUrl, prefix })
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Yükleme başarısız (${response.status})`);
  return result.url;
}
