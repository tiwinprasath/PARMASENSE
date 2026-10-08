/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Adaptive image preprocessing for pharmaceutical packaging OCR.
 * PharmaSense Platform
 *
 * The pipeline measures each photo once, then renders exactly the variant
 * that measurement calls for. This replaces the previous approach of running
 * a fixed ladder of preprocessing tiers on every image, which was both
 * slower and worse on the hard cases (foil, glare, tilt).
 *
 * All heavy operations are O(pixels): CLAHE uses per-tile histograms with
 * bilinear blending, Sauvola uses integral images, and skew is estimated on
 * a downsampled thumbnail with a shear approximation.
 */

/** Which packaging surface a photo shows; drives preprocessing choices. */
export type OcrSurface = 'brand' | 'composition' | 'codes' | 'foil';

export interface ImageStats {
  width: number;
  height: number;
  mean: number;
  stdDev: number;
  p2: number;
  p98: number;
  darkFraction: number;
  glareFraction: number;
  edgeDensity: number;
  saturation: number;
  /** true when text appears lighter than its background (embossed foil, dark packs). */
  lightTextOnDark: boolean;
  /** Estimated in-plane tilt in degrees; positive means rotate clockwise to correct. */
  skewAngle: number;
  /** true when text lines appear to run vertically (photo needs a quarter turn). */
  needsQuarterTurn: boolean;
}

export interface PreprocessPlan {
  scale: number;
  stretch: boolean;
  /** When true, a box-blur denoise pass is applied at native resolution BEFORE
   * upscaling. This prevents the upscale from amplifying noise in low-light or
   * grainy images. Disabled when the image is already high-contrast. */
  denoise: boolean;
  /** Radius (in pixels, at native resolution) for the denoise blur. */
  denoiseRadius: number;
  /** When true, the top highlight percentile is compressed before CLAHE to
   * recover text hidden under specular glare patches. */
  suppressHighlights: boolean;
  clahe: boolean;
  claheClip: number;
  sharpen: number;
  binarize: boolean;
  sauvolaK: number;
  invert: boolean;
  deskew: number;
  quarterTurn: boolean;
  /** Human-readable tag recorded on the evidence for traceability. */
  label: string;
}

/* ------------------------------------------------------------------ *
 * Canvas helpers
 * ------------------------------------------------------------------ */

export const loadImage = (dataUrl: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });

const makeCanvas = (w: number, h: number) => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w));
  canvas.height = Math.max(1, Math.round(h));
  return canvas;
};

const dims = (img: HTMLImageElement) => ({
  w: img.naturalWidth || img.width,
  h: img.naturalHeight || img.height,
});

/** Draws an image (optionally scaled) and returns its pixel buffer. */
function drawToData(img: HTMLImageElement, w: number, h: number): ImageData | null {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return ctx.getImageData(0, 0, canvas.width, canvas.height);
}

function toGray(data: ImageData): Uint8ClampedArray {
  const { width: w, height: h, data: d } = data;
  const gray = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    gray[i] = (0.299 * d[p] + 0.587 * d[p + 1] + 0.114 * d[p + 2]) | 0;
  }
  return gray;
}

/* ------------------------------------------------------------------ *
 * Otsu threshold (used by the measurement stage only)
 * ------------------------------------------------------------------ */

export function otsuThreshold(gray: Uint8ClampedArray): number {
  const hist = new Array(256).fill(0);
  for (let i = 0; i < gray.length; i++) hist[gray[i]]++;

  const total = gray.length;
  let sum = 0;
  for (let t = 0; t < 256; t++) sum += t * hist[t];

  let sumB = 0;
  let wB = 0;
  let best = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (wB === 0) continue;
    const wF = total - wB;
    if (wF === 0) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) * (mB - mF);
    if (between > best) {
      best = between;
      threshold = t;
    }
  }
  return threshold;
}

/* ------------------------------------------------------------------ *
 * Skew and orientation estimation
 * ------------------------------------------------------------------ */

