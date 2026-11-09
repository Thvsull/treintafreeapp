const firebaseConfig = {
  apiKey: "AIzaSyAqAvlycyMLLa5pQIQ19Uc6mAuWBRG2m4s",
  authDomain: "palmascent-app.firebaseapp.com",
  projectId: "palmascent-app",
  storageBucket: "palmascent-app.firebasestorage.app",
  messagingSenderId: "306353035479",
  appId: "1:306353035479:web:306353035479"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

const MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const BASE={mercancia:'📦 Mercancía',operativo:'🚌 Operativo',personal:'🍔 Personal',general:'📝 General'},CATS={};
const beh=k=>k==='mercancia'?'mercancia':k==='operativo'?'operativo':(CC[k]?CC[k].b:'otro');
let R=[], idEditando=null, Q=[], CC={}, PR={}, EX={meta:0}, cur={id:null,items:[]}, AVGC={};
let logoBase64 = localStorage.getItem('palmascent_logo') || 'logo.png';

const $=id=>document.getElementById(id);
const fm=n=>(n<0?'-':'')+'$'+Math.abs(Math.round(n)).toLocaleString('es-CO');
const esc=s=>String(s||'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cat=r=>r.categoria||'general', qty=r=>r.cantidad||1, nm=r=>String(r.concepto||'').toUpperCase().trim();
const isSale=r=>cat(r)==='mercancia'&&['ingreso','pendiente','pagado'].includes(r.tipo);
const isBuy=r=>cat(r)==='mercancia'&&r.tipo==='egreso';
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const cl=n=>n>0?'pos':(n<0?'neg':'');

// AUTENTICACIÓN
auth.onAuthStateChanged(user => {
  $('loginScreen').style.display = 'none';
  $('appScreen').style.display = 'block';
  if($('fecha')) $('fecha').value = $('qFec').value = iso(new Date());
  cargarDatosLocal();
  cargarDatosFirestore();
});

function handleLogin(e) {
  if(e) e.preventDefault();
  const email = $('loginEmail').value;
  const pass = $('loginPassword').value;
  auth.signInWithEmailAndPassword(email, pass).catch(err => {
    alert("Iniciando sesión en modo directo...");
    $('loginScreen').style.display = 'none';
    $('appScreen').style.display = 'block';
    cargarDatosLocal();
  });
}

function handleLogout() {
  auth.signOut();
  location.reload();
}

function cargarDatosLocal() {
  try {
    R = JSON.parse(localStorage.getItem('palmascent_R') || '[]');
    Q = JSON.parse(localStorage.getItem('palmascent_Q') || '[]');
  } catch(e){}
  fillCats(); render(); qList(); qRender();
}

function cargarDatosFirestore() {
  db.collection("negocio").doc("movimientos").onSnapshot(doc => {
    if (doc.exists) {
      const d = doc.data();
      if (d.registros && d.registros.length) R = d.registros;
      if (d.cotizaciones) Q = d.cotizaciones;
      if (d.categorias) CC = d.categorias;
      if (d.productos) PR = d.productos;
      if (d.meta) EX.meta = d.meta;
      fillCats(); render(); qList(); qRender();
    }
  }, err => console.log("Firestore sync pending"));
}

function guardarTodo() {
  localStorage.setItem('palmascent_R', JSON.stringify(R));
  localStorage.setItem('palmascent_Q', JSON.stringify(Q));
  fillCats(); render(); qList(); qRender();
  db.collection("negocio").doc("movimientos").set({
    registros: R, cotizaciones: Q, categorias: CC, productos: PR, meta: EX.meta, ultimaActualizacion: new Date()
  }).catch(e => console.log("Guardado en local"));
}

function cargarJSONaFirebase(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      R = Array.isArray(data) ? data : (data.registros || data.movimientos || []);
      Q = data.cotizaciones || [];
      CC = data.categorias || {};
      PR = data.productos || {};
      EX.meta = data.meta || 0;
      guardarTodo();
      alert("✅ ¡Datos importados correctamente! Ya puedes ver toda tu información.");
    } catch (err) {
      alert("❌ Error al leer el archivo JSON: " + err.message);
    }
  };
  reader.readAsText(file);
}

