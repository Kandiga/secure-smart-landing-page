(()=>{
  const CRM_BASE='https://crm.securesmart.tech';
  const TRADE_ENDPOINT=`${CRM_BASE}/api/intake/trade-application`;
  const REGISTRATION_EVENT_ENDPOINT=`${CRM_BASE}/api/intake/registration-event`;
  const ORDER_REQUEST_ENDPOINT=`${CRM_BASE}/api/intake/order-request`;
  const CUSTOMER_ACTIVITY_ENDPOINT=`${CRM_BASE}/api/customer/activity`;
  const CART_KEY='secureSmartTemplateCart';
  const REG_SESSION_KEY='secureSmartRegistrationSession';

  const text={
    sending:'Sending to Secure Smart...',
    tradeOk:'Registration received. Secure Smart will review it and contact you.',
    orderOk:'Order request received. Secure Smart sales will review it and contact you.',
    tradeFail:'Registration could not be sent. Please try again or email info@securesmart.tech.',
    orderFail:'Order request could not be sent. Please try again or email sales@securesmart.tech.',
    emptyCart:'Please add at least one item to the quote cart before sending.'
  };

  const statusBox=(form)=>{
    let box=form.querySelector('[data-crm-status]');
    if(!box){
      box=document.createElement('div');
      box.setAttribute('data-crm-status','');
      box.setAttribute('aria-live','polite');
      box.style.marginTop='12px';
      box.style.padding='10px 12px';
      box.style.borderRadius='6px';
      box.style.fontWeight='700';
      box.style.fontSize='14px';
      form.appendChild(box);
    }
    return box;
  };
  const setStatus=(form,msg,ok=false)=>{
    const box=statusBox(form);
    box.textContent=msg;
    box.style.background=ok?'#e8f6ee':'#fbebe9';
    box.style.color=ok?'#147a4b':'#b13a2e';
  };
  const submitBtn=(form)=>form.querySelector('button[type="submit"],button:not([type]),button[type="button"]');

  const visitorSessionId=()=>{
    try{
      let id=localStorage.getItem(REG_SESSION_KEY);
      if(!id){
        id=`ss-reg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
        localStorage.setItem(REG_SESSION_KEY,id);
      }
      return id;
    }catch{
      return `ss-reg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
    }
  };
  const formSnapshot=(form)=>({
    businessName:form.querySelector('[name="business_name"]')?.value?.trim()||'',
    applicantEmail:form.querySelector('[name="applicant_email"],[name="account_owner_email"],[name="contact_email"]')?.value?.trim()||'',
    applicantPhone:form.querySelector('[name="applicant_phone"],[name="account_owner_phone"],[name="contact_phone"]')?.value?.trim()||''
  });
  const invalidFields=(form)=>Array.from(form.querySelectorAll('input,select,textarea')).filter(el=>!el.checkValidity?.()).map(el=>el.name||el.getAttribute('aria-label')||el.id||el.tagName).filter(Boolean);
  const trackRegistrationEvent=(event,form,extra={})=>{
    try{
      const payload={
        event,
        visitorSessionId:visitorSessionId(),
        pageUrl:location.href,
        referrer:document.referrer||'',
        language:document.documentElement.lang||'en',
        form:form?formSnapshot(form):{},
        context:{browserOnline:navigator.onLine,...(extra.context||{})},
        error:extra.error||{}
      };
      const body=JSON.stringify(payload);
      fetch(REGISTRATION_EVENT_ENDPOINT,{method:'POST',mode:'cors',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{});
    }catch{}
  };

  function wireTradeForms(){
    document.querySelectorAll('form[name="trade-access"]').forEach(form=>{
      if(form.dataset.crmWired==='true') return;
      form.dataset.crmWired='true';
      trackRegistrationEvent('page_loaded',form);
      let started=false;
      form.addEventListener('input',()=>{
        if(started) return;
        started=true;
        trackRegistrationEvent('form_started',form);
      },{passive:true});
      form.addEventListener('change',()=>{
        if(started) return;
        started=true;
        trackRegistrationEvent('form_started',form);
      },{passive:true});
      let validationTimer=null;
      let lastValidationSignature='';
      let lastValidationAt=0;
      const sendValidationFailure=()=>{
        const fields=invalidFields(form);
        const signature=fields.join('|')||'unknown';
        const now=Date.now();
        if(signature===lastValidationSignature && now-lastValidationAt<30000) return;
        lastValidationSignature=signature;
        lastValidationAt=now;
        trackRegistrationEvent('validation_failed',form,{error:{message:'Browser validation blocked registration submit',invalidFields:fields}});
      };
      form.addEventListener('invalid',()=>{
        clearTimeout(validationTimer);
        validationTimer=setTimeout(sendValidationFailure,400);
      },true);
      submitBtn(form)?.addEventListener('click',(event)=>{
        if(!form.checkValidity()){
          event.preventDefault();
          setStatus(form,'Please complete all required fields before submitting the registration.',false);
          sendValidationFailure();
          form.reportValidity?.();
          return;
        }
        trackRegistrationEvent('submit_clicked',form,{error:{invalidFields:invalidFields(form)}});
      });
      form.addEventListener('submit',async (event)=>{
        event.preventDefault();
        const startedAt=Date.now();
        trackRegistrationEvent('submit_attempt',form);
        const button=submitBtn(form);
        const old=button?.textContent;
        if(button){button.disabled=true; button.textContent=text.sending;}
        try{
          const response=await fetch(TRADE_ENDPOINT,{method:'POST',body:new FormData(form),mode:'cors'});
          let result=null;
          try{ result=await response.clone().json(); }catch{}
          if(!response.ok) throw new Error(`HTTP ${response.status}`);
          trackRegistrationEvent('submit_success',form,{context:{elapsedMs:Date.now()-startedAt},error:{httpStatus:response.status,message:result?.applicationId?`Application ${result.applicationId}`:'Application received'}});
          setStatus(form,text.tradeOk,true);
          setTimeout(()=>{ window.location.href='/thanks.html'; },700);
        }catch(error){
          console.error('Secure Smart trade intake failed',error);
          trackRegistrationEvent('submit_failed',form,{context:{elapsedMs:Date.now()-startedAt},error:{message:error?.message||'Registration submit failed',invalidFields:invalidFields(form)}});
          setStatus(form,text.tradeFail,false);
        }finally{
          if(button){button.disabled=false; button.textContent=old;}
        }
      });
    });
  }

  async function customerActivityHeaders(){
    try{
      return window.SecureSmartCustomerAuth?.signedOrderRequestHeaders ? await window.SecureSmartCustomerAuth.signedOrderRequestHeaders() : {};
    }catch{return {};}
  }

  async function trackOrderActivity(event,details={}){
    try{
      if(window.SecureSmartCustomerAuth?.trackCustomerActivity){
        await window.SecureSmartCustomerAuth.trackCustomerActivity(event,{context:details.context||{},error:details.error||{}});
        return;
      }
      const headers=await customerActivityHeaders();
      fetch(CUSTOMER_ACTIVITY_ENDPOINT,{
        method:'POST',mode:'cors',keepalive:true,
        headers:{'Content-Type':'application/json',...headers},
        body:JSON.stringify({event,pageUrl:location.href,referrer:document.referrer||'',language:document.documentElement.lang||'en',context:details.context||{},error:details.error||{}})
      }).catch(()=>{});
    }catch{}
  }

  const cartSummary=(items)=>({
    itemCount:items.length,
    unitCount:items.reduce((sum,item)=>sum+(Number(item.qty)||0),0),
    cartValue:Math.round(items.reduce((sum,item)=>sum+((Number(item.lineTotal)||((Number(item.unitPrice)||0)*(Number(item.qty)||0)))),0))
  });

  const readCart=()=>{
    try{return JSON.parse(localStorage.getItem(CART_KEY)||'[]')||[];}catch{return [];}
  };
  async function submitOrderCart(panel,button){
    if(panel.dataset.crmSubmitting==='true') return;
    const items=readCart().filter(item=>item && item.sku && Number(item.qty)>0);
    const summary=cartSummary(items);
    if(!items.length){
      setStatus(panel,text.emptyCart,false);
      trackOrderActivity('order_submit_failed',{context:{...summary,reason:'empty_cart'},error:{message:'Customer attempted to submit an empty cart'}});
      return;
    }
    if(!confirmationsReady(panel)){
      setStatus(panel,'Tick both confirmation boxes to submit this order to Secure Smart.',false);
      trackOrderActivity('order_submit_failed',{context:{...summary,reason:'confirmations_missing'},error:{message:'Customer attempted to submit before confirming order terms'}});
      return;
    }
    const old=button?.textContent || '';
    panel.dataset.crmSubmitting='true';
    if(button){ button.disabled=true; button.textContent=text.sending; }
    else setStatus(panel,text.sending,true);
    const company=panel.querySelector('[name="company"]')?.value?.trim()||'';
    const contact=panel.querySelector('[name="contact"]')?.value?.trim()||'';
    const email=panel.querySelector('[name="email"]')?.value?.trim()||'';
    const notes=panel.querySelector('[name="notes"]')?.value?.trim()||'';
    try{
      const authHeaders = await customerActivityHeaders();
      await trackOrderActivity('order_submit_attempt',{context:{...summary,authenticated:Boolean(authHeaders.Authorization)}});
      const response=await fetch(ORDER_REQUEST_ENDPOINT,{
        method:'POST',mode:'cors',headers:{'Content-Type':'application/json',...authHeaders},
        body:JSON.stringify({
          source:'website-cart', language:document.documentElement.lang||'en',
          company, contact, email, notes,
          items:items.map(item=>({
            sku:String(item.sku), title:String(item.name||item.sku), brand:String(item.brand||''),
            quantity:Number(item.qty)||1, mode:item.mode||'unit',
            customerUnitPrice:Number(item.unitPrice)||0,
            notes:[item.note,item.mode].filter(Boolean).join(' · ')
          }))
        })
      });
      let result=null;
      try{ result=await response.clone().json(); }catch{}
      if(!response.ok) throw new Error(result?.error||`HTTP ${response.status}`);
      await trackOrderActivity('order_submit_success',{context:{...summary,authenticated:Boolean(authHeaders.Authorization),orderNumber:result?.orderNumber||'',receivedItems:Number(result?.receivedItems||summary.itemCount)}});
      localStorage.removeItem(CART_KEY);
      document.dispatchEvent(new StorageEvent('storage',{key:CART_KEY}));
      setStatus(panel,text.orderOk,true);
      setTimeout(()=>{ window.location.href='/thanks.html'; },900);
    }catch(error){
      console.error('Secure Smart order request intake failed',error);
      trackOrderActivity('order_submit_failed',{context:summary,error:{message:error?.message||'Order request intake failed'}});
      setStatus(panel,text.orderFail,false);
    }finally{
      delete panel.dataset.crmSubmitting;
      if(button){button.disabled=false; button.textContent=old;}
    }
  }

  function wireOrderCart(){
    const panel=document.querySelector('.ct-checkout-panel');
    if(!panel || panel.dataset.crmWired==='true') return;
    panel.dataset.crmWired='true';
    const button=panel.querySelector('button');
    if(button) button.dataset.crmSubmit='true';
  }

  const confirmationsReady=(panel)=>{
    const order=panel?.querySelector('[data-confirm-order]');
    const terms=panel?.querySelector('[data-confirm-terms]');
    return Boolean(order?.checked && terms?.checked);
  };

  document.addEventListener('click',(event)=>{
    const button=event.target.closest?.('.ct-checkout-panel [data-crm-submit="true"]');
    if(!button) return;
    const panel=button.closest('.ct-checkout-panel');
    if(!panel) return;
    event.preventDefault();
    submitOrderCart(panel,button);
  });

  document.addEventListener('change',(event)=>{
    const input=event.target.closest?.('.ct-checkout-panel [data-confirm-order],.ct-checkout-panel [data-confirm-terms]');
    if(!input) return;
    const panel=input.closest('.ct-checkout-panel');
    if(!panel || !confirmationsReady(panel)) return;
    submitOrderCart(panel,panel.querySelector('[data-crm-submit="true"]'));
  });

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>{wireTradeForms(); wireOrderCart();});
  else { wireTradeForms(); wireOrderCart(); }
})();
