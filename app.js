// CONFIGURACIÓN DE FIREBASE (Reemplaza con tus llaves del proyecto de Firebase)
const firebaseConfig = {
  apiKey: "TU_API_KEY_AQUI",
  authDomain: "tu-proyecto.firebaseapp.com",
  projectId: "tu-proyecto",
  storageBucket: "tu-proyecto.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:000000000000"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let logoBase64 = localStorage.getItem('palmascent_logo') || 'logo.png';
let R = [], Q = [], PR = {}, CC = {};

// Cargar Logo Inicial
document.addEventListener('DOMContentLoaded', () => {
  if (logoBase64) {
    document.getElementById('appLogo').src = logoBase64;
    document.getElementById('loginLogoPreview').src = logoBase64;
  }
});

// Autenticación en la Nube
function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPassword').value;

  auth.signInWithEmailAndPassword(email, pass)
    .then(userCredential => {
      document.getElementById('loginScreen').style.display = 'none';
      document.getElementById('appScreen').style.display = 'block';
      cargarDatosFirestore();
    })
    .catch(error => alert("Error de acceso: " + error.message));
}

function handleLogout() {
  auth.signOut().then(() => {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appScreen').style.display = 'none';
  });
}

// Cargar imagen de Logo y guardar en Base64
function subirLogo(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    logoBase64 = e.target.result;
    localStorage.setItem('palmascent_logo', logoBase64);
    document.getElementById('appLogo').src = logoBase64;
    document.getElementById('loginLogoPreview').src = logoBase64;
    alert("✅ Logo actualizado correctamente para tus facturas");
  };
  reader.readAsDataURL(file);
}

// Sincronización en tiempo real con la Nube
function cargarDatosFirestore() {
  db.collection("negocio").doc("movimientos").onSnapshot(doc => {
    if (doc.exists) {
      R = doc.data().registros || [];
      Q = doc.data().cotizaciones || [];
      render();
    }
  });
}

function guardarEnNube() {
  db.collection("negocio").doc("movimientos").set({
    registros: R,
    cotizaciones: Q,
    ultimaActualizacion: new Date()
  });
}

// Impresión de Facturas con LOGO Integrado
function qPrint(id) {
  const q = Q.find(x => x.id === id) || cur;
  if (!q || !q.items.length) { alert('La cotización está vacía'); return; }
  
  const w = window.open('', '_blank');
  const rows = q.items.map(i => `<tr><td>${i.n}</td><td style="text-align:right">${i.can}</td><td style="text-align:right">$${i.pre.toLocaleString('es-CO')}</td><td style="text-align:right">$${(i.can*i.pre).toLocaleString('es-CO')}</td></tr>`).join('');
  
  w.document.write(`
    <html>
      <head>
        <title>Factura / Cotización Palmascent</title>
        <style>
          body { font-family: sans-serif; padding: 20px; max-width: 700px; margin: auto; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #0e3b2f; padding-bottom: 10px; }
          .logo { max-height: 80px; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { padding: 8px; border-bottom: 1px solid #ddd; }
          .total { text-align: right; font-size: 1.4em; margin-top: 20px; color: #0e3b2f; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <h2>Palmascent</h2>
            <p>Control de Ventas y Productos</p>
          </div>
          <img src="${logoBase64}" class="logo" alt="Logo">
        </div>
        <h3>Cotización / Factura N° ${q.num || ''}</h3>
        <p>Cliente: <b>${q.cli || 'Cliente general'}</b><br>Fecha: ${q.fec}</p>
        <table>
          <thead><tr><th>Producto</th><th style="text-align:right">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Subtotal</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <div class="total"><b>Total: $${q.items.reduce((s,i)=>s+i.can*i.pre,0).toLocaleString('es-CO')}</b></div>
        <script>onload = () => print();<\/script>
      </body>
    </html>
  `);
  w.document.close();
}