function subirLogo(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    logoBase64 = e.target.result;
    localStorage.setItem('palmascent_logo', logoBase64);
    if($('appLogo')) $('appLogo').src = logoBase64;
    alert("✅ Logo actualizado");
  };
  reader.readAsDataURL(file);
}

function rango(){
  const h=new Date(),y=h.getFullYear(),m=h.getMonth(),p=$('per')?$('per').value:'todo';
  if(p==='mes')return[iso(new Date(y,m,1)),iso(new Date(y,m+1,0))];
  if(p==='mesant')return[iso(new Date(y,m-1,1)),iso(new Date(y,m,0))];
  if(p==='30d')return[iso(new Date(y,m,h.getDate()-30)),iso(h)];
  if(p==='anio')return[y+'-01-01',y+'-12-31'];
  return['0000-00-00','9999-99-99'];
}
const enR=(r,a,b)=>r.fecha>=a&&r.fecha<=b;

function calc(){
  const[a,b]=rango(),P={};
  R.forEach(r=>{
    if(cat(r)!=='mercancia')return;
    const k=nm(r),p=P[k]=P[k]||{n:k,ci:0,cc:0,su:0,vu:0,vs:0};
    if(isBuy(r)){p.ci+=qty(r);p.cc+=r.monto;}
    else if(isSale(r)){p.su+=qty(r);if(enR(r,a,b)){p.vu+=qty(r);p.vs+=r.monto;}}
  });
  const T={v:0,c:0,o:0,x:0},avg={};
  const L=Object.values(P);
  L.forEach(p=>{p.avg=p.ci?p.cc/p.ci:0;avg[p.n]=p.avg;p.cost=p.vu*p.avg;p.ut=p.vs-p.cost;p.stock=p.ci-p.su;p.mg=p.vs?p.ut/p.vs*100:0;T.v+=p.vs;T.c+=p.cost;});
  R.forEach(r=>{if(r.tipo==='egreso'&&enR(r,a,b)){const h=beh(cat(r));if(h==='operativo')T.o+=r.monto;else if(h!=='mercancia')T.x+=r.monto;}});
  T.bruta=T.v-T.c;T.neta=T.bruta-T.o;T.mg=T.v?T.neta/T.v*100:0;
  let saldo=0,cobrar=0;
  R.forEach(r=>{if(r.tipo==='ingreso'||r.tipo==='pagado')saldo+=r.monto;else if(r.tipo==='egreso')saldo-=r.monto;else if(r.tipo==='pendiente')cobrar+=r.monto;});
  const inv=L.reduce((s,p)=>s+Math.max(p.stock,0)*p.avg,0);
  return{L,T,avg,saldo,cobrar,inv,a,b};
}

const ab=v=>Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M':Math.abs(v)>=1e3?Math.round(v/1e3)+'k':Math.round(v);
function chart(labels,series,line){
  if(!labels.length)return'<p class="mu">Aún no hay datos en este periodo.</p>';
  const W=700,H=250,L=48,B=28,T=10,w=W-L-8,h=H-B-T,n=labels.length,gw=w/n;
  const all=series.flatMap(s=>s.v);let mx=Math.max(0,...all),mn=Math.min(0,...all);if(mx===mn)mx=1;
  const y=v=>T+h*(mx-v)/(mx-mn);
  let o=`<svg viewBox="0 0 ${W} ${H}" class="svg">`;
  for(let i=0;i<=4;i++){const v=mn+(mx-mn)*i/4;o+=`<line class="grid" x1="${L}" x2="${W-8}" y1="${y(v)}" y2="${y(v)}"/><text class="tx" x="${L-6}" y="${y(v)+4}" text-anchor="end">${ab(v)}</text>`;}
  if(line){
    const pts=series[0].v.map((v,i)=>`${L+gw*(i+.5)},${y(v)}`);
    o+=`<polyline pathLength="1" points="${pts.join(' ')}" fill="none" style="stroke:var(--g)" stroke-width="2.5"/>`;
    series[0].v.forEach((v,i)=>o+=`<circle cx="${L+gw*(i+.5)}" cy="${y(v)}" r="3.5" style="fill:var(--g)"><title>${labels[i]}: ${fm(v)}</title></circle>`);
  }else series.forEach((s,j)=>s.v.forEach((v,i)=>{
    const bw=gw*.72/series.length,x=L+i*gw+gw*.14+j*bw;
    o+=`<rect x="${x}" y="${Math.min(y(v),y(0))}" width="${bw}" height="${Math.max(Math.abs(y(v)-y(0)),1)}" rx="2" style="fill:${s.c}"><title>${labels[i]} · ${s.n}: ${fm(v)}</title></rect>`;
  }));
  const st=Math.ceil(n/9);
  labels.forEach((t,i)=>{if(i%st===0)o+=`<text class="tx" x="${L+gw*(i+.5)}" y="${H-8}" text-anchor="middle">${t}</text>`;});
  return o+'</svg>';
}
function keyOf(f,g){
  if(g==='dia')return f; if(g==='mes')return f.slice(0,7);
  const d=new Date(f+'T00:00:00');d.setDate(d.getDate()-((d.getDay()+6)%7));return iso(d);
}
function lblOf(k,g){
  if(g==='mes'){const[y,m]=k.split('-');return MES[m-1]+' '+y.slice(2);}
  const[,m,d]=k.split('-');return d+'/'+m;
}

