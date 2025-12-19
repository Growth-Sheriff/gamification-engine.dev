/**
 * Gamification Engine - Widget JavaScript
 * Spin Wheel, Scratch Card, Popup Games
 * @version 1.0.0
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const CONFIG = {
    apiBase: 'https://gamification-engine.dev/api/proxy',
    debug: false,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  const state = {
    initialized: false,
    sessionToken: null,
    visitorId: null,
    canPlay: false,
    activeGame: null,
    isPlaying: false,
    cooldownRemaining: 0,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function log(...args) {
    if (CONFIG.debug) {
      console.log('[Gamification]', ...args);
    }
  }

  function getContainer() {
    return document.getElementById('gamification-engine-container');
  }

  function getShopDomain() {
    const container = getContainer();
    return container?.dataset?.shop || window.Shopify?.shop || '';
  }

  function getCustomerEmail() {
    const container = getContainer();
    return container?.dataset?.customerEmail || '';
  }

  function getPageType() {
    const container = getContainer();
    return container?.dataset?.pageType || '';
  }

  // Generate browser fingerprint (simple version)
  function generateFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);

    const data = [
      navigator.userAgent,
      navigator.language,
      screen.colorDepth,
      screen.width + 'x' + screen.height,
      new Date().getTimezoneOffset(),
      canvas.toDataURL(),
    ].join('|');

    // Simple hash
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return 'fp_' + Math.abs(hash).toString(36);
  }

  // API call helper
  async function apiCall(endpoint, data = {}) {
    try {
      const response = await fetch(`${CONFIG.apiBase}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...data,
          shop: getShopDomain(),
        }),
      });

      return await response.json();
    } catch (error) {
      log('API Error:', error);
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // UI COMPONENTS
  // ═══════════════════════════════════════════════════════════════════════════

  const UI = {
    // Create overlay
    createOverlay() {
      const overlay = document.createElement('div');
      overlay.className = 'ge-overlay';
      overlay.id = 'ge-overlay';
      overlay.addEventListener('click', () => this.close());
      return overlay;
    },

    // Create modal
    createModal(content) {
      const modal = document.createElement('div');
      modal.className = 'ge-modal';
      modal.id = 'ge-modal';
      modal.innerHTML = `
        <button class="ge-close-btn" aria-label="Close">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>
        ${content}
      `;

      modal.querySelector('.ge-close-btn').addEventListener('click', () => this.close());
      return modal;
    },

    // Show modal
    show(content) {
      // Remove existing
      this.close();

      const overlay = this.createOverlay();
      const modal = this.createModal(content);

      document.body.appendChild(overlay);
      document.body.appendChild(modal);
      document.body.style.overflow = 'hidden';

      // Trigger animation
      requestAnimationFrame(() => {
        overlay.classList.add('ge-active');
        modal.classList.add('ge-active');
      });
    },

    // Close modal
    close() {
      const overlay = document.getElementById('ge-overlay');
      const modal = document.getElementById('ge-modal');

      if (overlay) {
        overlay.classList.remove('ge-active');
        setTimeout(() => overlay.remove(), 400);
      }

      if (modal) {
        modal.classList.remove('ge-active');
        setTimeout(() => modal.remove(), 400);
      }

      document.body.style.overflow = '';
    },

    // Create confetti
    showConfetti() {
      const container = document.createElement('div');
      container.className = 'ge-confetti';

      const colors = ['#7367f0', '#28c76f', '#ff9f43', '#ea5455', '#00cfe8'];

      for (let i = 0; i < 100; i++) {
        const piece = document.createElement('div');
        piece.className = 'ge-confetti-piece';
        piece.style.left = Math.random() * 100 + '%';
        piece.style.background = colors[Math.floor(Math.random() * colors.length)];
        piece.style.animationDelay = Math.random() * 2 + 's';
        piece.style.transform = `rotate(${Math.random() * 360}deg)`;
        container.appendChild(piece);
      }

      document.body.appendChild(container);
      setTimeout(() => container.remove(), 5000);
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SPIN WHEEL
  // ═══════════════════════════════════════════════════════════════════════════

  const SpinWheel = {
    canvas: null,
    ctx: null,
    segments: [],
    currentAngle: 0,
    isSpinning: false,

    render() {
      const game = state.activeGame;
      if (!game || game.type !== 'SPIN_WHEEL') return '';

      const config = game.config || {};

      return `
        <div class="ge-spin-wheel">
          <h2 class="ge-spin-wheel__title">${config.title || '🎡 Şanslı Çark!'}</h2>
          <p class="ge-spin-wheel__subtitle">${config.subtitle || 'Çarkı çevir, indirim kazan!'}</p>
          
          <div class="ge-spin-wheel__container">
            <svg class="ge-spin-wheel__pointer" width="30" height="30" viewBox="0 0 30 30">
              <polygon points="15,0 0,30 30,30" fill="#333"/>
            </svg>
            <canvas id="ge-wheel-canvas" class="ge-spin-wheel__canvas" width="300" height="300"></canvas>
            <div class="ge-spin-wheel__center">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2a10 10 0 1010 10A10 10 0 0012 2zm0 18a8 8 0 118-8 8 8 0 01-8 8zm4-8a4 4 0 11-4-4 4 4 0 014 4z"/>
              </svg>
            </div>
          </div>
          
          <button class="ge-spin-btn" id="ge-spin-btn">
            <svg viewBox="0 0 24 24" fill="currentColor" style="animation: none;">
              <path d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
            </svg>
            ${config.buttonText || 'Çarkı Çevir'}
          </button>
        </div>
      `;
    },

    init() {
      const game = state.activeGame;
      if (!game || game.type !== 'SPIN_WHEEL') return;

      this.segments = game.segments || [];
      this.canvas = document.getElementById('ge-wheel-canvas');
      if (!this.canvas) return;

      this.ctx = this.canvas.getContext('2d');
      this.drawWheel();

      // Bind spin button
      const spinBtn = document.getElementById('ge-spin-btn');
      if (spinBtn) {
        spinBtn.addEventListener('click', () => this.spin());
      }
    },

    drawWheel() {
      const ctx = this.ctx;
      const canvas = this.canvas;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const radius = Math.min(centerX, centerY) - 10;

      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const totalSegments = this.segments.length;
      if (totalSegments === 0) return;

      const arc = (2 * Math.PI) / totalSegments;

      this.segments.forEach((segment, i) => {
        const startAngle = i * arc + this.currentAngle;
        const endAngle = startAngle + arc;

        // Draw segment
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = segment.color || '#7367f0';
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw text
        ctx.save();
        ctx.translate(centerX, centerY);
        ctx.rotate(startAngle + arc / 2);
        ctx.textAlign = 'right';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 14px Inter, sans-serif';
        ctx.fillText(segment.label, radius - 15, 5);
        ctx.restore();
      });
    },

    async spin() {
      if (this.isSpinning || !state.canPlay) return;

      this.isSpinning = true;
      state.isPlaying = true;

      const spinBtn = document.getElementById('ge-spin-btn');
      if (spinBtn) {
        spinBtn.disabled = true;
        spinBtn.querySelector('svg').style.animation = 'ge-rotate 0.5s linear infinite';
      }

      // Call API to play
      const result = await apiCall('/play', {
        sessionToken: state.sessionToken,
        gameId: state.activeGame.id,
        email: getCustomerEmail(),
      });

      if (!result.success) {
        log('Play failed:', result.error);
        this.isSpinning = false;
        state.isPlaying = false;
        if (spinBtn) spinBtn.disabled = false;
        return;
      }

      // Animate wheel
      const animation = result.data.animation || {};
      const targetAngle = animation.angle || 1800;
      const duration = animation.duration || 5000;

      this.canvas.style.transition = `transform ${duration}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)`;
      this.canvas.style.transform = `rotate(${targetAngle}deg)`;

      // Wait for animation
      setTimeout(() => {
        this.isSpinning = false;
        state.isPlaying = false;
        state.canPlay = false;

        // Show result
        if (result.data.result === 'WIN') {
          UI.showConfetti();
          Results.showWin(result.data);
        } else {
          Results.showLose();
        }
      }, duration + 500);
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // SCRATCH CARD
  // ═══════════════════════════════════════════════════════════════════════════

  const ScratchCard = {
    canvas: null,
    ctx: null,
    isDrawing: false,
    scratchedPercent: 0,
    result: null,

    render() {
      const game = state.activeGame;
      if (!game || game.type !== 'SCRATCH_CARD') return '';

      const config = game.config || {};

      return `
        <div class="ge-scratch-card">
          <h2 class="ge-scratch-card__title">${config.title || '🎫 Kazı Kazan!'}</h2>
          <p class="ge-scratch-card__subtitle">${config.subtitle || 'Kartı kazı, sürprizi gör!'}</p>
          
          <div class="ge-scratch-card__container" id="ge-scratch-container">
            <div class="ge-scratch-card__prize" id="ge-scratch-prize">
              <span class="ge-scratch-card__prize-icon">🎁</span>
              <span class="ge-scratch-card__prize-text">Kazımaya başla!</span>
            </div>
            <canvas id="ge-scratch-canvas" class="ge-scratch-card__canvas"></canvas>
          </div>
          
          <p class="ge-scratch-card__hint">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"/>
            </svg>
            Kazımak için parmağını veya fareyi kullan
          </p>
        </div>
      `;
    },

    async init() {
      const game = state.activeGame;
      if (!game || game.type !== 'SCRATCH_CARD') return;

      const container = document.getElementById('ge-scratch-container');
      this.canvas = document.getElementById('ge-scratch-canvas');
      if (!this.canvas || !container) return;

      // Set canvas size
      this.canvas.width = container.offsetWidth;
      this.canvas.height = container.offsetHeight;

      this.ctx = this.canvas.getContext('2d');

      // Draw scratch layer
      const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
      gradient.addColorStop(0, '#667eea');
      gradient.addColorStop(1, '#764ba2');
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Add shimmer pattern
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      for (let i = 0; i < 50; i++) {
        const x = Math.random() * this.canvas.width;
        const y = Math.random() * this.canvas.height;
        this.ctx.beginPath();
        this.ctx.arc(x, y, Math.random() * 3, 0, Math.PI * 2);
        this.ctx.fill();
      }

      // Add text
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      this.ctx.font = 'bold 20px Inter, sans-serif';
      this.ctx.textAlign = 'center';
      this.ctx.fillText('KAZI!', this.canvas.width / 2, this.canvas.height / 2);

      // Bind events
      this.canvas.addEventListener('mousedown', (e) => this.startScratch(e));
      this.canvas.addEventListener('mousemove', (e) => this.scratch(e));
      this.canvas.addEventListener('mouseup', () => this.endScratch());
      this.canvas.addEventListener('mouseleave', () => this.endScratch());

      this.canvas.addEventListener('touchstart', (e) => this.startScratch(e));
      this.canvas.addEventListener('touchmove', (e) => this.scratch(e));
      this.canvas.addEventListener('touchend', () => this.endScratch());

      // Pre-fetch result
      this.fetchResult();
    },

    async fetchResult() {
      const result = await apiCall('/play', {
        sessionToken: state.sessionToken,
        gameId: state.activeGame.id,
        email: getCustomerEmail(),
      });

      this.result = result;

      // Update prize display
      const prizeEl = document.getElementById('ge-scratch-prize');
      if (prizeEl && result.success) {
        if (result.data.result === 'WIN') {
          const segment = result.data.segment;
          prizeEl.innerHTML = `
            <span class="ge-scratch-card__prize-icon">🎉</span>
            <span class="ge-scratch-card__prize-text">${segment.label}</span>
          `;
        } else {
          prizeEl.innerHTML = `
            <span class="ge-scratch-card__prize-icon">😢</span>
            <span class="ge-scratch-card__prize-text">Şanssız</span>
          `;
        }
      }
    },

    startScratch(e) {
      this.isDrawing = true;
      this.scratch(e);
    },

    scratch(e) {
      if (!this.isDrawing) return;

      e.preventDefault();

      const rect = this.canvas.getBoundingClientRect();
      let x, y;

      if (e.touches) {
        x = e.touches[0].clientX - rect.left;
        y = e.touches[0].clientY - rect.top;
      } else {
        x = e.clientX - rect.left;
        y = e.clientY - rect.top;
      }

      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.beginPath();
      this.ctx.arc(x, y, 25, 0, Math.PI * 2);
      this.ctx.fill();

      // Check scratched percent
      this.checkProgress();
    },

    endScratch() {
      this.isDrawing = false;
    },

    checkProgress() {
      const imageData = this.ctx.getImageData(0, 0, this.canvas.width, this.canvas.height);
      const pixels = imageData.data;
      let transparent = 0;

      for (let i = 3; i < pixels.length; i += 4) {
        if (pixels[i] === 0) transparent++;
      }

      this.scratchedPercent = (transparent / (pixels.length / 4)) * 100;

      // If 50% scratched, reveal and show result
      if (this.scratchedPercent >= 50 && this.result) {
        this.reveal();
      }
    },

    reveal() {
      // Clear canvas completely
      this.ctx.globalCompositeOperation = 'destination-out';
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Show result after delay
      setTimeout(() => {
        if (this.result.data.result === 'WIN') {
          UI.showConfetti();
          Results.showWin(this.result.data);
        } else {
          Results.showLose();
        }
      }, 500);
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // POPUP
  // ═══════════════════════════════════════════════════════════════════════════

  const Popup = {
    render() {
      const game = state.activeGame;
      if (!game || game.type !== 'POPUP') return '';

      const config = game.config || {};
      const segment = game.segments?.[0] || {};

      return `
        <div class="ge-popup">
          <span class="ge-popup__icon">${config.icon || '🎁'}</span>
          <h2 class="ge-popup__title">${config.title || 'Özel Teklif!'}</h2>
          <p class="ge-popup__subtitle">${config.subtitle || 'Sadece senin için özel indirim!'}</p>
          <div class="ge-popup__discount">${segment.label || '%10 İNDİRİM'}</div>
          <button class="ge-popup__btn" id="ge-popup-claim-btn">
            ${config.buttonText || 'İndirimi Al'}
          </button>
        </div>
      `;
    },

    init() {
      const game = state.activeGame;
      if (!game || game.type !== 'POPUP') return;

      const claimBtn = document.getElementById('ge-popup-claim-btn');
      if (claimBtn) {
        claimBtn.addEventListener('click', () => this.claim());
      }
    },

    async claim() {
      const result = await apiCall('/play', {
        sessionToken: state.sessionToken,
        gameId: state.activeGame.id,
        email: getCustomerEmail(),
      });

      if (result.success && result.data.result === 'WIN') {
        UI.showConfetti();
        Results.showWin(result.data);
      } else {
        Results.showLose();
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // RESULTS
  // ═══════════════════════════════════════════════════════════════════════════

  const Results = {
    showWin(data) {
      const discount = data.discount || {};
      const expiresAt = discount.expiresAt ? new Date(discount.expiresAt).toLocaleDateString('tr-TR') : '';

      const html = `
        <div class="ge-result ge-result--win">
          <span class="ge-result__icon">🎉</span>
          <h2 class="ge-result__title">Tebrikler!</h2>
          <p class="ge-result__subtitle">Kazandın! İndirim kodun hazır.</p>
          
          <div class="ge-result__code-container">
            <p class="ge-result__code-label">İndirim Kodun:</p>
            <p class="ge-result__code" id="ge-discount-code">${discount.code || 'XXXX'}</p>
          </div>
          
          <button class="ge-result__copy-btn" id="ge-copy-btn">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
            Kodu Kopyala
          </button>
          
          ${expiresAt ? `<p class="ge-result__expiry">Son kullanma: ${expiresAt}</p>` : ''}
          
          <button class="ge-result__close-btn" id="ge-result-close">Alışverişe Devam Et</button>
        </div>
      `;

      UI.show(html);

      // Bind copy button
      setTimeout(() => {
        const copyBtn = document.getElementById('ge-copy-btn');
        const closeBtn = document.getElementById('ge-result-close');

        if (copyBtn) {
          copyBtn.addEventListener('click', () => {
            const code = document.getElementById('ge-discount-code').textContent;
            navigator.clipboard.writeText(code).then(() => {
              copyBtn.classList.add('ge-copied');
              copyBtn.innerHTML = `
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Kopyalandı!
              `;
            });
          });
        }

        if (closeBtn) {
          closeBtn.addEventListener('click', () => UI.close());
        }
      }, 100);
    },

    showLose() {
      const html = `
        <div class="ge-result ge-result--lose">
          <span class="ge-result__icon">😢</span>
          <h2 class="ge-result__title">Bu Sefer Olmadı</h2>
          <p class="ge-result__subtitle">Ama pes etme! Daha sonra tekrar dene.</p>
          <button class="ge-result__close-btn" id="ge-result-close">Alışverişe Devam Et</button>
        </div>
      `;

      UI.show(html);

      setTimeout(() => {
        const closeBtn = document.getElementById('ge-result-close');
        if (closeBtn) {
          closeBtn.addEventListener('click', () => UI.close());
        }
      }, 100);
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // TRIGGERS
  // ═══════════════════════════════════════════════════════════════════════════

  const Triggers = {
    timeoutId: null,
    scrollHandler: null,
    exitIntentHandler: null,

    setup() {
      const game = state.activeGame;
      if (!game || !state.canPlay) return;

      const trigger = game.trigger;
      const value = game.triggerValue;

      log('Setting up trigger:', trigger, value);

      switch (trigger) {
        case 'PAGE_LOAD':
          this.showGame();
          break;

        case 'TIME_ON_PAGE':
          this.timeoutId = setTimeout(() => this.showGame(), value);
          break;

        case 'SCROLL_DEPTH':
          this.scrollHandler = () => {
            const scrollPercent = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
            if (scrollPercent >= value) {
              this.showGame();
              window.removeEventListener('scroll', this.scrollHandler);
            }
          };
          window.addEventListener('scroll', this.scrollHandler);
          break;

        case 'EXIT_INTENT':
          this.exitIntentHandler = (e) => {
            if (e.clientY <= 0) {
              this.showGame();
              document.removeEventListener('mouseout', this.exitIntentHandler);
            }
          };
          document.addEventListener('mouseout', this.exitIntentHandler);
          break;
      }
    },

    showGame() {
      const game = state.activeGame;
      if (!game || state.isPlaying) return;

      let content = '';
      let initFn = null;

      switch (game.type) {
        case 'SPIN_WHEEL':
          content = SpinWheel.render();
          initFn = () => SpinWheel.init();
          break;

        case 'SCRATCH_CARD':
          content = ScratchCard.render();
          initFn = () => ScratchCard.init();
          break;

        case 'POPUP':
          content = Popup.render();
          initFn = () => Popup.init();
          break;
      }

      if (content) {
        UI.show(content);
        if (initFn) {
          setTimeout(initFn, 100);
        }
      }
    },

    cleanup() {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      if (this.scrollHandler) {
        window.removeEventListener('scroll', this.scrollHandler);
      }
      if (this.exitIntentHandler) {
        document.removeEventListener('mouseout', this.exitIntentHandler);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function init() {
    if (state.initialized) return;

    const container = getContainer();
    if (!container) {
      log('Container not found');
      return;
    }

    const shopDomain = getShopDomain();
    if (!shopDomain) {
      log('Shop domain not found');
      return;
    }

    log('Initializing for shop:', shopDomain);

    // Generate fingerprint
    const fingerprint = generateFingerprint();

    // Initialize session
    const result = await apiCall('/init', {
      fingerprint,
      page: window.location.pathname,
      referrer: document.referrer,
      utmSource: new URLSearchParams(window.location.search).get('utm_source'),
      utmMedium: new URLSearchParams(window.location.search).get('utm_medium'),
      utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign'),
    });

    if (!result.success) {
      log('Init failed:', result.error);
      return;
    }

    // Update state
    state.initialized = true;
    state.sessionToken = result.data.sessionToken;
    state.visitorId = result.data.visitorId;
    state.canPlay = result.data.canPlay;
    state.activeGame = result.data.activeGame;
    state.cooldownRemaining = result.data.cooldownRemaining;

    log('Initialized:', state);

    // Setup triggers if can play
    if (state.canPlay && state.activeGame) {
      Triggers.setup();
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // START
  // ═══════════════════════════════════════════════════════════════════════════

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose for debugging
  window.GamificationEngine = {
    state,
    UI,
    SpinWheel,
    ScratchCard,
    Popup,
    Triggers,
    init,
  };

})();

