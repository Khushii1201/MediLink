import { useEffect, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { api } from '../api';

export default function Home() {
  const [hospitals, setHospitals] = useState([]);
  const [q, setQ] = useState('');
  const [position, setPosition] = useState(null);
  const [error, setError] = useState('');

  async function search() {
    try {
      const params = { ...(q ? { q } : {}), ...(position ? { lat: position.latitude, lng: position.longitude } : {}) };
      const data = await api.searchHospitals(params);
      setHospitals(data);
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  function locateMe() {
    if (!navigator.geolocation) return setError('Location is not supported by this browser.');
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setPosition({ latitude: coords.latitude, longitude: coords.longitude });
      setError('');
    }, () => setError('Location permission was denied or unavailable. You can still browse the hospital map.'));
  }

  useEffect(() => { search(); }, [position]);

  const mapCenter = position
    ? [position.latitude, position.longitude]
    : [hospitals[0]?.latitude || 28.6139, hospitals[0]?.longitude || 77.2090];
  const nearest = position ? hospitals.find((hospital) => hospital.distance_km !== null) : null;

  return (
    <div className="page">
      <section className="hero">
        <h1>Find emergency care, fast.</h1>
        <p>MediLink brings hospitals, ambulances, and blood banks onto one platform so critical resources are easy to find in an emergency.</p>
      </section>

      <section className="search-bar">
        <input
          placeholder="Search hospitals by name, address, or specialty"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && search()}
        />
        <button className="btn-primary" onClick={search}>Search</button>
        <button className="btn-secondary" onClick={locateMe}>Find near me</button>
      </section>

      {error && <p className="error">{error}</p>}

      <section className="map-section">
        <div className="map-heading">
          <div><h2>Nearby hospitals</h2><p className="muted">{nearest ? `Closest: ${nearest.name} · ${nearest.distance_km} km away` : 'Allow location access to sort by distance.'}</p></div>
          {position && <span className="location-status">Location active</span>}
        </div>
        <MapContainer center={mapCenter} zoom={position ? 12 : 11} scrollWheelZoom className="hospital-map">
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          <MapRecenter center={mapCenter} />
          {position && <CircleMarker center={[position.latitude, position.longitude]} radius={9} pathOptions={{ color: '#0f766e', fillColor: '#5eead4', fillOpacity: 0.9 }}><Popup>Your location</Popup></CircleMarker>}
          {hospitals.filter((hospital) => hospital.latitude != null && hospital.longitude != null).map((hospital) => (
            <CircleMarker key={hospital.hospital_id} center={[hospital.latitude, hospital.longitude]} radius={8} pathOptions={{ color: '#b45309', fillColor: '#fbbf24', fillOpacity: 0.9 }}>
              <Popup><strong>{hospital.name}</strong><br />{hospital.address}<br />{hospital.distance_km != null ? `${hospital.distance_km} km away` : ''}<br />{hospital.specialties}</Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </section>

      <section className="card-grid">
        {hospitals.map((h) => (
          <div className="card" key={h.hospital_id}>
            <h3>{h.name}</h3>
            <p className="muted">{h.address}</p>
            <p className="muted">{h.specialties}</p>
            {h.distance_km != null && <p className="distance-label">{h.distance_km} km away</p>}
            <div className="resource-row">
              {h.resources?.map((r) => (
                <span key={r.type} className="pill">{r.type}: {r.available}/{r.total}</span>
              ))}
            </div>
          </div>
        ))}
        {hospitals.length === 0 && !error && <p className="muted">No hospitals found.</p>}
      </section>
    </div>
  );
}

function MapRecenter({ center }) {
  const map = useMap();
  useEffect(() => { map.setView(center); }, [center, map]);
  return null;
}