/**
 * Projection-profile skew estimation.
 *
 * For each candidate angle the ink mask is sheared vertically (a valid
 * approximation below ~15 degrees) and accumulated into row bins. Correctly
 * deskewed text produces sharp alternating peaks and troughs, so the sum of
 * squared row-to-row differences is maximal at the true angle.
 */
export function shearProfileEnergy(ink: Uint8Array, w: number, h: number, deg: number): number {
  const tan = Math.tan((deg * Math.PI) / 180);
  const pad = Math.ceil(Math.abs(tan) * w) + 2;
  const bins = new Float64Array(h + pad);
  const offset = tan < 0 ? pad - 1 : 0;

  let total = 0;
  for (let y = 0; y < h; y++) {
    const rowBase = y * w;
    for (let x = 0; x < w; x++) {
      if (ink[rowBase + x]) {
        const yy = (y + tan * x + offset) | 0;
        if (yy >= 0 && yy < bins.length) {
          bins[yy]++;
          total++;
        }
      }
    }
  }
  if (total === 0) return 0;

  let energy = 0;
  for (let i = 1; i < bins.length; i++) {
    const d = bins[i] - bins[i - 1];
    energy += d * d;
  }
  // Normalise by bin count and mean ink per bin so scores are comparable
  // across axes of different length.
  const mean = total / bins.length;
  return energy / (bins.length * mean * mean);
}

/**
 * Finds the shear angle whose row profile is sharpest. Correctly aligned
 * text produces strong alternating peaks and troughs, so the sum of squared
 * row-to-row differences peaks at the true angle.
 */
function bestProfile(ink: Uint8Array, w: number, h: number): { angle: number; energy: number } {
  let bestAngle = 0;
  let bestEnergy = -1;

  for (let deg = -8; deg <= 8; deg += 1) {
    const e = shearProfileEnergy(ink, w, h, deg);
    if (e > bestEnergy) {
      bestEnergy = e;
      bestAngle = deg;
    }
  }
  for (let deg = bestAngle - 0.75; deg <= bestAngle + 0.75; deg += 0.25) {
    const e = shearProfileEnergy(ink, w, h, deg);
    if (e > bestEnergy) {
      bestEnergy = e;
      bestAngle = deg;
    }
  }

  return { angle: Math.abs(bestAngle) < 0.3 ? 0 : bestAngle, energy: bestEnergy };
}

function transposeInk(ink: Uint8Array, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      out[x * h + y] = ink[y * w + x];
    }
  }
  return out;
}

export interface GeometryEstimate {
  skewAngle: number;
  needsQuarterTurn: boolean;
}

/**
 * Estimates tilt and whether the photo is sideways in a single search.
 *
 * Both axes are scored with the same tilt-tolerant profile search, so an
 * image that is simultaneously rotated and tilted is still classified
 * correctly. When the column axis wins, the returned skew is the residual
 * tilt measured after the quarter turn, matching the order in which
 * renderPreprocessed applies the two corrections.
 */
export function estimateGeometry(ink: Uint8Array, w: number, h: number): GeometryEstimate {
  const rows = bestProfile(ink, w, h);
  const cols = bestProfile(transposeInk(ink, w, h), h, w);

  // Require a clear margin before declaring the photo sideways.
  const needsQuarterTurn = cols.energy > rows.energy * 1.35;
  return {
    needsQuarterTurn,
    skewAngle: needsQuarterTurn ? cols.angle : rows.angle,
  };
}

/** Named export for direct skew queries and testing. */
export function estimateSkew(ink: Uint8Array, w: number, h: number): number {
  return bestProfile(ink, w, h).angle;
}

/** Named export for direct orientation queries and testing. */
export function detectQuarterTurn(ink: Uint8Array, w: number, h: number): boolean {
  return estimateGeometry(ink, w, h).needsQuarterTurn;
}

/* ------------------------------------------------------------------ *
 * Measurement
 * ------------------------------------------------------------------ */

