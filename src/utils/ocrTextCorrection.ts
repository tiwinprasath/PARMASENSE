/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * OCR text post-processing for pharmaceutical packaging.
 * PharmaSense Platform
 *
 * Pure functions only (no DOM / no canvas) so this module can be unit tested
 * and reused by any OCR consumer.
 *
 * Design rule: corrections are *conservative and context-scoped*. We only
 * rewrite a character when the surrounding context makes the intended
 * character class unambiguous. We never invent, complete, or guess a value
 * that the OCR engine did not actually read.
 */

export interface OcrWordLike {
  text: string;
  confidence: number;
  bbox?: { x0: number; y0: number; x1: number; y1: number };
}

/* ------------------------------------------------------------------ *
 * 1. Line reconstruction
 * ------------------------------------------------------------------ */

/**
 * Tesseract word output is a flat list. Joining it with spaces destroys the
 * line structure that pharmaceutical labels depend on ("B.No: X" and
 * "EXP: 03/2026" must not merge into one run-on line, or label->value
 * association is lost).
 *
 * We cluster words into visual lines using their vertical centres, then order
 * each line left-to-right. Falls back to the engine's own text when bboxes
 * are unavailable.
 */
export function groupWordsIntoLines(words: OcrWordLike[], fallbackText = ''): string {
  const usable = words.filter(w => w.bbox && String(w.text || '').trim().length > 0);
  if (usable.length === 0) return String(fallbackText || '').trim();

  // Typical glyph height drives the clustering tolerance.
  const heights = usable
    .map(w => (w.bbox!.y1 - w.bbox!.y0))
    .filter(h => h > 0)
    .sort((a, b) => a - b);
  const medianHeight = heights.length ? heights[Math.floor(heights.length / 2)] : 12;
  const tolerance = Math.max(4, medianHeight * 0.6);

  const sorted = [...usable].sort((a, b) => {
    const ay = (a.bbox!.y0 + a.bbox!.y1) / 2;
    const by = (b.bbox!.y0 + b.bbox!.y1) / 2;
    return ay - by;
  });

  const lines: Array<{ centre: number; words: OcrWordLike[] }> = [];
  for (const word of sorted) {
    const centre = (word.bbox!.y0 + word.bbox!.y1) / 2;
    const target = lines.find(l => Math.abs(l.centre - centre) <= tolerance);
    if (target) {
      target.words.push(word);
      // Running mean keeps the cluster centre stable as it grows.
      target.centre = target.words.reduce(
        (s, w) => s + (w.bbox!.y0 + w.bbox!.y1) / 2, 0
      ) / target.words.length;
    } else {
      lines.push({ centre, words: [word] });
    }
  }

  return lines
    .sort((a, b) => a.centre - b.centre)
    .map(l =>
      l.words
        .sort((a, b) => a.bbox!.x0 - b.bbox!.x0)
        .map(w => String(w.text).trim())
        .filter(Boolean)
        .join(' ')
        .trim()
    )
    .filter(Boolean)
    .join('\n');
}

/* ------------------------------------------------------------------ *
 * 2. Context detection
 * ------------------------------------------------------------------ */

/** Batch/lot values are *genuinely* mixed alphanumeric - never "fix" them. */
export const BATCH_LABEL = /\b(?:B\s*\.?\s*(?:NO|N)\b|BATCH|LOT\s*(?:NO)?|B\/?No|BN)\b/i;
export const DATE_LABEL = /\b(?:EXP|EXPY|EXPIRY|EXP\.?\s*DT|MFG|MFD|MFG\.?\s*DT|MANUFACTURED|USE\s*BEFORE|BEST\s*BEFORE)\b/i;
export const PRICE_LABEL = /\b(?:MRP|M\.?\s*R\.?\s*P|RS|INR|PRICE|₹)\b/i;

const KNOWN_UNITS = new Set([
  'mg', 'mcg', 'ml', 'g', 'gm', 'iu', 'mgs', 'kg', 'l', 'ml.', 'mgm'
]);

