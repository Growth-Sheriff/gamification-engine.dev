/**
})();
  }
    createWidget();
  } else {
    document.addEventListener('DOMContentLoaded', createWidget);
  if (document.readyState === 'loading') {
  // Initialize

  };
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    const body = encodeURIComponent(`Merhaba,\n\nBu linki kullanarak ${referralData.refereeReward} TL indirim kazan:\n${referralData.shareUrl}\n\nİyi alışverişler!`);
    const subject = encodeURIComponent('Sana özel indirim!');
    if (!referralData) return;
  window.shareEmail = function() {

  };
    window.open(`https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(referralData.shareUrl)}`, '_blank');
    const text = encodeURIComponent(`Bu linki kullanarak ${referralData.refereeReward} TL indirim kazan!`);
    if (!referralData) return;
  window.shareTwitter = function() {

  };
    window.open(`https://wa.me/?text=${text}`, '_blank');
    const text = encodeURIComponent(`Hey! Bu linki kullanarak ${referralData.refereeReward} TL indirim kazan: ${referralData.shareUrl}`);
    if (!referralData) return;
  window.shareWhatsApp = function() {

  };
    });
      setTimeout(() => btn.textContent = '📋 Linki Kopyala', 2000);
      btn.textContent = '✅ Kopyalandı!';
      const btn = document.querySelector('.referral-copy-btn');
    navigator.clipboard.writeText(referralData.shareUrl).then(() => {

    if (!referralData) return;
  window.copyReferralLink = function() {

  }
    }
      console.error('Referral fetch error:', error);
    } catch (error) {
      }
        document.getElementById('referral-code').textContent = referralData.code;
        referralData = data.data;
      if (data.success) {

      const data = await response.json();

      });
        })
          email: config.customerEmail
          customerId: config.customerId,
          shop: config.shopDomain,
        body: JSON.stringify({
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
      const response = await fetch(`${API_BASE}/referral/code`, {
    try {
  async function fetchReferralCode() {

  }
    });
      }
        panel.classList.remove('open');
        isOpen = false;
      if (widget && !widget.contains(e.target) && isOpen) {
      const widget = document.getElementById('referral-widget');
    document.addEventListener('click', (e) => {
    // Close on outside click

    }
      });
        panel.classList.toggle('open', isOpen);
        isOpen = !isOpen;
      trigger.addEventListener('click', () => {
    if (trigger) {

    const panel = document.getElementById('referral-panel');
    const trigger = document.getElementById('referral-trigger');
  function bindEvents() {

  }
    fetchReferralCode();
    bindEvents();
    container.style.display = 'block';

    `;
      </div>
        </div>
          </div>
            </div>
              </div>
                <div class="referral-stat-label">Kazanılan</div>
                <div class="referral-stat-value" id="referral-earned">0 TL</div>
              <div>
              </div>
                <div class="referral-stat-label">Davet Edilen</div>
                <div class="referral-stat-value" id="referral-invited">0</div>
              <div>
            <div class="referral-stats">

            </div>
              <button class="referral-share-btn email" onclick="shareEmail()">Email</button>
              <button class="referral-share-btn twitter" onclick="shareTwitter()">Twitter</button>
              <button class="referral-share-btn whatsapp" onclick="shareWhatsApp()">WhatsApp</button>
            <div class="referral-share-btns">
            <div class="referral-share-title">Veya paylaş:</div>

            </button>
              📋 Linki Kopyala
            <button class="referral-copy-btn" onclick="copyReferralLink()">

            </div>
              <div class="referral-code" id="referral-code">Yükleniyor...</div>
              <div class="referral-code-label">SENİN DAVET KODUN</div>
            <div class="referral-code-box">
          <div class="referral-body">

          </div>
            <div class="referral-reward">${config.rewardText}</div>
            <div class="referral-title">${config.title}</div>
          <div class="referral-header">
        <div id="referral-panel">

        </button>
          <span>Arkadaşını Davet Et</span>
          <span>👥</span>
        <button id="referral-trigger">
      <div id="referral-widget">

      </style>
        }
          color: #999;
          font-size: 0.75rem;
        .referral-stat-label {

        }
          color: ${primaryColor};
          font-weight: 700;
          font-size: 1.5rem;
        .referral-stat-value {

        }
          text-align: center;
          justify-content: space-around;
          display: flex;
          border-top: 1px solid #eee;
          padding-top: 15px;
          margin-top: 15px;
        .referral-stats {

        }
          color: white;
          background: #6c757d;
        .referral-share-btn.email {

        }
          color: white;
          background: #1DA1F2;
        .referral-share-btn.twitter {

        }
          color: white;
          background: #25D366;
        .referral-share-btn.whatsapp {

        }
          transform: scale(1.05);
        .referral-share-btn:hover {

        }
          transition: transform 0.2s;
          font-weight: 500;
          cursor: pointer;
          border-radius: 8px;
          border: none;
          padding: 10px;
          flex: 1;
        .referral-share-btn {

        }
          gap: 10px;
          display: flex;
        .referral-share-btns {

        }
          margin-bottom: 10px;
          color: #666;
          font-size: 0.85rem;
        .referral-share-title {

        }
          opacity: 0.9;
        .referral-copy-btn:hover {

        }
          transition: opacity 0.2s;
          margin-bottom: 15px;
          cursor: pointer;
          font-weight: 600;
          border-radius: 10px;
          border: none;
          color: white;
          background: ${primaryColor};
          padding: 12px;
          width: 100%;
        .referral-copy-btn {

        }
          color: #333;
          letter-spacing: 2px;
          font-weight: bold;
          font-size: 1.3rem;
          font-family: monospace;
        .referral-code {

        }
          margin-bottom: 5px;
          color: #999;
          font-size: 0.75rem;
        .referral-code-label {

        }
          margin-bottom: 15px;
          text-align: center;
          padding: 15px;
          border-radius: 10px;
          border: 2px dashed ${primaryColor};
          background: #f5f5f5;
        .referral-code-box {

        }
          padding: 20px;
        .referral-body {

        }
          opacity: 0.9;
          font-size: 0.9rem;
        .referral-reward {

        }
          margin-bottom: 8px;
          font-weight: 700;
          font-size: 1.3rem;
        .referral-title {

        }
          text-align: center;
          padding: 25px 20px;
          color: white;
          background: ${primaryColor};
        .referral-header {

        }
          visibility: visible;
          opacity: 1;
          transform: scale(1) translateY(0);
        #referral-panel.open {

        }
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          visibility: hidden;
          opacity: 0;
          transform: scale(0.8) translateY(20px);
          overflow: hidden;
          box-shadow: 0 10px 40px rgba(0,0,0,0.15);
          border-radius: 16px;
          background: white;
          width: 340px;
          left: 0;
          bottom: 60px;
          position: absolute;
        #referral-panel {

        }
          box-shadow: 0 6px 25px rgba(0,0,0,0.25);
          transform: scale(1.05);
        #referral-trigger:hover {

        }
          transition: transform 0.3s, box-shadow 0.3s;
          box-shadow: 0 4px 20px rgba(0,0,0,0.2);
          font-weight: 600;
          gap: 8px;
          align-items: center;
          display: flex;
          cursor: pointer;
          border-radius: 30px;
          padding: 12px 20px;
          border: none;
          color: white;
          background: ${primaryColor};
        #referral-trigger {

        }
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          z-index: 9997;
          ${position === 'bottom-left' ? 'left: 20px; bottom: 20px;' : ''}
          position: fixed;
        #referral-widget {
      <style>
    container.innerHTML = `

    const primaryColor = config.primaryColor || '#28c76f';
    const position = config.position || 'bottom-left';

    if (!container) return;
    const container = document.getElementById('referral-widget-container');
  function createWidget() {
  // Create widget

  let isOpen = false;
  let referralData = null;

  if (!config.enabled) return;

  const config = window.GamificationConfig?.referral || {};
  const API_BASE = 'https://gamification-engine.dev/api/proxy';

  'use strict';
(function() {

 */
 * Customer-facing referral sharing widget
 * Gamification Engine - Referral Widget

