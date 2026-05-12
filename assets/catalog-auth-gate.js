(() => {
  const protectedPage = document.querySelector('main[data-page="catalog"], main[data-page="product"], main[data-page="cart"]');
  if (!protectedPage) return;

  const CRM_BASE = 'https://crm.securesmart.tech';
  window.SECURE_SMART_CATALOG_AUTH = { ready: false, allowed: false };

  function emit(allowed) {
    window.SECURE_SMART_CATALOG_AUTH.ready = true;
    window.SECURE_SMART_CATALOG_AUTH.allowed = !!allowed;
    document.dispatchEvent(new CustomEvent('secure-smart-catalog-auth', { detail: { allowed: !!allowed } }));
  }

  function blocked() {
    document.body.classList.add('catalog-auth-ready');
    protectedPage.innerHTML = `
      <section class="ct-auth-gate container" aria-live="polite">
        <p class="ct-kicker">Customer access required</p>
        <h1>Catalogue and B2B pricing is only available to signed-in approved trade accounts.</h1>
        <p>Please sign in to continue, or register for a trade account.</p>
        <div class="ct-auth-gate-actions">
          <a class="btn primary" href="customer-login.html">Login</a>
          <a class="btn ghost" href="account.html">Register</a>
        </div>
      </section>`;
    emit(false);
  }

  async function verifyCustomer(session) {
    const token = session?.access_token;
    if (!token) return null;
    const response = await fetch(`${CRM_BASE}/api/customer/me`, {
      headers: { Authorization: `Bearer ${token}` },
      mode: 'cors'
    });
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return data?.ok ? data : null;
  }

  async function run() {
    const cfg = window.SECURE_SMART_SUPABASE || {};
    if (!window.supabase || !cfg.url || !cfg.anonKey) return blocked();
    const client = window.supabase.createClient(cfg.url, cfg.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
    });
    try {
      const { data } = await client.auth.getSession();
      const customer = await verifyCustomer(data?.session);
      if (!customer) return blocked();
      document.body.classList.add('catalog-auth-ready', 'catalog-authenticated');
      emit(true);
    } catch (_err) {
      blocked();
    }
  }

  run();
})();
