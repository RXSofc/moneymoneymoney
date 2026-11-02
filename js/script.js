(function(){
"use strict";

/* ================= STORAGE ================= */
var LS_TX='duitku_tx_v1', LS_SET='duitku_set_v1';
var txs=[], settings={scriptUrl:'',autoSync:true};
try{txs=JSON.parse(localStorage.getItem(LS_TX))||[]}catch(e){txs=[]}
try{var s=JSON.parse(localStorage.getItem(LS_SET));if(s)settings=Object.assign(settings,s)}catch(e){}
function saveTx(){localStorage.setItem(LS_TX,JSON.stringify(txs))}
function saveSet(){localStorage.setItem(LS_SET,JSON.stringify(settings))}

/* ================= HELPERS ================= */
function $(id){return document.getElementById(id)}
function fmt(n){return 'Rp '+Math.round(n).toLocaleString('id-ID')}
function todayStr(){var d=new Date();return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,10)}
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
function typeLabel(t){return t==='masuk'?'Masuk':t==='nabung'?'Menabung':'Keluar'}
function typeIconId(t){return t==='masuk'?'ic-down':t==='nabung'?'ic-target':'ic-up'}
function typeIconSvg(t){return '<svg class="icon" width="17" height="17"><use href="#'+typeIconId(t)+'"/></svg>'}
function monthKey(dstr){return dstr.slice(0,7)}
var BULAN=['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
var KATEGORI={
  masuk:['Gaji','Bonus','Freelance','Hadiah','Jualan','Lainnya'],
  nabung:['Tabungan Rutin','Dana Darurat','Target Barang','Investasi','Lainnya'],
  keluar:['Makan & Minum','Transportasi','Belanja','Tagihan','Hiburan','Kesehatan','Lainnya']
};

function toast(msg,kind){
  kind=kind||'ok';
  var el=document.createElement('div');
  el.className='toast '+kind;
  el.textContent=msg;
  $('toasts').appendChild(el);
  setTimeout(function(){el.classList.add('out');setTimeout(function(){el.remove()},320)},3200);
}

/* ================= TICKER ================= */
(function(){
  var items='CATAT PEMASUKAN|TABUNG RUTIN|SALDO SEHAT|SINKRON GOOGLE SHEETS|BEBAS BOCOR HALUS'.split('|');
  var html='';
  for(var r=0;r<2;r++){items.forEach(function(it){html+='<span>'+it+'<i class="sep"></i></span>'})}
  $('tickerTrack').innerHTML=html;
})();

/* ================= FORM ================= */
var amountInput=$('amount'), catSelect=$('category'), dateInput=$('date');
dateInput.value=todayStr();

amountInput.addEventListener('input',function(){
  var raw=this.value.replace(/\D/g,'');
  this.value=raw?Number(raw).toLocaleString('id-ID'):'';
});
function parseAmount(){return Number(amountInput.value.replace(/\./g,''))||0}

function getType(){var r=document.querySelector('input[name="type"]:checked');return r?r.value:'masuk'}
function refreshCategories(){
  var t=getType();
  catSelect.innerHTML=KATEGORI[t].map(function(c){return '<option value="'+esc(c)+'">'+esc(c)+'</option>'}).join('');
  $('categoryBtnLabel').textContent=catSelect.value;
}
document.querySelectorAll('input[name="type"]').forEach(function(r){
  r.addEventListener('change',refreshCategories);
});
refreshCategories();

/* ============ FOCUS TRAP (for the sheet popovers below) ============
   Without this, Tab/Shift+Tab walks right past the open sheet into
   background form fields that are visually hidden behind the backdrop —
   confusing and broken for keyboard users. Traps Tab inside `container`,
   closes on Escape, and restores focus to whatever triggered it on close. */
function trapFocus(container, closeFn){
  var lastFocused=document.activeElement;
  function focusables(){
    return Array.prototype.slice.call(
      container.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    ).filter(function(el){return el.offsetParent!==null});
  }
  function onKeydown(e){
    if(e.key==='Escape'){e.preventDefault();closeFn();return}
    if(e.key!=='Tab')return;
    var f=focusables();
    if(!f.length)return;
    var first=f[0],last=f[f.length-1];
    if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
    else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
  }
  container.addEventListener('keydown',onKeydown);
  var f0=focusables();
  if(f0.length)f0[0].focus();
  return function release(){
    container.removeEventListener('keydown',onKeydown);
    if(lastFocused&&lastFocused.focus)lastFocused.focus();
  };
}

/* ============ CUSTOM CATEGORY DROPDOWN ============
   Native <select> opens the OS's own picker on mobile (what the screenshots
   showed). This swaps in a themed bottom sheet instead. #category keeps
   getting its value set here, so submit/validation/CSV/sync logic below
   needs zero changes. */
(function(){
  var btn=$('categoryBtn'), backdrop=$('categoryBackdrop'), list=$('categoryList');
  var releaseFocus=null;

  function openCategoryPicker(){
    var t=getType();
    list.innerHTML=KATEGORI[t].map(function(c){
      var active=c===catSelect.value;
      return '<button type="button" class="'+(active?'active':'')+'" data-val="'+esc(c)+'" role="option" aria-selected="'+active+'">'+esc(c)+'</button>';
    }).join('');
    backdrop.classList.add('open');
    btn.setAttribute('aria-expanded','true');
    releaseFocus=trapFocus(backdrop.querySelector('.picker-sheet'),closeCategoryPicker);
  }
  function closeCategoryPicker(){
    backdrop.classList.remove('open');
    btn.setAttribute('aria-expanded','false');
    if(releaseFocus){releaseFocus();releaseFocus=null}
  }

  btn.addEventListener('click',openCategoryPicker);
  $('categoryClose').addEventListener('click',closeCategoryPicker);
  backdrop.addEventListener('click',function(e){if(e.target===backdrop)closeCategoryPicker()});
  list.addEventListener('click',function(e){
    var opt=e.target.closest('button[data-val]');
    if(!opt)return;
    catSelect.value=opt.getAttribute('data-val');
    $('categoryBtnLabel').textContent=catSelect.value;
    closeCategoryPicker();
  });
})();

/* ============ CUSTOM DATE PICKER ============
   Same idea for <input type="date"> — replaces the native OS calendar
   popover with a themed one. #date's value is still a plain YYYY-MM-DD
   string set here, so every existing reference to dateInput.value is
   unaffected. */
(function(){
  var btn=$('dateBtn'), backdrop=$('dateBackdrop');
  var grid=$('calGrid'), monthLabel=$('calMonthLabel');
  var HARI_FULL=['Minggu','Senin','Selasa','Rabu','Kamis','Jumat','Sabtu'];
  var viewYear, viewMonth; // 0-indexed month being displayed in the calendar

  function formatDateDisplay(iso){
    if(!iso)return '—';
    var p=iso.split('-'), y=+p[0], m=+p[1]-1, d=+p[2];
    var dt=new Date(y,m,d);
    return HARI_FULL[dt.getDay()].slice(0,3)+', '+String(d).padStart(2,'0')+' '+BULAN[m]+' '+y;
  }
  function syncLabel(){$('dateBtnLabel').textContent=formatDateDisplay(dateInput.value)}
  syncLabel();

  function pad2(n){return String(n).padStart(2,'0')}
  function isoOf(y,m,d){return y+'-'+pad2(m+1)+'-'+pad2(d)}

  function renderCalendar(){
    monthLabel.textContent=BULAN[viewMonth]+' '+viewYear;
    var first=new Date(viewYear,viewMonth,1);
    var startDow=first.getDay();
    var daysInMonth=new Date(viewYear,viewMonth+1,0).getDate();
    var daysInPrevMonth=new Date(viewYear,viewMonth,0).getDate();
    var todayIso=todayStr();
    var selIso=dateInput.value;
    var html='';
    for(var i=0;i<startDow;i++){
      var pd=daysInPrevMonth-startDow+1+i;
      html+='<span class="cal-day outside">'+pd+'</span>';
    }
    for(var d=1;d<=daysInMonth;d++){
      var iso=isoOf(viewYear,viewMonth,d);
      var cls=[];
      if(iso===todayIso)cls.push('today');
      if(iso===selIso)cls.push('selected');
      html+='<button type="button" class="cal-day '+cls.join(' ')+'" data-iso="'+iso+'">'+d+'</button>';
    }
    var total=startDow+daysInMonth;
    var next=1;
    while(total%7!==0){html+='<span class="cal-day outside">'+(next++)+'</span>';total++}
    grid.innerHTML=html;
  }

  var releaseFocus=null;
  function openDatePicker(){
    var base=dateInput.value?dateInput.value.split('-'):todayStr().split('-');
    viewYear=+base[0];viewMonth=+base[1]-1;
    renderCalendar();
    backdrop.classList.add('open');
    btn.setAttribute('aria-expanded','true');
    releaseFocus=trapFocus(backdrop.querySelector('.picker-sheet'),closeDatePicker);
  }
  function closeDatePicker(){
    backdrop.classList.remove('open');
    btn.setAttribute('aria-expanded','false');
    if(releaseFocus){releaseFocus();releaseFocus=null}
  }

  btn.addEventListener('click',openDatePicker);
  $('dateClose').addEventListener('click',closeDatePicker);
  backdrop.addEventListener('click',function(e){if(e.target===backdrop)closeDatePicker()});
  $('calPrev').addEventListener('click',function(){viewMonth--;if(viewMonth<0){viewMonth=11;viewYear--}renderCalendar()});
  $('calNext').addEventListener('click',function(){viewMonth++;if(viewMonth>11){viewMonth=0;viewYear++}renderCalendar()});
  $('calToday').addEventListener('click',function(){
    dateInput.value=todayStr();
    syncLabel();
    closeDatePicker();
  });
  grid.addEventListener('click',function(e){
    var day=e.target.closest('button[data-iso]');
    if(!day)return;
    dateInput.value=day.getAttribute('data-iso');
    syncLabel();
    closeDatePicker();
  });
})();

$('txForm').addEventListener('submit',function(ev){
  ev.preventDefault();
  var amount=parseAmount();
  if(amount<=0){toast('Jumlah harus lebih dari nol.','err');amountInput.focus();return}
  if(!dateInput.value){toast('Tanggal belum diisi.','err');dateInput.focus();return}
  var tx={
    id:'tx'+Date.now().toString(36)+Math.random().toString(36).slice(2,7),
    type:getType(),
    category:catSelect.value,
    amount:amount,
    date:dateInput.value,
    note:$('note').value.trim(),
    createdAt:Date.now()
  };
  txs.unshift(tx);
  saveTx();
  renderAll(true);
  toast('Catatan '+fmt(amount)+' tersimpan.','ok');
  amountInput.value='';$('note').value='';
  amountInput.focus();
  if(settings.autoSync&&settings.scriptUrl){sendToSheet({action:'add',item:tx},'Terkirim ke Google Sheets.')}
});

/* ================= RENDER ================= */
var displayedSaldo=0;
function countUp(el,to){
  var from=displayedSaldo, start=performance.now(), dur=650;
  if(Math.abs(to-from)<1){el.textContent=fmt(to);displayedSaldo=to;return}
  function frame(now){
    var p=Math.min(1,(now-start)/dur);
    var e=1-Math.pow(1-p,3);
    el.textContent=fmt(from+(to-from)*e);
    if(p<1)requestAnimationFrame(frame);else displayedSaldo=to;
  }
  requestAnimationFrame(frame);
}

function sumBy(pred){
  var t=0;
  txs.forEach(function(x){if(pred(x))t+=x.amount});
  return t;
}

function renderAll(animate){
  var nowKey=monthKey(todayStr());
  var totalIn=sumBy(function(x){return x.type==='masuk'});
  var totalOut=sumBy(function(x){return x.type==='keluar'});
  var totalSave=sumBy(function(x){return x.type==='nabung'});
  var saldo=totalIn-totalOut-totalSave;
  var mIn=sumBy(function(x){return x.type==='masuk'&&monthKey(x.date)===nowKey});
  var mOut=sumBy(function(x){return x.type==='keluar'&&monthKey(x.date)===nowKey});
  var mSave=sumBy(function(x){return x.type==='nabung'&&monthKey(x.date)===nowKey});

  if(animate){countUp($('heroAmount'),saldo)}
  else{$('heroAmount').textContent=fmt(saldo);displayedSaldo=saldo}
  $('heroMonthIn').textContent=fmt(mIn);
  $('heroMonthOut').textContent=fmt(mOut);
  $('listCount').textContent=txs.length+(txs.length===1?' tercatat':' tercatat');

  renderSplit(mOut,totalSave);
  renderChart();
  renderList();
  updateSyncDot();
}

/* ================= SPLIT CARD: Pengeluaran vs Tabungan ================= */
// Tabungan dan pengeluaran sengaja TIDAK dicampur secara visual — beda
// mental model (uang yang sudah dipakai vs uang yang sengaja disisihkan).
function categoryBreakdown(type, onlyThisMonth){
  var nowKey=monthKey(todayStr());
  var sums={};
  txs.forEach(function(x){
    if(x.type!==type)return;
    if(onlyThisMonth&&monthKey(x.date)!==nowKey)return;
    sums[x.category]=(sums[x.category]||0)+x.amount;
  });
  var total=0;
  Object.keys(sums).forEach(function(k){total+=sums[k]});
  return Object.keys(sums).map(function(k){return {label:k,amount:sums[k]}})
    .sort(function(a,b){return b.amount-a.amount})
    .slice(0,5)
    .map(function(row){return {label:row.label,amount:row.amount,pct:total?Math.round(row.amount/total*100):0}});
}

function renderBreakdown(elId,rows){
  var el=$(elId);
  if(!rows.length){
    el.innerHTML='<div class="break-empty">Belum ada data.</div>';
    return;
  }
  el.innerHTML=rows.map(function(r){
    return '<div class="break-row">'+
      '<span class="break-label">'+esc(r.label)+'</span>'+
      '<span class="break-bar-track"><span class="break-bar-fill" data-w="'+r.pct+'"></span></span>'+
      '<span class="break-val">'+fmt(r.amount)+'</span>'+
      '</div>';
  }).join('');
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    el.querySelectorAll('.break-bar-fill').forEach(function(f){f.style.width=f.getAttribute('data-w')+'%'});
  })});
}

