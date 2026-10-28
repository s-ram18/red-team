const express = require('express');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const lodash = require('lodash');

const app = express();
const PORT = process.env.PORT || 3000;

// Security Mode State: 'vulnerable' (Before Fix) or 'secure' (After Fix)
let securityMode = 'vulnerable';

// Load Database
const DB_FILE = path.join(__dirname, 'database.json');
let db = { users: [], products: [], orders: [], audit_logs: [] };

function loadDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      db = JSON.parse(data);
    }
  } catch (err) {
    console.error('[DB] Error loading database:', err);
  }
}

function saveDB() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf8');
  } catch (err) {
    console.error('[DB] Error saving database:', err);
  }
}

loadDB();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Rate Limiter simulation for Secure Mode
const loginAttempts = new Map();

function rateLimiter(req, res, next) {
  if (securityMode === 'secure') {
    const ip = req.ip || '127.0.0.1';
    const attempts = loginAttempts.get(ip) || { count: 0, resetTime: Date.now() + 60000 };
    
    if (Date.now() > attempts.resetTime) {
      attempts.count = 0;
      attempts.resetTime = Date.now() + 60000;
    }
    
    attempts.count++;
    loginAttempts.set(ip, attempts);

    if (attempts.count > 5) {
      logAudit('LOGIN_BRUTE_FORCE_BLOCKED', 'ANONYMOUS', 'BLOCKED', `IP ${ip} exceeded attempt limit`);
      return res.status(429).json({
        error: 'Too many login attempts. Please try again in 1 minute. (Protected by Rate Limiter)'
      });
    }
  }
  next();
}

// Custom Security Headers middleware (A05)
app.use((req, res, next) => {
  if (securityMode === 'vulnerable') {
    // Vulnerable: Reveal tech stack details in headers
    res.setHeader('X-Powered-By', 'Express/4.18.2 (Node.js/v24.11.0 Vulnerable-Lab)');
    res.setHeader('Server', 'SecureShop-Legacy-Server/1.0.0');
    // Missing Content-Security-Policy, X-Frame-Options, X-Content-Type-Options
  } else {
    // Secure Mode: Remove sensitive headers and set robust security policies
    res.removeHeader('X-Powered-By');
    res.setHeader('Server', 'SecureShop-Protected');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Content-Security-Policy', "default-src 'self' 'unsafe-inline' https://images.unsplash.com https://cdn.jsdelivr.net;");
  }
  next();
});

// Audit Logger Helper (A09)
function logAudit(event, user, status, details) {
  const logEntry = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    ip: '127.0.0.1',
    event,
    user: user || 'ANONYMOUS',
    status,
    details: securityMode === 'secure' && typeof details === 'string'
      ? details.replace(/(password=)[^&]+/gi, '$1****').replace(/("password":\s*")[^"]+"/gi, '$1****"')
      : details
  };
  db.audit_logs.unshift(logEntry);
  if (db.audit_logs.length > 200) db.audit_logs.pop();
  saveDB();
}

// Serve Static Assets
app.use(express.static(path.join(__dirname, 'public')));

// ------------------- SECURITY LAB SYSTEM API -------------------

