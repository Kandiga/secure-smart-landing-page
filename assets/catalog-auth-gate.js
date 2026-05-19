(() => {
  const protectedPage = document.querySelector('main[data-page="catalog"], main[data-page="product"], main[data-page="cart"]');
  if (!protectedPage) return;

  const CRM_BASE = 'https://crm.securesmart.tech';
  window.SECURE_SMART_CATALOG_AUTH = { ready: false, allowed: false, customer: null };

  function emit(allowed, customer = null) {
    window.SECURE_SMART_CATALOG_AUTH.ready = true;
    window.SECURE_SMART_CATALOG_AUTH.allowed = !!allowed;
    window.SECURE_SMART_CATALOG_AUTH.customer = customer || null;
    document.dispatchEvent(new CustomEvent('secure-smart-catalog-auth', { detail: { allowed: !!allowed, customer: customer || null } }));
  }

  function blocked() {
    document.body.classList.add('catalog-auth-ready');
    protectedPage.innerHTML = `
      <section class="ct-auth-gate container" aria-live="polite">
        <p class="ct-kicker">נדרשת גישת לקוח</p>
        <h1>הקטלוג והמחירים העסקיים זמינים רק ללקוחות סחר מאושרים ומחוברים.</h1>
        <p>כדי להמשיך יש להתחבר או להגיש בקשה לחשבון סחר.</p>
        <div class="ct-auth-gate-actions">
          <a class="btn primary" href="customer-login.html">כניסה</a>
          <a class="btn ghost" href="account.html">הרשמה</a>
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
      emit(true, customer);
    } catch (_err) {
      blocked();
    }
  }

  run();
})();