function renderSplit(mOut,totalSave){
  $('splitOutAmount').textContent=fmt(mOut);
  $('splitSaveAmount').textContent=fmt(totalSave);
  renderBreakdown('breakOut',categoryBreakdown('keluar',true));
  renderBreakdown('breakSave',categoryBreakdown('nabung',false));
}

/* ============ KARAKTER 3D (sprite turntable) ============
   Frame hasil render model 3D (assets/char/f-0..N-1.webp) menyimpan satu putaran
   kepala dari kiri ke kanan. Karakter "menoleh" dengan memilih frame terdekat:
   - mengikuti jari saat card di-swipe, dan menoleh saat ganti tab
   - mengikuti kursor (mouse), dan goyang pelan saat diam
   Tanpa WebGL/library di runtime, jadi ringan. Kalau frame tidak ada, card jatuh
   ke layout penuh tanpa karakter. */
var splitArt={kick:function(){},drag:function(){},release:function(){}};
(function initSplitArt(){
  var cv=$('splitArt'), card=$('splitCard');
  var N=parseInt(cv.getAttribute('data-frames'),10)||9, tpl=cv.getAttribute('data-src');
  var ctx=cv.getContext('2d'), frames=[], loaded=0, failed=false;
  var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var REST=0.22;                       // -1 (kiri) .. +1 (kanan); sedikit menoleh ke arah konten
  var yaw=REST, vel=0, target=REST, lastPointer=0, dragOff=null, lastDrawn=-9, visible=true, running=false;

  function fail(){if(failed)return;failed=true;card.classList.add('no-art')}
  for(var i=0;i<N;i++){(function(i){
    var im=new Image();im.decoding='async';
    im.onload=function(){loaded++;if(loaded===N)start()};
    im.onerror=fail;
    im.src=tpl.replace('{i}',i);
    frames[i]=im;
  })(i)}

  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function draw(force){
    // snap ke frame terdekat (tanpa blend -> tidak ada bayangan ganda)
    var idx=Math.round((clamp(yaw,-1,1)+1)/2*(N-1));
    if(!force&&idx===lastDrawn)return;
    lastDrawn=idx;cv.setAttribute('data-frame',idx);
    ctx.clearRect(0,0,cv.width,cv.height);
    ctx.drawImage(frames[idx],0,0,cv.width,cv.height);
  }
  var t0=performance.now(), prev=t0;
  function tick(now){
    if(!running)return;
    var dt=Math.min(40,now-prev)/16.7;prev=now;
    var t=(now-t0)/1000;
    if(dragOff!==null){target=clamp(REST+dragOff,-1,1)}
    else if(now-lastPointer<2200){/* target diisi pointermove */}
    else{target=REST+0.24*Math.sin(t*1.1)}
    vel+=(target-yaw)*0.085*dt;      // pegas menuju target
    vel*=Math.pow(0.80,dt);          // redaman
    yaw+=vel*dt;
    draw(false);
    requestAnimationFrame(tick);
  }
  function start(){
    draw(true);
    if(reduce)return;                // tanpa animasi kalau user minta reduce motion
    run();
  }
  function run(){if(running||failed||reduce||!visible||document.hidden)return;running=true;prev=performance.now();requestAnimationFrame(tick)}
  function stop(){running=false}

  if('IntersectionObserver' in window){
    new IntersectionObserver(function(es){visible=es[0].isIntersecting;visible?run():stop()},{threshold:0.05}).observe(card);
  }
  document.addEventListener('visibilitychange',function(){document.hidden?stop():run()});

  window.addEventListener('pointermove',function(e){
    if(e.pointerType!=='mouse'||reduce)return;
    var r=cv.getBoundingClientRect();
    var cx=r.left+r.width*0.5;
    target=clamp((e.clientX-cx)/(window.innerWidth*0.38),-1,1);
    lastPointer=performance.now();
  },{passive:true});

  splitArt.kick=function(panel){      // ganti tab -> menoleh cepat ke arah konten baru lalu kembali
    if(reduce||failed)return;
    vel+=(panel===1?-1:1)*0.16;
  };
  splitArt.drag=function(dx){dragOff=clamp(dx/130,-1,1)*0.8};
  splitArt.release=function(){dragOff=null};
})();

