(function(){
  'use strict';
  const DATA=window.AROMA_LAB_DATA;
  if(!DATA) throw new Error('AROMA_LAB_DATA is not loaded');
  const {drinks,compounds,byId,iconById,groups}=DATA;
  const crossMolecules=compounds.filter(c=>new Set(c.apps.map(a=>a.drink)).size>=2);
  const state={drink:'sake',wine:'standard',family:null,descriptor:null,previousDrink:'sake'};
  const storageKey='sat-aroma-discovered-v2';
  let discovered=new Set();
  try{discovered=new Set(JSON.parse(localStorage.getItem(storageKey)||'[]'));}catch(_){discovered=new Set();}

  const tabsEl=document.getElementById('tabs');
  const cardsEl=document.getElementById('cards');
  const titleEl=document.getElementById('sectionTitle');
  const kickerEl=document.getElementById('sectionKicker');
  const wineModes=document.getElementById('wineModes');
  const filterBanner=document.getElementById('filterBanner');
  const filterText=document.getElementById('filterText');
  const toast=document.getElementById('toast');
  const groupsEl=document.getElementById('aromaGroups');

  function esc(s){return String(s).replace(/[&<>'"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[m]));}
  function categories(c){return [...new Set(c.apps.map(a=>a.drink))];}
  function structureUrl(c){return 'https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/'+encodeURIComponent(c.query)+'/PNG?record_type=2d';}
  function officialNo(c){
    const a=c.apps.find(x=>x.drink===state.drink&&(state.drink!=='wine'||state.wine==='all'||x.set===state.wine));
    return a?String(a.no).padStart(2,'0'):'--';
  }
  function persist(){try{localStorage.setItem(storageKey,JSON.stringify([...discovered]));}catch(_){} }
  function getVisible(){
    let arr;
    if(state.descriptor){
      arr=compounds.filter(c=>c.iconIds.includes(state.descriptor));
    }else if(state.drink==='cross'){
      arr=crossMolecules.slice().sort((a,b)=>categories(b).length-categories(a).length||a.ja.localeCompare(b.ja,'ja'));
    }else{
      arr=compounds.filter(c=>c.apps.some(a=>a.drink===state.drink&&(state.drink!=='wine'||state.wine==='all'||a.set===state.wine)));
    }
    if(state.family) arr=arr.filter(c=>c.family===state.family);
    return arr;
  }
  function renderTabs(){
    const defs=[
      ['sake','SAKE','日本酒','19'],['shochu','SHOCHU','焼酎・泡盛','20'],['wine','WINE','ワイン','18 + 20'],['beer','BEER','ビール','17'],['cross','CROSS-DRINK','酒をまたぐ',String(crossMolecules.length)]
    ];
    tabsEl.innerHTML=defs.map(([id,en,ja,n])=>`<button type="button" class="tab ${id==='cross'?'cross-tab':''} ${!state.descriptor&&state.drink===id?'active':''}" data-tab="${id}" aria-pressed="${!state.descriptor&&state.drink===id?'true':'false'}">${en}<small>${ja} · ${n}</small></button>`).join('');
    tabsEl.querySelectorAll('.tab').forEach(b=>b.addEventListener('click',()=>{
      state.drink=b.dataset.tab; state.previousDrink=state.drink; state.descriptor=null; state.family=null; render();
      document.querySelector('.control-row').scrollIntoView({behavior:'smooth',block:'start'});
    }));
  }
  function renderHead(){
    if(state.descriptor){
      const icon=iconById[state.descriptor];
      kickerEl.textContent='AROMA FILTER / '+icon.en;
      titleEl.textContent='「'+icon.ja+'」につながる分子';
    }else{
      const d=drinks[state.drink]; kickerEl.textContent=d.kicker; titleEl.textContent=d.title;
    }
    wineModes.classList.toggle('show',!state.descriptor&&state.drink==='wine');
    document.querySelectorAll('.wine-mode').forEach(b=>b.classList.toggle('active',b.dataset.wine===state.wine));
    const filters=[];
    if(state.descriptor) filters.push('AROMA / '+iconById[state.descriptor].ja);
    if(state.family) filters.push('CHEMISTRY / '+state.family);
    filterBanner.hidden=filters.length===0;
    if(filters.length) filterText.textContent=filters.join('  ×  ');
  }
  function aromaVisual(id,compact=false){
    const x=iconById[id];
    if(!x) return '';
    return `<span class="${compact?'back-icon':'aroma-visual'}"><img src="${esc(x.src)}" width="192" height="192" loading="lazy" decoding="async" alt="${esc(x.ja)}"><span>${esc(x.ja)}</span></span>`;
  }
  function cardHtml(c){
    const cats=categories(c); const cross=cats.length>=2; const num=state.descriptor?'AROMA':(state.drink==='cross'?'X':officialNo(c));
    const mini=cats.map(d=>drinks[d].label).join(' · ');
    return `<article class="card" tabindex="0" id="compound-${esc(c.id)}" data-id="${esc(c.id)}" aria-label="${esc(c.ja)}。操作すると構造式を表示">
      <div class="card-inner">
        <div class="face front">
          <span class="card-index">${num} / AROMA</span>
          ${cross?`<span class="cross-badge">×${cats.length} DRINKS</span>`:''}
          <div class="front-copy"><h3>${esc(c.ja)}</h3><p class="compound-en">${esc(c.en)}</p><p class="aroma-cue">${esc(c.aroma)}</p></div>
          <div class="aroma-images">${c.iconIds.slice(0,3).map(id=>aromaVisual(id)).join('')}</div>
          <div class="front-footer"><span class="drinks-mini">${esc(mini)}</span><span class="flip-cue">MOLECULE ↗</span></div>
        </div>
        <div class="face back-face">
          <div class="structure-panel">
            <div class="structure-top"><span>2D SKELETAL STRUCTURE</span><span class="family">${esc(c.family)}</span></div>
            <div class="structure-wrap"><img alt="${esc(c.ja)}の構造式" width="420" height="260" data-structure-src="${esc(structureUrl(c))}"><span class="structure-fallback">STRUCTURE<br>NOT AVAILABLE</span></div>
            <div class="structure-caption">STRUCTURE, NOT MOLECULAR FORMULA</div>
          </div>
          <div class="back-copy">
            <h3>${esc(c.ja)}</h3>
            <div class="back-icons">${c.iconIds.slice(0,3).map(id=>aromaVisual(id,true)).join('')}</div>
            ${c.note?`<p class="ref-note">${esc(c.note)}</p>`:''}
            <div class="drink-rail">${['sake','shochu','wine','beer'].map(d=>`<button type="button" class="drink-dot ${cats.includes(d)?'on':''}" data-jump="${d}" ${cats.includes(d)?'':'disabled'}>${drinks[d].label}</button>`).join('')}</div>
            <button type="button" class="related" data-family="${esc(c.family)}">同じ化学系統を見る / ${esc(c.family)} ↗</button>
          </div>
        </div>
      </div>
    </article>`;
  }
  function loadStructure(card){
    const img=card.querySelector('[data-structure-src]');
    if(!img||img.src) return;
    const fallback=card.querySelector('.structure-fallback');
    img.addEventListener('error',()=>{img.hidden=true;fallback.style.display='block';},{once:true});
    img.src=img.dataset.structureSrc;
  }
  function reveal(card,shouldReveal){
    card.classList.toggle('revealed',shouldReveal); card.classList.toggle('pinned',shouldReveal);
    if(shouldReveal){loadStructure(card); discover(card.dataset.id);}
  }
  function renderCards(){
    const arr=getVisible();
    cardsEl.innerHTML=arr.length?arr.map(cardHtml).join(''):'<div class="empty">この条件に対応する分子は、現在の標準物質データにはありません。</div>';
    document.getElementById('visibleCount').textContent=arr.length;
    cardsEl.querySelectorAll('.card').forEach(card=>{
      card.addEventListener('mouseenter',()=>{if(matchMedia('(hover:hover) and (pointer:fine)').matches){loadStructure(card);discover(card.dataset.id);}});
      card.addEventListener('click',e=>{if(e.target.closest('button')) return; reveal(card,!card.classList.contains('revealed'));});
      card.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&!e.target.closest('button')){e.preventDefault();reveal(card,!card.classList.contains('revealed'));}});
    });
    cardsEl.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',e=>{
      e.stopPropagation(); if(!b.classList.contains('on')) return;
      const id=b.closest('.card').dataset.id; const d=b.dataset.jump;
      state.drink=d; state.previousDrink=d; state.descriptor=null; state.family=null; if(d==='wine')state.wine='all'; render();
      requestAnimationFrame(()=>{const target=document.getElementById('compound-'+id);if(target){target.scrollIntoView({behavior:'smooth',block:'center'});reveal(target,true);}});
    }));
    cardsEl.querySelectorAll('[data-family]').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();state.family=b.dataset.family;render();document.querySelector('.control-row').scrollIntoView({behavior:'smooth',block:'start'});}));
  }
  function discover(id){
    if(discovered.has(id)) return; discovered.add(id); persist(); renderProgress();
    const c=byId[id],n=categories(c).length; if(n>=2) showToast('CROSS-DRINK FOUND · '+n+' DRINKS');
  }
  function renderProgress(){
    document.getElementById('discoveredMini').textContent=discovered.size;
    const found=crossMolecules.filter(c=>discovered.has(c.id)).length;
    document.getElementById('crossFound').textContent=found; document.getElementById('crossTotal').textContent=crossMolecules.length;
    document.getElementById('meterBar').style.width=(crossMolecules.length?found/crossMolecules.length*100:0)+'%';
  }
  function renderAromaIndex(){
    groupsEl.innerHTML=groups.map(g=>`<section class="aroma-group"><h3>${esc(g.label)}</h3><div class="icon-grid">${g.icons.map(id=>{
      const x=iconById[id]; return `<button type="button" class="icon-button ${state.descriptor===id?'active':''}" data-descriptor="${esc(id)}" aria-pressed="${state.descriptor===id?'true':'false'}"><img src="${esc(x.src)}" width="192" height="192" loading="lazy" decoding="async" alt=""><span>${esc(x.ja)}</span><small>${esc(x.en)}</small></button>`;
    }).join('')}</div></section>`).join('');
    groupsEl.querySelectorAll('[data-descriptor]').forEach(b=>b.addEventListener('click',()=>{
      const id=b.dataset.descriptor;
      if(state.descriptor===id){state.descriptor=null;}else{state.previousDrink=state.drink;state.descriptor=id;state.family=null;}
      render(); document.querySelector('.control-row').scrollIntoView({behavior:'smooth',block:'start'});
    }));
  }
  let toastTimer;
  function showToast(text){toast.textContent=text;toast.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>toast.classList.remove('show'),1600);}
  function render(){renderTabs();renderHead();renderCards();renderProgress();renderAromaIndex();}

  document.querySelectorAll('.wine-mode').forEach(b=>b.addEventListener('click',()=>{state.wine=b.dataset.wine;state.family=null;state.descriptor=null;render();}));
  document.getElementById('clearFilter').addEventListener('click',()=>{state.descriptor=null;state.family=null;render();});
  document.getElementById('resetProgress').addEventListener('click',()=>{discovered.clear();try{localStorage.removeItem(storageKey);}catch(_){}renderProgress();showToast('DISCOVERY LOG RESET');});
  render();
})();
