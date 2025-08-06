/**
 * Self-Healing Service for AI Video Explorer
 * Provides automatic error recovery, performance monitoring, and system resilience
 */

class SelfHealingService {
    constructor(config = {}) {
        this.config = {
            retryAttempts: 3,
            retryDelay: 1000,
            maxRetryDelay: 30000,
            performanceThreshold: 5000, // 5 seconds
            healthCheckInterval: 30000, // 30 seconds
            cacheExpiryTime: 30 * 60 * 1000, // 30 minutes
            offlineRetryInterval: 10000, // 10 seconds
            ...config
        };
        
        this.metrics = {
            apiCalls: 0,
            apiFailures: 0,
            apiRetries: 0,
            cacheHits: 0,
            cacheMisses: 0,
            averageResponseTime: 0,
            lastHealthCheck: null,
            isOnline: navigator.onLine
        };
        
        this.cache = new Map();
        this.healthStatus = {
            api: 'unknown',
            config: 'unknown',
            network: navigator.onLine ? 'online' : 'offline',
            performance: 'unknown'
        };
        
        this.initialize();
    }
    
    initialize() {
        this.setupNetworkMonitoring();
        this.setupPerformanceMonitoring();
        this.startHealthCheck();
        this.setupErrorHandlers();
        
        console.log('✅ Self-Healing Service initialized');
    }
    