// Get Security Mode & Summary
app.get('/api/security/mode', (req, res) => {
  res.json({
    mode: securityMode,
    outdated_dependency: {
      name: "lodash",
      installed_version: "4.17.11",
      latest_version: "4.17.21",
      cve: "CVE-2019-10744",
      risk: "Prototype Pollution leading to Remote Code Execution / Denial of Service",
      advisory: "https://nvd.nist.gov/vuln/detail/CVE-2019-10744"
    },
    vulnerabilities: [
      {
        id: "VULN-A01",
        owasp_category: "A01:2021 - Broken Access Control",
        name: "Insecure Direct Object Reference (IDOR) & Admin Privilege Escalation",
        status: securityMode === 'vulnerable' ? 'VULNERABLE' : 'SECURE',
        target_endpoint: "/api/users/:id and /api/orders/:id",
        description: "Users can view or edit any profile or order by altering the ID in the URL. Admin endpoints accept fake 'x-user-role: admin' headers."
      },
      {
        id: "VULN-A03",
        owasp_category: "A03:2021 - Injection",
        name: "Reflected Cross-Site Scripting (XSS) & Search Parameter Injection",
        status: securityMode === 'vulnerable' ? 'VULNERABLE' : 'SECURE',
        target_endpoint: "/api/products/search?q=<script>",
        description: "Unsanitized user search queries are reflected raw in response HTML/JSON payload without context encoding."
      },
      {
        id: "VULN-A05",
        owasp_category: "A05:2021 - Security Misconfiguration",
        name: "Information Disclosure via Stack Traces & Public Debug Endpoints",
        status: securityMode === 'vulnerable' ? 'VULNERABLE' : 'SECURE',
        target_endpoint: "/api/debug/config and /api/debug/error",
        description: "Detailed internal system configurations, stack traces, and Express version headers are exposed to unauthorized users."
      },
      {
        id: "VULN-A06",
        owasp_category: "A06:2021 - Vulnerable and Outdated Components",
        name: "Lodash 4.17.11 Prototype Pollution (CVE-2019-10744)",
        status: securityMode === 'vulnerable' ? 'VULNERABLE' : 'SECURE',
        target_endpoint: "/api/user/settings",
        description: "Application uses outdated lodash@4.17.11 with vulnerable defaultsDeep method mutating Object.prototype."
      },
      {
        id: "VULN-A07",
        owasp_category: "A07:2021 - Identification and Authentication Failures",
        name: "Weak Password Hashing (MD5) & Lack of Login Rate Limiting",
        status: securityMode === 'vulnerable' ? 'VULNERABLE' : 'SECURE',
        target_endpoint: "/api/auth/login",
        description: "Passwords are validated against legacy MD5 hashes without salt, and login lacks brute-force rate limiting."
      },
      {
        id: "VULN-A09",
        owasp_category: "A09:2021 - Security Logging and Monitoring Failures",
        name: "Plaintext Credential Exposure in Logs & Missing Audit Events",
        status: securityMode === 'vulnerable' ? 'VULNERABLE' : 'SECURE',
        target_endpoint: "/api/logs",
        description: "Failed logins are ignored or credentials (passwords) are written into server logs in cleartext."
      }
    ]
  });
});

// Toggle Security Mode
app.post('/api/security/mode', (req, res) => {
  const { mode } = req.body;
  if (mode === 'vulnerable' || mode === 'secure') {
    securityMode = mode;
    logAudit('LAB_MODE_CHANGED', 'SYSTEM', 'SUCCESS', `Switched security posture to: ${mode.toUpperCase()}`);
    return res.json({ success: true, mode: securityMode, message: `Application security posture set to ${mode.toUpperCase()}` });
  }
  res.status(400).json({ error: 'Invalid mode. Use "vulnerable" or "secure"' });
});

// ------------------- APPLICATION ENDPOINTS -------------------

// Authentication: Login
app.post('/api/auth/login', rateLimiter, (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Vulnerable Mode Logging (A09): Logs plaintext password!
  if (securityMode === 'vulnerable') {
    console.log(`[VULN-LOG] Auth attempt for ${email} with password="${password}"`);
  }

  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) {
    logAudit('LOGIN_FAILED', email, 'FAILED', securityMode === 'vulnerable' ? `Password entered: ${password}` : 'Invalid credentials');
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Password Verification logic
  let isValid = false;
  if (securityMode === 'vulnerable') {
    // Plaintext / Simple check (MD5 simulated or plain)
    isValid = (user.password_plain === password) || (user.password_hash === password);
  } else {
    // Secure Check
    isValid = (user.password_plain === password);
  }

  if (!isValid) {
    logAudit('LOGIN_FAILED', email, 'FAILED', securityMode === 'vulnerable' ? `Failed password: ${password}` : 'Invalid credentials');
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // Token / Session creation
  let token = '';
  if (securityMode === 'vulnerable') {
    // Weak Predictable Token (Base64 of user ID and role) - A07
    token = Buffer.from(`${user.id}:${user.role}:${user.email}`).toString('base64');
  } else {
    // Secure Token simulation
    token = `sec_${Math.random().toString(36).substring(2)}_${Date.now()}_usr_${user.id}`;
  }

  res.cookie('token', token, { httpOnly: false });

  logAudit('LOGIN_SUCCESS', user.email, 'SUCCESS', `User ${user.name} logged in successfully`);

  res.json({
    success: true,
    token,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      address: user.address,
      phone: user.phone
    }
  });
});

// Authentication: Register
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, address, phone } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Name, email, and password are required' });
  }

  const existing = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ error: 'User with this email already exists' });
  }

  const newUser = {
    id: db.users.length ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
    name,
    email,
    password_hash: Buffer.from(password).toString('hex'), // Simple hash
    password_plain: password,
    role: 'user',
    address: address || '123 Default Street',
    phone: phone || '+1 555-0000',
    created_at: new Date().toISOString()
  };

  db.users.push(newUser);
  saveDB();

  logAudit('USER_REGISTERED', email, 'SUCCESS', `New user registered: ${name}`);

  const token = Buffer.from(`${newUser.id}:${newUser.role}:${newUser.email}`).toString('base64');
  res.json({
    success: true,
    token,
    user: {
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      address: newUser.address,
      phone: newUser.phone
    }
  });
});