/** Common misreadings of dosage units, keyed by the mangled form. */
const UNIT_FIXES: Array<[RegExp, string]> = [
  [/^(?:rng|rrg|mq|m9|rnq|nng|rng\.)$/i, 'mg'],
  [/^(?:rncg|mcq|rnceg|rncq|mcq\.)$/i, 'mcg'],
  [/^(?:rnl|nl|rrl|m1|ml\.)$/i, 'ml'],
  [/^(?:1u|lu|iu\.|1\.u|l\.u)$/i, 'IU'],
  [/^(?:grn|qm|q)$/i, 'gm'],
];

/* ------------------------------------------------------------------ *
 * 3. Character class maps
 * ------------------------------------------------------------------ */

// High-precision pairs only. Anything ambiguous is deliberately excluded.
const ALPHA_TO_DIGIT_SAFE: Record<string, string> = {
  O: '0', o: '0',
  I: '1', l: '1', i: '1', '|': '1',
  S: '5', s: '5',
  B: '8',
  Z: '2', z: '2',
};

// Only used when a token is already overwhelmingly numeric.
const ALPHA_TO_DIGIT_STRICT: Record<string, string> = {
  ...ALPHA_TO_DIGIT_SAFE,
  G: '6',
  T: '7',
  A: '4',
  D: '0',
  Q: '0',
};

const DIGIT_TO_ALPHA_UPPER: Record<string, string> = {
  '0': 'O', '1': 'I', '5': 'S', '8': 'B',
};

const DIGIT_TO_ALPHA_LOWER: Record<string, string> = {
  '0': 'o', '1': 'l', '5': 's', '8': 'b',
};

const isAlpha = (ch: string) => /[A-Za-z]/.test(ch);
const isDigit = (ch: string) => /[0-9]/.test(ch);
const isUpper = (ch: string) => /[A-Z]/.test(ch);

/** Rewrites every convertible character to a digit. */
function digitize(token: string, strict = false): string {
  const map = strict ? ALPHA_TO_DIGIT_STRICT : ALPHA_TO_DIGIT_SAFE;
  return token
    .split('')
    .map(ch => (map[ch] !== undefined ? map[ch] : ch))
    .join('');
}

/** Fraction of characters that are already digits (ignoring separators). */
function digitRatio(token: string): number {
  const core = token.replace(/[^A-Za-z0-9]/g, '');
  if (!core.length) return 0;
  return core.split('').filter(isDigit).length / core.length;
}

/* ------------------------------------------------------------------ *
 * 4. Token-level correction
 * ------------------------------------------------------------------ */

/**
 * A digit sandwiched between two letters is almost certainly a misread
 * letter ("PARACETAM0L"), and a letter sandwiched between two digits is
 * almost certainly a misread digit ("2O26"). Both rules are high precision
 * because genuine pharma alphanumerics put their digits at a token *edge*
 * ("B12", "D3", "PAN 40"), never flanked on both sides.
 */
function fixFlankedCharacters(token: string): string {
  const chars = token.split('');
  for (let i = 1; i < chars.length - 1; i++) {
    const prev = chars[i - 1];
    const next = chars[i + 1];
    const cur = chars[i];

    if (isDigit(cur) && isAlpha(prev) && isAlpha(next)) {
      const useUpper = isUpper(prev) || isUpper(next);
      const map = useUpper ? DIGIT_TO_ALPHA_UPPER : DIGIT_TO_ALPHA_LOWER;
      if (map[cur] !== undefined) chars[i] = map[cur];
    } else if (isAlpha(cur) && isDigit(prev) && isDigit(next)) {
      if (ALPHA_TO_DIGIT_SAFE[cur] !== undefined) chars[i] = ALPHA_TO_DIGIT_SAFE[cur];
    }
  }
  return chars.join('');
}

/**
 * A leading digit on an otherwise fully alphabetic word ("5ODIUM",
 * "1BUPROFEN") is a misread letter. Guarded so that genuine "500mg" style
 * measurements are never touched.
 */
