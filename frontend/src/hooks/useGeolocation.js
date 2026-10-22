import { useState, useEffect, useCallback } from 'react';

const DEFAULT_DELHI_COORDS = { lat: 28.6139, lng: 77.2090 };

export function useGeolocation(autoFetch = true) {
  const [coords, setCoords] = useState(DEFAULT_DELHI_COORDS);
  const [hasUserLocation, setHasUserLocation] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setHasUserLocation(true);
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message || 'Location permission denied');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }, []);

  useEffect(() => {
    if (autoFetch) {
      requestLocation();
    }
  }, [autoFetch, requestLocation]);

  return { coords, hasUserLocation, error, loading, requestLocation };
}
