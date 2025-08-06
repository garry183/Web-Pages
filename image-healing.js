/**
 * Image Self-Healing Module
 * Provides intelligent image loading with fallbacks, caching, and error recovery
 */

class ImageSelfHealingService {
    constructor(config = {}) {
        this.config = {
            maxRetries: 3,
            retryDelay: 1000,
            fallbackImages: [
                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM2MCIgdmlld0JveD0iMCAwIDY0MCAzNjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2NDAiIGhlaWdodD0iMzYwIiBmaWxsPSIjMGEwYTBhIi8+Cjx0ZXh0IHg9IjMyMCIgeT0iMTgwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjMDBmZmNjIiBmb250LWZhbWlseT0iQ291cmllciBOZXciIGZvbnQtc2l6ZT0iMjQiPkFJIFZJREVPPC90ZXh0Pgo8L3N2Zz4K',
                'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgdmlld0JveD0iMCAwIDEwMCAxMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjUwIiBjeT0iNTAiIHI9IjUwIiBmaWxsPSIjMGEwYTBhIi8+Cjx0ZXh0IHg9IjUwIiB5PSI1NSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzAwZmZjYyIgZm9udC1mYW1pbHk9IkNvdXJpZXIgTmV3IiBmb250LXNpemU9IjEyIj5BSTwvdGV4dD4KPC9zdmc+Cg=='
            ],
            cachePrefix: 'image-cache-',
            cacheExpiryTime: 24 * 60 * 60 * 1000, // 24 hours
            healthCheckInterval: 5 * 60 * 1000, // 5 minutes
            ...config
        };
        
        this.cache = new Map();
        this.failedUrls = new Set();
        this.healthyUrls = new Set();
        this.metrics = {
            totalRequests: 0,
            successfulLoads: 0,
            fallbacksUsed: 0,
            cacheHits: 0,
            retries: 0
        };
        
        this.initialize();
    }
    
    initialize() {
        this.setupImageObserver();
        this.loadCacheFromStorage();
        this.startHealthCheck();
        console.log('🖼️ Image Self-Healing Service initialized');
    }
    
