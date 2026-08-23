const CACHE_NAME = 'treino-app-v1';

self.addEventListener('install', (event) => {
    console.log('Service Worker instalado com sucesso.');
});

self.addEventListener('fetch', (event) => {
    // Por enquanto, apenas repassa as requisições para a rede normalmente
    event.respondWith(fetch(event.request));
});