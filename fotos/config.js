/*
  Configure apenas esta URL depois de publicar o backend na Vercel.
  Exemplo: https://casamento-fotos-api.vercel.app
*/
window.PHOTO_UPLOAD_CONFIG = {
  apiBaseUrl: "https://SEU-BACKEND.vercel.app",
  eventPublicKey: "troque-por-uma-chave-publica-aleatoria",
  maxFilesPerBatch: 50,
  maxFileSizeMB: 2048,
  uploadConcurrency: 2,
  chunkSizeBytes: 5 * 1024 * 1024,
};
