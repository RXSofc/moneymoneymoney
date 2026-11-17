/* ======================================================================
   DUITKU 2.0 — splash intro "Struk Disobek"

   Urutan (~3.5 detik, bisa dilewati kapan saja):
   1. Layar kertas struk. Uang kertas & koin hitam jatuh (canvas 2D): kertas
      melayang bergoyang, koin berputar, ada kedalaman (jauh = kecil & pelan),
      dan tiap lembar "mendarat" dengan pantulan kecil lalu menumpuk.
   2. Wordmark "DUITKU" terisi dari bawah seperti cairan bergelombang.
   3. Stempel "KAS DIBUKA" dicap; tumpukan uang tersentak karena hentakannya.
   4. Laci kas terbuka: tumpukan bergemuruh sebentar lalu RUNTUH, uang jatuh
      berhamburan keluar layar (dari bawah ke atas, menyebar dari tengah).
   5. Lembar struk disobek ke atas (tepi bergerigi) dan app muncul.

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
var fillEl=el.querySelector('.mark-fill');
if(!ctx){root.classList.remove('splash-on');el.parentNode.removeChild(el);return}   // tanpa canvas: lewati intro

/* ---------- alur waktu (detik) ---------- */
var T_SPAWN=1.2;      // uang jatuh selama ini
var T_FILL=1.55;      // wordmark penuh
var T_STAMP=1.75;     // stempel + hentakan
var T_OPEN=2.1;       // laci terbuka, tumpukan runtuh
var T_EXIT=2.75;      // lembar mulai disobek

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

/* ---------- permukaan tumpukan (tinggi per kolom) ---------- */
var BUCKET=10, NB=Math.ceil(W/BUCKET)+2, tops=[];
for(var b=0;b<NB;b++)tops.push(H+4);
function topMin(x,hw){
  var a=clamp(Math.floor((x-hw)/BUCKET),0,NB-1), z=clamp(Math.floor((x+hw)/BUCKET),0,NB-1), m=1e9;
  for(var i=a;i<=z;i++)if(tops[i]<m)m=tops[i];
  return m;
}
function setTop(x,hw,y){
  var a=clamp(Math.floor((x-hw)/BUCKET),0,NB-1), z=clamp(Math.floor((x+hw)/BUCKET),0,NB-1);
  for(var i=a;i<=z;i++)if(y<tops[i])tops[i]=y;
}

/* ---------- daftar item ---------- */
var SC=clamp(H/900,0.7,1.3);
var G=3500*SC;                                   // gravitasi (px/s^2)
var N=Math.round(clamp(W*H/5000,100,320));       // cadangan; yang benar-benar jatuh dibatasi PILE_TARGET
var PILE_TARGET=0.62*clamp(W/H,0.42,1);          // batas PROYEKSI tinggi tumpukan (fraksi tinggi layar); tinggi nyata kira-kira separuhnya
var projected=0;                                 // proyeksi dari item yang sudah dijatuhkan (termasuk yang masih di udara)
var items=[];
for(var i=0;i<N;i++){
  var isCoin=Math.random()<0.34;
  var spr=isCoin?COINS[(Math.random()*COINS.length)|0]:BILLS[(Math.random()*BILLS.length)|0];
  var z=rand(0.74,1.14);                         // kedalaman: kecil = jauh (lebih pelan, di belakang)
  items.push({
    // lebih rapat di awal lalu menetes, bukan seragam
    t:T_SPAWN*(1-Math.pow(1-i/N,1.6))+rand(0,0.035),
    coin:isCoin, spr:spr, z:z,
    x0:0, x:0, y:-spr.h*z-rand(0,110), vy:rand(150,420)*SC,
    vt:(isCoin?2150:1650)*SC*z,                  // kecepatan jatuh maksimum (hambatan udara)
    amp:isCoin?rand(5,16):rand(22,62), fq:rand(1.6,3.1), ph:rand(0,6.28),
    base:rand(-0.5,0.5), rAmp:isCoin?rand(0.1,0.4):rand(0.35,0.85),
    rot:0, fl:rand(0,6.28), vf:isCoin?rand(7,13):rand(2.4,5.2), s:1,
    hw:(isCoin?CD:BW*0.8)/2*z, hh:(isCoin?CD:BH)/2*0.9*z,
    age:0, vyLand:0, landAt:0, restRot:0, fallRot:0, sL:1, bounce:0, dr:null, rest:false
  });
}
items.sort(function(a,b){return a.t-b.t});

