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
            // Circuit breaker config
            circuitBreakerThreshold: 5, // failures before opening circuit
            circuitBreakerTimeout: 60000, // 1 minute
            // Storage recovery config
            enableStorageRecovery: true,
            storageKeyPrefix: 'ai-video-explorer',
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
            isOnline: navigator.onLine,
            circuitBreakerTrips: 0,
            storageRecoveries: 0
        };
        
        this.cache = new Map();
        this.healthStatus = {
            api: 'unknown',
            config: 'unknown',
            network: navigator.onLine ? 'online' : 'offline',
            performance: 'unknown',
            storage: 'unknown',
            circuitBreaker: 'closed'
        };
        
        // Circuit breaker state
        this.circuitBreaker = {
            state: 'closed', // closed, open, half-open
            failureCount: 0,
            lastFailureTime: 0,
            nextAttemptTime: 0
        };
        
        // Storage recovery state
        this.storageManager = {
            available: this.checkStorageAvailability(),
            lastBackup: null,
            autoBackupInterval: 5 * 60 * 1000 // 5 minutes
        };
        
        this.initialize();
    }
    
    initialize() {
        this.setupNetworkMonitoring();
        this.setupPerformanceMonitoring();
        this.startHealthCheck();
        this.setupErrorHandlers();
        this.setupStorageRecovery();
        this.setupCircuitBreakerMonitoring();
        
        console.log('✅ Self-Healing Service initialized with enhanced features');
    }
    
    /**
     * Enhanced API call with circuit breaker and automatic retry
     */
    async resilientApiCall(url, options = {}) {
        // Check circuit breaker first
        if (!this.canProceedWithApiCall()) {
            console.warn('🔒 Circuit breaker is open - using fallback');
            return this.handleApiFallback(url, new Error('Circuit breaker is open'));
        }
        
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
                    this.recordApiSuccess();
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
                this.recordApiSuccess();
                
                return validatedData;
                
            } catch (error) {
                lastError = error;
                this.recordApiFailure();
                
                console.warn(`🔄 API call attempt ${attempt} failed:`, error.message);
                
                if (attempt === this.config.retryAttempts) {
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
        
        // All retries failed
        console.error(`❌ API call failed after ${this.config.retryAttempts} attempts:`, lastError);
        return this.handleApiFallback(url, lastError);
    }
    
    /**
     * Circuit breaker logic - check if API calls should proceed
     */
    canProceedWithApiCall() {
        const now = Date.now();
        
        switch (this.circuitBreaker.state) {
            case 'closed':
                return true;
                
            case 'open':
                if (now > this.circuitBreaker.nextAttemptTime) {
                    console.log('🔄 Circuit breaker moving to half-open state');
                    this.circuitBreaker.state = 'half-open';
                    this.healthStatus.circuitBreaker = 'half-open';
                    return true;
                }
                return false;
                
            case 'half-open':
                return true;
                
            default:
                return true;
        }
    }
    
    /**
     * Record successful API call for circuit breaker
     */
    recordApiSuccess() {
        if (this.circuitBreaker.state === 'half-open') {
            console.log('✅ Circuit breaker closing after successful call');
            this.circuitBreaker.state = 'closed';
            this.circuitBreaker.failureCount = 0;
            this.healthStatus.circuitBreaker = 'closed';
            
            // Dispatch circuit breaker closed event
            window.dispatchEvent(new CustomEvent('self-healing:circuit-breaker-closed'));
        }
        this.healthStatus.api = 'healthy';
    }
    
    /**
     * Record failed API call for circuit breaker
     */
    recordApiFailure() {
        this.circuitBreaker.failureCount++;
        this.circuitBreaker.lastFailureTime = Date.now();
        this.metrics.apiFailures++;
        
        if (this.circuitBreaker.failureCount >= this.config.circuitBreakerThreshold) {
            console.warn('🔒 Circuit breaker opening due to repeated failures');
            this.circuitBreaker.state = 'open';
            this.circuitBreaker.nextAttemptTime = Date.now() + this.config.circuitBreakerTimeout;
            this.healthStatus.circuitBreaker = 'open';
            this.healthStatus.api = 'unhealthy';
            this.metrics.circuitBreakerTrips++;
            
            // Dispatch circuit breaker opened event
            window.dispatchEvent(new CustomEvent('self-healing:circuit-breaker-opened'));
        }
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
     * Setup storage recovery system
     */
    setupStorageRecovery() {
        if (!this.config.enableStorageRecovery) {
            console.log('📦 Storage recovery disabled by configuration');
            return;
        }
        
        if (!this.storageManager.available) {
            console.warn('⚠️ localStorage not available - storage recovery disabled');
            this.healthStatus.storage = 'unavailable';
            return;
        }
        
        console.log('📦 Setting up storage recovery system...');
        this.healthStatus.storage = 'healthy';
        
        // Auto-backup application state periodically
        setInterval(() => {
            this.backupApplicationState();
        }, this.storageManager.autoBackupInterval);
        
        // Attempt to recover state on initialization
        this.recoverApplicationState();
        
        // Listen for beforeunload to backup state
        window.addEventListener('beforeunload', () => {
            this.backupApplicationState();
        });
        
        // Listen for storage events from other tabs
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.startsWith(this.config.storageKeyPrefix)) {
                console.log('📦 Storage change detected from another tab');
                this.handleStorageChange(e);
            }
        });
    }
    
    /**
     * Check if localStorage is available
     */
    checkStorageAvailability() {
        try {
            const testKey = 'test-storage-availability';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            return true;
        } catch (error) {
            console.warn('⚠️ localStorage not available:', error);
            return false;
        }
    }
    
    /**
     * Setup circuit breaker monitoring
     */
    setupCircuitBreakerMonitoring() {
        // Reset circuit breaker state periodically if it's been open too long
        setInterval(() => {
            if (this.circuitBreaker.state === 'open') {
                const timeSinceOpen = Date.now() - this.circuitBreaker.lastFailureTime;
                if (timeSinceOpen > this.config.circuitBreakerTimeout * 2) {
                    console.log('🔄 Resetting circuit breaker after extended timeout');
                    this.circuitBreaker.state = 'closed';
                    this.circuitBreaker.failureCount = 0;
                    this.healthStatus.circuitBreaker = 'closed';
                }
            }
        }, this.config.circuitBreakerTimeout);
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
     * Backup application state to localStorage
     */
    backupApplicationState() {
        if (!this.storageManager.available) return;
        
        try {
            const state = {
                timestamp: Date.now(),
                config: this.config,
                healthStatus: this.healthStatus,
                metrics: this.metrics,
                circuitBreaker: this.circuitBreaker,
                cache: Array.from(this.cache.entries()),
                appVersion: '3.0'
            };
            
            const key = `${this.config.storageKeyPrefix}-app-state`;
            localStorage.setItem(key, JSON.stringify(state));
            this.storageManager.lastBackup = Date.now();
            
            console.log('💾 Application state backed up to localStorage');
            
        } catch (error) {
            console.warn('⚠️ Failed to backup application state:', error);
            this.healthStatus.storage = 'degraded';
        }
    }
    
    /**
     * Recover application state from localStorage
     */
    recoverApplicationState() {
        if (!this.storageManager.available) return;
        
        try {
            const key = `${this.config.storageKeyPrefix}-app-state`;
            const storedState = localStorage.getItem(key);
            
            if (!storedState) {
                console.log('📦 No stored application state found');
                return;
            }
            
            const state = JSON.parse(storedState);
            
            // Check if stored state is not too old (24 hours max)
            const maxAge = 24 * 60 * 60 * 1000;
            if (Date.now() - state.timestamp > maxAge) {
                console.log('📦 Stored state is too old, ignoring');
                localStorage.removeItem(key);
                return;
            }
            
            // Recover cache if available
            if (state.cache && Array.isArray(state.cache)) {
                this.cache = new Map(state.cache);
                console.log(`📦 Recovered ${state.cache.length} cache entries`);
            }
            
            // Recover metrics (but don't overwrite current session)
            if (state.metrics) {
                this.metrics = {
                    ...this.metrics,
                    ...state.metrics,
                    // Keep current session values
                    apiCalls: this.metrics.apiCalls,
                    apiFailures: this.metrics.apiFailures,
                    apiRetries: this.metrics.apiRetries,
                    isOnline: navigator.onLine
                };
            }
            
            this.metrics.storageRecoveries++;
            console.log('✅ Application state recovered successfully');
            
            // Dispatch recovery event
            window.dispatchEvent(new CustomEvent('self-healing:state-recovered', {
                detail: { recoveredItems: ['cache', 'metrics'] }
            }));
            
        } catch (error) {
            console.warn('⚠️ Failed to recover application state:', error);
            this.healthStatus.storage = 'degraded';
        }
    }
    
    /**
     * Handle storage changes from other tabs
     */
    handleStorageChange(event) {
        console.log('📦 Handling storage change:', event.key);
        
        // Sync cache between tabs if needed
        if (event.key.endsWith('-app-state') && event.newValue) {
            try {
                const state = JSON.parse(event.newValue);
                if (state.cache && Array.isArray(state.cache)) {
                    // Merge cache from other tab
                    const otherCache = new Map(state.cache);
                    for (const [key, value] of otherCache) {
                        if (!this.cache.has(key)) {
                            this.cache.set(key, value);
                        }
                    }
                    console.log('🔄 Synced cache from another tab');
                }
            } catch (error) {
                console.warn('⚠️ Error syncing from other tab:', error);
            }
        }
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
        console.log('🏥 Performing comprehensive health check...');
        
        this.metrics.lastHealthCheck = new Date();
        
        // Check API connectivity (respecting circuit breaker)
        if (this.circuitBreaker.state !== 'open') {
            try {
                const testResponse = await fetch('https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=test', {
                    method: 'HEAD',
                    timeout: 5000
                });
                // Even if unauthorized, if we get a response, the API endpoint is reachable
                this.healthStatus.api = testResponse.status === 401 ? 'healthy' : 'healthy';
            } catch (error) {
                this.healthStatus.api = 'unhealthy';
            }
        }
        
        // Check performance
        if (this.metrics.averageResponseTime > this.config.performanceThreshold) {
            this.healthStatus.performance = 'degraded';
            console.warn('⚠️ Performance degradation detected');
        } else {
            this.healthStatus.performance = 'healthy';
        }
        
        // Check storage health
        if (this.config.enableStorageRecovery && this.storageManager.available) {
            try {
                const testKey = `${this.config.storageKeyPrefix}-health-test`;
                localStorage.setItem(testKey, Date.now().toString());
                localStorage.removeItem(testKey);
                this.healthStatus.storage = 'healthy';
            } catch (error) {
                console.warn('⚠️ Storage health check failed:', error);
                this.healthStatus.storage = 'degraded';
            }
        }
        
        // Dispatch health status update
        window.dispatchEvent(new CustomEvent('self-healing:health-update', {
            detail: { 
                status: this.healthStatus, 
                metrics: this.metrics,
                circuitBreaker: this.circuitBreaker 
            }
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
            circuitBreaker: this.circuitBreaker,
            storageManager: {
                available: this.storageManager.available,
                lastBackup: this.storageManager.lastBackup
            },
            cacheSize: this.cache.size,
            timestamp: new Date(),
            userAgent: navigator.userAgent,
            online: navigator.onLine,
            memory: 'memory' in performance ? performance.memory : null,
            features: {
                circuitBreaker: true,
                storageRecovery: this.config.enableStorageRecovery,
                performanceMonitoring: true,
                networkRecovery: true,
                configValidation: true
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SelfHealingService;
}

console.log('📋 Self-Healing Service module loaded');