/**
 * Self-Healing Framework - Additional Components
 * API Manager, UI Recovery, Cache Manager, and Error Reporter
 */

// API Manager Component with Circuit Breaker Pattern
class APIManager {
    constructor(config) {
        this.config = config;
        this.circuitBreakers = new Map();
        this.retryManager = new RetryManager(config);
    }

    async makeRequest(url, options = {}) {
        const circuitBreaker = this.getCircuitBreaker(url);
        
        if (circuitBreaker.state === 'open') {
            if (Date.now() - circuitBreaker.lastFailureTime > this.config.circuitBreakerTimeout) {
                circuitBreaker.state = 'half-open';
                console.log(`[APIManager] Circuit breaker for ${url} moving to half-open state`);
            } else {
                throw new Error(`Circuit breaker is open for ${url}. Too many failures.`);
            }
        }

        try {
            const result = await this.retryManager.executeWithRetry(
                async (attempt) => {
                    console.log(`[APIManager] Making request to ${url} (attempt ${attempt})`);
                    
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);

                    try {
                        const response = await fetch(url, {
                            ...options,
                            signal: controller.signal
                        });

                        clearTimeout(timeoutId);

                        if (!response.ok) {
                            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                        }

                        return response;
                    } catch (error) {
                        clearTimeout(timeoutId);
                        throw error;
                    }
                },
                {
                    operationId: `api_${url}`,
                    retryCondition: (error) => {
                        // Don't retry for client errors (4xx)
                        if (error.message.includes('HTTP 4')) {
                            return false;
                        }
                        return true;
                    }
                }
            );

            // Reset circuit breaker on success
            this.resetCircuitBreaker(url);
            return result;

        } catch (error) {
            this.recordFailure(url, error);
            throw error;
        }
    }

    getCircuitBreaker(url) {
        if (!this.circuitBreakers.has(url)) {
            this.circuitBreakers.set(url, {
                state: 'closed', // closed, open, half-open
                failureCount: 0,
                lastFailureTime: 0,
                successCount: 0
            });
        }
        return this.circuitBreakers.get(url);
    }

    recordFailure(url, error) {
        const circuitBreaker = this.getCircuitBreaker(url);
        circuitBreaker.failureCount++;
        circuitBreaker.lastFailureTime = Date.now();

        if (circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
            circuitBreaker.state = 'open';
            console.log(`[APIManager] Circuit breaker opened for ${url} after ${circuitBreaker.failureCount} failures`);
        }
    }

    resetCircuitBreaker(url) {
        const circuitBreaker = this.getCircuitBreaker(url);
        if (circuitBreaker.state === 'half-open') {
            circuitBreaker.successCount++;
            if (circuitBreaker.successCount >= 2) {
                circuitBreaker.state = 'closed';
                circuitBreaker.failureCount = 0;
                circuitBreaker.successCount = 0;
                console.log(`[APIManager] Circuit breaker closed for ${url} after successful requests`);
            }
        } else if (circuitBreaker.state === 'closed') {
            circuitBreaker.failureCount = Math.max(0, circuitBreaker.failureCount - 1);
        }
    }

    async resetAllCircuitBreakers() {
        console.log('[APIManager] Resetting all circuit breakers');
        for (const [url, breaker] of this.circuitBreakers) {
            breaker.state = 'closed';
            breaker.failureCount = 0;
            breaker.successCount = 0;
            breaker.lastFailureTime = 0;
        }
    }

    getCircuitBreakerStatus() {
        const status = {};
        for (const [url, breaker] of this.circuitBreakers) {
            status[url] = { ...breaker };
        }
        return status;
    }
}

// UI Recovery Component
class UIRecovery {
    constructor(config) {
        this.config = config;
        this.errorElements = new Set();
        this.recoveryStrategies = new Map();
        this.setupDefaultStrategies();
    }

