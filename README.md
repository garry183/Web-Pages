# AI Video Explorer

A sleek, Matrix-themed web application that displays the top 10 most viewed Artificial Intelligence videos on YouTube from the past week.

## Features

- 🎥 Displays top AI videos from YouTube
- 🎨 Matrix-style animated background
- 🎮 Interactive hover previews
- 📱 Responsive design
- ⚡ Real-time data fetching
- 🔧 Configurable settings
- 🛡️ **Self-Healing Capabilities** (NEW!)
- 🔄 Automatic error recovery
- 📊 Real-time health monitoring
- 🚦 Circuit breaker pattern for API resilience

## Self-Healing Framework

The application now includes a comprehensive self-healing framework that provides:

### 🔄 **Automatic Error Recovery**
- API call retry with exponential backoff
- Circuit breaker pattern to prevent cascade failures
- Graceful fallback to cached data or sample content
- UI element recovery for broken images and videos

### 📊 **Real-Time Health Monitoring**
- System health dashboard with component status
- API, Configuration, UI, and Cache monitoring
- Performance metrics tracking
- Automatic system recovery when issues are detected

### 🛠️ **Configuration Management**
- Auto-recovery of corrupted configuration files
- Configuration validation and correction
- Real-time configuration watching and updates
- Default configuration fallback

### 💾 **Intelligent Caching**
- Automatic cache management with TTL
- Cache cleanup and optimization
- Persistent storage with fallback
- Memory usage monitoring

### 📝 **Comprehensive Error Logging**
- Structured error logging with different levels
- Critical error persistence to localStorage
- Error categorization and filtering
- System diagnostic reporting

## Setup Instructions

### 1. Configuration Setup

1. Copy the template configuration file:
   ```bash
   cp config.template.json config.json
   ```

2. Edit `config.json` and replace `YOUR_YOUTUBE_API_KEY` with your actual YouTube Data API key.

### 2. Getting a YouTube API Key

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the YouTube Data API v3
4. Create credentials (API Key)
5. Copy the API key to your `config.json` file

### 3. Configuration Options

The `config.json` file supports the following settings:

```json
{
    "API_KEY": "your-youtube-api-key-here",
    "app_settings": {
        "max_results": 50,           // Max videos to fetch from API
        "videos_to_display": 10,     // Number of videos to display
        "cache_duration_minutes": 30 // How long to cache results
    },
    "ui_settings": {
        "matrix_effect_speed": 35,   // Speed of matrix animation
        "autoplay_preview": true     // Enable/disable hover previews
    },
    "self_healing": {
        "enabled": true,             // Enable/disable self-healing
        "retry_attempts": 3,         // Number of retry attempts
        "retry_delay": 1000,         // Base retry delay in ms
        "circuit_breaker_threshold": 5,    // Failures before circuit opens
        "circuit_breaker_timeout": 30000,  // Circuit reset timeout in ms
        "health_check_interval": 60000,    // Health check frequency in ms
        "cache_max_age": 300000,     // Cache TTL in ms
        "log_level": "info",         // Logging level (debug, info, warn, error)
        "auto_recovery": true        // Enable automatic recovery
    }
}
```

### 4. Running the Application

1. Serve the files using a local web server (required for loading the config file):
   ```bash
   # Using Python
   python -m http.server 8000
   
   # Using Node.js
   npx serve .
   
   # Using PHP
   php -S localhost:8000
   ```

2. Open your browser and navigate to `http://localhost:8000`

### 5. Testing Self-Healing Framework

To test the self-healing capabilities, navigate to `http://localhost:8000/test-self-healing.html` for a comprehensive test suite that validates:

- Framework initialization
- Retry manager with exponential backoff
- Circuit breaker functionality
- Configuration management
- Health monitoring
- Cache operations
- Error reporting
- Integration scenarios

## Security Notes

- The `config.json` file is included in `.gitignore` to prevent accidentally committing API keys
- Always use `config.template.json` as a reference for the expected configuration structure
- Never commit your actual API keys to version control

## Health Monitoring

The application includes a real-time health monitoring system:

- **Health Indicator**: Located in the top controls, shows system status (HEALTHY/DEGRADED/UNHEALTHY)
- **Component Monitoring**: Individual health checks for API, Config, UI, Cache, and Performance
- **Automatic Recovery**: System automatically attempts recovery when issues are detected
- **Health Details**: Click on the health indicator to see detailed component status

## Self-Healing in Action

The self-healing framework automatically handles common issues:

1. **API Failures**: 
   - Automatically retries failed requests with exponential backoff
   - Opens circuit breakers for repeatedly failing endpoints
   - Falls back to cached data or sample content

2. **Configuration Issues**:
   - Recreates missing configuration files
   - Validates and corrects malformed configurations
   - Provides sensible defaults when configuration is unavailable

3. **UI Problems**:
   - Automatically recovers broken images with placeholders
   - Handles failed video loads gracefully
   - Recreates missing critical UI elements

4. **Performance Issues**:
   - Monitors memory usage and cleans up when needed
   - Optimizes cache usage automatically
   - Tracks and reports performance metrics

## Error Handling

The framework provides comprehensive error handling:

- **Structured Logging**: All errors are logged with context and timestamps
- **Error Categorization**: Errors are categorized by severity (debug, info, warn, error)
- **Persistence**: Critical errors are saved to localStorage for debugging
- **Recovery Actions**: Each error type triggers appropriate recovery mechanisms

## Fallback Mode

If the self-healing framework fails to initialize or no valid API key is provided, the application runs in demo mode using sample data with basic error handling.

## Technologies Used

- HTML5 & CSS3
- Vanilla JavaScript
- YouTube Data API v3
- Canvas API (for Matrix effect)
- CSS Grid & Flexbox
- CSS Custom Properties
- **Self-Healing Framework** (Custom implementation)
  - Retry Manager with Exponential Backoff
  - Circuit Breaker Pattern
  - Health Monitor System
  - Configuration Manager
  - Cache Manager with TTL
  - Error Reporter and Logger

## Architecture

### Core Application
- `index.html`: Main application with Matrix-themed UI
- `config.json`: Configuration file with API keys and settings
- `test-config.html`: Simple configuration validation tool

### Self-Healing Framework
- `self-healing-framework.js`: Core framework with health monitoring
- `self-healing-components.js`: Additional components (API Manager, UI Recovery, etc.)
- `test-self-healing.html`: Comprehensive test suite for framework validation

### Framework Components
1. **HealthMonitor**: System health checks and monitoring
2. **RetryManager**: Retry logic with exponential backoff
3. **ConfigManager**: Configuration management with auto-recovery
4. **APIManager**: API calls with circuit breaker pattern
5. **UIRecovery**: UI error recovery and graceful degradation
6. **CacheManager**: Intelligent caching with cleanup
7. **ErrorReporter**: Comprehensive error logging and reporting

## Browser Compatibility

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+

*Note: Self-healing features require modern browser APIs including localStorage, fetch, and Promise support.*

## License

This project is open source and available under the MIT License.