(function initSplitSwipe(){
  var track=$('splitTrack'), viewport=$('splitViewport');
  var segBtns=document.querySelectorAll('.seg-btn');
  var dots=document.querySelectorAll('.split-dots .dot');
  var panel=0;

  function go(i){
    panel=i;
    track.classList.toggle('show-1',panel===1);
    $('splitCard').classList.toggle('is-save',panel===1);
    splitArt.kick(panel);
    segBtns.forEach(function(b){
      var active=Number(b.getAttribute('data-panel'))===panel;
      b.classList.toggle('active',active);
      b.setAttribute('aria-selected',active?'true':'false');
    });
    dots.forEach(function(d){d.classList.toggle('active',Number(d.getAttribute('data-dot'))===panel)});
  }

  segBtns.forEach(function(b){
    b.addEventListener('click',function(){go(Number(b.getAttribute('data-panel')))});
  });

  var startX=0,startY=0,dx=0,dragging=false;
  viewport.addEventListener('touchstart',function(e){
    startX=e.touches[0].clientX;startY=e.touches[0].clientY;dx=0;dragging=true;
  },{passive:true});
  viewport.addEventListener('touchmove',function(e){
    if(!dragging)return;
    dx=e.touches[0].clientX-startX;
    splitArt.drag(dx);
  },{passive:true});
  viewport.addEventListener('touchend',function(){
    if(!dragging)return;dragging=false;
    splitArt.release();
    if(Math.abs(dx)>42){
      if(dx<0&&panel===0)go(1);
      else if(dx>0&&panel===1)go(0);
    }
  });
})();

