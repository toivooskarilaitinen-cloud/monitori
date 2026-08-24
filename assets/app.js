const metricOrder = ["activity","volatility","attention","tension","curiosity","strangeness"];

function metricLabel(key){
  return {
    activity:"AKTIIVISUUS",
    volatility:"VAIHTELU",
    attention:"HUOMIO",
    tension:"JÄNNITE",
    curiosity:"UTELIAISUUS",
    strangeness:"OUTOUS"
  }[key] || key.toUpperCase();
}

function fmt(v){
  return (v === null || v === undefined || Number.isNaN(v)) ? "—" : Math.round(v);
}
function arrow(v){
  if(v === null || v === undefined) return "·";
  if(v > 2) return "↑";
  if(v < -2) return "↓";
  return "→";
}
function sensorLabel(key){
  return {
    google_trends:"GOOGLE TRENDS",
    wikipedia:"WIKIPEDIA",
    news:"UUTISET / GDELT",
    internet_traffic:"INTERNET-LIIKENNE",
    conversation:"KESKUSTELU"
  }[key] || key.toUpperCase();
}
function sensorRole(key){
  return {
    google_trends:"HUOMIO",
    wikipedia:"TIETO",
    news:"TAPAHTUMAT",
    internet_traffic:"AKTIIVISUUS",
    conversation:"KESKUSTELU"
  }[key] || "";
}
function render(data){
  document.getElementById("date").textContent = (data.date || "—").toUpperCase();
  document.getElementById("time").textContent = data.generated_at ? new Date(data.generated_at).toLocaleTimeString("fi-FI",{hour:"2-digit",minute:"2-digit",timeZone:"Europe/Helsinki"}) + " EEST" : "—";

  const metrics = document.getElementById("metrics");
  metrics.innerHTML = "";
  metricOrder.forEach(k=>{
    const m = data.metrics?.[k] || {};
    const row = document.createElement("div");
    row.className = "metric";
    row.innerHTML = `<span class="metric-name">${metricLabel(k)}</span><span class="metric-value">${fmt(m.value)}</span><span class="metric-arrow">${arrow(m.change)}</span>`;
    metrics.appendChild(row);
  });

  const conditionLabels = {"COLLECTING BASELINE":"KERÄTÄÄN VERTAILUTASOA",ACTIVE:"AKTIIVINEN",QUIET:"HILJAINEN",NORMAL:"NORMAALI",FOCUSED:"KESKITTYNYT",VOLATILE:"VAIHTELEVA",UNUSUAL:"POIKKEAVA","NOT UNUSUAL":"TAVANOMAINEN"};
  const conditions = (data.conditions?.length ? data.conditions : ["COLLECTING BASELINE"]).map(x=>conditionLabels[x] || x);
  document.getElementById("conditions").innerHTML = conditions.map(x=>`<span class="condition">${x}</span>`).join("");

  document.getElementById("change24").textContent = data.summary?.change_24h == null ? "—" : `${data.summary.change_24h > 0 ? "+" : ""}${data.summary.change_24h.toFixed(1)}`;
  document.getElementById("avg7").textContent = data.summary?.avg_7d == null ? "—" : data.summary.avg_7d.toFixed(1);
  document.getElementById("avg30").textContent = data.summary?.avg_30d == null ? "—" : data.summary.avg_30d.toFixed(1);

  const sensorList = document.getElementById("sensorList");
  sensorList.innerHTML = "";
  Object.entries(data.sensors || {}).forEach(([key,s])=>{
    const row = document.createElement("div");
    row.className = "sensor";
    const value = s.status === "ok" ? (s.display_value ?? s.value ?? "OK") : "UNAVAILABLE";
    row.innerHTML = `<div><div class="sensor-name">${sensorLabel(key)}</div><div class="sensor-detail">${sensorRole(key)}</div></div><div class="sensor-detail">${s.detail || s.provider || ""}</div><div class="sensor-value ${s.status === "ok" ? "" : "sensor-unavailable"}">${value}</div>`;
    sensorList.appendChild(row);
  });

  document.getElementById("methodVersion").textContent = `MENETELMÄ ${data.method_version || "—"} / ${data.baseline?.observations || 0} HAVAINTOA`;
}

async function load(path="data/latest.json"){
  const note = document.getElementById("archiveNote");
  try{
    const r = await fetch(`${path}?v=${Date.now()}`);
    if(!r.ok) throw new Error(`${r.status}`);
    const data = await r.json();
    render(data);
    note.textContent = "";
  }catch(e){
    note.textContent = "Havaintoa ei löytynyt tälle päivälle.";
  }
}

document.getElementById("archiveForm").addEventListener("submit",e=>{
  e.preventDefault();
  const d = document.getElementById("archiveDate").value;
  if(d) load(`data/history/${d}.json`);
});
document.getElementById("todayButton").addEventListener("click",()=>load());

load();
