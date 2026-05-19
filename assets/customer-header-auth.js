(() => {
  const cfg = window.SECURE_SMART_SUPABASE || {};
  const loginLink = document.querySelector('.header-actions .header-login');
  const registerLink = document.querySelector('.header-actions .header-register');
  const actions = document.querySelector('.header-actions');
  if (!loginLink || !actions || !window.supabase || !cfg.url || !cfg.anonKey) return;

  const CRM_BASE = 'https://crm.securesmart.tech';
  const HOME_PANEL_ID = 'secureSmartCustomerHomePanel';
  const supabase = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

  function isHomePage() {
    const path = location.pathname.split('/').pop() || 'index.html';
    return path === 'index.html' || path === '';
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  }

  function customerLabel(customer) {
    const company = customer?.company?.name;
    const first = customer?.profile?.first_name;
    if (company) return `My Account · ${company}`;
    if (first) return `My Account · ${first}`;
    return 'My Account';
  }

  function ensureCatalogLink() {
    let link = actions.querySelector('[data-customer-header-catalog]');
    if (!link) {
      link = document.createElement('a');
      link.className = 'header-catalog is-primary-catalog-link';
      link.dataset.customerHeaderCatalog = 'true';
      link.href = 'catalog-template.html';
      link.textContent = 'קטלוג';
      actions.insertBefore(link, loginLink);
    }
    return link;
  }

  function removeHomePanel() {
    document.getElementById(HOME_PANEL_ID)?.remove();
  }

  function ensureHomePanel(customer) {
    if (!isHomePage()) return;
    let panel = document.getElementById(HOME_PANEL_ID);
    if (!panel) {
      panel = document.createElement('section');
      panel.id = HOME_PANEL_ID;
      panel.className = 'customer-home-panel';
      const main = document.querySelector('main');
      const anchor = main?.querySelector('.hero,.ss-atlas-seq,.brand-statement') || main?.firstElementChild;
      if (anchor?.parentNode) anchor.parentNode.insertBefore(panel, anchor.nextSibling);
      else document.querySelector('.top')?.insertAdjacentElement('afterend', panel);
    }
    const company = customer?.company?.name || '';
    const label = company ? `Signed in as ${escapeHtml(company)}` : 'Signed in to your Secure Smart account';
    panel.innerHTML = `
      <div class="container customer-home-panel-inner">
        <div><strong>${label}</strong><span>פתחו את הפרופיל, בדקו הזמנות קודמות או חזרו לקטלוג הסחר.</span></div>
        <nav aria-label="קיצורי לקוח">
          <a href="customer-account.html">פרופיל לקוח</a>
          <a href="catalog-template.html" class="primary">חזרה לקטלוג</a>
        </nav>
      </div>`;
  }

  function showSignedOut() {
    loginLink.textContent = 'כניסה';
    loginLink.href = 'customer-login.html';
    loginLink.classList.remove('is-customer-account');
    loginLink.removeAttribute('data-customer-authenticated');
    if (registerLink) registerLink.hidden = false;
    actions.querySelector('[data-customer-header-catalog]')?.remove();
    actions.querySelector('[data-customer-header-logout]')?.remove();
    removeHomePanel();
  }

  function showSignedIn(customer) {
    ensureCatalogLink();
    loginLink.textContent = customerLabel(customer);
    loginLink.href = 'customer-account.html';
    loginLink.classList.add('is-customer-account');
    loginLink.dataset.customerAuthenticated = 'true';
    if (registerLink) registerLink.hidden = true;
    if (!actions.querySelector('[data-customer-header-logout]')) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'header-logout';
      button.dataset.customerHeaderLogout = 'true';
      button.textContent = 'Sign out';
      button.addEventListener('click', async () => {
        button.disabled = true;
        await supabase.auth.signOut().catch(() => {});
        showSignedOut();
        window.location.href = 'customer-login.html';
      });
      actions.appendChild(button);
    }
    ensureHomePanel(customer);
  }

  async function currentCustomer(session) {
    const token = session?.access_token;
    if (!token) return null;
    const res = await fetch(`${CRM_BASE}/api/customer/me`, {
      headers: { Authorization: `Bearer ${token}` },
      mode: 'cors'
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => null);
    return data?.ok ? data : null;
  }

  async function refreshHeader(session) {
    if (!session?.user) return showSignedOut();
    const customer = await currentCustomer(session).catch(() => null);
    if (customer) showSignedIn(customer);
    else showSignedOut();
  }

  supabase.auth.getSession().then(({ data }) => refreshHeader(data?.session)).catch(showSignedOut);
  supabase.auth.onAuthStateChange((_event, session) => refreshHeader(session));
})();