/* ================= CHART ================= */
function renderChart(){
  var area=$('chartArea');
  var months=[],d=new Date();
  d.setDate(1);
  for(var i=5;i>=0;i--){
    var m=new Date(d.getFullYear(),d.getMonth()-i,1);
    var key=m.getFullYear()+'-'+String(m.getMonth()+1).padStart(2,'0');
    months.push({key:key,label:BULAN[m.getMonth()],masuk:0,nabung:0,keluar:0});
  }
  var map={};months.forEach(function(m){map[m.key]=m});
  txs.forEach(function(x){
    var m=map[monthKey(x.date)];
    if(m)m[x.type]+=x.amount;
  });
  var max=0;
  months.forEach(function(m){max=Math.max(max,m.masuk,m.nabung,m.keluar)});
  if(max===0){
    area.innerHTML='<div class="chart-empty">Belum ada data.<br>Tambah catatan pertamamu di formulir!</div><div class="chart-x">'+months.map(function(m){return '<span>'+m.label+'</span>'}).join('')+'</div>';
    return;
  }
  var bars=months.map(function(m){
    function h(v){return v>0?Math.max(4,Math.round(v/max*100)):0}
    function bar(cls,v,lbl){
      return '<div class="bar '+cls+'" style="height:0%" data-h="'+h(v)+'">'+
        '<span class="tip">'+lbl+' '+fmt(v)+'</span></div>';
    }
    return '<div class="chart-group"><div class="chart-bars">'+
      bar('b-masuk',m.masuk,'Masuk:')+bar('b-nabung',m.nabung,'Tabung:')+bar('b-keluar',m.keluar,'Keluar:')+
      '</div></div>';
  }).join('');
  area.innerHTML='<div class="chart">'+bars+'</div><div class="chart-x">'+months.map(function(m){return '<span>'+m.label+'</span>'}).join('')+'</div>';
  requestAnimationFrame(function(){requestAnimationFrame(function(){
    area.querySelectorAll('.bar').forEach(function(b){b.style.height=b.getAttribute('data-h')+'%'});
  })});
}