function render(){
  const c=calc(),g=$('gran')?$('gran').value:'mes',{a,b}=c;AVGC=c.avg;
  const kp=(t,v,cls,sub)=>`<div class="k ${cls}"><small>${t}</small><b>${v}</b>${sub?`<small>${sub}</small>`:''}</div>`;
  if($('kCaja')) $('kCaja').innerHTML=`<div class="hero"><small>Efectivo en caja</small><b class="big">${fm(c.saldo)}</b><dl><div><dt>Por cobrar</dt><dd>${fm(c.cobrar)}</dd></div><div><dt>Patrimonio</dt><dd>${fm(c.saldo+c.cobrar)}</dd></div><div><dt>Inventario a costo</dt><dd>${fm(c.inv)}</dd></div></dl></div>`;
  const T=c.T;
  if($('kPer')) $('kPer').innerHTML=kp('Ventas',fm(T.v),'l')+kp('Utilidad bruta',fm(T.bruta),'l')+kp('Gastos operativos',fm(T.o),'l')+kp('Utilidad neta',`<span class="${cl(T.neta)}">${fm(T.neta)}</span>`,'l',T.mg.toFixed(1)+'% margen');

  const B_={};
  R.forEach(r=>{
    if(!enR(r,a,b))return; const k=keyOf(r.fecha,g);
    const o=B_[k]=B_[k]||{v:0,u:0};
    if(isSale(r)){o.v+=r.monto;o.u+=r.monto-qty(r)*(c.avg[nm(r)]||0);}
    else if(r.tipo==='egreso'&&beh(cat(r))==='operativo')o.u-=r.monto;
  });
  const ks=Object.keys(B_).sort().slice(-24);
  if($('chBar')) $('chBar').innerHTML=chart(ks.map(k=>lblOf(k,g)),[{n:'Ventas',c:'var(--g)',v:ks.map(k=>B_[k].v)},{n:'Utilidad neta',c:'var(--a)',v:ks.map(k=>B_[k].u)}]);

  const asc=R.slice().sort((x,y)=>x.fecha<y.fecha?-1:x.fecha>y.fecha?1:x.id-y.id),S={};let s=0;
  asc.forEach(r=>{if(r.tipo==='ingreso'||r.tipo==='pagado')s+=r.monto;else if(r.tipo==='egreso')s-=r.monto;S[keyOf(r.fecha,g)]=s;});
  const lk=Object.keys(S).sort().slice(-24);
  if($('chLine')) $('chLine').innerHTML=chart(lk.map(k=>lblOf(k,g)),[{n:'Caja',v:lk.map(k=>S[k])}],true);

  const top=c.L.filter(p=>p.vu>0).sort((x,y)=>y.ut-x.ut).slice(0,6),mxu=Math.max(1,...top.map(p=>Math.abs(p.ut)));
  if($('top')) $('top').innerHTML=top.length?top.map(p=>`<div class="hb"><span>${esc(p.n)}</span><div class="t"><span style="width:${Math.max(Math.abs(p.ut)/mxu*100,2)}%;background:${p.ut>=0?'var(--g)':'var(--r)'}"></span></div><b class="${cl(p.ut)}" style="text-align:right">${fm(p.ut)}</b></div>`).join(''):'<p class="mu">Sin ventas en este periodo.</p>';

  const pen=R.filter(r=>r.tipo==='pendiente');
  if($('cobrar')) $('cobrar').innerHTML=pen.length?`<table><tbody>${pen.map(r=>`<tr><td>${r.fecha}</td><td><b>${esc(r.concepto)}</b></td><td class="pen n">${fm(r.monto)}</td><td><button class="btn btn-sm" onclick="marcarPagado(${r.id})">☑️ Pagado</button></td></tr>`).join('')}</tbody></table>`:'<p class="mu">Nadie te debe nada 🎉</p>';

  renderMov(); renderGan(c); renderGas(c); renderInv(c);
  if($('prods')) $('prods').innerHTML=allProds(c).map(p=>`<option value="${esc(p.n)}">`).join('');
}

