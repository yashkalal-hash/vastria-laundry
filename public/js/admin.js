/**
 * FreshFold Admin Operations Logic
 */

let allOrdersCache = [];
let allServicesCache = [];

// Init & Security Check
document.addEventListener('DOMContentLoaded', () => {
  const token = getAuthToken();
  const user = getCurrentUser();

  if (!token || !user || user.role !== 'admin') {
    showToast('Admin privilege required. Please login with admin credentials.', 'error');
    setTimeout(() => {
      window.location.href = 'login.html';
    }, 800);
    return;
  }

  document.getElementById('admin-user-tag').innerText = `Admin: ${user.name}`;
  loadAdminStatsAndOrders();
});

// Switch Admin Tabs
function switchAdminTab(tabName, el) {
  document.querySelectorAll('.admin-nav-item').forEach(btn => btn.classList.remove('active'));
  if (el) el.classList.add('active');

  document.querySelectorAll('.admin-tab-pane').forEach(pane => pane.style.display = 'none');
  const targetPane = document.getElementById(`tab-${tabName}`);
  if (targetPane) targetPane.style.display = 'block';

  if (tabName === 'customers') loadAdminCustomers();
  if (tabName === 'services') loadAdminServices();
  if (tabName === 'inquiries') loadAdminInquiries();
}

// Load KPIs & Orders
async function loadAdminStatsAndOrders() {
  const token = getAuthToken();
  try {
    const statsRes = await fetch(`${API_BASE}/admin/stats`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const statsData = await statsRes.json();
    if (statsData.success) {
      document.getElementById('kpi-revenue').innerText = `₹${statsData.stats.totalRevenue.toLocaleString('en-IN')}`;
      document.getElementById('kpi-pending').innerText = statsData.stats.pendingOrders;
      document.getElementById('kpi-orders').innerText = statsData.stats.totalOrders;
      document.getElementById('kpi-customers').innerText = statsData.stats.totalCustomers;
    }

    // Load Orders List
    const ordersRes = await fetch(`${API_BASE}/admin/orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const ordersData = await ordersRes.json();
    if (ordersData.success) {
      allOrdersCache = ordersData.orders;
      renderAdminOrders(allOrdersCache);
    }
  } catch (err) {
    console.error('Error fetching admin data:', err);
    showToast('Failed to load admin stats.', 'error');
  }
}

// Filter orders
function filterOrders() {
  const query = document.getElementById('admin-order-search').value.toLowerCase().trim();
  const status = document.getElementById('admin-status-filter').value;

  const filtered = allOrdersCache.filter(ord => {
    const matchesQuery = !query || 
      ord.tracking_id.toLowerCase().includes(query) ||
      ord.customer_name.toLowerCase().includes(query) ||
      ord.customer_phone.toLowerCase().includes(query);

    const matchesStatus = status === 'all' || ord.status === status;
    return matchesQuery && matchesStatus;
  });

  renderAdminOrders(filtered);
}

// Render Orders Table
function renderAdminOrders(orders) {
  const tbody = document.getElementById('admin-orders-tbody');
  if (!tbody) return;

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">No orders matching current filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(ord => {
    const itemsSummary = ord.items.map(i => `${i.service_name} (x${i.quantity})`).join(', ');

    return `
      <tr>
        <td>
          <a href="track.html?id=${ord.tracking_id}" target="_blank" style="font-weight: 800; color: var(--primary);">
            ${ord.tracking_id}
          </a>
          <br><small style="color: var(--text-muted);">${new Date(ord.created_at).toLocaleDateString('en-IN')}</small>
        </td>
        <td>
          <b>${ord.customer_name}</b><br>
          <small style="color: var(--text-muted);"><i class="fas fa-phone-alt"></i> ${ord.customer_phone}</small><br>
          <small style="color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; max-width: 180px;">${ord.pickup_address}</small>
        </td>
        <td>
          <b>${ord.pickup_date}</b><br>
          <small style="color: var(--text-muted);">${ord.pickup_time_slot}</small>
        </td>
        <td>
          <b>₹${ord.total_amount}</b><br>
          <span style="font-size: 0.8rem; color: var(--text-muted); display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; overflow: hidden; max-width: 160px;" title="${itemsSummary}">
            ${itemsSummary}
          </span>
        </td>
        <td>
          <span class="badge ${ord.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}">
            ${ord.payment_status.toUpperCase()}
          </span><br>
          <small style="font-size: 0.75rem; color: var(--text-muted);">${ord.payment_method}</small>
        </td>
        <td>
          <span class="badge badge-primary" style="font-size: 0.8rem;">${ord.status}</span>
        </td>
        <td>
          <button onclick="openStatusModal(${ord.id}, '${ord.tracking_id}', '${ord.status}', '${ord.payment_status}')" class="btn btn-primary btn-sm">
            <i class="fas fa-edit"></i> Update
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Open Status Modal
function openStatusModal(orderId, trackingId, status, paymentStatus) {
  document.getElementById('modal-order-id').value = orderId;
  document.getElementById('modal-tracking-id').value = trackingId;
  document.getElementById('modal-new-status').value = status;
  document.getElementById('modal-payment-status').value = paymentStatus || 'pending';
  document.getElementById('modal-status-comment').value = '';
  document.getElementById('status-modal').classList.add('show');
}

function closeStatusModal() {
  document.getElementById('status-modal').classList.remove('show');
}

// Save Order Status
async function saveOrderStatus(e) {
  e.preventDefault();
  const token = getAuthToken();
  const orderId = document.getElementById('modal-order-id').value;
  const status = document.getElementById('modal-new-status').value;
  const payment_status = document.getElementById('modal-payment-status').value;
  const comment = document.getElementById('modal-status-comment').value.trim();

  const btn = document.getElementById('btn-save-status');
  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/admin/orders/${orderId}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status, payment_status, comment })
    });
    const data = await res.json();

    if (data.success) {
      showToast('Order status updated successfully!', 'success');
      closeStatusModal();
      loadAdminStatsAndOrders();
    } else {
      showToast(data.message || 'Update failed', 'error');
    }
  } catch (err) {
    showToast('Network error updating status.', 'error');
  } finally {
    btn.disabled = false;
  }
}

