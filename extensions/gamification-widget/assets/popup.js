/**
 * Gamification Engine - Popup Widget
 * Exit intent and timed discount popups
 */

(function() {
  'use strict';

  const API_BASE = 'https://gamification-engine.dev/api/proxy';
  const config = window.GamificationConfig?.popup || {};

  if (!config.enabled) return;

  let sessionToken = null;
  let gameData = null;
  let hasShown = false;

  // Initialize
  async function init() {
    try {
      const response = await fetch(`${API_BASE}/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop: config.shopDomain,
          page: config.pagePath,
          fingerprint: getFingerprint()
        })
      });

      const data = await response.json();

      if (data.success && data.data.activeGame?.type === 'POPUP') {
        sessionToken = data.data.sessionToken;
        gameData = data.data.activeGame;

        if (data.data.canPlay) {
          setupTrigger();
        }
      }
    } catch (error) {
      console.error('Popup init error:', error);
    }
  }

  function getFingerprint() {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('fingerprint', 2, 2);
    return canvas.toDataURL().substring(0, 50) + navigator.userAgent.substring(0, 30);
  }

  function setupTrigger() {
    switch (config.triggerType) {
      case 'exit':
        document.addEventListener('mouseout', handleExitIntent);
        break;
      case 'scroll':
        window.addEventListener('scroll', handleScroll);
        break;
      default:
        setTimeout(showPopup, config.triggerDelay);
    }
  }

  function handleExitIntent(e) {
    if (e.clientY < 10 && !hasShown) {
      document.removeEventListener('mouseout', handleExitIntent);
      showPopup();
    }
  }

  function handleScroll() {
    const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
    if (scrollPercent > 75 && !hasShown) {
      window.removeEventListener('scroll', handleScroll);
      showPopup();
    }
  }

  async function showPopup() {
    if (hasShown) return;
    hasShown = true;

    // Get discount first
    let discountCode = 'WELCOME10';
    let discountValue = '%10';

    try {
      const response = await fetch(`${API_BASE}/play`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionToken,
          gameId: gameData.id,
          email: config.customerEmail || undefined
        })
      });

      const data = await response.json();

      if (data.success && data.data.discount) {
        discountCode = data.data.discount.code;
        discountValue = data.data.prize?.label || '%10';
      }
    } catch (error) {
      console.error('Popup play error:', error);
    }

    const primaryColor = config.primaryColor || '#7367f0';

    const overlay = document.createElement('div');
    overlay.id = 'popup-overlay';
    overlay.innerHTML = `
      <style>
        #popup-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.85);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          animation: popupFadeIn 0.3s ease;
          padding: 20px;
        }
        @keyframes popupFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .popup-container {
          background: white;
          border-radius: 24px;
          max-width: 480px;
          width: 100%;
          overflow: hidden;
          box-shadow: 0 30px 80px rgba(0,0,0,0.4);
          animation: popupSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
          position: relative;
        }
        @keyframes popupSlideUp {
          from { transform: scale(0.9) translateY(30px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .popup-header {
          background: linear-gradient(135deg, ${primaryColor}, ${adjustColor(primaryColor, 30)});
          padding: 40px 30px;
          text-align: center;
          color: white;
          position: relative;
          overflow: hidden;
        }
        .popup-header::before {
          content: '';
          position: absolute;
          top: -50%;
          left: -50%;
          width: 200%;
          height: 200%;
          background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 60%);
          animation: popupShine 3s infinite;
        }
        @keyframes popupShine {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .popup-emoji {
          font-size: 4rem;
          margin-bottom: 15px;
          display: block;
          animation: popupBounce 1s infinite;
        }
        @keyframes popupBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-10px); }
        }
        .popup-title {
          font-size: 1.6rem;
          font-weight: 800;
          margin-bottom: 10px;
          text-shadow: 0 2px 10px rgba(0,0,0,0.2);
          position: relative;
        }
        .popup-discount-value {
          font-size: 3rem;
          font-weight: 900;
          margin: 15px 0;
          text-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        .popup-body {
          padding: 30px;
          text-align: center;
        }
        .popup-message {
          color: #666;
          margin-bottom: 20px;
          line-height: 1.6;
        }
        .popup-code-wrapper {
          background: #f8f8f8;
          border: 2px dashed ${primaryColor};
          border-radius: 12px;
          padding: 15px 20px;
          margin-bottom: 20px;
          position: relative;
        }
        .popup-code-label {
          position: absolute;
          top: -10px;
          left: 50%;
          transform: translateX(-50%);
          background: white;
          padding: 0 10px;
          color: ${primaryColor};
          font-size: 0.75rem;
          font-weight: 600;
        }
        .popup-code {
          font-family: 'Courier New', monospace;
          font-size: 1.5rem;
          font-weight: bold;
          letter-spacing: 3px;
          color: #333;
        }
        .popup-cta {
          background: ${primaryColor};
          color: white;
          border: none;
          padding: 16px 40px;
          border-radius: 12px;
          font-size: 1.1rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.3s;
          width: 100%;
          margin-bottom: 15px;
        }
        .popup-cta:hover {
          transform: scale(1.02);
          box-shadow: 0 8px 25px ${primaryColor}50;
        }
        .popup-copy {
          background: none;
          border: 2px solid ${primaryColor};
          color: ${primaryColor};
          padding: 12px 30px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .popup-copy:hover {
          background: ${primaryColor}10;
        }
        .popup-close {
          position: absolute;
          top: 15px;
          right: 15px;
          background: rgba(255,255,255,0.2);
          border: none;
          width: 35px;
          height: 35px;
          border-radius: 50%;
          font-size: 1.2rem;
          cursor: pointer;
          color: white;
          transition: all 0.2s;
          z-index: 1;
        }
        .popup-close:hover {
          background: rgba(255,255,255,0.3);
          transform: scale(1.1);
        }
        .popup-timer {
          color: #999;
          font-size: 0.85rem;
          margin-top: 15px;
        }
        .popup-timer span {
          color: #e74c3c;
          font-weight: bold;
        }
      </style>
      
      <div class="popup-container">
        <button class="popup-close" onclick="closePopup()">×</button>
        
        <div class="popup-header">
          <span class="popup-emoji">🎁</span>
          <div class="popup-title">${config.title}</div>
          <div class="popup-discount-value">${discountValue}</div>
        </div>
        
        <div class="popup-body">
          <p class="popup-message">${config.message}</p>
          
          <div class="popup-code-wrapper">
            <span class="popup-code-label">İNDİRİM KODU</span>
            <div class="popup-code" id="popup-code">${discountCode}</div>
          </div>
          
          <button class="popup-cta" onclick="applyPopupCode()">${config.ctaText}</button>
          <button class="popup-copy" onclick="copyPopupCode()">📋 Kodu Kopyala</button>
          
          <div class="popup-timer">⏰ Bu teklif <span id="popup-countdown">15:00</span> içinde sona erecek</div>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    startCountdown();
  }

  function adjustColor(color, amount) {
    const num = parseInt(color.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + amount);
    const g = Math.min(255, ((num >> 8) & 0x00FF) + amount);
    const b = Math.min(255, (num & 0x0000FF) + amount);
    return `#${(1 << 24 | r << 16 | g << 8 | b).toString(16).slice(1)}`;
  }

  function startCountdown() {
    let seconds = 15 * 60;
    const countdownEl = document.getElementById('popup-countdown');

    const timer = setInterval(() => {
      if (!countdownEl) {
        clearInterval(timer);
        return;
      }

      seconds--;
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      countdownEl.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

      if (seconds <= 0) {
        clearInterval(timer);
        countdownEl.textContent = 'Süre doldu!';
      }
    }, 1000);
  }

  window.closePopup = function() {
    const overlay = document.getElementById('popup-overlay');
    if (overlay) {
      overlay.style.animation = 'popupFadeIn 0.2s ease reverse';
      setTimeout(() => overlay.remove(), 200);
    }
  };

  window.copyPopupCode = function() {
    const code = document.getElementById('popup-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.querySelector('.popup-copy');
      btn.textContent = '✅ Kopyalandı!';
      setTimeout(() => btn.textContent = '📋 Kodu Kopyala', 2000);
    });
  };

  window.applyPopupCode = function() {
    const code = document.getElementById('popup-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      window.location.href = '/cart?discount=' + code;
    });
  };

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

