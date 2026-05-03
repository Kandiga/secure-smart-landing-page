const navItems = [
  ["/dashboard", "סקירה"],
  ["/dashboard/orders", "הזמנות"],
  ["/dashboard/customers", "לקוחות"],
  ["/dashboard/products", "מוצרים"],
  ["/dashboard/approvals", "אישורים"],
  ["/dashboard/settings", "הגדרות"],
];

export function AppShell({ children, active = "/dashboard" }: { children: React.ReactNode; active?: string }) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">SS</div>
          <div>
            <div className="brand-title">Secure Smart</div>
            <div className="brand-subtitle">Operations cockpit</div>
          </div>
        </div>
        <nav className="nav" aria-label="ניווט ראשי">
          {navItems.map(([href, label]) => (
            <a key={href} href={href} className={active === href ? "active" : undefined}>{label}</a>
          ))}
        </nav>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
