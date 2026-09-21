let content;
let editingPages = [];
let editingCover = "";
let pendingHero = "";
let editingPageIndex = -1;
let draggedPageIndex = -1;
let draggedProjectIndex = -1;
let saveQueue = Promise.resolve();
let contentRevision = 0;
let hasUnsavedChanges = false;
const PROJECT_DESCRIPTION_LIMIT = 500;
const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));

function normalizePage(page) {
  if (typeof page === "string") return { type: "image", src: page, fit: "cover", position: "center", background: "#e8e4da" };
  if (page.type === "text") return {
    type: "text",
    kicker: page.kicker || "",
    title: page.title || "Yeni metin sayfası",
    body: page.body || "",
    background: page.background || "#e8e4da"
  };
  if (page.type === "pdf") return {
    type: "pdf",
    src: page.src || page.url || "",
    title: page.title || "PDF sayfası",
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
  content = await getContent();
  fillSettings();
  renderProjects();
  renderFeedbackAdmin();
  updateAdminCounts();
  hasUnsavedChanges = false;
  showPanel();
  status("Hazır", "neutral");
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
    const result = await response.json().catch(() => ({}));
    if (response.status === 429) {
      const minutes = Math.max(1, Math.ceil((result.retryAfterSeconds || 900) / 60));
      throw new Error(`lock:${minutes}`);
    }
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
    if (error.message?.startsWith("lock:")) {
      const minutes = error.message.split(":")[1] || "15";
      $("#login-error").textContent = `7 yanlış deneme yapıldı. Lütfen yaklaşık ${minutes} dakika sonra tekrar deneyin.`;
    } else {
      $("#login-error").textContent = error.message === "session"
        ? "Giriş yapıldı ama oturum doğrulanamadı. Sayfayı yenileyip tekrar deneyin."
        : "Kullanıcı adı veya şifre yanlış. 7 yanlış denemeden sonra 15 dakika bekleme uygulanır.";
    }
  } finally {
    if (submitButton) submitButton.disabled = false;
  }
});

async function openMediaLibrary() {
  const grid = $("#media-grid");
  grid.innerHTML = '<p class="media-state">Medya havuzu yükleniyor...</p>';
  $("#media-library").showModal();
  try {
    const response = await fetch("/api/media", { credentials: "same-origin", headers: { "Accept": "application/json" } });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Medya havuzu yüklenemedi");
    grid.innerHTML = result.items.length ? result.items.map((item, index) => {
      const isPdf = item.url.toLowerCase().endsWith(".pdf");
      return `<button class="media-item ${isPdf ? "pdf-media-item" : ""}" type="button" data-media-index="${index}">${isPdf ? "<strong>PDF</strong>" : `<img src="${escapeHtml(item.url)}" alt="" loading="lazy">`}<span>${escapeHtml(item.prefix)}</span></button>`;
    }).join("") : '<p class="media-state">Henüz yüklenmiş medya yok.</p>';
    grid.querySelectorAll("[data-media-index]").forEach((button) => button.addEventListener("click", () => {
      const item = result.items[Number(button.dataset.mediaIndex)];
      editingPages.push(normalizePage(item.url.toLowerCase().endsWith(".pdf") ? { type: "pdf", src: item.url, title: item.name } : item.url));
      renderPagePreviews();
      markDirty("Medya kitap sayfalarına eklendi. Projeyi kaydedin.");
    }));
  } catch (error) {
    grid.innerHTML = `<p class="media-state error">${escapeHtml(error.message)}</p>`;
  }
}

$("#open-media-library").addEventListener("click", openMediaLibrary);

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

function status(message, state = "success") {
  const node = $("#save-status");
  const resolvedState = state === true ? "error" : state;
  node.textContent = message;
  node.classList.remove("status-saving", "status-success", "status-error", "status-neutral");
  node.classList.add(`status-${resolvedState}`);
}

function markDirty(message = "Kaydedilmemiş değişiklikler") {
  contentRevision += 1;
  hasUnsavedChanges = true;
  status(message, "neutral");
}

function setBusy(control, busy, busyText = "İşleniyor...") {
  if (!control) return;
  if (busy) {
    control.dataset.idleText = control.textContent;
    control.textContent = busyText;
  } else if (control.dataset.idleText) {
    control.textContent = control.dataset.idleText;
    delete control.dataset.idleText;
  }
  control.disabled = busy;
  control.setAttribute("aria-busy", String(busy));
}