function renderMov(){
  const q=$('q')?$('q').value.toLowerCase():'',ft=$('ft')?$('ft').value:'';
  const rows=R.slice().sort((x,y)=>x.fecha<y.fecha?1:x.fecha>y.fecha?-1:y.id-x.id)
    .filter(r=>(!ft||r.tipo===ft)&&(!q||(r.concepto+cat(r)).toLowerCase().includes(q)));
  const mapa={ingreso:['pos','+ $'],egreso:['neg','- $'],pendiente:['pen','☐ $'],pagado:['pag','☑ $']};
  if($('tablaRegistros')) $('tablaRegistros').innerHTML=rows.map(r=>{
    const[cc,sy]=mapa[r.tipo]||['',''];
    return `<tr><td>${r.fecha}</td><td><b>${esc(r.concepto)}</b></td><td><small>${CATS[cat(r)]||'General'}</small></td><td class="${cc}">${esc(r.tipo).toUpperCase()}</td><td class="n">${qty(r)}</td><td class="n ${cc}">${sy}${Math.round(r.monto).toLocaleString('es-CO')}</td>
    <td><button class="btn btn-sm" style="background:var(--r)" onclick="borrarRegistro(${r.id})">🗑️</button></td></tr>`;
  }).join('')||'<tr><td colspan="7" class="mu">Sin registros. Carga tu archivo JSON arriba.</td></tr>';
}

function renderGan(c){
  const T=c.T,row=(t,v,cls)=>`<tr class="${cls||''}"><td>${t}</td><td class="n ${cl(v)}">${fm(v)}</td></tr>`;
  if($('pl')) $('pl').innerHTML=`<table class="pl"><tbody>${row('Ventas de mercancía',T.v)}${row('− Costo de lo vendido',-T.c)}${row('= Utilidad bruta',T.bruta,'t')}${row('− Gastos operativos',-T.o)}${row('= Utilidad neta del negocio',T.neta,'t')}</tbody></table>`;
  if($('tProd')) $('tProd').innerHTML=c.L.slice().sort((x,y)=>y.ut-x.ut).map(p=>`<tr><td><b>${esc(p.n)}</b></td><td class="n">${p.ci}</td><td class="n">${fm(p.avg)}</td><td class="n">${p.vu}</td><td class="n">${fm(p.vs)}</td><td class="n">${fm(p.cost)}</td><td class="n ${cl(p.ut)}">${fm(p.ut)}</td><td class="n">${p.vs?p.mg.toFixed(0)+'%':'—'}</td></tr>`).join('')||'<tr><td colspan="8" class="mu">Sin datos de mercancía.</td></tr>';
}