/**
 * Single cheap analysis pass over a thumbnail. Everything the planner needs
 * is derived here so no later stage has to re-scan the image.
 */
export async function analyzeImage(dataUrl: string): Promise<ImageStats | null> {
  const img = await loadImage(dataUrl);
  const { w: fullW, h: fullH } = dims(img);

  const target = 420;
  const scale = Math.min(1, target / Math.max(fullW, fullH));
  const tw = Math.max(1, Math.round(fullW * scale));
  const th = Math.max(1, Math.round(fullH * scale));

  const data = drawToData(img, tw, th);
  if (!data) return null;

  const gray = toGray(data);
  const px = data.data;
  const n = tw * th;

  let sum = 0;
  let satSum = 0;
  let dark = 0;
  let glare = 0;
  const hist = new Array(256).fill(0);

  for (let i = 0; i < n; i++) {
    const v = gray[i];
    sum += v;
    hist[v]++;
    if (v < 40) dark++;
    if (v > 245) glare++;

    const p = i * 4;
    const mx = Math.max(px[p], px[p + 1], px[p + 2]);
    const mn = Math.min(px[p], px[p + 1], px[p + 2]);
    satSum += mx === 0 ? 0 : (mx - mn) / mx;
  }

  const mean = sum / n;
  let varSum = 0;
  for (let i = 0; i < n; i++) varSum += (gray[i] - mean) ** 2;
  const stdDev = Math.sqrt(varSum / n);

  const percentile = (frac: number): number => {
    const want = frac * n;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= want) return v;
    }
    return 255;
  };

  // Laplacian magnitude as a focus proxy.
  let edgeSum = 0;
  let edgeCount = 0;
  for (let y = 1; y < th - 1; y++) {
    for (let x = 1; x < tw - 1; x++) {
      const i = y * tw + x;
      const lap = 4 * gray[i] - gray[i - 1] - gray[i + 1] - gray[i - tw] - gray[i + tw];
      edgeSum += Math.abs(lap);
      edgeCount++;
    }
  }
  const edgeDensity = edgeCount ? edgeSum / edgeCount : 0;

  // Ink mask via Otsu, then decide polarity by which class is the minority:
  // text is almost always the smaller class on packaging.
  const threshold = otsuThreshold(gray);
  let below = 0;
  for (let i = 0; i < n; i++) if (gray[i] <= threshold) below++;
  const lightTextOnDark = below > n * 0.55;

  const ink = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const isInk = lightTextOnDark ? gray[i] > threshold : gray[i] <= threshold;
    ink[i] = isInk ? 1 : 0;
  }

  const { skewAngle, needsQuarterTurn } = estimateGeometry(ink, tw, th);

  return {
    width: fullW,
    height: fullH,
    mean,
    stdDev,
    p2: percentile(0.02),
    p98: percentile(0.98),
    darkFraction: dark / n,
    glareFraction: glare / n,
    edgeDensity,
    saturation: satSum / n,
    lightTextOnDark,
    skewAngle,
    needsQuarterTurn,
  };
}

/* ------------------------------------------------------------------ *
 * Planning
 * ------------------------------------------------------------------ */

/**
 * Chooses preprocessing from the measured statistics rather than running
 * every variant. Foil and low-contrast images get local contrast
 * equalisation; clean high-contrast images skip it and stay fast.
 */
