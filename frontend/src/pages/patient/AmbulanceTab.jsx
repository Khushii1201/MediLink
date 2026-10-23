import { useState, useEffect, useCallback } from 'react';
import { api } from '../../api';
import { useToast } from '../../hooks/useToast';
import { usePolling } from '../../hooks/usePolling';
import { MapView } from '../../components/MapView';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { FormField } from '../../components/FormField';
import { StatusStepper } from '../../components/StatusStepper';
import { ConfirmDialog } from '../../components/Modal';

const AMBULANCE_STEPS = [
  { label: 'Requested', description: 'Searching nearest vehicle' },
  { label: 'Accepted', description: 'Driver dispatched' },
  { label: 'En Route', description: 'Ambulance transit to pickup' },
  { label: 'Completed', description: 'Arrived at destination' },
];

function getAmbulanceStepIndex(status) {
  if (status === 'REQUESTED') return 0;
  if (status === 'ACCEPTED') return 1;
  if (status === 'EN_ROUTE') return 2;
  if (status === 'COMPLETED') return 3;
  return 0;
}

export default function AmbulanceTab({ coords, requests = [], onRefresh }) {
  const { addToast } = useToast();

  const [pickupAddress, setPickupAddress] = useState('Current GPS Location');
  const [pickupCoords, setPickupCoords] = useState({ lat: coords.lat, lng: coords.lng });
  const [dropLocation, setDropLocation] = useState('');
  const [requesting, setRequesting] = useState(false);

  // Active tracking state
  const activeRequest = requests.find((r) => ['REQUESTED', 'ACCEPTED', 'EN_ROUTE'].includes(r.status));
  const [trackingData, setTrackingData] = useState(null);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  // Sync coords from props
  useEffect(() => {
    if (coords.lat && coords.lng) {
      setPickupCoords({ lat: coords.lat, lng: coords.lng });
    }
  }, [coords.lat, coords.lng]);

  // Poll active request tracking endpoint every 5 seconds
  const fetchTracking = useCallback(async () => {
    if (!activeRequest) {
      setTrackingData(null);
      return;
    }
    try {
      const data = await api.trackAmbulance(activeRequest.request_id);
      setTrackingData(data);
    } catch (err) {
      console.error('Tracking poll error:', err);
    }
  }, [activeRequest]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  usePolling(fetchTracking, 5000, Boolean(activeRequest));

  // Click on map to select pickup location
  const handleMapClick = (latlng) => {
    setPickupCoords(latlng);
    setPickupAddress(`Selected Map Point (${latlng.lat.toFixed(4)}, ${latlng.lng.toFixed(4)})`);
    addToast('Pickup location pinned on map', 'info', 2000);
  };

  const handleRequestSubmit = async (e) => {
    e.preventDefault();
    if (!pickupAddress.trim()) {
      addToast('Please specify a pickup location', 'error');
      return;
    }

    setRequesting(true);
    try {
      await api.requestAmbulance({
        pickup_location: pickupAddress.trim(),
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        drop_location: dropLocation.trim() || undefined,
      });
      addToast('Ambulance requested! Dispatch system searching nearest unit...', 'success');
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to request ambulance', 'error');
    } finally {
      setRequesting(false);
    }
  };

  const handleCancelRequest = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    try {
      await api.cancelAmbulanceRequest(cancelTarget.request_id);
      addToast('Ambulance request cancelled', 'success');
      setCancelTarget(null);
      onRefresh();
    } catch (err) {
      addToast(err.message || 'Failed to cancel request', 'error');
    } finally {
      setCancelling(false);
    }
  };

  // Build live map markers
  const trackingMarkers = [];
  let routeLine = null;

  if (activeRequest) {
    if (activeRequest.pickup_lat && activeRequest.pickup_lng) {
      trackingMarkers.push({
        id: 'pickup',
        lat: activeRequest.pickup_lat,
        lng: activeRequest.pickup_lng,
        iconType: 'PATIENT',
        popup: <strong>Pickup: {activeRequest.pickup_location}</strong>,
      });
    }

    const amb = trackingData?.ambulance;
    if (amb?.latitude && amb?.longitude) {
      trackingMarkers.push({
        id: 'ambulance',
        lat: amb.latitude,
        lng: amb.longitude,
        iconType: 'AMBULANCE',
        popup: (
          <div>
            <strong>Ambulance {amb.vehicle_no}</strong>
            <p className="muted" style={{ margin: '0.25rem 0' }}>Driver: {amb.driver_name || 'Assigned'}</p>
          </div>
        ),
      });

      if (activeRequest.pickup_lat && activeRequest.pickup_lng) {
        routeLine = [
          [amb.latitude, amb.longitude],
          [activeRequest.pickup_lat, activeRequest.pickup_lng],
        ];
      }
    }
  } else {
    // Show marker for chosen pickup location
    trackingMarkers.push({
      id: 'target-pickup',
      lat: pickupCoords.lat,
      lng: pickupCoords.lng,
      iconType: 'PATIENT',
      popup: <strong>Chosen Pickup Point</strong>,
    });
  }

  const mapCenter = trackingMarkers[0] ? [trackingMarkers[0].lat, trackingMarkers[0].lng] : [coords.lat, coords.lng];

  return (
    <div className="tab-pane ambulance-tab">
      {/* Active Trip Tracking Card */}
      {activeRequest ? (
        <div className="card active-trip-card">
          <div className="active-trip-header">
            <div>
              <span className="badge badge-info" style={{ marginBottom: '0.5rem' }}>Active Dispatch</span>
              <h3>Emergency Ambulance Tracking</h3>
              <p className="muted">Request #{activeRequest.request_id} · Assigned to live fleet</p>
            </div>
            <div className="active-trip-actions">
              <Badge status={activeRequest.status} size="lg" />
              {['REQUESTED', 'ACCEPTED'].includes(activeRequest.status) && (
                <Button variant="outline" size="sm" onClick={() => setCancelTarget(activeRequest)}>
                  Cancel Request
                </Button>
              )}
            </div>
          </div>

          <div className="active-trip-stepper-wrap">
            <StatusStepper
              steps={AMBULANCE_STEPS}
              currentStepIndex={getAmbulanceStepIndex(activeRequest.status)}
              isCancelled={activeRequest.status === 'CANCELLED'}
            />
          </div>

          <div className="active-trip-grid">
            <div className="trip-map-col">
              <MapView
                center={mapCenter}
                zoom={13}
                markers={trackingMarkers}
                routeLine={routeLine}
                height="380px"
                autoFit={trackingMarkers.length > 1}
              />
            </div>

            <div className="trip-info-col">
              {trackingData?.ambulance ? (
                <div className="vehicle-details-box">
                  <div className="vehicle-badge-row">
                    <div>
                      <h4 className="vehicle-no">{trackingData.ambulance.vehicle_no}</h4>
                      <p className="muted">Driver: {trackingData.ambulance.driver_name || 'Duty Operator'}</p>
                    </div>
                  </div>

                  {trackingData.ambulance.driver_phone && (
                    <div className="driver-phone-bar">
                      <span>Driver Contact:</span>
                      <a href={`tel:${trackingData.ambulance.driver_phone}`} className="phone-link">
                        {trackingData.ambulance.driver_phone}
                      </a>
                    </div>
                  )}

                  <div className="eta-highlight-box">
                    <span className="eta-label">Estimated Transit Time</span>
                    <strong className="eta-value">
                      {trackingData.eta_minutes !== null ? `~${trackingData.eta_minutes} mins` : 'Calculating...'}
                    </strong>
                    {trackingData.distance_remaining_km !== null && (
                      <span className="eta-dist">
                        ({trackingData.distance_remaining_km} km remaining)
                      </span>
                    )}
                    <p className="eta-disclaimer">{trackingData.eta_label}</p>
                  </div>
                </div>
              ) : (
                <div className="queued-state-box">
                  <h4>Dispatch in Queue</h4>
                  <p className="muted">
                    Your request is in high-priority dispatch. Assigning the nearest free emergency vehicle as soon as one clears.
                  </p>
                </div>
              )}

              <div className="trip-locations-list">
                <div className="loc-item">
                  <div>
                    <strong>Pickup Point:</strong>
                    <p className="muted">{activeRequest.pickup_location}</p>
                  </div>
                </div>
                {activeRequest.drop_location && (
                  <div className="loc-item">
                    <div>
                      <strong>Destination:</strong>
                      <p className="muted">{activeRequest.drop_location}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* New Request Form Card */
        <div className="card new-ambulance-card">
          <div className="card-header">
            <div>
              <h3 className="card-title">Request Nearest Emergency Ambulance</h3>
              <p className="card-subtitle">
                System calculates Haversine distance across the city and automatically dispatches the closest active ambulance.
              </p>
            </div>
          </div>

          <form onSubmit={handleRequestSubmit} className="ambulance-request-form">
            <div className="form-split-grid">
              <div className="form-inputs-col">
                <FormField
                  label="Pickup Address / Landmark"
                  id="amb-pickup"
                  required
                  hint="Type your street address or click anywhere on the map to pin precise coordinates"
                >
                  <input
                    type="text"
                    id="amb-pickup"
                    className="form-input"
                    placeholder="Enter pickup address, building, or landmark..."
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    required
                  />
                </FormField>

                <FormField
                  label="Destination / Hospital (Optional)"
                  id="amb-drop"
                  hint="Specify intended hospital or destination"
                >
                  <input
                    type="text"
                    id="amb-drop"
                    className="form-input"
                    placeholder="e.g. SMS Hospital Trauma Ward, Fortis Escorts Emergency..."
                    value={dropLocation}
                    onChange={(e) => setDropLocation(e.target.value)}
                  />
                </FormField>

                <div className="picked-coords-box">
                  <span className="muted">Pinned Coordinates:</span>{' '}
                  <code>{pickupCoords.lat.toFixed(5)}, {pickupCoords.lng.toFixed(5)}</code>
                </div>

                <Button
                  variant="danger"
                  size="lg"
                  type="submit"
                  loading={requesting}
                  className="full-width"
                  style={{ marginTop: '1rem' }}
                >
                  <span>Request Emergency Ambulance</span>
                </Button>
              </div>

              <div className="form-map-col">
                <span className="map-picker-hint">Click on map to select pickup coordinates:</span>
                <MapView
                  center={[pickupCoords.lat, pickupCoords.lng]}
                  zoom={12}
                  markers={trackingMarkers}
                  onMapClick={handleMapClick}
                  height="300px"
                />
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Past Requests History */}
      <div className="card past-trips-card" style={{ marginTop: '2rem' }}>
        <h4 style={{ marginBottom: '1rem' }}>Past Ambulance Requests</h4>
        {requests.length === 0 ? (
          <p className="muted">No past ambulance requests recorded.</p>
        ) : (
          <div className="past-trips-table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Request ID</th>
                  <th>Date & Time</th>
                  <th>Pickup Location</th>
                  <th>Vehicle Number</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {requests.map((r) => (
                  <tr key={r.request_id}>
                    <td>#{r.request_id}</td>
                    <td>{new Date(r.created_at).toLocaleString()}</td>
                    <td>{r.pickup_location}</td>
                    <td>{r.ambulance?.vehicle_no || 'Unassigned'}</td>
                    <td><Badge status={r.status} size="sm" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancelRequest}
        title="Cancel Ambulance Dispatch"
        message="Are you sure you want to cancel this ambulance dispatch request?"
        confirmText="Yes, Cancel Dispatch"
        loading={cancelling}
      />
    </div>
  );
}
