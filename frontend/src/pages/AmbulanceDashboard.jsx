import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import { usePolling } from '../hooks/usePolling';
import { MapView } from '../components/MapView';
import { Button } from '../components/Button';
import { Badge } from '../components/Badge';
import { FormField } from '../components/FormField';
import { StatusStepper } from '../components/StatusStepper';
import { Spinner } from '../components/Spinner';
import { EmptyState } from '../components/EmptyState';

const TRIP_STEPS = [
  { label: 'Assigned', description: 'Request received' },
  { label: 'Accepted', description: 'Driver confirmed' },
  { label: 'En Route', description: 'Navigating to pickup' },
  { label: 'Completed', description: 'Patient delivered' },
];

function getAmbulanceStepIndex(status) {
  if (status === 'REQUESTED') return 0;
  if (status === 'ACCEPTED') return 1;
  if (status === 'EN_ROUTE') return 2;
  if (status === 'COMPLETED') return 3;
  return 0;
}

export default function AmbulanceDashboard() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const ambulanceId = user?.ambulance_id;

  const [ambulance, setAmbulance] = useState(null);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  // Live Location Broadcast
  const [sharingLocation, setSharingLocation] = useState(false);
  const [lastBroadcastTime, setLastBroadcastTime] = useState(null);
  const [geoError, setGeoError] = useState('');
  const watchIdRef = useRef(null);
  const lastSentRef = useRef(0);

  // Manual fallback inputs
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const [manualUpdating, setManualUpdating] = useState(false);

  // Load ambulance details & assigned requests
  const loadAmbulanceData = useCallback(async () => {
    if (!ambulanceId) return;
    try {
      const [ambList, reqList] = await Promise.all([
        api.listAmbulances(),
        api.myAmbulanceRequests(),
      ]);
      const currentAmb = (ambList || []).find((a) => a.ambulance_id === ambulanceId);
      if (currentAmb) {
        setAmbulance(currentAmb);
        setManualLat(String(currentAmb.latitude || ''));
        setManualLng(String(currentAmb.longitude || ''));
      }
      setRequests(reqList || []);
    } catch (err) {
      console.error('Failed to load ambulance console:', err);
    } finally {
      setLoading(false);
    }
  }, [ambulanceId]);

  useEffect(() => {
    loadAmbulanceData();
  }, [loadAmbulanceData]);

  // Polling for incoming trips every 10 seconds
  usePolling(loadAmbulanceData, 10000, Boolean(ambulanceId));

  // Toggle vehicle status (AVAILABLE / OFFLINE)
  const handleToggleStatus = async (newStatus) => {
    try {
      await api.updateAmbulanceProfile(ambulanceId, { status: newStatus });
      addToast(`Ambulance status set to ${newStatus}`, 'success');
      loadAmbulanceData();
    } catch (err) {
      addToast(err.message || 'Failed to update vehicle status', 'error');
    }
  };

  // Broadcast GPS location
  const broadcastLocation = useCallback(async (latitude, longitude) => {
    try {
      await api.updateAmbulanceLocation(ambulanceId, { latitude, longitude });
      setLastBroadcastTime(new Date());
    } catch (err) {
      console.error('Location broadcast failed:', err);
    }
  }, [ambulanceId]);

  // Handle live GPS toggle via watchPosition
  const toggleShareLocation = () => {
    if (sharingLocation) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setSharingLocation(false);
      addToast('Live location sharing paused', 'info');
      return;
    }

    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser');
      addToast('Geolocation not supported', 'error');
      return;
    }

    setGeoError('');
    try {
      const id = navigator.geolocation.watchPosition(
        (pos) => {
          const now = Date.now();
          // Rate-limit to roughly every 10 seconds
          if (now - lastSentRef.current >= 9500) {
            lastSentRef.current = now;
            const lat = Number(pos.coords.latitude.toFixed(5));
            const lng = Number(pos.coords.longitude.toFixed(5));
            broadcastLocation(lat, lng);
          }
        },
        (err) => {
          setGeoError(err.message || 'Permission denied for location sharing');
          setSharingLocation(false);
          addToast('GPS permission denied or unavailable', 'error');
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
      );

      watchIdRef.current = id;
      setSharingLocation(true);
      addToast('Live GPS location broadcasting enabled', 'success');
    } catch (err) {
      setGeoError(err.message);
      setSharingLocation(false);
    }
  };

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  // Manual GPS update
  const handleManualLocationSubmit = async (e) => {
    e.preventDefault();
    const lat = Number(manualLat);
    const lng = Number(manualLng);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      addToast('Please enter valid coordinates (-90 to 90, -180 to 180)', 'error');
      return;
    }

    setManualUpdating(true);
    try {
      await api.updateAmbulanceLocation(ambulanceId, { latitude: lat, longitude: lng });
      addToast('Ambulance coordinates updated manually', 'success');
      setLastBroadcastTime(new Date());
      loadAmbulanceData();
    } catch (err) {
      addToast(err.message || 'Failed to update coordinates', 'error');
    } finally {
      setManualUpdating(false);
    }
  };

  // Trip action handlers: Accept, Reject, Start Trip (EN_ROUTE), Complete (COMPLETED)
  const handleTripAction = async (requestId, status, action = null) => {
    try {
      const payload = action ? { action } : { status };
      await api.updateAmbulanceRequest(requestId, payload);
      addToast(`Trip action executed: ${action || status}`, 'success');
      loadAmbulanceData();
    } catch (err) {
      addToast(err.message || 'Action failed', 'error');
    }
  };

  if (!ambulanceId) {
    return (
      <div className="page">
        <div className="card text-center" style={{ maxWidth: '500px', margin: '4rem auto' }}>
          <h3>Unassigned Operator Account</h3>
          <p className="muted">This user account is not linked to an ambulance vehicle ID. Please contact a platform administrator.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page page-loading-screen">
        <Spinner size="lg" />
        <p className="muted">Loading operator console...</p>
      </div>
    );
  }

  // Identify active trip
  const activeTrip = requests.find((r) => r.ambulance_id === ambulanceId && ['ACCEPTED', 'EN_ROUTE'].includes(r.status));
  const queuedTrips = requests.filter((r) => r.request_id !== activeTrip?.request_id && ['REQUESTED', 'ACCEPTED'].includes(r.status));

  // Map markers for active trip
  const mapMarkers = [];
  let routeLine = null;

  if (ambulance?.latitude && ambulance?.longitude) {
    mapMarkers.push({
      id: 'amb-pos',
      lat: ambulance.latitude,
      lng: ambulance.longitude,
      iconType: 'AMBULANCE',
      popup: <strong>My Vehicle: {ambulance.vehicle_no}</strong>,
    });
  }

  if (activeTrip?.pickup_lat && activeTrip?.pickup_lng) {
    mapMarkers.push({
      id: 'pickup-pos',
      lat: activeTrip.pickup_lat,
      lng: activeTrip.pickup_lng,
      iconType: 'PATIENT',
      popup: <strong>Pickup: {activeTrip.pickup_location}</strong>,
    });

    if (ambulance?.latitude && ambulance?.longitude) {
      routeLine = [
        [ambulance.latitude, ambulance.longitude],
        [activeTrip.pickup_lat, activeTrip.pickup_lng],
      ];
    }
  }

  const mapCenter = mapMarkers[0] ? [mapMarkers[0].lat, mapMarkers[0].lng] : [28.6139, 77.2090];

  return (
    <div className="page ambulance-dashboard-page">
      <div className="dashboard-banner card">
        <div className="banner-greeting">
          <span className="badge badge-info">Fleet Dispatch Console</span>
          <h2>Vehicle {ambulance?.vehicle_no || 'Fleet Unit'}</h2>
          <p className="muted">
            Driver: {ambulance?.driver_name || user?.name} · Contact: {ambulance?.driver_phone || user?.phone || 'Not set'}
          </p>
        </div>

        <div className="banner-quick-actions">
          <Badge status={ambulance?.status} size="lg" />
          {ambulance?.status === 'AVAILABLE' && (
            <Button variant="outline" size="sm" onClick={() => handleToggleStatus('OFFLINE')}>
              Go Offline
            </Button>
          )}
          {ambulance?.status === 'OFFLINE' && (
            <Button variant="success" size="sm" onClick={() => handleToggleStatus('AVAILABLE')}>
              Go Available
            </Button>
          )}
        </div>
      </div>

      {/* Broadcast & GPS Management Card */}
      <div className="card live-broadcast-card" style={{ marginBottom: '2rem' }}>
        <div className="broadcast-header">
          <div>
            <h3>Live GPS Broadcasting</h3>
            <p className="muted">
              Stream live GPS coordinates to patients and emergency dispatchers every ~10 seconds.
            </p>
          </div>
          <Button
            variant={sharingLocation ? 'danger' : 'primary'}
            onClick={toggleShareLocation}
          >
            <span>{sharingLocation ? '🛑 Stop Broadcasting' : '📡 Start Live Broadcasting'}</span>
          </Button>
        </div>

        {geoError && (
          <div className="alert alert-danger" style={{ marginTop: '0.75rem' }}>
            <span>{geoError}</span>
          </div>
        )}

        <div className="broadcast-status-bar" style={{ marginTop: '1rem' }}>
          <div>
            <span className="status-indicator-dot" style={{ backgroundColor: sharingLocation ? '#16a34a' : '#94a3b8' }} />
            <span>Broadcast Status: <strong>{sharingLocation ? 'Active (Live)' : 'Paused'}</strong></span>
          </div>
          {lastBroadcastTime && (
            <span className="muted" style={{ fontSize: '0.85rem' }}>
              Last coordinate push: {lastBroadcastTime.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Manual Fallback */}
        <details className="manual-coords-details" style={{ marginTop: '1rem' }}>
          <summary className="cursor-pointer">Manual GPS Coordinates Override (Fallback)</summary>
          <form onSubmit={handleManualLocationSubmit} className="manual-coords-form" style={{ marginTop: '0.75rem' }}>
            <div className="form-inline-grid">
              <FormField label="Latitude" id="amb-lat">
                <input
                  type="text"
                  id="amb-lat"
                  className="form-input"
                  placeholder="28.5670"
                  value={manualLat}
                  onChange={(e) => setManualLat(e.target.value)}
                  required
                />
              </FormField>

              <FormField label="Longitude" id="amb-lng">
                <input
                  type="text"
                  id="amb-lng"
                  className="form-input"
                  placeholder="77.2110"
                  value={manualLng}
                  onChange={(e) => setManualLng(e.target.value)}
                  required
                />
              </FormField>

              <div style={{ alignSelf: 'flex-end', marginBottom: '0.25rem' }}>
                <Button variant="secondary" type="submit" loading={manualUpdating}>
                  Update Pin
                </Button>
              </div>
            </div>
          </form>
        </details>
      </div>

      {/* Active Trip Execution Card */}
      {activeTrip ? (
        <div className="card active-trip-operator-card" style={{ marginBottom: '2rem' }}>
          <div className="active-trip-header">
            <div>
              <span className="badge badge-danger">Active Emergency Mission</span>
              <h3>Trip #{activeTrip.request_id} — {activeTrip.pickup_location}</h3>
              <p className="muted">
                Patient Contact: {activeTrip.patient_name || 'Emergency Patient'} · 📞 {activeTrip.patient_phone || 'N/A'}
              </p>
            </div>
            <div className="trip-stage-controls">
              {activeTrip.status === 'ACCEPTED' && (
                <>
                  <Button
                    variant="primary"
                    size="md"
                    onClick={() => handleTripAction(activeTrip.request_id, 'EN_ROUTE')}
                  >
                    🚗 Start Trip (En Route)
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleTripAction(activeTrip.request_id, null, 'reject')}
                  >
                    Reject & Reassign
                  </Button>
                </>
              )}
              {activeTrip.status === 'EN_ROUTE' && (
                <Button
                  variant="success"
                  size="md"
                  onClick={() => handleTripAction(activeTrip.request_id, 'COMPLETED')}
                >
                  ✓ Complete Mission
                </Button>
              )}
            </div>
          </div>

          <div className="stepper-wrap" style={{ margin: '1.5rem 0' }}>
            <StatusStepper
              steps={TRIP_STEPS}
              currentStepIndex={getAmbulanceStepIndex(activeTrip.status)}
            />
          </div>

          <div className="active-trip-map-wrap">
            <MapView
              center={mapCenter}
              zoom={13}
              markers={mapMarkers}
              routeLine={routeLine}
              height="350px"
            />
          </div>
        </div>
      ) : (
        <div className="card text-center" style={{ padding: '2rem', marginBottom: '2rem' }}>
          <h4>No Active Mission Currently Assigned</h4>
          <p className="muted">
            Vehicle is currently {ambulance?.status.toLowerCase()}. Incoming requests in your vicinity will appear here automatically.
          </p>
        </div>
      )}

      {/* Queued / Other Assigned Trips */}
      <div className="card queue-trips-card">
        <h4 style={{ marginBottom: '1rem' }}>Assigned & Queued Dispatches</h4>
        {queuedTrips.length === 0 ? (
          <EmptyState
            title="Dispatch queue is clear"
            message="No additional pending dispatches assigned to this vehicle."
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Patient</th>
                  <th>Pickup Location</th>
                  <th>Destination</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {queuedTrips.map((q) => (
                  <tr key={q.request_id}>
                    <td>#{q.request_id}</td>
                    <td>
                      <strong>{q.patient_name || 'Patient'}</strong>
                      {q.patient_phone && <div className="muted">{q.patient_phone}</div>}
                    </td>
                    <td>{q.pickup_location}</td>
                    <td>{q.drop_location || 'Emergency ER'}</td>
                    <td><Badge status={q.status} size="sm" /></td>
                    <td>
                      <div className="action-buttons-cell">
                        {q.status === 'REQUESTED' && (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleTripAction(q.request_id, 'ACCEPTED')}
                          >
                            Accept Dispatch
                          </Button>
                        )}
                        <Button
                          variant="danger"
                          size="sm"
                          onClick={() => handleTripAction(q.request_id, null, 'reject')}
                        >
                          Decline
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
