const KEY='palmascent_data', MES=['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const BASE={mercancia:'📦 Mercancía',operativo:'🚌 Operativo',personal:'🍔 Personal',general:'📝 General'},CATS={};
const beh=k=>k==='mercancia'?'mercancia':k==='operativo'?'operativo':(CC[k]?CC[k].b:'otro');
let R=[],idEditando=null,Q=[],CC={},PR={},EX={meta:0},cur={id:null,items:[]},AVGC={},STK={},CL=[],EMP={};
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
  {const m=migrarDatos({registros:R,productos:PR});R=m.registros;PR=m.productos;}
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
function calc(rg){
  const[a,b]=rg||rango(),P={},T={v:0,c:0,o:0,x:0,m:0},avg={};
  R.forEach(r=>{
    if(cat(r)!=='mercancia')return;
    const k=nm(r),p=P[k]=P[k]||{n:k,ci:0,cc:0,su:0,vu:0,vs:0,ob:0},q=qty(r),en=enR(r,a,b);
    if(r.tipo==='egreso'||r.tipo==='porpagar'){p.ci+=q;p.cc+=r.monto;}
    else if(r.tipo==='obsequio'){p.su+=q;if(en)p.ob+=q;}
    else if(r.tipo==='devolucion'){p.su-=q;if(en){p.vu-=q;p.vs-=r.monto;}}
    else if(isSale(r)){p.su+=q;if(en){p.vu+=q;p.vs+=r.monto;}}
  });
  const L=Object.values(P);
  L.forEach(p=>{p.avg=p.ci?p.cc/p.ci:0;avg[p.n]=p.avg;p.cost=p.vu*p.avg;p.ut=p.vs-p.cost;p.stock=p.ci-p.su;p.mg=p.vs?p.ut/p.vs*100:0;T.v+=p.vs;T.c+=p.cost;T.m+=p.ob*p.avg;});
  R.forEach(r=>{if(r.tipo==='egreso'&&enR(r,a,b)){const h=beh(cat(r));if(h==='operativo')T.o+=r.monto;else if(h!=='mercancia')T.x+=r.monto;}});
  T.o+=T.m;T.bruta=T.v-T.c;T.neta=T.bruta-T.o;T.mg=T.v?T.neta/T.v*100:0;
  const S={};CUENTAS.forEach(x=>S[x]=0);let cobrar=0,porpagar=0;
  R.forEach(r=>{const c=cta(r),m=r.monto;
    if(['ingreso','pagado','abono'].includes(r.tipo)){S[c]=(S[c]||0)+m;if(r.tipo==='abono')cobrar-=m;}
    else if(r.tipo==='egreso'||r.tipo==='pagoprov'){S[c]=(S[c]||0)-m;if(r.tipo==='pagoprov')porpagar-=m;}
    else if(r.tipo==='pendiente')cobrar+=m;
    else if(r.tipo==='porpagar')porpagar+=m;
    else if(r.tipo==='devolucion'){if(r.deuda)cobrar-=m;else S[c]=(S[c]||0)-m;}
    else if(r.tipo==='transferencia'){S[c]=(S[c]||0)-m;S[r.destino]=(S[r.destino]||0)+m;}
  });
  const saldo=Object.values(S).reduce((s,v)=>s+v,0),inv=L.reduce((s,p)=>s+Math.max(p.stock,0)*p.avg,0);
  return{L,T,avg,saldo,cobrar,porpagar,S,inv,a,b};
}

/* ---------- gráficos SVG ---------- */
const ab=v=>Math.abs(v)>=1e6?(v/1e6).toFixed(1)+'M':Math.abs(v)>=1e3?Math.round(v/1e3)+'k':Math.round(v);
function chart(labels,series,line){
  if(!labels.length)return'<p class="mu">Aún no hay datos en este periodo.</p>';
  const W=700,H=250,L=48,B=28,T=10,w=W-L-8,h=H-B-T,n=labels.length,gw=w/n;
  const all=series.flatMap(s=>s.v);let mx=Math.max(0,...all),mn=Math.min(0,...all);if(mx===mn)mx=1;
  const y=v=>T+h*(mx-v)/(mx-mn),gid='g'+Math.random().toString(36).slice(2,7);
  let o=`<svg viewBox="0 0 ${W} ${H}" class="svg"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="var(--g)" stop-opacity=".35"/><stop offset="1" stop-color="var(--g)" stop-opacity="0"/></linearGradient></defs>`;
  for(let i=0;i<=4;i++){const v=mn+(mx-mn)*i/4;o+=`<line class="grid" x1="${L}" x2="${W-8}" y1="${y(v)}" y2="${y(v)}"/><text class="tx" x="${L-6}" y="${y(v)+4}" text-anchor="end">${ab(v)}</text>`;}
  const tip=i=>esc(labels[i])+'<br>'+series.map(s=>s.n+': '+fm(s.v[i])).join('<br>');
  if(line){
    const xs=i=>L+gw*(i+.5),pts=series[0].v.map((v,i)=>`${xs(i)},${y(v)}`);
    o+=`<path d="M${xs(0)},${y(0)} L${pts.join(' L')} L${xs(n-1)},${y(0)}Z" style="fill:url(#${gid})"/>`;
    o+=`<polyline pathLength="1" points="${pts.join(' ')}" fill="none" style="stroke:var(--g)" stroke-width="2.5" stroke-linejoin="round"/>`;
    series[0].v.forEach((v,i)=>o+=`<circle cx="${xs(i)}" cy="${y(v)}" r="3.5" style="fill:var(--g)"/>`);
  }else series.forEach((s,j)=>s.v.forEach((v,i)=>{
    const bw=gw*.72/series.length,x=L+i*gw+gw*.14+j*bw,y0=y(0),yv=y(v),r=Math.max(0,Math.min(5,bw/2,y0-yv));
    o+=v>=0?`<path class="bar" d="M${x},${y0}V${yv+r}Q${x},${yv} ${x+r},${yv}H${x+bw-r}Q${x+bw},${yv} ${x+bw},${yv+r}V${y0}Z" style="fill:${s.c}"/>`:`<rect x="${x}" y="${y0}" width="${bw}" height="${Math.max(yv-y0,1)}" rx="2" style="fill:${s.c}"/>`;
  }));
  labels.forEach((_,i)=>o+=`<rect class="hit" x="${L+gw*i}" y="${T}" width="${gw}" height="${h}" fill="transparent" data-tip="${tip(i).replace(/"/g,'&quot;')}"/>`);
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
  const c=calc(),g=$('gran').value,{a,b}=c;AVGC=c.avg;STK={};c.L.forEach(p=>STK[p.n]=p.stock);qChips();renderLotes();
  /* KPIs */
  const kp=(t,v,cls,sub)=>`<div class="k ${cls}"><small>${t}</small><b>${v}</b>${sub?`<small>${sub}</small>`:''}</div>`;
  $('kCaja').innerHTML=`<div class="hero"><svg class="frond" viewBox="0 0 200 200" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M20 190C40 120 90 70 190 40M20 190C60 130 120 100 195 95M20 190C80 150 140 140 190 150M20 190C30 110 60 50 120 10M20 190C20 130 30 80 60 20"/></svg><small>Saldo total en caja</small><b class="big">${fm(c.saldo)}</b><div class="cuentas">${CUENTAS.filter(x=>x!=='Otro'||Math.abs(c.S.Otro)>0).map(x=>`<span>${x} ${fm(c.S[x]||0)}</span>`).join('')}<button class="btn s" onclick="transferir()">⇄ Transferir entre cuentas</button></div><dl><div><dt>Por cobrar</dt><dd>${fm(c.cobrar)}</dd></div><div><dt>Por pagar (proveedores)</dt><dd>${fm(c.porpagar)}</dd></div><div><dt>Patrimonio (caja + cobrar − pagar)</dt><dd>${fm(c.saldo+c.cobrar-c.porpagar)}</dd></div><div><dt>Inventario a costo</dt><dd>${fm(c.inv)}</dd></div></dl></div>`;
  if(document.body.classList.contains('intro'))countUp(document.querySelector('.hero .big'),c.saldo);
  const T=c.T;
  $('kPer').innerHTML=(()=>{const rp=rangoPrev(),pv=rp?calc(rp).T:null;return kp('Ventas',fm(T.v),'l',pv?tr(T.v,pv.v):'')+kp('Utilidad bruta',fm(T.bruta),'l',pv?tr(T.bruta,pv.bruta):'')+kp('Gastos operativos',fm(T.o),'l',pv?tr(T.o,pv.o,true):'')+kp('Utilidad neta',`<span class="${cl(T.neta)}">${fm(T.neta)}</span>`,'l',T.mg.toFixed(1)+'% margen'+(pv?' · '+tr(T.neta,pv.neta):''));})();

  /* barras por periodo */
  const B_={};
  R.forEach(r=>{
    if(!enR(r,a,b))return; const k=keyOf(r.fecha,g);
    const o=B_[k]=B_[k]||{v:0,u:0};
    if(isSale(r)){o.v+=r.monto;o.u+=r.monto-qty(r)*(c.avg[nm(r)]||0);}
    else if(r.tipo==='egreso'&&beh(cat(r))==='operativo')o.u-=r.monto;else if(r.tipo==='devolucion'){o.v-=r.monto;o.u-=r.monto-qty(r)*(c.avg[nm(r)]||0);}else if(r.tipo==='obsequio')o.u-=qty(r)*(c.avg[nm(r)]||0);
  });
  const ks=Object.keys(B_).sort().slice(-24);
  $('chBar').innerHTML=chart(ks.map(k=>lblOf(k,g)),[{n:'Ventas',c:'var(--g)',v:ks.map(k=>B_[k].v)},{n:'Utilidad neta',c:'var(--a)',v:ks.map(k=>B_[k].u)}]);

  /* línea de caja */
  const asc=R.slice().sort((x,y)=>x.fecha<y.fecha?-1:x.fecha>y.fecha?1:x.id-y.id),S={};let s=0;
  asc.forEach(r=>{s+=flujo(r);S[keyOf(r.fecha,g)]=s;});
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
  const low=c.L.filter(p=>p.stock>0&&p.stock<=((PR[p.n]&&PR[p.n].stockMin)||1));if(low.length)al.push(`📉 Stock bajo (en o bajo tu mínimo): <b>${low.map(p=>esc(p.n)).join(', ')}</b>`);
  $('alertas').innerHTML=al.map(t=>`<div class="al">${t}</div>`).join('');

  renderMov(); renderGan(c); renderCatP(c); renderGas(c); renderInv(c); renderMeta(); renderCar(); renderPorPagar();
  $('prods').innerHTML=allProds(c).map(p=>`<option value="${esc(p.n)}">`).join('');
}

function renderMov(){
  const q=$('q').value.toLowerCase(),ft=$('ft').value;
  const rows=R.slice().sort((x,y)=>x.fecha<y.fecha?1:x.fecha>y.fecha?-1:y.id-x.id)
    .filter(r=>(!ft||r.tipo===ft)&&(!q||(r.concepto+cat(r)).toLowerCase().includes(q)));
  const mapa={ingreso:['pos','+ $'],egreso:['neg','- $'],pendiente:['pen','☐ $'],pagado:['pag','☑ $'],abono:['pag','+ $'],obsequio:['pen','🎁 $'],porpagar:['neg','⏳ $'],pagoprov:['neg','- $'],devolucion:['neg','↩ $'],transferencia:['pag','⇄ $']};
  $('tablaRegistros').innerHTML=rows.map(r=>{
    const[cc,sy]=mapa[r.tipo]||['',''];
    return `<tr><td>${r.fecha}</td><td><b>${esc(r.concepto)}</b>${r.cliente?` <small class="mu">· ${esc(r.cliente)}</small>`:''}</td><td><small>${CATS[cat(r)]}</small></td><td class="${cc}">${esc(r.tipo).toUpperCase()}<br><small class="mu">${cta(r)}${r.destino?' → '+r.destino:''}</small></td><td class="n">${qty(r)}</td><td class="n ${cc}">${sy}${Math.round(r.monto).toLocaleString('es-CO')}</td>
    <td>${r.tipo==='pendiente'?`<button class="btn b s" onclick="marcarPagado(${r.id})">☑️</button> `:''}${isSale(r)?`<button class="btn p s" onclick="devolver(${r.id})">↩ Devolución</button> `:''}<button class="btn o s" onclick="editarRegistro(${r.id})">✏️</button> <button class="btn r s" onclick="borrarRegistro(${r.id})">🗑️</button></td></tr>`;
  }).join('')||'<tr><td colspan="7" class="mu">Sin registros.</td></tr>';
}

function renderGan(c){
  const T=c.T,row=(t,v,cls)=>`<tr class="${cls||''}"><td>${t}</td><td class="n ${cl(v)}">${fm(v)}</td></tr>`;
  $('pl').innerHTML=`<table class="pl"><tbody>${row('Ventas de mercancía',T.v)}${row('− Costo de lo vendido',-T.c)}${row('= Utilidad bruta',T.bruta,'t')}${row('− Gastos operativos',-(T.o-T.m))}${T.m?row('− Muestras y obsequios (a costo)',-T.m):''}${row('= Utilidad neta del negocio',T.neta,'t')}</tbody></table>
  <p class="mu">Margen neto: <b>${T.mg.toFixed(1)}%</b> · Retiros personales y otros (no restan utilidad, pero sí descuentan la caja): <b>${fm(T.x)}</b></p>`;
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
  if(tipo==='abono'&&!$('cliente').value.trim()){alert('Elige el cliente que abona.');return;}
  if(tipo==='transferencia'&&$('destino').value===$('cuenta').value){alert('Elige dos cuentas distintas.');return;}
  if(idEditando!==null){
    const i=R.findIndex(r=>r.id===idEditando);
    if(i!==-1){const t=(R[i].tipo==='pagado'&&tipo==='pendiente')?'pagado':tipo;R[i]={...R[i],id:idEditando,fecha,concepto,monto,tipo:t,categoria,cantidad,cuenta:$('cuenta').value,cliente:$('cliente').value.trim()||undefined};}
    cancelarEdicion();
  }else{
    R.push({id:Date.now(),fecha,concepto,monto:tipo==='obsequio'?0:monto,tipo,categoria:tipo==='obsequio'?'mercancia':categoria,cantidad,cuenta:$('cuenta').value,...(tipo==='transferencia'?{destino:$('destino').value}:{}),...($('cliente').value.trim()?{cliente:$('cliente').value.trim()}:{})});
    $('concepto').value='';$('monto').value='';$('cantidad').value='1';$('cliente').value='';
  }
  guardarEnLocal();render();
}
function editarRegistro(id){
  const r=R.find(x=>x.id===id);if(!r)return;
  $('fecha').value=r.fecha;$('concepto').value=r.concepto;$('monto').value=r.monto;
  $('tipo').value=r.tipo==='pagado'?'pendiente':r.tipo;$('categoria').value=cat(r);$('cantidad').value=qty(r);$('cliente').value=r.cliente||'';$('cuenta').value=cta(r);formSmart();
  idEditando=id;$('btnAccion').innerText='Guardar cambios';$('btnAccion').classList.add('o');$('btnCancelar').style.display='block';
  verTab('finanzas');$('formularioArea').scrollIntoView({behavior:'smooth'});
}
function cancelarEdicion(){
  idEditando=null;$('btnAccion').innerText='Agregar registro';$('btnAccion').classList.remove('o');$('btnCancelar').style.display='none';
  $('concepto').value='';$('monto').value='';$('cantidad').value='1';$('cliente').value='';
}
function marcarPagado(id){const r=R.find(x=>x.id===id);if(!r)return;if(r.cliente)R.push({id:Date.now(),fecha:iso(new Date()),concepto:'Pago '+r.concepto,monto:r.monto,tipo:'abono',categoria:'general',cantidad:1,cliente:r.cliente,cuenta:$('carCta').value||'Efectivo'});else r.tipo='pagado';guardarEnLocal();render();}
function borrarRegistro(id){if(confirm('¿Estás seguro de eliminar este registro?')){R=R.filter(r=>r.id!==id);guardarEnLocal();render();}}

/* ---------- pestañas ---------- */
function verTab(id){
  window.scrollTo(0,0);$('sheet').classList.remove('on');
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.id===id));
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',b.dataset.t===id));
  const mb=document.querySelector('.mbtn');if(mb)mb.classList.toggle('on',['finanzas','ganancias','gastos','ajustes'].includes(id));
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
function precioSug(n,may){
  if(may&&PR[n]&&PR[n].precioMayor)return PR[n].precioMayor;
  if(PR[n]&&PR[n].precio)return PR[n].precio;
  let b=null;R.forEach(r=>{if(isSale(r)&&nm(r)===n&&r.monto>0&&(!b||r.fecha>=b.fecha))b=r;});
  return b?Math.round(b.monto/qty(b)):0;
}
function setProd(n,f,v){PR[n]=PR[n]||{};PR[n][f]=(f==='precio'||f==='precioMayor'||f==='stockMin')?(parseFloat(v)||0):v.trim();guardarEnLocal();renderGan(calc());renderCatP(calc());}
function addProd(){const n=PN($('apN').value);if(!n){toast('Escribe el nombre del producto');return;}PR[n]=Object.assign(PR[n]||{},{cat:$('apC').value.trim(),precio:parseFloat($('apP').value)||0});['apN','apC','apP'].forEach(i=>$(i).value='');guardarEnLocal();render();}
function delProd(n){delete PR[n];guardarEnLocal();render();}
function renderInv(c){
  const L=allProds(c).sort((x,y)=>x.n.localeCompare(y.n));
  $('pcats').innerHTML=[...new Set(Object.values(PR).map(p=>p.cat).filter(Boolean))].map(v=>`<option value="${esc(v)}">`).join('');
  $('tablaInventario').innerHTML=L.map(p=>{const e=PR[p.n]||{};return `<tr><td><b>${esc(p.n)}</b></td><td><input data-n="${esc(p.n)}" value="${esc(e.cat||'')}" list="pcats" placeholder="Categoría" onchange="setProd(this.dataset.n,'cat',this.value)" style="width:130px"></td><td class="n">${p.ci}</td><td class="n">${p.su}</td><td class="n ${p.stock>0?'pos':'neg'}">${p.stock} und</td><td class="n">${fm(Math.max(p.stock,0)*p.avg)}</td><td><input type="number" data-n="${esc(p.n)}" value="${e.precio||''}" placeholder="${precioSug(p.n)||''}" onchange="setProd(this.dataset.n,'precio',this.value)" style="width:105px"></td><td><input type="number" data-n="${esc(p.n)}" value="${e.precioMayor||''}" onchange="setProd(this.dataset.n,'precioMayor',this.value)" style="width:105px"></td><td><input type="number" data-n="${esc(p.n)}" value="${e.stockMin||''}" placeholder="1" onchange="setProd(this.dataset.n,'stockMin',this.value)" style="width:70px"></td><td>${p.ci||p.su?'':`<button class="btn r s" data-n="${esc(p.n)}" onclick="delProd(this.dataset.n)">✕</button>`}</td></tr>`;}).join('')||'<tr><td colspan="8" class="mu">Sin mercancía.</td></tr>';
}
function renderCatP(c){
  const G={};allProds(c).forEach(p=>{const k=(PR[p.n]&&PR[p.n].cat)||'Sin categoría',g=G[k]=G[k]||{v:0,u:0};g.v+=p.vs;g.u+=p.ut;});
  $('tCatP').innerHTML=Object.keys(G).sort((a,b)=>G[b].u-G[a].u).map(k=>`<tr><td><b>${esc(k)}</b></td><td class="n">${fm(G[k].v)}</td><td class="n ${cl(G[k].u)}">${fm(G[k].u)}</td><td class="n">${G[k].v?(G[k].u/G[k].v*100).toFixed(0)+'%':'—'}</td></tr>`).join('')||'<tr><td colspan="4" class="mu">Sin datos.</td></tr>';
}
function renderMeta(){
  const m=iso(new Date()).slice(0,7),v=R.filter(r=>isSale(r)&&String(r.fecha).slice(0,7)===m).reduce((s,r)=>s+r.monto,0),g=EX.meta||0,p=g?Math.min(v/g*100,100):0;
  $('meta').innerHTML=`<div class="bar"><b>🎯 Meta de ventas de este mes</b><span>Meta: <input type="number" value="${g||''}" placeholder="$ meta" style="width:130px" onchange="EX.meta=parseFloat(this.value)||0;guardarEnLocal();renderMeta()"></span></div><div class="hb" style="grid-template-columns:1fr 160px"><div class="t"><span style="width:${p}%;background:var(--g)"></span></div><b style="text-align:right">${fm(v)}${g?' / '+ab(g)+' ('+Math.round(v/g*100)+'%)':''}</b></div>`;
}

