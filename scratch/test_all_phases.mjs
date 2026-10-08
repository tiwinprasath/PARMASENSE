/**
 * Automated Test Suite for PharmaSense OCR + Medicine Identification
 * Validates Phase 2 through Phase 30 requirements.
 */

import { identifyMedicine, extractMedicineFields, ensureIndexed } from '../server/medicineSearch.js';

async function runTests() {
  console.log('====================================================');
  console.log('   PHARMASENSE OCR & IDENTIFICATION TEST SUITE');
  console.log('====================================================\n');

  console.log('Initializing medicine search database...');
  await ensureIndexed();
  console.log('Database ready.\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`  [PASS] ${testName}${details ? ' — ' + details : ''}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${testName}${details ? ' — ' + details : ''}`);
      failed++;
    }
  }

  // identifyMedicine signature:
  // identifyMedicine(combinedText, existingMedicines = [], textBySource = {}, ocrEvidence = [], barcode = '')

  // --- TEST 1: Clear medicine box front ---
  console.log('\n--- TEST 1: Clear medicine box front ---');
  const t1 = await identifyMedicine('Augmentin 625 Duo Tablet GlaxoSmithKline Pharmaceuticals');
  assert(t1.identified === true, 'Augmentin 625 Duo identified', `matched: ${t1.matchedMedicine?.name}, conf: ${t1.confidence}%`);
  assert(t1.extractedFields?.strength?.includes('625'), 'Strength 625 extracted', t1.extractedFields?.strength);

  // --- TEST 2: Box front + back multi-source fusion ---
  console.log('\n--- TEST 2: Box front + back fusion ---');
  const t2 = await identifyMedicine(
    'Augmentin 625 Duo\nAmoxycillin 500mg Clavulanic Acid 125mg GlaxoSmithKline',
    [],
    {
      front: 'Augmentin 625 Duo',
      back: 'Amoxycillin 500mg + Clavulanic Acid 125mg\nManufactured by GlaxoSmithKline'
    }
  );
  assert(t2.identified === true, 'Fused front+back identifies Augmentin', `matched: ${t2.matchedMedicine?.name}`);
  const hasComposition = (t2.extractedFields?.composition || t2.matchedMedicine?.composition || '').toLowerCase();
  assert(hasComposition.includes('amox'), 'Amoxycillin composition recognized', hasComposition.slice(0, 50));

  // --- TEST 3: Box front + back + side (3 angles) with package data ---
  console.log('\n--- TEST 3: Box front + back + side (3 angles) ---');
  const t3 = await identifyMedicine(
    'Augmentin 625 Duo Tablets\nAmoxycillin and Potassium Clavulanate GlaxoSmithKline B.No. AUG789 MFG. 03/2025 EXP. 02/2027 MRP Rs. 223.50',
    [],
    {
      front: 'Augmentin 625 Duo Tablets',
      back: 'Manufactured by GlaxoSmithKline Pharmaceuticals Ltd\nAmoxycillin and Potassium Clavulanate',
      side: 'B.No. AUG789\nMFG. 03/2025\nEXP. 02/2027\nMRP Rs. 223.50 incl of all taxes'
    }
  );
  assert(t3.identified === true, 'Single medicine result from 3 angles', `matched: ${t3.matchedMedicine?.name}`);
  assert(t3.packageFields?.batch_no === 'AUG789', 'Batch extracted to packageFields', t3.packageFields?.batch_no);
  assert(t3.packageFields?.expiry_date === '02/2027', 'Expiry extracted to packageFields', t3.packageFields?.expiry_date);
  assert(Number(t3.packageFields?.mrp) === 223.5, 'MRP extracted to packageFields', `₹${t3.packageFields?.mrp}`);

  // --- TEST 4: Strip front + strip back ---
  console.log('\n--- TEST 4: Strip front + strip back ---');
  const t4 = await identifyMedicine(
    'Cefix 200 Tablet\nCefixime Tablets IP 200mg\nBatch No CFX991\nMFG 09/2025 EXP 08/2027\nMRP Rs. 110.00',
    [],
    {
      'strip-front': 'Cefix 200 Tablet 10 Tablets',
      'strip-back': 'Cefixime Dispersible Tablets IP 200mg\nBatch No. CFX991\nMFG 09/2025 EXP 08/2027\nMRP Rs. 110.00'
    }
  );
  assert(
    t4.identified === true || (t4.extractedFields?.medicine_name?.length > 0),
    'Strip evidence produces meaningful result',
    `medicine_name: ${t4.extractedFields?.medicine_name}, identified: ${t4.identified}`
  );
  assert(t4.packageFields?.batch_no === 'CFX991', 'Strip foil batch extracted', t4.packageFields?.batch_no);
  assert(Number(t4.packageFields?.mrp) === 110, 'Strip foil MRP extracted', `₹${t4.packageFields?.mrp}`);

  // --- TEST 5: Box front + strip back (mixed) ---
  console.log('\n--- TEST 5: Box front + strip back (mixed) ---');
  const t5 = await identifyMedicine(
    'Dolo 650 Tablet Micro Labs Limited\nParacetamol Tablets IP 650mg\nB.No. DL8831 EXP. 11/2026 MRP Rs. 34.00',
    [],
    {
      front: 'Dolo 650 Tablet\nMicro Labs Limited',
      'strip-back': 'B.No. DL8831\nEXP. 11/2026\nM.R.P. Rs. 34.00'
    }
  );
  assert(t5.identified === true, 'Dolo 650 identified from box+strip evidence', t5.matchedMedicine?.name);
  assert(t5.packageFields?.batch_no === 'DL8831', 'Batch isolated to packageFields', t5.packageFields?.batch_no);

  // --- TEST 6: Only strip back (foil only, no brand) ---
  console.log('\n--- TEST 6: Strip back only (foil only) ---');
  const t6 = await identifyMedicine(
    'Batch No. BT4412\nMFG DATE 01/2025\nEXP DATE 12/2027\nM.R.P. Rs. 85.00',
    [],
    { 'strip-back': 'Batch No. BT4412\nMFG DATE 01/2025\nEXP DATE 12/2027\nM.R.P. Rs. 85.00' }
  );
  assert(t6.packageFields?.batch_no === 'BT4412', 'Batch extracted without brand name', t6.packageFields?.batch_no);
  assert(t6.packageFields?.expiry_date === '12/2027', 'Expiry extracted without brand name', t6.packageFields?.expiry_date);
  assert(Number(t6.packageFields?.mrp) === 85, 'MRP extracted without brand name', `₹${t6.packageFields?.mrp}`);
  assert(t6.matchType === 'not_found' || t6.askVerification === true, 'Correctly requires verification (no brand)', `matchType: ${t6.matchType}`);

  // --- TEST 7: Unknown medicine (NOT in catalog) ---
  console.log('\n--- TEST 7: Unknown / Not-in-catalog medicine ---');
  const t7 = await identifyMedicine('Zorblaxin 999 Forte Tablet PharmaNova Labs Batch Z99 EXP 09/2028 MRP 450.00');
  assert(t7.matchType === 'not_found', 'matchType is not_found for unknown medicine', t7.matchType);
  assert(t7.identified === false, 'identified is false', `${t7.identified}`);
  assert(t7.askVerification === true, 'askVerification is true');

  // --- TEST 8: Poor image / noisy text ---
  console.log('\n--- TEST 8: Poor image / gibberish text ---');
  const t8 = await identifyMedicine('&&@!# %%% ### ~~~ ===');
  assert(t8.identified === false, 'Gibberish text → not identified', `${t8.identified}`);
  assert(t8.matchType === 'not_found', 'matchType is not_found for gibberish', t8.matchType);

  // --- TEST 9: Multiple candidate matches ---
  console.log('\n--- TEST 9: Multiple candidate matches ---');
  const t9 = await identifyMedicine('Augmentin Duo');
  assert(Array.isArray(t9.candidates) && t9.candidates.length > 0, 'Returns non-empty candidates list', `count: ${t9.candidates?.length}`);

  // --- TEST 10: Barcode integration (barcode preserved in packageFields) ---
  console.log('\n--- TEST 10: Barcode integration ---');
  const t10 = await identifyMedicine(
    'Augmentin 625 Duo Tablet',
    [],
    {},
    [],
    '8901117001234'
  );
  assert(t10.identified === true, 'Barcode-assisted identification works', t10.matchedMedicine?.name);
  assert(t10.packageFields?.barcode === '8901117001234', 'Barcode preserved in packageFields', t10.packageFields?.barcode);

  // --- TEST 11: Strength conflict detection ---
  console.log('\n--- TEST 11: Strength conflict detection ---');
  const t11 = await identifyMedicine('Augmentin Tablet Amoxicillin 250mg Clavulanic Acid 125mg');
  // Either extracts strength 250mg, or warns about a conflict
  assert(
    t11.extractedFields?.strength?.includes('250') || (t11.verificationWarnings?.length > 0),
    'Strength 250mg recognized or conflict warned',
    `strength: ${t11.extractedFields?.strength}, warnings: ${t11.verificationWarnings?.join('; ')}`
  );

  // --- TEST 12: Empty text → manual entry fallback ---
  console.log('\n--- TEST 12: Empty OCR text (manual entry fallback) ---');
  try {
    const t12 = await identifyMedicine('');
    // Should return a safe "not found" result, not throw
    assert(t12.identified === false, 'Empty text → identified=false', `${t12.identified}`);
    assert(t12.matchType === 'not_found', 'Empty text → not_found matchType', t12.matchType);
  } catch (err12) {
    // Server-side rejects empty text with 400 — acceptable; we test the function directly here
    assert(false, 'Empty text threw unexpectedly', String(err12));
  }

  // --- Package vs Catalog Separation ---
  console.log('\n--- TEST 13: Package vs Catalog field separation ---');
  const t13 = await identifyMedicine(
    'Augmentin 625 Duo Tablet GlaxoSmithKline B.No. XAUG22 EXP 05/2028 MRP Rs. 245.00',
    [],
    { front: 'Augmentin 625 Duo Tablet', side: 'B.No. XAUG22 EXP 05/2028 MRP Rs. 245.00' }
  );
  assert(typeof t13.packageFields === 'object', 'packageFields object present', JSON.stringify(t13.packageFields).slice(0, 80));
  assert(typeof t13.catalogFields === 'object' || t13.identified === false, 'catalogFields or not_found when identified', `catalogFields: ${!!t13.catalogFields}`);
  assert(t13.packageFields?.batch_no === 'XAUG22', 'Batch in packageFields, not overwritten by catalog', t13.packageFields?.batch_no);
  assert(Number(t13.packageFields?.mrp) === 245, 'Package MRP preserved separately from catalog price', `₹${t13.packageFields?.mrp}`);

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED  ${failed} FAILED  (Total: ${passed + failed})`);
  console.log('====================================================');

  if (failed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('\nFatal test runner error:', err.message || err);
  process.exit(1);
});
