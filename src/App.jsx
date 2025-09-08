import { useEffect, useRef, useState } from "react";
import { db } from "./firebase";
import { onValue, ref, query, onChildAdded, limitToLast } from "firebase/database";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

const styles = {
  app: { height: "100vh", display: "grid", gridTemplateRows: "auto 1fr auto", background:"#0d1117", color:"#f0f6fc"},
  header: { display:"flex", gap:12, alignItems:"center", padding:"12px 16px", borderBottom:"1px solid #21262d" },
  chip: { padding:"4px 10px", borderRadius:999, background:"#161b22", border:"1px solid #21262d", fontSize:12, color:"#8b949e" },
  map: { width:"100%", height:"100%" },
  bar: { display:"flex", gap:8, padding:"8px 12px", borderTop:"1px solid #21262d" }
};

export default function App() {
  const shareId = new URLSearchParams(location.search).get("id") || "demo123";
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const accuracyRef = useRef(null);
  const pathRef = useRef(null);
  const [meta, setMeta] = useState({ last: "—", acc: "—", speed: "—", heading: "—" });

  useEffect(() => {
    // init map
    const map = L.map("map").setView([19.4326, -99.1332], 13);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: "&copy; OpenStreetMap"
    }).addTo(map);

    const marker = L.marker([0,0], { title:"Posición" }).addTo(map);
    const circle = L.circle([0,0], { radius:0, color:"#58A6FF", fillColor:"#58A6FF", fillOpacity:0.15, weight:1 }).addTo(map);
    const path = L.polyline([], { color:"#DC143C", weight:4, opacity:0.9 }).addTo(map);

    markerRef.current = marker;
    accuracyRef.current = circle;
    pathRef.current = path;

    // current
    const currentRef = ref(db, `tracks/${shareId}/current`);
    const unsub1 = onValue(currentRef, (snap) => {
      const v = snap.val();
      if (!v || !v.lat || !v.lng) return;
      const ll = [v.lat, v.lng];

      marker.setLatLng(ll);
      circle.setLatLng(ll).setRadius(v.acc || 0);

      setMeta({
        last: new Date(v.ts).toLocaleString(),
        acc: v.acc != null ? `${v.acc.toFixed(1)} m` : "—",
        speed: v.speed != null ? `${v.speed.toFixed(1)} m/s` : "—",
        heading: v.heading != null ? `${v.heading.toFixed(0)}°` : "—",
      });

      if (!map._movedOnce) {
        map.setView(ll, 16);
        map._movedOnce = true;
      }
    });

    // points (historial)
    const pointsRef = query(ref(db, `tracks/${shareId}/points`), limitToLast(500));
    const unsub2 = onChildAdded(pointsRef, (snap) => {
      const p = snap.val();
      if (!p || !p.lat || !p.lng) return;
      path.addLatLng([p.lat, p.lng]);
    });

    return () => { unsub1(); unsub2(); map.remove(); };
  }, [shareId]);

  const recenter = () => {
    const latlng = markerRef.current?.getLatLng();
    if (latlng) mapRef.current.setView(latlng, 16, { animate:true });
  };
  const fitPath = () => {
    const latlngs = pathRef.current?.getLatLngs?.();
    if (latlngs && latlngs.length > 1) {
      const bounds = L.latLngBounds(latlngs);
      mapRef.current.fitBounds(bounds.pad(0.2), { animate:true });
    }
  };

  return (
    <div style={styles.app}>
      <header style={styles.header}>
        <strong>Live Location</strong>
        <span style={styles.chip}>ID: <b>{shareId}</b></span>
        <span style={styles.chip}>Último: {meta.last}</span>
        <span style={styles.chip}>Precisión: {meta.acc}</span>
        <span style={styles.chip}>Vel.: {meta.speed}</span>
        <span style={styles.chip}>Rumbo: {meta.heading}</span>
      </header>
      <div id="map" style={styles.map} />
      <div style={styles.bar}>
        <button onClick={recenter}>Centrar</button>
        <button onClick={fitPath}>Ajustar ruta</button>
        <span style={{marginLeft:"auto", fontSize:12, color:"#8b949e"}}>
          Abre: <code>?id=&lt;shareId&gt;</code>
        </span>
      </div>
    </div>
  );
}
