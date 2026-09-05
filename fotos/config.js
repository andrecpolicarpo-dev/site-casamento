/*
  Configure apenas esta URL depois de publicar o backend na Vercel.
  Exemplo: https://casamento-fotos-api.vercel.app
*/
window.PHOTO_UPLOAD_CONFIG = {
  apiBaseUrl: "https://casamento-fotos-api.vercel.app",
  eventPublicKey: "01b2c12008434ead8eb7757c94d0967d",
  maxFilesPerBatch: 50,
  maxFileSizeMB: 2048,
  uploadConcurrency: 2,
  chunkSizeBytes: 5 * 1024 * 1024,
};