function fixLeadingDigitWord(token: string): string {
  const m = token.match(/^([0-9])([A-Za-z]{3,})([^A-Za-z0-9]*)$/);
  if (!m) return token;
  const [, digit, rest, trail] = m;
  if (KNOWN_UNITS.has(rest.toLowerCase())) return token;
  // "5OOmg" is a measurement, not a word beginning with S.
  for (let len = Math.min(4, rest.length); len >= 1; len--) {
    if (canonicalUnit(rest.slice(rest.length - len))) return token;
  }
  const map = isUpper(rest[0]) ? DIGIT_TO_ALPHA_UPPER : DIGIT_TO_ALPHA_LOWER;
  if (map[digit] === undefined) return token;
  return `${map[digit]}${rest}${trail}`;
}

/**
 * A trailing "0" on an otherwise all-letter word is a misread "O"
 * ("DOL0" -> "DOLO"). Deliberately limited to the digit 0 and to tokens
 * containing no other digit, so genuine brand suffixes such as "B12",
 * "D3", "GP1" and "PAN 40" are never altered.
 */
function fixTrailingZeroWord(token: string): string {
  const m = token.match(/^([A-Za-z]{3,})0([^A-Za-z0-9]*)$/);
  if (!m) return token;
  const [, letters, trail] = m;
  if (KNOWN_UNITS.has(letters.toLowerCase())) return token;
  const useUpper = letters.split('').filter(isUpper).length >= letters.length / 2;
  return `${letters}${useUpper ? 'O' : 'o'}${trail}`;
}

/**
 * Resolves a candidate unit string to its canonical form, repairing the
 * common misreadings ("rng" -> "mg"). Returns null when the candidate is
 * not a dosage unit at all.
 */
function canonicalUnit(candidate: string): string | null {
  const cleaned = candidate.replace(/\.$/, '');
  if (!cleaned) return null;
  if (KNOWN_UNITS.has(cleaned.toLowerCase())) {
    return cleaned.toLowerCase() === 'iu' ? 'IU' : cleaned.toLowerCase();
  }
  for (const [pattern, replacement] of UNIT_FIXES) {
    if (pattern.test(cleaned)) return replacement;
  }
  return null;
}

/**
 * Normalises "5OOmg" / "65Omg" / "10Omcg" style strength tokens.
 *
 * The unit is found by testing suffixes from longest to shortest, so the
 * O-shaped digits in "5OOmg" are not mistaken for part of the unit.
 */
function fixStrengthToken(token: string): string {
  const trailing = token.match(/[A-Za-z.]+$/);
  if (!trailing) return token;

  const maxLen = Math.min(4, trailing[0].length);
  for (let len = maxLen; len >= 1; len--) {
    const suffix = token.slice(token.length - len);
    const unit = canonicalUnit(suffix);
    if (!unit) continue;

    const numPart = token.slice(0, token.length - len);
    if (!numPart) return token;

    // Require at least one unambiguous digit, so a pure word such as
    // "OSmg" is never reinterpreted as the number "05".
    if (!/[0-9]/.test(numPart)) continue;

    // The safe map only accepts the letters that genuinely masquerade as
    // digits, which keeps tokens like "1ABmg" from becoming "148mg".
    const fixedNum = digitize(numPart, false);
    if (!/^[0-9]+(?:[.,][0-9]+)?$/.test(fixedNum)) continue;

    return `${fixedNum}${unit}`;
  }
  return token;
}

/** Date-shaped tokens inside an EXP/MFG context get fully digitised. */
function fixDateToken(token: string): string {
  const monthName = /^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|SEPT|OCT|NOV|DEC)/i;

  // e.g. 03/2026, 03-26, 11.2027
  const sep = token.match(/^([A-Za-z0-9]{1,4})([\/\-.])([A-Za-z0-9]{2,4})$/);
  if (sep) {
    const [, a, delim, b] = sep;
    const left = monthName.test(a) ? a.toUpperCase() : digitize(a, true);
    const right = digitize(b, true);
    if (/^[0-9]+$/.test(right) && (/^[0-9]+$/.test(left) || monthName.test(left))) {
      // A dot separator between two numeric parts is not accepted downstream,
      // where expiry and manufacturing dates are matched with [/-] only.
      const outDelim = delim === '.' && /^[0-9]+$/.test(left) ? '/' : delim;
      return `${left}${outDelim}${right}`;
    }
    return token;
  }

  // Bare year / MMYYYY runs.
  if (/^[A-Za-z0-9]{4,6}$/.test(token) && digitRatio(token) >= 0.5) {
    const d = digitize(token, true);
    if (/^[0-9]{4,6}$/.test(d)) return d;
  }
  return token;
}

