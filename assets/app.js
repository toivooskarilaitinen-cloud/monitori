const metricOrder = ["activity","volatility","attention","tension","curiosity","strangeness"];

const KUOPIO_WEATHER_URL = "https://api.open-meteo.com/v1/forecast?latitude=62.8924&longitude=27.6770&current=temperature_2m,weather_code,is_day&timezone=Europe%2FHelsinki";

function updateClock(){
  const now = new Date();
  document.getElementById("date").textContent = now.toLocaleDateString("fi-FI",{
    timeZone:"Europe/Helsinki", day:"2-digit", month:"2-digit", year:"numeric"
  });
  document.getElementById("time").textContent = now.toLocaleTimeString("fi-FI",{
    timeZone:"Europe/Helsinki", hour:"2-digit", minute:"2-digit", second:"2-digit"
  });
}

function weatherLabel(code,isDay){
  if(code === 0) return isDay ? "aurinkoinen" : "selkeä";
  if(code === 1) return "enimmäkseen selkeä";
  if(code === 2) return "puolipilvinen";
  if(code === 3) return "pilvinen";
  if(code === 45 || code === 48) return "sumuinen";
  if(code >= 51 && code <= 57) return "tihkusateinen";
  if(code >= 61 && code <= 67) return "sateinen";
  if(code >= 71 && code <= 77) return "lumisateinen";
  if(code >= 80 && code <= 82) return "sadekuuroja";
  if(code === 85 || code === 86) return "lumikuuroja";
  if(code >= 95) return "ukkonen";
  return "säätila tuntematon";
}

async function updateWeather(){
  const target = document.getElementById("weather");
  try{
    const response = await fetch(KUOPIO_WEATHER_URL);
    if(!response.ok) throw new Error(String(response.status));
    const data = await response.json();
    const current = data.current;
    const temperature = Math.round(current.temperature_2m);
    target.textContent = `KUOPIO ${temperature} °C · ${weatherLabel(current.weather_code,current.is_day === 1).toUpperCase()}`;
  }catch(error){
    target.textContent = "KUOPIO — · SÄÄ EI SAATAVILLA";
  }
}

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
    const value = s.status === "ok" ? (s.display_value ?? s.value ?? "OK") : "EI SAATAVILLA";
    const detail = s.detail === "waiting for first run" ? "odottaa ensimmäistä keruuta" : (s.detail || s.provider || "");
    row.innerHTML = `<div><div class="sensor-name">${sensorLabel(key)}</div><div class="sensor-detail">${sensorRole(key)}</div></div><div class="sensor-detail">${detail}</div><div class="sensor-value ${s.status === "ok" ? "" : "sensor-unavailable"}">${value}</div>`;
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

updateClock();
updateWeather();
setInterval(updateClock,1000);
setInterval(updateWeather,15*60*1000);
load();
