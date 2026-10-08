import test from 'node:test';
import assert from 'node:assert/strict';
import { identifyMedicine, extractMedicineFields } from './medicineSearch.js';
import { mergeVlmFields } from './ocrVlmFallback.js';

test('identifyMedicine reports VLM metadata and unknown medicine flags', async () => {
  const result = await identifyMedicine('Augmentin 625 Duo', [], {}, [], '', { photos: ['data:image/png;base64,AAAA'] });

  assert.equal(typeof result.vlmUsed, 'boolean');
  assert.ok(Array.isArray(result.vlmFields));
  assert.equal(typeof result.medicineFoundInDatabase, 'boolean');
  assert.equal(typeof result.requiresVerification, 'boolean');
});

test('Gemini merge protects reliable Tesseract values', () => {
  const tesseract = {
    medicine_name: 'Augmentin 625 Duo',
    expiry_date: '08/2028',
    manufacturer: 'GSK',
    composition: '',
  };
  const vlm = {
    medicine_name: 'Augmentin 625',
    expiry_date: '08/2026',
    manufacturer: 'GSK',
    composition: 'Amoxicillin + Clavulanic acid',
  };

  const merged = mergeVlmFields(tesseract, vlm, ['medicine_name', 'expiry_date', 'manufacturer', 'composition']);

  assert.equal(merged.mergedFields.medicine_name, 'Augmentin 625 Duo');
  assert.equal(merged.mergedFields.expiry_date, '08/2028');
  assert.equal(merged.mergedFields.composition, 'Amoxicillin + Clavulanic acid');
  assert.ok(merged.mergedVlmFields.includes('composition'));
});

test('field extraction keeps the core medicine keys available', () => {
  const fields = extractMedicineFields('AUGMENTIN 625 Duo\nMFG: GSK\nEXP: 08/2028\nMRP: 235.00');

  assert.ok(fields.medicine_name || fields.brand_name || fields.candidate_names?.length);
  assert.ok(fields.expiry_date || fields.mfg || fields.manufacturing_date || fields.batch_no || fields.mrp >= 0);
});
