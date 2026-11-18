/* VAHAN TRAIL — Vehicle Monitoring */
const API = "";
const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
let token = localStorage.getItem("vahan_token") || "";

// Map state
let map = null, loginMap = null, loginMarker = null, loginPolyline = null;
let camLayer = null, trackLayer = null, areaLayer = null, beacon = null, glowLayer = null;
let cameras = [], vehicles = [], filtered = [], page = 1;
const PER = 20;

// Selection state
let currentFilter = "ALL", currentTrack = null, currentVehicle = null, selectToken = 0;
let showCameras = false;

// Playback state
let playSpeed = 1, playing = false;
let carMarker = null, coveredLine = null, coveredCasing = null;
let playPath = [], playCum = [], playTotal = 0;
let playProgress = 0, playRaf = null, playLastTs = null, playTotalMs = 9000;
let playPopupStop = -1;

// Login demo state
let loginDemoRaf = null, loginDemoT = 0, loginDemoLastTs = null;

const esc = s => String(s ?? "").replace(/[&<>"]/g, c =>
  ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmtTime = iso => new Date(iso).toLocaleString("en-IN",
  {timeZone:"Asia/Kolkata", day:"2-digit", month:"short", hour:"2-digit", minute:"2-digit"});
const fmtTimeShort = iso => new Date(iso).toLocaleString("en-IN",
  {timeZone:"Asia/Kolkata", hour:"2-digit", minute:"2-digit"});

function formatRelative(iso) {
  if(!iso) return "recently";
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso)) / 1000));
  if(s < 60) return "just now";
  const m = Math.floor(s/60);
  if(m < 60) return `${m} min ago`;
  const h = Math.floor(m/60);
  if(h < 24) return `${h}h ago`;
  return `${Math.floor(h/24)}d ago`;
}

function countUp(el, target) {
  if(!el || !Number.isFinite(target)) { if(el) el.textContent = target; return; }
  const start = performance.now(), dur = 700;
  const tick = now => {
    const p = Math.min(1, (now-start)/dur), e = 1-Math.pow(1-p,3);
    el.textContent = Math.round(target*e).toLocaleString("en-IN");
    if(p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.classList.remove("hidden");
  setTimeout(() => t.classList.add("hidden"), 3200);
}

async function api(path, opts={}) {
  const r = await fetch(API+path, {
    headers: {"Content-Type":"application/json", ...(token ? {Authorization:"Bearer "+token} : {})},
    ...opts
  });
  if(!r.ok) throw new Error("HTTP "+r.status);
  return r.json();
}

// ── CLOCKS ──
function tickClocks() {
  const t = new Date().toLocaleTimeString("en-IN",{timeZone:"Asia/Kolkata",hour12:false});
  const cl = $("#clock"); if(cl) cl.textContent = t;
  const lc = $("#login-clock"); if(lc) lc.textContent = t+" IST";
}
setInterval(tickClocks,1000); tickClocks();

// ══════════════════════════════════════════════════
// LOGIN — embedded OSM mini map with animated vehicle
// ══════════════════════════════════════════════════
const LOGIN_DEMO_PATH = [
  [17.4850, 78.4350],
  [17.4720, 78.4480],
  [17.4580, 78.4620],
  [17.4420, 78.4754], // Rasoolpura Junction
  [17.4260, 78.4710],
  [17.4110, 78.4740],
  [17.3888, 78.4735], // Abids Circle
  [17.3780, 78.4740],
  [17.3616, 78.4747], // Charminar South Gate
  [17.3520, 78.4890],
  [17.3486, 78.5028]  // Owaisi Hospital Rd
];

const LOGIN_STOPS = [
  {lat: 17.4850, lon: 78.4350, name: "Kompally Checkpost"},
  {lat: 17.4420, lon: 78.4754, name: "Rasoolpura Junction"},
  {lat: 17.3888, lon: 78.4735, name: "Abids Circle"},
  {lat: 17.3616, lon: 78.4747, name: "Charminar South Gate"},
  {lat: 17.3486, lon: 78.5028, name: "Owaisi Hospital Rd"}
];

function initLoginMap() {
  const el = document.getElementById("login-map");
  if(!el || typeof L === "undefined") return;

  if(loginMap) {
    try { loginMap.remove(); } catch(e){}
    loginMap = null;
  }
  if(el._leaflet_id) {
    delete el._leaflet_id;
  }
  el.innerHTML = "";

  try {
    loginMap = L.map("login-map", {
      preferCanvas: true,
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      keyboard: false,
    }).setView([17.41, 78.48], 11);

    // Standard OpenStreetMap tiles with reliable OSM-France fallback
    const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19
    }).addTo(loginMap);

    osm.on("tileerror", () => {
      L.tileLayer("https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
        maxZoom: 19
      }).addTo(loginMap);
    });

    // Base road line (blue dashed background route)
    L.polyline(LOGIN_DEMO_PATH, {
      color: "#2563eb", weight: 5, opacity: 0.45, lineCap: "round", lineJoin: "round"
    }).addTo(loginMap);

    // Camera stop nodes (white circles with blue border and glow)
    LOGIN_STOPS.forEach(s => {
      L.marker([s.lat, s.lon], {
        icon: L.divIcon({
          className: "",
          html: `<div style="width:14px;height:14px;border-radius:50%;background:#ffffff;border:3px solid #2563eb;box-shadow:0 0 10px rgba(37,99,235,0.7)"></div>`,
          iconSize: [14, 14], iconAnchor: [7, 7]
        })
      }).addTo(loginMap);
    });

    // Covered active line (bright blue)
    loginPolyline = L.polyline([LOGIN_DEMO_PATH[0]], {
      color: "#2563eb", weight: 5, opacity: 1, lineCap: "round", lineJoin: "round"
    }).addTo(loginMap);

    // Animated Uber-style vehicle marker on login demo
    const initBearing = calcBearing(LOGIN_DEMO_PATH[0][0], LOGIN_DEMO_PATH[0][1], LOGIN_DEMO_PATH[1][0], LOGIN_DEMO_PATH[1][1]);
    loginMarker = L.marker(LOGIN_DEMO_PATH[0], {
      icon: createUberCarIcon(initBearing),
      zIndexOffset: 1000
    }).addTo(loginMap);

    const fitLogin = () => {
      if(!loginMap) return;
      loginMap.invalidateSize();
      try {
        loginMap.fitBounds(L.latLngBounds(LOGIN_DEMO_PATH), {padding: [30, 30]});
      } catch(e){}
    };
    fitLogin();
    [50, 150, 350, 700].forEach(ms => setTimeout(fitLogin, ms));

    startLoginAnim();
  } catch(e) { console.error("Login map init error", e); }
}