export function buildPreprocessPlan(stats: ImageStats, surface: OcrSurface): PreprocessPlan {
  const longest = Math.max(stats.width, stats.height);
  const isFoil = surface === 'foil';
  const smallText = surface === 'codes' || surface === 'foil' || surface === 'composition';

  // Tesseract's LSTM engine wants roughly 30px of glyph height. Upscale small
  // captures, and cap very large ones so passes stay quick.
  let scale = 1;
  if (longest < 800) scale = smallText ? 2.6 : 2.2;
  else if (longest < 1200) scale = smallText ? 2.0 : 1.7;
  else if (longest < 1800) scale = smallText ? 1.6 : 1.3;
  else if (longest > 2600) scale = 2600 / longest;

  const dynamicRange = stats.p98 - stats.p2;
  const lowContrast = stats.stdDev < 45 || dynamicRange < 110;
  const heavyGlare = stats.glareFraction > 0.06;
  const veryDark = stats.mean < 70 || stats.darkFraction > 0.45;
  // Foil is metallic: little colour but strong speculars.
  const metallic = stats.saturation < 0.18 && (heavyGlare || stats.stdDev < 55);

  // --- NEW: Denoise before upscale ---------------------------------
  // Low-light or noisy images have low edge density relative to their dark
  // fraction. A small box blur at native resolution prevents the upscale from
  // amplifying grain into OCR-corrupting blobs.
  const needsDenoise = (veryDark || stats.mean < 100) && stats.edgeDensity < 5.5;
  const denoise = needsDenoise && scale > 1.4;
  const denoiseRadius = stats.mean < 50 ? 3 : 2;

  // --- NEW: Highlight suppression before CLAHE ---------------------
  // Specular glare patches (phone torch reflection on foil, glossy boxes)
  // cause a saturated cluster in the top histogram bucket that consumes most
  // of CLAHE's contrast-limit budget. Compressing those pixels first lets
  // CLAHE allocate its dynamic range to the text region.
  const suppressHighlights = stats.glareFraction > 0.08 || (heavyGlare && metallic);

  // Outlier-robust stretch is cheap and helps whenever the tonal range is
  // compressed, which is the normal case for foil and shadowed packaging.
  const stretch = lowContrast || metallic || isFoil || veryDark || heavyGlare;
  const clahe = isFoil || metallic || lowContrast || heavyGlare || veryDark;
  const claheClip = isFoil || heavyGlare ? 2.0 : 3.0;

  // Binarisation helps small dense print, but destroys faint embossed foil
  // characters, so foil keeps a grayscale rendering.
  const binarize = !isFoil && !metallic && stats.edgeDensity > 2.5;
  const sauvolaK = lowContrast ? 0.12 : 0.2;

  const sharpen = isFoil || metallic ? 0.8 : stats.edgeDensity < 6 ? 1.5 : 1.0;

  const tags = [`x${scale.toFixed(1)}`];
  if (denoise) tags.push(`denoise${denoiseRadius}`);
  if (suppressHighlights) tags.push('hlsupp');
  if (stretch) tags.push('stretch');
  if (clahe) tags.push('clahe');
  if (binarize) tags.push('sauvola');
  if (stats.lightTextOnDark) tags.push('inv');
  if (stats.skewAngle) tags.push(`skew${stats.skewAngle.toFixed(1)}`);
  if (stats.needsQuarterTurn) tags.push('rot90');

  return {
    scale,
    denoise,
    denoiseRadius,
    suppressHighlights,
    stretch,
    clahe,
    claheClip,
    sharpen,
    binarize,
    sauvolaK,
    invert: stats.lightTextOnDark,
    deskew: stats.skewAngle,
    quarterTurn: stats.needsQuarterTurn,
    label: tags.join('-'),
  };
}

/* ------------------------------------------------------------------ *
 * Pixel operations
 * ------------------------------------------------------------------ */

/**
 * Lightweight box-blur denoiser applied at native resolution BEFORE upscaling.
 *
 * Upscaling a noisy image (low-light, high-ISO phone capture) amplifies grain
 * into large patches that Tesseract reads as stray characters. A 2–3px box
 * blur at native resolution removes grain while leaving edges intact, so the
 * subsequent upscale produces clean glyph boundaries rather than textured
 * noise blobs.
 *
 * The radius is intentionally small: we want to reduce pixel noise, not blur
 * character strokes. For radius=2 a 5×5 separable pass is used; for radius=1
 * a 3×3 pass. Both run in two linear sweeps (horizontal then vertical).
 */