/* ---------- compra por lote (factura de proveedor) ---------- */
let CB=[];
const cbNum=x=>{let s=String(x==null?'':x).replace(/[^\d.,]/g,'');if(/^\d{1,3}([.,]\d{3})+$/.test(s))s=s.replace(/[.,]/g,'');else s=s.replace(',','.');const v=parseFloat(s);return isNaN(v)?'':v;};
const cbSub=r=>{const can=parseInt(r.can)||0,t=$('cbMod').value==='t',c=r.c!==''?parseFloat(r.c):(t?NaN:parseFloat($('cbDef').value));return isNaN(c)?0:(t?c:can*c);};
function cbAdd(k){for(let i=0;i<(k||1);i++)CB.push({n:'',can:'',c:'',p:''});cbRender();}
function cbRender(){
  const t=$('cbMod').value==='t';$('cbH').textContent=t?'Costo total':'Costo/und';
  $('cbRows').innerHTML=CB.map((r,i)=>`<tr><td><input list="prods" value="${esc(r.n)}" placeholder="Producto" data-i="${i}" data-k="n" style="min-width:190px"></td><td><input type="number" min="1" value="${r.can}" style="width:80px" data-i="${i}" data-k="can"></td><td><input type="number" value="${r.c}" placeholder="${$('cbDef').value||''}" style="width:115px" data-i="${i}" data-k="c"></td><td><input type="number" value="${r.p}" placeholder="${r.n?precioSug(PN(r.n))||'':''}" style="width:115px" data-i="${i}" data-k="p"></td><td class="n" id="cs${i}">${fm(cbSub(r))}</td><td><button class="btn r s" onclick="CB.splice(${i},1);cbRender()">✕</button></td></tr>`).join('');
  cbTot();
}
function cbTot(){let n=0,t=0;CB.forEach((r,i)=>{const s=cbSub(r);if(r.n.trim()){n++;t+=s;}const e=$('cs'+i);if(e)e.textContent=fm(s);});$('cbTot').textContent=n+' productos · '+fm(t);}
$('cbRows').addEventListener('input',e=>{const el=e.target;if(el.dataset.i===undefined)return;CB[el.dataset.i][el.dataset.k]=el.value;cbTot();});
$('cbRows').addEventListener('keydown',e=>{
  if(e.key!=='Enter')return;e.preventDefault();
  const ins=[...$('cbRows').querySelectorAll('input')],i=ins.indexOf(e.target);
  if(i<ins.length-1)ins[i+1].focus();else{cbAdd(1);$('cbRows').querySelector('tr:last-child input').focus();}
});
function cbPaste(){const t=$('cbTxt');t.style.display=t.style.display==='none'?'block':'none';if(t.style.display==='block')t.focus();}
function cbImport(){
  const L=$('cbTxt').value.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);let n=0;
  CB=CB.filter(r=>r.n.trim());
  L.forEach(l=>{let p=l.split(/\t|;/);if(p.length<2)p=l.split(',');const nm=(p[0]||'').trim();if(!nm)return;CB.push({n:nm,can:cbNum(p[1])||1,c:cbNum(p[2]),p:cbNum(p[3])});n++;});
  $('cbTxt').value='';$('cbTxt').style.display='none';if(!CB.length)cbAdd(5);else cbRender();toast(n?'📋 '+n+' filas cargadas, revisa y guarda':'No encontré líneas para cargar');
}
function cbSave(){
  const fec=$('cbFec').value||iso(new Date()),prov=$('cbProv').value.trim(),t=$('cbMod').value==='t',def=parseFloat($('cbDef').value);
  const rows=CB.filter(r=>r.n.trim());if(!rows.length){toast('Agrega al menos un producto');return;}
  const cost=r=>r.c!==''?parseFloat(r.c):(t?NaN:def);
  const bad=rows.filter(r=>!(parseInt(r.can)>0)||isNaN(cost(r)));
  if(bad.length){toast('Revisa cantidad y costo en: '+bad.slice(0,3).map(r=>r.n).join(', ')+(bad.length>3?'…':''));return;}
  const pago=$('cbPago').value,cred=pago==='credito';if(cred&&!prov){toast('Escribe el proveedor para dejar la compra por pagar');return;}
  const lote=Date.now();let tot=0;
  rows.forEach((r,i)=>{
    const can=parseInt(r.can),c=cost(r),monto=Math.round(t?c:can*c);tot+=monto;
    R.push({id:lote+i+1,fecha:fec,concepto:r.n.trim(),monto,tipo:cred?'porpagar':'egreso',categoria:'mercancia',cantidad:can,lote,...(cred?{}:{cuenta:pago}),...(prov?{proveedor:prov}:{})});
    if(r.p!==''&&parseFloat(r.p)>0){const k=PN(r.n);PR[k]=Object.assign(PR[k]||{},{precio:parseFloat(r.p)});}
  });
  CB=[];cbAdd(5);$('cbProv').value='';guardarEnLocal();render();toast('✅ Compra guardada: '+rows.length+' productos · '+fm(tot));
}
function renderLotes(){
  const G={};R.forEach(r=>{if(r.lote){const g=G[r.lote]=G[r.lote]||{f:r.fecha,p:r.proveedor||'',n:0,t:0};g.n++;g.t+=r.monto;}});
  const ks=Object.keys(G).sort((a,b)=>b-a).slice(0,15);
  $('cbList').innerHTML=ks.length?`<table><tbody>${ks.map(k=>`<tr><td>${G[k].f}</td><td>${esc(G[k].p||'—')}</td><td class="n">${G[k].n} productos</td><td class="n">${fm(G[k].t)}</td><td><button class="btn r s" onclick="cbDel(${k})">Eliminar lote</button></td></tr>`).join('')}</tbody></table>`:'<p class="mu">Aún no hay compras por lote.</p>';
}
function cbDel(l){if(confirm('¿Eliminar todos los productos de esta compra?')){R=R.filter(r=>r.lote!==l);guardarEnLocal();render();}}

