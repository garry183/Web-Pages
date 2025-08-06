/**
 * Self-Healing Framework for Web Applications
 * Provides automatic error recovery, resilience patterns, and system monitoring
 * 
 * Features:
 * - API resilience with circuit breaker and retry logic
 * - Configuration auto-recovery and validation
 * - UI error recovery and graceful degradation
 * - Performance monitoring and optimization
 * - Data integrity validation
 * - Comprehensive error logging and reporting
 */

class SelfHealingFramework {
    constructor(config = {}) {
        this.config = {
            retryAttempts: 3,
            retryDelay: 1000,
            circuitBreakerThreshold: 5,
            circuitBreakerTimeout: 30000,
            healthCheckInterval: 60000,
            cacheMaxAge: 300000, // 5 minutes
            logLevel: 'info',
            autoRecovery: true,
            ...config
        };

        this.healthMonitor = new HealthMonitor(this.config);
        this.retryManager = new RetryManager(this.config);
        this.configManager = new ConfigManager(this.config);
        this.apiManager = new APIManager(this.config);
        this.uiRecovery = new UIRecovery(this.config);
        this.cacheManager = new CacheManager(this.config);
        this.errorReporter = new ErrorReporter(this.config);

        this.isInitialized = false;
        this.systemHealth = {
            overall: 'healthy',
            components: {},
            lastCheck: null
        };

        this.init();
    }

    async init() {
        try {
            console.log('[Self-Healing] Initializing framework...');
            
            // Initialize all components
            await this.healthMonitor.init();
            await this.configManager.init();
            await this.cacheManager.init();
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            // Setup global error handlers
            this.setupGlobalErrorHandlers();
            
            this.isInitialized = true;
            console.log('[Self-Healing] Framework initialized successfully');
            
            this.errorReporter.log('info', 'Self-healing framework initialized');
            
        } catch (error) {
            console.error('[Self-Healing] Failed to initialize framework:', error);
            this.errorReporter.log('error', 'Framework initialization failed', error);
        }
    }

    startHealthMonitoring() {
        setInterval(() => {
            this.performHealthCheck();
        }, this.config.healthCheckInterval);
    }

    async performHealthCheck() {
        try {
            const health = await this.healthMonitor.checkSystemHealth();
            this.systemHealth = health;
            
            if (health.overall !== 'healthy' && this.config.autoRecovery) {
                await this.attemptSystemRecovery(health);
            }
        } catch (error) {
            this.errorReporter.log('error', 'Health check failed', error);
        }
    }

    async attemptSystemRecovery(health) {
        console.log('[Self-Healing] Attempting system recovery...');
        
        for (const [component, status] of Object.entries(health.components)) {
            if (status.status !== 'healthy') {
                await this.recoverComponent(component, status);
            }
        }
    }

    async recoverComponent(component, status) {
        try {
            console.log(`[Self-Healing] Recovering component: ${component}`);
            
            switch (component) {
                case 'api':
                    await this.apiManager.resetCircuitBreaker();
                    break;
                case 'config':
                    await this.configManager.recover();
                    break;
                case 'ui':
                    await this.uiRecovery.recover();
                    break;
                case 'cache':
                    await this.cacheManager.cleanup();
                    break;
            }
            
            this.errorReporter.log('info', `Component ${component} recovered successfully`);
            
        } catch (error) {
            this.errorReporter.log('error', `Failed to recover component ${component}`, error);
        }
    }

    setupGlobalErrorHandlers() {
        // Global promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.handleUnhandledError('Promise rejection', event.reason);
        });

        // Global error handler
        window.addEventListener('error', (event) => {
            this.handleUnhandledError('JavaScript error', {
                message: event.message,
                filename: event.filename,
                line: event.lineno,
                column: event.colno,
                error: event.error
            });
        });
    }

    handleUnhandledError(type, error) {
        console.error(`[Self-Healing] Unhandled ${type}:`, error);
        this.errorReporter.log('error', `Unhandled ${type}`, error);
        
        if (this.config.autoRecovery) {
            // Attempt UI recovery for unhandled errors
            setTimeout(() => {
                this.uiRecovery.recover();
            }, 1000);
        }
    }

    // Public API methods
    async makeResilientAPICall(url, options = {}) {
        return this.apiManager.makeRequest(url, options);
    }

    async getConfig(key) {
        return this.configManager.get(key);
    }

    async setConfig(key, value) {
        return this.configManager.set(key, value);
    }

    cacheData(key, data, ttl) {
        return this.cacheManager.set(key, data, ttl);
    }

    getCachedData(key) {
        return this.cacheManager.get(key);
    }

    reportError(level, message, error) {
        return this.errorReporter.log(level, message, error);
    }

    getSystemHealth() {
        return this.systemHealth;
    }
}

// Health Monitor Component
class HealthMonitor {
    constructor(config) {
        this.config = config;
        this.checks = new Map();
    }

