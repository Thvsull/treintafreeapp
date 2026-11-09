const KEY='palmascent_data', MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const BASE={mercancia:'📦 Mercancía',operativo:'🚌 Operativo',personal:'🍔 Personal',general:'📝 General'},CATS={};
const beh=k=>k==='mercancia'?'mercancia':k==='operativo'?'operativo':(CC[k]?CC[k].b:'otro');
let R=[],idEditando=null,Q=[],CC={},PR={},EX={meta:0},cur={id:null,items:[]},AVGC={},CL=[],EMP={};
const $=id=>document.getElementById(id);
const fm=n=>(n<0?'-':'')+'$'+Math.abs(Math.round(n)).toLocaleString('es-CO');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cat=r=>r.categoria||'general', qty=r=>r.cantidad||1, nm=r=>String(r.concepto).toUpperCase().trim();
const isSale=r=>cat(r)==='mercancia'&&['ingreso','pendiente','pagado'].includes(r.tipo);
const isBuy=r=>cat(r)==='mercancia'&&r.tipo==='egreso';
const iso=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
const cl=n=>n>0?'pos':(n<0?'neg':'');

function guardarEnLocal(sinNube){
  try{localStorage.setItem(KEY,JSON.stringify(R));localStorage.setItem(KEY+'_extra',JSON.stringify({cotizaciones:Q,categorias:CC,productos:PR,meta:EX.meta,clientes:CL,empresa:EMP}));
    if(!sinNube){TS=Date.now();localStorage.setItem(KEY+'_ts',TS);}}catch(e){}
  if(!sinNube)empujar();
}
function cargarDeLocal(){
  try{const d=JSON.parse(localStorage.getItem(KEY)||'[]'); R=Array.isArray(d)?d:[];}catch(e){R=[];}
  try{const x=JSON.parse(localStorage.getItem(KEY+'_extra')||'{}');Q=x.cotizaciones||[];CC=x.categorias||{};PR=x.productos||{};EX.meta=x.meta||0;CL=x.clientes||[];EMP=x.empresa||{};}catch(e){}
  $('fecha').value=$('qFec').value=iso(new Date());document.body.classList.add('intro');fillCats();render();qList();qRender();setTimeout(()=>document.body.classList.remove('intro'),1500);
}

/* ---------- periodo ---------- */
function rango(){
  const h=new Date(),y=h.getFullYear(),m=h.getMonth(),p=$('per').value;
  if(p==='mes')return[iso(new Date(y,m,1)),iso(new Date(y,m+1,0))];
  if(p==='mesant')return[iso(new Date(y,m-1,1)),iso(new Date(y,m,0))];
  if(p==='30d')return[iso(new Date(y,m,h.getDate()-30)),iso(h)];
  if(p==='anio')return[y+'-01-01',y+'-12-31'];
  return['0000-00-00','9999-99-99'];
}
const enR=(r,a,b)=>r.fecha>=a&&r.fecha<=b;

/* ---------- cálculos ---------- */
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
  R.forEach(r=>{if(r.tipo==='ingreso'||r.tipo==='pagado')saldo+=r.monto;else if(r.tipo==='egreso')saldo-=r.monto;else if(r.tipo==='pendiente')cobrar+=r.monto;else if(r.tipo==='abono'){saldo+=r.monto;cobrar-=r.monto;}});
  const inv=L.reduce((s,p)=>s+Math.max(p.stock,0)*p.avg,0);
  return{L,T,avg,saldo,cobrar,inv,a,b};
}

/* ---------- gráficos SVG ---------- */
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