/* ---------- venta rápida ---------- */
function qQuick(n){
  const k=PN(n);let pre=precioSug(k,$('qMay').checked);
  if(!pre){const v=parseFloat(String(prompt('Precio de venta de '+n+':')||'').replace(/[^\d.]/g,''));if(!(v>0))return;pre=v;}
  const it=cur.items.find(i=>i.n===k&&i.pre===pre);if(it)it.can++;else cur.items.push({n:k,can:1,pre});qRender();
}
function qChips(){
  const L=Object.keys(STK).filter(k=>STK[k]>0).sort().slice(0,80);
  $('qChips').innerHTML=L.map(k=>`<button class="chip" data-n="${esc(k)}" onclick="qQuick(this.dataset.n)">${esc(k)} <small>(${STK[k]})</small></button>`).join('')||'<span class="mu">Cuando tengas stock, tus productos aparecen aquí para venderlos con un toque.</span>';
}
function qCobrar(tipo){
  const q=qCur();if(!q.items.length){toast('Agrega productos primero');return;}
  if(tipo==='pendiente'&&!q.cli){toast('Escribe o elige el cliente para dejarlo fiado');return;}
  const over=q.items.filter(i=>i.n in STK&&i.can>STK[i.n]);
  if(over.length&&!confirm('Estás vendiendo más unidades que el stock registrado de: '+over.map(i=>i.n).join(', ')+'.\n¿Vender igual?'))return;
  $('qTipo').value='factura';qSave();qVender(cur.id,tipo);qNew();
}
$('qPre').addEventListener('keydown',e=>{if(e.key==='Enter'){qAdd();$('qProd').focus();}});
$('qProd').addEventListener('keydown',e=>{if(e.key==='Enter'){qSug();$('qPre').focus();}});