    setupDefaultStrategies() {
        // Strategy for broken images
        this.recoveryStrategies.set('image', (element) => {
            if (element.tagName === 'IMG' && element.src) {
                console.log('[UIRecovery] Attempting to recover broken image:', element.src);
                
                // Try loading placeholder image
                const originalSrc = element.src;
                element.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjQwIiBoZWlnaHQ9IjM2MCIgdmlld0JveD0iMCAwIDY0MCAzNjAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSI2NDAiIGhlaWdodD0iMzYwIiBmaWxsPSIjMTExIi8+Cjx0ZXh0IHg9IjMyMCIgeT0iMTgwIiBmaWxsPSIjNjY2IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSIgZm9udC1mYW1pbHk9Im1vbm9zcGFjZSIgZm9udC1zaXplPSIxNiI+SW1hZ2UgdW5hdmFpbGFibGU8L3RleHQ+Cjwvc3ZnPg==';
                
                // Store original src for potential retry
                element.setAttribute('data-original-src', originalSrc);
                element.setAttribute('data-recovery-attempted', 'true');
                
                return true;
            }
            return false;
        });

        // Strategy for failed video loads
        this.recoveryStrategies.set('video', (element) => {
            if (element.tagName === 'VIDEO') {
                console.log('[UIRecovery] Attempting to recover failed video element');
                
                // Hide video and show placeholder
                element.style.display = 'none';
                
                const placeholder = document.createElement('div');
                placeholder.className = 'video-placeholder';
                placeholder.innerHTML = '<i class="fas fa-video-slash"></i><span>Video unavailable</span>';
                placeholder.style.cssText = 'display:flex;align-items:center;justify-content:center;background:#222;color:#666;font-size:14px;gap:8px;';
                
                element.parentNode.insertBefore(placeholder, element);
                element.setAttribute('data-recovery-attempted', 'true');
                
                return true;
            }
            return false;
        });

        // Strategy for missing elements
        this.recoveryStrategies.set('missing', (selector) => {
            console.log(`[UIRecovery] Attempting to recreate missing element: ${selector}`);
            
            if (selector === '#videoGrid') {
                const container = document.querySelector('.container');
                if (container) {
                    const videoGrid = document.createElement('div');
                    videoGrid.id = 'videoGrid';
                    videoGrid.className = 'video-grid';
                    videoGrid.style.display = 'none';
                    
                    const loadingIndicator = document.querySelector('#loadingIndicator');
                    if (loadingIndicator) {
                        container.insertBefore(videoGrid, loadingIndicator.nextSibling);
                    } else {
                        container.appendChild(videoGrid);
                    }
                    return true;
                }
            }
            
            if (selector === '#loadingIndicator') {
                const container = document.querySelector('.container');
                if (container) {
                    const loadingIndicator = document.createElement('div');
                    loadingIndicator.id = 'loadingIndicator';
                    loadingIndicator.className = 'loading';
                    loadingIndicator.innerHTML = `
                        <i class="fas fa-cog"></i>
                        <p>[ INITIALIZING QUANTUM PROCESSOR... ]</p>
                    `;
                    
                    const header = container.querySelector('header');
                    if (header) {
                        container.insertBefore(loadingIndicator, header.nextSibling);
                    } else {
                        container.appendChild(loadingIndicator);
                    }
                    return true;
                }
            }
            
            return false;
        });
    }

    async recover() {
        console.log('[UIRecovery] Starting UI recovery process');
        
        // Recover broken images
        this.recoverBrokenImages();
        
        // Recover failed videos
        this.recoverFailedVideos();
        
        // Check for missing critical elements
        this.recoverMissingElements();
        
        // Clear error tracking
        this.errorElements.clear();
        
        console.log('[UIRecovery] UI recovery process completed');
    }

    recoverBrokenImages() {
        const images = document.querySelectorAll('img:not([data-recovery-attempted])');
        images.forEach(img => {
            if (img.complete && img.naturalWidth === 0) {
                this.recoveryStrategies.get('image')(img);
            } else {
                // Setup error handler for future failures
                img.onerror = () => {
                    if (!img.getAttribute('data-recovery-attempted')) {
                        this.recoveryStrategies.get('image')(img);
                    }
                };
            }
        });
    }

    recoverFailedVideos() {
        const videos = document.querySelectorAll('video:not([data-recovery-attempted])');
        videos.forEach(video => {
            video.onerror = () => {
                if (!video.getAttribute('data-recovery-attempted')) {
                    this.recoveryStrategies.get('video')(video);
                }
            };
        });
    }