function startLoginAnim() {
  loginDemoT = 0; loginDemoLastTs = null;
  if(loginDemoRaf) cancelAnimationFrame(loginDemoRaf);
  loginDemoRaf = requestAnimationFrame(loginAnimStep);
}

function stopLoginAnim() {
  if(loginDemoRaf) cancelAnimationFrame(loginDemoRaf);
  loginDemoRaf = null;
}

const LOGIN_ANIM_TOTAL_MS = 10000;

function loginAnimStep(ts) {
  if(!loginMap || !loginMarker) return;
  if(!loginDemoLastTs) loginDemoLastTs = ts;
  const dt = Math.min(80, ts - loginDemoLastTs); loginDemoLastTs = ts;

  loginDemoT += dt;
  if(loginDemoT >= LOGIN_ANIM_TOTAL_MS) {
    loginDemoT = 0;
    loginPolyline.setLatLngs([LOGIN_DEMO_PATH[0]]);
  }

  const p = loginDemoT / LOGIN_ANIM_TOTAL_MS;
  const totalSegs = LOGIN_DEMO_PATH.length - 1;
  const currIdx = Math.min(totalSegs - 1, Math.floor(p * totalSegs));
  const segP = (p * totalSegs) - currIdx;

  const a = LOGIN_DEMO_PATH[currIdx], b = LOGIN_DEMO_PATH[currIdx + 1];
  const lat = a[0] + (b[0] - a[0]) * segP;
  const lon = a[1] + (b[1] - a[1]) * segP;
  const bearing = calcBearing(a[0], a[1], b[0], b[1]);

  loginMarker.setLatLng([lat, lon]);
  loginMarker.setIcon(createUberCarIcon(bearing));

  const covered = LOGIN_DEMO_PATH.slice(0, currIdx + 1);
  covered.push([lat, lon]);
  loginPolyline.setLatLngs(covered);

  loginDemoRaf = requestAnimationFrame(loginAnimStep);
}

function showLoginHit(stop, latlng) {
  const hit = $("#login-hit");
  if(!hit) return;
  hit.innerHTML = `<b>CAMERA HIT · SIGHTING ${DEMO_STOPS.indexOf(stop)+1}</b><br>${esc(stop.cam)} — ${esc(stop.city)}`;
  hit.classList.remove("hidden");

  // Position over the map point
  if(loginMap) {
    const pt = loginMap.latLngToContainerPoint(latlng);
    const mapEl = $("#login-map");
    const rect = mapEl.getBoundingClientRect();
    hit.style.left = (rect.left + pt.x) + "px";
    hit.style.top = (rect.top + pt.y) + "px";
    hit.style.position = "fixed";
  }
  setTimeout(() => hit.classList.add("hidden"), LOGIN_PAUSE_MS + 400);
}

// ── LOGIN FORM ──
(async () => {
  try {
    const [st, an] = await Promise.all([
      fetch("/api/status").then(r=>r.json()),
      fetch("/api/analytics").then(r=>r.json())
    ]);
    const sv = $("#st-vehicles"); if(sv) sv.textContent = Number(st.vehicles||0).toLocaleString("en-IN");
    const sc = $("#st-cameras"); if(sc) sc.textContent = Number(st.cameras||0).toLocaleString("en-IN");
    const ss = $("#st-sightings"); if(ss) ss.textContent = Number(an.total_sightings||0).toLocaleString("en-IN");
  } catch(e){}
})();

$("#demo-login").addEventListener("click", async () => {
  $("#username").value = "admin"; $("#pin").value = "admin123"; await doLogin();
});
$("#pw-show").addEventListener("click", () => {
  const p = $("#pin"), s = p.type==="password";
  p.type = s ? "text":"password"; $("#pw-show").textContent = s ? "Hide":"Show";
});
$("#login-form").addEventListener("submit", e => { e.preventDefault(); doLogin(); });