export function applyDenoise(
  gray: Uint8ClampedArray,
  w: number,
  h: number,
  radius = 2
): Uint8ClampedArray {
  if (radius <= 0 || w < 4 || h < 4) return gray;
  const r = Math.min(radius, 4);
  const tmp = new Float32Array(w * h);
  const out = new Uint8ClampedArray(w * h);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const base = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let dx = -r; dx <= r; dx++) {
        const nx = x + dx;
        if (nx >= 0 && nx < w) { sum += gray[base + nx]; count++; }
      }
      tmp[base + x] = count > 0 ? sum / count : gray[base + x];
    }
  }

  // Vertical pass
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) {
      let sum = 0;
      let count = 0;
      for (let dy = -r; dy <= r; dy++) {
        const ny = y + dy;
        if (ny >= 0 && ny < h) { sum += tmp[ny * w + x]; count++; }
      }
      out[y * w + x] = Math.round(count > 0 ? sum / count : tmp[y * w + x]);
    }
  }
  return out;
}

/**
 * Highlight suppression: compresses the top N% of the brightness range
 * before CLAHE to recover text hidden under specular glare patches.
 *
 * Heavy glare creates a large saturated region whose pixels contribute
 * almost no useful signal but exhaust CLAHE's contrast limit budget.
 * Mapping those pixels to a ceiling value (e.g. 220) makes the glare region
 * less dominant, leaving more headroom for CLAHE to lift the surrounding text.
 *
 * This is applied after percentile stretch (when stretch is active) and
 * immediately before CLAHE.
 */
export function applyHighlightSuppression(
  gray: Uint8ClampedArray,
  ceilPct = 0.94,
  targetCeil = 220
): Uint8ClampedArray {
  const n = gray.length;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++) hist[gray[i]]++;

  const wantAccum = ceilPct * n;
  let acc = 0;
  let ceilLevel = 255;
  for (let v = 0; v < 256; v++) {
    acc += hist[v];
    if (acc >= wantAccum) { ceilLevel = v; break; }
  }

  if (ceilLevel >= 240) return gray; // no significant glare cluster

  const out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) {
    out[i] = gray[i] > ceilLevel
      ? Math.min(255, targetCeil + Math.round((gray[i] - ceilLevel) * 0.3))
      : gray[i];
  }
  return out;
}

/**
 * Robust global contrast stretch.
 *
 * The previous implementation stretched between the absolute darkest and
 * brightest pixel, so a single black speck plus one glare highlight made the
 * operation a no-op. Clipping at percentiles ignores those outliers, which
 * is what actually rescues faint foil print and shadowed packaging.
 *
 * It also runs before CLAHE deliberately: a histogram confined to a handful
 * of adjacent levels gets almost entirely clipped by CLAHE's limit, so
 * CLAHE alone barely separates very low-contrast text.
 */
export function applyPercentileStretch(
  gray: Uint8ClampedArray,
  lowPct = 0.02,
  highPct = 0.98
): Uint8ClampedArray {
  const n = gray.length;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < n; i++) hist[gray[i]]++;

  const pick = (frac: number): number => {
    const want = frac * n;
    let acc = 0;
    for (let v = 0; v < 256; v++) {
      acc += hist[v];
      if (acc >= want) return v;
    }
    return 255;
  };

  const lo = pick(lowPct);
  const hi = pick(highPct);
  const range = hi - lo;
  // Nothing useful to stretch (flat or already full range).
  if (range < 4) return gray;

  const lut = new Uint8ClampedArray(256);
  for (let v = 0; v < 256; v++) {
    lut[v] = Math.max(0, Math.min(255, Math.round(((v - lo) / range) * 255)));
  }

  const out = new Uint8ClampedArray(n);
  for (let i = 0; i < n; i++) out[i] = lut[gray[i]];
  return out;
}

/**
 * Contrast Limited Adaptive Histogram Equalisation.
 *
 * Tile histograms are clipped and redistributed, then each pixel is mapped
 * through a bilinear blend of its four neighbouring tile CDFs. This lifts
 * faint foil and shadowed print without amplifying noise the way a global
 * stretch does.
 */
