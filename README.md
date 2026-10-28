# 🛡️ SecureShop - Red Team & Application Security Assignment

**Assignment Title:** Build → Attack → Identify → Fix → Retest  
**Target Application:** SecureShop E-Commerce Security Laboratory  
**Technology Stack:** Node.js + Express, HTML5/Vanilla JavaScript, Custom Glassmorphic CSS System, Lodash 4.17.11 (Outdated Component)  
**Environment:** Localhost Laboratory Scope (`http://localhost:3000`)

---

## 🚀 Quickstart Guide

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Launch Application Server:**
   ```bash
   npm start
   ```

3. **Access Application:**
   Open your browser to: `http://localhost:3000`

---

## 📋 Application Features & Structure

### 1. Public Functionality
- **Home Page / Storefront:** Product catalogue showcasing security hardware, laptops, and networking gear.
- **Product Search:** Real-time search with vulnerability testing support.
- **Product Details & Filtering:** Category filter pills (Laptops, Accessories, Audio, Tablets, Networking) and price sorting.
- **User Authentication:** Login and Registration modals with pre-configured quick demo user options.

### 2. Authenticated Functionality
- **User Profile:** View and update personal profile details.
- **Order History:** View past orders, status, shipping details, and items purchased.
- **Shopping Cart:** Add/remove items, quantity adjustments, and interactive checkout simulation.

### 3. Administrative Functionality
- **Admin Dashboard:** Overview metrics for total users, products, and security events.
- **User Directory:** View all registered users, roles, and administrative deletion controls.
- **System Audit Trail:** Real-time audit logs for security, login, and access events.

---

## 🔐 Controlled Security Weaknesses (OWASP Top 10)

SecureShop features an interactive **Lab Control Toggle Switch** located in the top navigation bar. You can instantly toggle between 🔴 **Vulnerable Mode (Attack Phase)** and 🟢 **Secure Mode (Remediated Phase)** to test and compare security posture.

| ID | OWASP Category | Weakness Description | Vulnerable Behavior (Before Fix) | Secure Behavior (After Fix) |
|---|---|---|---|---|
| **VULN-A01** | A01: Broken Access Control | Insecure Direct Object Reference (IDOR) & Header Privilege Escalation | Any user can view/modify profile data for user IDs 1, 2, or 3 via `/api/users/:id`. Admin API accepts forged `x-user-role: admin` header. | Strict session ownership checks (`req.session.userId === params.id`) and server-validated user role (`req.user.role === 'admin'`). |
| **VULN-A03** | A03: Injection | Reflected XSS & Search Parameter Injection | Search queries containing `<script>` or `' OR '1'='1` are reflected unescaped in response HTML and bypass query filters. | Input is sanitized, HTML entity-encoded, and query parameters are strictly filtered. |
| **VULN-A05** | A05: Security Misconfiguration | Information Disclosure via Stack Traces & Debug Endpoints | `/api/debug/config` leaks DB credentials, JWT secrets, and node environment. Errors leak full stack trace & `X-Powered-By: Express/4.18.2`. | Debug endpoints return 404. Stack traces hidden in production. Helmet-style headers applied (`Content-Security-Policy`, `X-Content-Type-Options`). |
| **VULN-A06** | A06: Vulnerable/Outdated Components | Lodash 4.17.11 Prototype Pollution | `/api/user/settings` uses outdated `lodash@4.17.11` method `defaultsDeep` without checking `__proto__` keys. | Object keys are sanitized against `__proto__`, `constructor`, and `prototype`. |
| **VULN-A07** | A07: Identification & Auth Failures | Weak Password Hashes & Missing Rate Limiting | Passwords validated against weak MD5 hashes, session tokens are base64-encoded user IDs, and `/api/auth/login` lacks rate limiting. | Passwords hashed securely, login rate-limited (max 5 attempts per minute), crypto-random session tokens. |
| **VULN-A09** | A09: Logging & Monitoring Failures | Sensitive Data Exposure in Logs | Failed auth attempts leak plaintext passwords into console/logs, and audit events miss security failures. | Sensitive fields (`password`, `cvv`) redacted with `****`, comprehensive audit logging active. |

---

## 📦 Requirement 7: Outdated Technology Documentation

- **Component Name:** `lodash`
- **Installed Version:** `4.17.11`
- **Latest Version Available:** `4.17.21`
- **CVE Identifier:** `CVE-2019-10744`
- **Risk & Impact:** Prototype Pollution flaw in `defaultsDeep` allows attackers to pollute `Object.prototype`, causing property injection, denial of service (DoS), or potential remote code execution (RCE).
- **Advisory Reference:** [NVD CVE-2019-10744 Detail](https://nvd.nist.gov/vuln/detail/CVE-2019-10744)

---

## 🎯 OWASP ZAP Scanning Guide (Phase 2)

1. Launch **OWASP ZAP**.
2. Click **Automated Scan**.
3. Set **URL to attack:** `http://localhost:3000`
4. Click **Attack**.
5. Observe and review generated security alerts in ZAP Alert tab.

---

## 🧪 Red Team Lab Suite & Report Generator

SecureShop includes a built-in **Red Team Security Lab** tab (`🧪 Red Team Lab & DAST`) with:
- **Interactive Exploit PoC Launcher:** Execute live vulnerability tests against the backend with 1 click and inspect raw HTTP request/response payloads.
- **Code Remediation Diff Viewer:** Side-by-side comparison of vulnerable vs. secure source code.
- **Automated Assignment Report Generator:** Click **"📄 Generate Assignment Lab Report"** to create a printable PDF/HTML lab report ready for submission.
