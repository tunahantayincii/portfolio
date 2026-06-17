let content;
let editingPages = [];
let editingCover = "";
let pendingHero = "";
let editingPageIndex = -1;
let draggedPageIndex = -1;
let draggedProjectIndex = -1;
const $ = (selector) => document.querySelector(selector);

function normalizePage(page) {
  if (typeof page === "string") return { type: "image", src: page, fit: "cover", position: "center", background: "#e8e4da" };
  if (page.type === "text") return {
    type: "text",
    kicker: page.kicker || "",
    title: page.title || "Yeni metin sayfası",
    body: page.body || "",
    background: page.background || "#e8e4da"
  };
  return {
    type: "image",
    src: page.src || page.image || "",
    fit: page.fit === "contain" ? "contain" : "cover",
    position: page.position || "center",
    background: page.background || "#e8e4da"
  };
}

function normalizeUrl(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return "";
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return `mailto:${trimmed}`;
  return `https://${trimmed}`;
}

function getHeroSlides() {
  content.settings.heroSlides = Array.isArray(content.settings.heroSlides) ? content.settings.heroSlides.slice(0, 3) : [];
  while (content.settings.heroSlides.length < 3) {
    const index = content.settings.heroSlides.length;
    content.settings.heroSlides.push({
      image: index === 0 ? (content.settings.heroImage || "assets/hero-residence.png") : "",
      label: `Seçili Proje ${String(index + 1).padStart(2, "0")}`,
      title: ""
    });
  }
  content.settings.heroSlides[0].image = content.settings.heroSlides[0].image || content.settings.heroImage || "assets/hero-residence.png";
  return content.settings.heroSlides;
}

function showPanel() {
  $("#login-screen").classList.add("hidden");
  $("#admin-shell").classList.add("authenticated");
}

async function initializePanel() {
  showPanel();
  content = await getContent();
  fillSettings();
  renderProjects();
}

