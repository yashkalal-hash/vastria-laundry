/**
 * Live Tracking JavaScript Engine
 */

const ORDER_STAGES = [
  { key: 'Order Placed', title: 'Order Placed', desc: 'Pickup requested and scheduled.', icon: 'fa-clipboard-check' },
  { key: 'Pickup Scheduled', title: 'Pickup Assigned', desc: 'Rider assigned for collection.', icon: 'fa-motorcycle' },
  { key: 'Picked Up', title: 'Clothes Collected', desc: 'Garments received and weighed.', icon: 'fa-truck-loading' },
  { key: 'In Wash & Clean', title: 'Washing & Eco-Treatment', desc: 'Stain treatment and sanitization.', icon: 'fa-soap' },
  { key: 'Ironing & Packing', title: 'Steam Iron & Packing', desc: 'Steam pressed and bagged.', icon: 'fa-bolt' },
  { key: 'Out for Delivery', title: 'Out for Delivery', desc: 'Rider is on the way to your doorstep.', icon: 'fa-truck' },
  { key: 'Delivered', title: 'Delivered Fresh', desc: 'Delivered with care. Thank you!', icon: 'fa-check-circle' }
];

// Perform search
async function searchTrackingOrder(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('track-search-input');
  const query = input ? input.value.trim() : '';

  if (!query) {
    showToast('Please enter a Tracking ID or Phone Number', 'error');
    return;
  }

  fetchTrackingDetails(query);
}

// Fetch from API
async function fetchTrackingDetails(trackingId) {
  const btn = document.getElementById('btn-track-submit');
  if (btn) btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Searching...`;

  try {
    const res = await fetch(`${API_BASE}/orders/track/${encodeURIComponent(trackingId)}`);
    const data = await res.json();

    if (data.success) {
      renderTrackingResult(data.order, data.items, data.history);
      document.getElementById('tracking-result-wrap').style.display = 'block';
      document.getElementById('tracking-empty-state').style.display = 'none';
      window.scrollTo({ top: 300, behavior: 'smooth' });
    } else {
      showToast(data.message || 'No order found with this tracking ID.', 'error');
      document.getElementById('tracking-result-wrap').style.display = 'none';
      document.getElementById('tracking-empty-state').style.display = 'block';
    }
  } catch (err) {
    console.error('Tracking fetch error:', err);
    showToast('Error connecting to tracking service.', 'error');
  } finally {
    if (btn) btn.innerHTML = `<i class="fas fa-search"></i> Track Order`;
  }
}

// Render Order and Animated Timeline
function renderTrackingResult(order, items, history) {
  document.getElementById('res-tracking-id').innerText = order.tracking_id;
  document.getElementById('res-customer-info').innerText = `${order.customer_name} • ${order.customer_phone}`;
  document.getElementById('res-status-badge').innerText = order.status;
  document.getElementById('res-total-amount').innerText = `₹${order.total_amount}`;
  document.getElementById('res-payment-badge').innerText = `Payment: ${order.payment_method.toUpperCase()} (${order.payment_status.toUpperCase()})`;
  
  document.getElementById('res-pickup-details').innerText = `${order.pickup_date} (${order.pickup_time_slot})`;
  document.getElementById('res-delivery-details').innerText = order.delivery_date ? `${order.delivery_date} (${order.delivery_time_slot || 'Standard'})` : 'Within 24-48 Hours';
  document.getElementById('res-address').innerText = order.pickup_address;

  // Render items
  const itemsContainer = document.getElementById('res-items-list');
  itemsContainer.innerHTML = items.map(it => `
    <div style="display: flex; justify-content: space-between; padding: 6px 0; font-size: 0.9rem;">
      <span>${it.service_name} <b>x ${it.quantity}</b></span>
      <span style="font-weight: 700;">₹${it.subtotal}</span>
    </div>
  `).join('');

  // Find index of current status
  const currentIdx = ORDER_STAGES.findIndex(s => s.key.toLowerCase() === (order.status || '').toLowerCase());
  const activeIdx = currentIdx !== -1 ? currentIdx : 0;

  // Build timeline HTML
  const timelineContainer = document.getElementById('timeline-container');
  timelineContainer.innerHTML = ORDER_STAGES.map((stage, idx) => {
    let stateClass = '';
    if (idx < activeIdx) {
      stateClass = 'completed';
    } else if (idx === activeIdx) {
      stateClass = 'current';
    }

    // Match any history comment for this stage
    const histMatch = history.find(h => h.status.toLowerCase() === stage.key.toLowerCase());
    const timeStr = histMatch ? new Date(histMatch.timestamp).toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
    const commentStr = histMatch ? histMatch.comment : stage.desc;

    return `
      <div class="timeline-step ${stateClass}">
        <div class="timeline-bullet">
          <i class="fas ${stage.icon}"></i>
        </div>
        <div class="timeline-content">
          <h4>${stage.title}</h4>
          <p>${commentStr}</p>
          ${timeStr ? `<div class="timeline-time"><i class="fas fa-clock"></i> ${timeStr}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

// Auto search if ?id= is in URL query
document.addEventListener('DOMContentLoaded', () => {
  const urlParams = new URLSearchParams(window.location.search);
  const trackId = urlParams.get('id');
  if (trackId) {
    const input = document.getElementById('track-search-input');
    if (input) input.value = trackId;
    fetchTrackingDetails(trackId);
  }
});
