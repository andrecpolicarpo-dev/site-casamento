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