export function applyClahe(gray: Uint8ClampedArray, w: number, h: number, clipLimit: number): Uint8ClampedArray {
  const tilesX = 8;
  const tilesY = 8;
  const tileW = Math.max(1, Math.ceil(w / tilesX));
  const tileH = Math.max(1, Math.ceil(h / tilesY));
  const maps: Uint8ClampedArray[] = [];

  for (let ty = 0; ty < tilesY; ty++) {
    for (let tx = 0; tx < tilesX; tx++) {
      const x0 = tx * tileW;
      const y0 = ty * tileH;
      const x1 = Math.min(w, x0 + tileW);
      const y1 = Math.min(h, y0 + tileH);

      const hist = new Float64Array(256);
      let count = 0;
      for (let y = y0; y < y1; y++) {
        const base = y * w;
        for (let x = x0; x < x1; x++) {
          hist[gray[base + x]]++;
          count++;
        }
      }

      const map = new Uint8ClampedArray(256);
      if (count === 0) {
        for (let v = 0; v < 256; v++) map[v] = v;
        maps.push(map);
        continue;
      }

      // Clip and redistribute the excess uniformly.
      const limit = Math.max(1, (clipLimit * count) / 256);
      let excess = 0;
      for (let v = 0; v < 256; v++) {
        if (hist[v] > limit) {
          excess += hist[v] - limit;
          hist[v] = limit;
        }
      }
      const bonus = excess / 256;

      let cdf = 0;
      for (let v = 0; v < 256; v++) {
        cdf += hist[v] + bonus;
        map[v] = Math.max(0, Math.min(255, Math.round((cdf / count) * 255)));
      }
      maps.push(map);
    }
  }

  const out = new Uint8ClampedArray(w * h);
  for (let y = 0; y < h; y++) {
    const fy = y / tileH - 0.5;
    const ty0 = Math.max(0, Math.min(tilesY - 1, Math.floor(fy)));
    const ty1 = Math.max(0, Math.min(tilesY - 1, ty0 + 1));
    const wy = Math.max(0, Math.min(1, fy - ty0));

    for (let x = 0; x < w; x++) {
      const fx = x / tileW - 0.5;
      const tx0 = Math.max(0, Math.min(tilesX - 1, Math.floor(fx)));
      const tx1 = Math.max(0, Math.min(tilesX - 1, tx0 + 1));
      const wx = Math.max(0, Math.min(1, fx - tx0));

      const v = gray[y * w + x];
      const a = maps[ty0 * tilesX + tx0][v];
      const b = maps[ty0 * tilesX + tx1][v];
      const c = maps[ty1 * tilesX + tx0][v];
      const d = maps[ty1 * tilesX + tx1][v];

      out[y * w + x] =
        (a * (1 - wx) * (1 - wy) + b * wx * (1 - wy) + c * (1 - wx) * wy + d * wx * wy) | 0;
    }
  }
  return out;
}

/** Unsharp mask using a separable 3-tap blur. */
function applyUnsharp(gray: Uint8ClampedArray, w: number, h: number, amount: number): Uint8ClampedArray {
  if (amount <= 0) return gray;
  const tmp = new Float32Array(w * h);
  const blur = new Float32Array(w * h);

  for (let y = 0; y < h; y++) {
    const base = y * w;
    for (let x = 0; x < w; x++) {
      const l = gray[base + Math.max(0, x - 1)];
      const c = gray[base + x];
      const r = gray[base + Math.min(w - 1, x + 1)];
      tmp[base + x] = (l + c + r) / 3;
    }
  }
  for (let y = 0; y < h; y++) {
    const up = Math.max(0, y - 1) * w;
    const dn = Math.min(h - 1, y + 1) * w;
    const base = y * w;
    for (let x = 0; x < w; x++) {
      blur[base + x] = (tmp[up + x] + tmp[base + x] + tmp[dn + x]) / 3;
    }
  }

  const out = new Uint8ClampedArray(w * h);
  for (let i = 0; i < w * h; i++) {
    out[i] = Math.max(0, Math.min(255, Math.round(gray[i] + amount * (gray[i] - blur[i]))));
  }
  return out;
}