/* ================= LIST ================= */
var activeFilter='all';
$('filters').addEventListener('click',function(e){
  var btn=e.target.closest('.chip');if(!btn)return;
  activeFilter=btn.getAttribute('data-f');
  this.querySelectorAll('.chip').forEach(function(c){c.classList.toggle('active',c===btn)});
  renderList();
});

function renderList(){
  var list=$('txList');
  var items=txs.filter(function(x){return activeFilter==='all'||x.type===activeFilter});
  if(items.length===0){
    list.innerHTML='<div class="list-empty"><svg class="icon" width="30" height="30"><use href="#ic-receipt"/></svg><br>Belum ada catatan'+(activeFilter!=='all'?' untuk kategori ini':'')+'.<br>Yuk mulai catat uangmu!</div>';
    return;
  }
  list.innerHTML=items.slice(0,60).map(function(x){
    var sign=x.type==='masuk'?'+':'&minus;';
    var dstr=x.date.split('-').reverse().join('/');
    return '<div class="tx tx-'+x.type+'" data-id="'+x.id+'">'+
      '<div class="tx-badge">'+typeIconSvg(x.type)+'</div>'+
      '<div class="tx-info"><b>'+esc(x.category)+(x.note?' &middot; '+esc(x.note):'')+'</b>'+
      '<small>'+typeLabel(x.type)+' &middot; '+dstr+'</small></div>'+
      '<div class="tx-amount">'+sign+' '+fmt(x.amount)+'</div>'+
      '<button class="tx-del" type="button" title="Hapus" aria-label="Hapus catatan">&times;</button>'+
      '</div>';
  }).join('');
}

