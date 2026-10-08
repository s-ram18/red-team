/* ==========================================================================
   SecureShop Main Frontend Logic - E-Commerce, User Auth, Cart & Admin
   ========================================================================== */

const App = {
  currentUser: null,
  cart: [],
  products: [],
  currentCategory: 'All',

  async init() {
    this.loadCartFromStorage();
    this.checkSession();
    await this.loadProducts();
    SecurityLab.init();
    this.setupEventListeners();
  },

  loadCartFromStorage() {
    try {
      const saved = localStorage.getItem('secureshop_cart');
      if (saved) this.cart = JSON.parse(saved);
      this.updateCartBadge();
    } catch (e) {}
  },

  saveCartToStorage() {
    localStorage.setItem('secureshop_cart', JSON.stringify(this.cart));
    this.updateCartBadge();
  },

  checkSession() {
    const savedUser = localStorage.getItem('secureshop_user');
    if (savedUser) {
      try {
        this.currentUser = JSON.parse(savedUser);
        this.renderUserHeader();
      } catch (e) {}
    }
  },

  async loadProducts(category = 'All', search = '') {
    try {
      let url = '/api/products';
      if (search) {
        url = `/api/products/search?q=${encodeURIComponent(search)}`;
      } else if (category && category !== 'All') {
        url = `/api/products?category=${encodeURIComponent(category)}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      
      this.products = Array.isArray(data) ? data : (data.results || []);
      this.renderProducts(this.products);

      if (data.warning) {
        this.showToast(data.warning, 'error');
      }
    } catch (e) {
      console.error("Failed to load products:", e);
    }
  },

  renderProducts(list) {
    const grid = document.getElementById('product-grid');
    if (!grid) return;

    if (!list.length) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔍</div>
          <h3>No products found</h3>
          <p>Try adjusting your search query or filters.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(p => `
      <div class="product-card">
        <div class="product-img-wrapper">
          <span class="category-tag">${p.category}</span>
          <img src="${p.image}" alt="${p.name}" class="product-img" onerror="this.src='/images/laptop.svg'">
        </div>
        <div class="product-info">
          <div class="product-title">${p.name}</div>
          <div class="product-desc">${p.description}</div>
          <div class="product-meta">
            <div>
              <div class="product-price">$${p.price.toFixed(2)}</div>
              <div class="product-rating">★ ${p.rating}</div>
            </div>
            <button class="btn btn-primary" onclick="App.addToCart(${p.id})">
              + Add to Cart
            </button>
          </div>
        </div>
      </div>
    `).join('');
  },

  addToCart(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    const existing = this.cart.find(item => item.product_id === productId);
    if (existing) {
      existing.quantity += 1;
    } else {
      this.cart.push({
        product_id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1
      });
    }

    this.saveCartToStorage();
    this.showToast(`Added ${product.name} to cart`, 'success');
  },

  updateCartBadge() {
    const badge = document.getElementById('cart-badge-count');
    const totalCount = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    if (badge) badge.innerText = totalCount;
  },

  openCartModal() {
    const modal = document.getElementById('cart-modal');
    const itemsContainer = document.getElementById('cart-items-list');
    const totalSpan = document.getElementById('cart-subtotal');

    if (!this.cart.length) {
      itemsContainer.innerHTML = `
        <div style="text-align:center; padding: 2rem; color: var(--text-muted);">
          Your cart is currently empty.
        </div>
      `;
      totalSpan.innerText = "$0.00";
    } else {
      let subtotal = 0;
      itemsContainer.innerHTML = this.cart.map(item => {
        const itemTotal = item.price * item.quantity;
        subtotal += itemTotal;
        return `
          <div style="display:flex; justify-content:space-between; align-items:center; border-bottom: 1px solid var(--border-color); padding: 0.8rem 0;">
            <div>
              <strong style="font-size:0.95rem;">${item.name}</strong>
              <div style="font-size:0.8rem; color:var(--text-muted);">$${item.price.toFixed(2)} x ${item.quantity}</div>
            </div>
            <div style="display:flex; align-items:center; gap: 0.6rem;">
              <span style="font-weight:700;">$${itemTotal.toFixed(2)}</span>
              <button class="btn btn-danger" style="padding: 0.2rem 0.5rem; font-size: 0.75rem;" onclick="App.removeFromCart(${item.product_id})">✕</button>
            </div>
          </div>
        `;
      }).join('');
      totalSpan.innerText = `$${subtotal.toFixed(2)}`;
    }

    modal.classList.add('open');
  },

  removeFromCart(productId) {
    this.cart = this.cart.filter(item => item.product_id !== productId);
    this.saveCartToStorage();
    this.openCartModal();
  },

  async checkout() {
    if (!this.cart.length) {
      return this.showToast('Your cart is empty', 'error');
    }

    const total = this.cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: this.cart,
          total,
          shipping_address: this.currentUser ? this.currentUser.address : '123 Tech Street, Lab Environment',
          payment_method: 'Credit Card (Simulated **** 4242)'
        })
      });
      const data = await res.json();
      if (data.success) {
        this.cart = [];
        this.saveCartToStorage();
        this.closeModal('cart-modal');
        this.showToast(`Order #${data.order.id} placed successfully!`, 'success');
        this.switchTab('orders');
      }
    } catch (e) {
      this.showToast('Checkout failed', 'error');
    }
  },

  // Auth Operations
  openLoginModal() {
    document.getElementById('login-modal').classList.add('open');
    this.toggleAuthMode('login');
  },

  toggleAuthMode(mode) {
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const modeButtons = document.querySelectorAll('.auth-mode-btn');

    const isLogin = mode === 'login';
    if (loginForm) loginForm.style.display = isLogin ? 'block' : 'none';
    if (registerForm) registerForm.style.display = isLogin ? 'none' : 'block';

    modeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.authMode === mode);
    });
  },

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.success) {
        this.currentUser = data.user;
        localStorage.setItem('secureshop_user', JSON.stringify(data.user));
        this.renderUserHeader();
        this.closeModal('login-modal');
        this.showToast(`Welcome back, ${data.user.name}!`, 'success');
      } else {
        this.showToast(data.error || 'Login failed', 'error');
      }
    } catch (err) {
      this.showToast('Server connection error during login', 'error');
    }
  },

  async handleRegister(e) {
    e.preventDefault();
    const name = document.getElementById('register-name').value;
    const email = document.getElementById('register-email').value;
    const password = document.getElementById('register-password').value;
    const address = document.getElementById('register-address').value;
    const phone = document.getElementById('register-phone').value;

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, address, phone })
      });
      const data = await res.json();
      if (data.success) {
        this.currentUser = data.user;
        localStorage.setItem('secureshop_user', JSON.stringify(data.user));
        this.renderUserHeader();
        this.closeModal('login-modal');
        this.showToast(`Welcome, ${data.user.name}! Your account has been created.`, 'success');
      } else {
        this.showToast(data.error || 'Registration failed', 'error');
      }
    } catch (err) {
      this.showToast('Server connection error during registration', 'error');
    }
  },

  quickDemoLogin(role) {
    if (role === 'user') {
      document.getElementById('login-email').value = 'user@secureshop.com';
      document.getElementById('login-password').value = 'password';
    } else if (role === 'admin') {
      document.getElementById('login-email').value = 'admin@secureshop.com';
      document.getElementById('login-password').value = 'admin123';
    }
  },

  logout() {
    this.currentUser = null;
    localStorage.removeItem('secureshop_user');
    document.cookie = 'token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    this.renderUserHeader();
    this.showToast('Logged out successfully', 'info');
    this.switchTab('store');
  },

  renderUserHeader() {
    const userContainer = document.getElementById('user-header-container');
    const adminNavBtn = document.getElementById('nav-btn-admin');

    if (this.currentUser) {
      userContainer.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.6rem;">
          <div class="user-chip">
            <div class="user-avatar">${this.currentUser.name.charAt(0)}</div>
            <span style="font-weight:600;">${this.currentUser.name}</span>
            <span style="font-size:0.72rem; background:rgba(99,102,241,0.25); padding:2px 7px; border-radius:4px; color:#a5b4fc; font-weight:700;">${this.currentUser.role.toUpperCase()}</span>
          </div>
          <button class="btn btn-danger" onclick="App.logout()" style="padding:0.4rem 0.85rem; font-size:0.82rem; font-weight:700;" title="Logout from account">
            🚪 Logout
          </button>
        </div>
      `;
      if (adminNavBtn) adminNavBtn.style.display = this.currentUser.role === 'admin' ? 'flex' : 'none';
    } else {
      userContainer.innerHTML = `
        <button class="btn btn-primary" onclick="App.openLoginModal()">Login / Register</button>
      `;
      if (adminNavBtn) adminNavBtn.style.display = 'none';
    }
  },

  // Tab Switcher
  switchTab(tabName) {
    document.querySelectorAll('.tab-pane').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-tab-btn').forEach(el => el.classList.remove('active'));

    const targetPane = document.getElementById(`tab-${tabName}`);
    const targetBtn = document.getElementById(`nav-btn-${tabName}`);

    if (targetPane) targetPane.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    if (tabName === 'orders') this.loadOrders();
    if (tabName === 'profile') this.loadProfile();
    if (tabName === 'admin') this.loadAdminPanel();
    if (tabName === 'lab') SecurityLab.renderLabView();
  },

  // Load User Orders View
  async loadOrders() {
    const container = document.getElementById('orders-list');
    if (!this.currentUser) {
      container.innerHTML = `<div class="glass-card" style="text-align:center;">Please <a href="#" onclick="App.openLoginModal()">Login</a> to view your order history.</div>`;
      return;
    }

    try {
      const res = await fetch('/api/orders');
      const orders = await res.json();

      if (!orders.length) {
        container.innerHTML = `<div class="glass-card" style="text-align:center;">No past orders found.</div>`;
        return;
      }

      container.innerHTML = orders.map(o => `
        <div class="glass-card" style="margin-bottom: 1rem;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.8rem; border-bottom:1px solid var(--border-color); padding-bottom:0.6rem;">
            <div>
              <strong style="font-size:1.1rem; color:var(--text-main);">Order #${o.id}</strong>
              <span style="font-size:0.8rem; color:var(--text-muted); margin-left:0.6rem;">${new Date(o.created_at).toLocaleString()}</span>
            </div>
            <span class="badge" style="background:rgba(16,185,129,0.2); color:#6ee7b7; padding:3px 10px; border-radius:12px; font-weight:700; font-size:0.8rem;">${o.status}</span>
          </div>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0.6rem;">
            Customer: <strong>${o.user_name}</strong> (${o.user_email}) | Shipping: ${o.shipping_address}
          </p>
          <div style="font-size:0.88rem; margin-bottom:0.8rem;">
            ${o.items.map(i => `<div>- ${i.name} x ${i.quantity} ($${(i.price * i.quantity).toFixed(2)})</div>`).join('')}
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; font-weight:700; font-size:1rem; border-top:1px solid var(--border-color); padding-top:0.6rem;">
            <span>Total Paid:</span>
            <span style="color:var(--accent-secondary);">$${o.total.toFixed(2)}</span>
          </div>
        </div>
      `).join('');
    } catch (e) {
      container.innerHTML = `<div class="glass-card">Error loading orders.</div>`;
    }
  },

  // Load Profile View (Includes IDOR Tester)
  async loadProfile() {
    const container = document.getElementById('profile-content');
    const userIdToFetch = this.currentUser ? this.currentUser.id : 1;

    try {
      const res = await fetch(`/api/users/${userIdToFetch}`);
      const profile = await res.json();

      container.innerHTML = `
        <div class="glass-card" style="max-width:700px; margin:0 auto;">
          <h3 style="margin-bottom:1rem; font-size:1.3rem;">User Profile Details</h3>
          
          ${profile.warning ? `<div style="background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); padding:0.8rem; border-radius:8px; color:#fca5a5; font-size:0.85rem; margin-bottom:1.2rem;">⚠️ ${profile.warning}</div>` : ''}

          <div style="display:grid; grid-template-columns:1fr 1fr; gap:1.2rem; font-size:0.92rem; margin-bottom:1.5rem;">
            <div><strong>User ID:</strong> ${profile.id}</div>
            <div><strong>Role:</strong> <span style="color:var(--accent-secondary); font-weight:700;">${profile.role}</span></div>
            <div><strong>Full Name:</strong> ${profile.name}</div>
            <div><strong>Email Address:</strong> ${profile.email}</div>
            <div><strong>Phone:</strong> ${profile.phone || 'N/A'}</div>
            <div><strong>Address:</strong> ${profile.address || 'N/A'}</div>
            ${profile.password_hash ? `<div style="grid-column:1/-1; color:#fca5a5;"><strong>Leaked MD5 Hash (IDOR):</strong> <code>${profile.password_hash}</code></div>` : ''}
          </div>

          <!-- IDOR Vulnerability Interactive Tester -->
          <div style="background:rgba(15,23,42,0.8); border:1px solid var(--border-color); padding:1rem; border-radius:8px;">
            <h4 style="font-size:0.95rem; margin-bottom:0.5rem; color:var(--accent-secondary);">
              🧪 IDOR Endpoint Inspector (/api/users/:id)
            </h4>
            <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.8rem;">
              Change target ID below to test if profile authorization check is bypassed:
            </p>
            <div style="display:flex; gap:0.5rem;">
              <button class="btn btn-secondary" style="font-size:0.8rem;" onclick="App.testProfileIDOR(1)">View Profile ID 1 (Alice)</button>
              <button class="btn btn-secondary" style="font-size:0.8rem;" onclick="App.testProfileIDOR(2)">View Profile ID 2 (Bob Admin)</button>
              <button class="btn btn-secondary" style="font-size:0.8rem;" onclick="App.testProfileIDOR(3)">View Profile ID 3 (Charlie)</button>
            </div>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="glass-card">Error loading profile.</div>`;
    }
  },

  async testProfileIDOR(targetId) {
    try {
      const res = await fetch(`/api/users/${targetId}`);
      const data = await res.json();
      if (res.ok) {
        this.showToast(`Fetched Profile ID ${targetId} (${data.name})`, 'info');
        document.getElementById('profile-content').innerHTML = `
          <div class="glass-card" style="max-width:700px; margin:0 auto;">
            <h3 style="margin-bottom:1rem; font-size:1.3rem;">Fetched Profile ID ${data.id}</h3>
            ${data.warning ? `<div style="background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); padding:0.8rem; border-radius:8px; color:#fca5a5; font-size:0.85rem; margin-bottom:1.2rem;">⚠️ ${data.warning}</div>` : ''}
            <pre style="background:#090d16; padding:1rem; border-radius:8px; color:#38bdf8; font-size:0.85rem;">${JSON.stringify(data, null, 2)}</pre>
            <button class="btn btn-secondary" style="margin-top:1rem;" onclick="App.loadProfile()">← Back to My Profile</button>
          </div>
        `;
      } else {
        this.showToast(data.error || 'Access Denied', 'error');
      }
    } catch (e) {
      this.showToast('IDOR test request failed', 'error');
    }
  },

  // Load Admin Panel
  async loadAdminPanel() {
    const container = document.getElementById('admin-content-area');

    try {
      // In vulnerable mode: sends client header x-user-role: admin to test privilege escalation
      const headers = SecurityLab.currentMode === 'vulnerable' ? { 'x-user-role': 'admin' } : {};
      const res = await fetch('/api/admin/users', { headers });
      const data = await res.json();

      if (!res.ok && !data.users) {
        container.innerHTML = `<div class="glass-card" style="text-align:center; color:var(--accent-danger);">Forbidden: Admin privileges required to access Admin Portal.</div>`;
        return;
      }

      const logsRes = await fetch('/api/logs');
      const logs = await logsRes.json();

      container.innerHTML = `
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:1rem; margin-bottom:2rem;">
          <div class="glass-card" style="text-align:center;">
            <div style="font-size:1.8rem; font-weight:800; color:var(--accent-primary);">${data.users.length}</div>
            <div style="font-size:0.82rem; color:var(--text-muted);">Registered Users</div>
          </div>
          <div class="glass-card" style="text-align:center;">
            <div style="font-size:1.8rem; font-weight:800; color:var(--accent-secondary);">${this.products.length}</div>
            <div style="font-size:0.82rem; color:var(--text-muted);">Active Products</div>
          </div>
          <div class="glass-card" style="text-align:center;">
            <div style="font-size:1.8rem; font-weight:800; color:var(--accent-success);">${logs.length}</div>
            <div style="font-size:0.82rem; color:var(--text-muted);">Audit Log Events</div>
          </div>
        </div>

        ${data.warning ? `<div style="background:rgba(239,68,68,0.2); border:1px solid rgba(239,68,68,0.4); padding:0.8rem; border-radius:8px; color:#fca5a5; font-size:0.85rem; margin-bottom:1.5rem;">⚠️ ${data.warning}</div>` : ''}

        <div class="glass-card" style="margin-bottom:2rem;">
          <h4 style="margin-bottom:1rem;">User Directory & Privileges</h4>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Plaintext Password (VULN)</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                ${data.users.map(u => `
                  <tr>
                    <td>${u.id}</td>
                    <td>${u.name}</td>
                    <td>${u.email}</td>
                    <td><span class="badge" style="background:rgba(99,102,241,0.2); color:#a5b4fc; padding:2px 6px; border-radius:4px;">${u.role}</span></td>
                    <td><code style="color:#fca5a5;">${u.password_plain || '******'}</code></td>
                    <td>
                      <button class="btn btn-danger" style="padding:0.2rem 0.6rem; font-size:0.75rem;" onclick="App.deleteUser(${u.id})">Delete</button>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <div class="glass-card">
          <h4 style="margin-bottom:1rem;">System Audit & Security Logs (A09)</h4>
          <div class="table-responsive">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Event</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                ${logs.slice(0, 10).map(l => `
                  <tr>
                    <td style="font-size:0.78rem;">${new Date(l.timestamp).toLocaleTimeString()}</td>
                    <td><strong>${l.event}</strong></td>
                    <td>${l.user}</td>
                    <td><span style="color:${l.status.includes('VULNERABLE') ? '#fca5a5' : '#6ee7b7'}; font-weight:700;">${l.status}</span></td>
                    <td style="font-size:0.8rem; color:var(--text-muted);">${l.details}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (e) {
      container.innerHTML = `<div class="glass-card">Error loading admin panel.</div>`;
    }
  },

  async deleteUser(id) {
    if (!confirm(`Are you sure you want to delete User ID ${id}?`)) return;
    try {
      const headers = SecurityLab.currentMode === 'vulnerable' ? { 'x-user-role': 'admin' } : {};
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', headers });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadAdminPanel();
      }
    } catch (e) {
      this.showToast('Failed to delete user', 'error');
    }
  },

  setupEventListeners() {
    // Search bar listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.loadProducts(this.currentCategory, searchInput.value);
        }
      });
    }

    // Category pills listener
    document.querySelectorAll('.pill-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.pill-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.currentCategory = btn.dataset.category;
        const searchInput = document.getElementById('search-input');
        this.loadProducts(this.currentCategory, searchInput ? searchInput.value : '');
      });
    });
  },

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('open');
  },

  showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed;
      bottom: 25px;
      right: 25px;
      background: ${type === 'error' ? 'rgba(239, 68, 68, 0.9)' : type === 'success' ? 'rgba(16, 185, 129, 0.9)' : 'rgba(99, 102, 241, 0.9)'};
      color: white;
      padding: 0.8rem 1.2rem;
      border-radius: 8px;
      font-size: 0.88rem;
      font-weight: 600;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      z-index: 9999;
      transition: all 0.3s ease;
    `;
    toast.innerText = message;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