/* ---------- render ---------- */
function render(){
  const c=calc(),g=$('gran').value,{a,b}=c;AVGC=c.avg;
  /* KPIs */
  const kp=(t,v,cls,sub)=>`<div class="k ${cls}"><small>${t}</small><b>${v}</b>${sub?`<small>${sub}</small>`:''}</div>`;
  $('kCaja').innerHTML=`<div class="hero"><svg class="frond" viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M20 190C40 120 90 70 190 40M20 190C60 130 120 100 195 95M20 190C80 150 140 140 190 150M20 190C30 110 60 50 120 10M20 190C20 130 30 80 60 20"/></svg><small>Efectivo en caja</small><b class="big">${fm(c.saldo)}</b><dl><div><dt>Por cobrar</dt><dd>${fm(c.cobrar)}</dd></div><div><dt>Patrimonio (caja + cobrar)</dt><dd>${fm(c.saldo+c.cobrar)}</dd></div><div><dt>Inventario a costo</dt><dd>${fm(c.inv)}</dd></div></dl></div>`;
  if(document.body.classList.contains('intro'))countUp(document.querySelector('.hero .big'),c.saldo);
  const T=c.T;
  $('kPer').innerHTML=kp('Ventas',fm(T.v),'l')+kp('Utilidad bruta',fm(T.bruta),'l')+kp('Gastos operativos',fm(T.o),'l')+kp('Utilidad neta',`<span class="${cl(T.neta)}">${fm(T.neta)}</span>`,'l',T.mg.toFixed(1)+'% margen');

  /* barras por periodo */
  const B_={};
  R.forEach(r=>{
    if(!enR(r,a,b))return; const k=keyOf(r.fecha,g);
    const o=B_[k]=B_[k]||{v:0,u:0};
    if(isSale(r)){o.v+=r.monto;o.u+=r.monto-qty(r)*(c.avg[nm(r)]||0);}
    else if(r.tipo==='egreso'&&beh(cat(r))==='operativo')o.u-=r.monto;
  });
  const ks=Object.keys(B_).sort().slice(-24);
  $('chBar').innerHTML=chart(ks.map(k=>lblOf(k,g)),[{n:'Ventas',c:'var(--g)',v:ks.map(k=>B_[k].v)},{n:'Utilidad neta',c:'var(--a)',v:ks.map(k=>B_[k].u)}]);

  /* línea de caja */
  const asc=R.slice().sort((x,y)=>x.fecha<y.fecha?-1:x.fecha>y.fecha?1:x.id-y.id),S={};let s=0;
  asc.forEach(r=>{if(r.tipo==='ingreso'||r.tipo==='pagado'||r.tipo==='abono')s+=r.monto;else if(r.tipo==='egreso')s-=r.monto;S[keyOf(r.fecha,g)]=s;});
  const lk=Object.keys(S).sort().slice(-24);
  $('chLine').innerHTML=chart(lk.map(k=>lblOf(k,g)),[{n:'Caja',v:lk.map(k=>S[k])}],true);

  /* top productos */
  const top=c.L.filter(p=>p.vu>0).sort((x,y)=>y.ut-x.ut).slice(0,6),mxu=Math.max(1,...top.map(p=>Math.abs(p.ut)));
  $('top').innerHTML=top.length?top.map(p=>`<div class="hb"><span>${esc(p.n)}</span><div class="t"><span style="width:${Math.max(Math.abs(p.ut)/mxu*100,2)}%;background:${p.ut>=0?'var(--g)':'var(--r)'}"></span></div><b class="${cl(p.ut)}" style="text-align:right">${fm(p.ut)}</b></div>`).join(''):'<p class="mu">Sin ventas en este periodo.</p>';

  /* por cobrar */
  const D=deu(),dk=Object.keys(D).filter(k=>D[k]>0).sort((x,y)=>D[y]-D[x]);
  $('cobrar').innerHTML=dk.length?`<table><tbody>${dk.map(k=>`<tr><td><b>${esc(k)}</b></td><td class="pen n">${fm(D[k])}</td><td><button class="btn b s" data-n="${esc(k)}" onclick="abonar(this.dataset.n)">Abonar</button> <button class="btn s" data-n="${esc(k)}" onclick="abonar(this.dataset.n,1)">Pagó todo</button></td></tr>`).join('')}</tbody></table>`:'<p class="mu">Nadie te debe nada 🎉</p>';

  /* alertas */
  const al=[];
  const neg=c.L.filter(p=>p.stock<0),sc=c.L.filter(p=>p.su>0&&p.ci===0);
  if(neg.length)al.push(`⚠️ Stock negativo (vendiste más de lo comprado): <b>${neg.map(p=>esc(p.n)).join(', ')}</b>`);
  if(sc.length)al.push(`⚠️ Productos vendidos sin compra registrada (su utilidad se ve inflada): <b>${sc.map(p=>esc(p.n)).join(', ')}</b>`);
  const low=c.L.filter(p=>p.stock===1);if(low.length)al.push(`📉 Casi agotados (queda 1 und): <b>${low.map(p=>esc(p.n)).join(', ')}</b>`);
  $('alertas').innerHTML=al.map(t=>`<div class="al">${t}</div>`).join('');

  renderMov(); renderGan(c); renderCatP(c); renderGas(c); renderInv(c); renderMeta(); renderCar();
  $('prods').innerHTML=allProds(c).map(p=>`<option value="${esc(p.n)}">`).join('');
}

function renderMov(){
  const q=$('q').value.toLowerCase(),ft=$('ft').value;
  const rows=R.slice().sort((x,y)=>x.fecha<y.fecha?1:x.fecha>y.fecha?-1:y.id-x.id)
    .filter(r=>(!ft||r.tipo===ft)&&(!q||(r.concepto+cat(r)).toLowerCase().includes(q)));
  const mapa={ingreso:['pos','+ $'],egreso:['neg','- $'],pendiente:['pen','☐ $'],pagado:['pag','☑ $'],abono:['pag','+ $']};
  $('tablaRegistros').innerHTML=rows.map(r=>{
    const[cc,sy]=mapa[r.tipo]||['',''];
    return `<tr><td>${r.fecha}</td><td><b>${esc(r.concepto)}</b>${r.cliente?` <small class="mu">· ${esc(r.cliente)}</small>`:''}</td><td><small>${CATS[cat(r)]}</small></td><td class="${cc}">${esc(r.tipo).toUpperCase()}</td><td class="n">${qty(r)}</td><td class="n ${cc}">${sy}${Math.round(r.monto).toLocaleString('es-CO')}</td>
    <td>${r.tipo==='pendiente'?`<button class="btn b s" onclick="marcarPagado(${r.id})">☑️</button> `:''}<button class="btn o s" onclick="editarRegistro(${r.id})">✏️</button> <button class="btn r s" onclick="borrarRegistro(${r.id})">🗑️</button></td></tr>`;
  }).join('')||'<tr><td colspan="7" class="mu">Sin registros.</td></tr>';
}

function renderGan(c){
  const T=c.T,row=(t,v,cls)=>`<tr class="${cls||''}"><td>${t}</td><td class="n ${cl(v)}">${fm(v)}</td></tr>`;
  $('pl').innerHTML=`<table class="pl"><tbody>${row('Ventas de mercancía',T.v)}${row('− Costo de lo vendido',-T.c)}${row('= Utilidad bruta',T.bruta,'t')}${row('− Gastos operativos',-T.o)}${row('= Utilidad neta del negocio',T.neta,'t')}</tbody></table>
  <p class="mu">Margen neto: <b>${T.mg.toFixed(1)}%</b> · Retiros personales y otros gastos en el periodo: <b>${fm(T.x)}</b></p>`;
  $('tProd').innerHTML=c.L.slice().sort((x,y)=>y.ut-x.ut).map(p=>`<tr><td><b>${esc(p.n)}</b></td><td class="n">${p.ci}</td><td class="n">${fm(p.avg)}</td><td class="n">${p.vu}</td><td class="n">${fm(p.vs)}</td><td class="n">${fm(p.cost)}</td><td class="n ${cl(p.ut)}">${fm(p.ut)}</td><td class="n">${p.vs?p.mg.toFixed(0)+'%':'—'}</td></tr>`).join('')||'<tr><td colspan="8" class="mu">Sin datos de mercancía.</td></tr>';
  const sel=$('cpProd'),v=sel.value;
  sel.innerHTML='<option value="">Elegir producto…</option>'+c.L.map(p=>`<option value="${p.avg}">${esc(p.n)} (${fm(p.avg)})</option>`).join('');sel.value=v;cpCalc();
}
function cpSel(){const v=$('cpProd').value;if(v!=='')$('cpCosto').value=Math.round(v);cpCalc();}
function cpCalc(){
  const co=parseFloat($('cpCosto').value),m=parseFloat($('cpMg').value);
  $('cpRes').innerHTML=(co>0&&m>=0&&m<100)?`<div class="k" style="background:var(--g)"><small>Precio de venta sugerido</small><b>${fm(Math.ceil(co/(1-m/100)/500)*500)}</b><small>Ganancia por unidad ≈ ${fm(Math.ceil(co/(1-m/100)/500)*500-co)} (redondeado a $500)</small></div>`:'<p class="mu">Ingresa un costo y un margen para ver el precio.</p>';
}