/* ---------- cotizaciones y facturas ---------- */
const dn=q=>(q.tipo==='factura'?'FAC-':'COT-')+String(q.num||0).padStart(3,'0');
const qT=q=>{const s=q.items.reduce((a,i)=>a+i.can*i.pre,0),d=s*Math.min(Math.max(q.des||0,0),100)/100,b=s-d,i=b*(q.iva||0)/100;return{s,d,b,i,t:b+i};};
function qCur(){return{id:cur.id,num:cur.num,est:cur.est||'pendiente',tipo:$('qTipo').value||'cotizacion',cli:$('qCli').value.trim(),tel:$('qTel').value.trim(),fec:$('qFec').value,items:cur.items.map(i=>({...i})),des:parseFloat($('qDes').value)||0,iva:parseFloat($('qIva').value)||0,nota:$('qNota').value.trim()};}
function qPickCli(){const c=CL.find(x=>String(x.id)===$('qCl').value);if(c){$('qCli').value=c.n;$('qTel').value=c.t||'';}}
function qSug(){const n=PN($('qProd').value);if(n)$('qPre').value=precioSug(n,$('qMay').checked)||'';}
function qAdd(){
  const n=PN($('qProd').value),can=parseInt($('qCan').value)||1,pre=parseFloat($('qPre').value);
  if(!n||isNaN(pre)){toast('Elige un producto y escribe el precio');return;}
  cur.items.push({n,can,pre});$('qProd').value='';$('qPre').value='';$('qCan').value='1';qRender();
}
function qSet(k,f,v){cur.items[k][f]=f==='can'?(parseInt(v)||1):(parseFloat(v)||0);qRender();}
function qRender(){
  $('qItems').innerHTML=cur.items.length?`<table><tbody>${cur.items.map((i,k)=>`<tr><td><b>${esc(i.n)}</b>${i.n in STK&&i.can>STK[i.n]?` <small class="neg">⚠ stock ${STK[i.n]}</small>`:''}</td><td><input type="number" min="1" value="${i.can}" style="width:62px" onchange="qSet(${k},'can',this.value)"></td><td><input type="number" value="${i.pre}" style="width:105px" onchange="qSet(${k},'pre',this.value)"></td><td class="n">${fm(i.can*i.pre)}</td><td><button class="btn r s" onclick="cur.items.splice(${k},1);qRender()">✕</button></td></tr>`).join('')}</tbody></table>`:'<p class="mu">Agrega productos para armar el documento.</p>';
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
  $('qList').innerHTML=Q.length?`<table><thead><tr><th>N°</th><th>Cliente</th><th class="n">Total</th><th>Estado</th><th></th></tr></thead><tbody>${Q.slice().sort((a,b)=>b.id-a.id).map(q=>`<tr><td><b>${dn(q)}</b><br><small class="mu">${q.fec}</small></td><td>${esc(q.cli||'—')}</td><td class="n">${fm(qT(q).t)}</td><td><select style="width:auto" onchange="qEst(${q.id},this.value)">${['pendiente','aceptada','rechazada','vendida'].map(e=>`<option ${q.est===e?'selected':''}>${e}</option>`).join('')}</select></td><td><button class="btn o s" onclick="qLoad(${q.id})">✏️</button> <button class="btn b s" onclick="qWA(${q.id})">📲</button> <button class="btn p s" onclick="qPrint(${q.id})">🖨️</button> ${q.est==='vendida'?'<span class="badge">Facturada</span>':`<button class="btn s" onclick="qVender(${q.id},'ingreso')">💵 Contado</button> <button class="btn o s" onclick="qVender(${q.id},'pendiente')">☐ Fiado</button>`} <button class="btn r s" onclick="qDel(${q.id})">🗑️</button></td></tr>`).join('')}</tbody></table><p class="mu">💵 convertir en venta de contado · ☐ convertir en venta fiada (va a cartera). El stock se descuenta solo.</p>`:'<p class="mu">Aún no has guardado documentos.</p>';
}
function qEst(id,v){const q=Q.find(x=>x.id===id);if(q){q.est=v;guardarEnLocal();}}
function qDel(id){if(confirm('¿Eliminar este documento?')){Q=Q.filter(x=>x.id!==id);guardarEnLocal();qList();}}
function qVender(id,tipo){
  const q=Q.find(x=>x.id===id);
  if(!q||(q.est==='vendida'&&!confirm('Este documento ya se convirtió en venta. ¿Registrarlo otra vez?')))return;
  const f=iso(new Date()),d=1-(q.des||0)/100,t=qT(q),cl=q.cli||'',ct=$('qCta').value||'Efectivo';
  q.items.forEach((i,k)=>R.push({id:Date.now()+k,fecha:f,concepto:i.n,monto:Math.round(i.can*i.pre*d),tipo:i.pre===0?'obsequio':tipo,categoria:'mercancia',cantidad:i.can,cliente:cl,cuenta:ct}));
  if(t.i>0)R.push({id:Date.now()+99,fecha:f,concepto:'IVA '+dn(q),monto:Math.round(t.i),tipo,categoria:'general',cantidad:1,cliente:cl,cuenta:ct});
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
  {const m=migrarDatos({registros:d,productos:x.productos||{}});d=m.registros;if(x.productos)x.productos=m.productos;}
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
  const url=URL.createObjectURL(new Blob([JSON.stringify({version:6,registros:R,cotizaciones:Q,categorias:CC,productos:PR,meta:EX.meta,clientes:CL,empresa:EMP},null,2)],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download='backup_palmascent_v6.json';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url);
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
function wa(t,x){t=String(t||'').replace(/\D/g,'');if(t.length===10)t='57'+t;window.open('https://wa.me/'+t+'?text='+encodeURIComponent(x),'_blank');}
function cobrarWA(n){const c=CL.find(x=>x.n===n)||{};wa(c.t,'Hola '+n+', te escribo de '+(EMP.n||'Palmascent')+'. Tienes un saldo pendiente de '+fm(deu()[n]||0)+'. ¡Gracias!');}
function renderCar(){
  const D=deu(),V={};$('clistD').innerHTML=Object.keys(D).filter(k=>D[k]>0).map(k=>`<option value="${esc(k)}">`).join('');R.forEach(r=>{if(isSale(r)&&r.cliente)V[r.cliente]=(V[r.cliente]||0)+r.monto;});
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
function setDoc(d){d=migrarDatos(d);R=d.registros||[];Q=d.cotizaciones||[];CC=d.categorias||{};PR=d.productos||{};EX.meta=d.meta||0;CL=d.clientes||[];EMP=d.empresa||{};}
function refrescar(){fillCats();fillCli();render();qList();qRender();pintarEmp();}
function empujar(){
  if(!SB||!USER)return;estado('⏳ Guardando…');clearTimeout(pushT);
  pushT=setTimeout(async()=>{
    if(!navigator.onLine){estado('📴 Sin conexión: se subirá al volver');return;}
    try{const{error}=await SB.from('palmascent_data').upsert({user_id:USER.id,data:{version:6,registros:R,cotizaciones:Q,categorias:CC,productos:PR,meta:EX.meta,clientes:CL,empresa:EMP},updated_at:new Date(TS).toISOString()});
      estado(error?'⚠️ Error de nube':'☁️ Sincronizado');if(!error)publicarTienda();}catch(e){estado('📴 Sin conexión');}
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
  const msg=t=>{$('lgM').textContent=t;};
  if(!CFG.SUPABASE_URL||!CFG.SUPABASE_ANON_KEY){diag();return;}
  if(!SB){msg('Conectando con la nube…');if(!(await crearSB())){msg('No pude cargar Supabase. Revisa tu internet y vuelve a intentar.');return;}}
  const email=$('lgE').value.trim(),password=$('lgP').value;
  if(!email||password.length<6){msg('Escribe tu correo y una contraseña de mínimo 6 caracteres.');return;}
  msg('…');
  try{
    const{data,error}=m==='up'?await SB.auth.signUp({email,password}):await SB.auth.signInWithPassword({email,password});
    if(error){msg(error.message);return;}
    if(data.session)entrar(data.user);else msg('Cuenta creada. Revisa tu correo para confirmarla y luego pulsa Entrar (o desactiva "Confirm email" en Supabase).');
  }catch(e){msg('Error de conexión: '+(e&&e.message||e));}
}
function masMenu(f){const s=$('sheet');s.classList.toggle('on',f===undefined?!s.classList.contains('on'):f);}
function estadoClick(){if(USER)verTab('ajustes');else{$('login').classList.add('on');diag();}}
const cargarSB=()=>new Promise(ok=>{
  if(window.supabase)return ok(true);
  const vs=['2.58.0','2.45.4'];let i=0;
  const next=()=>{if(i>=vs.length)return ok(false);const e=document.createElement('script');e.src='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@'+vs[i++]+'/dist/umd/supabase.js';e.onload=()=>ok(!!window.supabase);e.onerror=next;document.head.appendChild(e);};
  next();
});
async function crearSB(){
  if(SB)return true;if(!(await cargarSB()))return false;
  try{SB=window.supabase.createClient(String(CFG.SUPABASE_URL).trim().replace(/\/rest\/v1\/?$/,'').replace(/\/$/,''),String(CFG.SUPABASE_ANON_KEY).trim());return true;}catch(e){return false;}
}
function diag(){
  const u=!!(CFG.SUPABASE_URL&&String(CFG.SUPABASE_URL).trim()),k=!!(CFG.SUPABASE_ANON_KEY&&String(CFG.SUPABASE_ANON_KEY).trim());
  $('lgM').textContent=(u&&k)?(SB?'Nube lista ✓':'Conectando con la nube…'):'⚠️ config.js está vacío: falta '+(!u?'la URL ':'')+(!k?'la llave ':'')+'(Project URL y Publishable key de Supabase).';
}
function usarLocal(){localStorage.setItem(KEY+'_solo','1');$('login').classList.remove('on');estado('● Solo en este dispositivo');}
async function salir(){if(SB)await SB.auth.signOut();USER=null;localStorage.removeItem(KEY+'_solo');$('login').classList.add('on');estado('● Sin sesión');}
async function publicarTienda(manual){
  if(!SB||!USER)return;
  try{
    const{data,error}=await SB.from('tienda_catalogo').select('data').eq('id',1).maybeSingle();
    if(error)throw error;
    if(!data||!data.data||!Array.isArray(data.data.productos)){if(manual)toast('La tienda aún no tiene catálogo: entra a la tienda con "Acceso dueño" para crearlo.');return;}
    const st={};calc().L.forEach(p=>st[p.n]=p.stock);let n=0,cambio=false;
    const prods=data.data.productos.map(p=>{const k=PN(p.n);if(!(k in st))return p;n++;const stock=Math.max(st[k],0),a=st[k]>0?'1':'0';if(p.stock!==stock||String(p.a)!==a)cambio=true;return{...p,stock,a};});
    if(!cambio){if(manual)toast('🛍️ La tienda ya estaba al día ('+n+' productos con inventario)');return;}
    const{error:e2}=await SB.from('tienda_catalogo').upsert({id:1,data:{...data.data,productos:prods},updated_at:new Date().toISOString()});
    if(manual||e2)toast(e2?'⚠️ No se pudo actualizar la tienda (¿tu cuenta es la de dueño?)':'🛍️ Tienda actualizada: '+n+' productos con inventario');
  }catch(e){if(manual)toast('📴 No pude conectar con la tienda');}
}
/* ---------- v6: cuentas, migración, obsequios, por pagar, devoluciones ---------- */
const CUENTAS=['Efectivo','Nequi','Bancolombia','Otro'];
const cta=r=>r.cuenta||'Efectivo';
const flujo=r=>['ingreso','pagado','abono'].includes(r.tipo)?r.monto:(r.tipo==='egreso'||r.tipo==='pagoprov'||(r.tipo==='devolucion'&&!r.deuda))?-r.monto:0;
function migrarDatos(d){
  const reg=(d.registros||[]).map(r=>{
    const x={...r};
    if(cat(x)==='mercancia')x.concepto=String(x.concepto).trim().toUpperCase();
    if(!x.cuenta&&['ingreso','egreso','pagado','abono','devolucion','pagoprov'].includes(x.tipo))x.cuenta='Efectivo';
    if(cat(x)==='mercancia'&&x.tipo==='ingreso'&&Number(x.monto)===0)x.tipo='obsequio';
    return x;});
  const pr={};Object.keys(d.productos||{}).forEach(k=>{const n=PN(k);pr[n]=Object.assign(pr[n]||{},d.productos[k]);});
  return{...d,registros:reg,productos:pr,version:6};
}
function fillCuentas(){document.querySelectorAll('.ctasel').forEach(s=>{const v=s.value;s.innerHTML=CUENTAS.map(c=>`<option>${c}</option>`).join('');s.value=v||'Efectivo';});}
function formSmart(){
  const t=$('tipo').value,c=$('categoria').value;
  $('cantidad').style.display=(beh(c)!=='mercancia'&&t!=='obsequio')?'none':'';
  $('cliente').style.display=(t==='pendiente'||t==='abono')?'':'none';
  $('cliente').setAttribute('list',t==='abono'?'clistD':'clist');
  $('destino').style.display=t==='transferencia'?'':'none';
  $('cuenta').style.display=(t==='pendiente'||t==='obsequio')?'none':'';
}
const pidCta=(m,d)=>{const x=prompt(m+' ('+CUENTAS.join(' / ')+')',d);if(x===null)return null;return CUENTAS.find(c=>c.toLowerCase()===x.trim().toLowerCase())||null;};
function deuProv(){const D={};R.forEach(r=>{const k=r.proveedor||'Sin proveedor';if(r.tipo==='porpagar')D[k]=(D[k]||0)+r.monto;else if(r.tipo==='pagoprov')D[k]=(D[k]||0)-r.monto;});return D;}
function renderPorPagar(){
  const D=deuProv(),ks=Object.keys(D).filter(k=>D[k]>0).sort((a,b)=>D[b]-D[a]);
  $('cpgList').innerHTML=ks.length?`<table><tbody>${ks.map(k=>`<tr><td><b>${esc(k)}</b></td><td class="n pen">${fm(D[k])}</td><td><button class="btn b s" data-n="${esc(k)}" onclick="pagarProv(this.dataset.n)">Pagar / abonar</button></td></tr>`).join('')}</tbody></table>`:'<p class="mu">No le debes nada a proveedores 🎉</p>';
}
function qCot(){$('qTipo').value='cotizacion';qSave();}
function qMayor(){const m=$('qMay').checked;cur.items.forEach(i=>{const p=precioSug(i.n,m);if(p)i.pre=p;});qRender();}

/* ---------- v6.1: modales, tendencias, tooltips y tablas móviles ---------- */
function modalForm(t,campos,ok){
  const d=document.createElement('div');d.className='modal on';
  d.innerHTML=`<div class="box" style="max-width:380px;width:92%;margin:0"><h3>${t}</h3><div class="form" style="grid-template-columns:1fr">${campos.map(c=>`<label class="mu">${c.l}${c.o?`<select id="mf_${c.id}">${c.o.map(x=>`<option ${x===c.v?'selected':''}>${x}</option>`).join('')}</select>`:`<input id="mf_${c.id}" type="number" value="${c.v==null?'':c.v}" ${c.max?'max="'+c.max+'"':''}>`}</label>`).join('')}</div><div style="display:flex;gap:8px;margin-top:14px"><button class="btn" id="mf_ok">Aceptar</button><button class="btn" style="background:#7f8c8d" id="mf_no">Cancelar</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector('#mf_no').onclick=()=>d.remove();
  d.querySelector('#mf_ok').onclick=()=>{const x={};campos.forEach(c=>x[c.id]=d.querySelector('#mf_'+c.id).value);d.remove();ok(x);};
}
function transferir(){modalForm('⇄ Transferir entre cuentas',[{id:'o',l:'Desde',o:CUENTAS,v:'Nequi'},{id:'d',l:'Hacia',o:CUENTAS,v:'Efectivo'},{id:'m',l:'Monto ($)'}],x=>hacerTransf(x.o,x.d,parseFloat(x.m)));}
function hacerTransf(o,d,m){
  if(o===d||!(m>0)){toast('Elige dos cuentas distintas y un monto');return;}
  R.push({id:Date.now(),fecha:iso(new Date()),concepto:'Transferencia '+o+' → '+d,monto:m,tipo:'transferencia',categoria:'general',cantidad:1,cuenta:o,destino:d});
  guardarEnLocal();render();toast('⇄ '+fm(m)+' pasados de '+o+' a '+d);
}
function devolver(id){
  const r=R.find(x=>x.id===id);if(!r)return;const max=qty(r),c=[{id:'q',l:'Unidades devueltas (máx '+max+')',v:max,max}];
  if(r.tipo!=='pendiente')c.push({id:'c',l:'Reembolso desde la cuenta',o:CUENTAS,v:cta(r)});
  modalForm('↩ Devolución de '+esc(r.concepto),c,x=>hacerDev(id,parseInt(x.q),x.c||cta(r)));
}
function hacerDev(id,q,c){
  const r=R.find(x=>x.id===id),max=r?qty(r):0;if(!r||!(q>0)||q>max){toast('Cantidad no válida');return;}
  const m=Math.round(r.monto*q/max),deuda=r.tipo==='pendiente';
  R.push({id:Date.now(),fecha:iso(new Date()),concepto:r.concepto,monto:m,tipo:'devolucion',categoria:'mercancia',cantidad:q,cuenta:c,cliente:r.cliente,deuda});
  guardarEnLocal();render();toast('↩ Devolución registrada: '+q+' und · '+fm(m));
}
function pagarProv(n){const d=Math.round(deuProv()[n]||0);modalForm('Pago a '+esc(n)+' (debes '+fm(d)+')',[{id:'m',l:'Monto ($)',v:d},{id:'c',l:'Pagar desde',o:CUENTAS,v:$('cpgCta').value||'Efectivo'}],x=>hacerPago(n,parseFloat(x.m),x.c));}
function hacerPago(n,m,c){
  const d=Math.round(deuProv()[n]||0);if(!(m>0))return;
  R.push({id:Date.now(),fecha:iso(new Date()),concepto:'Pago a '+n,monto:Math.min(m,d>0?d:m),tipo:'pagoprov',categoria:'general',cantidad:1,proveedor:n,cuenta:c});
  guardarEnLocal();render();toast('✅ Pago a proveedor registrado');
}
function abonar(n,todo){
  const d=Math.round(deu()[n]||0);
  if(todo)return hacerAbono(n,d,$('carCta').value||'Efectivo');
  modalForm('Abono de '+esc(n)+' (debe '+fm(d)+')',[{id:'m',l:'Monto ($)',v:d},{id:'c',l:'Cuenta que recibe',o:CUENTAS,v:$('carCta').value||'Efectivo'}],x=>hacerAbono(n,parseFloat(x.m),x.c));
}
function hacerAbono(n,m,c){
  const d=Math.round(deu()[n]||0);if(!(m>0))return;if(d>0)m=Math.min(m,d);
  R.push({id:Date.now(),fecha:iso(new Date()),concepto:'Abono '+n,monto:m,tipo:'abono',categoria:'general',cantidad:1,cliente:n,cuenta:c});
  guardarEnLocal();render();toast('✅ Pago registrado: '+fm(m)+' en '+c);
}
function rangoPrev(){
  const h=new Date(),y=h.getFullYear(),m=h.getMonth(),p=$('per').value;
  if(p==='mes')return[iso(new Date(y,m-1,1)),iso(new Date(y,m,0))];
  if(p==='mesant')return[iso(new Date(y,m-2,1)),iso(new Date(y,m-1,0))];
  if(p==='30d')return[iso(new Date(y,m,h.getDate()-60)),iso(new Date(y,m,h.getDate()-31))];
  if(p==='anio')return[(y-1)+'-01-01',(y-1)+'-12-31'];
  return null;
}
const tr=(v,pv,inv)=>{if(!pv)return'';const d=(v-pv)/Math.abs(pv)*100,ok=inv?d<=0:d>=0;return `<span class="trend ${ok?'up':'dn'}">${d>=0?'▲':'▼'} ${Math.abs(d).toFixed(0)}% vs. periodo anterior</span>`;};
function etiquetar(){
  document.querySelectorAll('table').forEach(t=>{
    const h=[...t.querySelectorAll('thead th')].map(x=>x.textContent.trim());if(!h.length)return;t.classList.add('rs');
    t.querySelectorAll('tbody tr').forEach(r=>[...r.children].forEach((td,i)=>{if(h[i]&&!td.dataset.l)td.dataset.l=h[i];}));
  });
}
if(window.MutationObserver){let et;new MutationObserver(()=>{clearTimeout(et);et=setTimeout(etiquetar,40);}).observe(document.body,{childList:true,subtree:true});}
const tipEl=document.createElement('div');tipEl.id='tip';document.body.appendChild(tipEl);
['pointermove','pointerdown'].forEach(ev=>document.addEventListener(ev,e=>{
  const h=e.target.closest&&e.target.closest('.hit');
  if(!h){tipEl.style.display='none';return;}
  tipEl.innerHTML=h.dataset.tip;tipEl.style.display='block';tipEl.style.left=Math.max(8,Math.min(e.clientX+14,innerWidth-180))+'px';tipEl.style.top=(e.clientY+14)+'px';
}));

async function iniciar(){
  cargarDeLocal();TS=Number(localStorage.getItem(KEY+'_ts'))||0;fillCli();pintarEmp();$('cbFec').value=iso(new Date());cbAdd(5);fillCuentas();formSmart();
  if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});
  if(!CFG.SUPABASE_URL||!CFG.SUPABASE_ANON_KEY){estado('● Solo en este dispositivo');$('cuenta').textContent='La nube no está configurada: completa config.js con los datos de Supabase. Mientras tanto todo funciona en este dispositivo.';return;}
  if(!(await crearSB())){estado('📴 Nube no disponible (modo local)');return;}
  window.addEventListener('online',()=>{if(USER)nubeSync();});window.addEventListener('offline',()=>estado('📴 Sin conexión'));
  let s=null;try{s=(await SB.auth.getSession()).data.session;}catch(e){}
  if(s)await entrar(s.user);else if(localStorage.getItem(KEY+'_solo')!=='1'){$('login').classList.add('on');diag();}
  else estado('● Solo en este dispositivo');
  SB.auth.onAuthStateChange(ev=>{if(ev==='SIGNED_OUT')USER=null;});
}
iniciar();