async function hasActiveSession() {
  try {
    const response = await fetch("/api/auth/session", {
      credentials: "same-origin",
      headers: { "Accept": "application/json" }
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function logout() {
  try { await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }); }
  finally { location.reload(); }
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(event.currentTarget);
  const submitButton = form.querySelector("button[type='submit']");
  $("#login-error").textContent = "Giriş kontrol ediliyor...";
  if (submitButton) submitButton.disabled = true;
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: data.get("username").trim(), password: data.get("password") })
    });
    const sessionActive = await hasActiveSession();
    if (!response.ok && !sessionActive) throw new Error("invalid");
    if (response.ok && !sessionActive) throw new Error("session");
    form.reset();
    $("#login-error").textContent = "";
    try {
      await initializePanel();
    } catch {
      $("#login-error").textContent = "Giriş başarılı, ancak panel içeriği yüklenemedi. Sayfayı yenileyin.";
    }
    return;
  } catch (error) {
    $("#login-error").textContent = error.message === "session"
      ? "Giriş yapıldı ama oturum doğrulanamadı. Sayfayı yenileyip tekrar deneyin."
      : "Kullanıcı adı veya şifre yanlış.";
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

$("#logout-button").addEventListener("click", logout);

document.addEventListener("mousedown", (event) => {
  if (event.target.closest(".format-toolbar button")) event.preventDefault();
});

document.addEventListener("click", (event) => {
  const button = event.target.closest(".format-toolbar button");
  if (!button) return;
  if (!isPointerInsideElement(event, button)) return;
  event.preventDefault();
  event.stopPropagation();
  const toolbar = button.closest(".format-toolbar");
  applyTextFormat(getFormatTarget(toolbar.dataset.formatFor), button);
});

function status(message, error = false) {
  const node = $("#save-status");
  node.textContent = message;
  node.style.color = error ? "#9c3030" : "#667700";
}

function getFormatTarget(target) {
  return document.getElementById(target) || document.querySelector(`[name="${target}"]`);
}

function isPointerInsideElement(event, element) {
  if (!event.clientX && !event.clientY) return true;
  const rect = element.getBoundingClientRect();
  return event.clientX >= rect.left
    && event.clientX <= rect.right
    && event.clientY >= rect.top
    && event.clientY <= rect.bottom;
}

function applyTextFormat(textarea, button) {
  if (!textarea) return;
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? start;
  const selected = textarea.value.slice(start, end);
  let replacement = "";
  let selectionStart = start;
  let selectionEnd = start;

  if (button.dataset.formatTag) {
    if (!selected) {
      textarea.focus();
      status("Önce biçimlendirmek istediğiniz kelimeyi seçin.", true);
      return;
    }
    const tag = button.dataset.formatTag;
    const text = selected;
    replacement = `<${tag}>${text}</${tag}>`;
    selectionStart = start + tag.length + 2;
    selectionEnd = selectionStart + text.length;
  } else if (button.dataset.formatInsert === "br") {
    replacement = selected ? `${selected}<br>` : "<br>";
    selectionStart = start + replacement.length;
    selectionEnd = selectionStart;
  }

  textarea.focus();
  textarea.setRangeText(replacement, start, end, "end");
  textarea.setSelectionRange(selectionStart, selectionEnd);
  status("Biçim uygulandı. Kaydetmeyi unutmayın.");
}

async function persist(message = "Kaydedildi") {
  try {
    await saveContent(content);
    status(message);
    return true;
  } catch (error) {
    status("İçerik sunucuya kaydedilemedi. Bağlantıyı ve kurulumu kontrol edin.", true);
    return false;
  }
}

function fillSettings() {
  const form = $("#settings-form");
  Object.entries(content.settings).forEach(([key, value]) => {
    if (form.elements[key]) form.elements[key].value = value;
  });
  pendingHero = getHeroSlides()[0].image;
  $("#hero-preview").src = pendingHero;
  renderSocialFields();
  renderSkillFields();
  renderStatsFields();
  renderHeroFeaturedFields();
}

function renderHeroFeaturedFields() {
  const list = $("#hero-featured-list");
  const items = getHeroSlides();
  list.innerHTML = items.map((item, index) => `
    <div class="hero-featured-row">
      <label>Sıra / etiket ${index + 1}<input data-hero-featured-label="${index}" value="${item.label || ""}" placeholder="Seçili Proje 01"></label>
      <label>Proje adı ${index + 1}<input data-hero-featured-title="${index}" value="${item.title || ""}" placeholder="Mazı Konutu / 2023"></label>
      <label class="hero-slide-upload">Görsel ${index + 1}<input data-hero-slide-upload="${index}" type="file" accept="image/*"><span>Görsel seç</span><img src="${item.image || ""}" alt=""></label>
    </div>`).join("");
  document.querySelectorAll("[data-hero-slide-upload]").forEach((input) => input.addEventListener("change", async (event) => {
    const index = Number(event.currentTarget.dataset.heroSlideUpload);
    try {
      status(`${index + 1}. hero görseli yükleniyor...`);
      const dataUrl = await imageFileToDataUrl(event.currentTarget.files[0], 2000);
      const slides = getHeroSlides();
      slides[index].image = await uploadImage(dataUrl, "hero");
      if (index === 0) {
        pendingHero = slides[index].image;
        $("#hero-preview").src = pendingHero;
      }
      renderHeroFeaturedFields();
      status("Hero görseli hazır. Genel içeriği kaydetmeyi unutmayın.");
    } catch (error) {
      status(error.message || "Hero görseli yüklenemedi", true);
    }
  }));
}

function collectHeroFeaturedFields() {
  const previousSlides = getHeroSlides();
  content.settings.heroSlides = [0, 1, 2].map((index) => ({
    image: previousSlides[index]?.image || (index === 0 ? pendingHero : "") || "assets/hero-residence.png",
    label: document.querySelector(`[data-hero-featured-label="${index}"]`)?.value.trim() || `Seçili Proje ${String(index + 1).padStart(2, "0")}`,
    title: document.querySelector(`[data-hero-featured-title="${index}"]`)?.value.trim() || ""
  }));
  content.settings.heroImage = content.settings.heroSlides[0].image;
  content.settings.heroFeaturedProjects = content.settings.heroSlides.map(({ label, title }) => ({ label, title }));
}

function renderSkillFields() {
  const list = $("#skill-list-editor");
  const skills = Array.isArray(content.settings.skills) ? content.settings.skills : [];
  list.innerHTML = skills.map((skill, index) => `
    <div class="skill-row">
      <label>Başlık ${String(index + 1).padStart(2, "0")}<input data-skill-index="${index}" value="${skill || ""}" placeholder="Örn. Modelleme & Görselleştirme"></label>
      <button type="button" data-remove-skill="${index}">Sil</button>
    </div>`).join("");
  document.querySelectorAll("[data-remove-skill]").forEach((button) => button.addEventListener("click", () => {
    content.settings.skills.splice(Number(button.dataset.removeSkill), 1);
    renderSkillFields();
    status("Başlık kaldırıldı. Kaydetmeyi unutmayın.");
  }));
}

function collectSkillFields() {
  content.settings.skills = [...document.querySelectorAll("[data-skill-index]")]
    .map((input) => input.value.trim())
    .filter(Boolean);
}

function renderStatsFields() {
  const list = $("#stats-list-editor");
  const defaults = [
    { value: "06", label: "Akademik proje" },
    { value: "04", label: "Katıldığım atölye" },
    { value: "08", label: "Kullandığım araç" }
  ];
  const stats = Array.isArray(content.settings.stats) ? content.settings.stats : defaults;
  content.settings.stats = stats;
  list.innerHTML = stats.map((stat, index) => `
    <div class="stat-row">
      <label>Sayı ${String(index + 1).padStart(2, "0")}<input data-stat-value="${index}" value="${stat.value || ""}" placeholder="06"></label>
      <label>Açıklama ${String(index + 1).padStart(2, "0")}<input data-stat-label="${index}" value="${stat.label || ""}" placeholder="Akademik proje"></label>
      <button type="button" data-remove-stat="${index}">Sil</button>
    </div>`).join("");
  document.querySelectorAll("[data-remove-stat]").forEach((button) => button.addEventListener("click", () => {
    content.settings.stats.splice(Number(button.dataset.removeStat), 1);
    renderStatsFields();
    status("İstatistik kaldırıldı. Kaydetmeyi unutmayın.");
  }));
}

function collectStatsFields() {
  content.settings.stats = [...document.querySelectorAll(".stat-row")].map((row) => ({
    value: row.querySelector("[data-stat-value]")?.value.trim() || "",
    label: row.querySelector("[data-stat-label]")?.value.trim() || ""
  })).filter((item) => item.value || item.label);
}

function renderSocialFields() {
  const list = $("#social-list");
  const socials = Array.isArray(content.settings.socials) ? content.settings.socials : [];
  list.innerHTML = socials.map((social, index) => `
    <div class="social-row">
      <label>Başlık<input data-social-label="${index}" value="${social.label || ""}" placeholder="LinkedIn"></label>
      <label>Link<input data-social-url="${index}" value="${social.url || ""}" placeholder="https://..."></label>
      <button type="button" data-remove-social="${index}">Sil</button>
    </div>`).join("");
  document.querySelectorAll("[data-remove-social]").forEach((button) => button.addEventListener("click", () => {
    content.settings.socials.splice(Number(button.dataset.removeSocial), 1);
    renderSocialFields();
    status("Sosyal link kaldırıldı. Kaydetmeyi unutmayın.");
  }));
}

function collectSocialFields() {
  content.settings.socials = [...document.querySelectorAll(".social-row")].map((row) => {
    const label = row.querySelector("[data-social-label]").value.trim();
    const url = normalizeUrl(row.querySelector("[data-social-url]").value);
    return { label, url };
  }).filter((item) => item.label && item.url);
}

async function saveProjectOrder(message = "Proje sırası kaydedildi") {
  renderProjects();
  await persist(message);
}

function renderProjects() {
  const container = $("#admin-projects");
  container.innerHTML = "";
  content.projects.forEach((project, index) => {
    const card = document.createElement("article");
    card.className = "admin-project";
    card.draggable = true;
    card.dataset.projectIndex = index;
    card.innerHTML = `<img src="${project.cover}" alt=""><strong>${project.title}</strong><small>${project.location} · ${project.year} · ${(project.pages || []).length} sayfa</small>`;
    card.insertAdjacentHTML("beforeend", `
      <div class="project-order-actions">
        <span>Sıra ${String(index + 1).padStart(2, "0")}</span>
        <button type="button" data-move-project="${index}" data-direction="-1" ${index === 0 ? "disabled" : ""}>← Öne al</button>
        <button type="button" data-move-project="${index}" data-direction="1" ${index === content.projects.length - 1 ? "disabled" : ""}>Arkaya al →</button>
      </div>`);
    card.addEventListener("click", (event) => {
      if (event.target.closest(".project-order-actions")) return;
      openEditor(project.id);
    });
    container.appendChild(card);
  });
  document.querySelectorAll("[data-move-project]").forEach((button) => button.addEventListener("click", async () => {
    const from = Number(button.dataset.moveProject);
    const to = from + Number(button.dataset.direction);
    if (to < 0 || to >= content.projects.length) return;
    [content.projects[from], content.projects[to]] = [content.projects[to], content.projects[from]];
    await saveProjectOrder();
  }));
  document.querySelectorAll(".admin-project").forEach((card) => {
    card.addEventListener("dragstart", () => {
      draggedProjectIndex = Number(card.dataset.projectIndex);
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      draggedProjectIndex = -1;
      document.querySelectorAll(".admin-project").forEach((item) => item.classList.remove("dragging", "drag-over"));
    });
    card.addEventListener("dragover", (event) => { event.preventDefault(); card.classList.add("drag-over"); });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", async (event) => {
      event.preventDefault();
      const targetIndex = Number(card.dataset.projectIndex);
      if (draggedProjectIndex < 0 || draggedProjectIndex === targetIndex) return;
      const [moved] = content.projects.splice(draggedProjectIndex, 1);
      content.projects.splice(targetIndex, 0, moved);
      draggedProjectIndex = -1;
      await saveProjectOrder();
    });
  });
}

