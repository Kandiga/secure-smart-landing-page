(() => {
  const CRM_BASE = 'https://crm.securesmart.tech';
  const CUSTOMER_PASSWORD_REDIRECT = 'https://www.securesmart.tech/customer-login.html';
  const cfg = window.SECURE_SMART_SUPABASE || {};
  const status = (el, msg, ok = false) => {
    if (!el) return;
    el.textContent = msg;
    el.className = ok ? 'portal-status ok' : 'portal-status error';
  };
  const money = (value) => Number(value || 0).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  const dateFmt = (value) => value ? new Date(value).toLocaleDateString('en-US') : '—';
  const orderStatusLabels = {
    new: 'Received by Secure Smart',
    review: 'Under review',
    approved: 'Approved',
    needs_purchase: 'Sourcing / purchasing',
    partial_stock: 'Partially available',
    ready_to_deliver: 'Ready to deliver',
    delivered: 'Delivered',
    cancelled: 'Cancelled'
  };
  const orderStatusHelp = {
    new: 'Your order request was received and is waiting for review.',
    review: 'Secure Smart is checking items, availability and trade terms.',
    approved: 'The request has been approved and is ready for the next step.',
    needs_purchase: 'Some items need supplier purchasing or confirmation.',
    partial_stock: 'Part of the order is available; remaining items need follow-up.',
    ready_to_deliver: 'The order is ready for delivery coordination.',
    delivered: 'The order was completed.',
    cancelled: 'This request was cancelled.'
  };
  const statusLabel = (value) => orderStatusLabels[value] || String(value || 'Received').replaceAll('_', ' ').replace(/\b\w/g, (ch) => ch.toUpperCase());
  const statusHelp = (value) => orderStatusHelp[value] || 'Status is being updated by Secure Smart.';
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));

  function client() {
    if (!window.supabase || !cfg.url || !cfg.anonKey) throw new Error('Customer login is not configured');
    return window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }

  function urlParamsFromHash() {
    const hash = String(location.hash || '').replace(/^#/, '');
    return new URLSearchParams(hash);
  }

  function hasRecoveryIntent() {
    const query = new URLSearchParams(location.search);
    const hash = urlParamsFromHash();
    return query.has('code') || query.get('type') === 'recovery' || query.has('error_code') || query.has('error') || hash.get('type') === 'recovery' || hash.has('access_token') || hash.has('error_code') || hash.has('error');
  }

  function cleanRecoveryUrl() {
    if (history.replaceState) history.replaceState(null, '', `${location.pathname}${location.search.includes('password=updated') ? '?password=updated' : ''}`);
  }

  async function accessToken() {
    const supabase = client();
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token || '';
  }

  async function currentCustomer() {
    const token = await accessToken();
    if (!token) return null;
    const res = await fetch(`${CRM_BASE}/api/customer/me`, { headers: { Authorization: `Bearer ${token}` }, mode: 'cors' });
    if (!res.ok) return null;
    return res.json();
  }

  async function trackCustomerActivity(event, details = {}) {
    try {
      const token = await accessToken().catch(() => '');
      const body = JSON.stringify({
        event,
        customerEmail: details.customerEmail || '',
        pageUrl: location.href,
        referrer: document.referrer || '',
        language: document.documentElement.lang || 'en',
        context: { browserOnline: navigator.onLine, ...(details.context || {}) },
        error: details.error || {}
      });
      fetch(`${CRM_BASE}/api/customer/activity`, {
        method: 'POST', mode: 'cors', keepalive: true,
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body
      }).catch(() => {});
    } catch {}
  }

  function setLoginMode(mode) {
    const loginForm = document.querySelector('[data-customer-login-form]');
    const passwordForm = document.querySelector('[data-customer-password-form]');
    const resetForm = document.querySelector('[data-customer-reset-form]');
    if (loginForm) loginForm.hidden = mode !== 'login';
    if (passwordForm) passwordForm.hidden = mode !== 'password';
    if (resetForm) resetForm.hidden = mode !== 'reset';
  }

  async function prepareRecoverySession(box) {
    if (!hasRecoveryIntent()) return false;
    const supabase = client();
    const query = new URLSearchParams(location.search);
    const code = query.get('code');
    try {
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) throw new Error('Password setup session could not be verified. Please request a new email.');
      }
      setLoginMode('password');
      status(box, 'Choose a new password for your Secure Smart customer account.', true);
      cleanRecoveryUrl();
      return true;
    } catch (error) {
      cleanRecoveryUrl();
      setLoginMode('reset');
      status(box, error?.message || 'This password link is invalid or expired. Please request a new password email.', false);
      return true;
    }
  }

  function wirePasswordToggles(root = document) {
    root.querySelectorAll('[data-toggle-password]').forEach((button) => {
      if (button.dataset.wired === 'true') return;
      button.dataset.wired = 'true';
      button.addEventListener('click', () => {
        const wrap = button.closest('.portal-password-wrap') || button.parentElement;
        const input = wrap?.querySelector('input');
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        button.textContent = show ? 'Hide' : 'Show';
        button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
      });
    });
  }

  function wirePasswordForm(box) {
    const form = document.querySelector('[data-customer-password-form]');
    if (!form || form.dataset.wired === 'true') return;
    form.dataset.wired = 'true';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      const old = button?.textContent;
      const password = form.querySelector('[name="new_password"]')?.value || '';
      const confirm = form.querySelector('[name="confirm_password"]')?.value || '';
      if (password.length < 8) return status(box, 'Password must be at least 8 characters.', false);
      if (password !== confirm) return status(box, 'Passwords do not match.', false);
      if (button) { button.disabled = true; button.textContent = 'Saving password...'; }
      try {
        const supabase = client();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        await trackCustomerActivity('password_setup_completed', { context: { source: 'recovery_link' } });
        await supabase.auth.signOut();
        location.href = 'customer-login.html?password=updated';
      } catch (error) {
        status(box, error?.message || 'Password could not be saved. Please request a new setup email.', false);
      } finally {
        if (button) { button.disabled = false; button.textContent = old; }
      }
    });
  }

  function wireResetForm(box) {
    const form = document.querySelector('[data-customer-reset-form]');
    if (!form || form.dataset.wired === 'true') return;
    form.dataset.wired = 'true';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      const old = button?.textContent;
      const email = form.querySelector('[name="email"]')?.value?.trim();
      if (!email) return status(box, 'Enter your customer account email.', false);
      if (button) { button.disabled = true; button.textContent = 'Sending email...'; }
      try {
        const supabase = client();
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: CUSTOMER_PASSWORD_REDIRECT });
        if (error) throw error;
        trackCustomerActivity('password_reset_requested', { customerEmail: email, context: { source: 'forgot_password_form' } });
        status(box, 'If this email belongs to an approved customer account, a password reset email has been sent.', true);
      } catch (error) {
        status(box, error?.message || 'Could not send password reset email. Please contact Secure Smart support.', false);
      } finally {
        if (button) { button.disabled = false; button.textContent = old; }
      }
    });
  }

  async function initLogin() {
    const form = document.querySelector('[data-customer-login-form]');
    if (!form) return;
    const box = document.querySelector('[data-customer-login-status]');
    wirePasswordToggles();
    if (hasRecoveryIntent()) {
      setLoginMode('password');
      status(box, 'Validating your secure password link...', true);
    }
    wirePasswordForm(box);
    wireResetForm(box);
    document.querySelector('[data-show-reset]')?.addEventListener('click', (event) => {
      event.preventDefault();
      setLoginMode('reset');
      status(box, 'Enter your customer account email and we will send a secure reset email.', true);
    });
    if (new URLSearchParams(location.search).get('password') === 'updated') {
      status(box, 'Password updated. You can now sign in with your email and new password.', true);
    }
    const recoveryHandled = await prepareRecoverySession(box);
    if (recoveryHandled) return;
    setLoginMode('login');
    const existing = await currentCustomer().catch(() => null);
    if (existing?.ok) {
      location.href = 'customer-account.html';
      return;
    }
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      const old = button?.textContent;
      if (button) { button.disabled = true; button.textContent = 'Signing in...'; }
      try {
        const supabase = client();
        const email = form.querySelector('[name="email"]')?.value?.trim();
        const password = form.querySelector('[name="password"]')?.value || '';
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        const me = await currentCustomer();
        if (!me?.ok) throw new Error('This account is not approved as a customer account yet.');
        trackCustomerActivity('login_success', { customerEmail: email, context: { source: 'customer_login_form' } });
        status(box, 'Signed in successfully. Redirecting to your account...', true);
        location.href = 'customer-account.html';
      } catch (error) {
        const email = form.querySelector('[name="email"]')?.value?.trim();
        trackCustomerActivity('login_failed', { customerEmail: email, error: { message: error?.message || 'Sign in failed' }, context: { source: 'customer_login_form' } });
        status(box, error?.message || 'Sign in failed. Check your email and password.', false);
      } finally {
        if (button) { button.disabled = false; button.textContent = old; }
      }
    });
  }

  function wireProfilePasswordForm(box) {
    const form = document.querySelector('[data-customer-profile-password-form]');
    if (!form || form.dataset.wired === 'true') return;
    form.dataset.wired = 'true';
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const button = form.querySelector('button');
      const old = button?.textContent;
      const password = form.querySelector('[name="new_password"]')?.value || '';
      const confirm = form.querySelector('[name="confirm_password"]')?.value || '';
      if (password.length < 8) return status(box, 'Password must be at least 8 characters.', false);
      if (password !== confirm) return status(box, 'Passwords do not match.', false);
      if (button) { button.disabled = true; button.textContent = 'Updating password...'; }
      try {
        const supabase = client();
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
        trackCustomerActivity('profile_password_changed', { context: { source: 'customer_account_profile' } });
        form.reset();
        status(box, 'Password updated successfully.', true);
      } catch (error) {
        status(box, error?.message || 'Password could not be updated.', false);
      } finally {
        if (button) { button.disabled = false; button.textContent = old; }
      }
    });
  }

  async function initAccount() {
    const root = document.querySelector('[data-customer-account]');
    if (!root) return;
    const box = document.querySelector('[data-customer-account-status]');
    try {
      const me = await currentCustomer();
      if (!me?.ok) {
        location.href = 'customer-login.html';
        return;
      }
      root.querySelector('[data-customer-number]').textContent = me.profile?.customer_number || 'Pending assignment';
      root.querySelector('[data-customer-account-number]').textContent = me.company?.account_number || 'Pending assignment';
      root.querySelector('[data-customer-name]').textContent = [me.profile?.first_name, me.profile?.last_name].filter(Boolean).join(' ') || me.profile?.email || 'Secure Smart customer';
      root.querySelector('[data-customer-email]').textContent = me.profile?.email || '';
      root.querySelector('[data-customer-company]').textContent = `${me.company?.name || 'Approved customer account'}${me.company?.is_vip ? ' · ' + (me.company?.vip_label || 'VIP') : ''}`;
      const list = root.querySelector('[data-customer-orders]');
      list.innerHTML = '';
      if (!me.orders?.length) {
        list.innerHTML = '<p class="muted">There are no orders in this account yet. Start from the catalog and submit a new order request.</p>';
      } else {
        me.orders.forEach((order) => {
          const row = document.createElement('article');
          const items = Array.isArray(order.order_items) ? order.order_items : [];
          row.className = 'portal-order-card';
          row.innerHTML = `
            <div class="portal-order-head">
              <div>
                <strong>Order No.: ${escapeHtml(order.order_number || order.id)}${order.customer_po_number ? ` · PO ${escapeHtml(order.customer_po_number)}` : ''}</strong>
                <span>${dateFmt(order.created_at)} · ${escapeHtml(statusLabel(order.status))}${me.company?.is_vip ? ` · ${escapeHtml(me.company?.vip_label || 'VIP')}` : ''}</span>
                ${order.project_name ? `<span>${escapeHtml(order.project_name)}</span>` : ''}
                ${order.customer_visible_note ? `<span>${escapeHtml(order.customer_visible_note)}</span>` : ''}
                <span>${escapeHtml(statusHelp(order.status))}</span>
              </div>
              <div class="portal-order-total">${money(order.total_customer_value)}</div>
            </div>
            <div class="portal-order-items">
              ${items.length ? items.map((item) => `
                <div class="portal-order-item">
                  <span>${escapeHtml(item.sku)}</span>
                  <span>${escapeHtml(item.product_title || item.sku)}</span>
                  <span>× ${Number(item.order_quantity || 0)}</span>
                  <span>${money(item.customer_total)}${me.company?.is_vip ? ' · VIP price' : ''}</span>
                </div>
              `).join('') : '<span class="muted">No item lines to display.</span>'}
            </div>
          `;
          list.appendChild(row);
        });
      }
      status(box, 'Account is active and connected to Secure Smart customer services.', true);
      trackCustomerActivity('account_loaded', { customerEmail: me.profile?.email || '', context: { source: 'customer_account_page' } });
      wirePasswordToggles(root);
      wireProfilePasswordForm(box);
    } catch (error) {
      status(box, error?.message || 'Could not load the customer account.', false);
    }
    document.querySelector('[data-customer-logout]')?.addEventListener('click', async () => {
      await trackCustomerActivity('logout', { context: { source: 'customer_account_button' } });
      await client().auth.signOut();
      location.href = 'customer-login.html';
    });
  }

  async function signedOrderRequestHeaders() {
    const token = await accessToken().catch(() => '');
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  window.SecureSmartCustomerAuth = { client, accessToken, currentCustomer, signedOrderRequestHeaders, trackCustomerActivity };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => { initLogin(); initAccount(); });
  else { initLogin(); initAccount(); }
})();
