
/* AFTER HOURS: standalone concept. No dependencies, telemetry or private data.
   The 30-second game uses a same-origin iframe with a checked message protocol. */
(function(){
'use strict';
document.documentElement.classList.add('js');
const $=(s)=>document.querySelector(s), $$=(s)=>Array.from(document.querySelectorAll(s));
const english=document.documentElement.lang==='en';
const AGE_KEY='sat-age-confirmed';
const media=window.matchMedia('(prefers-reduced-motion: reduce)');
let mood='light',phase=.7,paused=media.matches,allowed=false,gameActive=false;
let toastTimer=null,raf=0,last=0,artVisible=true,userMotionChoice=false;
const stage=$('#art-stage'),zone=$('#art-zone');
let c=$('#liquid');
const water=createWaterSurface(c);c=water.canvas;
const age=$('#age'),policy=$('#policy');
try{allowed=localStorage.getItem(AGE_KEY)==='yes';}catch(_){}
function notify(text){$('#toast').textContent=text;clearTimeout(toastTimer);toastTimer=setTimeout(()=>{$('#toast').textContent='';},6000);}
function setMood(next,syncLabel=true){
 mood=next==='deep'?'deep':'light';document.body.dataset.mood=mood;
 const deep=mood==='deep',id=deep?'sat-002':'sat-001';
 $$('[data-mood-choice]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.moodChoice===mood)));
 const brewery=english?(deep?'Tsuchida Brewery':'Urazato Brewery'):(deep?'土田酒造':'浦里酒造');
 $('#source-scene').dataset.source=deep?'tsuchida':'urasato';
 $('#side-title').textContent=deep?'SIDE B / TSUCHIDA':'SIDE A / URAZATO';
 $('#source-brewery').textContent=brewery;
 $('#source-copy').textContent=english?(deep?'Forest springs. Quiet depth.':'Beyond the mist, a clear finish.'):(deep?'森の奥、湧き出す深み。':'霧の向こう、澄んだ余韻。');
 $$('.record').forEach(el=>el.dataset.selected=String(el.id===id));
 if(syncLabel)window.dispatchEvent(new CustomEvent('sat:mood',{detail:{id,mood}}));
 paint();
}
$$('[data-mood-choice]').forEach(b=>b.addEventListener('click',()=>setMood(b.dataset.moodChoice)));
window.addEventListener('sat:label',event=>{
 const id=event.detail?.id,next=id==='sat-001'?'light':id==='sat-002'?'deep':null;
 // The label has already changed; update the source/theme without restarting its flip.
 if(next&&next!==mood)setMood(next,false);
});
const params=new URLSearchParams(location.search);const bottle=params.get('bottle');
setMood(bottle==='sat-002'?'deep':bottle==='sat-001'?'light':params.get('mood'));
function updateMotion(){
 $('#motion').setAttribute('aria-pressed',String(paused));$('#motion-text').textContent=english?(paused?'Resume':'Pause'):(paused?'動きを再開':'動きを止める');
 if(english)$('#motion').setAttribute('aria-label',paused?'Resume animation':'Pause animation');
 $('#source-scene').classList.toggle('source-still',paused||media.matches);
 if(paused){cancelAnimationFrame(raf);raf=0;}else loopStart();paint();
}
$('#motion').addEventListener('click',()=>{userMotionChoice=true;paused=!paused;updateMotion();});
function prefChanged(){if(!userMotionChoice){paused=media.matches;updateMotion();}}
if(media.addEventListener)media.addEventListener('change',prefChanged);
/* Local, stylised water: analytic surface waves + damped touch ripples.
   No video, texture downloads, physics claims, sound, tracking, or dependencies. */
function createWaterSurface(initialCanvas) {
 let canvas=initialCanvas, gl=null, context2d=null, program=null, uniforms=null, lost=false;
 let events=[], count=0, currentTime=0, currentDeep=false;
 const MAX_RIPPLES=8, data=new Float32Array(MAX_RIPPLES*4);
 const VERTEX='attribute vec2 position; varying vec2 vUv; void main(){vUv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
 const FRAGMENT=`
 precision highp float;
 varying vec2 vUv;
 uniform vec2 resolution;
 uniform float time, deep;
 uniform vec4 ripples[8];
 const vec3 INK=vec3(.090196,.082353,.109804);
 // Value and derivative together; no textures and no floating-point framebuffer.
 vec3 wave(vec2 p,vec2 direction,float frequency,float speed,float amplitude,float offset){
  float a=dot(p,direction)*frequency+time*speed+offset;
  return vec3(sin(a)*amplitude,cos(a)*amplitude*frequency*direction);
 }
 void main(){
  vec2 uv=vUv, p=(uv-.5)*vec2(resolution.x/resolution.y,1.22);
  vec3 field=wave(p,vec2(.91,.414),9.,-.34,.012,1.1);
  field+=wave(p,vec2(-.62,.785),14.,.29,.007,2.7);
  field+=wave(p,vec2(.26,.966),23.,-.25,.0035,.7);
  field+=wave(p,vec2(.985,-.173),32.,.24,.0021,3.1);
  field+=wave(p,vec2(-.848,-.530),47.,-.18,.0009,1.6);
  field+=wave(p,vec2(.6,-.8),61.,.21,.00045,.2);
  for(int i=0;i<8;i++){
   vec4 r=ripples[i];
   if(r.w>.001 && r.z>=0.){
    vec2 delta=p-(r.xy-.5)*vec2(resolution.x/resolution.y,1.22);
    float d=length(delta), age=r.z;
    float front=d-age*.21;
    float width=.060+age*.014;
    float envelope=exp(-front*front/(width*width))*exp(-age*.66);
    float theta=front*70.;
    float strength=.009*r.w*smoothstep(0.,.085,age);
    field.x+=strength*cos(theta)*envelope;
    float derivative=strength*envelope*(-70.*sin(theta)-2.*front/(width*width)*cos(theta));
    field.yz+=derivative*delta/max(d,.008);
   }
  }
  vec2 slope=field.yz;
  vec3 normal=normalize(vec3(-slope*2.4,1.));
  vec2 reflection=uv+slope*.26+vec2(field.x*.6,field.x*.9);
  // Two broad coloured reflections, rather than all-over rainbow metal.
  float lightA=exp(-pow(abs((reflection.x-.31+sin(reflection.y*3.5+time*.06)*.085)/.18),2.));
  float lightB=exp(-pow(abs((reflection.x-.76-sin(reflection.y*4.0-time*.04)*.11)/.16),2.));
  lightA*=.35+.65*exp(-pow(abs((reflection.y-.57)/.50),2.));
  lightB*=.24+.76*exp(-pow(abs((reflection.y-.45)/.43),2.));
  vec3 water=mix(vec3(.068,.153,.172),vec3(.118,.096,.188),deep);
  vec3 lime=mix(vec3(.69,.77,.44),vec3(.57,.43,.74),deep);
  vec3 violet=mix(vec3(.55,.47,.72),vec3(.73,.57,.61),deep);
  vec3 col=water+lime*lightA*.34+violet*lightB*.38;
  float facet=pow(max(dot(normal,normalize(vec3(-.22,.30,1.))),0.),34.);
  float glint=pow(max(dot(normal,normalize(vec3(.37,-.2,1.))),0.),96.);
  col+=mix(vec3(.78,.84,.61),vec3(.78,.67,.88),deep)*facet*lightA*.25;
  col+=vec3(.77,.73,.83)*glint*lightB*.33;
  // Thin broken caustics, deformed by the same surface that carries the ripples.
  float thread=sin(reflection.y*55.+sin(reflection.x*16.+time*.07)*1.1);
  thread=pow(max(0.,thread),16.);
  col+=(lime*lightA+violet*lightB)*thread*.06;
  col*=.93+field.x*1.5;
  float edge=smoothstep(0.,.16,uv.x)*smoothstep(0.,.16,1.-uv.x)
             *smoothstep(0.,.18,uv.y)*smoothstep(0.,.18,1.-uv.y);
  float vignette=1.-smoothstep(.30,.74,length((uv-.5)*vec2(.87,1.)));
  col=mix(INK,col,edge*vignette);
  gl_FragColor=vec4(clamp(col,0.,1.),1.);
 }`;
 function useFallback(){
  // A canvas cannot switch context types after WebGL allocation.
  if(gl){const replacement=canvas.cloneNode(false);canvas.replaceWith(replacement);canvas=replacement;gl=null;}
  try{context2d=canvas.getContext('2d');}catch(_){context2d=null;}
  canvas.dataset.renderer=context2d?'canvas2d':'static';
  return Boolean(context2d);
 }
 function setupGL(){
  const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);return s;};
  const high=gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER,gl.HIGH_FLOAT);
  const fs=shader(gl.FRAGMENT_SHADER,high&&high.precision?FRAGMENT:FRAGMENT.replace('precision highp float;','precision mediump float;'));
  const vs=shader(gl.VERTEX_SHADER,VERTEX);
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.bindAttribLocation(program,0,'position');gl.linkProgram(program);
  const ok=gl.getProgramParameter(program,gl.LINK_STATUS);
  gl.deleteShader(vs);gl.deleteShader(fs);
  if(!ok){gl.deleteProgram(program);throw new Error('Water shader unavailable');}
  gl.useProgram(program);const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);
  gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,2,gl.FLOAT,false,0,0);
  uniforms={resolution:gl.getUniformLocation(program,'resolution'),time:gl.getUniformLocation(program,'time'),deep:gl.getUniformLocation(program,'deep'),ripples:gl.getUniformLocation(program,'ripples[0]')};
  gl.disable(gl.DEPTH_TEST);gl.disable(gl.BLEND);lost=false;canvas.dataset.renderer='webgl';
 }
 try{
  gl=canvas.getContext('webgl',{alpha:true,antialias:false,depth:false,stencil:false,powerPreference:'low-power',preserveDrawingBuffer:false});
  if(gl)setupGL();else useFallback();
 }catch(_){useFallback();}
 if(gl){
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();lost=true;canvas.dataset.renderer='static';canvas.style.visibility='hidden';stage.classList.remove('is-drawn');});
  canvas.addEventListener('webglcontextrestored',()=>{try{setupGL();canvas.style.visibility='';resize();}catch(_){lost=true;canvas.dataset.renderer='static';}});
 }
 // Low-resolution normal-map renderer. Same surface as WebGL, cached trig
 // terms keep the CPU path bounded when WebGL is unavailable.
 let raster=null, rasterContext=null, cache=null;
 const waves=[[.91,.414,9,-.34,.012,1.1],[-.62,.785,14,.29,.007,2.7],[.26,.966,23,-.25,.0035,.7],[.985,-.173,32,.24,.0021,3.1],[-.848,-.530,47,-.18,.0009,1.6],[.6,-.8,61,.21,.00045,.2]];
 function fallbackDraw(t,isDeep,drawContext=context2d,w=canvas.width,h=canvas.height){
  if(!drawContext)return;
  const scale=Math.min(224/w,224/h,1),rw=Math.max(2,Math.round(w*scale)),rh=Math.max(2,Math.round(h*scale));
  const smooth=(a,b,v)=>{const q=Math.max(0,Math.min(1,(v-a)/(b-a)));return q*q*(3-2*q);};
  if(!cache||cache.w!==rw||cache.h!==rh){
   if(!raster){raster=document.createElement('canvas');rasterContext=raster.getContext('2d');}
   if(!rasterContext)return;
   raster.width=rw;raster.height=rh;
   const size=rw*rh,sn=waves.map(()=>new Float32Array(size)),cs=waves.map(()=>new Float32Array(size)),fade=new Float32Array(size);
   for(let iy=0;iy<rh;iy++)for(let ix=0;ix<rw;ix++){
    const i=iy*rw+ix,u=(ix+.5)/rw,v=1-(iy+.5)/rh,px=(u-.5)*rw/rh,py=(v-.5)*1.22;
    waves.forEach((a,j)=>{const n=(px*a[0]+py*a[1])*a[2]+a[5];sn[j][i]=Math.sin(n);cs[j][i]=Math.cos(n);});
    fade[i]=smooth(0,.16,u)*smooth(0,.16,1-u)*smooth(0,.18,v)*smooth(0,.18,1-v)*(1-smooth(.30,.74,Math.hypot((u-.5)*.87,v-.5)));
   }
   cache={w:rw,h:rh,sn,cs,fade,image:rasterContext.createImageData(rw,rh)};
  }
  const {sn,cs,fade,image}=cache,pix=image.data;
  const ct=waves.map(a=>Math.cos(t*a[3])),st=waves.map(a=>Math.sin(t*a[3]));
  const active=events.filter(e=>t-e.at>=0&&t-e.at<5.5).map(e=>({...e,age:t-e.at}));
  const base=isDeep?[.118,.096,.188]:[.068,.153,.172],la=isDeep?[.57,.43,.74]:[.69,.77,.44],lb=isDeep?[.73,.57,.61]:[.55,.47,.72],hi=isDeep?[.78,.67,.88]:[.78,.84,.61];
  const ink=[.090196,.082353,.109804],glow=[.77,.73,.83];
  for(let iy=0;iy<rh;iy++)for(let ix=0;ix<rw;ix++){
   const i=iy*rw+ix,u=(ix+.5)/rw,v=1-(iy+.5)/rh;
   let height=0,sx=0,sy=0;
   for(let j=0;j<6;j++){const a=waves[j],s=sn[j][i],c=cs[j][i];height+=a[4]*(s*ct[j]+c*st[j]);const deriv=a[4]*a[2]*(c*ct[j]-s*st[j]);sx+=deriv*a[0];sy+=deriv*a[1];}
   for(const e of active){
    const dx=(u-e.x)*rw/rh,dy=(v-e.y)*1.22,d=Math.hypot(dx,dy),front=d-e.age*.21,width=.060+e.age*.014;
    if(Math.abs(front)>width*3)continue;
    const envelope=Math.exp(-front*front/(width*width)-e.age*.66),theta=front*70,strength=.009*e.strength*smooth(0,.085,e.age);
    height+=strength*Math.cos(theta)*envelope;
    const deriv=strength*envelope*(-70*Math.sin(theta)-2*front/(width*width)*Math.cos(theta))/Math.max(d,.008);sx+=deriv*dx;sy+=deriv*dy;
   }
   const nx=-sx*2.4,ny=-sy*2.4,nz=1/Math.hypot(nx,ny,1);
   const rx=u+sx*.26+height*.6,ry=v+sy*.26+height*.9;
   const aa=(rx-.31+Math.sin(ry*3.5+t*.06)*.085)/.18,ab=(rx-.76-Math.sin(ry*4-t*.04)*.11)/.16;
   const lightA=Math.exp(-aa*aa)*(.35+.65*Math.exp(-Math.pow((ry-.57)/.50,2)));
   const lightB=Math.exp(-ab*ab)*(.24+.76*Math.exp(-Math.pow((ry-.45)/.43,2)));
   const facet=Math.pow(Math.max(0,(nx*(-.22)+ny*.30+1)*nz/1.06602064),34);
   const glint=Math.pow(Math.max(0,(nx*.37+ny*(-.2)+1)*nz/1.08577161),96);
   const thread=Math.pow(Math.max(0,Math.sin(ry*55+Math.sin(rx*16+t*.07)*1.1)),16);
   for(let k=0;k<3;k++){
    let color=(base[k]+la[k]*lightA*.34+lb[k]*lightB*.38+hi[k]*facet*lightA*.25+glow[k]*glint*lightB*.33+(la[k]*lightA+lb[k]*lightB)*thread*.06)*(.93+height*1.5);
    pix[i*4+k]=Math.round(Math.max(0,Math.min(1,ink[k]+(color-ink[k])*fade[i]))*255);
   }
   pix[i*4+3]=255;
  }
  rasterContext.putImageData(image,0,0);drawContext.imageSmoothingEnabled=true;drawContext.drawImage(raster,0,0,w,h);
 }
 const api={
  get canvas(){return canvas;},
  draw(t,isDeep){currentTime=t;currentDeep=isDeep;events=events.filter(e=>t-e.at<5.5);if(lost)return false;
   if(gl){
    data.fill(0);events.forEach((e,i)=>{data.set([e.x,e.y,t-e.at,e.strength],i*4);});
    gl.viewport(0,0,canvas.width,canvas.height);gl.useProgram(program);
    gl.uniform2f(uniforms.resolution,canvas.width,canvas.height);gl.uniform1f(uniforms.time,t%2048);gl.uniform1f(uniforms.deep,isDeep?1:0);gl.uniform4fv(uniforms.ripples,data);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
   }else fallbackDraw(t,isDeep);
   return Boolean(gl||context2d);
  },
  ripple(x,y,t,strength=1){
   if(events.length===MAX_RIPPLES)events.shift();events.push({x,y,at:t,strength:Math.min(1,strength)});
   canvas.dataset.ripples=String(++count);
  },
  clear(){events=[];},
  copyTo(target,w,h){
   if(lost||(!gl&&!context2d)){fallbackDraw(currentTime,currentDeep,target,w,h);return;}
   api.draw(currentTime,currentDeep);target.drawImage(canvas,0,0,w,h);
  }
 };
 return api;
}
function paint(){if(!c.width||!c.height)return;if(water.draw(phase,mood==='deep'))stage.classList.add('is-drawn');}
function resize(){const r=stage.getBoundingClientRect();if(r.width<=0||r.height<=0)return;
 const dpr=Math.min(window.devicePixelRatio||1,1.35,820/r.width,820/r.height);
 const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
 if(c.width!==w||c.height!==h){c.width=w;c.height=h;}paint();}