/* ---------- state ---------- */
var t0=performance.now(), prev=t0, next=0, raf=0;
var falling=[], pile=[];
var exiting=false, stamped=false, opened=false, openAt=0, stampAt=0, lastPct=-1;

function drawSprite(it,x,y,rot,sx,sy){
  var k=it.z;
  ctx.save();ctx.translate(x,y);ctx.rotate(rot);ctx.scale(sx*k,sy*k);
  ctx.drawImage(it.spr.c,-it.spr.w/2,-it.spr.h/2,it.spr.w,it.spr.h);
  ctx.restore();
}
/* wordmark terisi seperti cairan: tepi atasnya bergelombang */
function waveClip(p,t){
  var A=3, top=(1-p)*(100+A*2)-A, pts=[];
  for(var k=0;k<=25;k++)pts.push((k*4)+'% '+(top+A*Math.sin(k*0.55+t*8)).toFixed(2)+'%');
  return 'polygon('+pts.join(',')+',100% 100%,0% 100%)';
}

/* ---------- laci kas dibuka: tumpukan runtuh keluar layar ---------- */
function openFloor(fast){
  if(opened)return;opened=true;openAt=performance.now();
  pile.forEach(function(it){
    it.dr={
      d:fast?rand(0,0.06):((H-it.y)/H)*0.5+rand(0,0.1),     // yang paling bawah jatuh duluan
      vx:(it.x-W/2)/W*340+rand(-80,80),                      // menyebar dari tengah
      vy:rand(0,140), vr:rand(-4.5,4.5)
    };
  });
}