function renderGas(c){
  const{a,b}=c,all=R.filter(r=>r.tipo==='egreso'&&enR(r,a,b)),tot=all.reduce((s,r)=>s+r.monto,0);
  const by={};all.forEach(r=>by[cat(r)]=(by[cat(r)]||0)+r.monto);
  const mx=all.slice().sort((x,y)=>y.monto-x.monto);
  $('kGas').innerHTML=[['Total gastado',fm(tot)],['Nº de gastos',all.length],['Promedio por gasto',fm(all.length?tot/all.length:0)],['Mayor gasto',fm(mx[0]?mx[0].monto:0)]].map(x=>`<div class="k l"><small>${x[0]}</small><b>${x[1]}</b></div>`).join('');
  $('gCat').innerHTML=Object.keys(CATS).map(k=>`<div class="hb"><span>${CATS[k]}</span><div class="t"><span style="width:${tot?(by[k]||0)/tot*100:0}%"></span></div><b style="text-align:right">${fm(by[k]||0)}</b></div>`).join('')+`<p class="mu">Las compras de mercancía son inversión: se recuperan al vender.</p>`;
  $('gTop').innerHTML=mx.slice(0,5).map(r=>`<div class="hb" style="grid-template-columns:1fr 90px"><span>${esc(r.concepto)} <small class="mu">${r.fecha}</small></span><b class="neg" style="text-align:right">${fm(r.monto)}</b></div>`).join('')||'<p class="mu">Sin gastos en este periodo.</p>';
  const f=$('gf').value,q=$('gq').value.toLowerCase();
  const rows=all.filter(r=>(!f||cat(r)===f)&&(!q||r.concepto.toLowerCase().includes(q))).sort((x,y)=>x.fecha<y.fecha?1:x.fecha>y.fecha?-1:y.id-x.id);
  $('tGas').innerHTML=rows.map(r=>`<tr><td>${r.fecha}</td><td><b>${esc(r.concepto)}</b></td><td><small>${CATS[cat(r)]}</small></td><td class="n">${qty(r)}</td><td class="n neg">${fm(r.monto)}</td></tr>`).join('')+(rows.length?`<tr class="pl t"><td colspan="4"><b>Total filtrado</b></td><td class="n neg"><b>${fm(rows.reduce((s,r)=>s+r.monto,0))}</b></td></tr>`:'<tr><td colspan="5" class="mu">Sin gastos.</td></tr>');
}

/* ---------- CRUD ---------- */
function procesarRegistro(){
  const fecha=$('fecha').value,concepto=$('concepto').value.trim(),monto=parseFloat($('monto').value),tipo=$('tipo').value,categoria=$('categoria').value,cantidad=parseInt($('cantidad').value)||1;
  if(!fecha||!concepto||isNaN(monto)){alert('Completa Fecha, Concepto y Monto.');return;}
  if(idEditando!==null){
    const i=R.findIndex(r=>r.id===idEditando);
    if(i!==-1){const t=(R[i].tipo==='pagado'&&tipo==='pendiente')?'pagado':tipo;R[i]={...R[i],id:idEditando,fecha,concepto,monto,tipo:t,categoria,cantidad,cliente:$('cliente').value.trim()||undefined};}
    cancelarEdicion();
  }else{
    R.push({id:Date.now(),fecha,concepto,monto,tipo,categoria,cantidad,...($('cliente').value.trim()?{cliente:$('cliente').value.trim()}:{})});
    $('concepto').value='';$('monto').value='';$('cantidad').value='1';$('cliente').value='';
  }
  guardarEnLocal();render();
}
function editarRegistro(id){
  const r=R.find(x=>x.id===id);if(!r)return;
  $('fecha').value=r.fecha;$('concepto').value=r.concepto;$('monto').value=r.monto;
  $('tipo').value=r.tipo==='pagado'?'pendiente':r.tipo;$('categoria').value=cat(r);$('cantidad').value=qty(r);$('cliente').value=r.cliente||'';
  idEditando=id;$('btnAccion').innerText='Guardar cambios';$('btnAccion').classList.add('o');$('btnCancelar').style.display='block';
  verTab('finanzas');$('formularioArea').scrollIntoView({behavior:'smooth'});
}
function cancelarEdicion(){
  idEditando=null;$('btnAccion').innerText='Agregar registro';$('btnAccion').classList.remove('o');$('btnCancelar').style.display='none';
  $('concepto').value='';$('monto').value='';$('cantidad').value='1';$('cliente').value='';
}
function marcarPagado(id){const r=R.find(x=>x.id===id);if(!r)return;if(r.cliente)R.push({id:Date.now(),fecha:iso(new Date()),concepto:'Pago '+r.concepto,monto:r.monto,tipo:'abono',categoria:'general',cantidad:1,cliente:r.cliente});else r.tipo='pagado';guardarEnLocal();render();}
function borrarRegistro(id){if(confirm('¿Estás seguro de eliminar este registro?')){R=R.filter(r=>r.id!==id);guardarEnLocal();render();}}