function loop(now){raf=0;if(paused||!allowed||!artVisible||gameActive||document.hidden)return;if(!last)last=now;const dt=Math.min((now-last)/1000,.08);if(dt>=(c.dataset.renderer==='webgl'?1/30:1/24)){phase+=dt;paint();last=now;}raf=requestAnimationFrame(loop);}
function loopStart(){if(!raf&&!paused&&allowed&&artVisible&&!gameActive&&!document.hidden){last=0;raf=requestAnimationFrame(loop);}}
let gesture=null,lastTrail=0,lastPoint=null;
function rippleAt(clientX,clientY,strength){
 if(paused||!allowed)return;const r=stage.getBoundingClientRect();
 const x=(clientX-r.left)/r.width,y=1-(clientY-r.top)/r.height;
 if(x<0||x>1||y<0||y>1)return;water.ripple(x,y,phase,strength);paint();loopStart();
}
zone.addEventListener('pointerdown',e=>{if(e.isPrimary===false)return;gesture={id:e.pointerId,x:e.clientX,y:e.clientY,moved:false};lastPoint=null;},{passive:true});
zone.addEventListener('pointermove',e=>{
 if(paused||!allowed)return;
 if(e.pointerType==='mouse'){
  if(lastPoint&&performance.now()-lastTrail>110&&Math.hypot(e.clientX-lastPoint.x,e.clientY-lastPoint.y)>14){rippleAt(e.clientX,e.clientY,.23);lastTrail=performance.now();}
  lastPoint={x:e.clientX,y:e.clientY};
 }else if(gesture&&gesture.id===e.pointerId){
  const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(Math.hypot(dx,dy)>12)gesture.moved=true;
  if(Math.abs(dx)>12&&Math.abs(dx)>Math.abs(dy)*1.5&&performance.now()-lastTrail>95){rippleAt(e.clientX,e.clientY,.36);lastTrail=performance.now();}
 }
},{passive:true});
zone.addEventListener('pointerup',e=>{if(gesture&&e.pointerId===gesture.id&&!gesture.moved&&Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y)<12)rippleAt(e.clientX,e.clientY,1);gesture=null;},{passive:true});
zone.addEventListener('pointercancel',()=>{gesture=null;lastPoint=null;},{passive:true});
zone.addEventListener('pointerleave',()=>{gesture=null;lastPoint=null;},{passive:true});
zone.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();if(!e.repeat){const r=stage.getBoundingClientRect();rippleAt(r.left+r.width*.5,r.top+r.height*.5,1);}}});
if('ResizeObserver'in window)new ResizeObserver(resize).observe(stage);else window.addEventListener('resize',resize);
if('IntersectionObserver'in window){new IntersectionObserver(es=>{artVisible=es[0].isIntersecting;if(artVisible)loopStart();else{cancelAnimationFrame(raf);raf=0;}},{threshold:0}).observe(zone);}
document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(raf);raf=0;}else loopStart();});
window.addEventListener('pagehide',()=>{cancelAnimationFrame(raf);raf=0;});
window.addEventListener('pageshow',loopStart);resize();updateMotion();
function enter(){
 allowed=true;try{localStorage.setItem(AGE_KEY,'yes');}catch(_){}
 if(age.open){if(typeof age.close==='function')age.close();else age.removeAttribute('open');}loopStart();
 if(['sat-001','sat-002','sat-003'].includes(bottle)){setTimeout(()=>{document.getElementById(bottle).scrollIntoView({behavior:'auto',block:'start'});},50);}
}
$('#age-yes').addEventListener('click',enter);
$('#age-no').addEventListener('click',()=>{$('#age-copy').textContent=english?'This site is for people aged 20 and over. Please close this tab.':'20歳以上の方に向けたご案内です。このタブを閉じてください。';$('#age-actions').hidden=true;});
age.addEventListener('cancel',e=>e.preventDefault());
if(!allowed){if(typeof age.showModal==='function')age.showModal();else{age.setAttribute('open','');document.querySelector('main').inert=true;$('#age-yes').addEventListener('click',()=>{document.querySelector('main').inert=false;age.removeAttribute('open');});}}else enter();
$('#privacy-open').addEventListener('click',()=>{if(typeof policy.showModal==='function')policy.showModal();else policy.setAttribute('open','');});
$('#policy-close').addEventListener('click',()=>{if(typeof policy.close==='function')policy.close();else policy.removeAttribute('open');});
$$('.record-art img').forEach(img=>{
 const done=()=>{if(img.naturalWidth>0)img.parentElement.classList.add('has-image');};
 img.addEventListener('load',done);img.addEventListener('error',()=>{img.hidden=true;img.parentElement.classList.add('image-failed');});
 if(img.complete){if(img.naturalWidth>0)done();else if(img.getAttribute('src')){img.hidden=true;img.parentElement.classList.add('image-failed');}}
});
$('#comic-image').addEventListener('error',()=>{$('#comic-image').hidden=true;$('#comic-error').hidden=false;});
window.addEventListener('sat:game-active',e=>{gameActive=e.detail===true;if(gameActive){cancelAnimationFrame(raf);raf=0;}else loopStart();});
})();