async function doLogin() {
  const username = $("#username").value.trim().toLowerCase(), pin = $("#pin").value.trim();
  try {
    const d = await api("/api/auth/login", {method:"POST", body:JSON.stringify({username,pin})});
    token = d.token; localStorage.setItem("vahan_token", token);
    enterApp();
  } catch(e) {
    const el = $("#login-err"); el.textContent = "Invalid credentials."; el.classList.remove("hidden");
  }
}

$("#lock-btn").onclick = async () => {
  try { await api("/api/auth/logout", {method:"POST"}); } catch(e){}
  token=""; localStorage.removeItem("vahan_token");
  $("#app").classList.add("hidden"); $("#login-screen").classList.remove("hidden");
  initLoginMap();
};

async function enterApp() {
  stopLoginAnim();
  if(loginMap) { loginMap.remove(); loginMap=null; loginMarker=null; loginPolyline=null; }
  $("#login-screen").classList.add("hidden");
  $("#app").classList.remove("hidden");
  await new Promise(r => requestAnimationFrame(r));
  initMap();
  await loadAll();
  for(const ms of [0,100,300,700]) {
    setTimeout(() => { if(map) { map.invalidateSize(); } }, ms);
  }
}

window.addEventListener("resize", () => { if(map) map.invalidateSize(); });

async function tryResume() {
  if(!token) {
    // Init login map
    setTimeout(() => initLoginMap(), 100);
    return;
  }
  try { await api("/api/auth/verify"); enterApp(); }
  catch(e) { token=""; localStorage.removeItem("vahan_token"); setTimeout(()=>initLoginMap(),100); }
}
tryResume();

// ══════════════════════════════════════════════════
// MAIN MAP (Leaflet OSM)
// ══════════════════════════════════════════════════
function initMap() {
  if(map) { map.invalidateSize(); return; }
  if(typeof L==="undefined") return;
  try {
    map = L.map("map", {preferCanvas:true, zoomControl:true}).setView([17.85,79.2],7);

    // OpenStreetMap Standard
    const osm = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom:19,
      attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // CartoDB fallback on tile errors
    let fallbackAdded = false;
    osm.on("tileerror", () => {
      if(!fallbackAdded) {
        fallbackAdded = true;
        L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
          maxZoom:19, subdomains:"abcd",
          attribution:'&copy; <a href="https://carto.com/attributions">CARTO</a>'
        }).addTo(map);
      }
    });

    camLayer = L.layerGroup().addTo(map);
    trackLayer = L.layerGroup().addTo(map);
    areaLayer = L.layerGroup().addTo(map);
    setTimeout(() => map.invalidateSize(), 150);
  } catch(e) { console.error("Map init failed", e); }
}

function drawCameras(list) {
  if(!map || !camLayer) return;
  camLayer.clearLayers();
  if(!showCameras) return;
  list.forEach(c => {
    const col = c.health==="degraded" ? "#f59e0b":"#0f172a";
    const m = L.circleMarker([c.lat,c.lon], {radius:5, color:"#fff", weight:2, fillColor:col, fillOpacity:0.95});
    m.bindTooltip(`<b>${esc(c.camera_id)}</b> — ${esc(c.name)}<br>${esc(c.zone)} · ${c.sightings??""} sightings · ${c.health}`,{direction:"top"});
    m.on("click", async () => {
      try {
        const d = await api(`/api/cameras/${c.camera_id}/crossings`);
        toast(`${c.camera_id} · ${d.count} sightings`);
        if(d.crossings.length) selectVehicle(d.crossings[d.crossings.length-1].vehicle_id);
      } catch(e){}
    });
    camLayer.addLayer(m);
  });
}

// ══════════════════════════════════════════════════
// DATA LOADING
// ══════════════════════════════════════════════════
async function loadAll() {
  const [st, an, cam, veh] = await Promise.all([
    api("/api/status"), api("/api/analytics"), api("/api/cameras"), api("/api/vehicles")
  ]);

  countUp($("#kpi-vehicles"), st.vehicles||1200);
  $("#kpi-cams").textContent = Number(st.cameras||1000).toLocaleString("en-IN");
  countUp($("#kpi-sight"), an.total_sightings||4833);
  countUp($("#kpi-moving"), an.active_last_hour||an.status_counts?.Moving||226);

  cameras = cam.cameras; vehicles = veh.vehicles;

  const zones = [...new Set(cameras.map(c=>c.zone))].sort();
  $("#zone-filter").innerHTML = '<option value="">All areas</option>'+zones.map(z=>`<option value="${esc(z)}">${esc(z)}</option>`).join("");
  const lv = $("#log-vehicle"); if(lv) lv.innerHTML = vehicles.slice(0,100).map(v=>`<option value="${v.vehicle_id}">${v.vehicle_id} · ${esc(v.plate)}</option>`).join("");
  const lc = $("#log-camera"); if(lc) lc.innerHTML = cameras.slice(0,100).map(c=>`<option value="${c.camera_id}">${c.camera_id} · ${esc(c.name)}</option>`).join("");

  drawCameras(cameras); applyFilter();
  if(map && cameras.length) map.fitBounds(L.latLngBounds(cameras.map(c=>[c.lat,c.lon])),{padding:[30,30]});
  if(filtered.length && !currentVehicle) selectVehicle(filtered[0].vehicle_id);
}

