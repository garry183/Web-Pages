# AI Video Explorer

A sleek, Matrix-themed web application that displays the top 10 most viewed Artificial Intelligence videos on YouTube from the past week.

## Features

- 🎥 Displays top AI videos from YouTube
- 🎨 Matrix-style animated background
- 🎮 Interactive hover previews
- 📱 Responsive design
- ⚡ Real-time data fetching
- 🔧 Configurable settings
- **🛡️ Comprehensive Self-Healing System**
- **🖼️ Intelligent Image Loading with Fallbacks**
- **🌐 Offline Support via Service Worker**
- **📊 Real-time Health Monitoring**
- **🔄 Automatic Recovery & Retry Logic**

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

## Security Notes

- The `config.json` file is included in `.gitignore` to prevent accidentally committing API keys
- Always use `config.template.json` as a reference for the expected configuration structure
- Never commit your actual API keys to version control

## Fallback Mode

If no valid API key is provided or the configuration file cannot be loaded, the application will run in demo mode using sample data.

## Self-Healing Capabilities

The framework includes a comprehensive self-healing system that automatically handles errors and optimizes performance:

### 🛡️ Core Self-Healing Features
- **Circuit Breaker Pattern**: Prevents cascading failures by temporarily blocking requests to failed services
- **Exponential Backoff Retry**: Smart retry logic with increasing delays between attempts
- **Configuration Auto-Repair**: Validates and fixes configuration issues automatically
- **Network Recovery**: Detects network restoration and recovers services seamlessly
- **Memory Management**: Automatic cleanup to prevent memory leaks
- **Performance Monitoring**: Real-time performance tracking with automatic optimization

### 🖼️ Enhanced Image Loading
- **Intelligent Fallbacks**: Automatic fallback images when sources fail to load
- **Lazy Loading**: Images load only when needed using Intersection Observer
- **Caching System**: Smart image caching with health checks and recovery
- **Progressive Loading**: Smooth loading experience with placeholders

### 🌐 Offline Capabilities
- **Service Worker**: Full offline functionality with intelligent caching strategies
- **Background Sync**: Automatic retry of failed requests when connection is restored
- **Graceful Degradation**: Application continues to function with limited connectivity
- **Cache-First/Network-First**: Optimal caching strategies for different resource types

### 📊 Health Monitoring
- **Real-time Diagnostics**: Live system health monitoring and metrics
- **Failure Pattern Recognition**: Tracks and learns from failure patterns
- **Recovery Analytics**: Comprehensive reporting on self-healing effectiveness
- **Cross-tab Synchronization**: Shared state management across browser tabs

### 🧪 Testing Framework
- **Comprehensive Test Suites**: Dedicated testing for all self-healing features
- **Automated Validation**: Built-in tests for system health and recovery
- **Performance Benchmarks**: Metrics tracking for optimization analysis

## Technologies Used

- HTML5 & CSS3
- Vanilla JavaScript
- YouTube Data API v3
- Canvas API (for Matrix effect)
- CSS Grid & Flexbox
- CSS Custom Properties
- **Service Workers** (for offline capabilities)
- **Intersection Observer API** (for lazy loading)
- **Local Storage API** (for state persistence)

## Browser Compatibility

- Chrome/Edge 88+
- Firefox 85+
- Safari 14+

## License

This project is open source and available under the MIT License.
