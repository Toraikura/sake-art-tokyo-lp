import {W,H,DT,CARDS,createMatch,start,pause,resume,step,share,deploy,clamp} from './model.js';
import {draw} from './render.js?v=20260908-en1';
import {glyph} from './art.js';
import {locale,sitePath,translate as t,localizeDocument} from './locale.js?v=20260908-en1';
localizeDocument();
const $=s=>document.querySelector(s), canvas=$('#arena'), wrap=$('.arena-wrap'), slot=$('.arena-slot');
const buttons=[...document.querySelectorAll('.game-card')], dialog=$('#result');
const params=new URLSearchParams(location.search), session=params.get('session')||'';
const bottle=/^sat-\d{3}$/.test(params.get('bottle')||'')?params.get('bottle'):'sat-001';
const embedded=window.parent!==window, reduced=matchMedia('(prefers-reduced-motion: reduce)');
const send=(type,extra={})=>{if(embedded)parent.postMessage({channel:'sat-quick-v1',session,type,...extra},location.origin);};
$('#explore').href=`${sitePath}#${bottle}`;
let m,selected=null,cursor=null,gesture=null,keyboardPoint={x:W/2,y:H*.58};
let last=0,acc=0,raf=0,paintAt=0,done=false,disposed=false,suppressClickUntil=0;
const pointers=new Set();
function seed(){try{return crypto.getRandomValues(new Uint32Array(1))[0]||260908;}catch{return Date.now()>>>0;}}
function fit(){
 const r=slot.getBoundingClientRect(),w=Math.max(1,Math.min(r.width,r.height*W/H));
 wrap.style.width=`${w}px`;wrap.style.height=`${w*H/W}px`;
}
function cancel(clear=true){
 const old=gesture;gesture=null;cursor=null;
 if(clear)selected=null;
 if(old?.capture.hasPointerCapture(old.id)){try{old.capture.releasePointerCapture(old.id);}catch{}}
 renderHUD();
}
function point(x,y){const r=canvas.getBoundingClientRect();return !r.width||!r.height||x<r.left||x>=r.right||y<r.top||y>=r.bottom?null:{x:(x-r.left)/r.width*W,y:(y-r.top)/r.height*H};}
function select(i){if(m.status!=='playing')return;cancel(false);selected={index:i,card:m.hand[i]};renderHUD();}
function tell(text){m.message=text;m.messageLife=2.4;renderHUD();}
function begin(e,source,index){
 if(m.status!=='playing'||e.button!==0||!e.isPrimary||pointers.size>1)return;
 if(source==='card')select(index);
 // First-time direct board taps can also use the glowing starter card.
 if(!selected&&m.played===0&&source==='board')select(0);
 if(!selected){tell('手札を選ぶ ↓');return;}
 const r=canvas.getBoundingClientRect();
 gesture={...selected,id:e.pointerId,source,capture:e.currentTarget,rect:r,entered:source==='board',touch:e.pointerType!=='mouse'};
 try{e.currentTarget.setPointerCapture(e.pointerId);}catch{cancel();return;}
 cursor=source==='board'?point(e.clientX,e.clientY):null;
 if(cursor)keyboardPoint=cursor;
}
function commit(s,p){
 if(m.status!=='playing'||m.hand[s.index]!==s.card){cancel();return;}
 const first=m.played===0;keyboardPoint=p;
 const success=deploy(m,s.index,p.x,p.y);cancel(success);
 if(!success)cursor=p;
 if(success&&first){last=0;acc=0;send('first-move');}
 renderHUD();canvas.focus({preventScroll:true});
}
window.addEventListener('pointerdown',e=>{pointers.add(e.pointerId);if(pointers.size>1)cancel();},true);
window.addEventListener('pointermove',e=>{const a=gesture;if(!a||a.id!==e.pointerId)return;cursor=point(e.clientX,e.clientY);if(cursor){a.entered=true;keyboardPoint=cursor;}}, {passive:true});
window.addEventListener('pointerup',e=>{
 pointers.delete(e.pointerId);const a=gesture;if(!a||a.id!==e.pointerId)return;
 suppressClickUntil=performance.now()+350;
 const r=canvas.getBoundingClientRect();
 if(['x','y','width','height'].some(k=>Math.abs(r[k]-a.rect[k])>.5)){cancel();return;}
 const p=point(e.clientX,e.clientY);if(p)commit(a,p);else cancel(a.source==='board'||a.entered);
});
window.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);if(gesture?.id===e.pointerId)cancel();});
window.addEventListener('lostpointercapture',e=>{if(gesture?.id===e.pointerId)cancel();},true);
canvas.addEventListener('pointerdown',e=>begin(e,'board'));
buttons.forEach((b,i)=>{
 b.innerHTML='<span class="cost"></span><canvas width="112" height="80" aria-hidden="true"></canvas><b></b>';
 b.addEventListener('pointerdown',e=>begin(e,'card',i));
 b.addEventListener('click',e=>{if(e.detail===0&&performance.now()>suppressClickUntil)select(i);});
});
function paintCard(button,kind){
 const c=button.querySelector('canvas').getContext('2d');if(!c)return;
 c.setTransform(1,0,0,1,0,0);c.clearRect(0,0,112,80);c.translate(56,43);c.scale(27,27);
 if(kind==='yeast')for(const [x,y]of[[-.8,.12],[0,-.12],[.8,.12]]){c.save();c.translate(x,y);c.scale(.78,.78);glyph(c,kind);c.restore();}
 else glyph(c,kind);
}
function renderHUD(){
 if(!m)return;
 const pct=share(m),playing=m.status==='playing';
 canvas.dataset.status=m.status;canvas.dataset.played=String(m.played);canvas.dataset.tick=String(m.tick);canvas.dataset.tiles=m.tiles.join('');
 canvas.dataset.units=JSON.stringify(m.units.map(({x,y,side,kind})=>({x,y,side,kind})));
 canvas.dataset.enemyAction=m.lastEnemy;
 canvas.tabIndex=playing?0:-1;
 $('#time').textContent=String(Math.ceil(m.time)).padStart(2,'0');$('.clock').classList.toggle('urgent',m.time<10&&m.played>0);
 $('#share').textContent=pct.toFixed(1)+'%';$('#enemy-share').textContent=(100-pct).toFixed(1)+'%';
 $('#territory-fill').style.width=pct+'%';$('.territory').setAttribute('aria-valuenow',pct.toFixed(1));
 $('#energy').textContent=String(Math.floor(m.energy));$('#supply').value=m.energy;
 $('#cancel').disabled=!selected||!playing;$('#pause').disabled=!playing;
 $('#first-target').hidden=!playing||m.played!==0||!selected||!!gesture;
 buttons.forEach((b,i)=>{
  const id=m.hand[i],card=CARDS[id];
  if(b.dataset.card!==id){b.dataset.card=id;b.querySelector('.cost').textContent=card.cost;b.querySelector('b').textContent=t(card.name);paintCard(b,id);}
  b.dataset.cost=card.cost;b.disabled=!playing;b.setAttribute('aria-pressed',String(selected?.index===i));
  b.setAttribute('aria-label',locale==='en'?`${i+1} ${t(card.name)}, supply ${card.cost}`:`${i+1} ${card.name}、補給${card.cost}`);
  b.classList.toggle('selected',selected?.index===i);b.classList.toggle('prompt',playing&&m.played===0&&!selected&&i===0);
  b.classList.toggle('spell',!card.hp);b.classList.toggle('unaffordable',m.energy<card.cost);
 });
 $('#feedback').textContent=t(m.messageLife>0&&m.played>0?m.message:m.messageLife>0&&m.message!=='カードを選び、緑の床へ配置'?m.message:'');
}
function newMatch(){
 if(dialog.open)dialog.close();
 m=createMatch('practice','rush',seed(),'sokujo');m.messageLife=0;start(m);done=false;
 cancel();pointers.clear();last=0;acc=0;fit();renderHUD();canvas.focus({preventScroll:true});send('ready');
}
function showResult(){
 const paused=m.status==='paused',pct=share(m);
 $('#result-title').textContent=t(paused?'ひと休み。':m.status==='won'?'あなたの勝ち！':m.status==='lost'?'CPUの勝ち。':'いい勝負。');
 $('#result-eyebrow').textContent=paused?'PAUSED':'NICE PLAY.';
 $('#result-score').textContent=paused?'':pct.toFixed(1)+'%';$('#result-score').hidden=paused;
 $('#result-caption').textContent=t(paused?'時間と盤面は止まっています。':'あなたが広げた色。次は、日本酒の個性へ。');
 $('#explore').hidden=paused;$('#resume').hidden=!paused;$('#replay').hidden=paused;
 if(!dialog.open)dialog.showModal();
 (paused?$('#resume'):$('#explore')).focus({preventScroll:true});
}
function stop(){
 if(!m||m.status!=='playing')return;
 cancel();pause(m);last=0;acc=0;renderHUD();showResult();send('paused');
}
function autoStop(){pointers.clear();cancel();if(m.played>0)stop();}
$('#pause').addEventListener('click',stop);$('#cancel').addEventListener('click',()=>cancel());
$('#resume').addEventListener('click',()=>{if(dialog.open)dialog.close();resume(m);last=0;acc=0;renderHUD();canvas.focus({preventScroll:true});});
$('#replay').addEventListener('click',newMatch);
$('#exit').addEventListener('click',()=>{if(embedded)send('exit');else location.href=sitePath;});
$('#explore').addEventListener('click',e=>{if(embedded){e.preventDefault();send('explore');}});
dialog.addEventListener('cancel',e=>{e.preventDefault();if(m.status==='paused')$('#resume').click();});
window.addEventListener('blur',autoStop);
document.addEventListener('visibilitychange',()=>{if(document.hidden)autoStop();});
window.addEventListener('pagehide',()=>{autoStop();disposed=true;cancelAnimationFrame(raf);});
window.addEventListener('pageshow',()=>{if(disposed){disposed=false;last=0;acc=0;fit();renderHUD();raf=requestAnimationFrame(loop);}});
window.addEventListener('resize',()=>{if(gesture)cancel();fit();});
window.visualViewport?.addEventListener('resize',()=>{if(gesture)cancel();fit();});
new ResizeObserver(()=>{if(gesture)cancel();fit();}).observe(slot);
window.addEventListener('keydown',e=>{
 if(dialog.open)return;
 if(e.key==='Escape'){e.preventDefault();if(selected)cancel();else stop();return;}
 if(e.key.toLowerCase()==='p'){e.preventDefault();stop();return;}
 if(m.status!=='playing')return;
 if(/^[1-4]$/.test(e.key)){e.preventDefault();select(Number(e.key)-1);cursor=keyboardPoint;canvas.focus({preventScroll:true});}
 const dirs={ArrowUp:{x:0,y:-1},ArrowDown:{x:0,y:1},ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0}};
 if(dirs[e.key]&&e.target===canvas){e.preventDefault();const d=dirs[e.key];keyboardPoint={x:clamp(keyboardPoint.x+d.x,.5,W-.5),y:clamp(keyboardPoint.y+d.y,.5,H-.5)};cursor=keyboardPoint;}
 if((e.key==='Enter'||e.code==='Space')&&e.target===canvas){e.preventDefault();if(!e.repeat&&selected&&!gesture)commit(selected,keyboardPoint);}
});
function loop(now){
 if(disposed)return;
 // No simulation step, including AI, before an actual successful user deployment.
 const advancing=m.status==='playing'&&m.played>0&&!document.hidden;
 if(advancing&&last)acc+=Math.min(.1,(now-last)/1000);else acc=0;
 last=now;
 while(acc>=DT&&m.status==='playing'){step(m);acc-=DT;}
 if(m.status==='playing'){
  const hint=m.played===0&&selected&&!cursor?{x:W/2,y:H*.58}:cursor;
  draw(canvas,m,hint,selected?.index??null,reduced.matches,!!gesture?.touch&&!!cursor);
 }
 if(now-paintAt>=100){renderHUD();paintAt=now;}
 if(['won','lost','draw'].includes(m.status)&&!done){done=true;cancel();draw(canvas,m,null,null,reduced.matches);renderHUD();showResult();send('finished',{outcome:m.status,share:share(m),played:m.played});}
 raf=requestAnimationFrame(loop);
}
newMatch();raf=requestAnimationFrame(loop);