    recoverMissingElements() {
        const criticalSelectors = ['#videoGrid', '#loadingIndicator', '#videoModal'];
        
        criticalSelectors.forEach(selector => {
            if (!document.querySelector(selector)) {
                console.log(`[UIRecovery] Critical element missing: ${selector}`);
                this.recoveryStrategies.get('missing')(selector);
            }
        });
    }

    registerRecoveryStrategy(type, strategy) {
        this.recoveryStrategies.set(type, strategy);
    }

    trackErrorElement(element) {
        this.errorElements.add(element);
    }
}

// Cache Manager Component
class CacheManager {
    constructor(config) {
        this.config = config;
        this.cache = new Map();
        this.storage = this.getStorageEngine();
        this.prefix = 'sh_cache_';
    }

    async init() {
        // Load existing cache from storage
        await this.loadFromStorage();
        
        // Setup periodic cleanup
        this.setupCleanup();
    }

    getStorageEngine() {
        try {
            localStorage.setItem('__test__', 'test');
            localStorage.removeItem('__test__');
            return localStorage;
        } catch (error) {
            console.warn('[CacheManager] localStorage not available, using memory cache only');
            return null;
        }
    }

    async loadFromStorage() {
        if (!this.storage) return;

        try {
            const keys = Object.keys(this.storage).filter(key => key.startsWith(this.prefix));
            
            for (const key of keys) {
                const data = JSON.parse(this.storage.getItem(key));
                const cacheKey = key.replace(this.prefix, '');
                
                if (this.isValid(data)) {
                    this.cache.set(cacheKey, data);
                } else {
                    // Remove expired entries
                    this.storage.removeItem(key);
                }
            }
            
            console.log(`[CacheManager] Loaded ${this.cache.size} items from storage`);
        } catch (error) {
            console.error('[CacheManager] Error loading from storage:', error);
        }
    }

    set(key, data, ttl = this.config.cacheMaxAge) {
        const cacheItem = {
            data,
            timestamp: Date.now(),
            ttl
        };

        // Store in memory cache
        this.cache.set(key, cacheItem);

        // Store in persistent storage
        if (this.storage) {
            try {
                this.storage.setItem(this.prefix + key, JSON.stringify(cacheItem));
            } catch (error) {
                // Storage might be full, try cleanup
                this.cleanup();
                try {
                    this.storage.setItem(this.prefix + key, JSON.stringify(cacheItem));
                } catch (retryError) {
                    console.warn('[CacheManager] Failed to store in persistent cache:', retryError);
                }
            }
        }

        return cacheItem;
    }

    get(key) {
        const cacheItem = this.cache.get(key);
        
        if (!cacheItem) {
            return null;
        }

        if (this.isValid(cacheItem)) {
            return cacheItem.data;
        } else {
            // Remove expired item
            this.delete(key);
            return null;
        }
    }

    delete(key) {
        this.cache.delete(key);
        
        if (this.storage) {
            this.storage.removeItem(this.prefix + key);
        }
    }

    isValid(cacheItem) {
        if (!cacheItem || !cacheItem.timestamp) {
            return false;
        }

        const age = Date.now() - cacheItem.timestamp;
        return age < cacheItem.ttl;
    }

    cleanup() {
        console.log('[CacheManager] Starting cache cleanup');
        
        const expiredKeys = [];
        
        // Find expired items
        for (const [key, item] of this.cache) {
            if (!this.isValid(item)) {
                expiredKeys.push(key);
            }
        }

        // Remove expired items
        expiredKeys.forEach(key => this.delete(key));

        // Cleanup storage as well
        if (this.storage) {
            const storageKeys = Object.keys(this.storage).filter(key => key.startsWith(this.prefix));
            
            for (const key of storageKeys) {
                try {
                    const data = JSON.parse(this.storage.getItem(key));
                    if (!this.isValid(data)) {
                        this.storage.removeItem(key);
                    }
                } catch (error) {
                    // Invalid JSON, remove it
                    this.storage.removeItem(key);
                }
            }
        }

        console.log(`[CacheManager] Cleaned up ${expiredKeys.length} expired items`);
    }

    setupCleanup() {
        // Run cleanup every 5 minutes
        setInterval(() => {
            this.cleanup();
        }, 5 * 60 * 1000);
    }

