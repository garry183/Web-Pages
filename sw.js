/**
 * Service Worker for AI Video Explorer
 * Provides offline caching, background sync, and enhanced self-healing capabilities
 */

const CACHE_NAME = 'ai-video-explorer-v1';
const STATIC_CACHE = 'static-v1';
const API_CACHE = 'api-v1';
const IMAGE_CACHE = 'images-v1';

// Assets to cache immediately
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/self-healing.js',
    '/image-healing.js',
    '/config.json',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('🔧 Service Worker: Installing...');
    
    event.waitUntil(
        caches.open(STATIC_CACHE)
            .then((cache) => {
                console.log('📦 Service Worker: Caching static assets');
                return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
            })
            .then(() => {
                console.log('✅ Service Worker: Installation complete');
                return self.skipWaiting();
            })
            .catch((error) => {
                console.error('❌ Service Worker: Installation failed', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('🚀 Service Worker: Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== STATIC_CACHE && cacheName !== API_CACHE && cacheName !== IMAGE_CACHE) {
                            console.log('🗑️ Service Worker: Deleting old cache', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('✅ Service Worker: Activation complete');
                return self.clients.claim();
            })
    );
});

// Fetch event - network-first with cache fallback and self-healing
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);
    
    // Handle different types of requests with appropriate strategies
    if (request.method === 'GET') {
        if (isApiRequest(request)) {
            event.respondWith(handleApiRequest(request));
        } else if (isImageRequest(request)) {
            event.respondWith(handleImageRequest(request));
        } else if (isStaticAsset(request)) {
            event.respondWith(handleStaticAsset(request));
        } else {
            event.respondWith(handleGeneralRequest(request));
        }
    }
});

// Check if request is an API call
function isApiRequest(request) {
    return request.url.includes('/youtube/v3/') || 
           request.url.includes('googleapis.com');
}

// Check if request is for an image
function isImageRequest(request) {
    return request.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i) ||
           request.url.includes('picsum.photos') ||
           request.url.includes('placeholder');
}

// Check if request is for a static asset
function isStaticAsset(request) {
    return STATIC_ASSETS.some(asset => request.url.endsWith(asset)) ||
           request.url.includes('cdnjs.cloudflare.com');
}

