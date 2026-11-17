// Configuração da API - Piratinha Transporte
// Em ambiente local (Docker / localhost), usa http://localhost:3000/api
// Em produção (Vercel), altere a URL abaixo para a URL pública do seu backend (ex: Railway, Render, VPS ou túnel)
(function () {
  const isLocal =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:';

  window.API_BASE_URL = isLocal
    ? 'http://localhost:3000/api'
    : 'https://backend-ttshoks-projects.vercel.app/api';
})();
