/* ======================================================================
   DUITKU 2.0 — splash intro "Struk Disobek"

   Urutan (~3 detik, bisa dilewati kapan saja):
   1. Layar kertas struk. Uang kertas & koin hitam berjatuhan (canvas 2D),
      berputar-putar, lalu MENUMPUK di dasar layar.
   2. Wordmark "DUITKU" terisi dari bawah mengikuti progres.
   3. Stempel "KAS DIBUKA" dicap.
   4. Seluruh lembar struk disobek ke atas (tepi bergerigi) dan app muncul.

   File ini tidak menyentuh data, localStorage aplikasi, form, sync, maupun
   CSV. Satu-satunya yang ditulis: sessionStorage 'duitku_intro_v1' agar
   intro hanya tampil sekali per sesi tab. Tambahkan ?intro di URL untuk
   memutarnya lagi.

   Tidak tampil sama sekali bila: prefers-reduced-motion aktif, atau sudah
   pernah tampil di sesi ini (diputuskan oleh skrip kecil di <head>, yang
   menaruh class `splash-on` di <html>).
   ====================================================================== */
(function(){
"use strict";

var root=document.documentElement;
var el=document.getElementById('splash');
if(!el)return;
if(!root.classList.contains('splash-on')){el.parentNode.removeChild(el);return}

try{sessionStorage.setItem('duitku_intro_v1','1')}catch(e){}

var cv=document.getElementById('splashCanvas');
var ctx=cv&&cv.getContext&&cv.getContext('2d');
var pctEl=document.getElementById('splashPct');
var skipBtn=document.getElementById('splashSkip');
if(!ctx){root.classList.remove('splash-on');el.parentNode.removeChild(el);return}   // tanpa canvas: lewati intro

/* ---------- konstanta alur (detik) ---------- */
var T_SPAWN=1.25;     // uang jatuh selama ini
var T_FILL=1.7;       // wordmark penuh
var T_STAMP=1.8;      // stempel
var T_EXIT=2.35;      // lembar mulai disobek

/* halaman di belakang intro tidak boleh bisa difokus / diklik */
/* Skrip ini jalan sebelum <main> dst. di-parse, jadi elemen dicari ulang saat DOM siap. */
function appParts(){return [].slice.call(document.querySelectorAll('.ticker,#siteHeader,main,footer'))}
function lockApp(){appParts().forEach(function(n){n.setAttribute('inert','')})}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',lockApp);else lockApp();

var dpr=Math.min(window.devicePixelRatio||1,2);
var W=window.innerWidth, H=window.innerHeight;
cv.width=Math.round(W*dpr);cv.height=Math.round(H*dpr);
cv.style.width=W+'px';cv.style.height=H+'px';

var INK='#0A0A0A', PAPER='#F3F1EA', SHADOW='rgba(10,10,10,.2)';
var FONT="'Bricolage Grotesque',system-ui,-apple-system,'Segoe UI',sans-serif";
var MONO="'Martian Mono',ui-monospace,Menlo,Consolas,monospace";

function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function rand(a,b){return a+Math.random()*(b-a)}
function rr(c,x,y,w,h,r){
  c.beginPath();c.moveTo(x+r,y);c.lineTo(x+w-r,y);c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r);c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);c.lineTo(x+r,y+h);
  c.quadraticCurveTo(x,y+h,x,y+h-r);c.lineTo(x,y+r);c.quadraticCurveTo(x,y,x+r,y);c.closePath();
}

/* ---------- ukuran uang menyesuaikan layar ---------- */
var u=clamp(W*0.085,56,100);
var BW=Math.round(u*1.55), BH=Math.round(u*0.74), CD=Math.round(u*0.64);
var PAD=10;

