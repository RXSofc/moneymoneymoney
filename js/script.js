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
function typeIcon(t){return t==='masuk'?'&#8595;':t==='nabung'?'&#9733;':'&#8593;'}
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
  for(var r=0;r<2;r++){items.forEach(function(it){html+='<span>'+it+' <b class="star">&#9733;</b></span>'})}
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
}
document.querySelectorAll('input[name="type"]').forEach(function(r){
  r.addEventListener('change',refreshCategories);
});
refreshCategories();

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
  $('heroCount').textContent=txs.length;
  $('statIn').textContent=fmt(mIn);
  $('statOut').textContent=fmt(mOut);
  $('statSave').textContent=fmt(totalSave);

  renderChart();
  renderList();
  updateSyncDot();
}

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
    list.innerHTML='<div class="list-empty"><span class="big">&#127803;</span>Belum ada catatan'+(activeFilter!=='all'?' untuk kategori ini':'')+'.<br>Yuk mulai catat uangmu!</div>';
    return;
  }
  list.innerHTML=items.slice(0,60).map(function(x){
    var sign=x.type==='masuk'?'+':'&minus;';
    var dstr=x.date.split('-').reverse().join('/');
    return '<div class="tx tx-'+x.type+'" data-id="'+x.id+'">'+
      '<div class="tx-badge">'+typeIcon(x.type)+'</div>'+
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
