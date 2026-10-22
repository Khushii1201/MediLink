import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';

// Create SVG-based DivIcons for crisp, reliable markers without external image asset dependencies
function createCustomIcon(color, text = '') {
  return L.divIcon({
    className: 'custom-map-marker',
    html: `
      <div style="
        background-color: ${color};
        width: 30px;
        height: 30px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
        border: 2px solid white;
      ">
        <span style="
          transform: rotate(45deg);
          color: white;
          font-size: 13px;
          font-weight: bold;
        ">${text}</span>
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30],
  });
}

const ICONS = {
  HOSPITAL: createCustomIcon('#0f766e', 'H'),
  AMBULANCE: createCustomIcon('#2563eb', '🚑'),
  PATIENT: createCustomIcon('#dc2626', '📍'),
  BLOODBANK: createCustomIcon('#b91c1c', '🩸'),
  DEFAULT: createCustomIcon('#64748b', '•'),
};

function ChangeView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && center[0] && center[1]) {
      map.setView(center, zoom || map.getZoom());
    }
  }, [center, zoom, map]);
  return null;
}

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(e) {
      if (onMapClick) {
        onMapClick({ lat: e.latlng.lat, lng: e.latlng.lng });
      }
    },
  });
  return null;
}

export function MapView({
  center = [28.6139, 77.2090], // Delhi NCR center
  zoom = 12,
  markers = [],
  routeLine = null,
  onMapClick = null,
  height = '400px',
  className = '',
}) {
  const validCenter = center && center[0] && center[1] ? center : [28.6139, 77.2090];

  return (
    <div className={`map-wrapper ${className}`} style={{ height, width: '100%', position: 'relative' }}>
      <MapContainer
        center={validCenter}
        zoom={zoom}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%', borderRadius: 'inherit' }}
      >
        <ChangeView center={validCenter} zoom={zoom} />
        {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {markers.map((m, idx) => {
          if (!m.lat || !m.lng) return null;
          const icon = m.iconType && ICONS[m.iconType] ? ICONS[m.iconType] : ICONS.DEFAULT;

          return (
            <Marker key={m.id || idx} position={[m.lat, m.lng]} icon={icon}>
              {m.popup && <Popup>{m.popup}</Popup>}
            </Marker>
          );
        })}

        {routeLine && routeLine.length >= 2 && (
          <Polyline
            positions={routeLine}
            color="#2563eb"
            weight={4}
            dashArray="6, 8"
          />
        )}
      </MapContainer>
    </div>
  );
}

export default MapView;
