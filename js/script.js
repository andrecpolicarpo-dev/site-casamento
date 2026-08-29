// Menu móvel
const menuButton = document.querySelector(".menu-button");
const navLinks = document.querySelector(".nav-links");

if (menuButton && navLinks) {
  menuButton.addEventListener("click", () => {
    const isOpen = navLinks.classList.toggle("open");
    menuButton.setAttribute("aria-expanded", String(isOpen));
    menuButton.setAttribute("aria-label", isOpen ? "Fechar menu" : "Abrir menu");
  });

  navLinks.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => {
      navLinks.classList.remove("open");
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Abrir menu");
    });
  });
}

// Contagem regressiva
const countdown = document.querySelector(".countdown");
const finishedMessage = document.querySelector("#countdown-finished");

function pad(value, size = 2) {
  return String(value).padStart(size, "0");
}

function updateCountdown() {
  if (!countdown) return;

  const eventDate = new Date(countdown.dataset.eventDate);
  const now = new Date();
  const distance = eventDate.getTime() - now.getTime();

  if (Number.isNaN(eventDate.getTime())) {
    console.error("Data do evento inválida. Verifique data-event-date no index.html.");
    return;
  }

  if (distance <= 0) {
    countdown.hidden = true;

    if (finishedMessage) {
      finishedMessage.hidden = false;
    }

    return;
  }

  const day = 1000 * 60 * 60 * 24;
  const hour = 1000 * 60 * 60;
  const minute = 1000 * 60;

  const days = Math.floor(distance / day);
  const hours = Math.floor((distance % day) / hour);
  const minutes = Math.floor((distance % hour) / minute);
  const seconds = Math.floor((distance % minute) / 1000);

  document.querySelector("#days").textContent = pad(days, 3);
  document.querySelector("#hours").textContent = pad(hours);
  document.querySelector("#minutes").textContent = pad(minutes);
  document.querySelector("#seconds").textContent = pad(seconds);
}

updateCountdown();
setInterval(updateCountdown, 1000);

// Linha do tempo da história
const storyCarousel = document.querySelector(".story-carousel");

if (storyCarousel) {
  const track = storyCarousel.querySelector(".story-track");
  const slides = [...storyCarousel.querySelectorAll(".story-slide")];
  const dots = [...storyCarousel.querySelectorAll(".story-dot")];
  const status = storyCarousel.querySelector(".story-status span");
  const previousButton = storyCarousel.querySelector(".story-prev");
  const nextButton = storyCarousel.querySelector(".story-next");
  const progress = storyCarousel.querySelector(".story-progress");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let currentSlide = 0;
  let autoplayTimer;
  let touchStartX = 0;
  let touchStartY = 0;

  storyCarousel.querySelectorAll("img[data-fallback]").forEach((image) => {
    image.addEventListener("error", () => {
      if (image.getAttribute("src") === image.dataset.fallback) return;
      image.src = image.dataset.fallback;
    });
  });

  function showSlide(index, restart = true) {
    currentSlide = (index + slides.length) % slides.length;
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    slides.forEach((slide, slideIndex) => {
      const active = slideIndex === currentSlide;
      slide.classList.toggle("is-active", active);
      slide.setAttribute("aria-hidden", String(!active));
    });
    dots.forEach((dot, dotIndex) => {
      const active = dotIndex === currentSlide;
      dot.classList.toggle("is-active", active);
      dot.setAttribute("aria-selected", String(active));
    });
    status.textContent = String(currentSlide + 1).padStart(2, "0");
    if (restart) startAutoplay();
  }

  function startAutoplay() {
    window.clearInterval(autoplayTimer);
    if (progress) {
      progress.classList.remove("is-running");
      void progress.offsetWidth;
      if (!reduceMotion) progress.classList.add("is-running");
    }
    if (!reduceMotion) autoplayTimer = window.setInterval(() => showSlide(currentSlide + 1), 30000);
  }

  function pauseAutoplay() {
    window.clearInterval(autoplayTimer);
    if (progress) progress.classList.remove("is-running");
  }

  previousButton.addEventListener("click", () => showSlide(currentSlide - 1));
  nextButton.addEventListener("click", () => showSlide(currentSlide + 1));
  dots.forEach((dot, index) => dot.addEventListener("click", () => showSlide(index)));
  storyCarousel.addEventListener("mouseenter", pauseAutoplay);
  storyCarousel.addEventListener("mouseleave", startAutoplay);
  storyCarousel.addEventListener("focusin", pauseAutoplay);
  storyCarousel.addEventListener("focusout", startAutoplay);
  storyCarousel.addEventListener("touchstart", (event) => {
    touchStartX = event.changedTouches[0].clientX;
    touchStartY = event.changedTouches[0].clientY;
  }, { passive: true });
  storyCarousel.addEventListener("touchend", (event) => {
    const deltaX = event.changedTouches[0].clientX - touchStartX;
    const deltaY = event.changedTouches[0].clientY - touchStartY;
    if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
      showSlide(currentSlide + (deltaX < 0 ? 1 : -1));
    }
  }, { passive: true });
  showSlide(0, false);
  startAutoplay();
}