$('txList').addEventListener('click',function(e){
  var btn=e.target.closest('.tx-del');if(!btn)return;
  var row=btn.closest('.tx');
  if(!btn.classList.contains('confirm')){
    btn.classList.add('confirm');btn.innerHTML='?';
    setTimeout(function(){if(btn.isConnected){btn.classList.remove('confirm');btn.innerHTML='&times;'}},2200);
    return;
  }
  var id=row.getAttribute('data-id');
  txs=txs.filter(function(x){return x.id!==id});
  saveTx();
  row.style.opacity='0';row.style.transform='translateX(24px)';
  setTimeout(function(){renderAll(false)},200);
  toast('Catatan dihapus.','info');
});

/* ================= GOOGLE SHEETS ================= */
function updateSyncDot(){
  var on=!!settings.scriptUrl;
  $('syncDot').classList.toggle('on',on);
  $('syncDotText').textContent=on?'Sheets terhubung':'Sheets belum terhubung';
}

function sendToSheet(payload,successMsg){
  if(!settings.scriptUrl){toast('Isi URL Web App dulu di pengaturan Sheets.','err');return Promise.resolve(false)}
  return fetch(settings.scriptUrl,{
    method:'POST',
    mode:'no-cors',
    headers:{'Content-Type':'text/plain;charset=utf-8'},
    body:JSON.stringify(payload)
  }).then(function(){
    if(successMsg)toast(successMsg,'ok');
    return true;
  }).catch(function(){
    toast('Gagal menghubungi Google Sheets. Cek koneksi & URL.','err');
    return false;
  });
}

