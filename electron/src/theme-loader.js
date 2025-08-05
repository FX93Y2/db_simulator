/**
 * Theme Loader Script
 * Handles immediate theme detection and application
 */

// Immediate theme detection and application
(function() {
  try {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.add('theme-' + savedTheme);
  } catch (e) {
    // Fallback to dark theme if localStorage is not available
    document.body.classList.add('theme-dark');
  }
})();

// Hide loading screen when React is ready
function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  const root = document.getElementById('root');
  
  if (loadingScreen && root && loadingScreen.parentNode) {
    root.classList.add('loaded');
    loadingScreen.style.opacity = '0';
    setTimeout(function() {
      if (loadingScreen && loadingScreen.parentNode) {
        loadingScreen.parentNode.removeChild(loadingScreen);
      }
    }, 500);
  }
}

// Try to hide loading screen when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  // Give React a moment to render
  setTimeout(hideLoadingScreen, 1000);
});

// Also expose globally so React can call it directly if needed
window.hideLoadingScreen = hideLoadingScreen;