// Handle API requests with network-first strategy
async function handleApiRequest(request) {
    const cache = await caches.open(API_CACHE);
    
    try {
        // Try network first
        const response = await fetch(request);
        
        if (response.ok) {
            // Cache successful API responses
            const responseClone = response.clone();
            cache.put(request, responseClone);
            
            console.log('🌐 Service Worker: API request successful, cached', request.url);
            return response;
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.warn('⚠️ Service Worker: API request failed, checking cache', error.message);
        
        // Fallback to cache
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            console.log('📦 Service Worker: Serving API request from cache', request.url);
            
            // Add custom header to indicate cached response
            const responseHeaders = new Headers(cachedResponse.headers);
            responseHeaders.set('X-Served-By', 'ServiceWorker-Cache');
            
            return new Response(cachedResponse.body, {
                status: cachedResponse.status,
                statusText: cachedResponse.statusText,
                headers: responseHeaders
            });
        }
        
        // Return empty but valid response for graceful degradation
        console.log('🎭 Service Worker: No cache available, returning fallback response');
        return new Response(JSON.stringify({
            items: [],
            error: {
                type: 'offline',
                message: 'Service unavailable - using offline mode'
            }
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
}

// Handle image requests with cache-first strategy
async function handleImageRequest(request) {
    const cache = await caches.open(IMAGE_CACHE);
    
    try {
        // Check cache first for images
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
            console.log('📦 Service Worker: Serving image from cache', request.url);
            return cachedResponse;
        }
        
        // Try network
        const response = await fetch(request, { timeout: 10000 });
        
        if (response.ok) {
            // Cache successful image responses
            const responseClone = response.clone();
            cache.put(request, responseClone);
            
            console.log('🌐 Service Worker: Image loaded and cached', request.url);
            return response;
        } else {
            throw new Error(`HTTP ${response.status}`);
        }
    } catch (error) {
        console.warn('⚠️ Service Worker: Image request failed', error.message);
        
        // Return fallback image
        return generateFallbackImage(request);
    }
}

// Handle static assets with cache-first strategy
async function handleStaticAsset(request) {
    const cache = await caches.open(STATIC_CACHE);
    
    // Check cache first
    const cachedResponse = await cache.match(request);
    if (cachedResponse) {
        console.log('📦 Service Worker: Serving static asset from cache', request.url);
        return cachedResponse;
    }
    
    // Try network and cache the result
    try {
        const response = await fetch(request);
        if (response.ok) {
            const responseClone = response.clone();
            cache.put(request, responseClone);
            console.log('🌐 Service Worker: Static asset loaded and cached', request.url);
        }
        return response;
    } catch (error) {
        console.error('❌ Service Worker: Static asset request failed', error);
        
        // For critical assets like HTML, return a basic offline page
        if (request.url.endsWith('.html') || request.url === '/') {
            return generateOfflinePage();
        }
        
        return new Response('Asset not available offline', { status: 503 });
    }
}

// Handle general requests
async function handleGeneralRequest(request) {
    try {
        return await fetch(request);
    } catch (error) {
        console.warn('⚠️ Service Worker: General request failed', error.message);
        
        // Check if we have a cached version
        const cache = await caches.open(STATIC_CACHE);
        const cachedResponse = await cache.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }
        
        return new Response('Request failed and no cache available', { status: 503 });
    }
}

// Generate fallback image for failed image requests
function generateFallbackImage(request) {
    const isAvatar = request.url.includes('100/100') || request.url.includes('avatar');
    
    const svg = isAvatar ? 
        `<svg width="100" height="100" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="50" cy="50" r="50" fill="#0a0a0a"/>
            <text x="50" y="55" text-anchor="middle" fill="#00ffcc" font-family="Courier New" font-size="12">AI</text>
        </svg>` :
        `<svg width="640" height="360" viewBox="0 0 640 360" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect width="640" height="360" fill="#0a0a0a"/>
            <text x="320" y="180" text-anchor="middle" fill="#00ffcc" font-family="Courier New" font-size="24">OFFLINE</text>
            <text x="320" y="210" text-anchor="middle" fill="#888888" font-family="Courier New" font-size="14">Content unavailable</text>
        </svg>`;
    
    return new Response(svg, {
        headers: {
            'Content-Type': 'image/svg+xml',
            'X-Served-By': 'ServiceWorker-Fallback'
        }
    });
}

// Generate offline page
function generateOfflinePage() {
    const offlineHTML = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>AI Video Explorer - Offline</title>
            <style>
                body {
                    font-family: 'Courier New', monospace;
                    background: #0a0a0a;
                    color: #00ffcc;
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    min-height: 100vh;
                    margin: 0;
                    text-align: center;
                }
                .offline-container {
                    max-width: 600px;
                    padding: 40px;
                    background: rgba(0, 20, 40, 0.8);
                    border: 1px solid #00ffcc;
                    border-radius: 16px;
                }
                h1 { color: #00ffcc; margin-bottom: 20px; }
                .status { color: #ffaa00; margin-bottom: 30px; }
                button {
                    background: linear-gradient(135deg, rgba(0, 30, 60, 0.8), rgba(0, 20, 40, 0.8));
                    border: 1px solid #00ffcc;
                    color: #00ffcc;
                    padding: 12px 24px;
                    border-radius: 6px;
                    cursor: pointer;
                    font-family: inherit;
                    margin: 10px;
                }
                button:hover {
                    background: linear-gradient(135deg, rgba(0, 50, 100, 0.9), rgba(0, 30, 60, 0.9));
                }
            </style>
        </head>
        <body>
            <div class="offline-container">
                <h1>🛡️ AI VIDEO EXPLORER</h1>
                <div class="status">[ OFFLINE MODE ACTIVATED ]</div>
                <p>You are currently offline. The self-healing system has activated offline mode.</p>
                <p>Some features may be limited, but cached content is still available.</p>
                <button onclick="location.reload()">🔄 Try Again</button>
                <button onclick="history.back()">◀️ Go Back</button>
            </div>
            <script>
                // Auto-retry when connection is restored
                window.addEventListener('online', () => {
                    console.log('🌐 Connection restored - reloading...');
                    location.reload();
                });
            </script>
        </body>
        </html>
    `;
    
    return new Response(offlineHTML, {
        headers: {
            'Content-Type': 'text/html',
            'X-Served-By': 'ServiceWorker-Offline'
        }
    });
}

// Background sync for failed requests
self.addEventListener('sync', (event) => {
    console.log('🔄 Service Worker: Background sync triggered', event.tag);
    
    if (event.tag === 'background-sync-retry') {
        event.waitUntil(retryFailedRequests());
    }
});

// Retry failed requests when connection is restored
async function retryFailedRequests() {
    console.log('🔄 Service Worker: Retrying failed requests...');
    
    // This would typically work with IndexedDB to store failed requests
    // For now, we'll just clear caches to force fresh requests
    try {
        const cacheNames = await caches.keys();
        await Promise.all(
            cacheNames.map(cacheName => {
                if (cacheName === API_CACHE) {
                    return caches.delete(cacheName);
                }
            })
        );
        console.log('✅ Service Worker: API cache cleared for fresh requests');
    } catch (error) {
        console.error('❌ Service Worker: Failed to clear cache', error);
    }
}

// Push event for notifications (future enhancement)
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '/icon-192x192.png',
            badge: '/icon-72x72.png',
            tag: 'ai-video-explorer'
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    
    event.waitUntil(
        clients.openWindow('/')
    );
});

console.log('📋 Service Worker: Script loaded and ready');