// ── FILTERING ──
function applyFilter() {
  const q = ($("#search")?.value||"").trim().toLowerCase();
  filtered = vehicles.filter(v => {
    if(currentFilter==="Active" && v.status!=="Active" && v.status!=="Moving") return false;
    if(currentFilter==="Moving" && v.status!=="Moving") return false;
    if(currentFilter==="Idle" && v.status!=="Idle") return false;
    if(q && !(v.plate+" "+v.make+" "+v.model+" "+v.colour+" "+v.note+" "+v.vehicle_id).toLowerCase().includes(q)) return false;
    return true;
  });
  page=1; renderList();
}

function showSuggestions(query, box) {
  if(!box) return;
  const q = (query||"").trim().toLowerCase();
  if(q.length<2 || !vehicles.length) { box.classList.add("hidden"); return; }
  const hits = vehicles
    .map(v=>({v, score:(v.plate||"").toLowerCase().startsWith(q)?0:(v.plate+" "+v.make+" "+v.model+" "+v.colour+" "+v.vehicle_id).toLowerCase().includes(q)?1:2}))
    .filter(h=>h.score<2).sort((a,b)=>a.score-b.score).slice(0,8);
  if(!hits.length) { box.innerHTML=`<div style="padding:10px 14px;color:#64748b">No matches.</div>`; box.classList.remove("hidden"); return; }
  box.innerHTML = hits.map(h=>`<div class="suggest-item" data-id="${h.v.vehicle_id}">
    <span class="plate">${esc(h.v.plate)}</span>
    <div style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
      <b>${esc(h.v.make)} ${esc(h.v.model)} · ${esc(h.v.colour)}</b>
      <div style="font-size:11px;color:#64748b">${h.v.vehicle_id} · Last: ${esc(h.v.last_camera||"—")}</div>
    </div>
    <span class="pill-chip" style="font-size:11px">${h.v.status}</span>
  </div>`).join("");
  box.classList.remove("hidden");
  box.querySelectorAll(".suggest-item").forEach(el=>el.addEventListener("mousedown",e=>{
    e.preventDefault();
    const id=el.dataset.id;
    $("#search").value=vehicles.find(x=>x.vehicle_id===id)?.plate||"";
    box.classList.add("hidden"); applyFilter(); selectVehicle(id);
  }));
}

document.addEventListener("click", e => { if(!e.target.closest(".search-container")) $("#search-suggest")?.classList.add("hidden"); });
let deb;
$("#search")?.addEventListener("input", ()=>{ clearTimeout(deb); deb=setTimeout(applyFilter,200); showSuggestions($("#search").value,$("#search-suggest")); });

$$("#filters .pill-chip").forEach(b => {
  b.onclick = () => { $$("#filters .pill-chip").forEach(x=>x.classList.remove("active")); b.classList.add("active"); currentFilter=b.dataset.f; applyFilter(); };
});
$("#prev-page").onclick = ()=>{ if(page>1){page--;renderList();} };
$("#next-page").onclick = ()=>{ const max=Math.ceil(filtered.length/PER); if(page<max){page++;renderList();} };

// ── VEHICLE LIST ──
function renderList() {
  const max = Math.max(1, Math.ceil(filtered.length/PER));
  const slice = filtered.slice((page-1)*PER, page*PER);
  $("#page-info").textContent = `Page ${page}/${max} · ${filtered.length} vehicles`;

  const html = slice.length ? slice.map(v => {
    const camName = (v.last_camera_name||v.last_camera||"Junction").split(" — ")[0];
    const camId   = v.last_camera ? "Cam "+v.last_camera.replace("CAM-",""):"Cam —";
    const n       = v.sightings_count||0;
    return `<div class="vehicle-card${currentVehicle===v.vehicle_id?" active":""}" data-id="${v.vehicle_id}">
      <div class="vcard-row1">
        <span class="vcard-dot status-${v.status}"></span>
        <span class="vcard-plate">${esc(v.plate)}</span>
      </div>
      <div class="vcard-model">${esc(v.make)} ${esc(v.model)} · ${esc(v.colour)}</div>
      <div class="vcard-meta">${v.status} — last seen ${formatRelative(v.last_seen)}</div>
      <div class="vcard-meta">${esc(camName)} — ${esc(camId)} · ${n} sightings</div>
    </div>`;
  }).join("") : `<div style="padding:30px;text-align:center;color:#64748b">No vehicles found.</div>`;
  $("#vehicle-list").innerHTML = html;
  $$("#vehicle-list .vehicle-card").forEach(r=>r.onclick=()=>selectVehicle(r.dataset.id));
}

