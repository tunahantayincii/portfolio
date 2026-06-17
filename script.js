const $ = (selector) => document.querySelector(selector);

async function initializeSite() {
  const content = await getContent();
  const settings = content.settings;

  const hero = $("#hero-section");
  const heroImage = $("#hero-image");
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
  const heroSlides = Array.isArray(settings.heroSlides) ? settings.heroSlides.slice(0, 3) : [{ image: settings.heroImage, label: "Seçili Proje 01", title: "" }];
  const heroProjects = $("#hero-featured-projects");
  let activeHeroSlide = 0;
  let heroSlideTimer;

  heroProjects.innerHTML = heroSlides.map((item, index) => `
    <button class="hero-project${index === 0 ? " active" : ""}" type="button" data-hero-slide="${index}">
      <span>${item.label}</span>
      <span>${item.title}</span>
    </button>`).join("");

  async function showHeroSlide(index, instant = false) {
    const slideIndex = ((index % heroSlides.length) + heroSlides.length) % heroSlides.length;
    const slide = heroSlides[slideIndex] || heroSlides[0];
    if (!slide?.image) return;
    activeHeroSlide = slideIndex;
    heroProjects.querySelectorAll("[data-hero-slide]").forEach((button) => {
      button.classList.toggle("active", Number(button.dataset.heroSlide) === activeHeroSlide);
    });
    if (!instant) hero.classList.remove("ready");
    heroImage.src = slide.image;
    await heroImage.decode().catch(() => {});
    requestAnimationFrame(() => hero.classList.add("ready"));
  }

  function startHeroSlider() {
    clearInterval(heroSlideTimer);
    if (heroSlides.length < 2) return;
    heroSlideTimer = setInterval(() => showHeroSlide(activeHeroSlide + 1), 5000);
  }

  heroProjects.querySelectorAll("[data-hero-slide]").forEach((button) => {
    button.addEventListener("click", async () => {
      await showHeroSlide(Number(button.dataset.heroSlide));
      startHeroSlider();
    });
  });
  await showHeroSlide(0, true);
  startHeroSlider();

  const library = $("#project-grid");
  const modal = $("#book-modal");
  let activeProject;
  let spreadIndex = 0;
  let pageTurnInProgress = false;

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

  const scrollShelf = (direction) => {
    const firstBook = library.querySelector(".project-book");
    const step = firstBook ? firstBook.getBoundingClientRect().width + 34 : library.clientWidth * .8;
    library.scrollBy({ left: direction * step, behavior: "smooth" });
  };
  $(".shelf-arrow-left").addEventListener("click", () => scrollShelf(-1));
  $(".shelf-arrow-right").addEventListener("click", () => scrollShelf(1));

  function makePages(project) {
    return [
      { type: "intro", project },
      ...(project.pages || []).map((page, index) => page?.type === "text"
        ? { type: "text", page, number: index + 1 }
        : {
          type: "image",
          page: typeof page === "string" ? { src: page, fit: "cover", position: "center", background: "#e8e4da" } : page,
          number: index + 1
        }),
      { type: "end", project }
    ];
  }

  function pageMarkup(page) {
    if (!page) return `<div class="blank-page"></div>`;
    if (page.type === "image") return `<button class="reader-image-frame zoomable-page" type="button" data-zoom-src="${page.page.src}" style="background:${page.page.background || "#e8e4da"}"><img class="reader-image" style="object-fit:${page.page.fit || "cover"};object-position:${page.page.position || "center"}" src="${page.page.src}" alt="Proje sayfası ${page.number}"><span class="zoom-hint">Yakınlaştır</span></button><span class="folio">${String(page.number).padStart(2, "0")}</span>`;
    if (page.type === "text") return `<div class="reader-text-page" style="background:${page.page.background || "#e8e4da"}"><span>${page.page.kicker || "Not"}</span><h3>${page.page.title || "Metin sayfası"}</h3><p>${page.page.body || ""}</p></div><span class="folio">${String(page.number).padStart(2, "0")}</span>`;
    if (page.type === "end") return `<div class="end-page"><span>${settings.studioName}</span><strong>${page.project.title}</strong><small>${page.project.year}</small></div>`;
    return `<div class="intro-page"><span>${page.project.location} · ${page.project.year}</span><h3>${page.project.title}</h3><p>${page.project.description}</p><small>${page.project.category}</small></div>`;
  }

  function renderSpread(direction = 1, animate = false) {
    const pages = makePages(activeProject);
    const pageStep = window.matchMedia("(max-width: 780px)").matches ? 1 : 2;
    const left = $("#page-left");
    const right = $("#page-right");
    [left, right].forEach((page) => page.classList.remove("page-slide-in-next", "page-slide-in-prev"));
    left.innerHTML = pageMarkup(pages[spreadIndex]);
    right.innerHTML = pageMarkup(pages[spreadIndex + 1]);
    if (animate) {
      const animationClass = direction > 0 ? "page-slide-in-next" : "page-slide-in-prev";
      const targets = window.matchMedia("(max-width: 780px)").matches ? [left] : [left, right];
      targets.forEach((page) => {
        page.classList.add(animationClass);
        page.addEventListener("animationend", () => page.classList.remove(animationClass), { once: true });
      });
    }
    document.querySelectorAll(".zoomable-page").forEach((button) => {
      button.addEventListener("click", () => openZoom(button.dataset.zoomSrc));
    });
    $("#page-count").textContent = `${Math.min(spreadIndex + pageStep, pages.length)} / ${pages.length}`;
    $("#page-progress").style.width = `${Math.min(100, ((spreadIndex + pageStep) / pages.length) * 100)}%`;
    $(".reader-nav.prev").disabled = spreadIndex === 0;
    $(".reader-nav.next").disabled = spreadIndex + pageStep >= pages.length;
  }

  function turnSpread(direction) {
    if (pageTurnInProgress) return;
    const pages = makePages(activeProject);
    const pageStep = window.matchMedia("(max-width: 780px)").matches ? 1 : 2;
    const nextIndex = direction > 0 ? spreadIndex + pageStep : Math.max(0, spreadIndex - pageStep);
    if (nextIndex < 0 || nextIndex === spreadIndex || nextIndex >= pages.length) return;
    pageTurnInProgress = true;
    spreadIndex = nextIndex;
    renderSpread(direction, true);
    $(".reader-nav.prev").disabled = true;
    $(".reader-nav.next").disabled = true;
    setTimeout(() => {
      pageTurnInProgress = false;
      renderSpread(direction, false);
    }, 520);
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

  function openZoom(src) {
    if (!src) return;
    $("#zoom-image").src = src;
    $("#page-zoom").classList.add("open");
    $("#page-zoom").setAttribute("aria-hidden", "false");
  }

  function closeZoom() {
    $("#page-zoom").classList.remove("open");
    $("#page-zoom").setAttribute("aria-hidden", "true");
    $("#zoom-image").removeAttribute("src");
  }

  $(".reader-nav.next").addEventListener("click", () => turnSpread(1));
  $(".reader-nav.prev").addEventListener("click", () => turnSpread(-1));
  $(".book-close").addEventListener("click", () => modal.close());
  $(".zoom-close").addEventListener("click", closeZoom);
  $("#page-zoom").addEventListener("click", (event) => { if (event.target === $("#page-zoom")) closeZoom(); });
  modal.addEventListener("close", () => { closeZoom(); document.body.style.overflow = ""; });
  modal.addEventListener("click", (event) => { if (event.target === modal) modal.close(); });
  document.addEventListener("keydown", (event) => {
    if (!modal.open) return;
    if (event.key === "Escape" && $("#page-zoom").classList.contains("open")) {
      closeZoom();
      event.preventDefault();
      return;
    }
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
