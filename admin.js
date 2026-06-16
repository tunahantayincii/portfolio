let content;
let editingPages = [];
let editingCover = "";
let pendingHero = "";
let editingPageIndex = -1;
let draggedPageIndex = -1;
const $ = (selector) => document.querySelector(selector);

function normalizePage(page) {
  if (typeof page === "string") return { src: page, fit: "cover", position: "center", background: "#e8e4da" };
  return {
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

async function logout() {
  try { await fetch("/api/auth/logout", { method: "POST" }); }
  finally { location.reload(); }
}

$("#login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  $("#login-error").textContent = "Giriş kontrol ediliyor...";
  try {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: data.get("username").trim(), password: data.get("password") })
    });
    if (!response.ok) throw new Error("invalid");
    event.currentTarget.reset();
    $("#login-error").textContent = "";
    initializePanel();
    return;
  } catch {
    $("#login-error").textContent = "Kullanıcı adı veya şifre yanlış.";
  }
});

$("#logout-button").addEventListener("click", logout);

function status(message, error = false) {
  const node = $("#save-status");
  node.textContent = message;
  node.style.color = error ? "#9c3030" : "#667700";
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
  pendingHero = content.settings.heroImage;
  $("#hero-preview").src = pendingHero;
  renderSocialFields();
  renderSkillFields();
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

function renderProjects() {
  const container = $("#admin-projects");
  container.innerHTML = "";
  content.projects.forEach((project) => {
    const card = document.createElement("button");
    card.className = "admin-project";
    card.type = "button";
    card.innerHTML = `<img src="${project.cover}" alt=""><strong>${project.title}</strong><small>${project.location} · ${project.year} · ${(project.pages || []).length} sayfa</small>`;
    card.addEventListener("click", () => openEditor(project.id));
    container.appendChild(card);
  });
}

function renderPagePreviews() {
  $("#page-previews").innerHTML = editingPages.map((page, index) => `
    <div class="page-preview" draggable="true" data-page-index="${index}">
      <div class="page-preview-visual" style="--page-bg:${page.background};--page-fit:${page.fit};--page-position:${page.position}">
        <img src="${page.src}" alt="Sayfa ${index + 1}"><span class="page-preview-number">${index + 1}</span>
      </div>
      <div class="page-preview-actions"><button type="button" data-move-page="${index}" data-direction="-1" aria-label="Sola taşı">←</button><button type="button" data-edit-page="${index}">Yerleşim</button><button type="button" data-move-page="${index}" data-direction="1" aria-label="Sağa taşı">→</button><button class="remove-page" type="button" data-remove-page="${index}">Sil</button></div>
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
  $("#layout-preview-image").src = page.src;
  $("#page-fit").value = page.fit;
  $("#page-position").value = page.position;
  $("#page-background").value = page.background;
  updateLayoutPreview();
  $("#page-settings").showModal();
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
    if (key !== "heroImage" && key !== "socials" && key !== "skills" && data.has(key)) content.settings[key] = data.get(key).trim();
  });
  content.settings.heroImage = pendingHero;
  content.settings.contactUrl = normalizeUrl(content.settings.contactUrl || content.settings.email);
  collectSkillFields();
  collectSocialFields();
  await persist("Genel içerik kaydedildi");
});

$("#hero-upload").addEventListener("change", async (event) => {
  try {
    status("Görsel yükleniyor...");
    const dataUrl = await imageFileToDataUrl(event.target.files[0], 2000);
    pendingHero = await uploadImage(dataUrl, "hero");
    $("#hero-preview").src = pendingHero;
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
    const response = await fetch("/api/auth/session", { headers: { "Accept": "application/json" } });
    if (response.ok) initializePanel();
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
