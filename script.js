const $ = (selector) => document.querySelector(selector);

async function initializeSite() {
  const content = await getContent();
  const settings = content.settings;

  const hero = $("#hero-section");
  const heroImage = $("#hero-image");
  heroImage.src = settings.heroImage;
  $("#hero-location").textContent = settings.heroLocation;
  $("#hero-title").innerHTML = settings.heroTitle;
  $("#intro-text").textContent = settings.intro;
  $("#studio-title").innerHTML = settings.studioTitle;
  $("#studio-description").textContent = settings.studioDescription;
  const skills = Array.isArray(settings.skills) ? settings.skills.filter(Boolean) : [];
  $("#skill-list").innerHTML = skills.map((skill, index) => `<span>${String(index + 1).padStart(2, "0")}</span><p>${skill}</p>`).join("");
  $("#footer-name").textContent = settings.studioName;
  $("#footer-address").textContent = settings.address;
  $("#footer-email").textContent = settings.email;
  $("#footer-email").href = `mailto:${settings.email}`;
  $("#footer-phone").textContent = settings.phone;
  $("#footer-phone").href = `tel:${settings.phone.replace(/\s/g, "")}`;
  $("#contact-email").href = settings.contactUrl || `mailto:${settings.email}`;
  $("#contact-link-text").textContent = settings.contactText || "Tanışalım.";
  const socialLinks = Array.isArray(settings.socials) ? settings.socials.filter((item) => item.label && item.url) : [];
  $("#footer-socials").innerHTML = socialLinks.map((item) => `<a href="${item.url}" target="_blank" rel="noopener noreferrer">${item.label} ↗</a>`).join("") + `<a href="admin.html">Yönetim Paneli ↗</a>`;
  const heroFeaturedProjects = Array.isArray(settings.heroFeaturedProjects) ? settings.heroFeaturedProjects.slice(0, 3) : [];
  $("#hero-featured-projects").innerHTML = heroFeaturedProjects.map((item) => `<div><span>${item.label}</span><span>${item.title}</span></div>`).join("");
  await heroImage.decode().catch(() => {});
  hero.classList.add("ready");

  const library = $("#project-grid");
  const modal = $("#book-modal");
  let activeProject;
  let spreadIndex = 0;

  content.projects.forEach((project, index) => {
    const book = document.createElement("button");
    book.className = "project-book reveal";
    book.type = "button";
    book.style.setProperty("--book-color", project.color || "#555");
    book.innerHTML = `
      <span class="book-number">${String(index + 1).padStart(2, "0")}</span>
      <span class="book-cover"><img src="${project.cover}" alt="${project.title} kapak görseli"><i></i></span>
      <span class="book-caption"><strong>${project.title}</strong><small>${project.location} · ${project.category} · ${project.year}</small></span>`;
    book.addEventListener("click", () => openProject(project));
    library.appendChild(book);
  });

  function makePages(project) {
    return [
      { type: "intro", project },
      ...(project.pages || []).map((page, index) => ({
        type: "image",
        page: typeof page === "string" ? { src: page, fit: "cover", position: "center", background: "#e8e4da" } : page,
        number: index + 1
      })),
      { type: "end", project }
    ];
  }

  function pageMarkup(page) {
    if (!page) return `<div class="blank-page"></div>`;
    if (page.type === "image") return `<div class="reader-image-frame" style="background:${page.page.background || "#e8e4da"}"><img class="reader-image" style="object-fit:${page.page.fit || "cover"};object-position:${page.page.position || "center"}" src="${page.page.src}" alt="Proje sayfası ${page.number}"></div><span class="folio">${String(page.number).padStart(2, "0")}</span>`;
    if (page.type === "end") return `<div class="end-page"><span>${settings.studioName}</span><strong>${page.project.title}</strong><small>${page.project.year}</small></div>`;
    return `<div class="intro-page"><span>${page.project.location} · ${page.project.year}</span><h3>${page.project.title}</h3><p>${page.project.description}</p><small>${page.project.category}</small></div>`;
  }

  function renderSpread(direction = 1) {
    const pages = makePages(activeProject);
    const pageStep = window.matchMedia("(max-width: 780px)").matches ? 1 : 2;
    const left = $("#page-left");
    const right = $("#page-right");
    [left, right].forEach((page) => page.classList.remove("page-turn-next", "page-turn-prev"));
    left.innerHTML = pageMarkup(pages[spreadIndex]);
    right.innerHTML = pageMarkup(pages[spreadIndex + 1]);
    right.classList.add(direction > 0 ? "page-turn-next" : "page-turn-prev");
    $("#page-count").textContent = `${Math.min(spreadIndex + pageStep, pages.length)} / ${pages.length}`;
    $("#page-progress").style.width = `${Math.min(100, ((spreadIndex + pageStep) / pages.length) * 100)}%`;
    $(".reader-nav.prev").disabled = spreadIndex === 0;
    $(".reader-nav.next").disabled = spreadIndex + pageStep >= pages.length;
  }

  function openProject(project) {
    activeProject = project;
    spreadIndex = 0;
    $("#reader-kicker").textContent = `${project.location} · ${project.category} · ${project.year}`;
    $("#reader-title").textContent = project.title;
    renderSpread();
    modal.showModal();
    document.body.style.overflow = "hidden";
  }

  $(".reader-nav.next").addEventListener("click", () => { spreadIndex += window.matchMedia("(max-width: 780px)").matches ? 1 : 2; renderSpread(1); });
  $(".reader-nav.prev").addEventListener("click", () => { spreadIndex = Math.max(0, spreadIndex - (window.matchMedia("(max-width: 780px)").matches ? 1 : 2)); renderSpread(-1); });
  $(".book-close").addEventListener("click", () => modal.close());
  modal.addEventListener("close", () => { document.body.style.overflow = ""; });
  modal.addEventListener("click", (event) => { if (event.target === modal) modal.close(); });
  document.addEventListener("keydown", (event) => {
    if (!modal.open) return;
    if (event.key === "ArrowRight" && !$(".reader-nav.next").disabled) $(".reader-nav.next").click();
    if (event.key === "ArrowLeft" && !$(".reader-nav.prev").disabled) $(".reader-nav.prev").click();
  });

  const observer = new IntersectionObserver((entries) => entries.forEach((entry) => {
    if (entry.isIntersecting) { entry.target.classList.add("visible"); observer.unobserve(entry.target); }
  }), { threshold: .1 });
  document.querySelectorAll(".reveal").forEach((element) => observer.observe(element));
}

const menuButton = $(".menu-toggle");
const nav = $(".nav-links");
menuButton.addEventListener("click", () => {
  const open = menuButton.classList.toggle("open");
  nav.classList.toggle("open", open);
  menuButton.setAttribute("aria-expanded", String(open));
});

initializeSite();
