(() => {
  "use strict";

  const config = Object.assign({
    apiBaseUrl: "",
    eventPublicKey: "",
    maxFilesPerBatch: 50,
    maxFileSizeMB: 2048,
    uploadConcurrency: 2,
    chunkSizeBytes: 5 * 1024 * 1024,
  }, window.PHOTO_UPLOAD_CONFIG || {});

  // 5 MiB = 16 x 320 KiB, compatível com a exigência do Microsoft Graph.
  const GRAPH_BLOCK = 320 * 1024;
  if (config.chunkSizeBytes % GRAPH_BLOCK !== 0) {
    console.warn("chunkSizeBytes deve ser múltiplo de 320 KiB. Usando 5 MiB.");
    config.chunkSizeBytes = 5 * 1024 * 1024;
  }

  const els = {
    form: document.querySelector("#upload-form"),
    guestName: document.querySelector("#guest-name"),
    cameraFallbackInput: document.querySelector("#camera-fallback-input"),
    galleryInput: document.querySelector("#gallery-input"),
    cameraModal: document.querySelector("#camera-modal"),
    cameraVideo: document.querySelector("#camera-video"),
    cameraCanvas: document.querySelector("#camera-canvas"),
    cameraLoading: document.querySelector("#camera-loading"),
    cameraClose: document.querySelector("#camera-close"),
    cameraSwitch: document.querySelector("#camera-switch"),
    cameraShutter: document.querySelector("#camera-shutter"),
    selectionPanel: document.querySelector("#selection-panel"),
    selectionCount: document.querySelector("#selection-count"),
    fileList: document.querySelector("#file-list"),
    clearSelection: document.querySelector("#clear-selection"),
    submitButton: document.querySelector("#submit-button"),
    uploadSummary: document.querySelector("#upload-summary"),
    totalProgressBar: document.querySelector("#total-progress-bar"),
    totalProgressLabel: document.querySelector("#total-progress-label"),
    uploadStatusText: document.querySelector("#upload-status-text"),
    successCard: document.querySelector("#success-card"),
    successMessage: document.querySelector("#success-message"),
    sendMoreButton: document.querySelector("#send-more-button"),
    toast: document.querySelector("#toast"),
  };

  let queue = [];
  let isUploading = false;
  let toastTimer = null;
  const cameraState = {
    stream: null,
    devices: [],
    activeDeviceId: "",
    facingMode: "environment",
  };

  const savedGuestName = localStorage.getItem("weddingGuestName");
  if (savedGuestName) els.guestName.value = savedGuestName;

  document.querySelector('[data-picker="camera"]').addEventListener("click", openCamera);
  document.querySelector('[data-picker="gallery"]').addEventListener("click", () => els.galleryInput.click());

  els.cameraFallbackInput.addEventListener("change", () => consumeInput(els.cameraFallbackInput, "camera"));
  els.galleryInput.addEventListener("change", () => consumeInput(els.galleryInput, "galeria"));
  els.cameraClose.addEventListener("click", closeCamera);
  els.cameraSwitch.addEventListener("click", switchCamera);
  els.cameraShutter.addEventListener("click", captureCameraPhoto);

  els.guestName.addEventListener("input", () => {
    const name = els.guestName.value.trim();
    if (name) localStorage.setItem("weddingGuestName", name);
    else localStorage.removeItem("weddingGuestName");
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !els.cameraModal.hidden) closeCamera();
  });
  window.addEventListener("pagehide", stopCameraStream);

  els.clearSelection.addEventListener("click", () => {
    if (isUploading) return;
    queue.forEach(releasePreview);
    queue = [];
    renderQueue();
  });

  els.form.addEventListener("submit", handleSubmit);
  els.sendMoreButton.addEventListener("click", () => {
    els.successCard.hidden = true;
    document.querySelector(".uploader-card").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  function consumeInput(input, source) {
    const files = Array.from(input.files || []);
    input.value = "";
    addFiles(files, source);
  }

  function openCamera() {
  els.cameraFallbackInput.click();
}

  async function startCamera({ deviceId = "", facingMode = "environment" } = {}) {
    stopCameraStream();
    els.cameraLoading.hidden = false;
    els.cameraShutter.disabled = true;
    els.cameraSwitch.disabled = true;

    const video = {
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    };
    if (deviceId) video.deviceId = { exact: deviceId };
    else video.facingMode = { ideal: facingMode };

    const stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    cameraState.stream = stream;
    els.cameraVideo.srcObject = stream;
    await els.cameraVideo.play();

    const track = stream.getVideoTracks()[0];
    const settings = track?.getSettings?.() || {};
    cameraState.activeDeviceId = settings.deviceId || deviceId || "";
    cameraState.facingMode = settings.facingMode || facingMode || cameraState.facingMode;

    try {
      cameraState.devices = (await navigator.mediaDevices.enumerateDevices())
        .filter(device => device.kind === "videoinput");
    } catch {
      cameraState.devices = [];
    }

    els.cameraLoading.hidden = true;
    els.cameraShutter.disabled = false;
    // Mesmo quando a lista de dispositivos não é exposta, facingMode pode permitir a troca.
    els.cameraSwitch.disabled = false;
  }

  async function switchCamera() {
    if (els.cameraSwitch.disabled) return;
    els.cameraSwitch.disabled = true;
    els.cameraShutter.disabled = true;
    els.cameraLoading.hidden = false;
    els.cameraLoading.textContent = "Trocando câmera…";

    try {
      const devices = cameraState.devices;
      if (devices.length > 1 && cameraState.activeDeviceId) {
        const currentIndex = Math.max(0, devices.findIndex(device => device.deviceId === cameraState.activeDeviceId));
        const next = devices[(currentIndex + 1) % devices.length];
        const nextFacing = cameraState.facingMode === "user" ? "environment" : "user";
        await startCamera({ deviceId: next.deviceId, facingMode: nextFacing });
      } else {
        const nextFacing = cameraState.facingMode === "user" ? "environment" : "user";
        await startCamera({ facingMode: nextFacing });
      }
    } catch (error) {
      console.error("switch camera error", error);
      els.cameraLoading.hidden = true;
      els.cameraShutter.disabled = false;
      els.cameraSwitch.disabled = false;
      showToast("Não foi possível trocar a câmera neste aparelho.");
    }
  }

  async function captureCameraPhoto() {
    const video = els.cameraVideo;
    if (!cameraState.stream || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      showToast("A câmera ainda está carregando.");
      return;
    }

    els.cameraShutter.disabled = true;
    const canvas = els.cameraCanvas;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d", { alpha: false });
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.94));
    if (!blob) {
      els.cameraShutter.disabled = false;
      showToast("Não foi possível capturar a foto. Tente novamente.");
      return;
    }

    const file = new File([blob], cameraFilename(), {
      type: "image/jpeg",
      lastModified: Date.now(),
    });
    const source = cameraState.facingMode === "user" ? "camera-frontal" : "camera-traseira";
    addFiles([file], source);
    closeCamera();
    showToast("Foto adicionada. Confira a seleção antes de enviar.");
  }

  function closeCamera() {
    stopCameraStream();
    els.cameraModal.hidden = true;
    document.body.classList.remove("camera-open");
    els.cameraLoading.hidden = false;
    els.cameraLoading.textContent = "Abrindo câmera…";
  }

  function stopCameraStream() {
    if (cameraState.stream) {
      cameraState.stream.getTracks().forEach(track => track.stop());
      cameraState.stream = null;
    }
    if (els.cameraVideo) els.cameraVideo.srcObject = null;
  }

  function cameraFilename() {
    const date = new Date();
    const pad = value => String(value).padStart(2, "0");
    return `Foto_${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}.jpg`;
  }

  function cameraAccessMessage(error) {
    const name = String(error?.name || "");
    if (/NotAllowed|PermissionDenied/i.test(name)) return "Permita o acesso à câmera no navegador para fotografar pelo site.";
    if (/NotFound|DevicesNotFound/i.test(name)) return "Não encontramos uma câmera disponível neste aparelho.";
    return "Não foi possível abrir a câmera. Você ainda pode escolher fotos pela galeria.";
  }

  function addFiles(files, source) {
    if (!files.length) return;

    const remainingSlots = Math.max(0, config.maxFilesPerBatch - queue.length);
    if (remainingSlots === 0) {
      showToast(`Você já selecionou o limite de ${config.maxFilesPerBatch} arquivos neste envio.`);
      return;
    }

    const accepted = [];
    const rejected = [];
    const maxBytes = config.maxFileSizeMB * 1024 * 1024;

    files.slice(0, remainingSlots).forEach(file => {
      const isMedia = isSupportedMedia(file);
      if (!isMedia || file.size <= 0 || file.size > maxBytes) {
        rejected.push(file.name || "arquivo");
        return;
      }

      const duplicate = queue.some(item =>
        item.file.name === file.name && item.file.size === file.size && item.file.lastModified === file.lastModified
      );
      if (duplicate) return;

      accepted.push({
        id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
        file,
        source,
        progress: 0,
        status: "pending",
        error: "",
        savedFileName: "",
        previewUrl: file.type.startsWith("image/") ? URL.createObjectURL(file) : "",
      });
    });

    queue.push(...accepted);
    renderQueue();

    if (files.length > remainingSlots) {
      showToast(`Foram adicionados os primeiros ${remainingSlots} arquivos. O limite por envio é ${config.maxFilesPerBatch}.`);
    } else if (rejected.length) {
      showToast(`Alguns arquivos não foram adicionados. Use fotos/vídeos de até ${config.maxFileSizeMB} MB.`);
    }
  }

  function isSupportedMedia(file) {
    if (file.type && (file.type.startsWith("image/") || file.type.startsWith("video/"))) return true;
    const ext = extensionOf(file.name);
    return ["jpg","jpeg","png","heic","heif","webp","gif","avif","mp4","mov","m4v","webm","3gp","avi"].includes(ext);
  }

  function extensionOf(name) {
    const index = String(name || "").lastIndexOf(".");
    return index >= 0 ? name.slice(index + 1).toLowerCase() : "";
  }

  function renderQueue() {
    els.fileList.innerHTML = "";
    els.selectionPanel.hidden = queue.length === 0;
    els.selectionCount.textContent = `${queue.length} ${queue.length === 1 ? "arquivo" : "arquivos"}`;

    queue.forEach(item => {
      const row = document.createElement("div");
      row.className = "file-row";
      row.dataset.id = item.id;

      let preview;
      if (item.previewUrl) {
        preview = document.createElement("img");
        preview.src = item.previewUrl;
        preview.alt = "";
        preview.className = "file-thumb";
      } else {
        preview = document.createElement("div");
        preview.className = "video-thumb";
        preview.textContent = "▶";
        preview.setAttribute("aria-hidden", "true");
      }

      const meta = document.createElement("div");
      meta.className = "file-meta";
      meta.innerHTML = `
        <span class="file-name"></span>
        <div class="file-detail">${formatBytes(item.file.size)} · ${sourceLabel(item.source)}</div>
        <div class="file-progress" ${item.status === "pending" ? "hidden" : ""}>
          <div class="progress-track"><div class="progress-bar" style="width:${item.progress}%"></div></div>
        </div>
        <div class="file-state ${stateClass(item.status)}">${stateLabel(item)}</div>
      `;
      meta.querySelector(".file-name").textContent = item.file.name || "arquivo";

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "remove-file";
      remove.setAttribute("aria-label", `Remover ${item.file.name}`);
      remove.textContent = "×";
      remove.disabled = isUploading || item.status === "uploading" || item.status === "success";
      remove.addEventListener("click", () => removeItem(item.id));

      row.append(preview, meta, remove);
      els.fileList.appendChild(row);
    });

    updateSubmitState();
    updateTotalProgress();
  }

  function removeItem(id) {
    if (isUploading) return;
    const item = queue.find(entry => entry.id === id);
    if (item) releasePreview(item);
    queue = queue.filter(entry => entry.id !== id);
    renderQueue();
  }

  function releasePreview(item) {
    if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
  }

  function updateSubmitState() {
    const hasFiles = queue.some(item => item.status !== "success");
    els.submitButton.disabled = isUploading || !hasFiles;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (isUploading) return;

    const guestName = els.guestName.value.trim();

    const pending = queue.filter(item => item.status !== "success");
    if (!pending.length) return;

    if (!config.apiBaseUrl || config.apiBaseUrl.includes("SEU-BACKEND")) {
      showToast("O backend ainda não foi configurado em config.js.");
      return;
    }

    isUploading = true;
    els.uploadSummary.hidden = false;
    els.successCard.hidden = true;
    els.uploadStatusText.textContent = "Preparando seus arquivos…";
    pending.forEach(item => {
      if (item.status === "error") {
        item.status = "pending";
        item.error = "";
        item.progress = 0;
      }
    });
    renderQueue();

    const workers = Math.max(1, Math.min(Number(config.uploadConcurrency) || 2, 3));
    let nextIndex = 0;

    async function worker() {
      while (nextIndex < pending.length) {
        const item = pending[nextIndex++];
        try {
          await uploadOne(item, guestName);
        } catch (error) {
          console.error(error);
          item.status = "error";
          item.error = friendlyError(error);
          renderQueue();
        }
      }
    }

    await Promise.all(Array.from({ length: workers }, worker));

    isUploading = false;
    const failed = queue.filter(item => item.status === "error");
    const succeeded = queue.filter(item => item.status === "success");
    renderQueue();

    if (failed.length === 0) {
      els.uploadStatusText.textContent = "Tudo enviado com sucesso.";
      els.successMessage.textContent = `${succeeded.length} ${succeeded.length === 1 ? "arquivo foi enviado" : "arquivos foram enviados"} para Thaís & André.`;
      els.successCard.hidden = false;
      queue.forEach(releasePreview);
      queue = [];
      renderQueue();
      els.successCard.scrollIntoView({ behavior: "smooth", block: "center" });
    } else {
      els.uploadStatusText.textContent = `${failed.length} ${failed.length === 1 ? "arquivo não foi enviado" : "arquivos não foram enviados"}. Toque novamente em enviar para tentar só os que falharam.`;
      showToast("Alguns arquivos falharam. Sua seleção foi mantida para você tentar novamente.");
    }
  }

  async function uploadOne(item, guestName) {
    item.status = "uploading";
    item.progress = 0;
    renderQueue();

    let session = await createUploadSession(item, guestName);
    item.savedFileName = session.savedFileName || "";

    let offset = 0;
    let restartCount = 0;

    while (offset < item.file.size) {
      const endExclusive = Math.min(offset + config.chunkSizeBytes, item.file.size);
      const chunk = item.file.slice(offset, endExclusive);
      const endInclusive = endExclusive - 1;

      try {
        const response = await putChunkWithRetry(
          session.uploadUrl,
          chunk,
          offset,
          endInclusive,
          item.file.size
        );

        if (response.status === 200 || response.status === 201) {
          offset = item.file.size;
          item.progress = 100;
          item.status = "success";
          renderQueue();
          return;
        }

        if (response.status === 202) {
          const data = await safeJson(response);
          const expected = nextExpectedOffset(data?.nextExpectedRanges, endExclusive);
          offset = Math.max(endExclusive, expected);
        } else if (response.status === 416) {
          const status = await fetchUploadStatus(session.uploadUrl);
          offset = nextExpectedOffset(status?.nextExpectedRanges, offset);
        } else if (response.status === 404 && restartCount < 1) {
          restartCount += 1;
          session = await createUploadSession(item, guestName);
          offset = 0;
        } else {
          const details = await safeText(response);
          throw new Error(`UPLOAD_${response.status}: ${details || "Falha no envio"}`);
        }
      } catch (error) {
        if (restartCount < 1 && /404|expired|sessão/i.test(String(error.message || error))) {
          restartCount += 1;
          session = await createUploadSession(item, guestName);
          offset = 0;
          continue;
        }
        throw error;
      }

      item.progress = Math.min(99, Math.round((offset / item.file.size) * 100));
      updateFileVisual(item);
      updateTotalProgress();
    }
  }

  async function createUploadSession(item, guestName) {
    const endpoint = `${config.apiBaseUrl.replace(/\/$/, "")}/api/upload-session`;
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        guestName,
        originalName: item.file.name || "arquivo",
        fileSize: item.file.size,
        mimeType: item.file.type || "application/octet-stream",
        source: item.source,
        eventKey: config.eventPublicKey,
      }),
    });

    if (!response.ok) {
      const data = await safeJson(response);
      throw new Error(data?.message || data?.error || `Não foi possível iniciar o upload (${response.status}).`);
    }

    const data = await response.json();
    if (!data.uploadUrl) throw new Error("A sessão de upload não retornou uma URL válida.");
    return data;
  }

  async function putChunkWithRetry(uploadUrl, chunk, start, endInclusive, total) {
    const attempts = 4;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const response = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Range": `bytes ${start}-${endInclusive}/${total}`,
            "Content-Type": "application/octet-stream",
          },
          body: chunk,
        });

        if (response.status === 429 || response.status >= 500) {
          if (attempt === attempts - 1) return response;
          const retryAfter = Number(response.headers.get("Retry-After"));
          await sleep(Number.isFinite(retryAfter) ? retryAfter * 1000 : backoff(attempt));
          continue;
        }

        return response;
      } catch (error) {
        if (attempt === attempts - 1) throw error;
        await sleep(backoff(attempt));
      }
    }

    throw new Error("Não foi possível enviar o arquivo após várias tentativas.");
  }

  async function fetchUploadStatus(uploadUrl) {
    const response = await fetch(uploadUrl, { method: "GET" });
    if (!response.ok) throw new Error(`Não foi possível consultar a sessão (${response.status}).`);
    return response.json();
  }

  function nextExpectedOffset(ranges, fallback) {
    if (!Array.isArray(ranges) || !ranges.length) return fallback;
    const first = String(ranges[0]);
    const parsed = Number(first.split("-")[0]);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function updateFileVisual(item) {
    const row = els.fileList.querySelector(`[data-id="${CSS.escape(item.id)}"]`);
    if (!row) return;
    const bar = row.querySelector(".progress-bar");
    const state = row.querySelector(".file-state");
    const progressBox = row.querySelector(".file-progress");
    if (progressBox) progressBox.hidden = false;
    if (bar) bar.style.width = `${item.progress}%`;
    if (state) {
      state.textContent = stateLabel(item);
      state.className = `file-state ${stateClass(item.status)}`;
    }
  }

  function updateTotalProgress() {
    if (!queue.length) {
      els.totalProgressBar.style.width = "0%";
      els.totalProgressLabel.textContent = "0%";
      return;
    }
    const totalBytes = queue.reduce((sum, item) => sum + item.file.size, 0);
    const uploadedApprox = queue.reduce((sum, item) => sum + item.file.size * (item.progress / 100), 0);
    const percent = totalBytes ? Math.round((uploadedApprox / totalBytes) * 100) : 0;
    els.totalProgressBar.style.width = `${percent}%`;
    els.totalProgressLabel.textContent = `${percent}%`;
  }

  function stateLabel(item) {
    switch (item.status) {
      case "uploading": return `Enviando… ${item.progress}%`;
      case "success": return "Enviado ✓";
      case "error": return item.error || "Falha no envio";
      default: return "Pronto para enviar";
    }
  }

  function stateClass(status) {
    if (status === "success") return "success";
    if (status === "error") return "error";
    return "";
  }

  function sourceLabel(source) {
    if (source === "camera-traseira") return "câmera traseira";
    if (source === "camera-frontal") return "câmera frontal";
    if (source === "camera") return "câmera";
    return "galeria";
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
  }

  function friendlyError(error) {
    const message = String(error?.message || error || "Erro desconhecido");
    if (/Failed to fetch|NetworkError|Load failed/i.test(message)) return "Sem conexão. Tente novamente.";
    if (/janela de envio|encerrad|não está liberado/i.test(message)) return message;
    if (/limite|grande|size/i.test(message)) return "Arquivo acima do limite permitido.";
    return message.length > 95 ? "Falha no envio. Tente novamente." : message;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    els.toast.textContent = message;
    els.toast.hidden = false;
    toastTimer = setTimeout(() => { els.toast.hidden = true; }, 4500);
  }

  function backoff(attempt) { return Math.min(8000, 800 * (2 ** attempt)) + Math.floor(Math.random() * 250); }
  function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
  async function safeJson(response) { try { return await response.json(); } catch { return null; } }
  async function safeText(response) { try { return await response.text(); } catch { return ""; } }

  updateSubmitState();
})();
