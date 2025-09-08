import { useEffect, useRef, useState } from "react";
import { db } from "./firebase";
import { ref, onValue } from "firebase/database";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const styles = {
  app: { height: "100vh", display: "grid", gridTemplateRows: "auto 1fr auto", background:"#0d1117", color:"#f0f6fc"},
  header: { display:"flex", gap:12, alignItems:"center", padding:"12px 16px", borderBottom:"1px solid #21262d" },
  chip: { padding:"4px 10px", borderRadius:999, background:"#161b22", border:"1px solid #21262d", fontSize:12, color:"#8b949e" },
  map: { width:"100%", height:"100%" },
  bar: { display:"flex", gap:8, padding:"8px 12px", borderTop:"1px solid #21262d" },
  btn: { padding:"6px 10px", background:"#21262d", color:"#f0f6fc", border:"1px solid #30363d", borderRadius:8, cursor:"pointer" }
};

export default function App() {
  const shareId = new URLSearchParams(location.search).get("id") || "";
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyRef = useRef(null);
  const [meta, setMeta] = useState({ last: "—", acc: "—", speed: "—", heading: "—" });

  useEffect(() => {
    // crear mapa
    const map = L.map("map").setView([19.4326, -99.1332], 13);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    // marker + círculo de precisión
    const marker = L.marker([19.4326, -99.1332], { title:"Posición" }).addTo(map);
    const circle = L.circle([19.4326, -99.1332], { radius:0, color:"#58A6FF", fillColor:"#58A6FF", fillOpacity:0.15, weight:1 }).addTo(map);

    markerRef.current = marker;
    accuracyRef.current = circle;

    // suscripción a shares/<id>/location
    if (shareId) {
      const locRef = ref(db, `shares/${shareId}/location`);
      const off = onValue(locRef, (snap) => {
        const v = snap.val();
        if (!v || v.lat == null || v.lng == null) return;

        const ll = [v.lat, v.lng];
        marker.setLatLng(ll);
        circle.setLatLng(ll).setRadius(v.accuracy || 0);

        // actualizar meta
        setMeta({
          last: v.timestamp ? new Date(v.timestamp).toLocaleString() : "—",
          acc: v.accuracy != null ? `${Number(v.accuracy).toFixed(1)} m` : "—",
          speed: v.speed != null ? `${Number(v.speed).toFixed(1)} m/s` : "—",
          heading: v.bearing != null ? `${Number(v.bearing).toFixed(0)}°` : "—",
        });

        // centra la primera vez que llega data
        if (!map._centeredOnce) {
          map.setView(ll, 16, { animate: true });
          map._centeredOnce = true;
        }
      });
      return () => { off(); map.remove(); };
    }

    return () => map.remove();
  }, [shareId]);

  const recenter = () => {
    const latlng = markerRef.current?.getLatLng();
    if (latlng) mapRef.current.setView(latlng, 16, { animate:true });
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <strong>Live Location</strong>
        <span style={styles.chip}>ID: <b>{shareId || "—"}</b></span>
        <span style={styles.chip}>Último: {meta.last}</span>
        <span style={styles.chip}>Precisión: {meta.acc}</span>
        <span style={styles.chip}>Vel.: {meta.speed}</span>
        <span style={styles.chip}>Rumbo: {meta.heading}</span>
      </header>

      <div id="map" style={styles.map} />

      <div style={styles.bar}>
        <button style={styles.btn} onClick={recenter}>Centrar</button>
        <span style={{marginLeft:"auto", fontSize:12, color:"#8b949e"}}>
          Abre: <code>?id=&lt;shareId&gt;</code>
        </span>
      </div>
    </div>
  );
}