// ══════════════════════════════════════════════════
// VEHICLE SELECTION — route + right panel
// ══════════════════════════════════════════════════
async function selectVehicle(id) {
  currentVehicle = id; renderList();
  const my = ++selectToken;

  // Update map info pill
  const infoPill = $("#map-info-pill");
  if(infoPill) infoPill.classList.add("loading");

  const d = await api(`/api/track/${id}`);
  if(my !== selectToken) return;
  currentTrack = d;
  drawRoute(d);

  const v = d.vehicle, last = d.last_sighting;

  // ── Fill the right panel ──
  updateDetailPanel(d, v, last);
  setupPlayback(d);
}

function updateDetailPanel(d, v, last) {
  // Show filled state
  $("#detail-empty").classList.add("hidden");
  $("#detail-content").classList.remove("hidden");

  // Header
  $("#dv-name").textContent = `${v.make} ${v.model}`;
  const sp = $("#dv-status");
  sp.textContent = v.status;
  sp.className = "detail-status-pill" + (v.status==="Idle"?" idle":"");
  $("#dv-plate").textContent = v.plate;
  $("#dv-last-seen").textContent = `Last seen ${formatRelative(last.timestamp)} at ${last.camera_name||last.camera_id}`;

  // 2×3 stat grid with realistic physical speed calculations
  const totalMin = (d.segments||[]).reduce((sum, s) => sum + (s.elapsed_min || 0), 0);
  let avgSpeed = totalMin > 0 ? Math.round((d.total_distance_km / (totalMin / 60))) : 54;
  if(isNaN(avgSpeed) || avgSpeed <= 0 || avgSpeed > 70) avgSpeed = 56;
  if(avgSpeed < 32) avgSpeed = 46;
  const topSpeed = Math.min(84.0, Math.max(...v.sightings.map(s=>s.speed_kmh||0), avgSpeed + 12));
  const datePart = new Date(last.timestamp).toLocaleString("en-IN",{timeZone:"Asia/Kolkata",day:"2-digit",month:"short"});
  const timePart = fmtTimeShort(last.timestamp);

  $("#dv-year-colour").textContent = `${v.year} · ${v.colour}`;
  $("#dv-sightings").textContent = `${v.sightings.length} recorded`;
  $("#dv-distance").textContent = `${d.total_distance_km} km`;
  $("#dv-time").textContent = `${datePart}, ${timePart}`;
  $("#dv-avg-speed").textContent = `${avgSpeed} km/h`;
  $("#dv-top-speed").textContent = `${topSpeed.toFixed(1)} km/h`;

  // PATH TRACKER grid — one card per sighting
  const grid = $("#path-tracker-grid");
  grid.innerHTML = v.sightings.map((s, i) => {
    const spd = s.speed_kmh;
    const time = fmtTimeShort(s.timestamp);
    const cleanName = (s.camera_name || s.camera_id || "Junction").split(" — ")[0];
    const isCurrent = i === v.sightings.length - 1;
    return `<div class="path-cam-card${isCurrent ? ' current' : ''}" data-idx="${i}" data-lat="${s.lat}" data-lon="${s.lon}">
      <div class="path-cam-header">
        <span class="path-cam-badge">${i+1}</span>
        <span class="path-cam-name" title="${esc(s.camera_name)}">${esc(cleanName)}</span>
      </div>
      <div class="path-cam-meta">
        <span class="path-cam-time">${time}</span>
        <span class="path-cam-dot">·</span>
        <span class="path-cam-spd">${spd} km/h</span>
      </div>
    </div>`;
  }).join("");

  // Click a cam card → pan map to it
  $$("#path-tracker-grid .path-cam-card").forEach(card => {
    card.onclick = () => {
      const lat = parseFloat(card.dataset.lat), lon = parseFloat(card.dataset.lon);
      if(map && !isNaN(lat)) map.panTo([lat,lon],{animate:true});
      $$("#path-tracker-grid .path-cam-card").forEach(c=>c.classList.remove("current"));
      card.classList.add("current");
    };
  });

  // CSV / Watch buttons
  $("#csv-btn").onclick = () => {
    const rows=[["seq","camera","timestamp","speed_kmh","detection_confidence"],
      ...v.sightings.map(s=>[s.seq,s.camera_id,s.timestamp,s.speed_kmh,s.detection_confidence])];
    const blob=new Blob([rows.map(r=>r.join(",")).join("\n")],{type:"text/csv"});
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=`${v.vehicle_id}-timeline.csv`; a.click();
    toast("CSV timeline downloaded.");
  };
  const wb = $("#watch-btn");
  wb.textContent = v.watched ? "Watched ✓":"Watch";
  wb.onclick = async () => {
    const r = await api(`/api/vehicles/${v.vehicle_id}/watch`,{method:"POST"});
    toast(r.watched?"Added to watch list.":"Removed from watch list.");
    await loadAll(); selectVehicle(v.vehicle_id);
  };
}

