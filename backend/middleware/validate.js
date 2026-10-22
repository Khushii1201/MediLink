function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

function isValidCoordinate(lat, lng) {
  if (lat === null || lat === undefined || lng === null || lng === undefined) return false;
  const nLat = Number(lat);
  const nLng = Number(lng);
  if (isNaN(nLat) || isNaN(nLng)) return false;
  return nLat >= -90 && nLat <= 90 && nLng >= -180 && nLng <= 180;
}

function isValidPhone(phone) {
  if (!phone) return true;
  const str = String(phone).trim();
  // Allow digits, +, -, and spaces, 7 to 15 characters
  return /^[+]?[\d\s-]{7,15}$/.test(str);
}

function isNonNegativeInt(val) {
  if (val === null || val === undefined) return false;
  const num = Number(val);
  return Number.isInteger(num) && num >= 0;
}

function isPositiveInt(val) {
  if (val === null || val === undefined) return false;
  const num = Number(val);
  return Number.isInteger(num) && num > 0;
}

module.exports = {
  isValidEmail,
  isValidCoordinate,
  isValidPhone,
  isNonNegativeInt,
  isPositiveInt,
};
