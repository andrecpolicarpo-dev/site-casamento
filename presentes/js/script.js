const CONFIG = window.WEDDING_GIFTS_CONFIG || {};
const SHEET_URL = CONFIG.sheetCsvUrl || "";
const PIX_KEY = CONFIG.pixKey || "042.301.611-31";
const IMAGE_BASE_PATH = CONFIG.imageBasePath || "assets/images/";

const grid = document.querySelector("#gift-grid");
const statusBox = document.querySelector("#gift-status");
const dialog = document.querySelector("#gift-dialog");
const dialogTitle = document.querySelector("#dialog-title");
const dialogPrice = document.querySelector("#dialog-price");
const paymentLink = document.querySelector("#payment-link");
const copyPriceButton = document.querySelector("#copy-price");
const toast = document.querySelector("#toast");

let selectedPrice = "";

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 2200);
}

async function copyText(text, successMessage) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const input = document.createElement("textarea");
    input.value = text;
    input.style.position = "fixed";
    input.style.opacity = "0";
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
  }
  showToast(successMessage);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function parseMoney(value) {
  if (typeof value === "number") return value;
  let text = String(value ?? "").trim();
  if (!text) return 0;

  text = text.replace(/\s/g, "").replace(/R\$/gi, "");
  if (text.includes(",") && text.includes(".")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }
  return Number(text) || 0;
}

function formatBRL(value) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      field += '"';
      i++;
    } else if (char === '"') {
      insideQuotes = !insideQuotes;
    } else if (char === "," && !insideQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i++;
      row.push(field);
      if (row.some(cell => cell.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some(cell => cell.trim() !== "")) rows.push(row);
  return rows;
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(item =>
    item.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  );

  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = (row[index] ?? "").trim();
    });
    return obj;
  });
}

function resolveImage(imageValue) {
  const image = String(imageValue || "").trim();
  if (!image) return `${IMAGE_BASE_PATH}presente-padrao.jpg`;
  if (/^https?:\/\//i.test(image)) return image;
  return `${IMAGE_BASE_PATH}${image}`;
}

function createGiftCard(gift) {
  const value = parseMoney(gift.valor);
  const title = gift.nome || "Presente";
  const description = gift.descricao || "";
  const image = resolveImage(gift.imagem);
  const url = gift.link_pagamento || "";

  return `
    <article class="gift-card"
      data-title="${escapeHtml(title)}"
      data-price="${value}"
      data-payment-url="${escapeHtml(url)}">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(title)}" loading="lazy">
      <div class="gift-content">
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
        <strong class="price">${formatBRL(value)}</strong>
        <button class="button gift-button" type="button">Presentear</button>
      </div>
    </article>
  `;
}

function configureGiftButtons() {
  document.querySelectorAll(".gift-button").forEach(button => {
    button.addEventListener("click", () => {
      const card = button.closest(".gift-card");
      if (!card || !dialog) return;

      const title = card.dataset.title || "Presente";
      const price = Number(card.dataset.price || 0);
      const url = card.dataset.paymentUrl || "";

      selectedPrice = price.toFixed(2).replace(".", ",");
      dialogTitle.textContent = title;
      dialogPrice.textContent = formatBRL(price);
      paymentLink.dataset.url = url;
      paymentLink.href = /^https?:\/\//i.test(url) ? url : "#";

      dialog.showModal();
    });
  });
}

async function loadGifts() {
  if (!SHEET_URL || SHEET_URL.includes("COLE_AQUI")) {
    statusBox.className = "gift-status error";
    statusBox.innerHTML = `
      A URL da planilha ainda não foi configurada.
      Abra <strong>js/config.js</strong> e cole a URL CSV publicada pelo Google Planilhas.
    `;
    return;
  }

  try {
    const separator = SHEET_URL.includes("?") ? "&" : "?";
    const response = await fetch(`${SHEET_URL}${separator}cache=${Date.now()}`, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Resposta HTTP ${response.status}`);
    }

    const csvText = await response.text();
    const gifts = rowsToObjects(parseCsv(csvText))
      .filter(gift => String(gift.ativo || "").trim().toUpperCase() === "SIM")
      .sort((a, b) => Number(a.ordem || 9999) - Number(b.ordem || 9999));

    if (!gifts.length) {
      throw new Error("Nenhum presente ativo foi encontrado.");
    }

    grid.innerHTML = gifts.map(createGiftCard).join("");
    statusBox.hidden = true;
    configureGiftButtons();
  } catch (error) {
    console.error("Erro ao carregar presentes:", error);
    statusBox.className = "gift-status error";
    statusBox.textContent =
      "Não foi possível carregar a lista de presentes. Verifique a publicação da planilha e tente novamente.";
  }
}

document.querySelectorAll("[data-copy]").forEach(button => {
  button.addEventListener("click", () => {
    copyText(button.dataset.copy || PIX_KEY, "Chave Pix copiada.");
  });
});

copyPriceButton.addEventListener("click", () => {
  copyText(selectedPrice, "Valor copiado.");
});

paymentLink.addEventListener("click", event => {
  const url = paymentLink.dataset.url || "";
  if (!/^https?:\/\//i.test(url)) {
    event.preventDefault();
    showToast("O link de pagamento deste presente ainda não foi cadastrado.");
  }
});

loadGifts();