// Música de fundo: tenta iniciar imediatamente e repete na primeira interação se o navegador bloquear.
const backgroundMusic = document.querySelector("#background-music");
const musicControl = document.querySelector(".music-control");

if (backgroundMusic && musicControl) {
  const musicLabel = musicControl.querySelector(".music-label");
  backgroundMusic.volume = 0.28;

  function updateMusicControl() {
    const playing = !backgroundMusic.paused;
    musicControl.classList.toggle("is-playing", playing);
    musicControl.setAttribute("aria-pressed", String(playing));
    musicControl.setAttribute("aria-label", playing ? "Pausar música" : "Reproduzir música");
    musicLabel.textContent = playing ? "Pausar música" : "Ouvir música";
  }

  async function playMusic() {
    try { await backgroundMusic.play(); } catch (error) { /* Use o controle se o navegador bloquear. */ }
    updateMusicControl();
  }

  function tryMusicOnce() {
    if (backgroundMusic.paused) playMusic();
  }

  musicControl.addEventListener("click", () => backgroundMusic.paused ? playMusic() : backgroundMusic.pause());
  backgroundMusic.addEventListener("play", updateMusicControl);
  backgroundMusic.addEventListener("pause", updateMusicControl);
  backgroundMusic.addEventListener("error", () => {
    musicLabel.textContent = "Adicionar música";
    musicControl.setAttribute("aria-label", "Arquivo de música ainda não disponível");
  });
  playMusic();
  document.addEventListener("pointerdown", tryMusicOnce, { once: true });
  document.addEventListener("touchstart", tryMusicOnce, { once: true, passive: true });
  document.addEventListener("keydown", tryMusicOnce, { once: true });
  updateMusicControl();
}

// RSVP nativo: Google Apps Script + Google Sheets, sem sair do site
const rsvpForm = document.querySelector("#rsvp-native-form");