    clear() {
        console.log('[CacheManager] Clearing all cache');
        this.cache.clear();
        
        if (this.storage) {
            const keys = Object.keys(this.storage).filter(key => key.startsWith(this.prefix));
            keys.forEach(key => this.storage.removeItem(key));
        }
    }

    getStats() {
        const totalItems = this.cache.size;
        let totalSize = 0;
        let expiredItems = 0;

        for (const [key, item] of this.cache) {
            try {
                totalSize += JSON.stringify(item).length;
                if (!this.isValid(item)) {
                    expiredItems++;
                }
            } catch (error) {
                // Skip invalid items
            }
        }

        return {
            totalItems,
            expiredItems,
            estimatedSize: totalSize,
            hitRate: this.hitRate || 0
        };
    }
}

// Error Reporter Component
class ErrorReporter {
    constructor(config) {
        this.config = config;
        this.logs = [];
        this.maxLogs = 1000;
        this.logLevels = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3
        };
        this.currentLogLevel = this.logLevels[config.logLevel] || 1;
    }

    log(level, message, error = null) {
        const logLevel = this.logLevels[level] || 1;
        
        // Skip logs below current log level
        if (logLevel < this.currentLogLevel) {
            return;
        }

        const logEntry = {
            timestamp: new Date().toISOString(),
            level,
            message,
            error: error ? this.serializeError(error) : null,
            userAgent: navigator.userAgent,
            url: window.location.href,
            sessionId: this.getSessionId()
        };

        this.logs.push(logEntry);

        // Keep only recent logs
        if (this.logs.length > this.maxLogs) {
            this.logs.shift();
        }

        // Console output
        const consoleMethod = console[level] || console.log;
        consoleMethod(`[SelfHealing] ${message}`, error || '');

        // Store critical errors in localStorage for debugging
        if (level === 'error') {
            this.persistCriticalError(logEntry);
        }

        return logEntry;
    }

    serializeError(error) {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack,
                cause: error.cause
            };
        } else if (typeof error === 'object') {
            try {
                return JSON.parse(JSON.stringify(error));
            } catch (e) {
                return { message: String(error) };
            }
        } else {
            return { message: String(error) };
        }
    }

    getSessionId() {
        if (!this.sessionId) {
            this.sessionId = 'sh_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
        }
        return this.sessionId;
    }

    persistCriticalError(logEntry) {
        try {
            const criticalErrors = JSON.parse(localStorage.getItem('sh_critical_errors') || '[]');
            criticalErrors.push(logEntry);
            
            // Keep only last 50 critical errors
            if (criticalErrors.length > 50) {
                criticalErrors.splice(0, criticalErrors.length - 50);
            }
            
            localStorage.setItem('sh_critical_errors', JSON.stringify(criticalErrors));
        } catch (error) {
            console.warn('[ErrorReporter] Failed to persist critical error:', error);
        }
    }

    getLogs(level = null, limit = 100) {
        let filteredLogs = this.logs;
        
        if (level) {
            const targetLevel = this.logLevels[level];
            filteredLogs = this.logs.filter(log => this.logLevels[log.level] >= targetLevel);
        }

        return filteredLogs.slice(-limit);
    }

    getCriticalErrors() {
        try {
            return JSON.parse(localStorage.getItem('sh_critical_errors') || '[]');
        } catch (error) {
            return [];
        }
    }

    clearLogs() {
        this.logs = [];
        localStorage.removeItem('sh_critical_errors');
    }

    generateReport() {
        const systemInfo = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            sessionId: this.getSessionId(),
            logCount: this.logs.length,
            errorCount: this.logs.filter(log => log.level === 'error').length,
            performance: {
                memory: performance.memory || {},
                timing: performance.timing || {}
            }
        };

        return {
            systemInfo,
            recentLogs: this.getLogs(null, 50),
            criticalErrors: this.getCriticalErrors()
        };
    }
}

// Extend the main framework with additional components
if (typeof window !== 'undefined' && window.SelfHealingFramework) {
    // Add the additional components to the existing framework
    Object.assign(window.SelfHealingFramework.prototype, {
        APIManager,
        UIRecovery,
        CacheManager,
        ErrorReporter
    });
}