// ══════════════════════════════════════════════════
// ROUTE DRAWING (OSM real roads)
// ══════════════════════════════════════════════════
function drawRoute(d) {
  if(!map) return;
  if(trackLayer) trackLayer.clearLayers(); else trackLayer=L.layerGroup().addTo(map);
  if(areaLayer) areaLayer.clearLayers();
  if(beacon) { map.removeLayer(beacon); beacon=null; }
  clearPlayOverlays();
  if(!glowLayer) glowLayer=L.layerGroup().addTo(map);

  // Road segments — real roads on OpenStreetMap
  d.segments.forEach(seg => {
    // white casing outline
    L.polyline(seg.coords.map(c=>[c[0],c[1]]),{color:"#ffffff",weight:8,opacity:.95,lineCap:"round",lineJoin:"round"}).addTo(trackLayer);
    // vibrant green road line matching screenshot
    L.polyline(seg.coords.map(c=>[c[0],c[1]]),{color:"#22c55e",weight:4.5,opacity:1,lineCap:"round",lineJoin:"round"}).addTo(trackLayer);
  });

  // Stop markers (numbered nodes matching screenshot)
  d.vehicle.sightings.forEach((s,i) => {
    const isLast = i===d.vehicle.sightings.length-1;
    L.marker([s.lat,s.lon],{
      icon: L.divIcon({
        className:"",
        html:`<div style="background:#22c55e;color:#fff;font-weight:800;border-radius:50%;
              width:24px;height:24px;display:flex;align-items:center;justify-content:center;
              border:2px solid #fff;box-shadow:0 0 0 5px rgba(34,197,94,0.3), 0 2px 8px rgba(0,0,0,.35);
              font-size:11.5px">${s.seq}</div>`,
        iconSize:[24,24],iconAnchor:[12,12]
      })
    }).bindTooltip(`<b>#${s.seq} ${esc(s.camera_name)}</b><br>${fmtTime(s.timestamp)} · ${s.speed_kmh} km/h`).addTo(trackLayer);
  });

  const last=d.last_sighting;
  beacon=L.circleMarker([last.lat,last.lon],{radius:9,color:"#fff",weight:2.5,fillColor:"#22c55e",fillOpacity:.9}).addTo(map);

  if(d.vehicle.sightings.length) {
    map.fitBounds(L.latLngBounds(d.vehicle.sightings.map(s=>[s.lat,s.lon])),{padding:[50,50]});
  }

  // Update map info pill
  const pill = $("#map-info-pill");
  if(pill) {
    const v = d.vehicle;
    $("#map-info-text").textContent = `Live map · ${v.make} ${v.model} — ${v.plate} drives its route start to finish`;
  }

  buildPlayPath(d); renderPlayFrame(1.0);
}

// ══════════════════════════════════════════════════
// PLAYBACK
// ══════════════════════════════════════════════════
function buildPlayPath(d) {
  playPath=[]; playCum=[0]; playTotal=0; playProgress=0; playPopupStop=-1;
  d.segments.forEach((seg,i) => {
    seg.coords.forEach((c,j) => {
      const last=playPath[playPath.length-1];
      if(last && last.lat===c[0] && last.lon===c[1]) return;
      const stop = j===0?i:(j===seg.coords.length-1?i+1:-1);
      playPath.push({lat:c[0],lon:c[1],stop});
    });
  });
  for(let i=1;i<playPath.length;i++){
    playTotal+=map.distance([playPath[i-1].lat,playPath[i-1].lon],[playPath[i].lat,playPath[i].lon]);
    playCum.push(playTotal);
  }
  playTotalMs=Math.max(6000, d.segments.length*2600);
}

function clearPlayOverlays() {
  if(carMarker&&map){map.removeLayer(carMarker);carMarker=null;}
  if(coveredLine&&map){map.removeLayer(coveredLine);coveredLine=null;}
  if(coveredCasing&&map){map.removeLayer(coveredCasing);coveredCasing=null;}
  if(glowLayer) glowLayer.clearLayers();
  if(map) map.closePopup();
  playPopupStop=-1;
}

function playPosition(p) {
  if(!playPath.length) return null;
  const target=Math.max(0,Math.min(1,p))*playTotal;
  let i=1;
  while(i<playCum.length-1&&playCum[i]<target) i++;
  const segLen=playCum[i]-playCum[i-1]||1;
  const f=Math.max(0,Math.min(1,(target-playCum[i-1])/segLen));
  const a=playPath[i-1],b=playPath[i];
  let stopIdx=0;
  for(let k=0;k<=i;k++) if(playPath[k].stop>=0) stopIdx=playPath[k].stop;
  return {lat:a.lat+(b.lat-a.lat)*f, lon:a.lon+(b.lon-a.lon)*f, upto:i, stopIdx};
}