// Helper: Decode user from token header/cookie
function getCurrentUser(req) {
  const token = req.headers.authorization?.replace('Bearer ', '') || req.cookies?.token;
  if (!token) return null;
  
  if (token.startsWith('sec_')) {
    const parts = token.split('_usr_');
    if (parts[1]) {
      const uid = parseInt(parts[1], 10);
      return db.users.find(u => u.id === uid) || null;
    }
  }

  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [idStr] = decoded.split(':');
    const uid = parseInt(idStr, 10);
    return db.users.find(u => u.id === uid) || null;
  } catch (e) {
    return null;
  }
}

// Get Products Listing
app.get('/api/products', (req, res) => {
  let results = [...db.products];
  const { category, minPrice, maxPrice, sort } = req.query;

  if (category && category !== 'All') {
    results = results.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }

  if (minPrice) results = results.filter(p => p.price >= parseFloat(minPrice));
  if (maxPrice) results = results.filter(p => p.price <= parseFloat(maxPrice));

  if (sort === 'price-asc') results.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') results.sort((a, b) => b.price - a.price);
  if (sort === 'rating') results.sort((a, b) => b.rating - a.rating);

  res.json(results);
});

// Product Search (A03: Reflected XSS & Injection Vulnerability)
app.get('/api/products/search', (req, res) => {
  const query = req.query.q || '';

  if (!query) {
    return res.json({ query: '', results: db.products });
  }

  // Vulnerable Mode SQL-like Bypass simulation: ' OR '1'='1
  if (securityMode === 'vulnerable' && (query.includes("' OR '1'='1") || query.includes("1=1"))) {
    logAudit('XSS_OR_INJECTION_ATTEMPT', 'ANONYMOUS', 'VULNERABLE_EXPLOITED', `Query payload: ${query}`);
    return res.json({
      query: query, // Unsanitized echo (Reflected XSS payload preserved)
      injected: true,
      results: db.products, // Returns all products bypassing search filters
      warning: "VULNERABILITY EXPLOITED: Unsanitized input & query logic bypass active!"
    });
  }

  // Regular product search matching name, category, or description
  const filtered = db.products.filter(p =>
    p.name.toLowerCase().includes(query.toLowerCase()) ||
    p.description.toLowerCase().includes(query.toLowerCase()) ||
    p.category.toLowerCase().includes(query.toLowerCase())
  );

  // In Secure Mode: Query output is sanitized / HTML encoded
  const safeQuery = securityMode === 'secure'
    ? query.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    : query;

  res.json({
    query: safeQuery,
    results: filtered
  });
});

// Product Details
app.get('/api/products/:id', (req, res) => {
  const pid = parseInt(req.params.id, 10);
  const product = db.products.find(p => p.id === pid);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json(product);
});

// User Profile (A01: IDOR Vulnerability)
app.get('/api/users/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const currentUser = getCurrentUser(req);

  if (securityMode === 'vulnerable') {
    // VULNERABLE: No authorization check! Any caller can read ANY user profile by changing ID!
    const targetUser = db.users.find(u => u.id === targetId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    logAudit('IDOR_READ_ATTEMPT', currentUser ? currentUser.email : 'ANONYMOUS', 'VULNERABLE_EXPLOITED', `Accessed profile ID ${targetId}`);

    return res.json({
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      address: targetUser.address,
      phone: targetUser.phone,
      password_hash: targetUser.password_hash, // Vulnerable leak of password hash!
      warning: "VULNERABILITY EXPLOITED (IDOR): Profile data accessed without ownership check!"
    });
  } else {
    // SECURE: Enforce authorization check
    if (!currentUser) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (currentUser.id !== targetId && currentUser.role !== 'admin') {
      logAudit('ACCESS_CONTROL_BLOCKED', currentUser.email, 'BLOCKED', `Attempted unauthorized access to user ID ${targetId}`);
      return res.status(403).json({ error: 'Access denied: You are not authorized to view this profile.' });
    }

    const targetUser = db.users.find(u => u.id === targetId);
    if (!targetUser) return res.status(404).json({ error: 'User not found' });

    return res.json({
      id: targetUser.id,
      name: targetUser.name,
      email: targetUser.email,
      role: targetUser.role,
      address: targetUser.address,
      phone: targetUser.phone
    });
  }
});

