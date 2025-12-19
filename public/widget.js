/**
 * Gamification Engine - Embeddable Widget Loader
 * Just add: <script src="https://gamification-engine.dev/widget.js" data-shop="your-store.myshopify.com"></script>
 */
(function() {
  'use strict';

  // Get shop domain from script tag
  const currentScript = document.currentScript;
  const shopDomain = currentScript?.dataset?.shop || window.Shopify?.shop;

  if (!shopDomain) {
    console.warn('[Gamification] Shop domain not found');
    return;
  }

  // Configuration
  const BASE_URL = 'https://gamification-engine.dev';

  // Load CSS
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = BASE_URL + '/widget/gamification-widget.css';
  document.head.appendChild(link);

  // Create container
  const container = document.createElement('div');
  container.id = 'gamification-engine-container';
  container.dataset.shop = shopDomain;
  container.dataset.pageType = getPageType();
  container.dataset.pageUrl = window.location.pathname;
  container.style.display = 'none';
  document.body.appendChild(container);

  // Get page type
  function getPageType() {
    const path = window.location.pathname;
    if (path === '/') return 'index';
    if (path.includes('/products/')) return 'product';
    if (path.includes('/collections/')) return 'collection';
    if (path.includes('/cart')) return 'cart';
    return 'page';
  }

  // Load main widget script
  const script = document.createElement('script');
  script.src = BASE_URL + '/widget/gamification-widget.js';
  script.defer = true;
  document.body.appendChild(script);

})();

