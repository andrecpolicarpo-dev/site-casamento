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
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let currentSlide = 0;
  let autoplayTimer;

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
    if (!reduceMotion) autoplayTimer = window.setInterval(() => showSlide(currentSlide + 1, false), 30000);
  }

  previousButton.addEventListener("click", () => showSlide(currentSlide - 1));
  nextButton.addEventListener("click", () => showSlide(currentSlide + 1));
  dots.forEach((dot, index) => dot.addEventListener("click", () => showSlide(index)));
  storyCarousel.addEventListener("mouseenter", () => window.clearInterval(autoplayTimer));
  storyCarousel.addEventListener("mouseleave", startAutoplay);
  storyCarousel.addEventListener("focusin", () => window.clearInterval(autoplayTimer));
  storyCarousel.addEventListener("focusout", startAutoplay);
  showSlide(0, false);
  startAutoplay();
}

// Música de fundo: tenta iniciar após a primeira interação e mantém controle visível.
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

  musicControl.addEventListener("click", () => backgroundMusic.paused ? playMusic() : backgroundMusic.pause());
  backgroundMusic.addEventListener("play", updateMusicControl);
  backgroundMusic.addEventListener("pause", updateMusicControl);
  backgroundMusic.addEventListener("error", () => {
    musicLabel.textContent = "Adicionar música";
    musicControl.setAttribute("aria-label", "Arquivo de música ainda não disponível");
  });
  document.addEventListener("pointerdown", playMusic, { once: true });
  document.addEventListener("keydown", playMusic, { once: true });
  updateMusicControl();
}