// Update User Profile (A01 IDOR Vulnerability)
app.put('/api/users/:id', (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const currentUser = getCurrentUser(req);

  const targetUser = db.users.find(u => u.id === targetId);
  if (!targetUser) return res.status(404).json({ error: 'User not found' });

  if (securityMode === 'secure') {
    if (!currentUser || (currentUser.id !== targetId && currentUser.role !== 'admin')) {
      return res.status(403).json({ error: 'Access denied: Cannot edit another user profile' });
    }
  }

  const { name, address, phone } = req.body;
  if (name) targetUser.name = name;
  if (address) targetUser.address = address;
  if (phone) targetUser.phone = phone;

  saveDB();
  logAudit('PROFILE_UPDATED', currentUser ? currentUser.email : 'ANONYMOUS', 'SUCCESS', `Updated profile ID ${targetId}`);

  res.json({ success: true, user: targetUser });
});

// Vulnerable Lodash Settings Endpoint (A06: Vulnerable/Outdated Components & Prototype Pollution)
app.post('/api/user/settings', (req, res) => {
  const settingsInput = req.body;

  const defaultSettings = { theme: 'dark', notifications: true, language: 'en' };

  if (securityMode === 'vulnerable') {
    // VULNERABLE: Uses lodash.defaultsDeep on outdated lodash@4.17.11 without checking __proto__
    try {
      lodash.defaultsDeep(defaultSettings, settingsInput);
      logAudit('PROTOTYPE_POLLUTION_TRIGGERED', 'USER', 'VULNERABLE_EXPLOITED', `Lodash 4.17.11 executed defaultsDeep with input: ${JSON.stringify(settingsInput)}`);

      res.json({
        success: true,
        message: 'Settings updated using legacy lodash@4.17.11 defaultsDeep',
        merged_settings: defaultSettings,
        global_polluted: ({}).polluted || false,
        warning: "VULNERABILITY (A06): Outdated lodash 4.17.11 component accepted nested object payload!"
      });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  } else {
    // SECURE: Whitelist keys & sanitize against __proto__ / constructor / prototype
    if (settingsInput && typeof settingsInput === 'object') {
      for (let key in settingsInput) {
        if (['__proto__', 'constructor', 'prototype'].includes(key)) {
          return res.status(400).json({ error: 'Security Warning: Forbidden object prototype key detected.' });
        }
      }
    }
    const safeSettings = {
      theme: settingsInput.theme || defaultSettings.theme,
      notifications: typeof settingsInput.notifications === 'boolean' ? settingsInput.notifications : defaultSettings.notifications,
      language: settingsInput.language || defaultSettings.language
    };
    res.json({ success: true, message: 'Settings updated safely', merged_settings: safeSettings });
  }
});

// Orders Endpoint (A01 IDOR on specific order ID)
app.get('/api/orders', (req, res) => {
  const currentUser = getCurrentUser(req);
  if (!currentUser) return res.status(401).json({ error: 'Login required' });

  if (currentUser.role === 'admin') {
    return res.json(db.orders);
  }

  const userOrders = db.orders.filter(o => o.user_id === currentUser.id);
  res.json(userOrders);
});

app.get('/api/orders/:id', (req, res) => {
  const orderId = parseInt(req.params.id, 10);
  const currentUser = getCurrentUser(req);

  const order = db.orders.find(o => o.id === orderId);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (securityMode === 'vulnerable') {
    // VULNERABLE IDOR: Returns order regardless of who owns it!
    logAudit('IDOR_ORDER_VIEW', currentUser ? currentUser.email : 'ANONYMOUS', 'VULNERABLE_EXPLOITED', `Viewed Order #${orderId}`);
    return res.json({
      ...order,
      warning: "VULNERABILITY EXPLOITED (IDOR): Order details returned without ownership verification!"
    });
  } else {
    // SECURE
    if (!currentUser) return res.status(401).json({ error: 'Login required' });
    if (order.user_id !== currentUser.id && currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied: You do not own this order' });
    }
    return res.json(order);
  }
});

// Create Order
app.post('/api/orders', (req, res) => {
  const currentUser = getCurrentUser(req);
  const { items, total, shipping_address, payment_method } = req.body;

  if (!items || !items.length) {
    return res.status(400).json({ error: 'Cart items required' });
  }

  const newOrder = {
    id: 5000 + db.orders.length + 1,
    user_id: currentUser ? currentUser.id : 1,
    user_email: currentUser ? currentUser.email : 'guest@secureshop.com',
    user_name: currentUser ? currentUser.name : 'Guest User',
    items,
    total: parseFloat(total) || 0.00,
    status: 'Processing',
    shipping_address: shipping_address || 'Default Address',
    payment_method: payment_method || 'Credit Card',
    created_at: new Date().toISOString()
  };

  db.orders.unshift(newOrder);
  saveDB();

  logAudit('ORDER_CREATED', currentUser ? currentUser.email : 'GUEST', 'SUCCESS', `Created Order #${newOrder.id} for $${newOrder.total}`);

  res.json({ success: true, order: newOrder });
});

// Admin Endpoints (A01 Privilege Escalation)
app.get('/api/admin/users', (req, res) => {
  const currentUser = getCurrentUser(req);
  const fakeAdminHeader = req.headers['x-user-role'] === 'admin' || req.query.isAdmin === 'true';

  if (securityMode === 'vulnerable' && fakeAdminHeader) {
    // VULNERABLE: Bypasses server-side session check if client sends x-user-role header!
    logAudit('ADMIN_BYPASS_EXPLOITED', 'ANONYMOUS_CLIENT', 'VULNERABLE_EXPLOITED', 'Admin user list accessed via forged header x-user-role: admin');
    return res.json({
      users: db.users,
      warning: "VULNERABILITY EXPLOITED (A01 Broken Access Control): Admin area unlocked via forged client header!"
    });
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Admin access required.' });
  }

  res.json({ users: db.users });
});

// Delete user (Admin)
app.delete('/api/admin/users/:id', (req, res) => {
  const currentUser = getCurrentUser(req);
  const fakeAdminHeader = req.headers['x-user-role'] === 'admin';

  if (securityMode === 'secure') {
    if (!currentUser || currentUser.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
  }

  const deleteId = parseInt(req.params.id, 10);
  db.users = db.users.filter(u => u.id !== deleteId);
  saveDB();

  logAudit('USER_DELETED', currentUser ? currentUser.email : 'FORGED_ADMIN', 'SUCCESS', `Deleted User ID ${deleteId}`);
  res.json({ success: true, message: `User ${deleteId} removed.` });
});

// System Debug Config (A05 Security Misconfiguration)
app.get('/api/debug/config', (req, res) => {
  if (securityMode === 'vulnerable') {
    logAudit('MISCONFIG_DEBUG_ACCESSED', 'ANONYMOUS', 'VULNERABLE_EXPLOITED', 'Sensitive debug config endpoint viewed');
    return res.json({
      environment: 'development-lab',
      node_version: process.version,
      express_version: '4.18.2',
      database_path: DB_FILE,
      db_connection_string: 'sqlite3://root:SuperSecretLabPass123!@localhost:5432/secureshop_db',
      jwt_secret: 'secureshop_weak_jwt_secret_key_2026',
      aws_access_key: 'AKIAIOSFODNN7EXAMPLE_SIMULATED',
      system_memory: process.memoryUsage(),
      warning: "VULNERABILITY EXPLOITED (A05): Sensitive system configuration and DB credentials exposed!"
    });
  } else {
    return res.status(404).json({ error: 'Endpoint not found' });
  }
});

// Uncaught Error Trigger (A05 Stack Trace Leak)
app.get('/api/debug/error', (req, res, next) => {
  const err = new Error("DatabaseConnectionException: Failed to acquire pool lock at line 402 in internal/db_driver.js");
  err.stack = "Error: DatabaseConnectionException\n    at /d/red team/server.js:312:15\n    at Layer.handle [as handle_request] (/d/red team/node_modules/express/lib/router/layer.js:95:5)\n    at next (/d/red team/node_modules/express/lib/router/route.js:144:13)\n    at Route.dispatch (/d/red team/node_modules/express/lib/router/route.js:114:3)";
  next(err);
});

// Audit Logs Endpoint
app.get('/api/logs', (req, res) => {
  res.json(db.audit_logs);
});

// Error Handling Middleware (A05 Stack Trace Leak)
app.use((err, req, res, next) => {
  if (securityMode === 'vulnerable') {
    logAudit('STACK_TRACE_LEAKED', 'ANONYMOUS', 'VULNERABLE_EXPLOITED', err.message);
    res.status(500).json({
      error: err.message,
      stack: err.stack,
      server_info: "Node.js v24.11.0 / Express 4.18.2 (Debug Enabled)",
      warning: "VULNERABILITY EXPLOITED (A05): Server stack trace leaked to client!"
    });
  } else {
    res.status(500).json({
      error: 'An internal server error occurred. Please try again later.'
    });
  }
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  SecureShop Red Team Security Lab Running!`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`  Current Security Posture: [ ${securityMode.toUpperCase()} ]`);
  console.log(`=======================================================`);
});