/* ---------- pestañas ---------- */
function verTab(id){
  window.scrollTo(0,0);$('tabs').classList.remove('open');
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.id===id));
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===id));
}
$('tabs').addEventListener('click',e=>{const b=e.target.closest('button');if(b&&b.dataset.t)verTab(b.dataset.t);});

/* ---------- categorías de gasto ---------- */
function fillCats(){
  Object.keys(CATS).forEach(k=>delete CATS[k]);Object.assign(CATS,BASE);Object.keys(CC).forEach(k=>CATS[k]='🏷️ '+CC[k].n);
  const o=Object.keys(CATS).map(k=>`<option value="${esc(k)}">${esc(CATS[k])}</option>`).join('');
  const v=$('categoria').value,g=$('gf').value;
  $('categoria').innerHTML=o;$('categoria').value=v||'mercancia';
  $('gf').innerHTML='<option value="">Todas las categorías</option>'+o;$('gf').value=g;
  $('catList').innerHTML=Object.keys(CC).map(k=>`<span class="chip">${esc(CC[k].n)} <small>(${CC[k].b==='operativo'?'resta utilidad':'personal'})</small> <a onclick="delCat('${k}')">✕</a></span>`).join('')||'<span class="mu">Aún no creaste categorías. Base: Mercancía, Operativo, Personal y General.</span>';
}
function addCat(){
  const n=$('ncNom').value.trim(),k='c_'+n.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'_');
  if(!n||k.length<3||CATS[k]){toast('Escribe un nombre nuevo para la categoría');return;}
  CC[k]={n,b:$('ncBeh').value};$('ncNom').value='';guardarEnLocal();fillCats();render();
}
function delCat(k){
  const u=R.filter(r=>cat(r)===k).length;
  if(!confirm('¿Eliminar "'+CC[k].n+'"?'+(u?' Sus '+u+' registros pasarán a General.':'')))return;
  R.forEach(r=>{if(cat(r)===k)r.categoria='general';});delete CC[k];guardarEnLocal();fillCats();render();
}

/* ---------- catálogo de productos ---------- */
const PN=n=>String(n).toUpperCase().trim();
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
function setProd(n,f,v){PR[n]=PR[n]||{};PR[n][f]=f==='precio'?(parseFloat(v)||0):v.trim();guardarEnLocal();renderGan(calc());renderCatP(calc());}
function addProd(){const n=PN($('apN').value);if(!n){toast('Escribe el nombre del producto');return;}PR[n]=Object.assign(PR[n]||{},{cat:$('apC').value.trim(),precio:parseFloat($('apP').value)||0});['apN','apC','apP'].forEach(i=>$(i).value='');guardarEnLocal();render();}
function delProd(n){delete PR[n];guardarEnLocal();render();}
function renderInv(c){
  const L=allProds(c).sort((x,y)=>x.n.localeCompare(y.n));
  $('pcats').innerHTML=[...new Set(Object.values(PR).map(p=>p.cat).filter(Boolean))].map(v=>`<option value="${esc(v)}">`).join('');
  $('tablaInventario').innerHTML=L.map(p=>{const e=PR[p.n]||{};return `<tr><td><b>${esc(p.n)}</b></td><td><input data-n="${esc(p.n)}" value="${esc(e.cat||'')}" list="pcats" placeholder="Categoría" onchange="setProd(this.dataset.n,'cat',this.value)" style="width:130px"></td><td class="n">${p.ci}</td><td class="n">${p.su}</td><td class="n ${p.stock>0?'pos':'neg'}">${p.stock} und</td><td class="n">${fm(Math.max(p.stock,0)*p.avg)}</td><td><input type="number" data-n="${esc(p.n)}" value="${e.precio||''}" placeholder="${precioSug(p.n)||''}" onchange="setProd(this.dataset.n,'precio',this.value)" style="width:105px"></td><td>${p.ci||p.su?'':`<button class="btn r s" data-n="${esc(p.n)}" onclick="delProd(this.dataset.n)">✕</button>`}</td></tr>`;}).join('')||'<tr><td colspan="8" class="mu">Sin mercancía.</td></tr>';
}
function renderCatP(c){
  const G={};allProds(c).forEach(p=>{const k=(PR[p.n]&&PR[p.n].cat)||'Sin categoría',g=G[k]=G[k]||{v:0,u:0};g.v+=p.vs;g.u+=p.ut;});
  $('tCatP').innerHTML=Object.keys(G).sort((a,b)=>G[b].u-G[a].u).map(k=>`<tr><td><b>${esc(k)}</b></td><td class="n">${fm(G[k].v)}</td><td class="n ${cl(G[k].u)}">${fm(G[k].u)}</td><td class="n">${G[k].v?(G[k].u/G[k].v*100).toFixed(0)+'%':'—'}</td></tr>`).join('')||'<tr><td colspan="4" class="mu">Sin datos.</td></tr>';
}
function renderMeta(){
  const m=iso(new Date()).slice(0,7),v=R.filter(r=>isSale(r)&&String(r.fecha).slice(0,7)===m).reduce((s,r)=>s+r.monto,0),g=EX.meta||0,p=g?Math.min(v/g*100,100):0;
  $('meta').innerHTML=`<div class="bar"><b>🎯 Meta de ventas de este mes</b><span>Meta: <input type="number" value="${g||''}" placeholder="$ meta" style="width:130px" onchange="EX.meta=parseFloat(this.value)||0;guardarEnLocal();renderMeta()"></span></div><div class="hb" style="grid-template-columns:1fr 160px"><div class="t"><span style="width:${p}%;background:var(--g)"></span></div><b style="text-align:right">${fm(v)}${g?' / '+ab(g)+' ('+Math.round(v/g*100)+'%)':''}</b></div>`;
}