function renderPagePreviews() {
  $("#page-previews").innerHTML = editingPages.map((page, index) => `
    <div class="page-preview" draggable="true" data-page-index="${index}">
      ${page.type === "text" ? `
        <div class="page-preview-visual text-page-preview" style="--page-bg:${page.background}">
          <span class="page-preview-number">${index + 1}</span>
          <small>${page.kicker || "Metin sayfası"}</small>
          <strong>${page.title || "Başlıksız"}</strong>
          <p>${page.body || ""}</p>
        </div>` : `
        <div class="page-preview-visual" style="--page-bg:${page.background};--page-fit:${page.fit};--page-position:${page.position}">
          <img src="${page.src}" alt="Sayfa ${index + 1}"><span class="page-preview-number">${index + 1}</span>
        </div>`}
      <div class="page-preview-actions"><button type="button" data-move-page="${index}" data-direction="-1" aria-label="Sola taşı">←</button><button type="button" data-edit-page="${index}">${page.type === "text" ? "Metin" : "Yerleşim"}</button><button type="button" data-move-page="${index}" data-direction="1" aria-label="Sağa taşı">→</button><button class="remove-page" type="button" data-remove-page="${index}">Sil</button></div>
    </div>`).join("");
  document.querySelectorAll("[data-remove-page]").forEach((button) => button.addEventListener("click", () => {
    editingPages.splice(Number(button.dataset.removePage), 1);
    renderPagePreviews();
  }));
  document.querySelectorAll("[data-edit-page]").forEach((button) => button.addEventListener("click", () => openPageSettings(Number(button.dataset.editPage))));
  document.querySelectorAll("[data-move-page]").forEach((button) => button.addEventListener("click", () => {
    const from = Number(button.dataset.movePage);
    const to = from + Number(button.dataset.direction);
    if (to < 0 || to >= editingPages.length) return;
    [editingPages[from], editingPages[to]] = [editingPages[to], editingPages[from]];
    renderPagePreviews();
  }));
  document.querySelectorAll(".page-preview").forEach((card) => {
    card.addEventListener("dragstart", () => {
      draggedPageIndex = Number(card.dataset.pageIndex);
      card.classList.add("dragging");
    });
    card.addEventListener("dragend", () => {
      draggedPageIndex = -1;
      document.querySelectorAll(".page-preview").forEach((item) => item.classList.remove("dragging", "drag-over"));
    });
    card.addEventListener("dragover", (event) => { event.preventDefault(); card.classList.add("drag-over"); });
    card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
    card.addEventListener("drop", (event) => {
      event.preventDefault();
      const targetIndex = Number(card.dataset.pageIndex);
      if (draggedPageIndex < 0 || draggedPageIndex === targetIndex) return;
      const [moved] = editingPages.splice(draggedPageIndex, 1);
      editingPages.splice(targetIndex, 0, moved);
      renderPagePreviews();
    });
  });
}

