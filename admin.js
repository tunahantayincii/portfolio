let content;
let editingPages = [];
let editingCover = "";
let pendingHero = "";
const $ = (selector) => document.querySelector(selector);

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
}

function renderProjects() {
  const container = $("#admin-projects");
  container.innerHTML = "";
  content.projects.forEach((project) => {
    const card = document.createElement("button");
    card.className = "admin-project";
    card.type = "button";
    card.innerHTML = `<img src="${project.cover}" alt=""><strong>${project.title}</strong><small>${project.location} · ${project.year} · ${project.pages.length} sayfa</small>`;
    card.addEventListener("click", () => openEditor(project.id));
    container.appendChild(card);
  });
}

function renderPagePreviews() {
  $("#page-previews").innerHTML = editingPages.map((image, index) => `
    <div class="page-preview"><img src="${image}" alt="Sayfa ${index + 1}"><button type="button" data-remove-page="${index}" aria-label="Sayfayı sil">×</button></div>`).join("");
  document.querySelectorAll("[data-remove-page]").forEach((button) => button.addEventListener("click", () => {
    editingPages.splice(Number(button.dataset.removePage), 1);
    renderPagePreviews();
  }));
}

function openEditor(id = "") {
  const project = content.projects.find((item) => item.id === id) || {
    id: `proje-${Date.now()}`, title: "", year: new Date().getFullYear().toString(), location: "", category: "", color: "#555555", description: "", cover: "assets/hero-residence.png", pages: []
  };
  const form = $("#project-form");
  ["id", "title", "year", "location", "category", "color", "description"].forEach((field) => { form.elements[field].value = project[field]; });
  editingCover = project.cover;
  editingPages = [...project.pages];
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
    if (key !== "heroImage" && data.has(key)) content.settings[key] = data.get(key).trim();
  });
  content.settings.heroImage = pendingHero;
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
    for (const dataUrl of dataUrls) newPages.push(await uploadImage(dataUrl, "pages"));
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