/* ---------- cotizaciones y facturas ---------- */
const dn=q=>(q.tipo==='factura'?'FAC-':'COT-')+String(q.num||0).padStart(3,'0');
const qT=q=>{const s=q.items.reduce((a,i)=>a+i.can*i.pre,0),d=s*Math.min(Math.max(q.des||0,0),100)/100,b=s-d,i=b*(q.iva||0)/100;return{s,d,b,i,t:b+i};};
function qCur(){return{id:cur.id,num:cur.num,est:cur.est||'pendiente',tipo:$('qTipo').value||'cotizacion',cli:$('qCli').value.trim(),tel:$('qTel').value.trim(),fec:$('qFec').value,items:cur.items.map(i=>({...i})),des:parseFloat($('qDes').value)||0,iva:parseFloat($('qIva').value)||0,nota:$('qNota').value.trim()};}
function qPickCli(){const c=CL.find(x=>String(x.id)===$('qCl').value);if(c){$('qCli').value=c.n;$('qTel').value=c.t||'';}}
function qSug(){const n=PN($('qProd').value);if(n)$('qPre').value=precioSug(n)||'';}
function qAdd(){
  const n=PN($('qProd').value),can=parseInt($('qCan').value)||1,pre=parseFloat($('qPre').value);
  if(!n||isNaN(pre)){toast('Elige un producto y escribe el precio');return;}
  cur.items.push({n,can,pre});$('qProd').value='';$('qPre').value='';$('qCan').value='1';qRender();
}
function qSet(k,f,v){cur.items[k][f]=f==='can'?(parseInt(v)||1):(parseFloat(v)||0);qRender();}
function qRender(){
  $('qItems').innerHTML=cur.items.length?`<table><tbody>${cur.items.map((i,k)=>`<tr><td><b>${esc(i.n)}</b></td><td><input type="number" min="1" value="${i.can}" style="width:62px" onchange="qSet(${k},'can',this.value)"></td><td><input type="number" value="${i.pre}" style="width:105px" onchange="qSet(${k},'pre',this.value)"></td><td class="n">${fm(i.can*i.pre)}</td><td><button class="btn r s" onclick="cur.items.splice(${k},1);qRender()">✕</button></td></tr>`).join('')}</tbody></table>`:'<p class="mu">Agrega productos para armar el documento.</p>';
  const q=qCur(),t=qT(q),costo=q.items.reduce((s,i)=>s+i.can*(AVGC[i.n]||0),0);
  $('qTot').innerHTML=q.items.length?`<table class="pl"><tbody><tr><td>Subtotal</td><td class="n">${fm(t.s)}</td></tr>${t.d?`<tr><td>Descuento (${q.des}%)</td><td class="n">−${fm(t.d)}</td></tr>`:''}${t.i?`<tr><td>IVA (${q.iva}%)</td><td class="n">${fm(t.i)}</td></tr>`:''}<tr class="t"><td>Total</td><td class="n">${fm(t.t)}</td></tr></tbody></table><p class="mu">Tu ganancia estimada: <b>${fm(t.b-costo)}</b> (solo tú la ves)</p>`:'';
}
function qSave(){
  const q=qCur();if(!q.items.length){toast('Agrega productos primero');return;}
  if(q.id)Q[Q.findIndex(x=>x.id===q.id)]=q;
  else{q.id=Date.now();q.num=Q.filter(x=>(x.tipo||'cotizacion')===q.tipo).reduce((m,x)=>Math.max(m,x.num||0),0)+1;Q.push(q);cur.id=q.id;cur.num=q.num;}
  guardarEnLocal();qList();toast('💾 '+dn(q)+' guardado');
}
function qNew(){cur={id:null,items:[]};['qCli','qTel','qNota'].forEach(i=>$(i).value='');$('qCl').value='';$('qDes').value=0;$('qIva').value=EMP.i||0;$('qFec').value=iso(new Date());qRender();}
function qLoad(id){
  const q=Q.find(x=>x.id===id);if(!q)return;
  cur={id:q.id,num:q.num,est:q.est,items:q.items.map(i=>({...i}))};
  $('qTipo').value=q.tipo||'cotizacion';$('qCli').value=q.cli||'';$('qTel').value=q.tel||'';$('qFec').value=q.fec;$('qDes').value=q.des||0;$('qIva').value=q.iva||0;$('qNota').value=q.nota||'';
  qRender();verTab('cotizar');
}
const qGet=id=>typeof id==='number'?Q.find(x=>x.id===id):qCur();
function qText(q){
  const t=qT(q);
  return '*'+(q.tipo==='factura'?'Factura ':'Cotización ')+dn(q)+'* — '+(EMP.n||'Palmascent')+'\n'+(q.cli?'Cliente: '+q.cli+'\n':'')+'Fecha: '+q.fec+'\n\n'+q.items.map(i=>'• '+i.can+' x '+i.n+' — '+fm(i.can*i.pre)).join('\n')+(q.des?'\n\nDescuento: '+q.des+'%':'')+(q.iva?'\nIVA '+q.iva+'%: '+fm(t.i):'')+'\n*TOTAL: '+fm(t.t)+'*'+(q.nota?'\n\n'+q.nota:'');
}
function qWA(id){const q=qGet(id);if(!q||!q.items.length){toast('El documento está vacío');return;}wa(q.tel,qText(q));}
function qPrint(id){
  const q=qGet(id);if(!q||!q.items.length){toast('El documento está vacío');return;}
  const t=qT(q),c=CL.find(x=>x.n.toLowerCase()===(q.cli||'').toLowerCase())||{},w=window.open('','_blank');
  if(!w){toast('Permite las ventanas emergentes para imprimir');return;}
  const rows=q.items.map(i=>`<tr><td>${esc(i.n)}</td><td class=r>${i.can}</td><td class=r>${fm(i.pre)}</td><td class=r>${fm(i.can*i.pre)}</td></tr>`).join('');
  w.document.write(`<html><head><meta charset="utf-8"><title>${dn(q)}</title><style>*{-webkit-print-color-adjust:exact;print-color-adjust:exact}body{font-family:Segoe UI,Arial,sans-serif;max-width:760px;margin:28px auto;color:#1c2b26;padding:0 18px}.h{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #0e3b2f;padding-bottom:14px}.h img{max-height:70px;max-width:180px;display:block}.r{text-align:right}h2{margin:0;color:#0e3b2f}table{width:100%;border-collapse:collapse;margin-top:18px}th{background:#0e3b2f;color:#fff;padding:9px;text-align:left}td{padding:9px;border-bottom:1px solid #ddd}.tt{margin-left:auto;width:260px;margin-top:14px}.tt div{display:flex;justify-content:space-between;padding:4px 0}.g{font-size:1.3em;font-weight:700;border-top:2px solid #0e3b2f;margin-top:4px;padding-top:8px}small{color:#777}</style></head><body><div class="h"><div>${EMP.logo?`<img src="${EMP.logo}">`:''}<h2>${esc(EMP.n||'Palmascent')}</h2><small>${esc([EMP.d?'NIT '+EMP.d:'',EMP.t,EMP.a].filter(Boolean).join(' · '))}</small></div><div class="r"><h2>${q.tipo==='factura'?'FACTURA DE VENTA':'COTIZACIÓN'}</h2><b>${dn(q)}</b><br><small>${q.fec}</small></div></div><p><b>Cliente:</b> ${esc(q.cli||'—')}${c.d?' · '+esc(c.d):''}${q.tel?' · '+esc(q.tel):''}</p><table><tr><th>Producto</th><th class=r>Cant.</th><th class=r>Precio</th><th class=r>Subtotal</th></tr>${rows}</table><div class="tt"><div><span>Subtotal</span>${fm(t.s)}</div>${t.d?`<div><span>Descuento ${q.des}%</span>−${fm(t.d)}</div>`:''}${t.i?`<div><span>IVA ${q.iva}%</span>${fm(t.i)}</div>`:''}<div class="g"><span>TOTAL</span>${fm(t.t)}</div></div>${q.nota?`<p>${esc(q.nota)}</p>`:''}<p><small>${q.tipo==='factura'?'Documento de venta interno. No reemplaza la factura electrónica DIAN.':'Cotización sujeta a disponibilidad de inventario.'}</small></p><script>onload=()=>print()<\/script></body></html>`);
  w.document.close();
}
function qList(){
  $('qList').innerHTML=Q.length?`<table><thead><tr><th>N°</th><th>Cliente</th><th class="n">Total</th><th>Estado</th><th></th></tr></thead><tbody>${Q.slice().sort((a,b)=>b.id-a.id).map(q=>`<tr><td><b>${dn(q)}</b><br><small class="mu">${q.fec}</small></td><td>${esc(q.cli||'—')}</td><td class="n">${fm(qT(q).t)}</td><td><select style="width:auto" onchange="qEst(${q.id},this.value)">${['pendiente','aceptada','rechazada','vendida'].map(e=>`<option ${q.est===e?'selected':''}>${e}</option>`).join('')}</select></td><td><button class="btn o s" onclick="qLoad(${q.id})">✏️</button> <button class="btn b s" onclick="qWA(${q.id})">📲</button> <button class="btn p s" onclick="qPrint(${q.id})">🖨️</button> <button class="btn s" onclick="qVender(${q.id},'ingreso')">💵</button> <button class="btn o s" onclick="qVender(${q.id},'pendiente')">☐</button> <button class="btn r s" onclick="qDel(${q.id})">🗑️</button></td></tr>`).join('')}</tbody></table><p class="mu">💵 convertir en venta de contado · ☐ convertir en venta fiada (va a cartera). El stock se descuenta solo.</p>`:'<p class="mu">Aún no has guardado documentos.</p>';
}
function qEst(id,v){const q=Q.find(x=>x.id===id);if(q){q.est=v;guardarEnLocal();}}
function qDel(id){if(confirm('¿Eliminar este documento?')){Q=Q.filter(x=>x.id!==id);guardarEnLocal();qList();}}
function qVender(id,tipo){
  const q=Q.find(x=>x.id===id);
  if(!q||(q.est==='vendida'&&!confirm('Este documento ya se convirtió en venta. ¿Registrarlo otra vez?')))return;
  const f=iso(new Date()),d=1-(q.des||0)/100,t=qT(q),cl=q.cli||'';
  q.items.forEach((i,k)=>R.push({id:Date.now()+k,fecha:f,concepto:i.n,monto:Math.round(i.can*i.pre*d),tipo,categoria:'mercancia',cantidad:i.can,cliente:cl}));
  if(t.i>0)R.push({id:Date.now()+99,fecha:f,concepto:'IVA '+dn(q),monto:Math.round(t.i),tipo,categoria:'general',cantidad:1,cliente:cl});
  q.est='vendida';guardarEnLocal();render();toast('✅ Venta registrada y stock descontado'+(tipo==='pendiente'?' (en cartera)':''));
}