/* ---------- sprite uang: digambar sekali, dipakai ulang ---------- */
function sprite(w,h,draw){
  var c=document.createElement('canvas');
  c.width=Math.ceil((w+PAD*2)*dpr);c.height=Math.ceil((h+PAD*2)*dpr);
  var x=c.getContext('2d');x.scale(dpr,dpr);x.translate(PAD,PAD);draw(x,w,h);
  return {c:c,w:w+PAD*2,h:h+PAD*2};
}
function hatch(x,x0,y0,w,h,color,gap){
  x.save();x.beginPath();x.rect(x0,y0,w,h);x.clip();x.strokeStyle=color;x.lineWidth=2;
  for(var i=-h;i<w+h;i+=gap){x.beginPath();x.moveTo(x0+i,y0+h);x.lineTo(x0+i+h,y0);x.stroke()}
  x.restore();
}
function bill(solid,label){
  return sprite(BW,BH,function(x,w,h){
    var fg=solid?PAPER:INK, bg=solid?INK:PAPER;
    x.fillStyle=SHADOW;rr(x,4,4,w,h,7);x.fill();          // bayangan brutal
    x.fillStyle=bg;rr(x,0,0,w,h,7);x.fill();
    x.lineWidth=solid?0:4;x.strokeStyle=INK;if(!solid){rr(x,2,2,w-4,h-4,6);x.stroke()}
    x.strokeStyle=fg;x.lineWidth=2;rr(x,7,7,w-14,h-14,4);x.stroke();           // bingkai dalam
    hatch(x,11,11,w*0.2,h-22,fg,6);                                               // blok arsir kiri
    x.strokeStyle=fg;x.lineWidth=2.5;x.beginPath();x.arc(w*0.56,h/2,h*0.27,0,Math.PI*2);x.stroke();
    x.fillStyle=fg;x.font='800 '+Math.round(h*0.26)+'px '+FONT;x.textAlign='center';x.textBaseline='middle';
    x.fillText('Rp',w*0.56,h/2+1);
    x.font='700 '+Math.round(h*0.14)+'px '+MONO;x.textAlign='right';x.textBaseline='alphabetic';
    x.fillText(label,w-12,h-11);
    x.fillRect(w-12-Math.round(h*0.14),11,Math.round(h*0.14),Math.round(h*0.14));   // tanda kecil di pojok
  });
}
function coin(solid){
  return sprite(CD,CD,function(x,w,h){
    var fg=solid?PAPER:INK, bg=solid?INK:PAPER, r=w/2;
    x.fillStyle=SHADOW;x.beginPath();x.arc(r+3,r+3,r,0,Math.PI*2);x.fill();
    x.fillStyle=bg;x.beginPath();x.arc(r,r,r,0,Math.PI*2);x.fill();
    if(!solid){x.strokeStyle=INK;x.lineWidth=4;x.beginPath();x.arc(r,r,r-2,0,Math.PI*2);x.stroke()}
    x.strokeStyle=fg;x.lineWidth=2;x.setLineDash([3,4]);x.beginPath();x.arc(r,r,r-7,0,Math.PI*2);x.stroke();x.setLineDash([]);
    x.fillStyle=fg;x.font='800 '+Math.round(w*0.34)+'px '+FONT;x.textAlign='center';x.textBaseline='middle';
    x.fillText('Rp',r,r+1);
  });
}
var BILLS=[bill(true,'10K'),bill(true,'50K'),bill(false,'20K'),bill(false,'100K')];
var COINS=[coin(true),coin(false)];

/* ---------- tumpukan (digambar permanen ke layer terpisah) ---------- */
var pile=document.createElement('canvas');pile.width=cv.width;pile.height=cv.height;
var pctx=pile.getContext('2d');pctx.scale(dpr,dpr);
var BUCKET=10, NB=Math.ceil(W/BUCKET)+2, tops=[];
for(var b=0;b<NB;b++)tops.push(H+4);       // dasar layar sedikit di bawah tepi bawah
function topMin(x,hw){
  var a=clamp(Math.floor((x-hw)/BUCKET),0,NB-1), z=clamp(Math.floor((x+hw)/BUCKET),0,NB-1), m=1e9;
  for(var i=a;i<=z;i++)if(tops[i]<m)m=tops[i];
  return m;
}
function setTop(x,hw,y){
  var a=clamp(Math.floor((x-hw)/BUCKET),0,NB-1), z=clamp(Math.floor((x+hw)/BUCKET),0,NB-1);
  for(var i=a;i<=z;i++)if(y<tops[i])tops[i]=y;
}


/* ---------- daftar item (waktu muncul disebar, lebih rapat di tengah) ---------- */
var N=Math.round(clamp(W*H/5000,100,320));      // cadangan; yang benar-benar jatuh dibatasi PILE_TARGET
var PILE_TARGET=0.62*clamp(W/H,0.42,1);        // layar potret (HP) lebih sempit -> tumpukan menjulang, jadi batasnya diturunkan
//                            // batas PROYEKSI tinggi tumpukan (fraksi tinggi layar); tinggi nyata sekitar separuhnya
var projected=0;                                 // proyeksi dihitung dari item yang sudah dijatuhkan (termasuk yang masih di udara)
var G=3700*clamp(H/900,0.7,1.3);           // gravitasi (px/s^2)
var items=[];
for(var i=0;i<N;i++){
  var isCoin=Math.random()<0.36, spr=isCoin?COINS[(Math.random()*COINS.length)|0]:BILLS[(Math.random()*BILLS.length)|0];
  items.push({
    t:T_SPAWN*Math.pow(i/N,0.9)+rand(0,0.04), coin:isCoin, spr:spr,
    x0:0, y:-spr.h-rand(0,90), vy:rand(180,520),
    amp:isCoin?rand(4,14):rand(14,46), fq:rand(2.2,4.6), ph:rand(0,6.28),
    rot:rand(-3,3), vr:rand(-5,5), fl:rand(0,6.28), vf:rand(5,11),
    hw:(isCoin?CD:BW*0.8)/2, hh:(isCoin?CD:BH)/2*0.9, th:(isCoin?CD:BH)*0.46,
    x:0, live:false, done:false, age:0
  });
}
items.sort(function(a,b){return a.t-b.t});