function updateAdminCounts() {
  const projectCount = $("#project-count");
  const feedbackCount = $("#feedback-count");
  if (projectCount) projectCount.textContent = String(content?.projects?.length || 0);
  if (feedbackCount) feedbackCount.textContent = String((content?.feedback || []).filter((item) => !item.approved).length);
}

function updateDescriptionCount() {
  const textarea = $("#project-description");
  const counter = $("#description-count");
  const limitText = counter?.closest(".character-limit");
  if (!textarea || !counter || !limitText) return;
  const length = textarea.value.length;
  counter.textContent = length;
  limitText.classList.toggle("limit-near", length >= PROJECT_DESCRIPTION_LIMIT * .9 && length < PROJECT_DESCRIPTION_LIMIT);
  limitText.classList.toggle("limit-full", length >= PROJECT_DESCRIPTION_LIMIT);
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
  if (textarea.name && content?.settings && Object.prototype.hasOwnProperty.call(content.settings, textarea.name)) {
    content.settings[textarea.name] = textarea.value;
  }
  markDirty("Biçim uygulandı. Kaydetmeyi unutmayın.");
}

async function persist(message = "Kaydedildi") {
  const revisionAtStart = contentRevision;
  const snapshot = normalizeContent(JSON.parse(JSON.stringify(content)));
  status("Kaydediliyor...", "saving");
  const operation = saveQueue.catch(() => {}).then(() => saveContent(snapshot));
  saveQueue = operation;
  try {
    await operation;
    if (revisionAtStart === contentRevision) {
      hasUnsavedChanges = false;
      status(message, "success");
    }
    return true;
  } catch (error) {
    status("İçerik sunucuya kaydedilemedi. Bağlantıyı kontrol edin.", "error");
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
      <label>Sıra / etiket ${index + 1}<input data-hero-featured-label="${index}" value="${escapeHtml(item.label)}" placeholder="Seçili Proje 01"></label>
      <label>Proje adı ${index + 1}<input data-hero-featured-title="${index}" value="${escapeHtml(item.title)}" placeholder="Mazı Konutu / 2023"></label>
      <label class="hero-slide-upload">Görsel ${index + 1}<input data-hero-slide-upload="${index}" type="file" accept="image/*"><span>Görsel seç</span><img src="${escapeHtml(item.image)}" alt="" loading="lazy"></label>
    </div>`).join("");
  document.querySelectorAll("[data-hero-slide-upload]").forEach((input) => input.addEventListener("change", async (event) => {
    const fileInput = event.currentTarget;
    const index = Number(fileInput.dataset.heroSlideUpload);
    const selectedFile = fileInput.files[0];
    if (!selectedFile) return;
    fileInput.disabled = true;
    try {
      status(`${index + 1}. hero görseli yükleniyor...`, "saving");
      const dataUrl = await imageFileToDataUrl(selectedFile, 2000);
      const slides = getHeroSlides();
      slides[index].image = await uploadImage(dataUrl, "hero");
      if (index === 0) {
        pendingHero = slides[index].image;
        $("#hero-preview").src = pendingHero;
      }
      renderHeroFeaturedFields();
      markDirty("Hero görseli hazır. Genel içeriği kaydedin.");
    } catch (error) {
      status(error.message || "Hero görseli yüklenemedi", true);
    } finally {
      if (fileInput.isConnected) { fileInput.disabled = false; fileInput.value = ""; }
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
      <label>Başlık ${String(index + 1).padStart(2, "0")}<input data-skill-index="${index}" value="${escapeHtml(skill)}" placeholder="Örn. Modelleme & Görselleştirme"></label>
      <button type="button" data-remove-skill="${index}">Sil</button>
    </div>`).join("");
  document.querySelectorAll("[data-remove-skill]").forEach((button) => button.addEventListener("click", () => {
    content.settings.skills.splice(Number(button.dataset.removeSkill), 1);
    renderSkillFields();
    markDirty("Başlık kaldırıldı. Kaydetmeyi unutmayın.");
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
      <label>Sayı ${String(index + 1).padStart(2, "0")}<input data-stat-value="${index}" value="${escapeHtml(stat.value)}" placeholder="06"></label>
      <label>Açıklama ${String(index + 1).padStart(2, "0")}<input data-stat-label="${index}" value="${escapeHtml(stat.label)}" placeholder="Akademik proje"></label>
      <button type="button" data-remove-stat="${index}">Sil</button>
    </div>`).join("");
  document.querySelectorAll("[data-remove-stat]").forEach((button) => button.addEventListener("click", () => {
    content.settings.stats.splice(Number(button.dataset.removeStat), 1);
    renderStatsFields();
    markDirty("İstatistik kaldırıldı. Kaydetmeyi unutmayın.");
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
      <label>Başlık<input data-social-label="${index}" value="${escapeHtml(social.label)}" placeholder="LinkedIn"></label>
      <label>Link<input data-social-url="${index}" value="${escapeHtml(social.url)}" placeholder="https://..."></label>
      <button type="button" data-remove-social="${index}">Sil</button>
    </div>`).join("");
  document.querySelectorAll("[data-remove-social]").forEach((button) => button.addEventListener("click", () => {
    content.settings.socials.splice(Number(button.dataset.removeSocial), 1);
    renderSocialFields();
    markDirty("Sosyal link kaldırıldı. Kaydetmeyi unutmayın.");
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
  markDirty();
  return persist(message);
}

function renderProjects() {
  const container = $("#admin-projects");
  container.innerHTML = "";
  if (!content.projects.length) {
    container.innerHTML = '<div class="admin-empty"><strong>Henüz proje yok.</strong><span>İlk proje kitabınızı “Yeni proje” düğmesiyle ekleyin.</span></div>';
    updateAdminCounts();
    return;
  }
  content.projects.forEach((project, index) => {
    const card = document.createElement("article");
    card.className = "admin-project";
    card.draggable = true;
    card.dataset.projectIndex = index;
    card.innerHTML = `<img src="${escapeHtml(project.cover)}" alt="" loading="lazy"><strong>${escapeHtml(project.title)}</strong><small>${escapeHtml(project.location)} · ${escapeHtml(project.year)} · ${(project.pages || []).length} sayfa</small>`;
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
    const previousOrder = [...content.projects];
    [content.projects[from], content.projects[to]] = [content.projects[to], content.projects[from]];
    if (!await saveProjectOrder()) {
      content.projects = previousOrder;
      renderProjects();
    }
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
      const previousOrder = [...content.projects];
      const [moved] = content.projects.splice(draggedProjectIndex, 1);
      content.projects.splice(targetIndex, 0, moved);
      draggedProjectIndex = -1;
      if (!await saveProjectOrder()) {
        content.projects = previousOrder;
        renderProjects();
      }
    });
  });
  updateAdminCounts();
}

function renderFeedbackAdmin() {
  const container = $("#feedback-admin-list");
  if (!container) return;
  const feedback = Array.isArray(content.feedback) ? content.feedback : [];
  if (!feedback.length) {
    container.innerHTML = `<div class="feedback-admin-empty">Henüz geri bildirim yok.</div>`;
    updateAdminCounts();
    return;
  }
  container.innerHTML = feedback.map((item, index) => {
    const date = item.createdAt ? new Date(item.createdAt).toLocaleDateString("tr-TR") : "";
    const project = content.projects.find((projectItem) => projectItem.id === item.projectId);
    return `
      <article class="feedback-admin-card ${item.approved ? "approved" : "pending"}">
        <div>
          <span>${item.approved ? "Yayında" : "Onay bekliyor"}</span>
          <h2>${escapeHtml(item.projectTitle || project?.title || "Proje")}</h2>
          <p>${escapeHtml(item.message)}</p>
          <small>${escapeHtml(item.name)}${item.email ? ` · ${escapeHtml(item.email)}` : ""}${date ? ` · ${date}` : ""}</small>
        </div>
        <div class="feedback-admin-actions">
          <button type="button" data-toggle-feedback="${index}">${item.approved ? "Yayından kaldır" : "Onayla"}</button>
          <button class="danger-action" type="button" data-delete-feedback="${index}">Sil</button>
        </div>
      </article>`;
  }).join("");
  document.querySelectorAll("[data-toggle-feedback]").forEach((button) => button.addEventListener("click", async () => {
    const index = Number(button.dataset.toggleFeedback);
    const previousValue = content.feedback[index].approved;
    content.feedback[index].approved = !content.feedback[index].approved;
    renderFeedbackAdmin();
    markDirty();
    if (!await persist(content.feedback[index].approved ? "Geri bildirim yayına alındı" : "Geri bildirim yayından kaldırıldı")) {
      content.feedback[index].approved = previousValue;
      renderFeedbackAdmin();
    }
  }));
  document.querySelectorAll("[data-delete-feedback]").forEach((button) => button.addEventListener("click", async () => {
    const index = Number(button.dataset.deleteFeedback);
    if (!confirm("Bu geri bildirim silinsin mi?")) return;
    const [removedFeedback] = content.feedback.splice(index, 1);
    renderFeedbackAdmin();
    markDirty();
    if (!await persist("Geri bildirim silindi")) {
      content.feedback.splice(index, 0, removedFeedback);
      renderFeedbackAdmin();
    }
  }));
  updateAdminCounts();
}

function renderPagePreviews() {
  $("#page-previews").innerHTML = editingPages.map((page, index) => `
    <div class="page-preview" draggable="true" data-page-index="${index}">
      ${page.type === "text" ? `
        <div class="page-preview-visual text-page-preview" style="--page-bg:${page.background}">
          <span class="page-preview-number">${index + 1}</span>
          <small>${escapeHtml(page.kicker || "Metin sayfası")}</small>
          <strong>${escapeHtml(page.title || "Başlıksız")}</strong>
          <p>${page.body || ""}</p>
        </div>` : page.type === "pdf" ? `
        <div class="page-preview-visual pdf-page-preview" style="--page-bg:${page.background || "#e8e4da"}">
          <span class="page-preview-number">${index + 1}</span>
          <div class="pdf-placeholder" aria-label="${escapeHtml(page.title || "PDF sayfası")}">
            <strong>PDF</strong>
            <small>${escapeHtml(page.title || "PDF sayfası")}</small>
          </div>
        </div>` : `
        <div class="page-preview-visual" style="--page-bg:${page.background};--page-fit:${page.fit};--page-position:${page.position}">
          <img src="${escapeHtml(page.src)}" alt="Sayfa ${index + 1}" loading="lazy"><span class="page-preview-number">${index + 1}</span>
        </div>`}
      <div class="page-preview-actions"><button type="button" data-move-page="${index}" data-direction="-1" aria-label="Sola taşı">←</button><button type="button" data-edit-page="${index}">${page.type === "text" ? "Metin" : "Yerleşim"}</button><button type="button" data-move-page="${index}" data-direction="1" aria-label="Sağa taşı">→</button><button class="remove-page" type="button" data-remove-page="${index}">Sil</button></div>
    </div>`).join("");
  document.querySelectorAll("[data-remove-page]").forEach((button) => button.addEventListener("click", () => {
    editingPages.splice(Number(button.dataset.removePage), 1);
    renderPagePreviews();
    markDirty("Sayfa kaldırıldı. Projeyi kaydedin.");
  }));
  document.querySelectorAll("[data-edit-page]").forEach((button) => button.addEventListener("click", () => openPageSettings(Number(button.dataset.editPage))));
  document.querySelectorAll("[data-move-page]").forEach((button) => button.addEventListener("click", () => {
    const from = Number(button.dataset.movePage);
    const to = from + Number(button.dataset.direction);
    if (to < 0 || to >= editingPages.length) return;
    [editingPages[from], editingPages[to]] = [editingPages[to], editingPages[from]];
    renderPagePreviews();
    markDirty("Sayfa sırası değişti. Projeyi kaydedin.");
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
      markDirty("Sayfa sırası değişti. Projeyi kaydedin.");
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
  if (page.type === "pdf") {
    window.open(page.src, "_blank", "noopener,noreferrer");
    return;
  }
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
  updateDescriptionCount();
  editingCover = project.cover;
  editingPages = (project.pages || []).map(normalizePage);
  $("#cover-preview").src = editingCover;
  $("#delete-project").style.visibility = id ? "visible" : "hidden";
  renderPagePreviews();
  $("#project-editor").showModal();
}

$("#project-description").addEventListener("input", updateDescriptionCount);

$("#settings-form").addEventListener("input", (event) => {
  if (!content || event.target.type === "file") return;
  const target = event.target;
  if (target.name && Object.prototype.hasOwnProperty.call(content.settings, target.name)) content.settings[target.name] = target.value;
  if (target.dataset.heroFeaturedLabel !== undefined) getHeroSlides()[Number(target.dataset.heroFeaturedLabel)].label = target.value;
  if (target.dataset.heroFeaturedTitle !== undefined) getHeroSlides()[Number(target.dataset.heroFeaturedTitle)].title = target.value;
  if (target.dataset.skillIndex !== undefined) content.settings.skills[Number(target.dataset.skillIndex)] = target.value;
  if (target.dataset.statValue !== undefined) content.settings.stats[Number(target.dataset.statValue)].value = target.value;
  if (target.dataset.statLabel !== undefined) content.settings.stats[Number(target.dataset.statLabel)].label = target.value;
  if (target.dataset.socialLabel !== undefined) content.settings.socials[Number(target.dataset.socialLabel)].label = target.value;
  if (target.dataset.socialUrl !== undefined) content.settings.socials[Number(target.dataset.socialUrl)].url = target.value;
  markDirty();
});

$("#project-form").addEventListener("input", (event) => {
  if (event.target.type !== "file") markDirty("Projede kaydedilmemiş değişiklikler var");
});

document.querySelectorAll("aside nav button").forEach((button) => button.addEventListener("click", () => {
  document.querySelectorAll("aside nav button,.panel").forEach((node) => node.classList.remove("active"));
  button.classList.add("active");
  $(`#${button.dataset.tab}`).classList.add("active");
  $("#panel-title").textContent = button.dataset.title || button.textContent.trim();
  if (window.innerWidth < 901) window.scrollTo({ top: 0, behavior: "smooth" });
}));

$("#settings-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  setBusy(submitButton, true, "Kaydediliyor...");
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
  markDirty();
  await persist("Genel içerik kaydedildi");
  setBusy(submitButton, false);
});

$("#hero-upload").addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const selectedFile = input.files[0];
  if (!selectedFile) return;
  input.disabled = true;
  try {
    status("Görsel yükleniyor...", "saving");
    const dataUrl = await imageFileToDataUrl(selectedFile, 2000);
    pendingHero = await uploadImage(dataUrl, "hero");
    getHeroSlides()[0].image = pendingHero;
    $("#hero-preview").src = pendingHero;
    renderHeroFeaturedFields();
    markDirty("Hero görseli hazır. Genel içeriği kaydedin.");
  } catch (error) { status(error.message || "Görsel yüklenemedi", true); }
  finally { input.disabled = false; input.value = ""; }
});

$("#cover-upload").addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const selectedFile = input.files[0];
  if (!selectedFile) return;
  input.disabled = true;
  try {
    status("Kapak yükleniyor...", "saving");
    const dataUrl = await imageFileToDataUrl(selectedFile, 1500);
    editingCover = await uploadImage(dataUrl, "covers");
    $("#cover-preview").src = editingCover;
    markDirty("Kapak hazır. Projeyi kaydedin.");
  } catch (error) { status(error.message || "Kapak yüklenemedi", true); }
  finally { input.disabled = false; input.value = ""; }
});

$("#pages-upload").addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const files = [...input.files];
  if (!files.length) return;
  input.disabled = true;
  status(`0 / ${files.length} sayfa hazırlanıyor...`, "saving");
  try {
    const newPages = [];
    for (const [index, file] of files.entries()) {
      status(`${index + 1} / ${files.length} sayfa yükleniyor...`, "saving");
      if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
        if (file.size > 3 * 1024 * 1024) throw new Error(`${file.name} 3 MB'dan büyük. PDF'yi sıkıştırıp tekrar yükleyin.`);
        const src = await uploadPdf(file, "pages");
        newPages.push(normalizePage({ type: "pdf", src, title: file.name.replace(/\.pdf$/i, "") }));
      } else {
        const dataUrl = await imageFileToDataUrl(file, 1800);
        newPages.push(normalizePage(await uploadImage(dataUrl, "pages")));
      }
    }
    editingPages.push(...newPages);
    renderPagePreviews();
    markDirty(`${newPages.length} sayfa hazır. Projeyi kaydedin.`);
  } catch (error) { status(error.message || "Sayfalardan biri yüklenemedi", true); }
  finally { input.disabled = false; input.value = ""; }
});

