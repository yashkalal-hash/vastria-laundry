/**
 * Multi-Step Booking Engine Logic
 */

let allCatalogServices = [];
let cart = {}; // { service_id: { id, name, price, unit, quantity } }
let currentStep = 1;

// Load Services & Categories from Backend API
async function loadBookingCatalog() {
  try {
    const res = await fetch(`${API_BASE}/services/catalog`);
    const data = await res.json();
    if (data.success) {
      allCatalogServices = data.allServices;
      renderCategoryTabs(data.categories);
      renderServiceItems(allCatalogServices);
    }
  } catch (err) {
    console.error('Error loading booking catalog:', err);
    showToast('Failed to load laundry catalog. Please refresh.', 'error');
  }
}

// Render Tabs
function renderCategoryTabs(categories) {
  const container = document.getElementById('category-tabs');
  if (!container) return;

  let tabsHtml = `<button class="tab-btn active" onclick="filterServicesCategory('all', this)">All Services</button>`;
  categories.forEach(cat => {
    tabsHtml += `<button class="tab-btn" onclick="filterServicesCategory(${cat.id}, this)">${cat.name}</button>`;
  });
  container.innerHTML = tabsHtml;
}

// Filter Services by Tab
function filterServicesCategory(catId, btnEl) {
  if (btnEl) {
    document.querySelectorAll('#category-tabs .tab-btn').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
  }

  if (catId === 'all') {
    renderServiceItems(allCatalogServices);
  } else {
    const filtered = allCatalogServices.filter(s => s.category_id === Number(catId));
    renderServiceItems(filtered);
  }
}

// Render Item Rows with Quantities
function renderServiceItems(items) {
  const container = document.getElementById('service-items-list');
  if (!container) return;

  if (items.length === 0) {
    container.innerHTML = `<p style="text-align: center; color: var(--text-muted); padding: 2rem;">No services found.</p>`;
    return;
  }

  container.innerHTML = items.map(item => {
    const qty = cart[item.id] ? cart[item.id].quantity : 0;
    return `
      <div class="item-select-card">
        <div>
          <h4 style="font-size: 1rem; font-weight: 700; margin-bottom: 2px;">${item.name}</h4>
          <span style="font-size: 0.85rem; color: var(--primary); font-weight: 700;">₹${item.price} / ${item.unit}</span>
          <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 10px;">⚡ ${item.turnaround_hours}h Turnaround</span>
        </div>
        <div class="counter-ctrl">
          <button class="ctrl-btn" onclick="changeItemQty(${item.id}, -1)">-</button>
          <span class="counter-val" id="qty-service-${item.id}">${qty}</span>
          <button class="ctrl-btn" onclick="changeItemQty(${item.id}, 1)">+</button>
        </div>
      </div>
    `;
  }).join('');
}

// Update Cart Quantity
function changeItemQty(serviceId, delta) {
  const service = allCatalogServices.find(s => s.id === serviceId);
  if (!service) return;

  if (!cart[serviceId]) {
    cart[serviceId] = {
      id: service.id,
      name: service.name,
      price: service.price,
      unit: service.unit,
      quantity: 0
    };
  }

  cart[serviceId].quantity += delta;
  if (cart[serviceId].quantity <= 0) {
    delete cart[serviceId];
  }

  // Update UI counter badge and number
  const counterEl = document.getElementById(`qty-service-${serviceId}`);
  if (counterEl) {
    counterEl.innerText = cart[serviceId] ? cart[serviceId].quantity : 0;
  }

  updateCartSummary();
}

// Calculate and refresh Cart total
function updateCartSummary() {
  let totalItems = 0;
  let totalPrice = 0;

  Object.values(cart).forEach(item => {
    totalItems += item.quantity;
    totalPrice += item.quantity * item.price;
  });

  const countBadge = document.getElementById('cart-item-count-badge');
  const step1Total = document.getElementById('step1-total-price');

  if (countBadge) countBadge.innerText = `${totalItems} items selected`;
  if (step1Total) step1Total.innerText = `₹${totalPrice}`;
}

// Slot Selection Handlers
function selectSlot(type, el, slotValue) {
  const container = el.parentElement;
  container.querySelectorAll('.slot-radio-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');

  if (type === 'pickup') {
    document.getElementById('selected-pickup-slot').value = slotValue;
  } else {
    document.getElementById('selected-delivery-slot').value = slotValue;
  }
}