function updateLayoutPreview() {
  const preview = $("#layout-preview");
  const image = $("#layout-preview-image");
  preview.style.background = $("#page-background").value;
  image.style.objectFit = $("#page-fit").value;
  image.style.objectPosition = $("#page-position").value;
}

function openPageSettings(index) {
  editingPageIndex = index;
  const page = editingPages[index];
  if (page.type === "text") {
    openTextPageSettings(index);
    return;
  }
  $("#layout-preview-image").src = page.src;
  $("#page-fit").value = page.fit;
  $("#page-position").value = page.position;
  $("#page-background").value = page.background;
  updateLayoutPreview();
  $("#page-settings").showModal();
}

function openTextPageSettings(index) {
  editingPageIndex = index;
  const page = editingPages[index];
  $("#text-page-kicker").value = page.kicker || "";
  $("#text-page-title").value = page.title || "";
  $("#text-page-body").value = page.body || "";
  $("#text-page-background").value = page.background || "#e8e4da";
  $("#text-page-settings").showModal();
}

function openEditor(id = "") {
  const project = content.projects.find((item) => item.id === id) || {
    id: `proje-${Date.now()}`, title: "", year: new Date().getFullYear().toString(), location: "", category: "", color: "#555555", description: "", cover: "assets/hero-residence.png", pages: []
  };
  const form = $("#project-form");
  ["id", "title", "year", "location", "category", "color", "description"].forEach((field) => { form.elements[field].value = project[field]; });
  editingCover = project.cover;
  editingPages = (project.pages || []).map(normalizePage);
  $("#cover-preview").src = editingCover;
  $("#delete-project").style.visibility = id ? "visible" : "hidden";
  renderPagePreviews();
  $("#project-editor").showModal();
}

