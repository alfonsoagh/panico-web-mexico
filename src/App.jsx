// App.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { db } from "./firebase";
import { ref, onValue } from "firebase/database";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

/** ---------- Helpers de formato ---------- */
const metersToReadable = (m) =>
  (m ?? null) === null ? "—" : `${Number(m).toFixed(m >= 100 ? 0 : 1)} m`;

const mpsToKmh = (mps) =>
  (mps ?? null) === null ? "—" : `${(Number(mps) * 3.6).toFixed(1)} km/h`;

const degToCompass = (deg) => {
  if (deg == null) return "—";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSO","SO","OSO","O","ONO","NO","NNO"];
  return dirs[Math.round((deg % 360) / 22.5) % 16];
};

const timeAgo = (ts) => {
  if (!ts) return "—";
  const delta = (Date.now() - ts) / 1000;
  if (delta < 60) return `${Math.floor(delta)} s`;
  if (delta < 3600) return `${Math.floor(delta / 60)} min`;
  if (delta < 86400) return `${Math.floor(delta / 3600)} h`;
  return new Date(ts).toLocaleString();
};

/** ---------- Estilos (CSS-in-JS + <style>) ---------- */
const styles = {
  app: {
    height: "100dvh",
    display: "grid",
    gridTemplateRows: "auto 1fr auto",
    background: "#0d1117",
    color: "#f0f6fc",
  },
  header: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    alignItems: "center",
    padding: "10px 12px",
    borderBottom: "1px solid #21262d",
    position: "relative",
  },
  brand: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  liveDot: (ok) => ({
    width: 10,
    height: 10,
    borderRadius: 999,
    background: ok ? "#2ea043" : "#8b949e",
    boxShadow: ok ? "0 0 0 6px rgba(46,160,67,0.2)" : "none",
  }),
  chipRow: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    justifySelf: "end",
  },
  chip: {
    padding: "4px 10px",
    borderRadius: 999,
    background: "#161b22",
    border: "1px solid #21262d",
    fontSize: 12,
    color: "#8b949e",
    whiteSpace: "nowrap",
  },
  mapWrap: { position: "relative" },
  map: { width: "100%", height: "100%" },
  fabCol: {
    position: "absolute",
    right: 10,
    bottom: 10,
    display: "grid",
    gap: 8,
    zIndex: 400,
  },
  fab: {
    padding: 10,
    background: "#161b22",
    border: "1px solid #30363d",
    borderRadius: 12,
    color: "#f0f6fc",
    cursor: "pointer",
    backdropFilter: "blur(6px)",
  },
  toolbar: {
    display: "flex",
    gap: 8,
    padding: "8px 12px",
    borderTop: "1px solid #21262d",
    alignItems: "center",
  },
  btn: {
    padding: "8px 12px",
    background: "#21262d",
    color: "#f0f6fc",
    border: "1px solid #30363d",
    borderRadius: 10,
    cursor: "pointer",
  },
  link: { fontSize: 12, color: "#8b949e" },
  pillStrong: { color: "#f0f6fc" },
};

