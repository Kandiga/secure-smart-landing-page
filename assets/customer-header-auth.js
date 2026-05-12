(() => {
  const cfg = window.SECURE_SMART_SUPABASE || {};
  const loginLink = document.querySelector('.header-actions .header-login');
  const registerLink = document.querySelector('.header-actions .header-register');
  const actions = document.querySelector('.header-actions');
  if (!loginLink || !actions || !window.supabase || !cfg.url || !cfg.anonKey) return;

  const CRM_BASE = 'https://crm.securesmart.tech';
  const supabase = window.supabase.createClient(cfg.url, cfg.anonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });

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
      link.textContent = 'Catalog';
      actions.insertBefore(link, loginLink);
    }
    return link;
  }

  function showSignedOut() {
    loginLink.textContent = 'Login';
    loginLink.href = 'customer-login.html';
    loginLink.classList.remove('is-customer-account');
    loginLink.removeAttribute('data-customer-authenticated');
    if (registerLink) registerLink.hidden = false;
    actions.querySelector('[data-customer-header-catalog]')?.remove();
    actions.querySelector('[data-customer-header-logout]')?.remove();
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