$("#project-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitButton = event.currentTarget.querySelector("button[type='submit']");
  const data = new FormData(event.currentTarget);
  const project = Object.fromEntries(["id", "title", "year", "location", "category", "color", "description"].map((key) => [key, data.get(key).trim()]));
  if (project.description.length > PROJECT_DESCRIPTION_LIMIT) {
    status(`Proje açıklaması en fazla ${PROJECT_DESCRIPTION_LIMIT} karakter olabilir.`, true);
    $("#project-description").focus();
    updateDescriptionCount();
    return;
  }
  setBusy(submitButton, true, "Kaydediliyor...");
  try {
    const embeddedPdfs = editingPages.filter((page) => page.type === "pdf" && String(page.src).startsWith("data:application/pdf"));
    for (const [index, page] of embeddedPdfs.entries()) {
      status(`Eski PDF ${index + 1} / ${embeddedPdfs.length} medya havuzuna taşınıyor...`, "saving");
      page.src = await uploadPdfDataUrl(page.src, "pages", `${page.title || "document"}.pdf`);
    }
  } catch (error) {
    status(error.message || "PDF medya havuzuna taşınamadı.", "error");
    setBusy(submitButton, false);
    return;
  }
  project.cover = editingCover;
  project.pages = [...editingPages];
  const index = content.projects.findIndex((item) => item.id === project.id);
  if (index >= 0) content.projects[index] = project;
  else content.projects.push(project);
  markDirty();
  if (await persist("Proje kaydedildi")) {
    renderProjects();
    renderFeedbackAdmin();
    $("#project-editor").close();
  }
  setBusy(submitButton, false);
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
  markDirty("Metin sayfası eklendi. Projeyi kaydedin.");
});
$("#add-social").addEventListener("click", () => {
  content.settings.socials = Array.isArray(content.settings.socials) ? content.settings.socials : [];
  content.settings.socials.push({ label: "", url: "" });
  renderSocialFields();
  markDirty();
});
$("#add-skill").addEventListener("click", () => {
  content.settings.skills = Array.isArray(content.settings.skills) ? content.settings.skills : [];
  content.settings.skills.push("");
  renderSkillFields();
  markDirty();
});
$("#add-stat").addEventListener("click", () => {
  content.settings.stats = Array.isArray(content.settings.stats) ? content.settings.stats : [];
  content.settings.stats.push({ value: "", label: "" });
  renderStatsFields();
  markDirty("Yeni istatistik eklendi. Kaydetmeyi unutmayın.");
});
$("#close-editor").addEventListener("click", () => $("#project-editor").close());
$("#delete-project").addEventListener("click", async () => {
  const button = $("#delete-project");
  const id = $("#project-form").elements.id.value;
  if (!confirm("Bu proje kalıcı olarak silinsin mi?")) return;
  const previousProjects = [...content.projects];
  content.projects = content.projects.filter((project) => project.id !== id);
  markDirty();
  setBusy(button, true, "Siliniyor...");
  if (await persist("Proje silindi")) {
    renderProjects();
    renderFeedbackAdmin();
    $("#project-editor").close();
  } else {
    content.projects = previousProjects;
    renderProjects();
  }
  setBusy(button, false);
});