function selectPayment(el, method) {
  document.querySelectorAll('.payment-option-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('selected-payment-method').value = method;
}

// Multi-Step Navigation & Form Validation
function goToStep(step) {
  // Validate Step 1
  if (step > 1 && Object.keys(cart).length === 0) {
    showToast('Please select at least 1 garment or service item.', 'error');
    return;
  }

  // Validate Step 2
  if (step > 2) {
    const pDate = document.getElementById('pickup-date').value;
    if (!pDate) {
      showToast('Please choose a Pickup Date.', 'error');
      return;
    }
  }

  // Validate Step 3
  if (step > 3) {
    const name = document.getElementById('cust-name').value.trim();
    const phone = document.getElementById('cust-phone').value.trim();
    const address = document.getElementById('cust-address').value.trim();

    if (!name || !phone || !address) {
      showToast('Please fill in Name, Phone, and Pickup Address.', 'error');
      return;
    }

    // Populate Step 4 Review
    renderReviewSummary();
  }

  // Switch display
  for (let i = 1; i <= 4; i++) {
    const stepDiv = document.getElementById(`booking-step-${i}`);
    const indicator = document.getElementById(`step-indicator-${i}`);
    if (stepDiv) stepDiv.style.display = i === step ? 'block' : 'none';

    if (indicator) {
      indicator.classList.remove('active');
      if (i === step) {
        indicator.classList.add('active');
      } else if (i < step) {
        indicator.classList.add('completed');
      }
    }
  }

  currentStep = step;
  window.scrollTo({ top: 120, behavior: 'smooth' });
}

// Render Order Review on Step 4
function renderReviewSummary() {
  const container = document.getElementById('review-items-list');
  const grandTotalEl = document.getElementById('review-grand-total');

  let html = '';
  let grandTotal = 0;

  Object.values(cart).forEach(item => {
    const sub = item.quantity * item.price;
    grandTotal += sub;
    html += `
      <div style="display: flex; justify-content: space-between; font-size: 0.95rem; margin-bottom: 6px;">
        <span>${item.name} (${item.quantity} ${item.unit})</span>
        <span style="font-weight: 700;">₹${sub}</span>
      </div>
    `;
  });

  container.innerHTML = html;
  grandTotalEl.innerText = `₹${grandTotal}`;
}

// Submit Booking Order to Backend
async function submitBookingOrder() {
  const btn = document.getElementById('btn-submit-order');
  btn.disabled = true;
  btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Scheduling Pickup...`;

  const orderItems = Object.values(cart).map(item => ({
    service_id: item.id,
    service_name: item.name,
    quantity: item.quantity,
    unit_price: item.price
  }));

  const payload = {
    customer_name: document.getElementById('cust-name').value.trim(),
    customer_phone: document.getElementById('cust-phone').value.trim(),
    customer_email: document.getElementById('cust-email').value.trim(),
    pickup_address: document.getElementById('cust-address').value.trim(),
    pickup_date: document.getElementById('pickup-date').value,
    pickup_time_slot: document.getElementById('selected-pickup-slot').value,
    delivery_date: document.getElementById('delivery-date').value,
    delivery_time_slot: document.getElementById('selected-delivery-slot').value,
    special_instructions: document.getElementById('cust-notes').value.trim(),
    payment_method: document.getElementById('selected-payment-method').value,
    items: orderItems
  };

  try {
    const token = getAuthToken();
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${API_BASE}/orders/book`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      // Hide all steps & show success
      for (let i = 1; i <= 4; i++) {
        document.getElementById(`booking-step-${i}`).style.display = 'none';
      }
      document.querySelector('.stepper-header').style.display = 'none';
      
      const successDiv = document.getElementById('booking-success');
      document.getElementById('success-tracking-id').innerText = data.tracking_id;
      document.getElementById('success-track-btn').href = `track.html?id=${data.tracking_id}`;
      successDiv.style.display = 'block';

      showToast('Pickup scheduled successfully!', 'success');
    } else {
      showToast(data.message || 'Failed to book pickup.', 'error');
      btn.disabled = false;
      btn.innerHTML = `<i class="fas fa-check-circle"></i> Confirm & Schedule Pickup`;
    }
  } catch (err) {
    console.error('Booking submission error:', err);
    showToast('Network error while booking. Please try again.', 'error');
    btn.disabled = false;
    btn.innerHTML = `<i class="fas fa-check-circle"></i> Confirm & Schedule Pickup`;
  }
}

// Prefill form if customer is logged in & set dates
document.addEventListener('DOMContentLoaded', () => {
  loadBookingCatalog();

  // Set default dates
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfterTomorrow = new Date(today);
  dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);

  const formatDate = (d) => d.toISOString().split('T')[0];
  
  const pickupInput = document.getElementById('pickup-date');
  const deliveryInput = document.getElementById('delivery-date');
  
  if (pickupInput) {
    pickupInput.min = formatDate(today);
    pickupInput.value = formatDate(tomorrow);
  }
  if (deliveryInput) {
    deliveryInput.min = formatDate(tomorrow);
    deliveryInput.value = formatDate(dayAfterTomorrow);
  }

  // Check if logged in user
  const user = getCurrentUser();
  if (user) {
    if (document.getElementById('cust-name')) document.getElementById('cust-name').value = user.name || '';
    if (document.getElementById('cust-phone')) document.getElementById('cust-phone').value = user.phone || '';
    if (document.getElementById('cust-email')) document.getElementById('cust-email').value = user.email || '';
    if (document.getElementById('cust-address') && user.address) document.getElementById('cust-address').value = user.address;
  }
});