if (rsvpForm) {
  const attendanceInputs = [...rsvpForm.querySelectorAll('input[name="Presença"]')];
  const attendanceOnlyFields = [...rsvpForm.querySelectorAll("[data-attendance-only]")];
  const childInputs = [...rsvpForm.querySelectorAll("[data-child-choice]")];
  const childDetailsWrapper = rsvpForm.querySelector("#rsvp-child-details");
  const childDetails = rsvpForm.querySelector("#rsvp-crianca-detalhes");
  const phoneInput = rsvpForm.querySelector("#rsvp-telefone");
  const pageInput = rsvpForm.querySelector("#rsvp-pagina");
  const submitButton = rsvpForm.querySelector(".rsvp-submit-button");
  const submitLabel = rsvpForm.querySelector(".rsvp-submit-label");
  const submitLoading = rsvpForm.querySelector(".rsvp-submit-loading");
  const statusBox = rsvpForm.querySelector("#rsvp-form-status");
  const successPanel = document.querySelector("#rsvp-success-panel");
  const newResponseButton = document.querySelector(".rsvp-new-response");
  let submissionPending = false;
  let submissionTimeout;

  function isAttending() {
    const selected = attendanceInputs.find((input) => input.checked);
    return selected?.value === "Sim, estarei presente!";
  }

  function updateAttendanceFields() {
    const selected = attendanceInputs.find((input) => input.checked);
    const attending = isAttending();

    attendanceOnlyFields.forEach((field) => {
      field.hidden = Boolean(selected) && !attending;
    });

    childInputs.forEach((input) => {
      input.required = attending;
      if (!attending) input.checked = false;
    });

    if (!attending) {
      const companions = rsvpForm.querySelector("#rsvp-acompanhantes");
      if (companions) companions.value = "";
      if (childDetails) {
        childDetails.value = "";
        childDetails.required = false;
      }
      if (childDetailsWrapper) childDetailsWrapper.hidden = true;
    }
  }

  function updateChildDetails() {
    const selected = childInputs.find((input) => input.checked);
    const hasChild = isAttending() && selected?.value === "Sim";

    if (childDetailsWrapper) childDetailsWrapper.hidden = !hasChild;
    if (childDetails) {
      childDetails.required = hasChild;
      if (!hasChild) childDetails.value = "";
    }
  }

  function formatPhone(value) {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  function showFormStatus(message, type) {
    if (!statusBox) return;
    statusBox.hidden = false;
    statusBox.classList.remove("is-success", "is-error");
    statusBox.classList.add(type === "success" ? "is-success" : "is-error");
    statusBox.textContent = message;
  }

  function setSubmitting(isSubmitting) {
    if (!submitButton || !submitLabel || !submitLoading) return;
    submitButton.disabled = isSubmitting;
    submitLabel.hidden = isSubmitting;
    submitLoading.hidden = !isSubmitting;
  }

  function finishSubmission() {
    if (!submissionPending) return;
    submissionPending = false;
    window.clearTimeout(submissionTimeout);
    setSubmitting(false);
    rsvpForm.reset();
    updateAttendanceFields();
    updateChildDetails();
    rsvpForm.hidden = true;
    if (successPanel) {
      successPanel.hidden = false;
      successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function failSubmission(message) {
    if (!submissionPending) return;
    submissionPending = false;
    window.clearTimeout(submissionTimeout);
    setSubmitting(false);
    showFormStatus(message, "error");
    statusBox?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  attendanceInputs.forEach((input) => {
    input.addEventListener("change", () => {
      updateAttendanceFields();
      updateChildDetails();
    });
  });

  childInputs.forEach((input) => input.addEventListener("change", updateChildDetails));

  if (phoneInput) {
    phoneInput.addEventListener("input", () => {
      phoneInput.value = formatPhone(phoneInput.value);
    });
  }

  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || data.type !== "TA_RSVP_RESULT" || data.token !== "TA-28082027-RSVP") return;
    if (data.status === "ok") {
      finishSubmission();
    } else {
      failSubmission(
        "Não conseguimos registrar sua confirmação agora. Tente novamente em alguns instantes ou fale com os noivos pelo WhatsApp."
      );
    }
  });

  if (newResponseButton) {
    newResponseButton.addEventListener("click", () => {
      if (successPanel) successPanel.hidden = true;
      rsvpForm.hidden = false;
      statusBox && (statusBox.hidden = true);
      rsvpForm.querySelector("#rsvp-nome")?.focus();
      rsvpForm.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  rsvpForm.addEventListener("submit", (event) => {
    event.preventDefault();

    updateAttendanceFields();
    updateChildDetails();

    if (!rsvpForm.checkValidity()) {
      rsvpForm.reportValidity();
      const firstInvalid = rsvpForm.querySelector(":invalid");
      firstInvalid?.focus({ preventScroll: true });
      firstInvalid?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const action = (rsvpForm.getAttribute("action") || "").trim();
    const hasPlaceholder = !action || action.includes("COLE_AQUI") || action.includes("SEU_DEPLOYMENT_ID");
    const isGoogleWebApp = /^https:\/\/script\.google\.com\/macros\/s\/[A-Za-z0-9_-]+\/exec(?:[?#].*)?$/.test(action);

    if (hasPlaceholder || !isGoogleWebApp) {
      showFormStatus(
        "Não foi possível identificar a URL válida do Google Apps Script. Confira o endereço /exec configurado no formulário.",
        "error"
      );
      statusBox?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    if (pageInput) pageInput.value = window.location.href;
    if (statusBox) statusBox.hidden = true;
    setSubmitting(true);
    submissionPending = true;

    submissionTimeout = window.setTimeout(() => {
      failSubmission(
        "O envio está demorando mais que o esperado. Confira sua conexão e tente novamente. Se persistir, fale com os noivos pelo WhatsApp."
      );
    }, 20000);

    // Envio nativo para um iframe oculto evita problemas de CORS dos Web Apps do Apps Script.
    HTMLFormElement.prototype.submit.call(rsvpForm);
  });

  updateAttendanceFields();
  updateChildDetails();
}
