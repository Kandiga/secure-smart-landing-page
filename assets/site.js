document.addEventListener('DOMContentLoaded',()=>{
  const normalize=(value)=>String(value||'')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g,'')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g,' ')
    .trim()
    .replace(/\s+/g,' ');
  const compact=(value)=>normalize(value).replace(/\s+/g,'');
  const params=new URLSearchParams(location.search);
  const q=params.get('q')||'';
  const input=document.querySelector('input[name=q], .product-search input[type="search"], .product-search input');
  if(input){
    if(matchMedia('(max-width: 680px)').matches && !input.placeholder) input.placeholder='חיפוש מוצר או מק״ט';
    if(q) input.value=q;
  }
  const cards=[...document.querySelectorAll('[data-search], .product-card, .product-row')];
  const grid=document.querySelector('.products, .product-list, .catalog-grid');
  const haystackFor=(card)=>normalize([
    card.dataset.search,
    card.dataset.name,
    card.dataset.sku,
    card.dataset.brand,
    card.dataset.category,
    card.getAttribute('aria-label'),
    card.textContent
  ].filter(Boolean).join(' '));
  const matches=(haystack,term)=>{
    const qn=normalize(term);
    if(!qn) return true;
    const tokens=qn.split(' ').filter(Boolean);
    const hc=haystack.replace(/\s+/g,'');
    const qc=compact(qn);
    return tokens.every(t=>haystack.includes(t) || hc.includes(t)) || (qc.length>1 && hc.includes(qc));
  };
  function ensureEmptyNote(){
    let note=document.querySelector('.result-note');
    if(!note && grid){
      note=document.createElement('div');
      note.className='result-note';
      note.setAttribute('aria-live','polite');
      grid.parentNode.insertBefore(note,grid);
    }
    return note;
  }
  function apply(term){
    const raw=term||'';
    let n=0;
    cards.forEach(c=>{
      const ok=matches(haystackFor(c),raw);
      c.style.display=ok?'':'none';
      c.hidden=!ok;
      if(ok)n++;
    });
    const count=document.querySelector('#resultCount');
    if(count) count.textContent=String(n);
    const note=ensureEmptyNote();
    if(note){
      note.classList.toggle('active',!!normalize(raw));
      if(!cards.length) note.textContent='';
      else if(normalize(raw)) note.textContent=n?`נמצאו ${n} תוצאות עבור "${raw}".`:`לא נמצאו מוצרים עבור "${raw}". נסו מק״ט, מותג, קטגוריה או דגם.`;
      else note.textContent='';
    }
    if(grid) grid.classList.toggle('is-filtered',!!normalize(raw));
  }
  function syncUrl(term){
    if(!input) return;
    const url=new URL(location.href);
    if(normalize(term)) url.searchParams.set('q',term.trim()); else url.searchParams.delete('q');
    history.replaceState(null,'',url);
  }
  apply(input?.value||q);
  if(input&&cards.length){
    input.addEventListener('input',e=>{apply(e.target.value); syncUrl(e.target.value);});
    input.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault(); apply(input.value); syncUrl(input.value);}});
  }
  document.querySelectorAll('.product-search button,[data-site-search-submit]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault(); apply(input?.value||''); syncUrl(input?.value||''); input?.focus();}));
});

document.addEventListener('DOMContentLoaded',()=>{if(!matchMedia('(max-width: 680px)').matches)return;const map={'Network Switches':'Switches','Surveillance & Security':'Security','Wireless Links':'Wireless','Access Control':'Access','GPON & Fiber':'GPON'};document.querySelectorAll('.nav-scroll a').forEach(a=>{const t=a.textContent.trim();if(map[t])a.textContent=map[t];});});
// mobile category labels
