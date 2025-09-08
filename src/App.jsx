// App.jsx — Pánico México 🚨🇲🇽

import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "./firebase";
import { ref, onValue } from "firebase/database";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

/* ===== helpers ===== */
const fmtMeters = (m) =>
  m == null ? "—" : `${(m >= 100 ? Math.round(m) : Number(m).toFixed(1))} m`;
const timeAgo = (ts) => {
  if (!ts) return "—";
  const d = (Date.now() - ts) / 1000;
  if (d < 60) return `${Math.floor(d)} s`;
  if (d < 3600) return `${Math.floor(d / 60)} min`;
  if (d < 86400) return `${Math.floor(d / 3600)} h`;
  return new Date(ts).toLocaleString();
};
const accColor = (m) => {
  if (m == null) return "#8b949e";
  if (m < 10) return "#2ea043";
  if (m < 30) return "#d29922";
  return "#f85149";
};

/* ===== inject styles once ===== */
const injectOnce = (() => {
  let done = false;
  return () => {
    if (done) return;
    const s = document.createElement("style");
    s.innerHTML = `
      html, body, #root { height:100%; margin:0 }
      .leaflet-container { background:#05080f }
      .pmx-header {
        display:grid; grid-template-columns: 1fr auto; align-items:center; gap:10px;
        padding:10px 14px; border-bottom:1px solid #21262d;
        backdrop-filter:blur(10px);
        background:linear-gradient(90deg,rgba(255,39,72,.15),rgba(88,166,255,.15));
        color:#f0f6fc;
      }
      .pmx-brand { display:flex; align-items:center; gap:10px; min-width:0 }
      .pmx-status { font-size:12px; color:#8b949e; }
      .pmx-chips { display:flex; gap:8px; flex-wrap:wrap; justify-self:end; }
      .pmx-chip {
        padding:6px 12px; border-radius:999px; font-size:12px;
        color:#8b949e; border:1px solid #30363d; background:rgba(13,17,23,.65);
        backdrop-filter: blur(6px); white-space:nowrap;
      }
      .pmx-strong { color:#f0f6fc }
      .pmx-fabs { position:absolute; right:10px; bottom:60px; display:grid; gap:8px; z-index:401; }
      .pmx-fab {
        padding:10px; border-radius:14px; border:1px solid #30363d;
        background:rgba(13,17,23,.7); color:#f0f6fc;
        cursor:pointer; backdrop-filter:blur(8px);
      }
      .pmx-pin { position:relative; width:32px; height:32px; display:grid; place-items:center; }
      .pmx-pin .emoji { font-size:22px; }
      .pmx-pulse {
        position:absolute; width:20px; height:20px; border-radius:999px;
        background:rgba(255,39,72,.5);
        animation:pmx-pulse 2s infinite;
      }
      @keyframes pmx-pulse {0%{transform:scale(.6);opacity:.9}100%{transform:scale(2.4);opacity:0}}
      .pmx-bottom {
        display:flex; justify-content:center; padding:12px;
        border-top:1px solid #21262d; background:rgba(8,12,20,.8);
      }
      .pmx-share {
        padding:10px 16px; border-radius:12px; border:1px solid #30363d;
        background:#161b22; color:#f0f6fc; cursor:pointer;
      }
      .pmx-toast {
        position:fixed; left:50%; bottom:80px; transform:translateX(-50%);
        background:#161b22; color:#fff; padding:8px 12px; border-radius:8px;
        opacity:0; transition:.2s;
      }
      .pmx-toast.show { opacity:1; transform:translateX(-50%) translateY(-6px); }
      @media (max-width: 640px) { .pmx-chips { overflow:auto; scrollbar-width:none } .pmx-chips::-webkit-scrollbar{display:none} }
    `;
    document.head.appendChild(s);
    done = true;
  };
})();