/** Price tokens: strip currency noise and digitise the number. */
function fixPriceToken(token: string): string {
  const m = token.match(/^([₹]?)(?:RS\.?|INR)?\s*([A-Za-z0-9.,]+)$/i);
  if (!m) return token;
  const numeric = m[2];
  if (digitRatio(numeric) < 0.4) return token;
  const fixed = digitize(numeric, true).replace(/,/g, '');
  if (!/^[0-9]+(?:\.[0-9]{1,2})?$/.test(fixed)) return token;
  return `${m[1]}${fixed}`;
}

/* ------------------------------------------------------------------ *
 * 5. Line-level label normalisation
 * ------------------------------------------------------------------ */

const LABEL_FIXES: Array<[RegExp, string]> = [
  // Batch
  [/\b[8B]\s*\.\s*N[O0]\b/gi, 'B.No'],
  [/\b[8B]ATCH\b/gi, 'BATCH'],
  [/\bL[O0]T\s*N[O0]\b/gi, 'LOT NO'],
  // Expiry
  [/\bE\s*X\s*[PR]\s*[.:]/gi, 'EXP:'],
  [/\bEXPIRV\b/gi, 'EXPIRY'],
  [/\b[E£]XP\b/g, 'EXP'],
  // Manufacturing
  [/\bMF[GCQO6]\b/gi, 'MFG'],
  [/\bMFD\b/gi, 'MFD'],
  // Price
  [/\bM\s*\.?\s*[RF]\s*\.?\s*P\b/gi, 'MRP'],
  [/\bNRP\b/gi, 'MRP'],
  // Prescription marker
  [/\bRx\s*[O0]nly\b/gi, 'Rx Only'],
];

