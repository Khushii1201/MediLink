// Haversine distance calculation in kilometers
function distanceKm(lat1, lon1, lat2, lon2) {
  if ([lat1, lon1, lat2, lon2].some(v => v === null || v === undefined || isNaN(Number(v)))) {
    return null;
  }
  const nLat1 = Number(lat1);
  const nLon1 = Number(lon1);
  const nLat2 = Number(lat2);
  const nLon2 = Number(lon2);

  if (
    nLat1 < -90 || nLat1 > 90 ||
    nLat2 < -90 || nLat2 > 90 ||
    nLon1 < -180 || nLon1 > 180 ||
    nLon2 < -180 || nLon2 > 180
  ) {
    return null;
  }

  const R = 6371; // Earth's radius in km
  const dLat = (nLat2 - nLat1) * Math.PI / 180;
  const dLon = (nLon2 - nLon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(nLat1 * Math.PI / 180) *
    Math.cos(nLat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round((R * c) * 10) / 10;
}

module.exports = { distanceKm };
