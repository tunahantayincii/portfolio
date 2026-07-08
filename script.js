const $ = (selector) => document.querySelector(selector);
const escapeHtml = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
}[char]));

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
  const stats = Array.isArray(settings.stats) ? settings.stats.filter((item) => item.value || item.label) : [];
  $("#studio-stats").innerHTML = stats.map((item) => `<div><strong>${item.value || ""}</strong><span>${item.label || ""}</span></div>`).join("");
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
  const zoomOverlay = $("#page-zoom");
  const zoomViewport = $("#zoom-viewport");
  const zoomImage = $("#zoom-image");
  const zoomPdf = $("#zoom-pdf");
  const zoomLevel = $("#zoom-level");
  const feedbackToggle = $("#feedback-toggle");
  const feedbackDrawer = $("#feedback-drawer");
  const feedbackList = $("#feedback-list");
  const feedbackForm = $("#feedback-form");
  const feedbackStatus = $("#feedback-status");
  const feedbackCount = $("#feedback-count");
  let activeProject;
  let spreadIndex = 0;
  let pageTurnInProgress = false;
  let imageZoom = 1;
  let imageX = 0;
  let imageY = 0;
  let zoomPointerId = null;
  let dragStartX = 0;
  let dragStartY = 0;
  let dragImageX = 0;
  let dragImageY = 0;

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
      ...(project.pages || []).map((page, index) => {
        if (page?.type === "text") return { type: "text", page, number: index + 1 };
        if (page?.type === "pdf") return { type: "pdf", page, number: index + 1 };
        return {
          type: "image",
          page: typeof page === "string" ? { src: page, fit: "cover", position: "center", background: "#e8e4da" } : page,
          number: index + 1
        };
      }),
      { type: "end", project }
    ];
  }

  function pageMarkup(page) {
    if (!page) return `<div class="blank-page"></div>`;
    if (page.type === "image") return `<button class="reader-image-frame zoomable-page" type="button" data-zoom-src="${page.page.src}" style="background:${page.page.background || "#e8e4da"}"><img class="reader-image" style="object-fit:${page.page.fit || "cover"};object-position:${page.page.position || "center"}" src="${page.page.src}" alt="Proje sayfası ${page.number}"><span class="zoom-hint">Yakınlaştır</span></button><span class="folio">${String(page.number).padStart(2, "0")}</span>`;
    if (page.type === "text") return `<div class="reader-text-page" style="background:${page.page.background || "#e8e4da"}"><span>${page.page.kicker || "Not"}</span><h3>${page.page.title || "Metin sayfası"}</h3><p>${page.page.body || ""}</p></div><span class="folio">${String(page.number).padStart(2, "0")}</span>`;
    if (page.type === "pdf") return `<div class="reader-pdf-page" style="background:${page.page.background || "#e8e4da"}"><button class="pdf-inspect-trigger" type="button" data-pdf-src="${page.page.src}"><object data="${page.page.src}#toolbar=0&navpanes=0&view=FitH" type="application/pdf"><div class="pdf-fallback"><strong>PDF</strong><span>${page.page.title || "Proje PDF sayfası"}</span></div></object><span>PDF'yi sayfa içinde incele</span></button></div><span class="folio">${String(page.number).padStart(2, "0")}</span>`;
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
    document.querySelectorAll(".pdf-inspect-trigger").forEach((button) => {
      button.addEventListener("click", () => openPdfZoom(button.dataset.pdfSrc));
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
    renderFeedback();
    closeFeedbackDrawer();
    renderSpread();
    modal.showModal();
    document.body.style.overflow = "hidden";
  }

  function currentFeedback() {
    return (content.feedback || []).filter((item) => item.approved && item.projectId === activeProject?.id);
  }

  function renderFeedback() {
    const items = currentFeedback();
    feedbackCount.textContent = items.length ? `${items.length} yorum` : "Henüz yok";
    feedbackList.innerHTML = items.length
      ? items.map((item) => `<article class="feedback-item"><p>${escapeHtml(item.message)}</p><span>${escapeHtml(item.name)}</span></article>`).join("")
      : `<p class="feedback-empty">Bu proje için henüz yayında geri bildirim yok. İlk notu sen bırakabilirsin.</p>`;
    feedbackStatus.textContent = "";
    feedbackForm.reset();
  }

  function closeFeedbackDrawer() {
    feedbackDrawer.hidden = true;
    feedbackToggle.setAttribute("aria-expanded", "false");
  }

  feedbackToggle.addEventListener("click", () => {
    const nextOpen = feedbackDrawer.hidden;
    feedbackDrawer.hidden = !nextOpen;
    feedbackToggle.setAttribute("aria-expanded", String(nextOpen));
  });

  feedbackForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!activeProject) return;
    const data = new FormData(feedbackForm);
    const payload = {
      projectId: activeProject.id,
      projectTitle: activeProject.title,
      name: data.get("name"),
      email: data.get("email"),
      message: data.get("message"),
      website: data.get("website")
    };
    feedbackStatus.textContent = "Gönderiliyor...";
    try {
      await sendFeedback(payload);
      feedbackForm.reset();
      feedbackStatus.textContent = "Geri bildirimin geldi. Yönetim panelinden onaylanınca burada görünecek.";
    } catch (error) {
      feedbackStatus.textContent = error.message || "Geri bildirim gönderilemedi.";
    }
  });

  async function sendFeedback(payload) {
    const endpoints = ["/api/feedback"];
    let lastError = "Geri bildirim gönderilemedi.";
    for (const endpoint of endpoints) {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));
      if (response.ok) return result;
      lastError = result.error || `Geri bildirim gönderilemedi (${response.status}).`;
      if (response.status !== 404 && response.status !== 405) break;
    }
    throw new Error(lastError.includes("404")
      ? "Geri bildirim servisi Netlify'a yüklenmemiş. Deploy'u GitHub üzerinden yeniden alman gerekiyor."
      : lastError.includes("Method not allowed")
        ? "Geri bildirim servisi eski sürümde çalışıyor. Netlify Functions yeniden deploy edilmeli."
        : lastError);
  }

  function openZoom(src) {
    if (!src) return;
    zoomOverlay.classList.remove("pdf-mode");
    zoomPdf.removeAttribute("data");
    zoomImage.src = src;
    resetImageZoom();
    zoomOverlay.classList.add("open");
    zoomOverlay.setAttribute("aria-hidden", "false");
  }

  function openPdfZoom(src) {
    if (!src) return;
    zoomOverlay.classList.add("pdf-mode");
    zoomImage.removeAttribute("src");
    zoomPdf.data = `${src}#toolbar=1&navpanes=0&view=FitH`;
    resetImageZoom();
    zoomOverlay.classList.add("open");
    zoomOverlay.setAttribute("aria-hidden", "false");
  }

  function closeZoom() {
    zoomOverlay.classList.remove("open");
    zoomOverlay.classList.remove("pdf-mode");
    zoomOverlay.setAttribute("aria-hidden", "true");
    zoomImage.removeAttribute("src");
    zoomPdf.removeAttribute("data");
    resetImageZoom();
  }

  function renderImageZoom() {
    zoomImage.style.transform = `translate3d(${imageX}px, ${imageY}px, 0) scale(${imageZoom})`;
    zoomLevel.value = `${Math.round(imageZoom * 100)}%`;
    zoomLevel.textContent = zoomLevel.value;
    zoomViewport.classList.toggle("zoomed", imageZoom > 1);
  }

  function setImageZoom(nextZoom) {
    imageZoom = Math.min(5, Math.max(1, nextZoom));
    if (imageZoom === 1) {
      imageX = 0;
      imageY = 0;
    }
    renderImageZoom();
  }

  function resetImageZoom() {
    imageZoom = 1;
    imageX = 0;
    imageY = 0;
    renderImageZoom();
  }

  $(".reader-nav.next").addEventListener("click", () => turnSpread(1));
  $(".reader-nav.prev").addEventListener("click", () => turnSpread(-1));
  $(".book-close").addEventListener("click", () => modal.close());
  $(".zoom-close").addEventListener("click", closeZoom);
  $("#zoom-in").addEventListener("click", () => setImageZoom(imageZoom + .5));
  $("#zoom-out").addEventListener("click", () => setImageZoom(imageZoom - .5));
  $("#zoom-reset").addEventListener("click", resetImageZoom);
  zoomOverlay.addEventListener("click", (event) => { if (event.target === zoomOverlay) closeZoom(); });
  zoomViewport.addEventListener("wheel", (event) => {
    if (zoomOverlay.classList.contains("pdf-mode")) return;
    event.preventDefault();
    setImageZoom(imageZoom + (event.deltaY < 0 ? .25 : -.25));
  }, { passive: false });
  zoomViewport.addEventListener("dblclick", () => {
    if (zoomOverlay.classList.contains("pdf-mode")) return;
    setImageZoom(imageZoom > 1 ? 1 : 2);
  });
  zoomViewport.addEventListener("pointerdown", (event) => {
    if (zoomOverlay.classList.contains("pdf-mode")) return;
    if (imageZoom <= 1) return;
    zoomPointerId = event.pointerId;
    dragStartX = event.clientX;
    dragStartY = event.clientY;
    dragImageX = imageX;
    dragImageY = imageY;
    zoomViewport.setPointerCapture(event.pointerId);
    zoomViewport.classList.add("dragging");
  });
  zoomViewport.addEventListener("pointermove", (event) => {
    if (zoomPointerId !== event.pointerId) return;
    imageX = dragImageX + event.clientX - dragStartX;
    imageY = dragImageY + event.clientY - dragStartY;
    renderImageZoom();
  });
  const stopImageDrag = (event) => {
    if (zoomPointerId !== event.pointerId) return;
    zoomPointerId = null;
    zoomViewport.classList.remove("dragging");
  };
  zoomViewport.addEventListener("pointerup", stopImageDrag);
  zoomViewport.addEventListener("pointercancel", stopImageDrag);
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