$("#export-data").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `tunahan-tayinci-portfolio-yedek-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

$("#import-data").addEventListener("change", async (event) => {
  const input = event.currentTarget;
  if (!input.files[0]) return;
  input.disabled = true;
  try {
    const imported = JSON.parse(await input.files[0].text());
    if (!imported.settings || !Array.isArray(imported.projects)) throw new Error();
    content = normalizeContent(imported);
    markDirty();
    if (await persist("Yedek geri yüklendi")) { fillSettings(); renderProjects(); renderFeedbackAdmin(); }
  } catch { status("Geçersiz yedek dosyası", true); }
  finally { input.disabled = false; input.value = ""; }
});

$("#reset-data").addEventListener("click", async () => {
  const button = $("#reset-data");
  if (!confirm("Tüm düzenlemeler silinip ilk içeriğe dönülsün mü?")) return;
  resetContent();
  content = JSON.parse(JSON.stringify(DEFAULT_CONTENT));
  markDirty();
  setBusy(button, true, "Sıfırlanıyor...");
  if (await persist("İçerik sıfırlandı")) {
    fillSettings();
    renderProjects();
    renderFeedbackAdmin();
  }
  setBusy(button, false);
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
  markDirty("Sayfa yerleşimi güncellendi. Projeyi kaydedin.");
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
  markDirty("Metin sayfası güncellendi. Projeyi kaydedin.");
});

$("#close-media-library").addEventListener("click", () => $("#media-library").close());

window.addEventListener("beforeunload", (event) => {
  if (!hasUnsavedChanges) return;
  event.preventDefault();
  event.returnValue = "";
});