/* ---------- loop ---------- */
function frame(now){
  raf=requestAnimationFrame(frame);
  var t=(now-t0)/1000, dt=Math.min(0.1,(now-prev)/1000);prev=now;   // batas dt longgar: di perangkat lambat fisika tetap mengejar waktu

  // item baru mulai jatuh; x dipilih dari 4 kandidat yang tumpukannya paling rendah -> hasil rata
  if(!exiting&&!opened){
    while(next<items.length&&items[next].t<=t){
      var nw=items[next++];
      if(projected>=PILE_TARGET*H)continue;
      projected+=1.25*nw.hh*2*nw.hw/W;
      var bx=W/2, lowest=-1;
      for(var c=0;c<4;c++){
        var cx=rand(nw.hw/W,1-nw.hw/W)*W, cy=topMin(cx,nw.hw);
        if(cy>lowest){lowest=cy;bx=cx}
      }
      nw.x0=bx;falling.push(nw);
    }
  }

  // yang sedang jatuh: melayang (kertas) / berputar (koin), lalu mendarat
  for(var i=falling.length-1;i>=0;i--){
    var it=falling[i];
    it.age+=dt;
    it.vy=Math.min(it.vy+G*dt,it.vt);
    it.y+=it.vy*dt;
    var sw=Math.sin(it.age*it.fq+it.ph);
    it.x=it.x0+sw*it.amp;
    it.rot=it.base+Math.cos(it.age*it.fq+it.ph)*it.rAmp;   // miring searah ayunan, seperti kertas
    it.fl+=it.vf*dt;it.s=Math.max(0.16,Math.abs(Math.cos(it.fl)));
    if(!opened){
      var tm=topMin(it.x,it.hw);
      if(it.y+it.hh>=tm){
        it.y=tm-it.hh;it.vyLand=it.vy;it.landAt=now;
        it.fallRot=it.rot;it.sL=it.s;
        it.restRot=it.coin?rand(-3.14,3.14):rand(-0.28,0.28);
        it.bounce=Math.min(it.vy*0.028,20*SC);it.rest=true;
        setTop(it.x,it.hw,it.y-it.hh*0.25);
        pile.push(it);falling.splice(i,1);continue;
      }
    }
    if(it.y-it.hh>H+90)falling.splice(i,1);                // jatuh keluar layar
  }

  // runtuh: item di tumpukan yang sudah waktunya jatuh
  if(opened){
    var to=(now-openAt)/1000;
    for(var j=pile.length-1;j>=0;j--){
      var p=pile[j];
      if(!p.dr||to<p.dr.d)continue;
      if(p.rest){   // kunci pose terakhir lalu lepas
        var st0=(now-p.landAt)/1000, e0=Math.exp(-st0*11);
        p.rot=p.restRot+(p.fallRot-p.restRot)*e0;p.s=1-(1-p.sL)*Math.exp(-st0*16);p.rest=false;
      }
      p.dr.vy+=G*1.15*dt;p.y+=p.dr.vy*dt;p.x+=p.dr.vx*dt;p.rot+=p.dr.vr*dt;
      if(p.y-p.hh>H+120||p.x<-300||p.x>W+300)pile.splice(j,1);
    }
  }

  /* hentakan stempel + gemuruh sebelum laci terbuka */
  var sx=0, sy=0;
  if(stampAt){var ts=(now-stampAt)/1000;if(ts<0.6)sy=10*SC*Math.exp(-7*ts)*Math.sin(ts*34)}
  if(!opened&&t>=T_OPEN-0.22&&t<T_OPEN){sx=rand(-2.6,2.6);sy+=rand(-2.6,2.6)}

  ctx.setTransform(dpr,0,0,dpr,sx*dpr,sy*dpr);
  ctx.clearRect(-20,-20,W+40,H+40);
  for(var m=0;m<pile.length;m++){
    var q=pile[m];
    if(q.rest){
      var st=(now-q.landAt)/1000, e=Math.exp(-st*11);     // mendarat: pantul kecil, miring & gepeng mengendap
      var y=q.y-q.bounce*e*Math.abs(Math.sin(st*20));
      var s=1-(1-q.sL)*Math.exp(-st*16);
      var r=q.restRot+(q.fallRot-q.restRot)*e;
      if(q.coin)drawSprite(q,q.x,y,r,s,1);else drawSprite(q,q.x,y,r,1,s);
    }else{
      if(q.coin)drawSprite(q,q.x,q.y,q.rot,q.s||1,1);else drawSprite(q,q.x,q.y,q.rot,1,q.s||1);
    }
  }
  falling.sort(function(a,b){return a.z-b.z});
  for(var k=0;k<falling.length;k++){
    var f=falling[k];
    if(f.coin)drawSprite(f,f.x,f.y,f.rot,f.s,1);else drawSprite(f,f.x,f.y,f.rot,1,f.s);
  }

  el.setAttribute('data-live',String(pile.length+falling.length));   // jumlah uang yang masih ada di layar (dipakai tes; sangat murah)

  /* progres, wordmark cair, stempel, buka laci, sobek */
  var x=clamp(t/T_FILL,0,1), p=x*x*(3-2*x);
  el.style.setProperty('--p',p.toFixed(4));
  if(fillEl)fillEl.style.clipPath=waveClip(p,t);
  var pc=Math.round(p*100);if(pc!==lastPct){lastPct=pc;if(pctEl)pctEl.textContent=pc+'%'}
  if(!stamped&&t>=T_STAMP){stamped=true;stampAt=now;el.classList.add('is-stamp')}
  if(!opened&&t>=T_OPEN)openFloor(false);
  // lembar baru disobek setelah uangnya habis (atau setelah batas waktu, di perangkat yang sangat lambat)
  if(!exiting&&t>=T_EXIT&&(pile.length+falling.length<=6||t>=T_EXIT+1.0))finish(false);
}

/* ---------- keluar ---------- */
function finish(fast){
  if(exiting)return;exiting=true;
  openFloor(fast===true);                      // kalau dilewati sebelum waktunya, uang tetap runtuh keluar
  if(fast===true){el.classList.add('is-fast');el.style.setProperty('--p',1);if(fillEl)fillEl.style.clipPath=waveClip(1,0)}
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