document.querySelectorAll("aside nav button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("aside nav button,.panel").forEach((node) => node.classList.remove("active"));
  button.classList.add("active");
  $(`#${button.dataset.tab}`).classList.add("active");
  $("#panel-title").textContent = button.textContent;
}));

$("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  Object.keys(content.settings).forEach((key) => {
    if (key !== "heroImage" && key !== "heroSlides" && key !== "socials" && key !== "skills" && key !== "stats" && key !== "heroFeaturedProjects" && data.has(key)) content.settings[key] = data.get(key).trim();
  });
  getHeroSlides()[0].image = pendingHero;
  collectHeroFeaturedFields();
  content.settings.contactUrl = normalizeUrl(content.settings.contactUrl || content.settings.email);
  collectSkillFields();
  collectStatsFields();
  collectSocialFields();
  await persist("Genel içerik kaydedildi");
});

$("#hero-upload").addEventListener("change", async (event) => {
  try {
    status("Görsel yükleniyor...");
    const dataUrl = await imageFileToDataUrl(event.target.files[0], 2000);
    pendingHero = await uploadImage(dataUrl, "hero");
    getHeroSlides()[0].image = pendingHero;
    $("#hero-preview").src = pendingHero;
    renderHeroFeaturedFields();
    status("Kaydetmeye hazır");
  } catch (error) { status(error.message || "Görsel yüklenemedi", true); }
});

$("#cover-upload").addEventListener("change", async (event) => {
  try {
    status("Kapak yükleniyor...");
    const dataUrl = await imageFileToDataUrl(event.target.files[0], 1500);
    editingCover = await uploadImage(dataUrl, "covers");
    $("#cover-preview").src = editingCover;
    status("Kaydetmeye hazır");
  } catch (error) { status(error.message || "Kapak yüklenemedi", true); }
});

$("#pages-upload").addEventListener("change", async (event) => {
  status("Sayfalar hazırlanıyor...");
  try {
    const dataUrls = await Promise.all([...event.target.files].map((file) => imageFileToDataUrl(file, 1800)));
    const newPages = [];
    for (const dataUrl of dataUrls) newPages.push(normalizePage(await uploadImage(dataUrl, "pages")));
    editingPages.push(...newPages);
    renderPagePreviews();
    status("Kaydetmeye hazır");
    event.target.value = "";
  } catch (error) { status(error.message || "Sayfalardan biri yüklenemedi", true); }
});

$("#project-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const project = Object.fromEntries(["id", "title", "year", "location", "category", "color", "description"].map((key) => [key, data.get(key).trim()]));
  project.cover = editingCover;
  project.pages = [...editingPages];
  const index = content.projects.findIndex((item) => item.id === project.id);
  if (index >= 0) content.projects[index] = project;
  else content.projects.push(project);
  if (await persist("Proje kaydedildi")) {
    renderProjects();
    $("#project-editor").close();
  }
});