function normaliseLabels(line: string): string {
  let out = line;
  for (const [pattern, replacement] of LABEL_FIXES) {
    out = out.replace(pattern, replacement);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * 6. Public entry point
 * ------------------------------------------------------------------ */

/**
 * Applies context-aware OCR character correction to a block of text.
 *
 * Guarantees:
 *  - never adds information that was not read;
 *  - never rewrites the *value* token of a batch/lot field, because those
 *    are legitimately mixed alphanumeric;
 *  - only rewrites characters whose intended class is unambiguous from
 *    surrounding context.
 */
export function correctOcrText(text: string): string {
  if (!text) return '';

  return text
    .split('\n')
    .map(rawLine => {
      const line = normaliseLabels(rawLine);

      const inBatch = BATCH_LABEL.test(line);
      const inDate = DATE_LABEL.test(line);
      const inPrice = PRICE_LABEL.test(line);

      const tokens = line.split(/(\s+)/); // keep whitespace runs
      let protectNext = 0;
      let prevToken = '';

      const fixed = tokens.map(token => {
        if (/^\s+$/.test(token) || token.length === 0) return token;
        const previous = prevToken;
        prevToken = token;

        if (BATCH_LABEL.test(token)) {
          // Protect only the value that immediately follows the label. Batch
          // and expiry frequently share a line, and suppressing the whole
          // remainder would leave the date uncorrected.
          if (inBatch) protectNext = 1;
          return token;
        }

        if (protectNext > 0) {
          // Neither a bare separator nor a label continuation word consumes
          // the protection: "BATCH NO : KL204A" must still shield KL204A.
          if (/^[:.#\/-]+$/.test(token)) return token;
          if (/^(?:NO|NUM|NUMBER)[:.#\/-]*$/i.test(token)) return token;
          protectNext--;
          // Batch and lot values are genuinely mixed alphanumeric, so
          // "correcting" them would corrupt real data.
          return token;
        }

        // A standalone unit after a number: "500 rng" -> "500 mg".
        if (/^[A-Za-z.]{1,4}$/.test(token) && /[0-9]$/.test(previous)) {
          const unit = canonicalUnit(token);
          if (unit && unit.toLowerCase() !== token.toLowerCase()) {
            prevToken = unit;
            return unit;
          }
        }

        // Strength is the most valuable field; try it before generic rules.
        if (/[0-9]/.test(token) && /[A-Za-z]/.test(token)) {
          const strength = fixStrengthToken(token);
          if (strength !== token) {
            prevToken = strength;
            return strength;
          }
        }

        if (inDate && /[0-9A-Za-z]/.test(token) && !DATE_LABEL.test(token)) {
          const dated = fixDateToken(token);
          if (dated !== token) return dated;
        }

        if (inPrice && !PRICE_LABEL.test(token)) {
          const priced = fixPriceToken(token);
          if (priced !== token) return priced;
        }

        let out = fixLeadingDigitWord(token);
        out = fixTrailingZeroWord(out);
        out = fixFlankedCharacters(out);
        prevToken = out;
        return out;
      });

      return fixed.join('').replace(/[ \t]{2,}/g, ' ').trimEnd();
    })
    .join('\n');
}

/* ------------------------------------------------------------------ *
 * 7. Result scoring (drives adaptive escalation)
 * ------------------------------------------------------------------ */

/** Labels whose presence means the pass captured genuinely useful data. */
const VALUE_SIGNALS = [
  /\b(?:B\s*\.?\s*NO|BATCH|LOT)\b/i,
  /\bEXP\b/i,
  /\b(?:MFG|MFD)\b/i,
  /\bMRP\b/i,
  /\b\d+\s*(?:mg|mcg|ml|g|IU)\b/i,
  /\b(?:TABLET|TABLETS|CAPSULE|CAPSULES|SYRUP|INJECTION|CREAM|OINTMENT)\b/i,
];

export interface OcrPassScore {
  score: number;
  alnum: number;
  signals: number;
}

/**
 * Blends engine confidence, text volume and the presence of the specific
 * fields pharmacy staff actually need. A pass that found "EXP" beats a pass
 * that produced more but less relevant characters.
 */
export function scoreOcrResult(text: string, confidence: number): OcrPassScore {
  const alnum = (text.match(/[A-Za-z0-9]/g) || []).length;
  const signals = VALUE_SIGNALS.reduce((n, re) => n + (re.test(text) ? 1 : 0), 0);

  const volumeScore = Math.min(30, alnum / 3);
  const signalScore = Math.min(30, signals * 8);
  const confScore = Math.max(0, Math.min(100, confidence)) * 0.5;

  return {
    score: Math.round(confScore + volumeScore + signalScore),
    alnum,
    signals,
  };
}

/* ------------------------------------------------------------------ *
 * 8. Line fusion across passes / images
 * ------------------------------------------------------------------ */

const normaliseForCompare = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * Merges lines from several OCR passes of the same photo.
 *
 * The previous implementation discarded any line that *contained* an existing
 * line, which threw away the longer and more informative reading. Here the
 * longer variant wins, and near-duplicates are resolved by confidence.
 */
export function fuseLines(entries: Array<{ line: string; conf: number }>): string[] {
  const kept: Array<{ line: string; conf: number; norm: string }> = [];

  for (const entry of entries) {
    const line = entry.line.trim();
    const norm = normaliseForCompare(line);
    if (norm.length < 2) continue;

    let replaced = false;
    let duplicate = false;

    for (let i = 0; i < kept.length; i++) {
      const other = kept[i];
      if (other.norm === norm) {
        // Identical reading - keep the higher-confidence rendering.
        if (entry.conf > other.conf) kept[i] = { line, conf: entry.conf, norm };
        duplicate = true;
        break;
      }
      if (norm.includes(other.norm)) {
        // This reading is a superset: prefer it, it carries more information.
        kept[i] = { line, conf: Math.max(entry.conf, other.conf), norm };
        replaced = true;
        break;
      }
      if (other.norm.includes(norm)) {
        duplicate = true;
        break;
      }
    }

    if (!duplicate && !replaced) {
      kept.push({ line, conf: entry.conf, norm });
    }
  }

  return kept.map(k => k.line);
}