    /**
     * Enhanced API call with automatic retry and error recovery
     */
    async resilientApiCall(url, options = {}) {
        const startTime = performance.now();
        let lastError;
        
        for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
            try {
                this.metrics.apiCalls++;
                
                // Check cache first
                const cacheKey = this.getCacheKey(url, options);
                const cachedResponse = this.getFromCache(cacheKey);
                if (cachedResponse) {
                    this.metrics.cacheHits++;
                    return cachedResponse;
                }
                
                const response = await fetch(url, {
                    timeout: this.config.performanceThreshold,
                    ...options
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Validate response data
                const validatedData = this.validateApiResponse(data);
                
                // Cache successful response
                this.setCache(cacheKey, validatedData);
                this.metrics.cacheMisses++;
                
                // Record successful API call
                const responseTime = performance.now() - startTime;
                this.updatePerformanceMetrics(responseTime);
                this.healthStatus.api = 'healthy';
                
                return validatedData;
                
            } catch (error) {
                lastError = error;
                this.metrics.apiFailures++;
                
                console.warn(`🔄 API call attempt ${attempt} failed:`, error.message);
                
                if (attempt === this.config.retryAttempts) {
                    this.healthStatus.api = 'unhealthy';
                    break;
                }
                
                // Exponential backoff
                const delay = Math.min(
                    this.config.retryDelay * Math.pow(2, attempt - 1),
                    this.config.maxRetryDelay
                );
                
                await this.wait(delay);
                this.metrics.apiRetries++;
            }
        }
        
        // All retries failed, attempt graceful degradation
        console.error(`❌ API call failed after ${this.config.retryAttempts} attempts:`, lastError);
        return this.handleApiFallback(url, lastError);
    }
    
    /**
     * Validate and sanitize API response data
     */
    validateApiResponse(data) {
        if (!data || typeof data !== 'object') {
            throw new Error('Invalid API response format');
        }
        
        // YouTube API specific validation
        if (data.error) {
            throw new Error(`API Error: ${data.error.message || 'Unknown error'}`);
        }
        
        if (data.items && Array.isArray(data.items)) {
            // Sanitize video data
            data.items = data.items.map(item => this.sanitizeVideoData(item));
        }
        
        return data;
    }
    
    /**
     * Sanitize individual video data
     */
    sanitizeVideoData(video) {
        if (!video || typeof video !== 'object') return null;
        
        const sanitized = {
            id: this.sanitizeString(video.id?.videoId || video.id),
            snippet: {
                title: this.sanitizeString(video.snippet?.title),
                channelTitle: this.sanitizeString(video.snippet?.channelTitle),
                channelId: this.sanitizeString(video.snippet?.channelId),
                publishedAt: video.snippet?.publishedAt,
                thumbnails: video.snippet?.thumbnails
            }
        };
        
        if (video.statistics) {
            sanitized.statistics = {
                viewCount: parseInt(video.statistics.viewCount) || 0,
                likeCount: parseInt(video.statistics.likeCount) || 0
            };
        }
        
        return sanitized;
    }
    
    /**
     * Sanitize string inputs
     */
    sanitizeString(str) {
        if (!str || typeof str !== 'string') return '';
        return str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                 .replace(/javascript:/gi, '')
                 .trim();
    }
    
    /**
     * Handle API fallback scenarios
     */
    handleApiFallback(url, error) {
        console.log('🔄 Attempting graceful degradation...');
        
        // Check if we have cached data from previous successful calls
        const cacheKey = this.getCacheKey(url);
        const staleData = this.getFromCache(cacheKey, true); // Allow stale data
        
        if (staleData) {
            console.log('📦 Using stale cached data for graceful degradation');
            return staleData;
        }
        
        // Return empty but valid response structure
        console.log('🎭 Using fallback data structure');
        return {
            items: [],
            error: {
                type: 'fallback',
                message: 'Using offline mode due to API unavailability'
            }
        };
    }
    
    /**
     * Configuration validation and auto-repair
     */
    validateAndRepairConfig(config) {
        console.log('🔍 Validating configuration...');
        
        const repairs = [];
        const repaired = { ...config };
        
        // Validate API key
        if (!config.API_KEY || config.API_KEY === 'YOUR_YOUTUBE_API_KEY') {
            repairs.push('Invalid or missing API key - will use fallback mode');
            this.healthStatus.config = 'degraded';
        } else {
            this.healthStatus.config = 'healthy';
        }
        
        // Validate app settings
        if (!config.app_settings) {
            repaired.app_settings = {
                max_results: 50,
                videos_to_display: 10,
                cache_duration_minutes: 30
            };
            repairs.push('Missing app_settings - restored defaults');
        } else {
            // Validate individual app settings
            if (!Number.isInteger(config.app_settings.max_results) || config.app_settings.max_results < 1) {
                repaired.app_settings.max_results = 50;
                repairs.push('Invalid max_results - set to default (50)');
            }
            
            if (!Number.isInteger(config.app_settings.videos_to_display) || config.app_settings.videos_to_display < 1) {
                repaired.app_settings.videos_to_display = 10;
                repairs.push('Invalid videos_to_display - set to default (10)');
            }
            
            if (!Number.isInteger(config.app_settings.cache_duration_minutes) || config.app_settings.cache_duration_minutes < 1) {
                repaired.app_settings.cache_duration_minutes = 30;
                repairs.push('Invalid cache_duration_minutes - set to default (30)');
            }
        }
        
        // Validate UI settings
        if (!config.ui_settings) {
            repaired.ui_settings = {
                matrix_effect_speed: 35,
                autoplay_preview: true
            };
            repairs.push('Missing ui_settings - restored defaults');
        } else {
            if (!Number.isInteger(config.ui_settings.matrix_effect_speed) || 
                config.ui_settings.matrix_effect_speed < 10 || 
                config.ui_settings.matrix_effect_speed > 100) {
                repaired.ui_settings.matrix_effect_speed = 35;
                repairs.push('Invalid matrix_effect_speed - set to default (35)');
            }
            
            if (typeof config.ui_settings.autoplay_preview !== 'boolean') {
                repaired.ui_settings.autoplay_preview = true;
                repairs.push('Invalid autoplay_preview - set to default (true)');
            }
        }
        
        if (repairs.length > 0) {
            console.warn('🔧 Configuration repairs applied:', repairs);
        } else {
            console.log('✅ Configuration is valid');
        }
        
        return { config: repaired, repairs };
    }
    
    /**
     * Setup network monitoring
     */
    setupNetworkMonitoring() {
        window.addEventListener('online', () => {
            console.log('🌐 Network connection restored');
            this.metrics.isOnline = true;
            this.healthStatus.network = 'online';
            this.handleNetworkRecovery();
        });
        
        window.addEventListener('offline', () => {
            console.log('📡 Network connection lost - entering offline mode');
            this.metrics.isOnline = false;
            this.healthStatus.network = 'offline';
        });
    }
    
    /**
     * Handle network recovery
     */
    handleNetworkRecovery() {
        console.log('🔄 Attempting to restore services after network recovery...');
        
        // Clear failed API status
        if (this.healthStatus.api === 'unhealthy') {
            this.healthStatus.api = 'unknown';
        }
        
        // Trigger a health check
        setTimeout(() => this.performHealthCheck(), 1000);
        
        // Dispatch custom event for the main application
        window.dispatchEvent(new CustomEvent('self-healing:network-recovered'));
    }
    
    /**
     * Setup performance monitoring
     */
    setupPerformanceMonitoring() {
        // Monitor memory usage
        if ('memory' in performance) {
            setInterval(() => {
                const memory = performance.memory;
                if (memory.usedJSHeapSize > memory.totalJSHeapSize * 0.8) {
                    console.warn('⚠️ High memory usage detected - triggering cleanup');
                    this.performMemoryCleanup();
                }
            }, 60000); // Check every minute
        }
        
        // Monitor DOM nodes
        const observer = new MutationObserver(() => {
            if (document.querySelectorAll('*').length > 5000) {
                console.warn('⚠️ High DOM node count detected');
            }
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    /**
     * Perform memory cleanup
     */
    performMemoryCleanup() {
        // Clear old cache entries
        this.cleanupCache();
        
        // Clear video previews that are not visible
        const videoCards = document.querySelectorAll('.video-card');
        videoCards.forEach(card => {
            const rect = card.getBoundingClientRect();
            const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
            
            if (!isVisible) {
                const preview = card.querySelector('.video-preview');
                if (preview) {
                    preview.src = '';
                    preview.load();
                }
            }
        });
        
        // Dispatch cleanup event
        window.dispatchEvent(new CustomEvent('self-healing:cleanup-performed'));
        
        console.log('🧹 Memory cleanup completed');
    }
    
    /**
     * Start health check monitoring
     */
    startHealthCheck() {
        setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
        
        // Perform initial health check
        setTimeout(() => this.performHealthCheck(), 2000);
    }
    
    /**
     * Perform comprehensive health check
     */
    async performHealthCheck() {
        console.log('🏥 Performing health check...');
        
        this.metrics.lastHealthCheck = new Date();
        
        // Check API connectivity
        try {
            const testResponse = await fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=test', {
                method: 'HEAD',
                timeout: 5000
            });
            // Even if unauthorized, if we get a response, the API endpoint is reachable
            this.healthStatus.api = response.status === 401 ? 'healthy' : 'healthy';
        } catch (error) {
            this.healthStatus.api = 'unhealthy';
        }
        
        // Check performance
        if (this.metrics.averageResponseTime > this.config.performanceThreshold) {
            this.healthStatus.performance = 'degraded';
            console.warn('⚠️ Performance degradation detected');
        } else {
            this.healthStatus.performance = 'healthy';
        }
        
        // Dispatch health status update
        window.dispatchEvent(new CustomEvent('self-healing:health-update', {
            detail: { status: this.healthStatus, metrics: this.metrics }
        }));
    }
    
    /**
     * Setup global error handlers
     */
    setupErrorHandlers() {
        // Catch unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            console.error('🚨 Unhandled promise rejection:', event.reason);
            this.handleCriticalError(event.reason);
            event.preventDefault();
        });
        
        // Catch JavaScript errors
        window.addEventListener('error', (event) => {
            console.error('🚨 JavaScript error:', event.error);
            this.handleCriticalError(event.error);
        });
    }
    
