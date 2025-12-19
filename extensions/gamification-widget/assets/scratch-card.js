/**
 * Gamification Engine - Scratch Card Widget
 * Interactive scratch card game
 */

(function() {
  'use strict';

  const API_BASE = 'https://gamification-engine.dev/api/proxy';
  const config = window.GamificationConfig?.scratchCard || {};

  if (!config.enabled) return;

  let sessionToken = null;
  let gameData = null;
  let isPlaying = false;
  let hasPlayed = false;

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

      if (data.success && data.data.activeGame?.type === 'SCRATCH_CARD') {
        sessionToken = data.data.sessionToken;
        gameData = data.data.activeGame;

        if (data.data.canPlay) {
          setupTrigger();
        }
      }
    } catch (error) {
      console.error('Scratch card init error:', error);
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
        document.addEventListener('mouseout', (e) => {
          if (e.clientY < 10 && !hasPlayed) showScratchCard();
        }, { once: true });
        break;
      case 'scroll':
        window.addEventListener('scroll', () => {
          const scrollPercent = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
          if (scrollPercent > 50 && !hasPlayed) showScratchCard();
        }, { once: true });
        break;
      default:
        setTimeout(() => {
          if (!hasPlayed) showScratchCard();
        }, config.triggerDelay);
    }
  }

  function showScratchCard() {
    if (hasPlayed) return;

    const overlay = document.createElement('div');
    overlay.id = 'scratch-card-overlay';
    overlay.innerHTML = `
      <style>
        #scratch-card-overlay {
          position: fixed;
          inset: 0;
          background: rgba(0,0,0,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 99999;
          animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .scratch-card-container {
          background: white;
          border-radius: 20px;
          padding: 30px;
          max-width: 400px;
          width: 90%;
          text-align: center;
          box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          animation: slideUp 0.4s ease;
        }
        @keyframes slideUp {
          from { transform: translateY(30px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .scratch-card-title {
          font-size: 1.8rem;
          font-weight: 800;
          margin-bottom: 10px;
          color: #333;
        }
        .scratch-card-subtitle {
          color: #666;
          margin-bottom: 25px;
        }
        .scratch-canvas-wrapper {
          position: relative;
          width: 280px;
          height: 140px;
          margin: 0 auto 20px;
          border-radius: 15px;
          overflow: hidden;
          box-shadow: 0 4px 15px rgba(0,0,0,0.15);
        }
        .scratch-prize {
          position: absolute;
          inset: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(135deg, #28c76f, #48da89);
          color: white;
        }
        .scratch-prize-value {
          font-size: 2.5rem;
          font-weight: 900;
          text-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        .scratch-prize-label {
          font-size: 1rem;
          opacity: 0.9;
        }
        #scratch-canvas {
          position: absolute;
          inset: 0;
          cursor: crosshair;
        }
        .scratch-instruction {
          color: #999;
          font-size: 0.85rem;
          margin-bottom: 15px;
        }
        .scratch-close {
          position: absolute;
          top: 15px;
          right: 15px;
          background: none;
          border: none;
          font-size: 1.5rem;
          cursor: pointer;
          color: #999;
          transition: color 0.2s;
        }
        .scratch-close:hover {
          color: #333;
        }
        .scratch-result {
          display: none;
          margin-top: 20px;
        }
        .scratch-result.show {
          display: block;
          animation: fadeIn 0.3s ease;
        }
        .scratch-code {
          background: #f5f5f5;
          padding: 15px 25px;
          border-radius: 10px;
          font-family: monospace;
          font-size: 1.3rem;
          font-weight: bold;
          letter-spacing: 2px;
          margin: 15px 0;
        }
        .scratch-copy-btn {
          background: ${config.accentColor || '#28c76f'};
          color: white;
          border: none;
          padding: 12px 30px;
          border-radius: 10px;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.2s;
        }
        .scratch-copy-btn:hover {
          transform: scale(1.05);
        }
      </style>
      
      <div class="scratch-card-container">
        <button class="scratch-close" onclick="document.getElementById('scratch-card-overlay').remove()">×</button>
        <div class="scratch-card-title">${config.title}</div>
        <div class="scratch-card-subtitle">${config.subtitle}</div>
        
        <div class="scratch-canvas-wrapper">
          <div class="scratch-prize" id="scratch-prize">
            <div class="scratch-prize-value" id="prize-value">?</div>
            <div class="scratch-prize-label">İNDİRİM</div>
          </div>
          <canvas id="scratch-canvas" width="280" height="140"></canvas>
        </div>
        
        <div class="scratch-instruction" id="scratch-instruction">👆 Kazımak için kartın üzerinde parmağınızı gezdirin</div>
        
        <div class="scratch-result" id="scratch-result">
          <p>🎉 Tebrikler! İndirim kodunuz:</p>
          <div class="scratch-code" id="scratch-code">---</div>
          <button class="scratch-copy-btn" onclick="copyScratchCode()">📋 Kodu Kopyala</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);
    initScratchCanvas();
    playScratchCard();
  }

  function initScratchCanvas() {
    const canvas = document.getElementById('scratch-canvas');
    const ctx = canvas.getContext('2d');

    // Fill with scratch color
    ctx.fillStyle = config.scratchColor || '#c0c0c0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Add pattern/texture
    ctx.fillStyle = '#aaa';
    for (let i = 0; i < 50; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 280, Math.random() * 140, Math.random() * 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Add text
    ctx.fillStyle = '#888';
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('KAZI KAZAN', 140, 75);

    let isDrawing = false;
    let scratchedPixels = 0;
    const totalPixels = canvas.width * canvas.height;

    function scratch(x, y) {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, 25, 0, Math.PI * 2);
      ctx.fill();

      // Check scratch progress
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let transparent = 0;
      for (let i = 3; i < imageData.data.length; i += 4) {
        if (imageData.data[i] === 0) transparent++;
      }
      scratchedPixels = transparent;

      if (scratchedPixels / totalPixels > 0.5) {
        revealPrize();
      }
    }

    canvas.addEventListener('mousedown', () => isDrawing = true);
    canvas.addEventListener('mouseup', () => isDrawing = false);
    canvas.addEventListener('mouseleave', () => isDrawing = false);
    canvas.addEventListener('mousemove', (e) => {
      if (!isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      scratch(e.clientX - rect.left, e.clientY - rect.top);
    });

    // Touch support
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      isDrawing = true;
    });
    canvas.addEventListener('touchend', () => isDrawing = false);
    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (!isDrawing) return;
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      scratch(touch.clientX - rect.left, touch.clientY - rect.top);
    });
  }

  let prizeData = null;

  async function playScratchCard() {
    if (isPlaying) return;
    isPlaying = true;

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

      if (data.success) {
        prizeData = data.data;
        document.getElementById('prize-value').textContent = prizeData.prize?.label || 'Şanslı!';
      }
    } catch (error) {
      console.error('Play error:', error);
    }
  }

  function revealPrize() {
    if (hasPlayed) return;
    hasPlayed = true;

    const canvas = document.getElementById('scratch-canvas');
    canvas.style.display = 'none';

    document.getElementById('scratch-instruction').style.display = 'none';

    if (prizeData && prizeData.discount) {
      document.getElementById('scratch-code').textContent = prizeData.discount.code;
      document.getElementById('scratch-result').classList.add('show');
    }
  }

  window.copyScratchCode = function() {
    const code = document.getElementById('scratch-code').textContent;
    navigator.clipboard.writeText(code).then(() => {
      const btn = document.querySelector('.scratch-copy-btn');
      btn.textContent = '✅ Kopyalandı!';
      setTimeout(() => btn.textContent = '📋 Kodu Kopyala', 2000);
    });
  };

  // Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

