const state={apiBase:localStorage.getItem("outilsLestoBreizhStopsApi")||"",lines:[],courses:[],selectedCourse:null,run:null,gpsWatch:null,gpsEnabled:false,position:null,boardings:0,alightings:0,onboard:0,events:[]};
const $=id=>document.getElementById(id);
const todayIso=()=>{const d=new Date();return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")};
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const api=async(path,options={})=>{const base=state.apiBase.replace(/\/$/,"");if(!base)throw new Error("Adresse BreizhStops non configurée.");const r=await fetch(base+path,{...options,headers:{"Content-Type":"application/json",...(options.headers||{})}});const type=r.headers.get("content-type")||"";const data=type.includes("json")?await r.json():await r.text();if(!r.ok)throw new Error((data&&data.error)||data||"Erreur API");return data};
const minutes=t=>{if(!t)return null;const p=String(t).split(":").map(Number);return p[0]*60+(p[1]||0)};
const delayText=sec=>{if(sec==null)return"—";const s=Math.round(sec),sign=s>0?"+":s<0?"−":"";const a=Math.abs(s),m=Math.floor(a/60);return sign+m+"m"+String(a%60).padStart(2,"0")};
const distanceKm=(a,b)=>{const R=6371,p=Math.PI/180,dLat=(b.lat-a.lat)*p,dLon=(b.lon-a.lon)*p,x=Math.sin(dLat/2)**2+Math.cos(a.lat*p)*Math.cos(b.lat*p)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x))};
function setStatus(id,msg){$(id).textContent=msg||""}
function normalizeLine(name){return String(name||"").replace(/\s+/g," ").trim().replace(/\.(\d+)$/,"")}
function updateToday(){$("todayLabel").textContent=new Intl.DateTimeFormat("fr-FR",{weekday:"long",day:"numeric",month:"long",year:"numeric"}).format(new Date())}
async function loadCourses(){
  setStatus("setupStatus","Chargement des courses du jour…");$("lineSelect").disabled=true;$("departureSelect").disabled=true;
  try{
    const courses=await api("/api/public/sae/today?date="+encodeURIComponent(todayIso()));state.courses=Array.isArray(courses)?courses:[];
    const map=new Map();state.courses.forEach(c=>{const line=normalizeLine(c.name||c.course_name||"");if(!line)return;if(!map.has(line))map.set(line,[]);map.get(line).push(c)});
    state.lines=[...map.entries()].map(([name,courses])=>({name,courses})).sort((a,b)=>a.name.localeCompare(b.name,"fr",{numeric:true}));
    $("lineSelect").innerHTML='<option value="">Choisir une ligne</option>'+state.lines.map((l,i)=>'<option value="'+i+'">'+esc(l.name)+"</option>").join("");
    $("lineSelect").disabled=state.lines.length===0;$("departureSelect").innerHTML='<option value="">Choisir un horaire</option>';$("departureSelect").disabled=true;$("startBtn").disabled=true;
    setStatus("setupStatus",state.lines.length?state.lines.length+" ligne(s) disponible(s).":"Aucune course trouvée pour aujourd’hui.");
  }catch(e){setStatus("setupStatus",e.message+" Utilise ⚙️ pour vérifier l’adresse de BreizhStops.");}
}
function chooseLine(){
  const line=state.lines[Number($("lineSelect").value)];
  if(!line){$("departureSelect").innerHTML='<option>Choisis d’abord une ligne</option>';$("departureSelect").disabled=true;$("startBtn").disabled=true;return}
  const sorted=[...line.courses].sort((a,b)=>String(a.start_time||"").localeCompare(String(b.start_time||"")));
  $("departureSelect").innerHTML='<option value="">Choisir un horaire</option>'+sorted.map((c,i)=>'<option value="'+i+'">'+esc(c.start_time||"Horaire inconnu")+(c.end_time?" → "+esc(c.end_time):"")+"</option>").join("");$("departureSelect").disabled=false;
}
function chooseCourse(){
  const line=state.lines[Number($("lineSelect").value)];if(!line)return;const sorted=[...line.courses].sort((a,b)=>String(a.start_time||"").localeCompare(String(b.start_time||"")));state.selectedCourse=sorted[Number($("departureSelect").value)]||null;$("startBtn").disabled=!state.selectedCourse;$("coursePreview").classList.toggle("hidden",!state.selectedCourse);
  if(state.selectedCourse)$("coursePreview").innerHTML="<strong>"+esc(state.selectedCourse.name)+"</strong><br>"+esc(state.selectedCourse.start_time||"—")+(state.selectedCourse.end_time?" → "+esc(state.selectedCourse.end_time):"")+" · "+(state.selectedCourse.stop_count||state.selectedCourse.stops?.length||0)+" arrêt(s)";
}
async function startRun(){
  const c=state.selectedCourse;if(!c)return;
  try{
    const course=await api("/api/public/sae/courses/"+encodeURIComponent(c.id));const stops=course.stops||[];if(!stops.length)throw new Error("Cette course ne contient aucun arrêt.");
    state.run={course:course,startedAt:new Date().toISOString(),index:0};state.events=[];state.boardings=0;state.alightings=0;state.onboard=0;
    $("setupCard").classList.add("hidden");$("reportScreen").classList.add("hidden");$("runScreen").classList.remove("hidden");$("runTitle").textContent=course.name||c.name;$("runMeta").textContent=(course.start_time||c.start_time||"—")+" · "+(course.service||"")+(course.girouette?" · Girouette "+course.girouette:"");renderRun();
  }catch(e){alert(e.message)}
}
function current(){return state.run?.course?.stops?.[state.run.index]||null}
function next(){return state.run?.course?.stops?.[state.run.index+1]||null}
function renderRun(){
  const c=current(),n=next(),total=state.run?.course?.stops?.length||0;$("currentStopName").textContent=c?.name||"Terminus";$("currentScheduled").textContent=c?.scheduled_time||"—";$("currentActual").textContent="—";$("currentDelay").textContent="—";$("nextStopName").textContent=n?.name||"Terminus";$("nextScheduled").textContent=n?.scheduled_time||"—";$("boardings").textContent=state.boardings;$("alightings").textContent=state.alightings;$("onboard").textContent=Math.max(0,state.onboard+state.boardings-state.alightings);$("progressCount").textContent=Math.min(state.run.index+1,total)+" / "+total;
  $("progressList").innerHTML=(state.run.course.stops||[]).map((s,i)=>'<div class="progress-item '+(i<state.run.index?"done ":i===state.run.index?"current ":"")+'"><span><b>'+(i+1)+".</b> "+esc(s.name)+"</span><span>"+esc(s.scheduled_time||"—")+"</span></div>").join("");updateDistance();
}
function updateDistance(){const c=current();if(!c||!state.position){$("currentDistance").textContent=state.gpsEnabled?"Recherche GPS…":"GPS désactivé";return}const d=distanceKm(state.position,{lat:Number(c.lat),lon:Number(c.lon)})*1000;$("currentDistance").textContent=d>=1000?(d/1000).toFixed(1)+" km":Math.round(d)+" m"}
function validateStop(){
  const c=current();if(!c)return;const actual=new Date(),scheduled=minutes(c.scheduled_time),nowMin=actual.getHours()*60+actual.getMinutes()+actual.getSeconds()/60,sec=scheduled==null?null:Math.round((nowMin-scheduled)*60);
  state.events.push({stop:c,actualTime:actual.toISOString(),delaySeconds:sec,boardings:state.boardings,alightings:state.alightings,onboardBefore:state.onboard,onboardAfter:Math.max(0,state.onboard+state.boardings-state.alightings)});
  state.onboard=Math.max(0,state.onboard+state.boardings-state.alightings);state.boardings=0;state.alightings=0;state.run.index++;if(state.run.index>=state.run.course.stops.length){finishRun();return}renderRun();
}
function finishRun(){stopGps();$("runScreen").classList.add("hidden");$("reportScreen").classList.remove("hidden");renderReport()}
function renderReport(){
  const c=state.run.course;$("reportSummary").innerHTML='<div><small>Course</small><strong>'+esc(c.name)+'</strong></div><div><small>Horaire</small><strong>'+esc(c.start_time||"—")+'</strong></div><div><small>Passages</small><strong>'+state.events.length+" / "+c.stops.length+'</strong></div><div><small>Voyageurs finaux</small><strong>'+state.onboard+"</strong></div>";
  $("reportTable").innerHTML='<table><thead><tr><th>#</th><th>Arrêt</th><th>Théo.</th><th>Réel</th><th>Écart</th><th>↑</th><th>↓</th><th>👥</th></tr></thead><tbody>'+state.events.map((e,i)=>'<tr><td>'+(i+1)+"</td><td>"+esc(e.stop.name)+"</td><td>"+esc(e.stop.scheduled_time||"—")+"</td><td>"+new Intl.DateTimeFormat("fr-FR",{hour:"2-digit",minute:"2-digit",second:"2-digit"}).format(new Date(e.actualTime))+"</td><td>"+delayText(e.delaySeconds)+"</td><td>"+e.boardings+"</td><td>"+e.alightings+"</td><td>"+e.onboardAfter+"</td></tr>").join("")+"</tbody></table>";state.reportText=buildReportText();
}
function buildReportText(){const c=state.run.course;let s="RAPPORT COURSE — Outils Lesto\n"+(c.name||"")+" · "+(c.start_time||"")+"\nDébut: "+new Date(state.run.startedAt).toLocaleString("fr-FR")+"\nArrêts enregistrés: "+state.events.length+"/"+c.stops.length+"\nVoyageurs à bord en fin de course: "+state.onboard+"\n\n";state.events.forEach((e,i)=>{s+=(i+1)+". "+e.stop.name+" | théorique "+(e.stop.scheduled_time||"—")+" | réel "+new Date(e.actualTime).toLocaleTimeString("fr-FR")+" | écart "+delayText(e.delaySeconds)+" | ↑ "+e.boardings+" | ↓ "+e.alightings+" | à bord "+e.onboardAfter+"\n"});return s}
async function shareReport(){const text=state.reportText||"";try{if(navigator.share)await navigator.share({title:"Rapport "+state.run.course.name,text:text});else{await navigator.clipboard.writeText(text);setStatus("reportStatus","Rapport copié dans le presse-papiers.")}}catch(e){if(e.name!=="AbortError")setStatus("reportStatus",e.message)}}
function startGps(){if(!navigator.geolocation){alert("La géolocalisation n’est pas disponible.");return}state.gpsEnabled=true;$("gpsToggleBtn").textContent="📍 GPS actif";$("gpsToggleBtn").classList.add("primary");state.gpsWatch=navigator.geolocation.watchPosition(p=>{state.position={lat:p.coords.latitude,lon:p.coords.longitude};updateDistance()},()=>{setStatus("reportStatus","GPS indisponible, la validation manuelle reste disponible.")},{enableHighAccuracy:true,maximumAge:1500,timeout:15000});updateDistance()}
function stopGps(){if(state.gpsWatch!=null)navigator.geolocation.clearWatch(state.gpsWatch);state.gpsWatch=null;state.gpsEnabled=false;$("gpsToggleBtn").textContent="📍 Activer le GPS";$("gpsToggleBtn").classList.remove("primary")}
function openSettings(){$("apiBaseInput").value=state.apiBase;$("settingsDialog").showModal()}
async function testConnection(){try{const r=await api("/api/public/sae/today?date="+todayIso());setStatus("settingsStatus","✅ Connexion OK — "+(Array.isArray(r)?r.length:0)+" course(s) aujourd’hui.")}catch(e){setStatus("settingsStatus","❌ "+e.message)}}
$("lineSelect").addEventListener("change",chooseLine);$("departureSelect").addEventListener("change",chooseCourse);$("startBtn").addEventListener("click",startRun);$("refreshBtn").addEventListener("click",loadCourses);$("settingsBtn").addEventListener("click",openSettings);$("testConnectionBtn").addEventListener("click",testConnection);
$("saveSettingsBtn").addEventListener("click",()=>{state.apiBase=$("apiBaseInput").value.trim().replace(/\/$/,"");localStorage.setItem("outilsLestoBreizhStopsApi",state.apiBase);setStatus("settingsStatus","Adresse enregistrée.");loadCourses()});
$("validateBtn").addEventListener("click",validateStop);$("gpsToggleBtn").addEventListener("click",()=>state.gpsEnabled?stopGps():startGps());$("stopRunBtn").addEventListener("click",()=>{if(confirm("Terminer la course sans valider les arrêts restants ?"))finishRun()});
document.querySelectorAll("[data-count]").forEach(b=>b.addEventListener("click",()=>{const k=b.dataset.count,d=Number(b.dataset.delta);if(k==="boardings")state.boardings=Math.max(0,state.boardings+d);else state.alightings=Math.max(0,state.alightings+d);renderRun()}));
$("shareReportBtn").addEventListener("click",shareReport);$("newRunBtn").addEventListener("click",()=>{$("reportScreen").classList.add("hidden");$("setupCard").classList.remove("hidden");state.selectedCourse=null;$("lineSelect").value="";$("departureSelect").innerHTML='<option value="">Choisir un horaire</option>';$("departureSelect").disabled=true;$("startBtn").disabled=true});
updateToday();loadCourses();