    /**
     * Enhanced image loading with self-healing capabilities
     */
    async loadImageWithHealing(url, type = 'thumbnail') {
        this.metrics.totalRequests++;
        
        // Check if URL is known to be failed
        if (this.failedUrls.has(url)) {
            console.log(`🚫 Skipping known failed URL: ${url}`);
            return this.getFallbackImage(type);
        }
        
        // Check cache first
        const cached = this.getFromCache(url);
        if (cached) {
            this.metrics.cacheHits++;
            return cached;
        }
        
        // Attempt to load with retries
        for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
            try {
                const imageUrl = await this.loadImageWithTimeout(url, 10000);
                
                // Success - cache and return
                this.setCache(url, imageUrl);
                this.healthyUrls.add(url);
                this.metrics.successfulLoads++;
                return imageUrl;
                
            } catch (error) {
                console.warn(`🔄 Image load attempt ${attempt} failed for ${url}:`, error.message);
                
                if (attempt === this.config.maxRetries) {
                    // All attempts failed
                    this.failedUrls.add(url);
                    this.metrics.fallbacksUsed++;
                    return this.getFallbackImage(type);
                }
                
                // Wait before retry
                await this.wait(this.config.retryDelay * attempt);
                this.metrics.retries++;
            }
        }
    }
    
    /**
     * Load image with timeout promise
     */
    loadImageWithTimeout(url, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const timeoutId = setTimeout(() => {
                reject(new Error(`Image load timeout: ${url}`));
            }, timeout);
            
            img.onload = () => {
                clearTimeout(timeoutId);
                resolve(url);
            };
            
            img.onerror = () => {
                clearTimeout(timeoutId);
                reject(new Error(`Image load error: ${url}`));
            };
            
            // Add CORS handling
            img.crossOrigin = 'anonymous';
            img.src = url;
        });
    }
    
    /**
     * Get appropriate fallback image
     */
    getFallbackImage(type) {
        switch (type) {
            case 'thumbnail':
                return this.config.fallbackImages[0]; // Video thumbnail fallback
            case 'avatar':
                return this.config.fallbackImages[1]; // Avatar fallback
            default:
                return this.config.fallbackImages[0];
        }
    }
    
    /**
     * Setup intersection observer for lazy loading with self-healing
     */
    setupImageObserver() {
        if (!('IntersectionObserver' in window)) {
            console.warn('⚠️ IntersectionObserver not supported - using immediate loading');
            return;
        }
        
        this.imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    this.healImage(img);
                    this.imageObserver.unobserve(img);
                }
            });
        }, {
            rootMargin: '50px' // Start loading 50px before image comes into view
        });
    }
    
    /**
     * Apply self-healing to an image element
     */
    async healImage(img) {
        if (!img || !img.dataset.src) return;
        
        const originalSrc = img.dataset.src;
        const type = img.dataset.imageType || 'thumbnail';
        
        try {
            // Show loading placeholder
            img.style.opacity = '0.5';
            img.style.filter = 'blur(2px)';
            
            const healedUrl = await this.loadImageWithHealing(originalSrc, type);
            
            // Apply healed image
            img.src = healedUrl;
            img.style.opacity = '1';
            img.style.filter = 'none';
            
            // Remove data-src to indicate healing is complete
            delete img.dataset.src;
            
        } catch (error) {
            console.error('❌ Image healing failed:', error);
            img.src = this.getFallbackImage(type);
            img.style.opacity = '1';
            img.style.filter = 'none';
        }
    }
    
    /**
     * Auto-heal all images on the page
     */
    healAllImages() {
        const images = document.querySelectorAll('img[data-src]');
        console.log(`🔧 Healing ${images.length} images...`);
        
        images.forEach(img => {
            if (this.imageObserver) {
                this.imageObserver.observe(img);
            } else {
                this.healImage(img);
            }
        });
    }
    
    /**
     * Cache management
     */
    getFromCache(url) {
        const cached = this.cache.get(url);
        if (!cached) return null;
        
        if (Date.now() > cached.expires) {
            this.cache.delete(url);
            return null;
        }
        
        return cached.url;
    }
    
    setCache(url, healedUrl) {
        this.cache.set(url, {
            url: healedUrl,
            timestamp: Date.now(),
            expires: Date.now() + this.config.cacheExpiryTime
        });
        
        // Save to localStorage
        this.saveCacheToStorage();
    }
    
    /**
     * Storage persistence
     */
    saveCacheToStorage() {
        try {
            const cacheData = {
                cache: Array.from(this.cache.entries()),
                failedUrls: Array.from(this.failedUrls),
                healthyUrls: Array.from(this.healthyUrls),
                timestamp: Date.now()
            };
            
            localStorage.setItem(`${this.config.cachePrefix}data`, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('⚠️ Could not save image cache to localStorage:', error);
        }
    }
    
    loadCacheFromStorage() {
        try {
            const stored = localStorage.getItem(`${this.config.cachePrefix}data`);
            if (!stored) return;
            
            const data = JSON.parse(stored);
            
            // Check if stored data is not too old (24 hours)
            if (Date.now() - data.timestamp > 24 * 60 * 60 * 1000) {
                localStorage.removeItem(`${this.config.cachePrefix}data`);
                return;
            }
            
            // Restore cache and URL sets
            this.cache = new Map(data.cache || []);
            this.failedUrls = new Set(data.failedUrls || []);
            this.healthyUrls = new Set(data.healthyUrls || []);
            
            console.log(`📦 Restored image cache: ${this.cache.size} entries, ${this.failedUrls.size} failed URLs`);
            
        } catch (error) {
            console.warn('⚠️ Could not load image cache from localStorage:', error);
        }
    }
    
    /**
     * Periodic health check of failed URLs
     */
    startHealthCheck() {
        setInterval(() => {
            this.performImageHealthCheck();
        }, this.config.healthCheckInterval);
    }
    
    async performImageHealthCheck() {
        if (this.failedUrls.size === 0) return;
        
        console.log(`🏥 Performing health check on ${this.failedUrls.size} failed URLs...`);
        
        const urlsToRetest = Array.from(this.failedUrls).slice(0, 5); // Test max 5 URLs per check
        
        for (const url of urlsToRetest) {
            try {
                await this.loadImageWithTimeout(url, 5000);
                
                // URL is healthy again
                this.failedUrls.delete(url);
                this.healthyUrls.add(url);
                console.log(`✅ URL recovered: ${url}`);
                
                // Trigger re-healing of images using this URL
                this.rehealImagesWithUrl(url);
                
            } catch (error) {
                // Still failed, keep in failed set
                console.log(`🚫 URL still failed: ${url}`);
            }
        }
        
        this.saveCacheToStorage();
    }
    
    /**
     * Re-heal images that were using a now-recovered URL
     */
    rehealImagesWithUrl(url) {
        const images = document.querySelectorAll(`img[src*="data:image/svg+xml"]`);
        images.forEach(img => {
            const originalUrl = img.dataset.originalSrc;
            if (originalUrl === url) {
                img.dataset.src = url;
                this.healImage(img);
            }
        });
    }
    
    /**
     * Clean up expired cache entries
     */
    cleanupCache() {
        const now = Date.now();
        for (const [url, cached] of this.cache.entries()) {
            if (now > cached.expires) {
                this.cache.delete(url);
            }
        }
        
        console.log(`🧹 Image cache cleanup completed, ${this.cache.size} entries remaining`);
        this.saveCacheToStorage();
    }
    
    /**
     * Get diagnostics information
     */
    getDiagnostics() {
        return {
            metrics: this.metrics,
            cacheSize: this.cache.size,
            failedUrls: this.failedUrls.size,
            healthyUrls: this.healthyUrls.size,
            successRate: this.metrics.totalRequests > 0 ? 
                (this.metrics.successfulLoads / this.metrics.totalRequests * 100).toFixed(1) + '%' : 'N/A',
            fallbackRate: this.metrics.totalRequests > 0 ? 
                (this.metrics.fallbacksUsed / this.metrics.totalRequests * 100).toFixed(1) + '%' : 'N/A',
            cacheHitRate: this.metrics.totalRequests > 0 ? 
                (this.metrics.cacheHits / this.metrics.totalRequests * 100).toFixed(1) + '%' : 'N/A'
        };
    }
    
    /**
     * Utility function for delays
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Reset failed URLs (useful for testing or manual recovery)
     */
    resetFailedUrls() {
        this.failedUrls.clear();
        console.log('🔄 Failed URLs list has been cleared');
        this.saveCacheToStorage();
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageSelfHealingService;
}

console.log('🖼️ Image Self-Healing Service module loaded');