/** ---------- Componente ---------- */
export default function App() {
  const shareId = new URLSearchParams(location.search).get("id") || "";
  const mapRef = useRef(/** @type {L.Map|null} */ (null));
  const markerRef = useRef(/** @type {L.Marker|null} */ (null));
  const circleRef = useRef(/** @type {L.Circle|null} */ (null));
  const [connected, setConnected] = useState(false);
  const [hasFirstFix, setHasFirstFix] = useState(false);
  const [meta, setMeta] = useState({
    lastTs: null,
    acc: null,
    speed: null,
    bearing: null,
  });

  // DivIcon para evitar líos con assets del marker
  const pinIcon = useMemo(
    () =>
      L.divIcon({
        className: "pin-icon",
        html: `<div class="pin-emoji">📍</div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 28],
      }),
    []
  );

  useEffect(() => {
    // Inyectamos CSS extra para móvil / Leaflet / pin
    const style = document.createElement("style");
    style.innerHTML = `
      .leaflet-container { background: #0b1116; }
      .pin-emoji { font-size: 24px; line-height: 1; transform: translateY(-2px); }
      /* Chips scrollables en móviles */
      @media (max-width: 560px) {
        .chips-scroll { overflow:auto; scrollbar-width:none; -ms-overflow-style:none;}
        .chips-scroll::-webkit-scrollbar { display:none; }
        .hide-on-mobile { display: none; }
      }
    `;
    document.head.appendChild(style);
    return () => document.head.removeChild(style);
  }, []);

  useEffect(() => {
    // Crear mapa
    const map = L.map("map", {
      zoomControl: false, // movemos los controles a FABs
    }).setView([19.4326, -99.1332], 13);
    mapRef.current = map;

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(map);

    // Controles de zoom minimalistas (arriba izq.)
    L.control
      .zoom({
        position: "topleft",
      })
      .addTo(map);

    const marker = L.marker([19.4326, -99.1332], {
      title: "Posición",
      icon: pinIcon,
    }).addTo(map);

    const circle = L.circle([19.4326, -99.1332], {
      radius: 0,
      color: "#58A6FF",
      fillColor: "#58A6FF",
      fillOpacity: 0.15,
      weight: 1,
    }).addTo(map);

    markerRef.current = marker;
    circleRef.current = circle;

    // Suscripción a Firebase si hay shareId
    let unsubscribe = null;
    if (shareId) {
      const locRef = ref(db, `shares/${shareId}/location`);
      unsubscribe = onValue(
        locRef,
        (snap) => {
          setConnected(true);
          const v = snap.val();
          if (!v || v.lat == null || v.lng == null) return;

          const ll = [v.lat, v.lng];
          marker.setLatLng(ll);
          circle.setLatLng(ll).setRadius(v.accuracy || 0);

          setMeta({
            lastTs: v.timestamp || null,
            acc: v.accuracy ?? null,
            speed: v.speed ?? null,
            bearing: v.bearing ?? null,
          });

          if (!hasFirstFix) {
            setHasFirstFix(true);
            map.setView(ll, 16, { animate: true });
          }
        },
        () => setConnected(false)
      );
    }

    // Fix tamaño al montar en contenedor flexible
    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      unsubscribe && unsubscribe();
      map.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareId, pinIcon]);

  /** ---------- Acciones UI ---------- */
  const recenter = () => {
    const latlng = markerRef.current?.getLatLng();
    if (latlng && mapRef.current) mapRef.current.setView(latlng, 16, { animate: true });
  };

  const zoomIn = () => mapRef.current?.zoomIn();
  const zoomOut = () => mapRef.current?.zoomOut();

  const toggleFullscreen = () => {
    const el = document.getElementById("map");
    if (!document.fullscreenElement) el?.requestFullscreen?.();
    else document.exitFullscreen?.();
  };

  const copyLink = async () => {
    const url = new URL(location.href);
    if (!shareId) url.searchParams.set("id", "TU_ID_AQUI");
    await navigator.clipboard.writeText(url.toString());
  };

  const goToMyLocation = () => {
    if (!mapRef.current) return;
    navigator.geolocation?.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        mapRef.current.setView([latitude, longitude], 16, { animate: true });
      },
      () => {
        alert("No se pudo obtener tu ubicación (permiso denegado o no disponible).");
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
    );
  };

  /** ---------- Derivados ---------- */
  const lastAgo = timeAgo(meta.lastTs);
  const accTxt = metersToReadable(meta.acc);
  const speedTxt = mpsToKmh(meta.speed);
  const headingTxt =
    meta.bearing == null ? "—" : `${Math.round(meta.bearing)}° ${degToCompass(meta.bearing)}`;

  return (
    <div style={styles.app}>
      {/* HEADER */}
      <header style={styles.header}>
        <div style={styles.brand}>
          <span style={styles.liveDot(connected)} aria-label={connected ? "Conectado" : "Desconectado"} />
          <strong style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            Live Location
          </strong>
          <span className="hide-on-mobile" style={{ fontSize: 12, color: "#8b949e" }}>
            {connected ? "escuchando cambios en tiempo real" : "sin datos"}
          </span>
        </div>

        <div className="chips-scroll" style={styles.chipRow}>
          <span style={styles.chip}>
            ID: <b style={styles.pillStrong}>{shareId || "—"}</b>
          </span>
          <span style={styles.chip}>
            Último: <b style={styles.pillStrong}>{lastAgo}</b>
          </span>
          <span style={styles.chip}>
            Precisión: <b style={styles.pillStrong}>{accTxt}</b>
          </span>
          <span style={styles.chip}>
            Vel.: <b style={styles.pillStrong}>{speedTxt}</b>
          </span>
          <span style={styles.chip}>
            Rumbo: <b style={styles.pillStrong}>{headingTxt}</b>
          </span>
        </div>
      </header>

      {/* MAPA */}
      <div id="map-wrap" style={styles.mapWrap}>
        <div id="map" style={styles.map} />
        {/* FABs */}
        <div style={styles.fabCol}>
          <button title="Centrar en marcador" style={styles.fab} onClick={recenter}>🎯</button>
          <button title="Mi ubicación" style={styles.fab} onClick={goToMyLocation}>📡</button>
          <button title="Pantalla completa" style={styles.fab} onClick={toggleFullscreen}>⛶</button>
          <button title="Acercar" style={styles.fab} onClick={zoomIn}>＋</button>
          <button title="Alejar" style={styles.fab} onClick={zoomOut}>－</button>
        </div>

        {/* Placeholder cuando no hay id */}
        {!shareId && (
          <div
            style={{
              position: "absolute",
              left: 12,
              right: 12,
              top: 12,
              padding: "10px 12px",
              borderRadius: 12,
              border: "1px solid #30363d",
              background: "rgba(22,27,34,0.9)",
              color: "#c9d1d9",
              zIndex: 401,
              fontSize: 14,
            }}
          >
            Agrega <code>?id=&lt;shareId&gt;</code> a la URL para escuchar una ubicación en vivo.
          </div>
        )}
      </div>

      {/* BOTTOM BAR */}
      <div style={styles.toolbar}>
        <button style={styles.btn} onClick={recenter}>Centrar</button>
        <button style={styles.btn} onClick={goToMyLocation}>Mi ubicación</button>
        <button style={styles.btn} onClick={copyLink}>Copiar enlace</button>

        <span style={{ marginLeft: "auto", ...styles.link }}>
          Abre con: <code>?id=&lt;shareId&gt;</code>
        </span>
      </div>
    </div>
  );
}