$('btnSyncNow').addEventListener('click',function(){
  if(!settings.scriptUrl){openModal();toast('Tempel URL Web App dulu ya.','info');return}
  sendToSheet({action:'sync',items:txs},txs.length+' catatan dikirim ke Sheets.');
});

/* ================= MODAL ================= */
var modal=$('modal');
function openModal(){
  $('scriptUrl').value=settings.scriptUrl||'';
  $('autoSync').checked=settings.autoSync!==false;
  modal.classList.add('open');
}
function closeModal(){modal.classList.remove('open')}
$('btnSettings').addEventListener('click',openModal);
$('modalClose').addEventListener('click',closeModal);
modal.addEventListener('click',function(e){if(e.target===modal)closeModal()});
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal()});

$('saveSettings').addEventListener('click',function(){
  var url=$('scriptUrl').value.trim();
  if(url&&!/^https:\/\/script\.google(usercontent)?\.com\//.test(url)){
    toast('URL sepertinya bukan URL Apps Script yang valid.','err');return;
  }
  settings.scriptUrl=url;
  settings.autoSync=$('autoSync').checked;
  saveSet();updateSyncDot();
  toast('Pengaturan disimpan.','ok');
  closeModal();
});

$('testConn').addEventListener('click',function(){
  var url=$('scriptUrl').value.trim();
  if(!url){toast('Tempel URL dulu sebelum tes koneksi.','err');return}
  settings.scriptUrl=url;saveSet();updateSyncDot();
  sendToSheet({action:'ping'},'Koneksi terkirim! Cek apakah tidak ada error di Apps Script.');
});

$('syncAll').addEventListener('click',function(){
  if(txs.length===0){toast('Belum ada data untuk dikirim.','info');return}
  var url=$('scriptUrl').value.trim();
  if(url){settings.scriptUrl=url;saveSet();updateSyncDot()}
  sendToSheet({action:'sync',items:txs},txs.length+' catatan dikirim ke Sheets.');
});

$('copyScript').addEventListener('click',function(){
  var code=$('scriptCode').textContent;
  function done(){toast('Kode Apps Script tersalin.','ok')}
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(code).then(done,function(){fallback()});
  }else fallback();
  function fallback(){
    var ta=document.createElement('textarea');
    ta.value=code;document.body.appendChild(ta);ta.select();
    try{document.execCommand('copy');done()}catch(e){toast('Gagal menyalin, salin manual ya.','err')}
    ta.remove();
  }
});

/* ================= EXPORT CSV ================= */
$('exportCsv').addEventListener('click',function(){
  if(txs.length===0){toast('Belum ada data untuk diexport.','info');return}
  var rows=[['ID','Tanggal','Jenis','Kategori','Jumlah (Rp)','Catatan']];
  txs.forEach(function(x){rows.push([x.id,x.date,typeLabel(x.type),x.category,x.amount,(x.note||'').replace(/"/g,'""')])});
  var csv=rows.map(function(r){return r.map(function(c){return '"'+c+'"'}).join(',')}).join('\r\n');
  var blob=new Blob(['\ufeff'+csv],{type:'text/csv;charset=utf-8'});
  var a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='duitku-catatan-'+todayStr()+'.csv';
  document.body.appendChild(a);a.click();a.remove();
  toast('CSV berhasil diunduh.','ok');
});

/* ================= INIT ================= */
renderAll(false);
setTimeout(function(){renderAll(true)},100);

})();
