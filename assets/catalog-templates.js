(function(){
  const key='secureSmartTemplateCart';
  const labels={
    en:{items:'products shown', empty:'The cart is empty. Add items from the quick list below or from the catalog pages.', miniEmpty:'Your cart is empty.', sample:'Trade list item', remove:'Remove', added:'Added to cart', add:'Add to cart', qty:'Qty', selected:'Selected items', view:'Continue Order', emptyCart:'Empty cart', unit:'unit price', carton:'price per unit in full carton'}
  };
  const lang=()=> 'en';
  const L=()=>labels[lang()];
  const UI=()=>({sku:'SKU', brand:'Brand', category:'Category', unitPerCarton:'Unit / carton', warranty:'Warranty', availability:'Availability', toConfirm:'To be confirmed', unit:'unit price', carton:'price per unit in full carton', total:'Total', add:'Add to cart', brands:'Brands', loading:'Loading Secure Smart catalogue', loadingTail:'from approved brand lists…', loaded:'products loaded', loadedTail:'from Secure Smart approved brand lists.', noMatch:'No catalogue items matched', try:'Try SKU, brand, category or model family.', noFilter:'No catalogue items match the selected filters.', showMore:'Show more products'});
  const read=()=>{try{return JSON.parse(localStorage.getItem(key)||'[]')}catch(e){return []}};
  const clampQty=(value, fallback=0)=>{const n=parseInt(value,10); return Number.isFinite(n)&&n>=0?Math.min(n,999):fallback;};
  const normalizeQty=(value)=>{const n=parseInt(value,10); return Number.isFinite(n)&&n>0?Math.min(n,999):1;};
  const formatUsd=(value)=>{const n=Number(value)||0; const hasCents=Math.abs(n-Math.round(n))>0.001; return '$'+n.toLocaleString('en-US',{minimumFractionDigits:hasCents?2:0,maximumFractionDigits:hasCents?2:0});};
  const hasValidCartonSize=(value)=>{const n=Number(value); return Number.isFinite(n)&&n>1;};
  const normalizeText=(value)=>String(value||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
  const compactText=(value)=>normalizeText(value).replace(/\s+/g,'');
  const normalizeQuery=(value)=>normalizeText(value).replace(/\bu\s+(?=\d)/g,'u').replace(/\b([a-z])\s+(?=[a-z]?\d)/g,'$1');
  const fieldTokens=(value)=>normalizeText(value).split(' ').filter(Boolean);
  const compactField=(value)=>fieldTokens(value).join('');
  const isModelishQuery=(q)=>/[0-9-]/.test(q)||/^[a-z]+\d/.test(compactText(q));
  const tokenMatchesText=(field,token)=>{const words=fieldTokens(field); if(!token) return true; if(token.length<=3) return words.includes(token); return words.some(w=>w===token||w.startsWith(token));};
  const tokenMatchesSku=(field,token)=>{const words=fieldTokens(field); const compact=compactField(field); if(words.includes(token)) return true; if(token.length<=3) return words.includes(token); return words.some(w=>w===token||w.startsWith(token)) || compact.startsWith(token) || compact.includes(token);};
  const fieldMatchesQuery=(field,query,opts={})=>{const q=normalizeQuery(query); if(!q) return true; const tokens=q.split(' ').filter(Boolean); const compactQuery=compactText(q); const normalized=normalizeText(field); const compact=compactField(field); if(opts.compact&&compactQuery.length>=2&&(compact===compactQuery||compact.startsWith(compactQuery)||compact.includes(compactQuery))) return true; if(normalized===q||normalized.includes(q)) return true; const matcher=opts.sku?tokenMatchesSku:tokenMatchesText; return tokens.every(t=>matcher(field,t));};
  const productMatches=(p,query)=>{const q=normalizeQuery(query); if(!q) return true; const fields={sku:p.sku||'',title:p.title||'',brand:p.brand||'',category:p.category||'',specs:p.specsSearch||''}; const modelish=isModelishQuery(q); if(fieldMatchesQuery(fields.sku,q,{sku:true,compact:true})) return true; if(fieldMatchesQuery(fields.title,q,{compact:modelish})) return true; if(!modelish&&(fieldMatchesQuery(fields.brand,q)||fieldMatchesQuery(fields.category,q)||fieldMatchesQuery(fields.specs,q))) return true; if(modelish) return false; const tokens=q.split(' ').filter(Boolean); return tokens.every(t=>tokenMatchesSku(fields.sku,t)||tokenMatchesText(fields.title,t)||tokenMatchesText(fields.brand,t)||tokenMatchesText(fields.category,t)||tokenMatchesText(fields.specs,t));};
  const queryMatches=(haystack,query)=>fieldMatchesQuery(haystack,query,{compact:isModelishQuery(normalizeQuery(query))});
  const setCatalogQueryParam=(query)=>{const url=new URL(location.href); if(normalizeQuery(query)) url.searchParams.set('q',query.trim()); else url.searchParams.delete('q'); history.replaceState(null,url);};
  const escapeHtml=(s)=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeAttr=(s)=>escapeHtml(s).replace(/`/g,'&#96;');
  const customerVip=()=>window.SECURE_SMART_CATALOG_AUTH?.customer?.company?.is_vip?{label:window.SECURE_SMART_CATALOG_AUTH.customer.company.vip_label||'VIP'}:null;
  const vipBadge=()=>customerVip()?`<span class="ct-vip-price-badge">${escapeHtml(customerVip().label)} price</span>`:'';
  const readProductsFromBody=()=>{try{return JSON.parse(document.body?.dataset.catalogProducts||'[]')}catch(e){return []}};
  let liveProducts=[];
  let visibleProducts=[];
  let renderLimit=80;
  const CATALOG_INDEX_URL='assets/catalog-data/products.index.json';
  const CATALOG_FULL_FALLBACK_URL='assets/catalog-data/products.enriched.stage.json';
  const PRODUCT_DETAIL_MAP_URL='assets/catalog-data/product-detail-map.json';
  const catalogFetchCache={};
  const fetchJsonCached=(url)=>{
    const versionedUrl=url.includes('?')?url+'&v=20260518-router-category-fix':url+'?v=20260518-router-category-fix';
    if(!catalogFetchCache[url]) catalogFetchCache[url]=fetch(versionedUrl,{cache:'no-cache'}).then(res=>{ if(!res.ok) throw new Error('HTTP '+res.status); return res.json(); });
    return catalogFetchCache[url];
  };
  const brandSlug=(brand)=>normalizeText(brand);
  const CATALOG_TREE=[
    {slug:'smart-home',label:'Smart Home',children:[
      {slug:'lifesmart-products',label:'LifeSmart'},
      {slug:'smart-cameras-nvr',label:'Smart cameras / NVR'},
      {slug:'smart-door-access',label:'Door access / intercom'},
      {slug:'smart-sensors-control',label:'Sensors / control / IoT'},
      {slug:'smart-lighting-switches',label:'Lighting / switches / curtains'}
    ]},
    {slug:'lan-wifi',label:'LAN / WiFi',children:[
      {slug:'ubiquiti-networks',label:'Ubiquiti Networks'},
      {slug:'mikrotik',label:'MikroTik'},
      {slug:'switching',label:'Switches'},
      {slug:'routers-gateways',label:'Routers & gateways'},
      {slug:'wireless-access-points',label:'Wireless / Access Points'},
      {slug:'network-interfaces',label:'Network interfaces'},
      {slug:'network-accessories',label:'Network accessories'}
    ]},
    {slug:'optical-networks',label:'Optical Networks',children:[
      {slug:'gpon-fiber',label:'GPON / Fiber'},
      {slug:'sfp-qsfp-optics',label:'SFP / QSFP optics'},
      {slug:'fiber-accessories',label:'Fiber accessories'}
    ]},
    {slug:'cables-accessories',label:'Cables & Accessories',children:[
      {slug:'network-cables',label:'Network cables'},
      {slug:'connectors-patch',label:'Connectors / patch parts'},
      {slug:'mounting-enclosures',label:'Mounting / enclosures'},
      {slug:'general-accessories',label:'General accessories'}
    ]},
    {slug:'power-racks',label:'Power & Racks',children:[
      {slug:'racks-enclosures',label:'Racks / cabinets'},
      {slug:'power-supplies',label:'Power supplies'},
      {slug:'surge-protection',label:'Surge protection'}
    ]},
    {slug:'lte-industrial',label:'LTE / 5G / Industrial',children:[
      {slug:'lte-5g-routers',label:'LTE / 5G routers'},
      {slug:'industrial-gateways',label:'Industrial gateways'},
      {slug:'teltonika',label:'Teltonika'}
    ]}
  ];
  const productCategorySlugs=(p)=>{
    const brand=normalizeText(p.brand||'');
    const cat=normalizeText(p.category||'');
    const title=normalizeText(p.title||'');
    const sku=normalizeText(p.sku||'');
    const t=[brand,cat,title,sku].join(' ');
    const slugs=new Set();
    const add=(slug)=>{slugs.add(slug); const parent=CATALOG_TREE.find(g=>g.slug===slug||g.children.some(c=>c.slug===slug)); if(parent) slugs.add(parent.slug);};
    const pick=(slug)=>{add(slug); return [...slugs];};

    // Every product gets one primary family + one primary child only.
    // This keeps the visible sidebar counts aligned with the real 1,807-SKU catalogue
    // instead of counting the same SKU in several unrelated families.
    const isLifeSmart=/lifesmart|life smart|sublime|defed|coss|cololight/.test(t);
    if(isLifeSmart) return pick('lifesmart-products');

    const isIndustrialConnectivity=/industrial|rs232|rs485|modbus|m-bus|serial|din rail/.test(t);
    const isCellularConnectivity=/lte|\b5g\b|\b4g\b|\bcat ?[0-9]\b|catm|modem|cellular/.test(t);
    const isTeltonikaRouter=/teltonika/.test(brand)&&/router|gateway/.test(t);
    if(/teltonika/.test(brand)||isIndustrialConnectivity||isCellularConnectivity){
      if(isIndustrialConnectivity) return pick('industrial-gateways');
      if(isCellularConnectivity||isTeltonikaRouter) return pick('lte-5g-routers');
      return pick('teltonika');
    }

    const isSmartCamera=/camera|nvr|video recorder|uvc|protect|bullet|turret|dome|ptz|viewport|ai port|ai key/.test(t);
    const isSmartDoorAccess=/door access|doorbell|reader|intercom|access hub|ua-/.test(t);
    const isSmartSensorControl=/smart home|aqara|zigbee|matter|thread|sensor|motion|thermostat|relay|smart station|interaction center|smart control|iot controller/.test(t);
    const isSmartLighting=/smart lighting|smart light|light bulb|dimmer|curtain|blind|cololight/.test(t);
    const isHuaweiCollaboration=/huawei/.test(brand)&&/ideahub|idea hub|meeting|conference|smart screen|interactive whiteboard|touch|display|speaker|microphone|mic/.test(t);
    if(isSmartDoorAccess) return pick('smart-door-access');
    if(isSmartCamera) return pick('smart-cameras-nvr');
    if(isSmartLighting) return pick('smart-lighting-switches');
    if(isSmartSensorControl||isHuaweiCollaboration) return pick('smart-sensors-control');

    if(/huawei/.test(brand)||/gpon|xgs pon|xgs-pon|onu|ont|olt|fiber|fibre|optic|optical/.test(t)){
      if(/sfp|qsfp|optic|transceiver|dac|multi mode|single mode/.test(t)) return pick('sfp-qsfp-optics');
      if(/adapter|cable|patch|connector|coupler|spool/.test(t)) return pick('fiber-accessories');
      return pick('gpon-fiber');
    }

    const isAccessory=/accessor|accessory|mount|bracket|holder|rack mount|junction box|coupler|cover|kit|radome|shield|adapter|cable|patch|connector|keystone|spool/.test(t);
    if(isAccessory){
      if(/power supply|psu|power injector|poe injector|charger|battery|ups|surge|protector|grounding/.test(t)) return pick(/surge|protector|grounding/.test(t)?'surge-protection':'power-supplies');
      if(/cable|patch|cat6|cat5|connector|keystone|coupler|spool|patch panel/.test(t)) return pick(/connector|keystone|coupler|patch panel/.test(t)?'connectors-patch':'network-cables');
      if(/rack|cabinet|enclosure|rack mount/.test(t)) return pick('racks-enclosures');
      if(/mount|bracket|holder|junction box|radome|shield/.test(t)) return pick('mounting-enclosures');
      return pick('general-accessories');
    }

    if(/power supply|psu|power injector|poe injector|edgepower|charger|battery|ups|surge|protector|grounding/.test(t)) return pick(/surge|protector|grounding/.test(t)?'surge-protection':'power-supplies');
    if(/switch|aggregation|ethernet switch|cloud smart switch|crs[0-9]/.test(t)) return pick('switching');
    if(/router|gateway|dream machine|dream router|security gateway|firewall|ccr|hex|hap/.test(t)) return pick('routers-gateways');
    if(/wireless|wifi|wi fi|access point|ap|antenna|radio|bridge|60 ghz|5 ghz|2 4 ghz|airmax|ltu|wave/.test(t)) return pick('wireless-access-points');
    if(/interface|nic|sfp|qsfp|transceiver|module|dac|rj45/.test(t)) return pick('network-interfaces');
    if(/ubiquiti|unifi|uisp|airmax|airfiber|giga ?beam|edge(max|router|switch)/.test(t)) return pick('ubiquiti-networks');
    if(/mikrotik|routerboard|cloud router|cloud core|ccr|crs|hex|hap|l009|rb[0-9]/.test(t)) return pick('mikrotik');
    return pick('network-accessories');
  };
  const categorySlug=(p)=>productCategorySlugs(p).find(s=>!CATALOG_TREE.some(g=>g.slug===s))||'network-accessories';
  const productHaystack=(p)=>[p.brand,p.sku,p.title,p.category,p.specsSearch].filter(Boolean).join(' ');
  const searchScore=(p,query)=>{
    const q=normalizeQuery(query);
    if(!q) return 0;
    const sku=p.sku||''; const title=p.title||''; const brand=p.brand||''; const category=p.category||''; const specs=p.specsSearch||'';
    const ns=normalizeText(sku); const nt=normalizeText(title); const nb=normalizeText(brand); const nc=normalizeText(category); const nx=normalizeText(specs);
    const cq=compactText(q); const cs=compactField(sku); const ct=compactField(title);
    const tokens=q.split(' ').filter(Boolean);
    let score=0;
    if(ns===q) score+=1200;
    else if(cs===cq) score+=1150;
    else if(ns.startsWith(q)) score+=980;
    else if(cs.startsWith(cq)) score+=940;
    else if(cs.includes(cq)) score+=760;
    if(nt===q) score+=900;
    else if(nt.includes(q)) score+=760;
    else if(isModelishQuery(q)&&ct.includes(cq)) score+=720;
    if(nb===q) score+=300;
    if(nc===q||nc.includes(q)) score+=180;
    tokens.forEach(t=>{
      if(tokenMatchesSku(sku,t)) score+=90;
      if(tokenMatchesText(title,t)) score+=75;
      if(tokenMatchesText(brand,t)) score+=22;
      if(tokenMatchesText(category,t)) score+=16;
      if(tokenMatchesText(specs,t)) score+=10;
    });
    const accessoryQuery=/accessor|cover|mount|stand|bracket|rack|adapter/.test(q);
    if(!accessoryQuery && /^(uacc|b uacc)/.test(ns) && !(ns===q||cs===cq)) score-=70;
    if(!accessoryQuery && /cover|mount|stand|bracket|adapter/.test(nt) && !(nt.includes(q)||ct.includes(cq))) score-=50;
    return score;
  };
  const imageMarkup=(p)=>p.imageUrl?`<img alt="${safeAttr(p.title||p.sku||'Product image')}" loading="lazy" src="${safeAttr(p.imageUrl)}"/>`:`<span>${escapeHtml((p.brand||p.title||'S').trim().charAt(0)||'S')}</span>`;
  const productCard=(p)=>{
    const brand=p.brand||'Secure Smart'; const sku=p.sku||''; const title=p.title||sku||'Catalogue item'; const cat=p.category||'Catalogue'; const availability=p.availability||UI().toConfirm;
    const unit=Number(p.displayPriceUsd||0); const rawCarton=Number(p.fullCartonUnitPriceUsd||unit||0); const ui=UI(); const rawUnitPerCarton=p.unitPerCarton; const cartonSize=hasValidCartonSize(rawUnitPerCarton)?Number(rawUnitPerCarton):1; const hasCartonOption=p.cartonAvailable!==false && cartonSize>1; const carton=hasCartonOption?rawCarton:unit; const unitPerCarton=p.unitPerCarton||ui.toConfirm; const warranty=p.warranty||ui.toConfirm; const cslug=categorySlug(p); const bslug=brandSlug(brand);
    const href=`product-template.html?sku=${encodeURIComponent(sku)}`;
    const cartonOption=hasCartonOption?`<div class="ct-buy-option ct-carton-option"><div class="ct-buy-price-copy"><span class="ct-price-label">${ui.carton}</span>${vipBadge()}<b class="ct-price-amount" data-carton-price-display>${formatUsd(carton)}</b><span class="ct-vat-note">exc. VAT</span></div><div aria-label="Full carton quantity" class="ct-qty-stepper"><button aria-label="Increase full carton quantity" data-qty-step="1" data-qty-target="carton" type="button">+</button><input aria-label="Full carton quantity" data-carton-qty inputmode="numeric" min="0" type="number" value="0"/><button aria-label="Decrease full carton quantity" data-qty-step="-1" data-qty-target="carton" type="button">−</button></div></div>`:'';
    return `<article class="ct-product-card ct-product-row" data-brand="${safeAttr(bslug)}" data-brand-label="${safeAttr(brand)}" data-category="${safeAttr(cslug)}" data-name="${safeAttr(normalizeText(productHaystack(p)))}" data-sku="${safeAttr(sku)}" data-stock="${/in stock/i.test(availability)?'in':'review'}">
      <a class="ct-product-visual" href="${href}">${imageMarkup(p)}</a>
      <div class="ct-product-copy"><h2><a href="${href}">${escapeHtml(title)}</a></h2><dl><dt>${ui.sku}</dt><dd>${escapeHtml(sku||ui.toConfirm)}</dd><dt>${ui.brand}</dt><dd>${escapeHtml(brand)}</dd><dt>${ui.category}</dt><dd>${escapeHtml(cat)}</dd><dt>${ui.unitPerCarton}</dt><dd>${escapeHtml(unitPerCarton)}</dd><dt>${ui.warranty}</dt><dd>${escapeHtml(warranty)}</dd><dt>${ui.availability}</dt><dd>${escapeHtml(availability)}</dd></dl></div>
      <div class="ct-buy-column" data-buy-widget data-carton-price="${carton}" data-unit-price="${unit}" data-units-per-carton="${cartonSize}" data-carton-available="${hasCartonOption?'1':'0'}"><div class="ct-buy-option ct-unit-option"><div class="ct-buy-price-copy"><span class="ct-price-label">${ui.unit}</span>${vipBadge()}<b class="ct-price-amount" data-unit-price-display>${formatUsd(unit)}</b><span class="ct-vat-note">exc. VAT</span></div><div aria-label="Unit quantity" class="ct-qty-stepper"><button aria-label="Increase unit quantity" data-qty-step="1" data-qty-target="unit" type="button">+</button><input aria-label="Unit quantity" data-unit-qty inputmode="numeric" min="0" type="number" value="1"/><button aria-label="Decrease unit quantity" data-qty-step="-1" data-qty-target="unit" type="button">−</button></div></div>${cartonOption}<div class="ct-buy-total">${ui.total}: <strong data-price-total>${formatUsd(unit)}</strong></div><button data-add-cart data-brand="${safeAttr(brand)}" data-carton-price="${carton}" data-name="${safeAttr(title)}" data-sku="${safeAttr(sku)}" data-unit-price="${unit}" type="button">${ui.add}</button></div>
    </article>`;
  };
  const ensureCatalogEmptyState=()=>{let empty=document.getElementById('catalogEmptyState'); const grid=document.getElementById('productGrid'); if(!empty&&grid){empty=document.createElement('div'); empty.id='catalogEmptyState'; empty.className='ct-empty-state'; empty.hidden=true; empty.setAttribute('aria-live','polite'); grid.insertAdjacentElement('afterend',empty);} return empty;};
  const ensureLoadMore=()=>{let btn=document.getElementById('catalogLoadMore'); const grid=document.getElementById('productGrid'); if(!btn&&grid){btn=document.createElement('button'); btn.id='catalogLoadMore'; btn.className='ct-load-more'; btn.type='button'; btn.addEventListener('click',()=>{renderLimit+=80; renderProductGrid();}); grid.insertAdjacentElement('afterend',btn);} return btn;};
  const ensureViewControls=()=>{const toolbar=document.querySelector('.ct-toolbar'); const grid=document.getElementById('productGrid'); if(!toolbar||!grid||toolbar.querySelector('[data-catalog-view]')) return; const wrap=document.createElement('div'); wrap.className='ct-view-toggle'; wrap.setAttribute('aria-label','Catalogue view mode'); const modes=[['list','Current'],['grid','Squares'],['compact','List']]; wrap.innerHTML=modes.map(([mode,label])=>`<button type="button" data-catalog-view="${mode}">${label}</button>`).join(''); toolbar.appendChild(wrap); wrap.addEventListener('click',(event)=>{const btn=event.target.closest('[data-catalog-view]'); if(!btn) return; localStorage.setItem('secureSmartCatalogView',btn.dataset.catalogView); applyViewMode();}); applyViewMode();};
  const applyViewMode=()=>{const grid=document.getElementById('productGrid'); if(!grid) return; const mode=['grid','compact'].includes(localStorage.getItem('secureSmartCatalogView'))?localStorage.getItem('secureSmartCatalogView'):'list'; grid.dataset.view=mode; document.querySelectorAll('[data-catalog-view]').forEach(btn=>btn.classList.toggle('is-active',btn.dataset.catalogView===mode));};
  const updateSidebarFilters=(products)=>{const root=document.querySelector('.ct-filter-block'); if(!root||root.dataset.liveReady) return; const brandCounts=new Map(); const categoryCounts=new Map(); products.forEach(p=>{const b=p.brand||'Other'; brandCounts.set(b,(brandCounts.get(b)||0)+1); productCategorySlugs(p).forEach(c=>categoryCounts.set(c,(categoryCounts.get(c)||0)+1));}); const order=['LifeSmart','Ubiquiti','MikroTik','Teltonika','Huawei','RF elements']; const brands=[...brandCounts.keys()].sort((a,b)=>{const ia=order.findIndex(x=>normalizeText(x)===normalizeText(a)); const ib=order.findIndex(x=>normalizeText(x)===normalizeText(b)); return (ia<0?99:ia)-(ib<0?99:ib)||a.localeCompare(b);}); const tree=CATALOG_TREE.map((group,idx)=>{const children=group.children.filter(c=>(categoryCounts.get(c.slug)||0)>0).map(c=>`<label class="ct-tree-leaf"><input data-category-filter type="checkbox" value="${safeAttr(c.slug)}"/> <span>${escapeHtml(c.label)}</span><small class="ct-filter-count">${categoryCounts.get(c.slug)||0}</small></label>`).join(''); if(!children) return ''; return `<details class="ct-cat-tree-group" ${idx<2?'open':''}><summary><span class="ct-cat-toggle" aria-hidden="true"></span><b>${escapeHtml(group.label)}</b><small>${categoryCounts.get(group.slug)||0}</small></summary><div class="ct-cat-tree-children">${children}</div></details>`;}).join(''); root.innerHTML=`<div class="ct-filter-section ct-m2k-tree"><h3>Products</h3><p class="ct-filter-help">Choose a product family first, then decide by brand.</p>${tree}</div><div class="ct-filter-section"><h3>${UI().brands}</h3>${brands.map(b=>`<label><input data-brand-filter type="checkbox" value="${safeAttr(brandSlug(b))}"/> ${escapeHtml(b)} <small class="ct-filter-count">${brandCounts.get(b)}</small></label>`).join('')}</div>`; root.dataset.liveReady='1'; root.querySelectorAll('[data-brand-filter],[data-category-filter]').forEach(i=>i.addEventListener('change',filterCatalog));};
  const renderProductGrid=()=>{const grid=document.getElementById('productGrid'); if(!grid) return; ensureViewControls(); applyViewMode(); const slice=visibleProducts.slice(0,renderLimit); grid.innerHTML=slice.map(productCard).join(''); applyViewMode(); const btn=ensureLoadMore(); if(btn){btn.hidden=visibleProducts.length<=renderLimit; btn.textContent=`${UI().showMore} (${Math.min(renderLimit,visibleProducts.length)} / ${visibleProducts.length})`;}
    refreshAllPriceWidgets(); updateCartUI(); };
  function filterCatalog(){
    const input=document.getElementById('catalogSearch'); const rawQuery=(input?.value||'').trim(); const activeEl=document.querySelector('.ct-filter-chip.is-active, .ct-category-strip [data-filter].is-active'); const active=activeEl?.dataset.filter||'all'; const inStock=document.getElementById('inStockOnly')?.checked; const brands=[...document.querySelectorAll('[data-brand-filter]:checked')].map(i=>normalizeText(i.value)); const categories=[...document.querySelectorAll('[data-category-filter]:checked')].map(i=>i.value);
    const source=liveProducts.length?liveProducts:[...document.querySelectorAll('.ct-product-card')];
    if(liveProducts.length){
      visibleProducts=liveProducts.filter(p=>{const pCategories=productCategorySlugs(p); const hasSearch=!!normalizeText(rawQuery); const okCat=hasSearch||((active==='all'||pCategories.includes(active)) && (!categories.length||categories.some(c=>pCategories.includes(c)))); const okText=productMatches(p,rawQuery); const okStock=!inStock||/in stock/i.test(p.availability||''); const okBrand=!brands.length||brands.includes(brandSlug(p.brand||'')); return okCat&&okText&&okStock&&okBrand;}); if(normalizeText(rawQuery)){visibleProducts=visibleProducts.map((p,i)=>({p,i,s:searchScore(p,rawQuery)})).sort((a,b)=>b.s-a.s||a.i-b.i).map(x=>x.p);}
      renderLimit=80; renderProductGrid();
      const rc=document.getElementById('resultCount'); if(rc){const shownNow=Math.min(renderLimit,visibleProducts.length); rc.textContent=shownNow+' / '+visibleProducts.length+' '+L().items;}
    } else {
      let shown=0; source.forEach(card=>{const haystack=[card.dataset.name,card.dataset.sku,card.dataset.brand,card.dataset.category,card.querySelector('[data-add-cart]')?.dataset.sku,card.querySelector('h2')?.textContent,card.textContent].filter(Boolean).join(' '); const okCat=(active==='all'||card.dataset.category===active) && (!categories.length||categories.includes(card.dataset.category)); const okText=queryMatches(haystack,rawQuery); const okStock=!inStock||card.dataset.stock==='in'; const okBrand=!brands.length||brands.includes(normalizeText(card.dataset.brand)); const show=okCat&&okText&&okStock&&okBrand; card.hidden=!show; card.style.setProperty('display',show?'':'none',show?'':'important'); if(show) shown++;}); const rc=document.getElementById('resultCount'); if(rc) rc.textContent=shown+' '+L().items; visibleProducts=[];
    }
    const empty=ensureCatalogEmptyState(); const shown=liveProducts.length?visibleProducts.length:[...document.querySelectorAll('.ct-product-card')].filter(c=>!c.hidden).length; if(empty){empty.hidden=shown>0; { const ui=UI(); empty.textContent=shown>0?'':(rawQuery?`${ui.noMatch} "${rawQuery}". ${ui.try}`:ui.noFilter); }}
    document.getElementById('productGrid')?.classList.toggle('is-filtered',!!normalizeText(rawQuery)||active!=='all'||!!inStock||brands.length>0||categories.length>0);
  }
  async function loadLiveCatalog(){
    const grid=document.getElementById('productGrid'); if(!grid||!document.querySelector('[data-page="catalog"]')) return;
    const status=document.createElement('div'); status.className='ct-catalog-status'; { const ui=UI(); status.innerHTML=`<strong>${ui.loading}</strong> ${ui.loadingTail}`; } grid.before(status);
    try{
      const data=await fetchJsonCached(CATALOG_INDEX_URL).catch(()=>fetchJsonCached(CATALOG_FULL_FALLBACK_URL)); liveProducts=data.filter(p=>p&&p.title).map(p=>({brand:p.brand,sku:p.sku,title:p.title,category:p.category,availability:p.availability,unitPerCarton:p.unitPerCarton,warranty:p.warranty,displayPriceUsd:p.displayPriceUsd,fullCartonUnitPriceUsd:p.fullCartonUnitPriceUsd,imageUrl:p.imageUrl,cartonAvailable:p.cartonAvailable,detailPath:p.detailPath,specsSearch:p.specsSearch}));
      updateSidebarFilters(liveProducts); visibleProducts=liveProducts; { const ui=UI(); status.innerHTML=`<strong>${liveProducts.length.toLocaleString('en-US')} ${ui.loaded}</strong> ${ui.loadedTail}`; } filterCatalog();
    }catch(err){status.innerHTML='<strong>Catalogue data could not load.</strong> Showing the static fallback list.'; filterCatalog();}
  }
  const knownPriceIndex=()=>{const map={}; document.querySelectorAll('[data-add-cart][data-sku]').forEach(btn=>{const sku=btn.dataset.sku||''; if(!sku) return; map[sku]={unit:Number(btn.dataset.unitPrice||0),carton:Number(btn.dataset.cartonPrice||btn.dataset.unitPrice||0),name:btn.dataset.name||'',brand:btn.dataset.brand||''};}); return map;};
  const ensurePriced=(items,persist=false)=>{const map=knownPriceIndex(); let changed=false; items.forEach(item=>{const known=map[item.sku]; if(!known) return; const mode=item.mode==='carton'?'carton':'unit'; const price=Number(mode==='carton'?known.carton:known.unit)||0; const qty=Number(item.qty)||0; if(price && (Number(item.unitPrice)!==price || Number(item.lineTotal)!==qty*price)){item.unitPrice=price; item.lineTotal=qty*price; item.note=mode==='carton'?'price per unit in full carton':'unit price'; changed=true;} if(!item.brand && known.brand){item.brand=known.brand; changed=true;} if((!item.name || item.name==='Catalog item') && known.name){item.name=known.name; changed=true;}}); if(changed&&persist) localStorage.setItem(key,JSON.stringify(items)); return items;};
  const itemLineTotal=(item)=>Number(item.lineTotal)||((Number(item.unitPrice)||0)*(Number(item.qty)||0)); const cartTotal=(items=read())=>items.reduce((sum,item)=>sum+itemLineTotal(item),0); const buyScopeFor=(el)=>el.closest('[data-buy-widget],.ct-buy-column,.ct-card-actions,.ct-actions,.ct-related,.ct-product-card,.ct-detail-info')||document; const buyWidgetFor=(el)=>{const scope=buyScopeFor(el); return scope.matches?.('[data-buy-widget]')?scope:scope.querySelector?.('[data-buy-widget]');}; const currentSelection=(widget)=>{const unitPrice=Number(widget?.dataset.unitPrice||0); const cartonPrice=Number(widget?.dataset.cartonPrice||unitPrice); const requestedUnits=clampQty(widget?.querySelector('[data-unit-qty]')?.value,0); const manualCartons=clampQty(widget?.querySelector('[data-carton-qty]')?.value,0); const unitsPerCarton=hasValidCartonSize(widget?.dataset.unitsPerCarton)?Number(widget.dataset.unitsPerCarton):1; const autoCartons=unitsPerCarton>1?Math.floor(requestedUnits/unitsPerCarton):0; const remainderUnits=unitsPerCarton>1?requestedUnits%unitsPerCarton:requestedUnits; const cartonQty=autoCartons+manualCartons; const cartonUnits=cartonQty*unitsPerCarton; const unitQty=remainderUnits; const total=(unitQty*unitPrice)+(cartonUnits*cartonPrice); return {unitPrice,cartonPrice,requestedUnits,unitQty,manualCartons,autoCartons,cartonQty,unitsPerCarton,cartonUnits,total};};
  const selectionBreakdown=(sel)=>{const parts=[]; if(sel.cartonQty>0) parts.push(`${sel.cartonQty} carton${sel.cartonQty===1?'':'s'} (${sel.cartonUnits} units) at carton unit price`); if(sel.unitQty>0) parts.push(`${sel.unitQty} unit${sel.unitQty===1?'':'s'} at unit price`); return parts.join(' + ');};
  const refreshPriceWidget=(scope)=>{const widget=buyWidgetFor(scope); if(!widget) return; const sel=currentSelection(widget); const unitDisplay=widget.querySelector('[data-unit-price-display]'); if(unitDisplay) unitDisplay.textContent=formatUsd(sel.unitPrice); const cartonDisplay=widget.querySelector('[data-carton-price-display]'); if(cartonDisplay) cartonDisplay.textContent=formatUsd(sel.cartonPrice); const target=widget.querySelector('[data-price-total]'); if(target) target.textContent=formatUsd(sel.total); const card=widget.closest('.ct-product-card,.ct-detail-info'); const breakdowns=[...widget.querySelectorAll('[data-price-breakdown]'), ...(card?[...card.querySelectorAll('[data-price-breakdown]')]:[])]; if(breakdowns.length){const text=selectionBreakdown(sel); breakdowns.forEach(breakdown=>{breakdown.textContent=text; breakdown.hidden=!text;});} widget.classList.toggle('has-carton-qty',sel.cartonQty>0); widget.classList.toggle('has-unit-qty',sel.unitQty>0);}; const refreshAllPriceWidgets=()=>document.querySelectorAll('[data-buy-widget]').forEach(refreshPriceWidget); const totalCount=(items=read())=>items.reduce((n,i)=>n+(Number(i.qty)||0),0); const write=(items)=>{items=ensurePriced(items); localStorage.setItem(key,JSON.stringify(items)); updateCartUI(); renderCart();};
  const addItem=(items,item)=>{if(!item.qty) return; const found=items.find(i=>i.sku===item.sku && i.name===item.name && i.mode===item.mode); if(found){found.qty+=item.qty; found.lineTotal=itemLineTotal(found)+(Number(item.lineTotal)||0);} else items.push(item);};
  const add=(btn,qty=1)=>{const name=btn.dataset.name||'Catalog item'; const sku=btn.dataset.sku||'SKU'; const brand=btn.dataset.brand||''; const widget=buyWidgetFor(btn); const items=read(); let added=0; if(widget){refreshPriceWidget(widget); const sel=currentSelection(widget); addItem(items,{name,sku,brand,qty:sel.unitQty,mode:'unit',unitPrice:sel.unitPrice,lineTotal:sel.unitQty*sel.unitPrice,note:'unit price'}); addItem(items,{name,sku,brand,qty:sel.cartonUnits,mode:'carton',unitPrice:sel.cartonPrice,lineTotal:sel.cartonUnits*sel.cartonPrice,note:'price per unit in full carton',packSize:sel.unitsPerCarton,cartons:sel.cartonQty}); added=sel.unitQty+sel.cartonUnits;} else {const amount=normalizeQty(qty); const unitPrice=Number(btn.dataset.unitPrice||0); addItem(items,{name,sku,brand,qty:amount,mode:'unit',unitPrice,lineTotal:amount*unitPrice,note:unitPrice?'unit price':L().sample}); added=amount;} if(added<1){addItem(items,{name,sku,brand,qty:1,mode:'unit',unitPrice:Number(btn.dataset.unitPrice||0),lineTotal:Number(btn.dataset.unitPrice||0),note:'unit price'}); added=1;} write(items); document.dispatchEvent(new CustomEvent('ss-cart-added',{detail:{name,qty:added}}));};
  const updateCartUI=()=>{const items=ensurePriced(read(),true); const count=totalCount(items); const total=cartTotal(items); document.querySelectorAll('[data-cart-count]').forEach(el=>el.textContent=String(count)); document.querySelectorAll('[data-cart-total]').forEach(el=>el.textContent=formatUsd(total)); renderMiniCarts(items);};
  const priceNote=(item)=>item.unitPrice?` · ${formatUsd(item.unitPrice)} × ${item.qty}`:''; const cartRow=(item,i,ll)=>`<div class="ct-mini-row" data-mini-row="${i}"><div class="ct-mini-thumb" aria-hidden="true">${escapeHtml((item.brand||item.name||'S').trim().charAt(0)||'S')}</div><div class="ct-mini-main"><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.sku||'')} · ${escapeHtml(item.note||ll.sample)}${escapeHtml(priceNote(item))}</small></div><div class="ct-mini-qty" aria-label="${ll.qty}"><button type="button" data-mini-dec="${i}" aria-label="Decrease quantity">−</button><input aria-label="${ll.qty}" data-mini-qty="${i}" inputmode="numeric" min="1" type="number" value="${Number(item.qty)||1}"/><button type="button" data-mini-inc="${i}" aria-label="Increase quantity">+</button></div><strong class="ct-mini-price">${formatUsd(itemLineTotal(item))}</strong><button class="ct-mini-remove" type="button" data-mini-remove="${i}" aria-label="${ll.remove}">×</button></div>`;
  const renderMiniCarts=(items=read())=>{const ll=L(); document.querySelectorAll('.ct-cart-popover-head strong').forEach(el=>el.textContent=ll.selected); document.querySelectorAll('.ct-cart-popover-foot [data-empty-cart]').forEach(el=>el.textContent=ll.emptyCart); document.querySelectorAll('.ct-cart-popover-foot a').forEach(el=>el.textContent=ll.view); document.querySelectorAll('[data-cart-mini-list]').forEach(root=>{ if(root.contains(document.activeElement)) document.activeElement.blur(); if(!items.length){root.innerHTML=`<div class="ct-mini-empty">${ll.miniEmpty}</div>`; return;} root.innerHTML=items.map((item,i)=>cartRow(item,i,ll)).join(''); }); document.querySelectorAll('[data-cart-popover]').forEach(pop=>pop.classList.toggle('has-items',items.length>0));};
  const renderCart=()=>{const root=document.getElementById('cartList'); if(!root) return; if(root.contains(document.activeElement)) document.activeElement.blur(); const ll=L(); const items=ensurePriced(read(),true); if(!items.length){root.innerHTML=`<div class="ct-empty">${ll.empty}</div>`; return;} root.innerHTML=items.map((item,i)=>`<div class="ct-cart-row"><div><b>${escapeHtml(item.name)}</b><small>${escapeHtml(item.brand||'')} · ${escapeHtml(item.sku||'')} · ${escapeHtml(item.note||ll.sample)}${escapeHtml(priceNote(item))}${itemLineTotal(item)?` · Total ${escapeHtml(formatUsd(itemLineTotal(item)))}`:''}</small></div><div class="ct-qty"><button type="button" data-dec="${i}">−</button><input aria-label="${ll.qty}" data-cart-qty="${i}" inputmode="numeric" min="1" type="number" value="${Number(item.qty)||1}"/><button type="button" data-inc="${i}">+</button></div><button class="ct-remove" type="button" data-remove="${i}">${ll.remove}</button></div>`).join('');};
  const setQty=(idx,value)=>{const items=read(); const item=items[idx]; if(!item) return; let next=normalizeQty(value); if(item.mode==='carton'&&hasValidCartonSize(item.packSize)){const pack=Number(item.packSize); next=Math.max(pack,Math.ceil(next/pack)*pack); item.cartons=next/pack;} item.qty=next; if(item.unitPrice) item.lineTotal=item.qty*Number(item.unitPrice); write(items);};
  const addQtyFor=(btn)=>{const scope=btn.closest('.ct-card-actions,.ct-actions,.ct-related,.ct-product-card,.ct-detail-info,.ct-buy-column')||document; return normalizeQty(scope.querySelector('[data-add-qty]')?.value||1);}; const changeQty=(idx,delta)=>{const items=read(); const item=items[idx]; if(!item) return; const step=item.mode==='carton'&&hasValidCartonSize(item.packSize)?Number(item.packSize):1; item.qty=(Number(item.qty)||0)+(delta*step); if(item.qty<1) items.splice(idx,1); else { if(item.mode==='carton'&&step>1) item.cartons=item.qty/step; if(item.unitPrice) item.lineTotal=item.qty*Number(item.unitPrice); } write(items);};
  document.addEventListener('click',e=>{const docPlaceholder=e.target.closest('[data-doc-placeholder]'); if(docPlaceholder){e.preventDefault(); return;} const step=e.target.closest('[data-qty-step]'); if(step){const widget=buyWidgetFor(step); const type=step.dataset.qtyTarget||'unit'; const input=widget?.querySelector(type==='carton'?'[data-carton-qty]':'[data-unit-qty]'); if(input){input.value=String(clampQty(input.value,0)+Number(step.dataset.qtyStep||0)); if(Number(input.value)<0) input.value='0'; refreshPriceWidget(widget);} return;} const addBtn=e.target.closest('[data-add-cart]'); if(addBtn){const qty=addQtyFor(addBtn); add(addBtn,qty); const old=addBtn.textContent; addBtn.textContent=L().added; setTimeout(()=>{addBtn.textContent=old||L().add},900);} const miniInc=e.target.closest('[data-mini-inc]'); if(miniInc){changeQty(+miniInc.dataset.miniInc,1); return;} const miniDec=e.target.closest('[data-mini-dec]'); if(miniDec){changeQty(+miniDec.dataset.miniDec,-1); return;} const miniRem=e.target.closest('[data-mini-remove]'); if(miniRem){const items=read(); items.splice(+miniRem.dataset.miniRemove,1); write(items); return;} const empty=e.target.closest('[data-empty-cart]'); if(empty){write([]); return;} const inc=e.target.closest('[data-inc]'); if(inc){changeQty(+inc.dataset.inc,1);} const dec=e.target.closest('[data-dec]'); if(dec){changeQty(+dec.dataset.dec,-1);} const rem=e.target.closest('[data-remove]'); if(rem){const items=read(); items.splice(+rem.dataset.remove,1); write(items);} const chip=e.target.closest('[data-filter]'); if(chip){document.querySelectorAll('.ct-filter-chip,.ct-category-strip [data-filter]').forEach(c=>c.classList.remove('is-active')); chip.classList.add('is-active'); filterCatalog();}});
  document.querySelectorAll('.ct-cart-mini-header-style').forEach(cart=>{let closeTimer; const open=()=>{clearTimeout(closeTimer); cart.classList.add('is-open');}; const close=()=>{clearTimeout(closeTimer); closeTimer=setTimeout(()=>cart.classList.remove('is-open'),220);}; cart.addEventListener('mouseenter',open); cart.addEventListener('mouseleave',close); cart.addEventListener('focusin',open); cart.addEventListener('focusout',close);});
  document.addEventListener('input',e=>{if(e.target.matches('[data-unit-qty],[data-carton-qty],[data-add-qty]')) refreshPriceWidget(e.target);});
  document.addEventListener('change',e=>{if(e.target.matches('[data-cart-qty]')) setQty(+e.target.dataset.cartQty,e.target.value); if(e.target.matches('[data-mini-qty]')) setQty(+e.target.dataset.miniQty,e.target.value);});
  const initialCatalogQuery=new URLSearchParams(location.search).get('q')||''; const catalogSearchInput=document.getElementById('catalogSearch'); if(catalogSearchInput&&initialCatalogQuery) catalogSearchInput.value=initialCatalogQuery;
  catalogSearchInput?.addEventListener('input',()=>{filterCatalog(); setCatalogQueryParam(catalogSearchInput.value||'');}); document.querySelectorAll('[data-search-submit],[data-clear-search]').forEach(btn=>btn.addEventListener('click',()=>{const i=document.getElementById('catalogSearch'); filterCatalog(); setCatalogQueryParam(i?.value||''); i?.focus();})); catalogSearchInput?.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); filterCatalog(); setCatalogQueryParam(catalogSearchInput.value||'');}});
  document.getElementById('inStockOnly')?.addEventListener('change',filterCatalog); document.getElementById('sortProducts')?.addEventListener('change',filterCatalog); window.addEventListener('storage',e=>{if(e.key===key){updateCartUI(); renderCart();}}); window.addEventListener('pageshow',()=>{updateCartUI(); renderCart(); refreshAllPriceWidgets();});

  const documentLinksFor=(p)=>{
    const docs=Array.isArray(p.documents)?p.documents.filter(d=>d&&d.url).map(d=>({label:d.title||d.type||'Datasheet / document',url:d.url,verified:true})):[];
    if(docs.length) return docs;
    const sku=encodeURIComponent(p.sku||''); const brand=normalizeText(p.brand||''); const q=encodeURIComponent([p.brand,p.sku,'datasheet'].filter(Boolean).join(' '));
    const links=[];
    if(/ubiquiti|ui/.test(brand)) links.push({label:'Official Ubiquiti tech specs / datasheet search',url:`https://techspecs.ui.com/?q=${sku}`});
    else if(/mikrotik/.test(brand)) links.push({label:'Official MikroTik product / datasheet search',url:`https://mikrotik.com/products?filter&s=${sku}`});
    else if(/teltonika/.test(brand)) links.push({label:'Official Teltonika Networks product / datasheet search',url:`https://teltonika-networks.com/search/?q=${sku}`});
    else if(/rf elements/.test(brand)) links.push({label:'Official RF elements product / datasheet search',url:`https://rfelements.com/search?query=${sku}`});
    else if(/lifesmart|life smart/.test(brand)) links.push({label:'Official LifeSmart product search',url:`https://iot.ilifesmart.com/search?keyword=${sku}`});
    else if(/aqara/.test(brand)) links.push({label:'Official Aqara English product search',url:`https://www.aqara.com/en/search?keyword=${sku}`});
    else if(/huawei/.test(brand)) links.push({label:'Official Huawei Enterprise English search',url:`https://e.huawei.com/en/searchresult?keyword=${sku}`});
    if(!links.length) links.push({label:'Official English datasheet search',url:`https://www.google.com/search?q=${q}`});
    return links;
  };
  const productImageDetail=(p)=>p.imageUrl?`<img alt="${safeAttr(p.title||p.sku||'Product image')}" loading="lazy" src="${safeAttr(p.imageUrl)}"/>`:`<div class="ct-image-fallback"><span>${escapeHtml((p.brand||p.title||'S').trim().charAt(0)||'S')}</span><small>No product image yet</small></div>`;
  const formatCm=(v)=>v===0||v?escapeHtml(v):UI().toConfirm;
  const shippingDimensionSection=(p)=>{const s=p.shippingDimensions; if(!s||!s.unit) return ''; const unit=s.unit||{}; const carton=s.carton||{}; const unitDims=[unit.lengthCm,unit.widthCm,unit.heightCm].every(v=>v===0||v)?`${formatCm(unit.lengthCm)} × ${formatCm(unit.widthCm)} × ${formatCm(unit.heightCm)} cm`:UI().toConfirm; const cartonDims=[carton.lengthCm,carton.widthCm,carton.heightCm].every(v=>v===0||v)?`${formatCm(carton.lengthCm)} × ${formatCm(carton.widthCm)} × ${formatCm(carton.heightCm)} cm`:UI().toConfirm; return `<section><h3>Shipping dimensions</h3><dl><dt>1pc dimensions</dt><dd>${unitDims}</dd><dt>1pc volume</dt><dd>${formatCm(unit.volumeCm3)} cm³</dd><dt>1pc weight</dt><dd>${formatCm(unit.weightKg)} kg</dd><dt>PCs per carton</dt><dd>${formatCm(carton.pcsPerCarton)}</dd><dt>Carton dimensions</dt><dd>${cartonDims}</dd><dt>Carton volume</dt><dd>${formatCm(carton.volumeCm3)} cm³</dd><dt>Carton weight</dt><dd>${formatCm(carton.weightKg)} kg</dd></dl></section>`;};
  const renderProductDetail=(p)=>{
    const brand=p.brand||'Secure Smart'; const sku=p.sku||''; const title=p.title||sku||'Catalogue item'; const cat=p.category||'Catalogue'; const availability=p.availability||UI().toConfirm; const unit=Number(p.displayPriceUsd||0); const rawCarton=Number(p.fullCartonUnitPriceUsd||unit||0); const hasCartonOption=p.cartonAvailable!==false && Number(p.unitPerCarton)>1; const carton=hasCartonOption?rawCarton:unit; const warranty=p.warranty||UI().toConfirm; const unitPerCarton=p.unitPerCarton||UI().toConfirm; const desc=(p.description&&p.description!=='Catalogue information under review')?p.description:'Full technical description is being completed from official English product data.';
    document.title=`${title} | Secure Smart`;
    const crumb=document.querySelector('.ct-breadcrumb'); if(crumb) crumb.innerHTML=`<a href="catalog-template.html">Catalog</a><span>/</span><span>${escapeHtml(brand)}</span><span>/</span><span>${escapeHtml(sku)}</span>`;
    const img=document.querySelector('.ct-main-image'); if(img) img.innerHTML=productImageDetail(p);
    const info=document.querySelector('.ct-detail-info');
    if(info){ const h1=info.querySelector('h1'); if(h1) h1.textContent=title; const lead=info.querySelector('.ct-lead'); if(lead) lead.textContent=desc.length>260?desc.slice(0,257)+'…':desc; const meta=info.querySelector('.ct-meta-grid'); const warrantyClass=/\b24\s*months?\b/i.test(warranty)?' class="ct-warranty-highlight"':''; if(meta) meta.innerHTML=`<div><span>Brand</span><b>${escapeHtml(brand)}</b></div><div><span>SKU</span><b>${escapeHtml(sku)}</b></div><div><span>Category</span><b>${escapeHtml(cat)}</b></div><div><span>Availability</span><b>${escapeHtml(availability)}</b></div><div${warrantyClass}><span>Warranty</span><b>${escapeHtml(warranty)}</b></div><div><span>Unit / carton</span><b>${escapeHtml(unitPerCarton)}</b></div>`; }
    const widget=document.querySelector('.ct-detail-buy-column'); if(widget){ widget.classList.toggle('is-vip-priced', Boolean(customerVip())); widget.dataset.unitPrice=String(unit); widget.dataset.cartonPrice=String(carton); widget.dataset.unitsPerCarton=String(hasCartonOption?Number(p.unitPerCarton):1); widget.dataset.cartonAvailable=hasCartonOption?'1':'0'; const unitD=widget.querySelector('[data-unit-price-display]'); if(unitD) unitD.textContent=formatUsd(unit); const cartonD=widget.querySelector('[data-carton-price-display]'); if(cartonD) cartonD.textContent=formatUsd(carton); const cartonOption=widget.querySelector('.ct-carton-option'); if(cartonOption) cartonOption.hidden=!hasCartonOption; const add=widget.querySelector('[data-add-cart]'); if(add){ add.dataset.name=title; add.dataset.sku=sku; add.dataset.brand=brand; add.dataset.unitPrice=String(unit); add.dataset.cartonPrice=String(carton); } refreshPriceWidget(widget); }
    const descBody=document.querySelector('.ct-description-layout > div'); if(descBody) descBody.innerHTML=`<p>${escapeHtml(desc)}</p><h3>Catalogue identity</h3><ul><li>Brand: ${escapeHtml(brand)}</li><li>SKU / model: ${escapeHtml(sku)}</li><li>Category: ${escapeHtml(cat)}</li><li>Availability: ${escapeHtml(availability)}</li></ul><p class="ct-download-note">Secure Smart keeps the commercial quote flow separate from technical documents. Use the document section below for official English datasheets and manufacturer product lookups.</p>`;
    const params=document.querySelector('.ct-parameters-grid'); if(params) params.innerHTML=`<section><h3>Commercial catalogue data</h3><dl><dt>SKU</dt><dd>${escapeHtml(sku||UI().toConfirm)}</dd><dt>Brand</dt><dd>${escapeHtml(brand)}</dd><dt>Warranty</dt><dd>${escapeHtml(warranty)}</dd><dt>Unit / carton</dt><dd>${escapeHtml(unitPerCarton)}</dd></dl></section>${shippingDimensionSection(p)}<section><h3>Technical data status</h3><dl><dt>Datasheet language</dt><dd>English sources preferred</dd><dt>Document status</dt><dd>Official manufacturer data and verified public technical documents</dd><dt>Review status</dt><dd>${escapeHtml(p.enrichmentStatus||'Catalogue data under review')}</dd></dl></section>`;
    const downloads=document.querySelector('.ct-download-actions'); const note=document.querySelector('.ct-product-panel:last-child .ct-download-note'); const links=documentLinksFor(p); if(note) note.textContent=links.some(l=>l.verified)?'Verified document links from the product data import.':'No verified direct datasheet is stored yet for this SKU. These buttons open English official manufacturer lookups for the exact product model.'; if(downloads) downloads.innerHTML=links.map(l=>`<a href="${safeAttr(l.url)}" target="_blank" rel="noopener">${escapeHtml(l.label)}</a>`).join('');
  };
  async function loadProductDetail(){
    if(!document.querySelector('[data-page="product"]')) return;
    const params=new URLSearchParams(location.search); const sku=params.get('sku')||params.get('id')||'';
    if(!sku) return;
    try{
      const wanted=decodeURIComponent(sku).toLowerCase();
      const map=await fetchJsonCached(PRODUCT_DETAIL_MAP_URL);
      const detailPath=map[wanted];
      if(!detailPath) throw new Error('detail_not_indexed');
      const p=await fetchJsonCached(detailPath);
      if(!p) throw new Error('detail_empty');
      renderProductDetail(p);
    } catch(err){
      try{
        const data=await fetchJsonCached(CATALOG_FULL_FALLBACK_URL);
        const wanted=decodeURIComponent(sku).toLowerCase();
        const p=data.find(item=>String(item.sku||'').toLowerCase()===wanted)||data.find(item=>String(item.id||'').toLowerCase()===wanted);
        if(!p) throw new Error('not_found');
        renderProductDetail(p);
      } catch(fallbackErr){
        const lead=document.querySelector('.ct-lead');
        if(lead) lead.textContent='This product could not load from the live catalogue data. Return to the catalogue and open it again.';
      }
    }
  }

  const startCatalogueTools=()=>{updateCartUI(); renderCart(); loadLiveCatalog().then(()=>{filterCatalog(); refreshAllPriceWidgets();}); loadProductDetail().then(()=>{refreshAllPriceWidgets(); updateCartUI();}); setTimeout(()=>{ updateCartUI(); renderCart(); filterCatalog(); refreshAllPriceWidgets(); }, 450);};
  if(document.body.classList.contains('catalog-auth-required') && window.SECURE_SMART_CATALOG_AUTH && !window.SECURE_SMART_CATALOG_AUTH.ready){
    document.addEventListener('secure-smart-catalog-auth',(event)=>{ if(event.detail?.allowed) startCatalogueTools(); },{once:true});
  } else if(!document.body.classList.contains('catalog-auth-required') || window.SECURE_SMART_CATALOG_AUTH?.allowed) {
    startCatalogueTools();
  }
})();
