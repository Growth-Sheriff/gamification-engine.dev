/**
 * Gamification Engine - Loyalty Widget
 * Customer-facing loyalty points display
 */

(function() {
  'use strict';

  const API_BASE = 'https://gamification-engine.dev/api/proxy';
  const config = window.GamificationConfig?.loyalty || {};

  if (!config.enabled) return;

  // State
  let state = {
    points: 0,
    tier: 'Bronze',
    tierColor: '#CD7F32',
    nextTier: null,
    pointsToNext: 0,
    isLoaded: false,
    isOpen: false
  };

  // Create widget HTML
  function createWidget() {
    const container = document.getElementById('loyalty-widget-container');
    if (!container) return;

    const position = config.position || 'bottom-right';
    const primaryColor = config.primaryColor || '#7367f0';
    const accentColor = config.accentColor || '#ffd700';

    container.innerHTML = `
      <style>
        #loyalty-widget {
          position: fixed;
          ${position === 'bottom-right' ? 'right: 20px; bottom: 20px;' : ''}
          ${position === 'bottom-left' ? 'left: 20px; bottom: 20px;' : ''}
          z-index: 9998;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        
        #loyalty-trigger {
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: linear-gradient(135deg, ${primaryColor}, ${accentColor});
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          transition: transform 0.3s, box-shadow 0.3s;
        }
        
        #loyalty-trigger:hover {
          transform: scale(1.1);
          box-shadow: 0 6px 25px rgba(0,0,0,0.3);
        }
        
        #loyalty-trigger svg {
          width: 28px;
          height: 28px;
          fill: white;
        }
        
        #loyalty-badge {
          position: absolute;
          top: -5px;
          right: -5px;
          background: #ff4757;
          color: white;
          font-size: 11px;
          font-weight: bold;
          padding: 2px 6px;
          border-radius: 10px;
          min-width: 20px;
          text-align: center;
        }
        
        #loyalty-panel {
          position: absolute;
          bottom: 70px;
          ${position === 'bottom-right' ? 'right: 0;' : 'left: 0;'}
          width: 320px;
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          overflow: hidden;
          transform: scale(0.8) translateY(20px);
          opacity: 0;
          visibility: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        
        #loyalty-panel.open {
          transform: scale(1) translateY(0);
          opacity: 1;
          visibility: visible;
        }
        
        .loyalty-header {
          background: linear-gradient(135deg, ${primaryColor}, ${accentColor});
          color: white;
          padding: 20px;
          text-align: center;
        }
        
        .loyalty-points {
          font-size: 2.5rem;
          font-weight: 800;
          margin: 10px 0;
          text-shadow: 0 2px 10px rgba(0,0,0,0.2);
        }
        
        .loyalty-tier {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 0.85rem;
          font-weight: 600;
          background: rgba(255,255,255,0.2);
        }
        
        .loyalty-progress {
          padding: 15px 20px;
          border-bottom: 1px solid #eee;
        }
        
        .loyalty-progress-bar {
          height: 8px;
          background: #eee;
          border-radius: 4px;
          overflow: hidden;
          margin: 8px 0;
        }
        
        .loyalty-progress-fill {
          height: 100%;
          background: linear-gradient(90deg, ${primaryColor}, ${accentColor});
          border-radius: 4px;
          transition: width 0.5s ease;
        }
        
        .loyalty-progress-text {
          display: flex;
          justify-content: space-between;
          font-size: 0.8rem;
          color: #666;
        }
        
        .loyalty-actions {
          padding: 15px 20px;
        }
        
        .loyalty-action-btn {
          width: 100%;
          padding: 12px;
          border: none;
          border-radius: 10px;
          background: ${primaryColor};
          color: white;
          font-weight: 600;
          cursor: pointer;
          transition: background 0.2s;
          margin-bottom: 10px;
        }
        
        .loyalty-action-btn:hover {
          filter: brightness(1.1);
        }
        
        .loyalty-action-btn.secondary {
          background: #f5f5f5;
          color: #333;
        }
        
        .loyalty-ways {
          padding: 15px 20px;
          background: #fafafa;
        }
        
        .loyalty-ways h4 {
          margin: 0 0 10px;
          font-size: 0.9rem;
          color: #333;
        }
        
        .loyalty-way {
          display: flex;
          align-items: center;
          padding: 8px 0;
          font-size: 0.85rem;
          color: #666;
        }
        
        .loyalty-way-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          background: ${primaryColor}15;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-right: 10px;
          font-size: 0.9rem;
        }
        
        .loyalty-way-points {
          margin-left: auto;
          font-weight: 600;
          color: ${primaryColor};
        }
        
        .loyalty-login {
          text-align: center;
          padding: 30px 20px;
        }
        
        .loyalty-login p {
          color: #666;
          margin-bottom: 15px;
        }
      </style>
      
      <div id="loyalty-widget">
        <button id="loyalty-trigger">
          <svg viewBox="0 0 24 24"><path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/></svg>
          <span id="loyalty-badge" style="display: none;">0</span>
        </button>
        
        <div id="loyalty-panel">
          ${config.isLoggedIn ? getLoggedInContent() : getGuestContent()}
        </div>
      </div>
    `;

    container.style.display = 'block';
    bindEvents();

    if (config.isLoggedIn) {
      fetchLoyaltyData();
    }
  }

  function getLoggedInContent() {
    return `
      <div class="loyalty-header">
        <div>Merhaba, ${config.customerName || 'Değerli Müşteri'} 👋</div>
        <div class="loyalty-points" id="loyalty-points-display">-</div>
        <div class="loyalty-tier" id="loyalty-tier-display">Yükleniyor...</div>
      </div>
      
      <div class="loyalty-progress">
        <div class="loyalty-progress-text">
          <span id="loyalty-current-tier">-</span>
          <span id="loyalty-next-tier">-</span>
        </div>
        <div class="loyalty-progress-bar">
          <div class="loyalty-progress-fill" id="loyalty-progress-fill" style="width: 0%"></div>
        </div>
        <div class="loyalty-progress-text">
          <span id="loyalty-points-to-next">-</span>
        </div>
      </div>
      
      <div class="loyalty-actions">
        <button class="loyalty-action-btn" id="loyalty-redeem-btn">🎁 Puan Kullan</button>
        <button class="loyalty-action-btn secondary" id="loyalty-history-btn">📋 İşlem Geçmişi</button>
      </div>
      
      <div class="loyalty-ways">
        <h4>Puan Kazanma Yolları</h4>
        <div class="loyalty-way">
          <span class="loyalty-way-icon">🛍️</span>
          <span>Alışveriş yapın</span>
          <span class="loyalty-way-points">1 TL = 1 puan</span>
        </div>
        <div class="loyalty-way">
          <span class="loyalty-way-icon">⭐</span>
          <span>Yorum yazın</span>
          <span class="loyalty-way-points">+50 puan</span>
        </div>
        <div class="loyalty-way">
          <span class="loyalty-way-icon">👥</span>
          <span>Arkadaş davet edin</span>
          <span class="loyalty-way-points">+500 puan</span>
        </div>
        <div class="loyalty-way">
          <span class="loyalty-way-icon">📱</span>
          <span>Sosyal medyada paylaşın</span>
          <span class="loyalty-way-points">+25 puan</span>
        </div>
      </div>
    `;
  }

  function getGuestContent() {
    return `
      <div class="loyalty-header">
        <div style="font-size: 2rem; margin-bottom: 10px;">⭐</div>
        <div style="font-size: 1.2rem; font-weight: 600;">Sadakat Programı</div>
      </div>
      
      <div class="loyalty-login">
        <p>Alışverişlerinizden puan kazanın ve özel avantajlardan yararlanın!</p>
        <a href="/account/login" class="loyalty-action-btn" style="display: inline-block; text-decoration: none;">Giriş Yap</a>
        <p style="margin-top: 15px; font-size: 0.85rem;">
          <a href="/account/register" style="color: ${config.primaryColor};">Hesap oluştur</a> ve <strong>100 puan</strong> kazan!
        </p>
      </div>
      
      <div class="loyalty-ways">
        <h4>Üye Avantajları</h4>
        <div class="loyalty-way">
          <span class="loyalty-way-icon">🎁</span>
          <span>Özel indirimler</span>
        </div>
        <div class="loyalty-way">
          <span class="loyalty-way-icon">🚚</span>
          <span>Ücretsiz kargo</span>
        </div>
        <div class="loyalty-way">
          <span class="loyalty-way-icon">🏆</span>
          <span>VIP seviyeler</span>
        </div>
      </div>
    `;
  }

  function bindEvents() {
    const trigger = document.getElementById('loyalty-trigger');
    const panel = document.getElementById('loyalty-panel');

    if (trigger) {
      trigger.addEventListener('click', () => {
        state.isOpen = !state.isOpen;
        panel.classList.toggle('open', state.isOpen);
      });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      const widget = document.getElementById('loyalty-widget');
      if (widget && !widget.contains(e.target) && state.isOpen) {
        state.isOpen = false;
        panel.classList.remove('open');
      }
    });

    // Redeem button
    const redeemBtn = document.getElementById('loyalty-redeem-btn');
    if (redeemBtn) {
      redeemBtn.addEventListener('click', showRedeemModal);
    }

    // History button
    const historyBtn = document.getElementById('loyalty-history-btn');
    if (historyBtn) {
      historyBtn.addEventListener('click', showHistoryModal);
    }
  }

  async function fetchLoyaltyData() {
    try {
      const response = await fetch(`${API_BASE}/loyalty/balance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shop: config.shopDomain,
          customerId: config.customerId,
          email: config.customerEmail
        })
      });

      const data = await response.json();

      if (data.success) {
        state = { ...state, ...data.data, isLoaded: true };
        updateUI();
      }
    } catch (error) {
      console.error('Loyalty fetch error:', error);
    }
  }

  function updateUI() {
    const pointsDisplay = document.getElementById('loyalty-points-display');
    const tierDisplay = document.getElementById('loyalty-tier-display');
    const badge = document.getElementById('loyalty-badge');
    const progressFill = document.getElementById('loyalty-progress-fill');
    const currentTier = document.getElementById('loyalty-current-tier');
    const nextTier = document.getElementById('loyalty-next-tier');
    const pointsToNext = document.getElementById('loyalty-points-to-next');

    if (pointsDisplay) pointsDisplay.textContent = state.points.toLocaleString();
    if (tierDisplay) {
      tierDisplay.textContent = state.tier;
      tierDisplay.style.background = state.tierColor + '40';
    }

    if (badge && state.points > 0) {
      badge.style.display = 'block';
      badge.textContent = state.points > 999 ? '999+' : state.points;
    }

    if (progressFill && state.nextTier) {
      const progress = Math.min(100, (state.points / (state.points + state.pointsToNext)) * 100);
      progressFill.style.width = progress + '%';
    }

    if (currentTier) currentTier.textContent = state.tier;
    if (nextTier) nextTier.textContent = state.nextTier || 'Max';
    if (pointsToNext) {
      pointsToNext.textContent = state.pointsToNext > 0
        ? `${state.pointsToNext.toLocaleString()} puan sonra ${state.nextTier}`
        : 'En yüksek seviyedesiniz! 🎉';
    }
  }

  function showRedeemModal() {
    alert('Puan kullanma özelliği yakında aktif olacak!');
  }

  function showHistoryModal() {
    alert('İşlem geçmişi yakında aktif olacak!');
  }

  // Initialize
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();