$("#add-project").addEventListener("click", () => openEditor());
$("#add-text-page").addEventListener("click", () => {
  editingPages.push(normalizePage({
    type: "text",
    kicker: "Not",
    title: "Yeni metin sayfası",
    body: "",
    background: "#e8e4da"
  }));
  renderPagePreviews();
  status("Metin sayfası eklendi. Projeyi kaydetmeyi unutmayın.");
});
$("#add-social").addEventListener("click", () => {
  content.settings.socials = Array.isArray(content.settings.socials) ? content.settings.socials : [];
  content.settings.socials.push({ label: "", url: "" });
  renderSocialFields();
});
$("#add-skill").addEventListener("click", () => {
  content.settings.skills = Array.isArray(content.settings.skills) ? content.settings.skills : [];
  content.settings.skills.push("");
  renderSkillFields();
});
$("#add-stat").addEventListener("click", () => {
  content.settings.stats = Array.isArray(content.settings.stats) ? content.settings.stats : [];
  content.settings.stats.push({ value: "", label: "" });
  renderStatsFields();
  status("Yeni istatistik eklendi. Kaydetmeyi unutmayın.");
});
$("#close-editor").addEventListener("click", () => $("#project-editor").close());
$("#delete-project").addEventListener("click", async () => {
  const id = $("#project-form").elements.id.value;
  if (!confirm("Bu proje kalıcı olarak silinsin mi?")) return;
  content.projects = content.projects.filter((project) => project.id !== id);
  await persist("Proje silindi");
  renderProjects();
  $("#project-editor").close();
});

$("#export-data").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(content)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `tunahan-tayinci-portfolio-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
});

$("#import-data").addEventListener("change", async (event) => {
  try {
    const imported = JSON.parse(await event.target.files[0].text());
    if (!imported.settings || !Array.isArray(imported.projects)) throw new Error();
    content = imported;
    if (await persist("Yedek geri yüklendi")) { fillSettings(); renderProjects(); }
  } catch { status("Geçersiz yedek dosyası", true); }
});

$("#reset-data").addEventListener("click", async () => {
  if (!confirm("Tüm düzenlemeler silinip ilk içeriğe dönülsün mü?")) return;
  resetContent();
  content = structuredClone(DEFAULT_CONTENT);
  await persist("İçerik sıfırlandı");
  fillSettings();
  renderProjects();
});

async function checkSession() {
  try {
    if (await hasActiveSession()) await initializePanel();
  } catch {
    $("#login-error").textContent = "Güvenli giriş servisine ulaşılamadı.";
  }
}

checkSession();

["page-fit", "page-position", "page-background"].forEach((id) => $(`#${id}`).addEventListener("input", updateLayoutPreview));
$("#close-page-settings").addEventListener("click", () => $("#page-settings").close());
$("#save-page-settings").addEventListener("click", () => {
  if (editingPageIndex < 0) return;
  editingPages[editingPageIndex] = {
    ...editingPages[editingPageIndex],
    fit: $("#page-fit").value,
    position: $("#page-position").value,
    background: $("#page-background").value
  };
  renderPagePreviews();
  $("#page-settings").close();
  status("Sayfa yerleşimi güncellendi. Projeyi kaydetmeyi unutmayın.");
});
$("#close-text-page-settings").addEventListener("click", () => $("#text-page-settings").close());
$("#save-text-page-settings").addEventListener("click", () => {
  if (editingPageIndex < 0) return;
  editingPages[editingPageIndex] = normalizePage({
    type: "text",
    kicker: $("#text-page-kicker").value.trim(),
    title: $("#text-page-title").value.trim() || "Metin sayfası",
    body: $("#text-page-body").value.trim(),
    background: $("#text-page-background").value
  });
  renderPagePreviews();
  $("#text-page-settings").close();
  status("Metin sayfası güncellendi. Projeyi kaydetmeyi unutmayın.");
});

$("#close-media-library").addEventListener("click", () => $("#media-library").close());
$("#open-media-library").addEventListener("click", async () => {
  const grid = $("#media-grid");
  grid.innerHTML = "<p>Medya havuzu yükleniyor...</p>";
  $("#media-library").showModal();
  try {
    const response = await fetch("/api/media");
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Medya havuzu yüklenemedi");
    grid.innerHTML = result.items.length ? result.items.map((item, index) => `
      <button class="media-item" type="button" data-media-index="${index}"><img src="${item.url}" alt=""><span>${item.prefix}</span></button>`).join("") : "<p>Henüz yüklenmiş görsel yok.</p>";
    document.querySelectorAll("[data-media-index]").forEach((button) => button.addEventListener("click", () => {
      editingPages.push(normalizePage(result.items[Number(button.dataset.mediaIndex)].url));
      renderPagePreviews();
      status("Görsel kitap sayfalarına eklendi");
    }));
  } catch (error) {
    grid.innerHTML = `<p>${error.message}</p>`;
  }
});