    async init() {
        // Register default health checks
        this.registerCheck('api', this.checkAPIHealth.bind(this));
        this.registerCheck('config', this.checkConfigHealth.bind(this));
        this.registerCheck('ui', this.checkUIHealth.bind(this));
        this.registerCheck('cache', this.checkCacheHealth.bind(this));
        this.registerCheck('performance', this.checkPerformanceHealth.bind(this));
    }

    registerCheck(name, checkFunction) {
        this.checks.set(name, checkFunction);
    }

    async checkSystemHealth() {
        const components = {};
        let overallHealth = 'healthy';

        for (const [name, checkFn] of this.checks) {
            try {
                const result = await checkFn();
                components[name] = result;
                
                if (result.status !== 'healthy') {
                    overallHealth = 'degraded';
                }
            } catch (error) {
                components[name] = {
                    status: 'unhealthy',
                    message: error.message,
                    timestamp: new Date().toISOString()
                };
                overallHealth = 'unhealthy';
            }
        }

        return {
            overall: overallHealth,
            components,
            lastCheck: new Date().toISOString()
        };
    }

    async checkAPIHealth() {
        // Check if API endpoints are responding
        const startTime = performance.now();
        
        try {
            // Simple connectivity check
            const response = await fetch('https://httpbin.org/status/200', {
                method: 'GET',
                timeout: 5000
            });
            
            const responseTime = performance.now() - startTime;
            
            if (response.ok && responseTime < 3000) {
                return {
                    status: 'healthy',
                    responseTime: Math.round(responseTime),
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    status: 'degraded',
                    responseTime: Math.round(responseTime),
                    message: 'High response time or error response',
                    timestamp: new Date().toISOString()
                };
            }
        } catch (error) {
            return {
                status: 'unhealthy',
                message: 'Network connectivity issues',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async checkConfigHealth() {
        try {
            // Check if config is accessible and valid
            const response = await fetch('config.json');
            
            if (response.ok) {
                const config = await response.json();
                
                if (config && typeof config === 'object') {
                    return {
                        status: 'healthy',
                        message: 'Configuration loaded successfully',
                        timestamp: new Date().toISOString()
                    };
                }
            }
            
            return {
                status: 'degraded',
                message: 'Configuration file issues',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: 'Configuration not accessible',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async checkUIHealth() {
        // Check DOM health and critical UI elements
        const criticalElements = ['#videoGrid', '#loadingIndicator'];
        const missingElements = [];
        
        for (const selector of criticalElements) {
            if (!document.querySelector(selector)) {
                missingElements.push(selector);
            }
        }

        if (missingElements.length === 0) {
            return {
                status: 'healthy',
                message: 'All critical UI elements present',
                timestamp: new Date().toISOString()
            };
        } else {
            return {
                status: 'unhealthy',
                message: 'Missing critical UI elements',
                missingElements,
                timestamp: new Date().toISOString()
            };
        }
    }

    async checkCacheHealth() {
        try {
            // Test localStorage availability
            const testKey = '__health_check__';
            localStorage.setItem(testKey, 'test');
            localStorage.removeItem(testKey);
            
            return {
                status: 'healthy',
                message: 'Cache system operational',
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: 'Cache system unavailable',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    async checkPerformanceHealth() {
        const memoryInfo = performance.memory || {};
        const timing = performance.timing;
        
        const metrics = {
            memoryUsage: memoryInfo.usedJSHeapSize || 0,
            memoryLimit: memoryInfo.jsHeapSizeLimit || 0,
            loadTime: timing.loadEventEnd - timing.navigationStart || 0
        };

        // Simple heuristics for performance health
        const memoryUsageRatio = metrics.memoryUsage / metrics.memoryLimit;
        const isMemoryHealthy = memoryUsageRatio < 0.8; // Less than 80% memory usage
        const isLoadTimeHealthy = metrics.loadTime < 5000; // Less than 5 seconds

        if (isMemoryHealthy && isLoadTimeHealthy) {
            return {
                status: 'healthy',
                message: 'Performance metrics normal',
                metrics,
                timestamp: new Date().toISOString()
            };
        } else {
            return {
                status: 'degraded',
                message: 'Performance issues detected',
                metrics,
                timestamp: new Date().toISOString()
            };
        }
    }
}

// Retry Manager Component
class RetryManager {
    constructor(config) {
        this.config = config;
        this.activeRetries = new Map();
    }

    async executeWithRetry(operation, options = {}) {
        const {
            maxAttempts = this.config.retryAttempts,
            baseDelay = this.config.retryDelay,
            backoffMultiplier = 2,
            jitter = true,
            retryCondition = (error) => true
        } = options;

        let lastError;
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const result = await operation(attempt);
                
                // Clear any tracking for successful operation
                if (options.operationId) {
                    this.activeRetries.delete(options.operationId);
                }
                
                return result;
            } catch (error) {
                lastError = error;
                
                // Track retry attempts
                if (options.operationId) {
                    this.activeRetries.set(options.operationId, {
                        attempt,
                        lastError: error,
                        timestamp: new Date().toISOString()
                    });
                }

                // Don't retry if this is the last attempt or retry condition fails
                if (attempt === maxAttempts || !retryCondition(error)) {
                    break;
                }

                // Calculate delay with exponential backoff and jitter
                let delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1);
                
                if (jitter) {
                    delay += Math.random() * delay * 0.1; // Add up to 10% jitter
                }

                console.log(`[RetryManager] Attempt ${attempt} failed, retrying in ${Math.round(delay)}ms`);
                await this.sleep(delay);
            }
        }

        // All attempts failed
        throw new Error(`Operation failed after ${maxAttempts} attempts. Last error: ${lastError.message}`);
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    getActiveRetries() {
        return Array.from(this.activeRetries.entries());
    }
}

// Configuration Manager Component
class ConfigManager {
    constructor(config) {
        this.config = config;
        this.cache = new Map();
        this.defaultConfig = null;
        this.watchers = new Map();
    }

    async init() {
        try {
            await this.loadConfig();
            this.setupConfigWatcher();
        } catch (error) {
            console.warn('[ConfigManager] Failed to load initial config:', error);
            await this.createDefaultConfig();
        }
    }

    async loadConfig() {
        try {
            const response = await fetch('config.json');
            if (response.ok) {
                const config = await response.json();
                this.cache.set('main', config);
                
                if (!this.defaultConfig) {
                    this.defaultConfig = { ...config };
                }
                
                console.log('[ConfigManager] Configuration loaded successfully');
                return config;
            }
        } catch (error) {
            throw new Error(`Failed to load config: ${error.message}`);
        }
    }

    async createDefaultConfig() {
        console.log('[ConfigManager] Creating default configuration');
        
        const defaultConfig = {
            API_KEY: "YOUR_YOUTUBE_API_KEY",
            app_settings: {
                max_results: 50,
                videos_to_display: 10,
                cache_duration_minutes: 30
            },
            ui_settings: {
                matrix_effect_speed: 35,
                autoplay_preview: true
            },
            self_healing: {
                enabled: true,
                retry_attempts: 3,
                circuit_breaker_threshold: 5,
                auto_recovery: true
            }
        };

        this.cache.set('main', defaultConfig);
        this.defaultConfig = { ...defaultConfig };
        
        try {
            // Try to save the default config (may fail in read-only environments)
            await this.saveConfig(defaultConfig);
        } catch (error) {
            console.warn('[ConfigManager] Could not save default config to file:', error);
        }
    }

    async saveConfig(config) {
        // Note: In a browser environment, we can't directly write files
        // This would need to be implemented with server-side support
        // For now, we just update the cache
        this.cache.set('main', config);
        this.notifyWatchers('main', config);
    }

    setupConfigWatcher() {
        // Poll for config changes every 30 seconds
        setInterval(async () => {
            try {
                const currentConfig = await this.loadConfig();
                const cachedConfig = this.cache.get('main');
                
                if (JSON.stringify(currentConfig) !== JSON.stringify(cachedConfig)) {
                    console.log('[ConfigManager] Configuration changed, updating cache');
                    this.notifyWatchers('main', currentConfig);
                }
            } catch (error) {
                // Config file might be temporarily unavailable
                console.debug('[ConfigManager] Config check failed:', error);
            }
        }, 30000);
    }

    get(key, defaultValue = null) {
        const config = this.cache.get('main') || {};
        
        // Support nested keys like 'app_settings.max_results'
        const keys = key.split('.');
        let value = config;
        
        for (const k of keys) {
            if (value && typeof value === 'object' && k in value) {
                value = value[k];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    }

    set(key, value) {
        let config = this.cache.get('main') || {};
        
        // Support nested keys
        const keys = key.split('.');
        let current = config;
        
        for (let i = 0; i < keys.length - 1; i++) {
            const k = keys[i];
            if (!(k in current) || typeof current[k] !== 'object') {
                current[k] = {};
            }
            current = current[k];
        }
        
        current[keys[keys.length - 1]] = value;
        
        this.cache.set('main', config);
        this.notifyWatchers('main', config);
        
        return value;
    }

    async recover() {
        console.log('[ConfigManager] Attempting configuration recovery');
        
        try {
            // Try to reload config
            await this.loadConfig();
        } catch (error) {
            // Fallback to default config
            console.log('[ConfigManager] Using default configuration for recovery');
            await this.createDefaultConfig();
        }
    }

    watch(key, callback) {
        if (!this.watchers.has(key)) {
            this.watchers.set(key, new Set());
        }
        this.watchers.get(key).add(callback);
        
        // Return unwatch function
        return () => {
            const callbacks = this.watchers.get(key);
            if (callbacks) {
                callbacks.delete(callback);
            }
        };
    }

    notifyWatchers(key, value) {
        const callbacks = this.watchers.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(value, key);
                } catch (error) {
                    console.error('[ConfigManager] Error in config watcher:', error);
                }
            });
        }
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.SelfHealingFramework = SelfHealingFramework;
}

// For Node.js environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SelfHealingFramework };
}