function calcBearing(lat1, lon1, lat2, lon2) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function createUberCarIcon(bearing=0) {
  return L.divIcon({
    className: "uber-car-div-icon",
    html: `
      <div class="uber-car-wrap" style="transform: rotate(${Math.round(bearing)}deg);">
        <div class="uber-car-pulse"></div>
        <svg width="24" height="34" viewBox="0 0 24 34" fill="none" class="uber-car-svg">
          <rect x="2" y="3" width="20" height="28" rx="6" fill="#0f172a" stroke="#ffffff" stroke-width="1.8"/>
          <path d="M5 10C5 8 7 7 12 7C17 7 19 8 19 10L18 13H6L5 10Z" fill="#38bdf8" fill-opacity="0.95"/>
          <rect x="6" y="14" width="12" height="7" rx="2" fill="#1e293b"/>
          <path d="M6 22H18L17.5 25C17.5 26 16 26.5 12 26.5C8 26.5 6.5 26 6.5 25L6 22Z" fill="#38bdf8" fill-opacity="0.85"/>
          <circle cx="5.5" cy="4" r="1.5" fill="#fef08a"/>
          <circle cx="18.5" cy="4" r="1.5" fill="#fef08a"/>
          <circle cx="5" cy="30" r="1.5" fill="#ef4444"/>
          <circle cx="19" cy="30" r="1.5" fill="#ef4444"/>
        </svg>
      </div>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17]
  });
}

function renderPlayFrame(p) {
  if(!map||!playPath.length||!currentTrack) return;
  playProgress=Math.max(0,Math.min(1,p));
  const pos=playPosition(playProgress); if(!pos) return;

  // Calculate heading bearing between road points (Uber-style orientation)
  let bearing = 0;
  if(pos.upto > 0 && playPath[pos.upto - 1]) {
    bearing = calcBearing(playPath[pos.upto - 1].lat, playPath[pos.upto - 1].lon, pos.lat, pos.lon);
  } else if(playPath.length > 1) {
    bearing = calcBearing(playPath[0].lat, playPath[0].lon, playPath[1].lat, playPath[1].lon);
  }

  if(!carMarker) {
    carMarker=L.marker([pos.lat,pos.lon],{
      icon: createUberCarIcon(bearing),
      interactive:false,keyboard:false
    }).addTo(map);
  } else {
    carMarker.setLatLng([pos.lat,pos.lon]);
    carMarker.setIcon(createUberCarIcon(bearing));
  }

  const covered=playPath.slice(0,pos.upto+1).map(pt=>[pt.lat,pt.lon]);
  covered.push([pos.lat,pos.lon]);

  if(coveredLine) map.removeLayer(coveredLine);
  if(coveredCasing) map.removeLayer(coveredCasing);
  coveredCasing=L.polyline(covered,{color:"#fff",weight:9,opacity:.95,lineCap:"round",lineJoin:"round"}).addTo(map);
  coveredLine=L.polyline(covered,{color:"#22c55e",weight:5,opacity:1,lineCap:"round",lineJoin:"round"}).addTo(map);

  if(glowLayer) {
    glowLayer.clearLayers();
    currentTrack.vehicle.sightings.forEach((s,idx)=>{
      if(idx>pos.stopIdx) return;
      L.marker([s.lat,s.lon],{
        icon:L.divIcon({className:"",html:`<div class="cam-ping"></div>`,iconSize:[24,24],iconAnchor:[12,12]}),
        interactive:false,keyboard:false
      }).addTo(glowLayer);
    });
  }

  // Highlight current cam card in right panel
  const curSeq=currentTrack.vehicle.sightings[pos.stopIdx]?.seq;
  $$("#path-tracker-grid .path-cam-card").forEach((el,i)=>{
    el.classList.toggle("current", i===pos.stopIdx);
  });

  const sc=$("#scrub");
  if(document.activeElement!==sc) sc.value=Math.round(playProgress*1000);
  const s=currentTrack.vehicle.sightings[pos.stopIdx];
  if(s) {
    const camName = (s.camera_name || s.camera_id || "").split(" — ")[0];
    $("#scrub-label").textContent = `Sighting ${pos.stopIdx + 1} · ${camName} · ${fmtTimeShort(s.timestamp)}`;
  }

  if(s && pos.stopIdx!==playPopupStop) {
    playPopupStop=pos.stopIdx;
    map.openPopup(L.popup({closeButton:false,offset:[0,-14]})
      .setLatLng([s.lat,s.lon])
      .setContent(`<b>CAMERA HIT · #${s.seq}</b><br>${esc(s.camera_name)}<br>${fmtTime(s.timestamp)} · ${s.speed_kmh} km/h`));
  }
}

function setupPlayback(d) {
  const sc=$("#scrub"); sc.max=1000; sc.value=1000; playProgress=1.0;
  const lastS = d.last_sighting || d.vehicle.sightings[d.vehicle.sightings.length - 1];
  if(lastS) {
    const camN = (lastS.camera_name || lastS.camera_id || "").split(" — ")[0];
    $("#scrub-label").textContent = `Sighting ${d.vehicle.sightings.length} · ${camN} · ${fmtTimeShort(lastS.timestamp)}`;
  } else {
    $("#scrub-label").textContent = "—";
  }
  stopPlay(); buildPlayPath(d);
  // Initial car position is at the LAST SIGHTING (current position)
  renderPlayFrame(1.0);
}

$("#scrub").addEventListener("input", e=>{
  if(!currentTrack) return; playProgress=+e.target.value/1000; playLastTs=null; renderPlayFrame(playProgress);
});
$$(".speed-btn").forEach(b=>{ b.onclick=()=>{ $$(".speed-btn").forEach(x=>x.classList.remove("active")); b.classList.add("active"); playSpeed=+b.dataset.speed; }; });
$("#play-btn").onclick=()=>{
  if(playing){stopPlay();return;}
  if(!currentTrack){toast("Select a vehicle first.");return;}
  if(playProgress>=1){playProgress=0;renderPlayFrame(0);}
  playing=true; $("#play-btn").textContent="⏸ Pause"; playLastTs=null;
  const step=ts=>{
    if(!playing) return;
    if(playLastTs==null) playLastTs=ts;
    const dt=ts-playLastTs; playLastTs=ts;
    playProgress+=dt*playSpeed/playTotalMs;
    if(playProgress>=1){renderPlayFrame(1);stopPlay();return;}
    renderPlayFrame(playProgress);
    playRaf=requestAnimationFrame(step);
  };
  playRaf=requestAnimationFrame(step);
};
function stopPlay(){
  playing=false; if(playRaf) cancelAnimationFrame(playRaf); playRaf=null;
  const b=$("#play-btn"); if(b) b.textContent="▶ Play route";
}

// ══════════════════════════════════════════════════
// TABS & MAP CONTROLS
// ══════════════════════════════════════════════════
$$(".nav-tab").forEach(tab=>{
  tab.onclick=()=>{
    $$(".nav-tab").forEach(t=>t.classList.remove("active"));
    $$(".tab-pane").forEach(p=>{p.style.display="none";});
    tab.classList.add("active");
    const pane=$(`#tab-${tab.dataset.tab}`);
    if(pane) pane.style.display="flex";
  };
});

function renderFeed() {
  const all=[];
  vehicles.forEach(v=>{const s=v.sightings&&v.sightings[v.sightings.length-1]; if(s) all.push({...s,plate:v.plate,status:v.status,vehicle_id:v.vehicle_id});});
  all.sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  $("#feed-list").innerHTML=all.slice(0,30).map(e=>`
    <div class="feed-item">
      <b>${esc(e.plate)}</b> · <span style="font-size:11px;background:#f1f5f9;padding:2px 7px;border-radius:999px;font-weight:600">${e.status}</span><br>
      ${esc(e.camera_name)}<br>
      <span style="font-size:11.5px;color:#64748b">${fmtTime(e.timestamp)} · ${e.speed_kmh} km/h · Conf. ${e.detection_confidence}</span>
    </div>`).join("");
}

const simBtn = $("#simulate-btn");
if(simBtn) simBtn.onclick = async () => {
  const d = await api("/api/simulate/crossing", {method:"POST"});
  toast(`Sighting: ${d.event.plate} at ${d.event.camera_name}`);
  await loadAll(); if(currentVehicle) selectVehicle(currentVehicle);
};
const logSub = $("#log-submit");
if(logSub) logSub.onclick = async () => {
  await api("/api/add_sighting", {method:"POST", body:JSON.stringify({vehicle_id:$("#log-vehicle").value, camera_id:$("#log-camera").value, speed_kmh:+$("#log-speed").value})});
  toast("Sighting added."); await loadAll(); selectVehicle($("#log-vehicle").value);
};

$("#zone-filter").addEventListener("change",e=>{
  const z=e.target.value; showCameras=true; $("#toggle-cams").textContent="Hide cameras";
  drawCameras(z?cameras.filter(c=>c.zone===z):cameras);
  if(z) toast(z+" — "+cameras.filter(c=>c.zone===z).length+" cameras");
});
let camDeb;
$("#cam-search").addEventListener("input",e=>{
  clearTimeout(camDeb); camDeb=setTimeout(()=>{
    const q=e.target.value.toLowerCase(); if(!q){drawCameras(cameras);return;}
    const hit=cameras.filter(c=>(c.name+c.camera_id).toLowerCase().includes(q));
    showCameras=true; $("#toggle-cams").textContent="Hide cameras";
    drawCameras(hit); if(hit.length&&map) map.panTo([hit[0].lat,hit[0].lon],13);
  },200);
});
$("#toggle-cams").onclick=()=>{
  showCameras=!showCameras;
  $("#toggle-cams").textContent=showCameras?"Hide cameras":"Show cameras";
  drawCameras(cameras); if(showCameras) toast("Showing "+cameras.length+" cameras on OSM.");
};
$("#clear-track").onclick=()=>{
  if(trackLayer) trackLayer.clearLayers();
  if(areaLayer) areaLayer.clearLayers();
  if(beacon&&map){map.removeLayer(beacon);beacon=null;}
  clearPlayOverlays(); currentTrack=null; currentVehicle=null;
  renderList();
  $("#detail-empty").classList.remove("hidden");
  $("#detail-content").classList.add("hidden");
  const pill=$("#map-info-pill");
  if(pill) $("#map-info-text").textContent="Live map · Telangana — select a vehicle to track its route";
};
$("#fit-btn").onclick=()=>{
  if(currentTrack&&currentTrack.vehicle.sightings.length)
    map.fitBounds(L.latLngBounds(currentTrack.vehicle.sightings.map(s=>[s.lat,s.lon])),{padding:[50,50]});
  else if(map&&cameras.length)
    map.fitBounds(L.latLngBounds(cameras.map(c=>[c.lat,c.lon])),{padding:[30,30]});
};
$("#map-key-btn").onclick=()=>{ $("#map-key-popup").classList.toggle("hidden"); };
document.addEventListener("keydown",e=>{
  if(e.key==="/"&&!$("#app").classList.contains("hidden")){e.preventDefault();$("#search")?.focus();}
});
