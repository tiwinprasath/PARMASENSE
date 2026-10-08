const NUMERIC_FORMATS = new Set(['EAN_13', 'EAN_8', 'UPC_A', 'UPC_E', 'ITF']);
const SUPPORTED_FORMATS = new Set([
  'EAN_13',
  'EAN_8',
  'UPC_A',
  'UPC_E',
  'CODE_128',
  'CODE_39',
  'ITF',
  'QR_CODE',
  'DATA_MATRIX'
]);

function normalizeFormat(format, code) {
  const value = String(format || '').trim().toUpperCase().replace(/[ -]+/g, '_');
  const aliases = {
    EAN13: 'EAN_13',
    EAN8: 'EAN_8',
    UPCA: 'UPC_A',
    UPCE: 'UPC_E',
    CODE128: 'CODE_128',
    CODE39: 'CODE_39',
    QRCODE: 'QR_CODE',
    QR: 'QR_CODE',
    DATAMATRIX: 'DATA_MATRIX'
  };
  if (SUPPORTED_FORMATS.has(value)) return value;
  if (aliases[value]) return aliases[value];
  if (/^\d{13}$/.test(code)) return 'EAN_13';
  if (/^\d{12}$/.test(code)) return 'UPC_A';
  if (/^\d{8}$/.test(code)) return 'EAN_8';
  return value || 'UNKNOWN';
}

function isValidCheckDigit(code) {
  const digits = code.split('').map(Number);
  const check = digits.pop();
  const sum = digits.reverse().reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

function validateCode(code, format) {
  if (!code) return 'Code is empty.';
  if (!SUPPORTED_FORMATS.has(format)) return `Unsupported barcode format: ${format}.`;
  if (NUMERIC_FORMATS.has(format) && !/^\d+$/.test(code)) return 'This barcode format must contain digits only.';
  const lengths = { EAN_13: 13, EAN_8: 8, UPC_A: 12, UPC_E: 8 };
  if (lengths[format] && code.length !== lengths[format]) return `${format} must contain ${lengths[format]} digits.`;
  if (format === 'CODE_39' && !/^[0-9A-Z .$/+%_-]+$/i.test(code)) return 'Invalid Code 39 characters.';
  if (format === 'EAN_13' || format === 'EAN_8' || format === 'UPC_A') {
    if (!isValidCheckDigit(code)) return 'Invalid barcode check digit.';
  }
  return null;
}

function parseQrPayload(code) {
  const trimmed = code.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
  try {
    const value = JSON.parse(trimmed);
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    return {
      productCode: String(value.gtin || value.ean || value.upc || value.product_code || value.code || '').trim(),
      batch: String(value.batch || value.batch_no || '').trim(),
      manufacturingDate: String(value.manufacturing_date || value.mfg || '').trim(),
      expiryDate: String(value.expiry_date || value.expiry || value.exp || '').trim()
    };
  } catch {
    return null;
  }
}

function projectMedicine(medicine, barcode, format) {
  return {
    id: medicine.id,
    name: medicine.name,
    manufacturer: medicine.manufacturer || medicine.manufacturer_name || '',
    composition: medicine.composition || medicine.salt_composition || medicine.genericName || '',
    price: Number(medicine.price ?? medicine.mrp ?? 0),
    description: medicine.description || medicine.medicine_desc || '',
    barcode,
    format
  };
}

export function lookupBarcode({ code, format }, state) {
  const normalizedCode = String(code || '').trim();
  const normalizedFormat = normalizeFormat(format, normalizedCode);
  const validationError = validateCode(normalizedCode, normalizedFormat);
  if (validationError) return { success: false, matched: false, code: normalizedCode, format: normalizedFormat, error: validationError };

  const qr = normalizedFormat === 'QR_CODE' ? parseQrPayload(normalizedCode) : null;
  const lookupCode = qr?.productCode || normalizedCode;
  const mappings = Array.isArray(state?.medicineBarcodes) ? state.medicineBarcodes : [];
  const medicines = Array.isArray(state?.medicines) ? state.medicines : [];
  const matches = [];

  for (const mapping of mappings) {
    if (String(mapping.code || '').trim() !== lookupCode) continue;
    const medicine = medicines.find(item => String(item.id) === String(mapping.medicineId));
    if (medicine) matches.push(projectMedicine(medicine, normalizedCode, normalizedFormat));
  }

  for (const medicine of medicines) {
    const candidate = medicine.barcode || medicine.barcode_number || medicine.ean || medicine.upc || medicine.gtin || medicine.qr_code || medicine.product_code;
    if (candidate && String(candidate).trim() === lookupCode) {
      matches.push(projectMedicine(medicine, normalizedCode, normalizedFormat));
    }
  }

  const uniqueMatches = [...new Map(matches.map(item => [String(item.id), item])).values()];
  const packageFields = qr ? {
    batch: qr.batch || '',
    manufacturingDate: qr.manufacturingDate || '',
    expiryDate: qr.expiryDate || ''
  } : { batch: '', manufacturingDate: '', expiryDate: '' };

  if (uniqueMatches.length === 0) {
    return {
      success: true,
      matched: false,
      code: normalizedCode,
      format: normalizedFormat,
      confidence: 0,
      medicine: null,
      matches: [],
      packageFields,
      qrData: normalizedFormat === 'QR_CODE' ? { isStructured: Boolean(qr), isUrl: /^https?:\/\//i.test(normalizedCode), displayValue: normalizedCode.slice(0, 240) } : null,
      message: 'Medicine not found in PharmaSense database.'
    };
  }

  return {
    success: true,
    matched: true,
    code: normalizedCode,
    format: normalizedFormat,
    confidence: uniqueMatches.length === 1 ? 1 : 0.85,
    medicine: uniqueMatches[0],
    matches: uniqueMatches,
    packageFields
  };
}

export { normalizeFormat, validateCode, parseQrPayload };
