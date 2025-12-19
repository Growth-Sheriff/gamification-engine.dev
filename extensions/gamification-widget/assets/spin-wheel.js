/**
 * Gamification Engine - Spin Wheel JavaScript
 * Backend-connected version with API integration
 * Premium Gold/Black Design for DTF Transfer
 */

(function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // CONFIGURATION
  // ═══════════════════════════════════════════════════════════════════════════

  const CONFIG = {
    apiBase: 'https://gamification-engine.dev/api/proxy',
    triggerDelay: 3000, // ms
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
    segments: [],
    isSpinning: false,
    cooldownRemaining: 0,
    currentRotation: 0,
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // UTILITIES
  // ═══════════════════════════════════════════════════════════════════════════

  function log(...args) {
    if (CONFIG.debug) console.log('[SpinWheel]', ...args);
  }

  function getShopDomain() {
    return window.Shopify?.shop || '';
  }

  function getCustomerEmail() {
    return window.__st?.cid || '';
  }

  // Generate browser fingerprint
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, shop: getShopDomain() }),
      });
      return await response.json();
    } catch (error) {
      log('API Error:', error);
      return { success: false, error: error.message };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SPIN WHEEL UI
  // ═══════════════════════════════════════════════════════════════════════════

  const SpinWheel = {
    overlay: null,

    // Build wheel segments HTML
    buildSegmentsHTML() {
      if (!state.segments.length) {
        // Default 6 segments
        return `
          <div class="ge-wheel-segment"><span>5%</span></div>
          <div class="ge-wheel-segment"><span>10%</span></div>
          <div class="ge-wheel-segment"><span>15%</span></div>
          <div class="ge-wheel-segment"><span>20%</span></div>
          <div class="ge-wheel-segment"><span>25%</span></div>
          <div class="ge-wheel-segment"><span>30%</span></div>
        `;
      }
      return state.segments.map((seg, i) =>
        `<div class="ge-wheel-segment" style="transform: rotate(${i * (360/state.segments.length)}deg) skewY(-${90 - 360/state.segments.length}deg);">
          <span>${seg.label}</span>
        </div>`
      ).join('');
    },

    // Build conic gradient from segments
    buildConicGradient() {
      if (!state.segments.length) {
        return `conic-gradient(
          from 0deg,
          #1a1a1a 0deg 60deg,
          #D4AF37 60deg 120deg,
          #1a1a1a 120deg 180deg,
          #D4AF37 180deg 240deg,
          #1a1a1a 240deg 300deg,
          #D4AF37 300deg 360deg
        )`;
      }

      const segmentAngle = 360 / state.segments.length;
      const gradientStops = state.segments.map((seg, i) => {
        const start = i * segmentAngle;
        const end = (i + 1) * segmentAngle;
        return `${seg.color || (i % 2 === 0 ? '#1a1a1a' : '#D4AF37')} ${start}deg ${end}deg`;
      }).join(', ');

      return `conic-gradient(from 0deg, ${gradientStops})`;
    },

    // Render wheel modal
    render() {
      const config = state.activeGame?.config || {};
      const title = config.title || '🎰 İndirim Çarkı';
      const subtitle = config.subtitle || 'Çarkı çevir ve özel indirimini kazan!';
      const buttonText = config.buttonText || '🎲 Çarkı Çevir';
      const badgeText = config.badgeText || '🔥 Şansını Dene!';

      return `
        <div class="ge-spin-wheel-overlay" id="geSpinWheelOverlay">
          <div class="ge-spin-wheel-modal">
            <button class="ge-spin-wheel-close" id="geSpinWheelClose">&times;</button>
            
            <div class="ge-wheel-badge">${badgeText}</div>
            
            <div class="ge-spin-wheel-header">
              <h2 class="ge-spin-wheel-title">${title}</h2>
              <p class="ge-spin-wheel-subtitle">${subtitle}</p>
            </div>
            
            <div class="ge-wheel-container">
              <div class="ge-wheel-wrapper">
                <div class="ge-wheel-pointer"></div>
                
                <div class="ge-wheel" id="geSpinWheel" style="background: ${this.buildConicGradient()};">
                  ${this.buildSegmentsHTML()}
                </div>
                
                <button class="ge-wheel-center" id="geWheelCenter">ÇEVİR</button>
                
                <div class="ge-wheel-particles">
                  <div class="ge-wheel-particle" style="top: 20%; left: 10%; animation-delay: 0s;"></div>
                  <div class="ge-wheel-particle" style="top: 40%; left: 85%; animation-delay: 0.5s;"></div>
                  <div class="ge-wheel-particle" style="top: 70%; left: 15%; animation-delay: 1s;"></div>
                  <div class="ge-wheel-particle" style="top: 30%; left: 90%; animation-delay: 1.5s;"></div>
                  <div class="ge-wheel-particle" style="top: 80%; left: 80%; animation-delay: 2s;"></div>
                </div>
              </div>
            </div>
            
            <button class="ge-spin-btn" id="geSpinBtn">${buttonText}</button>
            
            <div class="ge-spin-result" id="geSpinResult">
              <div class="ge-spin-result-title">🎉 Tebrikler!</div>
              <div class="ge-spin-result-discount" id="geResultDiscount">%20</div>
              <div class="ge-spin-result-message">İndiriminiz otomatik olarak uygulandı!</div>
              <div class="ge-spin-result-code" id="geResultCode">SPIN20</div>
              <div class="ge-spin-result-expiry" id="geResultExpiry"></div>
            </div>
          </div>
        </div>
      `;
    },

    // Show wheel
    show() {
      if (this.overlay) return;

      // Inject HTML
      const container = document.createElement('div');
      container.innerHTML = this.render();
      document.body.appendChild(container);

      this.overlay = document.getElementById('geSpinWheelOverlay');

      // Bind events
      this.bindEvents();

      // Animate in
      requestAnimationFrame(() => {
        this.overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
      });
    },

    // Hide wheel
    hide() {
      if (!this.overlay) return;

      this.overlay.classList.remove('active');
      document.body.style.overflow = '';

      setTimeout(() => {
        this.overlay.parentElement?.remove();
        this.overlay = null;
      }, 500);
    },

    // Bind events
    bindEvents() {
      const closeBtn = document.getElementById('geSpinWheelClose');
      const spinBtn = document.getElementById('geSpinBtn');
      const wheelCenter = document.getElementById('geWheelCenter');
      const resultCode = document.getElementById('geResultCode');

      closeBtn?.addEventListener('click', () => this.hide());
      spinBtn?.addEventListener('click', () => this.spin());
      wheelCenter?.addEventListener('click', () => this.spin());

      resultCode?.addEventListener('click', () => {
        navigator.clipboard?.writeText(resultCode.textContent);
        resultCode.classList.add('copied');
      });

      // Close on overlay click
      this.overlay?.addEventListener('click', (e) => {
        if (e.target === this.overlay) this.hide();
      });

      // ESC key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this.overlay) this.hide();
      });
    },

    // Spin the wheel
    async spin() {
      if (state.isSpinning || !state.canPlay) return;

      state.isSpinning = true;
      const spinBtn = document.getElementById('geSpinBtn');
      const wheel = document.getElementById('geSpinWheel');
      const wheelCenter = document.getElementById('geWheelCenter');

      if (spinBtn) {
        spinBtn.disabled = true;
        spinBtn.textContent = '🎰 Çevriliyor...';
        spinBtn.classList.add('loading');
      }
      if (wheelCenter) wheelCenter.textContent = '...';

      // Call API
      const result = await apiCall('/play', {
        sessionToken: state.sessionToken,
        gameId: state.activeGame?.id,
        fingerprint: generateFingerprint(),
        email: getCustomerEmail(),
      });

      log('Play result:', result);

      if (!result.success) {
        state.isSpinning = false;
        if (spinBtn) {
          spinBtn.disabled = false;
          spinBtn.textContent = '🎲 Çarkı Çevir';
          spinBtn.classList.remove('loading');
        }
        return;
      }

      // Calculate rotation
      const data = result.data || result;
      const segmentCount = state.segments.length || 6;
      const segmentAngle = 360 / segmentCount;
      const winningIndex = data.segmentIndex ?? Math.floor(Math.random() * segmentCount);
      const targetAngle = (360 - (winningIndex * segmentAngle)) - (segmentAngle / 2);
      const spins = 5 + Math.random() * 3;
      const finalRotation = state.currentRotation + (360 * spins) + targetAngle;

      // Animate wheel
      if (wheel) {
        wheel.style.transition = 'transform 5s cubic-bezier(0.17, 0.67, 0.12, 0.99)';
        wheel.style.transform = `rotate(${finalRotation}deg)`;
      }
      state.currentRotation = finalRotation;

      // Show result after animation
      setTimeout(() => {
        state.isSpinning = false;
        state.canPlay = false;

        if (data.result === 'WIN' || data.won) {
          this.showWin(data);
        } else {
          this.showLose();
        }
      }, 5500);
    },

    // Show win result
    showWin(data) {
      const resultDiv = document.getElementById('geSpinResult');
      const discountEl = document.getElementById('geResultDiscount');
      const codeEl = document.getElementById('geResultCode');
      const expiryEl = document.getElementById('geResultExpiry');
      const spinBtn = document.getElementById('geSpinBtn');
      const wheelCenter = document.getElementById('geWheelCenter');

      if (discountEl) {
        const prize = data.prize || {};
        if (prize.type === 'PERCENTAGE') {
          discountEl.textContent = `%${prize.value}`;
        } else if (prize.type === 'FIXED_AMOUNT') {
          discountEl.textContent = `${prize.value}₺`;
        } else if (prize.type === 'FREE_SHIPPING') {
          discountEl.textContent = '🚚 Ücretsiz Kargo';
        } else {
          discountEl.textContent = `%${data.discount || prize.value || 10}`;
        }
      }

      if (codeEl) codeEl.textContent = data.code || 'SPIN10';
      if (expiryEl && data.expiresIn) expiryEl.textContent = `⏰ ${data.expiresIn} geçerli`;
      if (spinBtn) spinBtn.textContent = '✓ İndirim Kazanıldı!';
      if (wheelCenter) wheelCenter.textContent = discountEl?.textContent || '%10';
      if (resultDiv) {
        resultDiv.classList.remove('lose');
        resultDiv.classList.add('show');
      }

      // Confetti
      this.showConfetti();

      // Auto close
      setTimeout(() => this.hide(), 5000);
    },

    // Show lose result
    showLose() {
      const resultDiv = document.getElementById('geSpinResult');
      const discountEl = document.getElementById('geResultDiscount');
      const codeEl = document.getElementById('geResultCode');
      const spinBtn = document.getElementById('geSpinBtn');

      if (discountEl) discountEl.textContent = '😔 Şanssız';
      if (codeEl) codeEl.style.display = 'none';
      if (spinBtn) spinBtn.textContent = 'Bir Dahaki Sefere!';
      if (resultDiv) {
        resultDiv.classList.add('lose', 'show');
      }

      setTimeout(() => this.hide(), 3000);
    },

    // Confetti effect
    showConfetti() {
      const modal = document.querySelector('.ge-spin-wheel-modal');
      if (!modal) return;

      const colors = ['#D4AF37', '#F5E7A3', '#fff', '#dc2626', '#22c55e'];

      for (let i = 0; i < 50; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'ge-confetti';
        confetti.style.left = Math.random() * 100 + '%';
        confetti.style.top = '0';
        confetti.style.background = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 0.5 + 's';

        modal.appendChild(confetti);
        setTimeout(() => confetti.classList.add('active'), 10);
        setTimeout(() => confetti.remove(), 3500);
      }
    },
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // INITIALIZATION
  // ═══════════════════════════════════════════════════════════════════════════

  async function init() {
    if (state.initialized) return;
    state.initialized = true;

    log('Initializing...');

    const shopDomain = getShopDomain();
    if (!shopDomain) {
      log('No shop domain found');
      return;
    }

    // Initialize session with API
    const initResult = await apiCall('/init', {
      fingerprint: generateFingerprint(),
      page: window.location.pathname,
      referrer: document.referrer,
    });

    log('Init result:', initResult);

    if (!initResult.success) {
      log('Init failed:', initResult.error);
      return;
    }

    const data = initResult.data || initResult;
    state.sessionToken = data.sessionToken;
    state.visitorId = data.visitorId;
    state.canPlay = data.canPlay;
    state.activeGame = data.activeGame;
    state.segments = data.activeGame?.segments || [];
    state.cooldownRemaining = data.cooldownRemaining || 0;

    // Show wheel if can play
    if (state.canPlay && state.activeGame) {
      setTimeout(() => {
        SpinWheel.show();
      }, CONFIG.triggerDelay);
    } else {
      log('Cannot play:', { canPlay: state.canPlay, cooldown: state.cooldownRemaining });
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

  // Export for debugging
  window.GamificationSpinWheel = { state, SpinWheel, init };

})();

