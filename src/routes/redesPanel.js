/**
 * ============================================================
 *  PANEL DE APROBACIÓN DE REDES — Lavaderos Moreno
 * ============================================================
 *  Rutas:
 *   GET  /redes/panel?token=XXX     → la página web (celular)
 *   GET  /redes/pendientes?token=XXX → lista JSON de pendientes
 *   POST /redes/:id/publicar         → publica en FB e IG
 *   POST /redes/:id/regenerar        → nueva imagen (body: { busqueda })
 *   POST /redes/:id/descartar        → descarta la propuesta
 *
 *  Protegido por token. Definí PANEL_TOKEN en Railway.
 * ============================================================
 */

const express = require("express");
const router = express.Router();
const {
  listarPendientes,
  publicarPendiente,
  regenerarImagen,
  descartarPendiente,
} = require("../jobs/socialScheduler");

// Middleware simple de token (acepta ?token= o header x-panel-token)
function checkToken(req, res, next) {
  const token = req.query.token || req.headers["x-panel-token"];
  if (!process.env.PANEL_TOKEN || token !== process.env.PANEL_TOKEN) {
    return res.status(401).send("No autorizado");
  }
  next();
}

// Lista de pendientes (JSON)
router.get("/pendientes", checkToken, async (req, res) => {
  try {
    res.json(await listarPendientes());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/publicar", checkToken, async (req, res) => {
  try {
    res.json(await publicarPendiente(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/regenerar", checkToken, async (req, res) => {
  try {
    const busqueda = (req.body && req.body.busqueda) || "";
    if (!busqueda) return res.status(400).json({ error: "Falta la búsqueda." });
    res.json(await regenerarImagen(req.params.id, busqueda));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.post("/:id/descartar", checkToken, async (req, res) => {
  try {
    res.json(await descartarPendiente(req.params.id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Página web del panel (celular)
router.get("/panel", checkToken, (req, res) => {
  const token = req.query.token;
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(PANEL_HTML.replace(/__TOKEN__/g, token));
});

const PANEL_HTML = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Panel Redes · Lavaderos Moreno</title>
<style>
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; background:#0E1A2B; color:#E8EEF6; }
  header { padding:18px 16px; background:#16263F; position:sticky; top:0; border-bottom:2px solid #E23B3B; }
  header h1 { margin:0; font-size:18px; }
  header p { margin:4px 0 0; font-size:13px; color:#AEBDD0; }
  .wrap { padding:16px; max-width:520px; margin:0 auto; }
  .card { background:#16263F; border-radius:14px; overflow:hidden; margin-bottom:18px; border:1px solid #24364f; }
  .card img { width:100%; display:block; }
  .body { padding:14px; }
  .badge { display:inline-block; background:#E23B3B; color:#fff; font-size:11px; padding:3px 10px; border-radius:20px; margin-bottom:8px; }
  .caption { font-size:14px; white-space:pre-wrap; line-height:1.4; }
  .tags { color:#7FA8D8; font-size:13px; margin-top:6px; }
  .actions { display:flex; gap:8px; margin-top:14px; flex-wrap:wrap; }
  button { flex:1; min-width:90px; border:0; border-radius:10px; padding:12px; font-size:14px; font-weight:600; cursor:pointer; }
  .pub { background:#2ecc71; color:#06281a; }
  .reg { background:#f1c40f; color:#3b2e00; }
  .des { background:#3a4a63; color:#E8EEF6; }
  .regbox { margin-top:10px; display:none; gap:8px; }
  .regbox input { flex:1; padding:11px; border-radius:9px; border:1px solid #33486a; background:#0E1A2B; color:#fff; font-size:14px; }
  .empty { text-align:center; color:#AEBDD0; padding:40px 10px; }
  .msg { text-align:center; padding:10px; font-size:13px; color:#AEBDD0; }
  .spin { opacity:.5; pointer-events:none; }
</style>
</head>
<body>
<header>
  <h1>📣 Publicaciones pendientes</h1>
  <p>Revisá y aprobá lo que el agente preparó.</p>
</header>
<div class="wrap" id="lista"><div class="msg">Cargando…</div></div>

<script>
const TOKEN = "__TOKEN__";
const API = "/redes";

async function cargar() {
  const cont = document.getElementById("lista");
  cont.innerHTML = '<div class="msg">Cargando…</div>';
  try {
    const r = await fetch(API + "/pendientes?token=" + TOKEN);
    const data = await r.json();
    if (!Array.isArray(data) || data.length === 0) {
      cont.innerHTML = '<div class="empty">No hay publicaciones pendientes.<br>Cuando el agente prepare algo, va a aparecer acá.</div>';
      return;
    }
    cont.innerHTML = data.map(render).join("");
  } catch (e) {
    cont.innerHTML = '<div class="empty">Error cargando. Recargá la página.</div>';
  }
}

function render(p) {
  const tags = (p.hashtags || []).join(" ");
  return \`
  <div class="card" id="card-\${p.id}">
    <img src="\${p.image_url}" alt="">
    <div class="body">
      <span class="badge">\${p.modo === "frase" ? "FOTO + FRASE" : "PLACA"}</span>
      <div class="caption">\${escapeHtml(p.caption || "")}</div>
      <div class="tags">\${escapeHtml(tags)}</div>
      <div class="actions">
        <button class="pub" onclick="publicar(\${p.id})">✅ Publicar</button>
        <button class="reg" onclick="toggleReg(\${p.id})">🔄 Otra imagen</button>
        <button class="des" onclick="descartar(\${p.id})">🗑️</button>
      </div>
      <div class="regbox" id="reg-\${p.id}">
        <input id="q-\${p.id}" placeholder="¿Qué imagen buscar? (ej: ropa doblada)">
        <button class="reg" onclick="regenerar(\${p.id})">Buscar</button>
      </div>
    </div>
  </div>\`;
}

function toggleReg(id){
  const b = document.getElementById("reg-"+id);
  b.style.display = b.style.display === "flex" ? "none" : "flex";
}

async function publicar(id){
  if(!confirm("¿Publicar en Facebook e Instagram?")) return;
  setBusy(id,true);
  const r = await fetch(API+"/"+id+"/publicar?token="+TOKEN,{method:"POST"});
  const d = await r.json();
  if(d.facebook || d.instagram){ removeCard(id); alert("¡Publicado!"); }
  else { alert("Error: "+(d.facebook_error||d.instagram_error||d.error||"desconocido")); setBusy(id,false); }
}

async function regenerar(id){
  const q = document.getElementById("q-"+id).value.trim();
  if(!q){ alert("Escribí qué imagen buscar."); return; }
  setBusy(id,true);
  const r = await fetch(API+"/"+id+"/regenerar?token="+TOKEN,{
    method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({busqueda:q})
  });
  const d = await r.json();
  if(d.image_url){
    const img = document.querySelector("#card-"+id+" img");
    img.src = d.image_url + "?t=" + Date.now();
    toggleReg(id);
  } else { alert("Error: "+(d.error||"no se pudo regenerar")); }
  setBusy(id,false);
}

async function descartar(id){
  if(!confirm("¿Descartar esta propuesta?")) return;
  await fetch(API+"/"+id+"/descartar?token="+TOKEN,{method:"POST"});
  removeCard(id);
}

function setBusy(id,b){ const c=document.getElementById("card-"+id); if(c) c.classList.toggle("spin",b); }
function removeCard(id){ const c=document.getElementById("card-"+id); if(c) c.remove();
  if(!document.querySelector(".card")) cargar(); }
function escapeHtml(s){ return (s||"").replace(/[&<>"]/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

cargar();
</script>
</body>
</html>`;

module.exports = router;