/* ===== component ===== */
export default function App() {
  injectOnce();
  const shareId = new URLSearchParams(location.search).get("id") || "";

  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const circleRef = useRef(null);
  const trailRef = useRef(null);

  const [connected, setConnected] = useState(false);
  const [meta, setMeta] = useState({ ts:null, acc:null });

  const pinIcon = useMemo(() =>
    L.divIcon({
      className:"pmx-pin",
      html:`<div class="pmx-pulse"></div><div class="emoji">🚨</div>`,
      iconSize:[32,32], iconAnchor:[16,28]
    }), []);

  useEffect(() => {
    const map = L.map("map",{ zoomControl:false }).setView([19.43,-99.13],13);
    mapRef.current = map;
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19}).addTo(map);
    L.control.zoom({position:"topleft"}).addTo(map);

    const marker = L.marker([19.43,-99.13],{icon:pinIcon}).addTo(map);
    const circle = L.circle([19.43,-99.13],{radius:0,color:"#58a6ff"}).addTo(map);
    const trail = L.polyline([], {color:"#58a6ff", weight:3, opacity:.6}).addTo(map);

    markerRef.current = marker; circleRef.current = circle; trailRef.current = trail;

    let unsub=null;
    if(shareId){
      const locRef = ref(db,`shares/${shareId}/location`);
      unsub = onValue(locRef,(snap)=>{
        setConnected(true);
        const v=snap.val(); if(!v || v.lat==null || v.lng==null) return;
        const ll=[v.lat,v.lng];
        marker.setLatLng(ll);
        circle.setLatLng(ll).setRadius(v.accuracy||0).setStyle({color:accColor(v.accuracy)});
        const pts=trail.getLatLngs(); pts.push(ll); if(pts.length>60) pts.shift(); trail.setLatLngs(pts);
        setMeta({ts:v.timestamp||null, acc:v.accuracy??null});
        if(!map._first){map._first=true; map.setView(ll,16,{animate:true});}
      },()=>setConnected(false));
    }
    setTimeout(()=>map.invalidateSize(),50);
    return()=>{unsub&&unsub(); map.remove();}
  },[shareId, pinIcon]);

  const recenter=()=>{const ll=markerRef.current?.getLatLng();ll&&mapRef.current?.setView(ll,16,{animate:true});};
  const zoomIn=()=>mapRef.current?.zoomIn();
  const zoomOut=()=>mapRef.current?.zoomOut();
  const toggleFs=()=>{const el=document.getElementById("map");!document.fullscreenElement?el?.requestFullscreen():document.exitFullscreen();};
  const copyLink=async()=>{
    const url=new URL(location.href); if(!shareId) url.searchParams.set("id","TU_ID");
    await navigator.clipboard.writeText(url.toString());
    toast("Enlace copiado");
    if (navigator.share) { try { await navigator.share({ title:"Pánico México", url:url.toString() }); } catch {} }
  };
  const toast=(msg)=>{
    let el=document.getElementById("pmx-toast");
    if(!el){el=document.createElement("div");el.id="pmx-toast";el.className="pmx-toast";document.body.appendChild(el);}
    el.textContent=msg; el.classList.add("show"); clearTimeout(el._t);
    el._t=setTimeout(()=>el.classList.remove("show"),1500);
  };

  const lastTxt = timeAgo(meta.ts);
  const accTxt = fmtMeters(meta.acc);

  return (
    <div style={{height:"100dvh",display:"grid",gridTemplateRows:"auto 1fr auto",background:"#0d1117"}}>
      {/* HEADER con chips de precisión y última actualización */}
      <div className="pmx-header">
        <div className="pmx-brand">
          <b>Pánico México 🚨🇲🇽</b>
          <span className="pmx-status">{connected ? "en vivo" : "sin conexión"}</span>
        </div>

        <div className="pmx-chips">
          <span className="pmx-chip">
            Último: <b className="pmx-strong">{lastTxt}</b>
          </span>
          <span className="pmx-chip">
            Precisión: <b className="pmx-strong" style={{color: accColor(meta.acc)}}>{accTxt}</b>
          </span>
        </div>
      </div>

      {/* MAPA + FABs */}
      <div style={{position:"relative"}}>
        <div id="map" style={{width:"100%",height:"100%"}} />
        <div className="pmx-fabs">
          <button className="pmx-fab" onClick={recenter}>🎯</button>
          <button className="pmx-fab" onClick={toggleFs}>⛶</button>
          <button className="pmx-fab" onClick={zoomIn}>＋</button>
          <button className="pmx-fab" onClick={zoomOut}>－</button>
        </div>

        {/* aviso si no hay id */}
        {!shareId && (
          <div style={{
            position:"absolute", left:10, right:10, top:10, zIndex:402,
            border:"1px solid #30363d", background:"rgba(22,27,34,.9)", color:"#c9d1d9",
            borderRadius:14, padding:"10px 12px", backdropFilter:"blur(8px)"
          }}>
            Agrega <code>?id=&lt;shareId&gt;</code> a la URL para escuchar una ubicación en vivo.
          </div>
        )}
      </div>

      {/* BOTTOM: sólo Compartir */}
      <div className="pmx-bottom">
        <button className="pmx-share" onClick={copyLink}>Compartir</button>
      </div>

      <div id="pmx-toast" className="pmx-toast" />
    </div>
  );
}