/**
 * Sauvola adaptive binarisation via integral images.
 *
 * Unlike a global threshold it survives the uneven lighting and shadows that
 * are normal when photographing a curved medicine box, and unlike the
 * previous per-pixel local min/max scan it runs in linear time.
 */
export function applySauvola(gray: Uint8ClampedArray, w: number, h: number, k: number): Uint8ClampedArray {
  const iw = w + 1;
  const integral = new Float64Array(iw * (h + 1));
  const integralSq = new Float64Array(iw * (h + 1));

  for (let y = 0; y < h; y++) {
    let rowSum = 0;
    let rowSumSq = 0;
    for (let x = 0; x < w; x++) {
      const v = gray[y * w + x];
      rowSum += v;
      rowSumSq += v * v;
      integral[(y + 1) * iw + (x + 1)] = integral[y * iw + (x + 1)] + rowSum;
      integralSq[(y + 1) * iw + (x + 1)] = integralSq[y * iw + (x + 1)] + rowSumSq;
    }
  }

  // Window should span a couple of character heights.
  const win = Math.max(15, Math.round(Math.min(w, h) / 18) | 1);
  const half = win >> 1;
  const R = 128;
  const out = new Uint8ClampedArray(w * h);

  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(h - 1, y + half);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(w - 1, x + half);
      const area = (x1 - x0 + 1) * (y1 - y0 + 1);

      const A = y0 * iw + x0;
      const B = y0 * iw + (x1 + 1);
      const C = (y1 + 1) * iw + x0;
      const D = (y1 + 1) * iw + (x1 + 1);

      const sum = integral[D] - integral[B] - integral[C] + integral[A];
      const sumSq = integralSq[D] - integralSq[B] - integralSq[C] + integralSq[A];
      const mean = sum / area;
      const variance = Math.max(0, sumSq / area - mean * mean);
      const std = Math.sqrt(variance);

      const threshold = mean * (1 + k * (std / R - 1));
      out[y * w + x] = gray[y * w + x] > threshold ? 255 : 0;
    }
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Rendering
 * ------------------------------------------------------------------ */

function grayToCanvas(gray: Uint8ClampedArray, w: number, h: number, invert: boolean): HTMLCanvasElement {
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  const out = ctx.createImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const v = invert ? 255 - gray[i] : gray[i];
    const p = i * 4;
    out.data[p] = v;
    out.data[p + 1] = v;
    out.data[p + 2] = v;
    out.data[p + 3] = 255;
  }
  ctx.putImageData(out, 0, 0);
  return canvas;
}

/** Rotates a canvas by an arbitrary angle, padding with white. */
function rotateCanvas(source: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  if (!degrees) return source;
  const rad = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const w = source.width;
  const h = source.height;
  const nw = Math.round(w * cos + h * sin);
  const nh = Math.round(w * sin + h * cos);

  const canvas = makeCanvas(nw, nh);
  const ctx = canvas.getContext('2d');
  if (!ctx) return source;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, nw, nh);
  ctx.translate(nw / 2, nh / 2);
  ctx.rotate(rad);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, -w / 2, -h / 2);
  return canvas;
}

/**
 * Renders the OCR-ready variant described by a plan.
 * Order matters: geometry first, then tone, then sharpening, then threshold.
 */
