/**
 * Gamification Engine - Admin Panel Main JavaScript
 * 2025 Modern Soft Design
 */

// API Helper
const api = {
  baseUrl: '',

  async request(method, endpoint, data = null) {
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, options);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Request failed');
      }

      return result;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  },

  get: (endpoint) => api.request('GET', endpoint),
  post: (endpoint, data) => api.request('POST', endpoint, data),
  put: (endpoint, data) => api.request('PUT', endpoint, data),
  delete: (endpoint) => api.request('DELETE', endpoint),
};

// Toast Notification
function showToast(message, type = 'success') {
  const toastContainer = document.querySelector('.toast-container') || createToastContainer();

  const toast = document.createElement('div');
  toast.className = `toast show align-items-center text-white bg-${type} border-0`;
  toast.setAttribute('role', 'alert');
  toast.innerHTML = `
    <div class="d-flex">
      <div class="toast-body">
        <i class="ti ti-${type === 'success' ? 'check' : type === 'danger' ? 'x' : 'info-circle'} me-2"></i>
        ${message}
      </div>
      <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
    </div>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function createToastContainer() {
  const container = document.createElement('div');
  container.className = 'toast-container position-fixed top-0 end-0 p-3';
  container.style.zIndex = '9999';
  document.body.appendChild(container);
  return container;
}

// Loading State
function setLoading(button, loading = true) {
  if (loading) {
    button.disabled = true;
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Yukleniyor...';
  } else {
    button.disabled = false;
    button.innerHTML = button.dataset.originalText || button.innerHTML;
  }
}

// Form Validation
function validateForm(form) {
  const inputs = form.querySelectorAll('[required]');
  let isValid = true;

  inputs.forEach(input => {
    if (!input.value.trim()) {
      input.classList.add('is-invalid');
      isValid = false;
    } else {
      input.classList.remove('is-invalid');
    }
  });

  return isValid;
}

// Games Module
const Games = {
  async save(gameId, type, data) {
    try {
      const result = await api.put(`/api/games/${gameId}`, data);
      showToast('Oyun basariyla kaydedildi!', 'success');
      return result;
    } catch (error) {
      showToast('Kaydetme hatasi: ' + error.message, 'danger');
      throw error;
    }
  },

  async toggle(gameId) {
    try {
      const result = await api.put(`/api/games/${gameId}/toggle`);
      showToast(result.data.isActive ? 'Oyun aktif edildi!' : 'Oyun pasif edildi!', 'success');
      return result;
    } catch (error) {
      showToast('Hata: ' + error.message, 'danger');
      throw error;
    }
  },

  async addSegment(gameId, segment) {
    try {
      const result = await api.post(`/api/games/${gameId}/segments`, segment);
      showToast('Segment eklendi!', 'success');
      return result;
    } catch (error) {
      showToast('Hata: ' + error.message, 'danger');
      throw error;
    }
  },

  async updateSegment(gameId, segmentId, data) {
    try {
      const result = await api.put(`/api/games/${gameId}/segments/${segmentId}`, data);
      showToast('Segment guncellendi!', 'success');
      return result;
    } catch (error) {
      showToast('Hata: ' + error.message, 'danger');
      throw error;
    }
  },

  async deleteSegment(gameId, segmentId) {
    if (!confirm('Bu segmenti silmek istediginize emin misiniz?')) return;

    try {
      await api.delete(`/api/games/${gameId}/segments/${segmentId}`);
      showToast('Segment silindi!', 'success');
      location.reload();
    } catch (error) {
      showToast('Hata: ' + error.message, 'danger');
      throw error;
    }
  },
};

// Rules Module
const Rules = {
  async save(ruleId, data) {
    try {
      const method = ruleId ? 'put' : 'post';
      const endpoint = ruleId ? `/api/rules/${ruleId}` : '/api/rules';
      const result = await api[method](endpoint, data);
      showToast('Kural basariyla kaydedildi!', 'success');
      return result;
    } catch (error) {
      showToast('Kaydetme hatasi: ' + error.message, 'danger');
      throw error;
    }
  },

  async delete(ruleId) {
    if (!confirm('Bu kurali silmek istediginize emin misiniz?')) return;

    try {
      await api.delete(`/api/rules/${ruleId}`);
      showToast('Kural silindi!', 'success');
      location.reload();
    } catch (error) {
      showToast('Hata: ' + error.message, 'danger');
      throw error;
    }
  },

  async toggle(ruleId) {
    try {
      const result = await api.put(`/api/rules/${ruleId}/toggle`);
      showToast(result.data.isActive ? 'Kural aktif edildi!' : 'Kural pasif edildi!', 'success');
      return result;
    } catch (error) {
      showToast('Hata: ' + error.message, 'danger');
      throw error;
    }
  },
};

// Discounts Module
const Discounts = {
  async getAll(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return await api.get(`/api/discounts?${params}`);
  },

  async delete(discountId) {
    if (!confirm('Bu indirim kodunu silmek istediginize emin misiniz?')) return;

    try {
      await api.delete(`/api/discounts/${discountId}`);
      showToast('Indirim kodu silindi!', 'success');
      location.reload();
    } catch (error) {
      showToast('Hata: ' + error.message, 'danger');
      throw error;
    }
  },
};

// Settings Module
const Settings = {
  async save(data) {
    try {
      const result = await api.put('/api/settings', data);
      showToast('Ayarlar kaydedildi!', 'success');
      return result;
    } catch (error) {
      showToast('Hata: ' + error.message, 'danger');
      throw error;
    }
  },
};

// Analytics Charts
const Charts = {
  playsChart: null,
  conversionChart: null,

  initPlayChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.playsChart) this.playsChart.destroy();

    this.playsChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Oyun Sayisi',
            data: data.plays,
            borderColor: '#7367f0',
            backgroundColor: 'rgba(115, 103, 240, 0.1)',
            fill: true,
            tension: 0.4,
          },
          {
            label: 'Kazanan',
            data: data.wins,
            borderColor: '#28c76f',
            backgroundColor: 'rgba(40, 199, 111, 0.1)',
            fill: true,
            tension: 0.4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
          },
        },
        scales: {
          y: {
            beginAtZero: true,
          },
        },
      },
    });
  },

  initConversionChart(canvasId, data) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return;

    if (this.conversionChart) this.conversionChart.destroy();

    this.conversionChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Kazandi', 'Kaybetti', 'Kullanildi'],
        datasets: [{
          data: [data.wins, data.losses, data.used],
          backgroundColor: ['#28c76f', '#ea5455', '#7367f0'],
          borderWidth: 0,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
          },
        },
      },
    });
  },
};

// Spin Wheel Preview
const SpinWheelPreview = {
  canvas: null,
  ctx: null,
  segments: [],
  rotation: 0,

  init(canvasId, segments) {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.segments = segments || [];
    this.draw();
  },

  draw() {
    const { ctx, canvas, segments } = this;
    const cx = canvas.width / 2;
    const cy = canvas.height / 2;
    const radius = Math.min(cx, cy) - 10;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (segments.length === 0) {
      ctx.fillStyle = '#f8f9fa';
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#6c757d';
      ctx.textAlign = 'center';
      ctx.fillText('Segment Ekle', cx, cy);
      return;
    }

    const segmentAngle = (Math.PI * 2) / segments.length;

    segments.forEach((seg, i) => {
      const startAngle = i * segmentAngle + this.rotation;
      const endAngle = startAngle + segmentAngle;

      // Segment
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, endAngle);
      ctx.closePath();
      ctx.fillStyle = seg.color || '#7367f0';
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Label
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(startAngle + segmentAngle / 2);
      ctx.textAlign = 'right';
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px Inter';
      ctx.fillText(seg.label || '', radius - 15, 5);
      ctx.restore();
    });

    // Center
    ctx.beginPath();
    ctx.arc(cx, cy, 20, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.strokeStyle = '#ddd';
    ctx.stroke();
  },

  spin(targetSegmentIndex) {
    const segmentAngle = (Math.PI * 2) / this.segments.length;
    const targetRotation = -(targetSegmentIndex * segmentAngle + segmentAngle / 2) + Math.PI * 10;

    const animate = (start, end, duration) => {
      const startTime = performance.now();

      const step = (timestamp) => {
        const progress = Math.min((timestamp - startTime) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        this.rotation = start + (end - start) * easeOut;
        this.draw();

        if (progress < 1) {
          requestAnimationFrame(step);
        }
      };

      requestAnimationFrame(step);
    };

    animate(this.rotation, targetRotation, 5000);
  },
};

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  // Initialize tooltips
  const tooltipTriggerList = document.querySelectorAll('[data-bs-toggle="tooltip"]');
  tooltipTriggerList.forEach(el => new bootstrap.Tooltip(el));

  // Form handlers
  document.querySelectorAll('form[data-ajax]').forEach(form => {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (!validateForm(form)) {
        showToast('Lutfen tum alanlari doldurun', 'warning');
        return;
      }

      const submitBtn = form.querySelector('[type="submit"]');
      setLoading(submitBtn, true);

      try {
        const formData = new FormData(form);
        const data = Object.fromEntries(formData.entries());

        const action = form.dataset.action;
        const method = form.dataset.method || 'post';

        await api[method](action, data);
        showToast('Basariyla kaydedildi!', 'success');

        if (form.dataset.redirect) {
          window.location.href = form.dataset.redirect;
        }
      } catch (error) {
        showToast('Hata: ' + error.message, 'danger');
      } finally {
        setLoading(submitBtn, false);
      }
    });
  });

  // Delete buttons
  document.querySelectorAll('[data-delete]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const endpoint = btn.dataset.delete;

      if (!confirm('Silmek istediginize emin misiniz?')) return;

      try {
        await api.delete(endpoint);
        showToast('Silindi!', 'success');

        if (btn.dataset.reload) {
          location.reload();
        } else if (btn.closest('tr')) {
          btn.closest('tr').remove();
        }
      } catch (error) {
        showToast('Hata: ' + error.message, 'danger');
      }
    });
  });

  // Toggle switches
  document.querySelectorAll('[data-toggle]').forEach(toggle => {
    toggle.addEventListener('change', async () => {
      const endpoint = toggle.dataset.toggle;

      try {
        await api.put(endpoint);
        showToast('Guncellendi!', 'success');
      } catch (error) {
        toggle.checked = !toggle.checked;
        showToast('Hata: ' + error.message, 'danger');
      }
    });
  });
});

// Export for global use
window.api = api;
window.Games = Games;
window.Rules = Rules;
window.Discounts = Discounts;
window.Settings = Settings;
window.Charts = Charts;
window.SpinWheelPreview = SpinWheelPreview;
window.showToast = showToast;
window.setLoading = setLoading;