    /**
     * Handle critical errors
     */
    handleCriticalError(error) {
        console.log('🛡️ Self-healing system handling critical error...');
        
        // If it's a network-related error and we're offline, ignore
        if (!this.metrics.isOnline && error.message.includes('fetch')) {
            console.log('📡 Ignoring fetch error while offline');
            return;
        }
        
        // Attempt to recover
        setTimeout(() => {
            this.attemptRecovery();
        }, 1000);
    }
    
    /**
     * Attempt system recovery
     */
    attemptRecovery() {
        console.log('🔄 Attempting system recovery...');
        
        // Clear caches
        this.cache.clear();
        
        // Reset metrics
        this.resetMetrics();
        
        // Trigger health check
        this.performHealthCheck();
        
        // Dispatch recovery event
        window.dispatchEvent(new CustomEvent('self-healing:recovery-attempted'));
    }
    
    /**
     * Cache management
     */
    getCacheKey(url, options = {}) {
        return `${url}${JSON.stringify(options)}`;
    }
    
    setCache(key, data) {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            expires: Date.now() + this.config.cacheExpiryTime
        });
    }
    
    getFromCache(key, allowStale = false) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        const now = Date.now();
        if (!allowStale && now > cached.expires) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }
    
    cleanupCache() {
        const now = Date.now();
        for (const [key, cached] of this.cache.entries()) {
            if (now > cached.expires) {
                this.cache.delete(key);
            }
        }
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics(responseTime) {
        if (this.metrics.averageResponseTime === 0) {
            this.metrics.averageResponseTime = responseTime;
        } else {
            this.metrics.averageResponseTime = 
                (this.metrics.averageResponseTime + responseTime) / 2;
        }
    }
    
    /**
     * Reset metrics
     */
    resetMetrics() {
        this.metrics = {
            ...this.metrics,
            apiCalls: 0,
            apiFailures: 0,
            apiRetries: 0,
            averageResponseTime: 0
        };
    }
    
    /**
     * Utility function for delays
     */
    wait(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Get current health status
     */
    getHealthStatus() {
        return {
            status: this.healthStatus,
            metrics: this.metrics,
            timestamp: new Date()
        };
    }
    
    /**
     * Get diagnostics information
     */
    getDiagnostics() {
        return {
            config: this.config,
            healthStatus: this.healthStatus,
            metrics: this.metrics,
            cacheSize: this.cache.size,
            timestamp: new Date(),
            userAgent: navigator.userAgent,
            online: navigator.onLine,
            memory: 'memory' in performance ? performance.memory : null
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelfHealingService;
}

console.log('📋 Self-Healing Service module loaded');