export async function renderPreprocessed(dataUrl: string, plan: PreprocessPlan): Promise<string> {
  const img = await loadImage(dataUrl);
  const { w: iw, h: ih } = dims(img);

  // --- NEW: Denoise at native resolution BEFORE upscaling ---
  // For low-light / grainy images the denoise pass runs on the native-sized
  // pixel buffer so the box radius targets actual sensor noise grains rather
  // than upscaled blobs. The denoised array is then drawn scaled.
  let preDenoisedUrl = dataUrl;
  if (plan.denoise) {
    const nativeData = drawToData(img, iw, ih);
    if (nativeData) {
      const nativeGray = toGray(nativeData);
      const denoised = applyDenoise(nativeGray, iw, ih, plan.denoiseRadius);
      // Render back to a canvas so we can draw it scaled in the next step.
      const dnCanvas = grayToCanvas(denoised, iw, ih, false);
      preDenoisedUrl = dnCanvas.toDataURL('image/png');
    }
  }

  const srcImg = plan.denoise ? await loadImage(preDenoisedUrl) : img;
  const w = Math.max(1, Math.round(iw * plan.scale));
  const h = Math.max(1, Math.round(ih * plan.scale));

  const data = drawToData(srcImg, w, h);
  if (!data) return dataUrl;

  let gray = toGray(data);
  if (plan.stretch) gray = applyPercentileStretch(gray);
  // --- NEW: Highlight suppression before CLAHE ---
  if (plan.suppressHighlights) gray = applyHighlightSuppression(gray);
  if (plan.clahe) gray = applyClahe(gray, w, h, plan.claheClip);
  if (plan.sharpen > 0) gray = applyUnsharp(gray, w, h, plan.sharpen);
  if (plan.binarize) gray = applySauvola(gray, w, h, plan.sauvolaK);

  let canvas = grayToCanvas(gray, w, h, plan.invert);

  // Correct a sideways photo first, then the residual tilt.
  // estimateSkew already returns the *corrective* angle: canvas rotate(t)
  // maps y -> y + t*x, which is exactly the shear that flattens the lines.
  if (plan.quarterTurn) canvas = rotateCanvas(canvas, 90);
  if (plan.deskew) canvas = rotateCanvas(canvas, plan.deskew);

  return canvas.toDataURL('image/png');
}

/** Rotates a source photo by a whole number of degrees (orientation retry). */
export async function rotateDataUrl(dataUrl: string, degrees: number): Promise<string> {
  const img = await loadImage(dataUrl);
  const { w, h } = dims(img);
  const canvas = makeCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0);
  return rotateCanvas(canvas, degrees).toDataURL('image/png');
}

/**
 * Crops a normalised region and upscales it.
 *
 * Used for label-anchored refinement: once a pass has located "EXP" or
 * "B.No", that line is re-read on its own at high magnification with a
 * restricted character set, which is where most batch/date accuracy comes from.
 */
export async function cropAndMagnify(
  dataUrl: string,
  box: { x0: number; y0: number; x1: number; y1: number },
  magnify = 2.5
): Promise<string | null> {
  const img = await loadImage(dataUrl);
  const { w: iw, h: ih } = dims(img);

  const x0 = Math.max(0, Math.floor(box.x0 * iw));
  const y0 = Math.max(0, Math.floor(box.y0 * ih));
  const x1 = Math.min(iw, Math.ceil(box.x1 * iw));
  const y1 = Math.min(ih, Math.ceil(box.y1 * ih));

  const cw = x1 - x0;
  const ch = y1 - y0;
  if (cw < 8 || ch < 6) return null;

  const canvas = makeCanvas(cw * magnify, ch * magnify);
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, x0, y0, cw, ch, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/png');
}

/** Maps a quality measurement to the warning shown to the pharmacist. */
export function qualityWarningFor(stats: ImageStats): string | undefined {
  if (stats.width < 320 || stats.height < 240) {
    return `Low resolution (${stats.width}×${stats.height}px). Text might be difficult to resolve.`;
  }
  if (stats.mean < 25) return 'Image is very dark. Ensure good lighting on the packaging.';
  if (stats.mean > 242) return 'Image is overexposed with glare. Tilt packaging to reduce reflection.';
  if (stats.glareFraction > 0.18) return 'Strong glare detected. Tilt the pack away from the light source.';
  if (stats.stdDev < 12) return 'Low contrast detected. Text may blend into background.';
  if (stats.edgeDensity < 3.5) return 'Image may be blurry. Hold camera steady and ensure package is focused.';
  return undefined;
}
