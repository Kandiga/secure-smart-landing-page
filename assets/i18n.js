(() => {
  const supported = ['he', 'en', 'fr', 'ru'];
  const labels = { he: 'עברית', en: 'English', fr: 'Français', ru: 'Русский' };
  const meta = {
    he: { lang: 'he', dir: 'rtl' },
    en: { lang: 'en', dir: 'ltr' },
    fr: { lang: 'fr', dir: 'ltr' },
    ru: { lang: 'ru', dir: 'ltr' }
  };

  const t = {
    he: {
      'Secure Smart | B2B Network Distributor': 'Secure Smart | מפיץ B2B לציוד תקשורת',
      'About Secure Smart': 'אודות Secure Smart',
      'Register | Secure Smart': 'הרשמה | Secure Smart',
      'Contact | Secure Smart': 'יצירת קשר | Secure Smart',
      'Guides & Services | Secure Smart': 'שירותים וליווי | Secure Smart',
      'Delivery | Secure Smart': 'אספקה | Secure Smart',
      'Privacy Policy | Secure Smart': 'מדיניות פרטיות | Secure Smart',
      'Terms & Conditions | Secure Smart': 'תנאים והגבלות | Secure Smart',
      'Request received': 'הבקשה התקבלה',
      'Skip to content': 'דלג לתוכן',
      'Login': 'כניסה',
      'Register': 'הרשמה',
      'Apply today for Secure Smart trade access.': 'הגישו בקשה לגישת Trade של Secure Smart.',
      'Secure Smart is a focused B2B catalogue for networking, surveillance, wireless links and GPON hardware. Search by brand, SKU and request trade access for pricing and availability.': 'Secure Smart הוא קטלוג B2B ממוקד לציוד תקשורת, אבטחה, קישורים אלחוטיים ו־GPON. חפשו לפי מותג או SKU והגישו בקשה לגישת Trade כדי לקבל מחירים וזמינות.',
      'SecureSmart delivers advanced networking hardware solutions to professional resellers, installers and system integrators — combining competitive pricing, dependable supply chain and responsive service, with access to leading global communication brands.': 'SecureSmart מספקת פתרונות חומרת תקשורת מתקדמים למשווקים, מתקינים ואינטגרטורים מקצועיים, עם תמחור תחרותי, שרשרת אספקה אמינה, שירות מהיר וגישה למותגי תקשורת מובילים בעולם.',
      'Home / About': 'בית / אודות',
      'Home / Register': 'בית / הרשמה',
      'Home / Contact': 'בית / יצירת קשר',
      'Home / Guides & Services': 'בית / שירותים וליווי',
      'Home / Delivery': 'בית / אספקה',
      'Home / Privacy Policy': 'בית / מדיניות פרטיות',
      'Home / Terms & Conditions': 'בית / תנאים והגבלות',
      'Your reliable partner for selected network infrastructure supply': 'השותף האמין שלך לאספקת תשתיות תקשורת נבחרות',
      'Secure Smart is being built as a focused professional distributor portal, with selected brands, SKU search, Trade account approval and project RFQ.': 'Secure Smart נבנה כפורטל מפיצים מקצועי וממוקד, עם מותגים נבחרים, חיפוש לפי SKU, אישור חשבון Trade ובקשות הצעת מחיר לפרויקטים.',
      'Function before spectacle': 'תפעול לפני רושם',
      'The site is not a retail storefront and not a cinematic landing page. It is a working B2B catalogue shell that can grow into a full distributor portal after product selection.': 'האתר אינו חנות קמעונאית ואינו דף נחיתה ראוותני. זהו שלד פעיל של קטלוג B2B, שמיועד להתפתח לפורטל מפיצים מלא לאחר בחירת המוצרים.',
      'Selected catalogue': 'קטלוג נבחר',
      'Only approved opening products are shown.': 'מוצגים רק מוצרי פתיחה שאושרו.',
      'Trade pricing': 'מחירי Trade',
      'Pricing is gated behind account approval.': 'המחירים זמינים רק לאחר אישור חשבון.',
      'RFQ flow': 'תהליך RFQ',
      'Project quantity requests go through Trade forms.': 'בקשות לכמויות פרויקט עוברות דרך טפסי Trade.',
      'Open a Secure Smart Trade account or send a project RFQ.': 'פתחו חשבון Trade ב־Secure Smart או שלחו בקשת הצעת מחיר לפרויקט.',
      'Do not fill': 'אין למלא',
      'First name': 'שם פרטי',
      'Last name': 'שם משפחה',
      'Business email': 'אימייל עסקי',
      'Company': 'חברה',
      'Phone': 'טלפון',
      'Reseller': 'משווק',
      'Integrator': 'אינטגרטור',
      'ISP': 'ספק אינטרנט',
      'Technical team': 'צוות טכני',
      'Products, SKUs or project notes': 'מוצרים, מק״טים או הערות לפרויקט',
      'Send request': 'שליחת בקשה',
      'Contact': 'יצירת קשר',
      'Contact Secure Smart for Trade access, RFQ and catalogue questions.': 'צרו קשר עם Secure Smart בנושאי גישת Trade, בקשות RFQ ושאלות על הקטלוג.',
      'Guides & Services': 'שירותים וליווי',
      'Practical support for product selection, RFQ, project quantities and approved Trade purchasing.': 'ליווי מעשי בבחירת מוצרים, RFQ, כמויות לפרויקט ורכישה מאושרת במסלול Trade.',
      'Delivery': 'אספקה',
      'Delivery and availability depend on stock, quantity, destination and project terms.': 'אספקה וזמינות תלויות במלאי, בכמות, ביעד ובתנאי הפרויקט.',
      'Privacy Policy': 'מדיניות פרטיות',
      'Trade form information is used to process access requests and RFQs.': 'המידע בטפסי Trade משמש לטיפול בבקשות גישה ובהצעות מחיר.',
      'Terms & Conditions': 'תנאים והגבלות',
      'The catalogue is for professional B2B customers and does not display public retail pricing.': 'הקטלוג מיועד ללקוחות B2B מקצועיים ואינו מציג מחירי קמעונאות לציבור.',
      'Thank you. Secure Smart will review the request and respond with next steps.': 'תודה. Secure Smart תבדוק את הבקשה ותחזור עם הצעדים הבאים.',
      'Back to site': 'חזרה לאתר',
      'Head Office': 'מטה ראשי',
      'Hong Kong': 'הונג קונג',
      'Israel': 'ישראל',
      'United Kingdom': 'בריטניה',
      'United States': 'ארצות הברית'
    },
    fr: {
      'Secure Smart | B2B Network Distributor': 'Secure Smart | Distributeur B2B d’infrastructure réseau',
      'About Secure Smart': 'À propos de Secure Smart',
      'Register | Secure Smart': 'Inscription | Secure Smart',
      'Contact | Secure Smart': 'Contact | Secure Smart',
      'Guides & Services | Secure Smart': 'Guides et services | Secure Smart',
      'Delivery | Secure Smart': 'Livraison | Secure Smart',
      'Privacy Policy | Secure Smart': 'Politique de confidentialité | Secure Smart',
      'Terms & Conditions | Secure Smart': 'Conditions générales | Secure Smart',
      'Request received': 'Demande reçue',
      'Skip to content': 'Aller au contenu',
      'Login': 'Connexion',
      'Register': 'S’inscrire',
      'Apply today for Secure Smart trade access.': 'Demandez dès aujourd’hui votre accès professionnel Secure Smart.',
      'Secure Smart is a focused B2B catalogue for networking, surveillance, wireless links and GPON hardware. Search by brand, SKU and request trade access for pricing and availability.': 'Secure Smart est un catalogue B2B spécialisé pour les équipements réseau, vidéosurveillance, liaisons sans fil et GPON. Recherchez par marque ou SKU, puis demandez un accès professionnel pour consulter les prix et disponibilités.',
      'SecureSmart delivers advanced networking hardware solutions to professional resellers, installers and system integrators — combining competitive pricing, dependable supply chain and responsive service, with access to leading global communication brands.': 'SecureSmart fournit des solutions matérielles réseau avancées aux revendeurs, installateurs et intégrateurs professionnels, avec des prix compétitifs, une chaîne d’approvisionnement fiable, un service réactif et l’accès à de grandes marques mondiales de communication.',
      'Home / About': 'Accueil / À propos',
      'Home / Register': 'Accueil / Inscription',
      'Home / Contact': 'Accueil / Contact',
      'Home / Guides & Services': 'Accueil / Guides et services',
      'Home / Delivery': 'Accueil / Livraison',
      'Home / Privacy Policy': 'Accueil / Confidentialité',
      'Home / Terms & Conditions': 'Accueil / Conditions générales',
      'Your reliable partner for selected network infrastructure supply': 'Votre partenaire fiable pour l’approvisionnement en infrastructures réseau sélectionnées',
      'Secure Smart is being built as a focused professional distributor portal, with selected brands, SKU search, Trade account approval and project RFQ.': 'Secure Smart est conçu comme un portail distributeur professionnel et ciblé, avec marques sélectionnées, recherche par SKU, validation de compte Trade et demandes de devis projet.',
      'Function before spectacle': 'La fonction avant l’effet',
      'The site is not a retail storefront and not a cinematic landing page. It is a working B2B catalogue shell that can grow into a full distributor portal after product selection.': 'Le site n’est ni une boutique grand public ni une page d’accueil spectaculaire. C’est une base de catalogue B2B opérationnelle, appelée à devenir un portail distributeur complet après la sélection des produits.',
      'Selected catalogue': 'Catalogue sélectionné',
      'Only approved opening products are shown.': 'Seuls les produits de lancement approuvés sont affichés.',
      'Trade pricing': 'Tarifs professionnels',
      'Pricing is gated behind account approval.': 'Les prix sont accessibles uniquement après approbation du compte.',
      'RFQ flow': 'Processus RFQ',
      'Project quantity requests go through Trade forms.': 'Les demandes de quantités projet passent par les formulaires Trade.',
      'Open a Secure Smart Trade account or send a project RFQ.': 'Ouvrez un compte Trade Secure Smart ou envoyez une demande de devis projet.',
      'Do not fill': 'Ne pas remplir',
      'First name': 'Prénom',
      'Last name': 'Nom',
      'Business email': 'E-mail professionnel',
      'Company': 'Société',
      'Phone': 'Téléphone',
      'Reseller': 'Revendeur',
      'Integrator': 'Intégrateur',
      'ISP': 'Fournisseur d’accès Internet',
      'Technical team': 'Équipe technique',
      'Products, SKUs or project notes': 'Produits, SKU ou notes de projet',
      'Send request': 'Envoyer la demande',
      'Contact': 'Contact',
      'Contact Secure Smart for Trade access, RFQ and catalogue questions.': 'Contactez Secure Smart pour l’accès Trade, les RFQ et les questions relatives au catalogue.',
      'Guides & Services': 'Guides et services',
      'Practical support for product selection, RFQ, project quantities and approved Trade purchasing.': 'Accompagnement pratique pour la sélection de produits, les RFQ, les quantités projet et les achats Trade approuvés.',
      'Delivery': 'Livraison',
      'Delivery and availability depend on stock, quantity, destination and project terms.': 'La livraison et la disponibilité dépendent du stock, des quantités, de la destination et des conditions du projet.',
      'Privacy Policy': 'Politique de confidentialité',
      'Trade form information is used to process access requests and RFQs.': 'Les informations des formulaires Trade servent à traiter les demandes d’accès et les RFQ.',
      'Terms & Conditions': 'Conditions générales',
      'The catalogue is for professional B2B customers and does not display public retail pricing.': 'Le catalogue est destiné aux clients B2B professionnels et n’affiche pas de prix publics au détail.',
      'Thank you. Secure Smart will review the request and respond with next steps.': 'Merci. Secure Smart examinera votre demande et vous répondra avec les prochaines étapes.',
      'Back to site': 'Retour au site',
      'Head Office': 'Siège social',
      'Hong Kong': 'Hong Kong',
      'Israel': 'Israël',
      'United Kingdom': 'Royaume-Uni',
      'United States': 'États-Unis'
    },
    ru: {
      'Secure Smart | B2B Network Distributor': 'Secure Smart | B2B-дистрибьютор сетевого оборудования',
      'About Secure Smart': 'О Secure Smart',
      'Register | Secure Smart': 'Регистрация | Secure Smart',
      'Contact | Secure Smart': 'Контакты | Secure Smart',
      'Guides & Services | Secure Smart': 'Услуги и сопровождение | Secure Smart',
      'Delivery | Secure Smart': 'Поставка | Secure Smart',
      'Privacy Policy | Secure Smart': 'Политика конфиденциальности | Secure Smart',
      'Terms & Conditions | Secure Smart': 'Условия использования | Secure Smart',
      'Request received': 'Заявка получена',
      'Skip to content': 'Перейти к содержимому',
      'Login': 'Войти',
      'Register': 'Регистрация',
      'Apply today for Secure Smart trade access.': 'Подайте заявку на профессиональный доступ Secure Smart.',
      'Secure Smart is a focused B2B catalogue for networking, surveillance, wireless links and GPON hardware. Search by brand, SKU and request trade access for pricing and availability.': 'Secure Smart — специализированный B2B-каталог для сетевого оборудования, видеонаблюдения, беспроводных каналов и GPON. Ищите по бренду или SKU и запрашивайте профессиональный доступ к ценам и наличию.',
      'SecureSmart delivers advanced networking hardware solutions to professional resellers, installers and system integrators — combining competitive pricing, dependable supply chain and responsive service, with access to leading global communication brands.': 'SecureSmart поставляет современные решения для сетевой инфраструктуры профессиональным реселлерам, инсталляторам и системным интеграторам, сочетая конкурентные цены, надежную цепочку поставок, оперативный сервис и доступ к ведущим мировым коммуникационным брендам.',
      'Home / About': 'Главная / О компании',
      'Home / Register': 'Главная / Регистрация',
      'Home / Contact': 'Главная / Контакты',
      'Home / Guides & Services': 'Главная / Услуги и сопровождение',
      'Home / Delivery': 'Главная / Поставка',
      'Home / Privacy Policy': 'Главная / Конфиденциальность',
      'Home / Terms & Conditions': 'Главная / Условия',
      'Your reliable partner for selected network infrastructure supply': 'Ваш надежный партнер по поставке отобранной сетевой инфраструктуры',
      'Secure Smart is being built as a focused professional distributor portal, with selected brands, SKU search, Trade account approval and project RFQ.': 'Secure Smart создается как профессиональный дистрибьюторский портал: отобранные бренды, поиск по SKU, подтверждение Trade-аккаунта и проектные RFQ-запросы.',
      'Function before spectacle': 'Функциональность прежде эффекта',
      'The site is not a retail storefront and not a cinematic landing page. It is a working B2B catalogue shell that can grow into a full distributor portal after product selection.': 'Этот сайт не является розничным магазином или эффектным лендингом. Это рабочая основа B2B-каталога, которая после отбора продуктов может вырасти в полноценный портал дистрибьютора.',
      'Selected catalogue': 'Отобранный каталог',
      'Only approved opening products are shown.': 'Показаны только утвержденные стартовые продукты.',
      'Trade pricing': 'Trade-цены',
      'Pricing is gated behind account approval.': 'Цены доступны только после подтверждения аккаунта.',
      'RFQ flow': 'Процесс RFQ',
      'Project quantity requests go through Trade forms.': 'Запросы проектных количеств отправляются через Trade-формы.',
      'Open a Secure Smart Trade account or send a project RFQ.': 'Откройте Trade-аккаунт Secure Smart или отправьте проектный RFQ-запрос.',
      'Do not fill': 'Не заполнять',
      'First name': 'Имя',
      'Last name': 'Фамилия',
      'Business email': 'Рабочий e-mail',
      'Company': 'Компания',
      'Phone': 'Телефон',
      'Reseller': 'Реселлер',
      'Integrator': 'Интегратор',
      'ISP': 'Интернет-провайдер',
      'Technical team': 'Техническая команда',
      'Products, SKUs or project notes': 'Продукты, SKU или примечания к проекту',
      'Send request': 'Отправить заявку',
      'Contact': 'Контакты',
      'Contact Secure Smart for Trade access, RFQ and catalogue questions.': 'Свяжитесь с Secure Smart по вопросам Trade-доступа, RFQ и каталога.',
      'Guides & Services': 'Услуги и сопровождение',
      'Practical support for product selection, RFQ, project quantities and approved Trade purchasing.': 'Практическая поддержка по подбору продуктов, RFQ, проектным количествам и утвержденным Trade-закупкам.',
      'Delivery': 'Поставка',
      'Delivery and availability depend on stock, quantity, destination and project terms.': 'Поставка и наличие зависят от склада, количества, пункта назначения и условий проекта.',
      'Privacy Policy': 'Политика конфиденциальности',
      'Trade form information is used to process access requests and RFQs.': 'Данные из Trade-форм используются для обработки запросов доступа и RFQ.',
      'Terms & Conditions': 'Условия использования',
      'The catalogue is for professional B2B customers and does not display public retail pricing.': 'Каталог предназначен для профессиональных B2B-клиентов и не показывает публичные розничные цены.',
      'Thank you. Secure Smart will review the request and respond with next steps.': 'Спасибо. Secure Smart рассмотрит заявку и сообщит о следующих шагах.',
      'Back to site': 'Вернуться на сайт',
      'Head Office': 'Головной офис',
      'Hong Kong': 'Гонконг',
      'Israel': 'Израиль',
      'United Kingdom': 'Великобритания',
      'United States': 'США'
    }
  };

  function initialLanguage() {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('lang');
    if (supported.includes(fromUrl)) return fromUrl;
    const saved = localStorage.getItem('ss_lang');
    if (supported.includes(saved)) return saved;
    return 'he';
  }

  function translateTextNode(node, lang) {
    if (lang === 'en') {
      if (node.__ssOriginalText != null) node.nodeValue = node.__ssOriginalText;
      return;
    }
    if (node.__ssOriginalText == null) node.__ssOriginalText = node.nodeValue;
    const original = node.__ssOriginalText;
    const trimmed = original.trim();
    if (!trimmed || !t[lang][trimmed]) return;
    node.nodeValue = original.replace(trimmed, t[lang][trimmed]);
  }

  function walkText(root, lang) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => translateTextNode(node, lang));
  }

  function translateAttributes(lang) {
    document.querySelectorAll('[placeholder]').forEach(el => {
      if (!el.dataset.ssOriginalPlaceholder) el.dataset.ssOriginalPlaceholder = el.getAttribute('placeholder') || '';
      const original = el.dataset.ssOriginalPlaceholder;
      el.setAttribute('placeholder', lang === 'en' ? original : (t[lang][original] || original));
    });
    document.querySelectorAll('[aria-label]').forEach(el => {
      if (!el.dataset.ssOriginalAria) el.dataset.ssOriginalAria = el.getAttribute('aria-label') || '';
      const original = el.dataset.ssOriginalAria;
      el.setAttribute('aria-label', lang === 'en' ? original : (t[lang][original] || original));
    });
    if (!document.documentElement.dataset.ssOriginalTitle) document.documentElement.dataset.ssOriginalTitle = document.title;
    const originalTitle = document.documentElement.dataset.ssOriginalTitle;
    document.title = lang === 'en' ? originalTitle : (t[lang][originalTitle] || originalTitle);
  }

  function syncPublicLinks(lang) {
    const publicPages = new Set(['index.html', 'about.html', 'account.html', 'contact.html', 'services.html', 'delivery.html', 'privacy.html', 'terms.html', 'thanks.html', '']);
    document.querySelectorAll('a[href]').forEach(a => {
      const raw = a.getAttribute('href');
      if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('http')) return;
      const [path, hash = ''] = raw.split('#');
      const [file, query = ''] = path.split('?');
      if (!publicPages.has(file)) return;
      const params = new URLSearchParams(query);
      params.set('lang', lang);
      a.setAttribute('href', `${file || 'index.html'}?${params.toString()}${hash ? `#${hash}` : ''}`);
    });
  }

  function buildSwitcher(current) {
    const header = document.querySelector('.header-actions');
    if (!header || document.querySelector('.language-switcher')) return;
    const wrap = document.createElement('div');
    wrap.className = 'language-switcher';
    wrap.setAttribute('aria-label', 'Language');
    supported.forEach(code => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'language-option';
      button.dataset.lang = code;
      button.textContent = labels[code];
      button.addEventListener('click', () => applyLanguage(code, true));
      wrap.appendChild(button);
    });
    header.prepend(wrap);
    updateSwitcher(current);
  }

  function updateSwitcher(lang) {
    document.querySelectorAll('.language-option').forEach(button => {
      const active = button.dataset.lang === lang;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  function applyLanguage(lang, persist = false) {
    const next = supported.includes(lang) ? lang : 'he';
    if (persist) localStorage.setItem('ss_lang', next);
    document.documentElement.lang = meta[next].lang;
    document.documentElement.dir = meta[next].dir;
    document.body.classList.toggle('is-rtl', meta[next].dir === 'rtl');
    document.body.classList.toggle('is-ltr', meta[next].dir === 'ltr');
    walkText(document.body, next);
    translateAttributes(next);
    syncPublicLinks(next);
    updateSwitcher(next);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState({}, '', url);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const lang = initialLanguage();
    buildSwitcher(lang);
    applyLanguage(lang, false);
  });
})();