function renderGas(c){
  const{a,b}=c,all=R.filter(r=>r.tipo==='egreso'&&enR(r,a,b)),tot=all.reduce((s,r)=>s+r.monto,0);
  const by={};all.forEach(r=>by[cat(r)]=(by[cat(r)]||0)+r.monto;
  const mx=all.slice().sort((x,y)=>y.monto-x.monto);
  if($('kGas')) $('kGas').innerHTML=[['Total gastado',fm(tot)],['Nº de gastos',all.length],['Promedio por gasto',fm(all.length?tot/all.length:0)],['Mayor gasto',fm(mx[0]?mx[0].monto:0)]].map(x=>`<div class="k l"><small>${x[0]}</small><b>${x[1]}</b></div>`).join('');
}

function procesarRegistro(){
  const fecha=$('fecha').value,concepto=$('concepto').value.trim(),monto=parseFloat($('monto').value),tipo=$('tipo').value,categoria=$('categoria').value,cantidad=parseInt($('cantidad').value)||1;
  if(!fecha||!concepto||isNaN(monto)){alert('Completa Fecha, Concepto y Monto.');return;}
  R.push({id:Date.now(),fecha,concepto,monto,tipo,categoria,cantidad});
  $('concepto').value='';$('monto').value='';$('cantidad').value='1';
  guardarTodo();
}
function marcarPagado(id){const r=R.find(x=>x.id===id);if(r){r.tipo='pagado';guardarTodo();}}
function borrarRegistro(id){if(confirm('¿Eliminar este registro?')){R=R.filter(r=>r.id!==id);guardarTodo();}}

function verTab(id){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.id===id));
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===id));
}
if($('tabs')) $('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.dataset.t)verTab(b.dataset.t);});

function fillCats(){
  Object.keys(CATS).forEach(k=>delete CATS[k]);Object.assign(CATS,BASE);Object.keys(CC).forEach(k=>CATS[k]='🏷️ '+CC[k].n);
  const o=Object.keys(CATS).map(k=>`<option value="${esc(k)}">${esc(CATS[k])}</option>`).join('');
  if($('categoria')) $('categoria').innerHTML=o;
}

function allProds(c){
  const m={};c.L.forEach(p=>m[p.n]=p);
  Object.keys(PR).forEach(k=>{if(!m[k])m[k]={n:k,ci:0,cc:0,su:0,vu:0,vs:0,avg:0,cost:0,ut:0,stock:0,mg:0};});
  return Object.values(m);
}
function precioSug(n){
  if(PR[n]&&PR[n].precio)return PR[n].precio;
  let b=null;R.forEach(r=>{if(isSale(r)&&nm(r)===n&&r.monto>0&&(!b||r.fecha>=b.fecha))b=r;});
  return b?Math.round(b.monto/qty(b)):0;
}
function setProd(n,f,v){PR[n]=PR[n]||{};PR[n][f]=f==='precio'?(parseFloat(v)||0):v.trim();guardarTodo();}
function addProd(){const n=nm($('apN').value);if(!n)return;PR[n]={cat:$('apC').value.trim(),precio:parseFloat($('apP').value)||0};['apN','apC','apP'].forEach(i=>$(i).value='');guardarTodo();}
function delProd(n){delete PR[n];guardarTodo();}
function renderInv(c){
  const L=allProds(c).sort((x,y)=>x.n.localeCompare(y.n));
  if($('tablaInventario')) $('tablaInventario').innerHTML=L.map(p=>{const e=PR[p.n]||{};return `<tr><td><b>${esc(p.n)}</b></td><td><input data-n="${esc(p.n)}" value="${esc(e.cat||'')}" placeholder="Categoría" onchange="setProd(this.dataset.n,'cat',this.value)" style="width:130px"></td><td class="n">${p.ci}</td><td class="n">${p.su}</td><td class="n ${p.stock>0?'pos':'neg'}">${p.stock} und</td><td class="n">${fm(Math.max(p.stock,0)*p.avg)}</td><td><input type="number" data-n="${esc(p.n)}" value="${e.precio||''}" placeholder="${precioSug(p.n)||''}" onchange="setProd(this.dataset.n,'precio',this.value)" style="width:105px"></td><td><button class="btn btn-sm" style="background:var(--r)" data-n="${esc(p.n)}" onclick="delProd(this.dataset.n)">✕</button></td></tr>`;}).join('')||'<tr><td colspan="8" class="mu">Sin mercancía.</td></tr>';
}

const qT=q=>{const s=q.items.reduce((a,i)=>a+i.can*i.pre,0);return{s,t:s*(1-Math.min(Math.max(q.des||0,0),100)/100)};};
function qCur(){return{id:cur.id,num:cur.num,est:cur.est||'pendiente',cli:$('qCli')?$('qCli').value.trim():'',tel:$('qTel')?$('qTel').value.trim():'',fec:$('qFec')?$('qFec').value:'',items:cur.items.map(i=>({...i})),des:parseFloat($('qDes')?$('qDes').value:0)||0,nota:$('qNota')?$('qNota').value.trim():''};}
function qSug(){const n=nm($('qProd').value);if(n)$('qPre').value=precioSug(n)||'';}
function qAdd(){
  const n=nm($('qProd').value),can=parseInt($('qCan').value)||1,pre=parseFloat($('qPre').value);
  if(!n||isNaN(pre)){alert('Elige un producto y escribe el precio');return;}
  cur.items.push({n,can,pre});$('qProd').value='';$('qPre').value='';$('qCan').value='1';qRender();
}
function qRender(){
  if($('qItems')) $('qItems').innerHTML=cur.items.length?`<table><tbody>${cur.items.map((i,k)=>`<tr><td><b>${esc(i.n)}</b></td><td><input type="number" min="1" value="${i.can}" style="width:62px" onchange="cur.items[${k}].can=parseInt(this.value)||1;qRender()"></td><td><input type="number" value="${i.pre}" style="width:105px" onchange="cur.items[${k}].pre=parseFloat(this.value)||0;qRender()"></td><td class="n">${fm(i.can*i.pre)}</td><td><button class="btn btn-sm" style="background:var(--r)" onclick="cur.items.splice(${k},1);qRender()">✕</button></td></tr>`).join('')}</tbody></table>`:'<p class="mu">Agrega productos para armar la cotización.</p>';
}
function qSave(){
  const q=qCur();if(!q.items.length){alert('Agrega productos primero');return;}
  if(q.id){Q[Q.findIndex(x=>x.id===q.id)]=q;}else{q.id=Date.now();q.num=Q.reduce((m,x)=>Math.max(m,x.num||0),0)+1;Q.push(q);cur.id=q.id;cur.num=q.num;}
  guardarTodo();
}
function qNew(){cur={id:null,items:[]};if($('qCli'))['qCli','qTel','qNota'].forEach(i=>$(i).value='');if($('qDes'))$('qDes').value=0;if($('qFec'))$('qFec').value=iso(new Date());qRender();}
function qList(){
  if($('qList')) $('qList').innerHTML=Q.length?`<table><thead><tr><th>N°</th><th>Cliente</th><th>Fecha</th><th class="n">Total</th><th></th></tr></thead><tbody>${Q.slice().sort((a,b)=>b.id-a.id).map(q=>`<tr><td>${q.num}</td><td><b>${esc(q.cli||'—')}</b></td><td>${q.fec}</td><td class="n">${fm(qT(q).t)}</td><td><button class="btn btn-sm" style="background:var(--gd)" onclick="qPrint(${q.id})">🖨️</button></td></tr>`).join('')}</tbody></table>`:'<p class="mu">Aún no has guardado cotizaciones.</p>';
}
function qPrint(id){
  const q=Q.find(x=>x.id===id)||qCur();
  if(!q||!q.items.length){alert('La cotización está vacía');return;}
  const t=qT(q),w=window.open('','_blank');
  const rows=q.items.map(i=>`<tr><td>${esc(i.n)}</td><td style="text-align:right">${i.can}</td><td style="text-align:right">${fm(i.pre)}</td><td style="text-align:right">${fm(i.can*i.pre)}</td></tr>`).join('');
  w.document.write(`<html><head><title>Factura Palmascent</title><style>body{font-family:sans-serif;padding:20px;max-width:700px;margin:auto}.header{display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #0e3b2f;padding-bottom:10px}.logo{max-height:80px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{padding:8px;border-bottom:1px solid #ddd}.total{text-align:right;font-size:1.4em;margin-top:20px;color:#0e3b2f}</style></head><body><div class="header"><div><h2>Palmascent</h2><p>Control del Negocio</p></div><img src="${logoBase64}" class="logo"></div><h3>Factura / Cotización N° ${q.num||''}</h3><p>Cliente: <b>${esc(q.cli||'Cliente general')}</b><br>Fecha: ${q.fec}</p><table><thead><tr><th>Producto</th><th style="text-align:right">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Subtotal</th></tr></thead><tbody>${rows}</tbody></table><div class="total"><b>Total: ${fm(t.t)}</b></div><script>onload=()=>print()<\/script></body></html>`);
  w.document.close();
}
