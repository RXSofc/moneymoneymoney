/* ======================================================================
   DUITKU 2.0 — lapisan gerak (motion layer)

   File ini HANYA mengurus animasi & interaksi visual. Tidak membaca atau
   mengubah data, localStorage, form, sync Sheets, maupun CSV. Semua logika
   aplikasi tetap di js/script.js, yang tidak disentuh sama sekali.

   Isi:
   1. Reveal   — tile "dicap" masuk saat di-scroll (IntersectionObserver)
   2. Ticker   — dua pita berlawanan arah; kecepatan & arahnya ngikutin scroll
   3. Scroll   — progress bar, header jadi pill, bintang berputar, teks raksasa di footer
   4. Pointer  — bayangan tile ngikutin kursor, tombol "magnetik"
   5. Saldo    — efek miring saat angka saldo berhitung
   6. Stempel  — "TERCATAT" saat catatan baru tersimpan

   Hormat ke `prefers-reduced-motion`: kalau aktif, hanya state penting yang
   jalan (tile langsung tampil, header & progress bar), tanpa gerakan.
   ====================================================================== */
(function(){
"use strict";

var root=document.documentElement;
root.classList.add('motion-ready');   // memberi tahu jaring pengaman di <head> bahwa file ini hidup

var reduce=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
var finePointer=!!(window.matchMedia&&window.matchMedia('(hover: hover) and (pointer: fine)').matches);

function $(id){return document.getElementById(id)}
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function wrap(v,w){return w>0?((v%w)+w)%w:0}

/* ================= 1. REVEAL ================= */
(function initReveal(){
  var els=[].slice.call(document.querySelectorAll('[data-reveal]'));
  function showAll(){els.forEach(function(el){el.classList.add('in')})}
  if(reduce||!('IntersectionObserver' in window)){showAll();return}

  var io=new IntersectionObserver(function(entries){
    var batch=entries.filter(function(e){return e.isIntersecting});
    // tile yang muncul bersamaan masuk berurutan, bukan serentak
    batch.forEach(function(en,i){
      en.target.style.setProperty('--d',(i*85)+'ms');
      en.target.classList.add('in');
      io.unobserve(en.target);
    });
  },{threshold:0.1,rootMargin:'0px 0px -5% 0px'});
  els.forEach(function(el){io.observe(el)});
})();

/* ================= 2 + 3. TICKER & SCROLL (satu loop rAF) ================= */
(function initScrollLayer(){
  var header=$('siteHeader'), bar=$('scrollBar'), mega=$('mega');
  var spinEls=[].slice.call(document.querySelectorAll('[data-spin]'));

  function applyScroll(y,full){
    if(header)header.classList.toggle('scrolled',y>40);
    if(bar){
      var max=root.scrollHeight-window.innerHeight;
      bar.style.transform='scaleX('+(max>0?clamp(y/max,0,1):0).toFixed(4)+')';
    }
    if(!full)return;
    spinEls.forEach(function(el){el.style.rotate=(y*0.16).toFixed(1)+'deg'});
    if(mega){
      var r=mega.getBoundingClientRect(), vh=window.innerHeight;
      var p=clamp((vh-r.top)/(vh+r.height),0,1);
      mega.style.translate=((0.5-p)*14).toFixed(2)+'% 0';
    }
  }

  if(reduce){
    // tanpa gerakan: cukup state header + progress bar
    window.addEventListener('scroll',function(){applyScroll(window.scrollY,false)},{passive:true});
    applyScroll(window.scrollY,false);
    return;
  }

  /* ---- ticker ---- */
  var t1=$('tickerTrack'), t2=$('tickerTrack2');
  var setHTML='', setW1=0, setW2=0;
  function buildTickers(){
    if(!t1)return;
    if(!setHTML){
      // script.js mengisi #tickerTrack dengan 2 set identik; ambil satu set saja
      var kids=[].slice.call(t1.children);
      var half=Math.max(1,Math.floor(kids.length/2));
      setHTML=kids.slice(0,half).map(function(k){return k.outerHTML}).join('');
    }
    [t1,t2].forEach(function(t,idx){
      if(!t)return;
      t.innerHTML=setHTML;
      var w=t.scrollWidth||1;
      var copies=Math.ceil((window.innerWidth+w)/w)+1;
      var html='';for(var i=0;i<copies;i++)html+=setHTML;
      t.innerHTML=html;
      t.style.animation='none';
      if(idx===0)setW1=w;else setW2=w;
    });
  }
  buildTickers();
  if(document.fonts&&document.fonts.ready)document.fonts.ready.then(buildTickers);
  var rt;window.addEventListener('resize',function(){clearTimeout(rt);rt=setTimeout(buildTickers,150)});

  var x1=0,x2=0,vel=0,dirS=1,lastDir=1,lastY=window.scrollY,prev=performance.now(),firstFrame=true;
  function frame(now){
    var dt=Math.min(50,now-prev)/16.667;prev=now;
    var y=window.scrollY, dy=y-lastY;lastY=y;
    if(dy!==0)lastDir=dy>0?1:-1;

    // kecepatan scroll (dihaluskan) menambah laju pita; arah scroll membalik arahnya
    vel+=(Math.min(Math.abs(dy),70)-vel)*0.12*dt;
    dirS+=(lastDir-dirS)*0.07*dt;
    var speed=(0.6+vel*0.55)*dirS*dt;

    if(t1&&setW1){x1=wrap(x1+speed,setW1);t1.style.transform='translate3d('+(-x1).toFixed(2)+'px,0,0)'}
    if(t2&&setW2){x2=wrap(x2+speed,setW2);t2.style.transform='translate3d('+(x2-setW2).toFixed(2)+'px,0,0)'}

    if(dy!==0||firstFrame){applyScroll(y,true);firstFrame=false}
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();

/* ================= 4. POINTER ================= */
(function initPointer(){
  if(reduce||!finePointer)return;

  // bayangan brutal tile bergeser menjauhi kursor, seperti sumber cahaya
  [].slice.call(document.querySelectorAll('.tile')).forEach(function(tile){
    var raf=0,ex=0,ey=0;
    tile.addEventListener('pointermove',function(e){
      if(e.pointerType!=='mouse')return;
      ex=e.clientX;ey=e.clientY;
      if(raf)return;
      raf=requestAnimationFrame(function(){
        raf=0;
        var r=tile.getBoundingClientRect();
        var nx=clamp((ex-r.left)/r.width-0.5,-0.5,0.5)*2;
        var ny=clamp((ey-r.top)/r.height-0.5,-0.5,0.5)*2;
        tile.style.setProperty('--sx',(9-nx*5).toFixed(1)+'px');
        tile.style.setProperty('--sy',(9-ny*5).toFixed(1)+'px');
      });
    });
    tile.addEventListener('pointerleave',function(){
      if(raf){cancelAnimationFrame(raf);raf=0}
      tile.style.removeProperty('--sx');tile.style.removeProperty('--sy');
    });
  });

  // tombol utama & ikon menarik sedikit ke arah kursor
  [].slice.call(document.querySelectorAll('.btn-primary,.btn-icon,.logo-badge')).forEach(function(b){
    b.addEventListener('pointermove',function(e){
      if(e.pointerType!=='mouse')return;
      var r=b.getBoundingClientRect();
      var mx=clamp((e.clientX-(r.left+r.width/2))/(r.width/2),-1,1)*5;
      var my=clamp((e.clientY-(r.top+r.height/2))/(r.height/2),-1,1)*4;
      b.style.setProperty('--mx',mx.toFixed(1)+'px');
      b.style.setProperty('--my',my.toFixed(1)+'px');
    });
    b.addEventListener('pointerleave',function(){
      b.style.removeProperty('--mx');b.style.removeProperty('--my');
    });
  });
})();

/* ================= 5. SALDO BERHITUNG ================= */
(function initCounting(){
  var hero=$('heroAmount');
  if(reduce||!hero||!('MutationObserver' in window))return;
  var timer=0;
  new MutationObserver(function(){
    hero.classList.add('counting');
    clearTimeout(timer);
    timer=setTimeout(function(){hero.classList.remove('counting')},180);
  }).observe(hero,{childList:true,characterData:true,subtree:true});
})();

/* ================= 6. STEMPEL "TERCATAT" ================= */
(function initStamp(){
  var stamp=$('stamp'), toasts=$('toasts');
  if(reduce||!stamp||!toasts||!('MutationObserver' in window))return;
  var timer=0;
  new MutationObserver(function(muts){
    muts.forEach(function(m){
      [].forEach.call(m.addedNodes,function(n){
        if(n.nodeType!==1||!n.classList.contains('toast')||!n.classList.contains('ok'))return;
        if(!/tersimpan/i.test(n.textContent))return;   // toast "Catatan Rp ... tersimpan."
        stamp.classList.remove('show');
        void stamp.offsetWidth;                          // restart animasi
        stamp.classList.add('show');
        clearTimeout(timer);
        timer=setTimeout(function(){stamp.classList.remove('show')},1300);
      });
    });
  }).observe(toasts,{childList:true});
})();

})();