function countUp(el,v){
  if(!el||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  const t0=performance.now();(function f(t){const p=Math.min((t-t0)/800,1);el.textContent=fm(v*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(f);})(t0);
}
/* ---------- avisos ---------- */
function toast(t){const e=$('toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),3800);}

/* ---------- importar / exportar ---------- */
function leerBackup(txt){
  let d=JSON.parse(txt.replace(/^\uFEFF/,'')),x={};
  if(d&&!Array.isArray(d)&&typeof d==='object'){x=d;d=d.registros||d.movimientos||d.data;}
  if(!Array.isArray(d))throw 0;
  const ids=new Set();
  d=d.filter(r=>r&&typeof r==='object'&&r.concepto!==undefined&&r.tipo).map((r,i)=>{
    r.monto=Number(r.monto)||0;r.tipo=String(r.tipo).toLowerCase();r.fecha=String(r.fecha||iso(new Date())).slice(0,10);
    if(r.cantidad!==undefined)r.cantidad=Number(r.cantidad)||1;
    let id=Number(r.id);if(!id||ids.has(id))id=Date.now()+i;ids.add(id);r.id=id;return r;});
  return{d,x};
}
function cargarJSON(file){
  const f=file||$('fileInput').files[0];if(!f)return;
  const rd=new FileReader();
  rd.onload=e=>{
    try{
      const b=leerBackup(e.target.result);
      if(!R.length&&!Q.length)aplicar(b,'rep');
      else{
        $('mTxt').innerHTML='El archivo trae <b>'+b.d.length+'</b> movimientos. Ahora tienes <b>'+R.length+'</b>.<br><small>Combinar agrega solo lo que no tengas (por ID); reemplazar borra lo actual.</small>';
        $('mMerge').onclick=()=>aplicar(b,'mer');$('mRep').onclick=()=>aplicar(b,'rep');$('modal').classList.add('on');
      }
    }catch(err){toast('❌ No pude leer ese archivo. ¿Es una copia .json de Palmascent?');}
  };
  rd.onerror=()=>toast('❌ No se pudo abrir el archivo');
  rd.readAsText(f);$('fileInput').value='';
}
function aplicar(b,m){
  $('modal').classList.remove('on');const x=b.x;let n=b.d.length;
  if(m==='rep'){R=b.d;if(x.cotizaciones)Q=x.cotizaciones;if(x.categorias)CC=x.categorias;if(x.productos)PR=x.productos;if(x.meta!==undefined)EX.meta=x.meta;if(x.clientes)CL=x.clientes;if(x.empresa)EMP=x.empresa;}
  else{
    const ids=new Set(R.map(r=>r.id)),nu=b.d.filter(r=>!ids.has(r.id));n=nu.length;R=R.concat(nu);
    const qi=new Set(Q.map(q=>q.id));Q=Q.concat((x.cotizaciones||[]).filter(q=>!qi.has(q.id)));
    Object.assign(CC,x.categorias||{});PR=Object.assign({},x.productos||{},PR);
  }
  R.forEach(r=>{const k=cat(r);if(!BASE[k]&&!CC[k])CC[k]={n:k,b:'otro'};});
  guardarEnLocal();refrescar();toast('✅ Copia '+(m==='rep'?'cargada':'combinada')+': '+n+' movimientos');
}
['dragover','drop'].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();if(ev==='drop'&&e.dataTransfer&&e.dataTransfer.files[0])cargarJSON(e.dataTransfer.files[0]);}));
function exportarJSON(){
  if(!R.length&&!Q.length){alert('No hay datos para exportar.');return;}
  const url=URL.createObjectURL(new Blob([JSON.stringify({version:5,registros:R,cotizaciones:Q,categorias:CC,productos:PR,meta:EX.meta,clientes:CL,empresa:EMP},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='backup_palmascent_v5.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
}
/* ---------- clientes y cartera ---------- */
function fillCli(){
  $('qCl').innerHTML='<option value="">Cliente guardado…</option>'+CL.map(c=>`<option value="${c.id}">${esc(c.n)}</option>`).join('');
  $('clist').innerHTML=CL.map(c=>`<option value="${esc(c.n)}">`).join('');
}
function addCli(){
  const n=$('clN').value.trim();if(!n){toast('Escribe el nombre del cliente');return;}
  CL.push({id:Date.now(),n,d:$('clD').value.trim(),t:$('clT').value.trim()});['clN','clD','clT'].forEach(i=>$(i).value='');guardarEnLocal();fillCli();render();
}
function delCli(id){if(confirm('¿Eliminar este cliente? Sus movimientos se conservan.')){CL=CL.filter(c=>c.id!==id);guardarEnLocal();fillCli();render();}}
function deu(){const D={};R.forEach(r=>{if(r.tipo==='pendiente')D[r.cliente||r.concepto]=(D[r.cliente||r.concepto]||0)+r.monto;else if(r.tipo==='abono')D[r.cliente]=(D[r.cliente]||0)-r.monto;});return D;}
function abonar(n,todo){
  const d=Math.round(deu()[n]||0);let m=d;
  if(!todo){m=parseFloat(String(prompt('Abono de '+n+' (debe '+fm(d)+'):')||'').replace(/[^\d.]/g,''));if(!(m>0))return;if(d>0)m=Math.min(m,d);}
  if(!(m>0))return;
  R.push({id:Date.now(),fecha:iso(new Date()),concepto:'Abono '+n,monto:m,tipo:'abono',categoria:'general',cantidad:1,cliente:n});
  guardarEnLocal();render();toast('✅ Pago registrado: '+fm(m));
}
function wa(t,x){t=String(t||'').replace(/\D/g,'');if(t.length===10)t='57'+t;window.open('https://wa.me/'+t+'?text='+encodeURIComponent(x),'_blank');}
function cobrarWA(n){const c=CL.find(x=>x.n===n)||{};wa(c.t,'Hola '+n+', te escribo de '+(EMP.n||'Palmascent')+'. Tienes un saldo pendiente de '+fm(deu()[n]||0)+'. ¡Gracias!');}
function renderCar(){
  const D=deu(),V={};R.forEach(r=>{if(isSale(r)&&r.cliente)V[r.cliente]=(V[r.cliente]||0)+r.monto;});
  const ks=[...new Set([...CL.map(c=>c.n),...Object.keys(D),...Object.keys(V)])].sort((a,b)=>(D[b]||0)-(D[a]||0));
  const tot=Object.values(D).reduce((s,v)=>s+Math.max(v,0),0);
  $('kCar').innerHTML=[['Por cobrar',fm(tot)],['Clientes con deuda',Object.values(D).filter(v=>v>0).length],['Clientes registrados',CL.length]].map(x=>`<div class="k"><small>${x[0]}</small><b>${x[1]}</b></div>`).join('');
  $('tCar').innerHTML=ks.map(k=>{const c=CL.find(x=>x.n===k),d=Math.round(D[k]||0),n=esc(k);
    return `<tr><td><b>${n}</b></td><td>${esc(c&&c.d||'')}</td><td>${esc(c&&c.t||'')}</td><td class="n">${fm(V[k]||0)}</td><td class="n ${d>0?'pen':''}">${fm(d)}</td><td>${d>0?`<button class="btn b s" data-n="${n}" onclick="abonar(this.dataset.n)">Abonar</button> <button class="btn s" data-n="${n}" onclick="abonar(this.dataset.n,1)">Pagó todo</button> <button class="btn o s" data-n="${n}" onclick="cobrarWA(this.dataset.n)">📲</button> `:''}${c?`<button class="btn r s" onclick="delCli(${c.id})">🗑️</button>`:''}</td></tr>`;}).join('')||'<tr><td colspan="6" class="mu">Aún no hay clientes.</td></tr>';
}

/* ---------- empresa y logo ---------- */
function pintarEmp(){
  [['emN','n'],['emD','d'],['emT','t'],['emA','a']].forEach(([id,k])=>$(id).value=EMP[k]||'');$('emI').value=EMP.i||'';
  const l=$('logoPrev');l.src=EMP.logo||'';l.style.display=EMP.logo?'inline':'none';
  if(!cur.items.length)$('qIva').value=EMP.i||0;
}
function saveEmp(){[['emN','n'],['emD','d'],['emT','t'],['emA','a']].forEach(([id,k])=>EMP[k]=$(id).value.trim());EMP.i=parseFloat($('emI').value)||0;guardarEnLocal();}
function setLogo(inp){
  const f=inp.files[0];if(!f)return;const im=new Image();
  im.onload=()=>{const w=Math.min(260,im.width),c=document.createElement('canvas');c.width=w;c.height=Math.round(im.height*w/im.width);c.getContext('2d').drawImage(im,0,0,c.width,c.height);EMP.logo=c.toDataURL('image/png');pintarEmp();guardarEnLocal();toast('✅ Logo guardado');};
  im.src=URL.createObjectURL(f);
}

/* ---------- nube (Supabase) y sesión ---------- */
const CFG=window.PALMA_CFG||{};let SB=null,USER=null,TS=0,pushT=null,CH=null;
const estado=t=>{$('syncSt').textContent=t;};
function setDoc(d){R=d.registros||[];Q=d.cotizaciones||[];CC=d.categorias||{};PR=d.productos||{};EX.meta=d.meta||0;CL=d.clientes||[];EMP=d.empresa||{};}
function refrescar(){fillCats();fillCli();render();qList();qRender();pintarEmp();}
function empujar(){
  if(!SB||!USER)return;estado('⏳ Guardando…');clearTimeout(pushT);
  pushT=setTimeout(async()=>{
    if(!navigator.onLine){estado('📴 Sin conexión: se subirá al volver');return;}
    try{const{error}=await SB.from('palmascent_data').upsert({user_id:USER.id,data:{version:6,registros:R,cotizaciones:Q,categorias:CC,productos:PR,meta:EX.meta,clientes:CL,empresa:EMP},updated_at:new Date(TS).toISOString()});
      estado(error?'⚠️ Error de nube':'☁️ Sincronizado');}catch(e){estado('📴 Sin conexión');}
  },900);
}
async function nubeSync(){
  if(!SB||!USER)return;estado('⏳ Sincronizando…');
  try{
    const{data,error}=await SB.from('palmascent_data').select('data,updated_at').eq('user_id',USER.id).maybeSingle();
    if(error)throw error;
    const ct=data?Date.parse(data.updated_at):0;
    let usarNube=data&&ct>TS;
    if(data&&!TS&&R.length)usarNube=confirm('Esta cuenta ya tiene datos en la nube y este dispositivo también.\n\nAceptar: usar los de la nube.\nCancelar: conservar los de este dispositivo y subirlos.');
    if(usarNube){setDoc(data.data);TS=ct;localStorage.setItem(KEY+'_ts',TS);guardarEnLocal(true);refrescar();estado('☁️ Sincronizado');}
    else{TS=Date.now();guardarEnLocal();}
  }catch(e){estado('📴 Sin conexión');}
}
function suscribir(){
  if(CH)SB.removeChannel(CH);
  CH=SB.channel('pd').on('postgres_changes',{event:'*',schema:'public',table:'palmascent_data',filter:'user_id=eq.'+USER.id},p=>{
    const n=p.new,t=n&&n.updated_at?Date.parse(n.updated_at):0;
    if(n&&n.data&&t>TS){setDoc(n.data);TS=t;localStorage.setItem(KEY+'_ts',TS);guardarEnLocal(true);refrescar();estado('☁️ Actualizado desde otro dispositivo');}
  }).subscribe();
}
async function entrar(u){USER=u;$('login').classList.remove('on');$('uMail').textContent=u.email;$('cuenta').textContent='Sesión iniciada: '+u.email;await nubeSync();suscribir();}
async function auth(m){
  if(!SB){$('lgM').textContent='La nube no está configurada (ver config.js).';return;}
  const email=$('lgE').value.trim(),password=$('lgP').value;$('lgM').textContent='…';
  const{data,error}=m==='up'?await SB.auth.signUp({email,password}):await SB.auth.signInWithPassword({email,password});
  if(error){$('lgM').textContent=error.message;return;}
  if(data.session)entrar(data.user);else $('lgM').textContent='Revisa tu correo para confirmar la cuenta y luego entra.';
}
function usarLocal(){localStorage.setItem(KEY+'_solo','1');$('login').classList.remove('on');}
async function salir(){if(SB)await SB.auth.signOut();USER=null;localStorage.removeItem(KEY+'_solo');$('login').classList.add('on');estado('● Sin sesión');}
async function iniciar(){
  cargarDeLocal();TS=Number(localStorage.getItem(KEY+'_ts'))||0;fillCli();pintarEmp();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  if(!CFG.SUPABASE_URL||!window.supabase){estado('● Solo en este dispositivo');$('cuenta').textContent='Nube no configurada: completa config.js con los datos de Supabase.';return;}
  SB=window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_ANON_KEY);
  window.addEventListener('online',()=>{if(USER)nubeSync();});
  let s=null;try{s=(await SB.auth.getSession()).data.session;}catch(e){}
  if(s)await entrar(s.user);else if(localStorage.getItem(KEY+'_solo')!=='1')$('login').classList.add('on');
  else estado('● Sin sesión');
  SB.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')USER=null;});
}
window.onload=iniciar;
