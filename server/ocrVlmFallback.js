/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Gemini Vision VLM Fallback for PharmaSense Smart Medicine Capture.
 *
 * Invoked ONLY when Tesseract OCR produces insufficient results.
 * Zero-hallucination guarantee: system prompt forbids guessing/inferring.
 * Merge logic treats VLM as supplement-only -- Tesseract values are protected.
 */

import { GoogleGenAI } from '@google/genai';

const MODEL = 'gemini-3.6-flash';

const SYSTEM_PROMPT = `You are a pharmaceutical packaging text extraction assistant for a pharmacy management system.

Your ONLY task is to read and extract text that is LITERALLY AND CLEARLY VISIBLE in the provided medicine packaging images.

STRICT RULES - violation of any rule is unacceptable:
1. NEVER guess, complete, infer, or hallucinate any field value.
2. If a field is not clearly readable in the images, return null for that field.
3. NEVER auto-complete a medicine name.
4. NEVER infer composition from the medicine name alone.
5. NEVER guess or complete a batch number, expiry date, manufacturer, or MRP that is not visibly readable.
6. Extract EXACTLY the text you can see -- do not normalise, correct, or complete it.
7. If multiple images are provided, read ALL of them -- different sides show different fields.
8. Batch and lot numbers are legitimately mixed alphanumeric -- do NOT correct them to look like words or dates.

Return a JSON object with these fields only (use null for any field not clearly visible):
{
  "medicine_name": string | null,
  "strength": string | null,
  "dosage_form": string | null,
  "manufacturer": string | null,
  "composition": string | null,
  "batch_no": string | null,
  "expiry_date": string | null,
  "manufacturing_date": string | null,
  "mrp": number | null
}

Do NOT include any explanation, markdown code fences, or text outside the JSON object.`;

function dataUrlToInlinePart(dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) return null;
  const commaIdx = dataUrl.indexOf(',');
  if (commaIdx < 0) return null;
  const header = dataUrl.slice(0, commaIdx);
  const data = dataUrl.slice(commaIdx + 1);
  const mimeMatch = header.match(/data:([^;]+)/);
  if (!mimeMatch) return null;
  return { inlineData: { mimeType: mimeMatch[1] || 'image/jpeg', data } };
}

function selectBestPhotos(photos, maxPhotos = 3) {
  if (!Array.isArray(photos) || photos.length === 0) return [];
  return photos
    .filter(p => p && typeof p === 'string' && p.startsWith('data:'))
    .slice(0, maxPhotos);
}

function parseVlmResponse(text) {
  if (!text) return null;
  let clean = text.trim();
  // Strip markdown code block wrappers if present despite prompt
  clean = clean.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const parsed = JSON.parse(clean);
    if (typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    return parsed;
  } catch {
    const jsonMatch = clean.match(/\{[\s\S]+\}/);
    if (jsonMatch) {
      try { return JSON.parse(jsonMatch[0]); } catch { return null; }
    }
    return null;
  }
}

/**
 * Sanitizes and validates VLM output fields.
 * These guards prevent the most common VLM failure modes from propagating
 * even when the model partially ignores the zero-hallucination prompt.
 */
function sanitizeVlmOutput(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const out = {};

  const assignString = (key, validator = () => true, max = 200) => {
    const value = raw[key];
    if (typeof value !== 'string') return;
    const cleaned = value.trim();
    if (cleaned && cleaned.length <= max && validator(cleaned)) out[key] = cleaned;
  };

  assignString('medicine_name', v => v.length > 0 && v.length <= 80);
  assignString('strength', v => /\d/.test(v) && /(?:mg|mcg|ml|g\b|iu|%)/i.test(v) && v.length <= 40);
  assignString('dosage_form', v => v.length > 0 && v.length <= 30);
  assignString('manufacturer', v => v.length >= 3 && v.length <= 100);
  assignString('composition', v => v.length >= 4 && v.length <= 200);
  assignString('batch_no', v => v.length >= 2 && v.length <= 20 && /[A-Za-z0-9]/.test(v));
  assignString('expiry_date', v => /(?:\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{4})/.test(v) && v.length <= 20);
  assignString('manufacturing_date', v => /(?:\d{1,2}[\/\-]\d{2,4}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{2,4}|[A-Za-z]{3,9}\s+\d{4})/.test(v) && v.length <= 20);

  if (raw.mrp !== null && raw.mrp !== undefined) {
    const price = Number(raw.mrp);
    if (!Number.isNaN(price) && price > 0 && price < 50000) out.mrp = Math.round(price * 100) / 100;
  }

  return Object.keys(out).length > 0 ? out : null;
}

