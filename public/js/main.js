/**
 * FreshFold Laundry - Main Frontend Utilities & State
 */

const API_BASE = '/api';

// Toast Notification Engine
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = {
    success: 'fa-check-circle',
    error: 'fa-exclamation-circle',
    info: 'fa-info-circle'
  };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<i class="fas ${icons[type] || 'fa-info-circle'}"></i> <span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// User Authentication State Helpers
function getAuthToken() {
  return localStorage.getItem('freshfold_token');
}

function getCurrentUser() {
  const userStr = localStorage.getItem('freshfold_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}

function setAuthSession(token, user) {
  localStorage.setItem('freshfold_token', token);
  localStorage.setItem('freshfold_user', JSON.stringify(user));
}

function logout() {
  localStorage.removeItem('freshfold_token');
  localStorage.removeItem('freshfold_user');
  showToast('Logged out successfully', 'info');
  setTimeout(() => {
    window.location.href = 'index.html';
  }, 500);
}

// Format Currency
function formatCurrency(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

// Setup Global Navbar Header
function updateNavUI() {
  const user = getCurrentUser();
  const navActions = document.getElementById('nav-user-actions');
  if (!navActions) return;

  if (user) {
    let adminLink = user.role === 'admin' 
      ? `<a href="admin.html" class="btn btn-secondary btn-sm"><i class="fas fa-chart-pie"></i> Admin Panel</a>` 
      : '';
    
    navActions.innerHTML = `
      ${adminLink}
      <a href="dashboard.html" class="btn btn-secondary btn-sm"><i class="fas fa-user-circle"></i> ${user.name.split(' ')[0]}</a>
      <button onclick="logout()" class="btn btn-outline btn-sm" title="Logout"><i class="fas fa-sign-out-alt"></i></button>
      <a href="book.html" class="btn btn-primary btn-sm"><i class="fas fa-calendar-plus"></i> Book Pickup</a>
    `;
  } else {
    navActions.innerHTML = `
      <a href="login.html" class="btn btn-secondary btn-sm"><i class="fas fa-sign-in-alt"></i> Login</a>
      <a href="book.html" class="btn btn-primary btn-sm"><i class="fas fa-calendar-plus"></i> Book Pickup</a>
    `;
  }
}

// Quick Track Order Handler in Hero / Navbar
function handleQuickTrack(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('quick-track-input');
  if (!input || !input.value.trim()) {
    showToast('Please enter a Tracking ID (e.g. FF-849201)', 'error');
    return;
  }
  const code = input.value.trim().toUpperCase();
  window.location.href = `track.html?id=${encodeURIComponent(code)}`;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  updateNavUI();
});