// Load Customers
async function loadAdminCustomers() {
  const tbody = document.getElementById('admin-customers-tbody');
  const token = getAuthToken();

  try {
    const res = await fetch(`${API_BASE}/admin/customers`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      if (data.customers.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 2rem;">No customers found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.customers.map(c => `
        <tr>
          <td><b>${c.name}</b></td>
          <td>${c.email}</td>
          <td>${c.phone || '-'}</td>
          <td><small style="color: var(--text-muted);">${c.address || '-'}</small></td>
          <td><span class="badge badge-info">${c.order_count} Orders</span></td>
          <td><b>₹${c.total_spent}</b></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 2rem;">Error loading customers.</td></tr>`;
  }
}

// Load Services
async function loadAdminServices() {
  const tbody = document.getElementById('admin-services-tbody');
  try {
    const res = await fetch(`${API_BASE}/services/catalog`);
    const data = await res.json();

    if (data.success) {
      allServicesCache = data.allServices;
      tbody.innerHTML = data.allServices.map(s => `
        <tr>
          <td><b>${s.name}</b><br><small style="color: var(--text-muted);">${s.description || ''}</small></td>
          <td><span class="badge badge-primary">Cat #${s.category_id}</span></td>
          <td><b>₹${s.price}</b></td>
          <td>/${s.unit}</td>
          <td>${s.turnaround_hours}h</td>
          <td>${s.is_popular ? '<span class="badge badge-success">Yes</span>' : '<span class="badge badge-secondary">No</span>'}</td>
          <td>
            <button onclick="deleteServiceItem(${s.id})" class="btn btn-outline btn-sm" style="color: var(--danger); border-color: var(--danger);">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); padding: 2rem;">Error loading services.</td></tr>`;
  }
}

// Delete Service
async function deleteServiceItem(serviceId) {
  if (!confirm('Are you sure you want to delete this service?')) return;
  const token = getAuthToken();

  try {
    const res = await fetch(`${API_BASE}/services/${serviceId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Service deleted', 'success');
      loadAdminServices();
    }
  } catch (err) {
    showToast('Failed to delete service', 'error');
  }
}

// Add Service Modal
function openAddServiceModal() {
  document.getElementById('service-manage-form').reset();
  document.getElementById('service-modal-title').innerText = 'Add New Service';
  document.getElementById('service-modal').classList.add('show');
}

function closeServiceModal() {
  document.getElementById('service-modal').classList.remove('show');
}

async function saveServiceItem(e) {
  e.preventDefault();
  const token = getAuthToken();
  const payload = {
    name: document.getElementById('svc-name').value.trim(),
    price: parseFloat(document.getElementById('svc-price').value),
    unit: document.getElementById('svc-unit').value,
    category_id: parseInt(document.getElementById('svc-category').value),
    turnaround_hours: parseInt(document.getElementById('svc-turnaround').value) || 24,
    description: document.getElementById('svc-desc').value.trim()
  };

  try {
    const res = await fetch(`${API_BASE}/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (data.success) {
      showToast('Service added successfully!', 'success');
      closeServiceModal();
      loadAdminServices();
    } else {
      showToast(data.message || 'Could not add service', 'error');
    }
  } catch (err) {
    showToast('Error saving service', 'error');
  }
}

// Load Inquiries
async function loadAdminInquiries() {
  const tbody = document.getElementById('admin-inquiries-tbody');
  const token = getAuthToken();

  try {
    const res = await fetch(`${API_BASE}/admin/inquiries`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      if (data.inquiries.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 2rem;">No inquiries received yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.inquiries.map(inq => `
        <tr>
          <td><small>${new Date(inq.created_at).toLocaleString('en-IN')}</small></td>
          <td><b>${inq.name}</b></td>
          <td>
            ${inq.email}<br>
            <small style="color: var(--text-muted);">${inq.phone || '-'}</small>
          </td>
          <td><p style="font-size: 0.9rem; color: var(--text-main);">${inq.message}</p></td>
        </tr>
      `).join('');
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--danger); padding: 2rem;">Error loading inquiries.</td></tr>`;
  }
}
