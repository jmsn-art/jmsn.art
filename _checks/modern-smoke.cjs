const {JSDOM, VirtualConsole, ResourceLoader}=require('jsdom');
const fs=require('fs'), path=require('path'),assert=require('assert');
const root=path.resolve(__dirname, '..');
class Local extends ResourceLoader {fetch(url){const u=new URL(url);if(u.origin!=='https://jmsn.art')return null;const p=path.join(root,decodeURIComponent(u.pathname));return fs.existsSync(p)&&fs.statSync(p).isFile()?Promise.resolve(fs.readFileSync(p)):null}}
(async()=>{
 const names=fs.readdirSync(root).filter(x=>x.endsWith('.html')&&x!=='index-backup.html');
 let failed=0;
 for(const name of names){
  const errors=[],v=new VirtualConsole();v.on('jsdomError',e=>{if(!/Not implemented: (HTMLCanvasElement|HTMLMediaElement)|Could not parse CSS/.test(e.message))errors.push(e.message)});
  const dom=new JSDOM(fs.readFileSync(path.join(root,name),'utf8'),{url:'https://jmsn.art/'+name,runScripts:'dangerously',resources:new Local(),virtualConsole:v,pretendToBeVisual:true,beforeParse(w){
   w.matchMedia=()=>({matches:false,addEventListener(){},removeEventListener(){},addListener(){}});
   w.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
   w.ResizeObserver=class{observe(){}disconnect(){}};
   w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
   const context=new Proxy({canvas:{width:1000,height:1000},measureText:()=>({width:50}),createLinearGradient:()=>({addColorStop(){}}),createRadialGradient:()=>({addColorStop(){}}),getImageData:()=>({data:new Uint8ClampedArray(4)})},{get(t,p){return p in t?t[p]:()=>{}}});w.HTMLCanvasElement.prototype.getContext=()=>context;
   w.HTMLMediaElement.prototype.play=function(){return Promise.resolve()};w.HTMLMediaElement.prototype.pause=function(){};w.scrollTo=()=>{};
  }});
  await new Promise(r=>dom.window.addEventListener('load',r,{once:true}));
  const d=dom.window.document;
  try{
   assert(d.querySelector('.m-header'),'shared header');assert(d.querySelector('.m-footer'),'shared footer');
   const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length,'duplicate IDs');
   d.querySelector('.m-menu').click();assert.equal(d.querySelector('.m-menu').getAttribute('aria-expanded'),'true');d.dispatchEvent(new dom.window.KeyboardEvent('keydown',{key:'Escape'}));assert.equal(d.querySelector('.m-menu').getAttribute('aria-expanded'),'false');
   if(name==='index.html'){
    assert.equal(d.querySelectorAll('.work').length,11);d.querySelector('#more').click();assert.equal(d.querySelectorAll('.work[hidden]').length,0);d.querySelector('[data-art="8"]').click();assert(d.querySelector('#viewer').open);assert(d.querySelector('#viewer-title').textContent.includes('The Icon'));d.querySelector('#viewer-zoom').click();assert.equal(d.querySelector('#viewer-zoom').getAttribute('aria-pressed'),'true');d.querySelector('#next').click();assert.equal(d.querySelector('#viewer-zoom').getAttribute('aria-pressed'),'false');assert(d.querySelector('#viewer-title').textContent.includes('Haloed Figure'));d.querySelector('#close').click();assert(!d.querySelector('#viewer').open);
   }
   if(name==='archive.html'){assert.equal(d.querySelectorAll('.work').length,35);d.querySelector('.work').click();assert(d.querySelector('#lightbox').open);d.querySelector('#next').click();assert(d.querySelector('#lightbox-title').textContent.includes('There Is a Hole'));d.querySelector('#close').click();assert(!d.querySelector('#lightbox').open);}
   if(name==='circles.html'){assert.equal(d.querySelectorAll('#gallery img').length,200);d.querySelector('#reshuffleBtn').click();assert.equal(d.querySelectorAll('#gallery img').length,200);}
   if(name==='contact.html'){d.querySelector('#sendBtn').click();assert.equal(d.querySelector('#name').getAttribute('aria-invalid'),'true');d.querySelector('#resetBtn').click();assert.equal(d.querySelector('#name').value,'');}
   if(errors.length)throw Error(errors.join(' | '));
   console.log('PASS',name);
  }catch(e){failed++;console.log('FAIL',name,e.message)}
  dom.window.close();
 }
 process.exitCode=failed?1:0;
})();