/* ---------- loop ---------- */
var t0=performance.now(), prev=t0, next=0, falling=[], raf=0, exiting=false, stamped=false;
var lastPct=-1;

function drawItem(c,it,rot,sx,sy){
  c.save();c.translate(it.x,it.y);c.rotate(rot);c.scale(sx,sy);
  c.drawImage(it.spr.c,-it.spr.w/2,-it.spr.h/2,it.spr.w,it.spr.h);
  c.restore();
}
function frame(now){
  raf=requestAnimationFrame(frame);
  var t=(now-t0)/1000, dt=Math.min(0.04,(now-prev)/1000);prev=now;

  if(!exiting){
    while(next<items.length&&items[next].t<=t){
      var nw=items[next++];
      if(projected>=PILE_TARGET*H)continue;      // sudah cukup uang: item sisanya tidak dijatuhkan
      projected+=1.25*nw.hh*2*nw.hw/W;
      var bx=W/2, lowest=-1;
      for(var c=0;c<4;c++){                       // 4 kandidat x acak, pilih yang tumpukannya paling rendah
        var cx=rand(nw.hw/W,1-nw.hw/W)*W, cy=topMin(cx,nw.hw);   // tidak menggantung di tepi layar
        if(cy>lowest){lowest=cy;bx=cx}            // (y lebih besar = permukaan lebih rendah)
      }
      nw.x0=bx;falling.push(nw);nw.live=true;
    }
  }
  for(var i=falling.length-1;i>=0;i--){
    var it=falling[i];
    it.age+=dt;it.vy+=G*dt;it.y+=it.vy*dt;
    it.x=it.x0+Math.sin(it.age*it.fq+it.ph)*it.amp;
    it.rot+=it.vr*dt;it.fl+=it.vf*dt;
    var tm=topMin(it.x,it.hw);
    if(it.y+it.hh>=tm){
      // mendarat: gambar permanen ke layer tumpukan dengan sudut hampir rata
      it.y=tm-it.hh;
      var fr=it.coin?rand(-3.14,3.14):rand(-0.28,0.28);
      pctx.save();pctx.translate(it.x,it.y);pctx.rotate(fr);
      pctx.drawImage(it.spr.c,-it.spr.w/2,-it.spr.h/2,it.spr.w,it.spr.h);pctx.restore();
      setTop(it.x,it.hw,it.y-it.hh*0.25);    // permukaan baru sedikit di atas pusat item -> tumpukan saling menimpa seperti gundukan
      it.done=true;falling.splice(i,1);
    }
  }

  ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,cv.width,cv.height);
  ctx.drawImage(pile,0,0);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  for(var k=0;k<falling.length;k++){
    var f=falling[k], s=Math.max(0.14,Math.abs(Math.cos(f.fl)));
    if(f.coin)drawItem(ctx,f,f.rot,s,1);else drawItem(ctx,f,f.rot,1,s);   // koin berputar di sumbu Y, kertas terguling
  }

  var p=clamp(t/T_FILL,0,1);
  el.style.setProperty('--p',p.toFixed(4));
  var pc=Math.round(p*100);if(pc!==lastPct){lastPct=pc;if(pctEl)pctEl.textContent=pc+'%'}
  if(!stamped&&t>=T_STAMP){stamped=true;el.classList.add('is-stamp')}
  if(!exiting&&t>=T_EXIT)finish(false);
}

/* ---------- keluar ---------- */
function finish(fast){
  if(exiting)return;exiting=true;
  if(fast===true){el.classList.add('is-fast');el.style.setProperty('--p',1)}
  el.classList.add('is-exit');
  // app mulai "dicap" masuk begitu lembar mulai terangkat
  setTimeout(function(){window.dispatchEvent(new Event('duitku:splash-done'))},fast===true?40:220);
  var cleaned=false;
  function cleanup(){
    if(cleaned)return;cleaned=true;
    cancelAnimationFrame(raf);
    appParts().forEach(function(n){n.removeAttribute('inert')});
    root.classList.remove('splash-on');
    if(el.parentNode)el.parentNode.removeChild(el);
  }
  el.addEventListener('animationend',function(e){if(e.target===el)cleanup()});
  setTimeout(cleanup,fast===true?900:1500);   // jaring pengaman kalau animationend tidak terpicu
}

/* lewati: klik/tap di mana saja, atau Enter / Spasi / Esc */
el.addEventListener('pointerdown',function(){finish(true)});
document.addEventListener('keydown',function(e){
  if(!exiting&&(e.key==='Escape'||e.key==='Enter'||e.key===' ')){e.preventDefault();finish(true)}
});
if(skipBtn)skipBtn.addEventListener('click',function(e){e.stopPropagation();finish(true)});

raf=requestAnimationFrame(frame);
})();