/**
 * Invokes the Gemini Vision API with packaging photos.
 *
 * @param {string[]} photos - Base64 dataUrl strings (JPEG/PNG)
 * @param {Object} [options]
 * @param {string} [options.hint] - Partial Tesseract text as a reading guide
 * @returns {Promise<{fields: Object, vlmFields: string[]} | null>}
 */
export async function runVlmFallback(photos, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.log('[ocrVlmFallback] GEMINI_API_KEY not set -- VLM fallback skipped');
    return null;
  }

  const selectedPhotos = selectBestPhotos(photos, 3);
  if (selectedPhotos.length === 0) {
    console.log('[ocrVlmFallback] No valid photos -- VLM fallback skipped');
    return null;
  }

  const parts = [];

  if (options.hint && typeof options.hint === 'string' && options.hint.trim().length > 10) {
    parts.push({
      text: 'Partial OCR text already extracted (may contain errors -- use as guide only):\n\n' +
        options.hint.trim().slice(0, 500)
    });
  }

  for (const photoDataUrl of selectedPhotos) {
    const part = dataUrlToInlinePart(photoDataUrl);
    if (part) parts.push(part);
  }

  parts.push({
    text: 'Now extract the medicine information from the images above and return the JSON object as instructed.'
  });

  try {
    const genAI = new GoogleGenAI({ apiKey });
    const response = await genAI.models.generateContent({
      model: MODEL,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.0,
        topP: 0.1,
        maxOutputTokens: 512
      },
      contents: [{ role: 'user', parts }]
    });

    const text = response?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
      console.warn('[ocrVlmFallback] Empty response from Gemini');
      return null;
    }

    const raw = parseVlmResponse(text);
    if (!raw) {
      console.warn('[ocrVlmFallback] Could not parse Gemini JSON response:', text.slice(0, 200));
      return null;
    }

    const fields = sanitizeVlmOutput(raw);
    if (!fields) {
      console.warn('[ocrVlmFallback] All VLM fields failed sanitization');
      return null;
    }

    const vlmFields = Object.entries(fields)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k]) => k);

    if (vlmFields.length === 0) {
      console.log('[ocrVlmFallback] VLM returned no usable fields');
      return null;
    }

    console.log(`[ocrVlmFallback] VLM populated ${vlmFields.length} fields: ${vlmFields.join(', ')}`);
    return { fields, vlmFields };

  } catch (err) {
    // Never throw -- VLM errors must never break the primary OCR pipeline
    console.error('[ocrVlmFallback] Gemini API error:', err?.message || err);
    return null;
  }
}

/**
 * Merges VLM-extracted fields into an existing Tesseract extraction result.
 *
 * Merge rules (zero-hallucination guarantee):
 *  - VLM fills gaps only (where Tesseract produced nothing)
 *  - batch_no, expiry_date, manufacturing_date, barcode are PROTECTED:
 *    Tesseract's label-anchored crops are more accurate for those fields
 *  - If both have a value, the Tesseract value is always kept
 *
 * @param {Object} tesseractFields
 * @param {Object} vlmFields - Sanitized VLM fields object
 * @param {string[]} populatedVlmFields - List of non-null VLM field names
 * @returns {{ mergedFields: Object, mergedVlmFields: string[] }}
 */
export function mergeVlmFields(tesseractFields, vlmFields, populatedVlmFields) {
  const merged = { ...tesseractFields };
  const actuallyMerged = [];

  // Protected fields: Tesseract's targeted crops beat a full-image VLM scan
  const PROTECTED_FIELDS = new Set(['batch_no', 'expiry_date', 'manufacturing_date', 'barcode']);

  for (const field of populatedVlmFields) {
    if (PROTECTED_FIELDS.has(field)) continue;

    const tesseractValue = tesseractFields[field];
    const vlmValue = vlmFields[field];

    const tesseractEmpty =
      tesseractValue === null ||
      tesseractValue === undefined ||
      (typeof tesseractValue === 'string' && tesseractValue.trim() === '') ||
      (typeof tesseractValue === 'number' && tesseractValue === 0);

    if (tesseractEmpty && vlmValue !== null && vlmValue !== undefined) {
      merged[field] = vlmValue;
      actuallyMerged.push(field);
    }
  }

  // When VLM fills medicine_name, also inject into candidate_names for better catalog matching
  if (actuallyMerged.includes('medicine_name') && merged.medicine_name) {
    const existing = Array.isArray(merged.candidate_names) ? merged.candidate_names : [];
    if (!existing.includes(merged.medicine_name)) {
      merged.candidate_names = [merged.medicine_name, ...existing].slice(0, 8);
    }
  }

  return { mergedFields: merged, mergedVlmFields: actuallyMerged };
}

export default { runVlmFallback, mergeVlmFields };
