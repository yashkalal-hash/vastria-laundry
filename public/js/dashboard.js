/**
 * Customer Dashboard Logic
 */

// Check Auth
document.addEventListener('DOMContentLoaded', () => {
  const token = getAuthToken();
  const user = getCurrentUser();

  if (!token || !user) {
    showToast('Please login to access your customer dashboard.', 'info');
    setTimeout(() => window.location.href = 'login.html', 800);
    return;
  }

  // Populate Greeting & Profile
  document.getElementById('user-greeting').innerText = `Welcome back, ${user.name}!`;
  document.getElementById('prof-name').value = user.name || '';
  document.getElementById('prof-email').value = user.email || '';
  document.getElementById('prof-phone').value = user.phone || '';
  document.getElementById('prof-address').value = user.address || '';

  loadCustomerOrders();
});

// Load Orders
async function loadCustomerOrders() {
  const tbody = document.getElementById('customer-orders-tbody');
  const token = getAuthToken();

  try {
    const res = await fetch(`${API_BASE}/orders/my-orders`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();

    if (data.success) {
      if (data.orders.length === 0) {
        tbody.innerHTML = `
          <tr>
            <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem;">
              No laundry orders found yet. <br>
              <a href="book.html" class="btn btn-primary btn-sm" style="margin-top: 10px;">Schedule Your First Pickup</a>
            </td>
          </tr>
        `;
        return;
      }

      tbody.innerHTML = data.orders.map(ord => {
        const itemsSummary = ord.items.map(i => `${i.service_name} (${i.quantity})`).join(', ');
        const isCancelable = ord.status === 'Order Placed';

        return `
          <tr>
            <td>
              <a href="track.html?id=${ord.tracking_id}" style="font-weight: 800; color: var(--primary);">
                ${ord.tracking_id}
              </a>
            </td>
            <td>
              <b>${ord.pickup_date}</b><br>
              <small style="color: var(--text-muted);">${ord.pickup_time_slot}</small>
            </td>
            <td>
              <span style="font-size: 0.85rem; color: var(--text-main); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${itemsSummary}">
                ${itemsSummary}
              </span>
            </td>
            <td>
              <b>₹${ord.total_amount}</b><br>
              <small class="badge ${ord.payment_status === 'paid' ? 'badge-success' : 'badge-warning'}">${ord.payment_status}</small>
            </td>
            <td>
              <span class="badge badge-primary">${ord.status}</span>
            </td>
            <td>
              <div style="display: flex; gap: 6px;">
                <a href="track.html?id=${ord.tracking_id}" class="btn btn-secondary btn-sm" title="Track Live">
                  <i class="fas fa-satellite-dish"></i>
                </a>
                ${isCancelable ? `
                  <button onclick="cancelUserOrder(${ord.id})" class="btn btn-outline btn-sm" style="color: var(--danger); border-color: var(--danger);" title="Cancel Order">
                    <i class="fas fa-times"></i>
                  </button>
                ` : ''}
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error fetching orders:', err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--danger); padding: 2rem;">Failed to load order history.</td></tr>`;
  }
}

// Cancel Order
async function cancelUserOrder(orderId) {
  if (!confirm('Are you sure you want to cancel this pickup order?')) return;

  const token = getAuthToken();
  try {
    const res = await fetch(`${API_BASE}/orders/cancel/${orderId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast('Order cancelled successfully', 'success');
      loadCustomerOrders();
    } else {
      showToast(data.message || 'Could not cancel order', 'error');
    }
  } catch (err) {
    showToast('Failed to cancel order', 'error');
  }
}

// Update Profile
async function updateCustomerProfile(e) {
  e.preventDefault();
  const token = getAuthToken();
  const name = document.getElementById('prof-name').value.trim();
  const phone = document.getElementById('prof-phone').value.trim();
  const address = document.getElementById('prof-address').value.trim();

  try {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ name, phone, address })
    });

    const data = await res.json();
    if (data.success) {
      setAuthSession(token, data.user);
      showToast('Profile updated successfully!', 'success');
      updateNavUI();
    } else {
      showToast(data.message || 'Update failed', 'error');
    }
  } catch (err) {
    showToast('Error updating profile', 'error');
  }
}
