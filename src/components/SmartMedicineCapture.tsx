/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Smart Medicine Capture - Adaptive Multi-Stage OCR & Computer Vision Pipeline
 * PharmaSense Platform
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, Upload, CheckCircle2, AlertCircle, RefreshCw, 
  Sparkles, X, Trash2, Eye, ShieldAlert, Check,
  Layers, ArrowRight, FileText, ChevronRight, AlertTriangle, 
  Building2, Pill, DollarSign, Calendar, Hash, Edit3, Box
} from 'lucide-react';
import Tesseract from 'tesseract.js';
import api from '../services/api';
import { MedicineMaster } from '../types';
import {
  analyzeImage,
  buildPreprocessPlan,
  renderPreprocessed,
  rotateDataUrl,
  cropAndMagnify,
  qualityWarningFor,
  loadImage,
  type ImageStats,
  type OcrSurface
} from '../utils/ocrImagePipeline';
import {
  groupWordsIntoLines,
  correctOcrText,
  scoreOcrResult,
  fuseLines,
  type OcrWordLike
} from '../utils/ocrTextCorrection';

export interface SmartCaptureResult {
  barcode?: string;
  name: string;
  genericName: string;
  category: string;
  manufacturer: string;
  strength: string;
  unit: string;
  mrp: number;
  description: string;
  type?: string;
  confidence?: number;
  isNewCode?: boolean;

  // Rich metadata from Smart Medicine Capture
  batchNumber?: string;
  expiryDate?: string;
  manufacturingDate?: string;
  dosageForm?: string;
  composition?: string;
  sideEffects?: string;
  matchedDatasetId?: number | string;
  isAlreadyInFormulary?: boolean;
  matchType?: string;
  rawOcrText?: string;
}

interface SmartMedicineCaptureProps {
  onScanMatch: (result: SmartCaptureResult) => void;
  onClose: () => void;
  medicines?: MedicineMaster[];
  onManualEntry?: () => void;
}

export type PackageMode = 'box' | 'strip';
export type PhotoSource = 'front' | 'back' | 'side' | 'strip-front' | 'strip-back';

export interface CapturedPhoto {
  id: string;
  label: string;
  source: PhotoSource;
  dataUrl: string;
  width?: number;
  height?: number;
  qualityWarning?: string;
  /** Cached quality measurement; drives preprocessing without a second scan. */
  stats?: ImageStats;
}

export interface OcrEvidence {
  source: PhotoSource;
  text: string;
  confidence: number;
  variant: string;
  orientation: number;
  words: Array<{
    text: string;
    confidence: number;
    bbox?: { x0: number; y0: number; x1: number; y1: number };
  }>;
  /** Engine output before character correction, kept so nothing is lost. */
  rawText?: string;
}

interface SlotConfig {
  source: PhotoSource;
  label: string;
  hint: string;
  badge: string;
}

const BOX_SLOTS: SlotConfig[] = [
  { source: 'front', label: 'Front Packaging', hint: 'Brand name, strength, dosage form', badge: 'Main / Name' },
  { source: 'back', label: 'Back Details', hint: 'Chemical composition, manufacturer, warnings', badge: 'Composition' },
  { source: 'side', label: 'Side / Flap', hint: 'Batch number, Mfg date, Expiry, MRP', badge: 'Batch & Dates' },
];

const STRIP_SLOTS: SlotConfig[] = [
  { source: 'strip-front', label: 'Strip Front', hint: 'Brand name, tablet count, strength', badge: 'Front Face' },
  { source: 'strip-back', label: 'Strip Back (Foil)', hint: 'Batch no, Expiry date, MRP, active salts on foil', badge: 'Foil Details' },
];

export default function SmartMedicineCapture({
  onScanMatch,
  onClose,
  medicines = [],
  onManualEntry
}: SmartMedicineCaptureProps) {
  // Stage: 'capture' | 'analyzing' | 'review'
  const [stage, setStage] = useState<'capture' | 'analyzing' | 'review'>('capture');

  // Package Mode: 'box' vs 'strip'
  const [packageMode, setPackageMode] = useState<PackageMode>('box');
  const [activeSource, setActiveSource] = useState<PhotoSource>('front');

  // Camera stream state
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  // Captured photos state with metadata
  const [capturedPhotos, setCapturedPhotos] = useState<CapturedPhoto[]>([]);

  // OCR Processing state
  const [ocrProgress, setOcrProgress] = useState<number>(0);
  const [ocrStatusText, setOcrStatusText] = useState<string>('');
  const [qualityWarning, setQualityWarning] = useState<string>('');

  const compressDataUrl = async (dataUrl: string, quality = 0.85): Promise<string> => {
    try {
      const img = await loadImage(dataUrl);
      const canvas = document.createElement('canvas');
      const maxSide = 1800;
      const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
      canvas.width = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
      canvas.height = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
      const ctx = canvas.getContext('2d');
      if (!ctx) return dataUrl;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', quality);
    } catch {
      return dataUrl;
    }
  };

  // Structured OCR Evidence (stored internally for Phase 2 API connection)
  const [textBySourceState, setTextBySourceState] = useState<Record<PhotoSource, string>>({
    front: '',
    back: '',
    side: '',
    'strip-front': '',
    'strip-back': ''
  });
  const [ocrEvidenceState, setOcrEvidenceState] = useState<OcrEvidence[]>([]);
  const [ocrConfidenceState, setOcrConfidenceState] = useState<number>(0);
  const [rawText, setRawText] = useState<string>('');

  // Identification & Review state
  const [identificationResult, setIdentificationResult] = useState<{
    identified: boolean;
    confidence: number;
    matchType: string;
    ocrConfidence?: number;
    vlmUsed?: boolean;
    ocrMethod?: string;
    medicineFoundInDatabase?: boolean;
    requiresVerification?: boolean;
    askVerification: boolean;
    isAlreadyInFormulary: boolean;
    existingFormularyId: string | null;
    verificationWarnings?: string[];
    candidates?: Array<{
      id: number | string;
      name: string;
      score: number;
      signals?: Record<string, number>;
      manufacturer?: string;
      composition?: string;
      strength?: string;
      type?: string;
      pack_size_label?: string;
      price?: number;
    }>;
    matchedMedicine: any;
    extractedFields: {
      medicine_name: string;
      brand_name?: string;
      generic_name?: string;
      strength: string;
      dosage_form: string;
      manufacturer: string;
      composition: string;
      batch_no: string;
      manufacturing_date: string;
      expiry_date: string;
      pack_size?: string;
      mrp: number;
      barcode?: string;
      rx_required?: boolean;
      storage_instructions: string;
      warnings: string;
      field_evidence?: Record<string, any>;
    };
    packageFields?: {
      batch_no: string;
      manufacturing_date: string;
      expiry_date: string;
      mrp: number;
      barcode?: string;
      storage_instructions: string;
      warnings: string;
    };
    catalogFields?: {
      name: string;
      composition: string;
      manufacturer: string;
      strength: string;
      dosage_form: string;
      price: number;
      pack_size_label?: string;
    };
  } | null>(null);

  // Editable Form fields for pharmacist review
  const [reviewedData, setReviewedData] = useState({
    name: '',
    genericName: '',
    category: 'Analgesic & Antipyretic',
    manufacturer: '',
    strength: '',
    unit: 'Tablet',
    mrp: 0,
    batchNumber: '',
    expiryDate: '',
    manufacturingDate: '',
    description: '',
    barcode: ''
  });

  const [activeTab, setActiveTab] = useState<'review' | 'rawText'>('review');

  const currentSlots = packageMode === 'box' ? BOX_SLOTS : STRIP_SLOTS;
  const activeSlotConfig = currentSlots.find(s => s.source === activeSource) || currentSlots[0];

  // Stop camera stream cleanly
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Track stop error:', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  // Start camera stream with multi-tier fallback
  const startCamera = useCallback(async () => {
    setCameraError(null);
    stopCamera();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setCameraError('UNSUPPORTED');
      setCameraActive(false);
      return;
    }

    let stream: MediaStream | null = null;
    let lastErr: any = null;

    // Strategy 1: Ideal facingMode with 720p preference
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
    } catch (err1: any) {
      lastErr = err1;
      console.warn('Camera Strategy 1 (ideal facingMode) failed:', err1);
    }

    // Strategy 2: Universal video fallback
    if (!stream) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: false
        });
      } catch (err2: any) {
        lastErr = err2;
        console.warn('Camera Strategy 2 (video: true) failed:', err2);
      }
    }

    if (stream) {
      streamRef.current = stream;
      setCameraActive(true);
      setCameraError(null);
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('video.play() warning:', playErr);
        }
      }
    } else {
      setCameraActive(false);
      const errName = lastErr?.name || '';
      const errMsg = String(lastErr?.message || '');

      if (errName === 'NotAllowedError' || errName === 'PermissionDeniedError') {
        setCameraError('PERMISSION_DENIED');
      } else if (errName === 'NotReadableError' || errMsg.includes('in use') || errMsg.includes('Could not start video source')) {
        setCameraError('CAMERA_IN_USE');
      } else if (errName === 'NotFoundError' || errName === 'DevicesNotFoundError') {
        setCameraError('NO_DEVICE');
      } else {
        setCameraError(errMsg || 'Could not access camera.');
      }
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Switch package mode (box vs strip)
  const handleSwitchPackageMode = (mode: PackageMode) => {
    setPackageMode(mode);
    if (mode === 'box') {
      if (!BOX_SLOTS.some(s => s.source === activeSource)) {
        setActiveSource('front');
      }
    } else {
      if (!STRIP_SLOTS.some(s => s.source === activeSource)) {
        setActiveSource('strip-front');
      }
    }
  };

  // --- IMAGE QUALITY & CAPTURE HELPERS ---

  /**
   * Measures a photo once and caches the result on the photo record.
   * Every later stage (preprocessing plan, quality warning) reuses this
   * measurement instead of re-scanning the pixels.
   */
  const measurePhoto = async (
    dataUrl: string
  ): Promise<{ stats: ImageStats | null; warning?: string }> => {
    try {
      const stats = await analyzeImage(dataUrl);
      if (!stats) return { stats: null };
      return { stats, warning: qualityWarningFor(stats) };
    } catch {
      return { stats: null };
    }
  };

  // Capture snapshot from video stream
  const handleSnapPhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Higher quality than before: JPEG artefacts around small glyphs are a
    // significant source of OCR error on batch and expiry codes.
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    const { stats, warning } = await measurePhoto(dataUrl);

    const newPhoto: CapturedPhoto = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: activeSlotConfig.label,
      source: activeSlotConfig.source,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
      qualityWarning: warning,
      stats: stats || undefined
    };

    // If a photo with the exact same source exists, replace it; otherwise add
    setCapturedPhotos(prev => {
      const filtered = prev.filter(p => p.source !== activeSlotConfig.source);
      return [...filtered, newPhoto];
    });

    // Advance to next slot in current package mode
    const currentIndex = currentSlots.findIndex(s => s.source === activeSource);
    const nextSlot = currentSlots[(currentIndex + 1) % currentSlots.length];
    if (nextSlot) {
      setActiveSource(nextSlot.source);
    }
  };

  // Upload photo from file input
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const fileList: File[] = Array.from(files);
    e.target.value = '';

    for (let index = 0; index < fileList.length; index++) {
      const file = fileList[index];
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = (event) => resolve(event.target?.result as string);
        reader.readAsDataURL(file);
      });

      if (!dataUrl) continue;

      const compressedDataUrl = await compressDataUrl(dataUrl, 0.85);
      const { stats, warning } = await measurePhoto(compressedDataUrl);
      const img = await loadImage(compressedDataUrl);

      // Deterministic slot assignment
      let targetSource = activeSource;
      if (fileList.length > 1) {
        targetSource = currentSlots[index % currentSlots.length].source;
      }
      const slotConfig = currentSlots.find(s => s.source === targetSource) || currentSlots[0];

      const newPhoto: CapturedPhoto = {
        id: `${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
        label: slotConfig.label,
        source: slotConfig.source,
        dataUrl: compressedDataUrl,
        width: img.naturalWidth || img.width,
        height: img.naturalHeight || img.height,
        qualityWarning: warning,
        stats: stats || undefined
      };

      setCapturedPhotos(prev => {
        const filtered = prev.filter(p => p.source !== slotConfig.source);
        return [...filtered, newPhoto];
      });
    }
  };

  // Remove captured photo
  const handleRemovePhoto = (id: string) => {
    setCapturedPhotos(prev => prev.filter(p => p.id !== id));
  };

  // Switch front/back camera
  const toggleFacingMode = () => {
    stopCamera();
    setFacingMode(prev => (prev === 'environment' ? 'user' : 'environment'));
  };

  // --- OCR ENGINE CONFIGURATION ---

  /** Maps a capture slot to the packaging surface it shows. */
  const surfaceForSource = (source: PhotoSource): OcrSurface => {
    switch (source) {
      case 'front':
      case 'strip-front':
        return 'brand';
      case 'back':
        return 'composition';
      case 'side':
        return 'codes';
      case 'strip-back':
        return 'foil';
      default:
        return 'brand';
    }
  };

  /**
   * Page segmentation mode per surface.
   * 6  = one uniform block, right for large brand lettering.
   * 4  = a single column of variable-sized text, right for composition panels.
   * 11 = sparse text, right for batch/expiry codes scattered over a flap or foil.
   */
  const primaryPsmFor = (surface: OcrSurface): string => {
    if (surface === 'brand') return '6';
    if (surface === 'composition') return '4';
    return '11';
  };

  const ALL_CHARS = '';
  // Codes are uppercase alphanumerics with a few separators. Restricting the
  // alphabet is the single biggest accuracy win on batch numbers and dates.
  const CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789./:- ';

  /**
   * Applies Tesseract parameters for one pass.
   *
   * The character whitelist is always set explicitly, including to the empty
   * string, because a whitelist left over from a previous pass silently
   * corrupts every later recognition on the same worker.
   */
  const applyTesseractParams = async (
    worker: Tesseract.Worker,
    psm: string,
    whitelist: string
  ) => {
    await worker.setParameters({
      tessedit_pageseg_mode: psm as any,
      tessedit_char_whitelist: whitelist,
      preserve_interword_spaces: '1',
      // Images are rendered from canvas and carry no DPI metadata; telling
      // Tesseract the effective resolution stops it mis-estimating glyph size.
      user_defined_dpi: '300',
      // Polarity is handled by our own preprocessing, so the engine's
      // internal inverted retry is wasted work.
      tessedit_do_invert: '0'
    } as any);
  };

  interface PassResult {
    text: string;
    rawText: string;
    confidence: number;
    words: OcrWordLike[];
    score: number;
    alnum: number;
    signals: number;
  }

  /** Runs one recognition and normalises its output into a PassResult. */
  const runPass = async (
    worker: Tesseract.Worker,
    imageUrl: string,
    psm: string,
    whitelist: string
  ): Promise<PassResult> => {
    await applyTesseractParams(worker, psm, whitelist);
    const res = await worker.recognize(imageUrl);
    const data: any = res.data || {};

    const rawWords: OcrWordLike[] = (data.words || []).map((w: any) => ({
      text: String(w.text || ''),
      confidence: Number(w.confidence || 0),
      bbox: w.bbox
    }));

    // Drop noise words but keep short ones, since "IP", "mg" and single-digit
    // strengths are meaningful on packaging.
    const kept = rawWords.filter(
      w => w.text.trim().length > 0 && w.confidence >= 30
    );

    const confidence = kept.length
      ? Math.round(kept.reduce((s, w) => s + w.confidence, 0) / kept.length)
      : Math.round(Number(data.confidence || 0));

    // Reconstruct visual lines. Label/value association depends on it, so a
    // flat space-joined string is not good enough here.
    const rawText = kept.length
      ? groupWordsIntoLines(kept, String(data.text || ''))
      : String(data.text || '').trim();

    const text = correctOcrText(rawText);
    const { score, alnum, signals } = scoreOcrResult(text, confidence);

    return { text, rawText, confidence, words: kept, score, alnum, signals };
  };

  /**
   * Decides whether a pass is good enough to stop escalating.
   *
   * Surfaces that legitimately carry only a few characters (a foil with just
   * a batch number and expiry) are judged on whether they found the fields
   * that matter, not on raw text volume.
   */
  const isSufficient = (surface: OcrSurface, result: PassResult): boolean => {
    if (surface === 'codes' || surface === 'foil') {
      if (result.signals >= 2 && result.confidence >= 55) return true;
      return result.score >= 62 && result.alnum >= 18;
    }
    return result.score >= 62 && result.alnum >= 25;
  };

  /** Label tokens worth re-reading at high magnification. */
  const REFINE_LABELS = /^(EXP|EXPIRY|MFG|MFD|B\.?NO|BATCH|LOT|MRP)$/i;

  /**
   * Label-anchored region refinement.
   *
   * Once a pass has located "EXP" or "B.No", that line is cropped, magnified
   * and re-read on its own with a restricted alphabet and single-line
   * segmentation. Most batch and date accuracy comes from this step, and it
   * is cheap because the crops are tiny.
   */
  const refineLabelRegions = async (
    worker: Tesseract.Worker,
    imageUrl: string,
    words: OcrWordLike[],
    maxCrops: number
  ): Promise<PassResult[]> => {
    const anchors = words.filter(w => {
      const clean = w.text.replace(/[^A-Za-z.]/g, '');
      return REFINE_LABELS.test(clean) && !!w.bbox;
    });
    if (anchors.length === 0) return [];

    let dimsSource: HTMLImageElement;
    try {
      dimsSource = await loadImage(imageUrl);
    } catch {
      return [];
    }
    const iw = dimsSource.naturalWidth || dimsSource.width;
    const ih = dimsSource.naturalHeight || dimsSource.height;
    if (!iw || !ih) return [];

    const results: PassResult[] = [];
    const used: Array<{ y0: number; y1: number }> = [];

    for (const anchor of anchors.slice(0, maxCrops)) {
      const box = anchor.bbox!;
      const lineHeight = Math.max(8, box.y1 - box.y0);

      // Skip a line we already refined via another label on the same row.
      if (used.some(u => Math.abs((u.y0 + u.y1) / 2 - (box.y0 + box.y1) / 2) < lineHeight)) {
        continue;
      }
      used.push({ y0: box.y0, y1: box.y1 });

      // Take the full width from just left of the label to the image edge:
      // the value always follows its label on the same line.
      const pad = lineHeight * 0.55;
      const region = {
        x0: Math.max(0, (box.x0 - pad) / iw),
        y0: Math.max(0, (box.y0 - pad) / ih),
        x1: 1,
        y1: Math.min(1, (box.y1 + pad) / ih)
      };

      try {
        const crop = await cropAndMagnify(imageUrl, region, 3);
        if (!crop) continue;
        // PSM 7 treats the crop as a single text line.
        const res = await runPass(worker, crop, '7', CODE_CHARS);
        if (res.alnum >= 3) results.push(res);
      } catch (cropErr) {
        console.warn('Label region refinement warning:', cropErr);
      }
    }

    return results;
  };

  // --- ADAPTIVE OCR PER PHOTO ---

  /**
   * Runs the smallest set of passes that produces a confident reading.
   *
   * A single measurement drives the preprocessing choice, then passes
   * escalate only while the result is insufficient:
   *   1. planned preprocessing at the surface's natural segmentation mode
   *   2. an alternate rendering (binarisation and segmentation flipped)
   *   3. a half turn, when the text still looks unreadable
   *   4. magnified re-reads of any located EXP / B.No / MRP lines
   *
   * A clean, well-lit front photo therefore costs one pass, where the
   * previous implementation always cost at least two and often five.
   */
  const processPhotoAdaptive = async (
    photo: CapturedPhoto,
    worker: Tesseract.Worker,
    onStatus: (msg: string) => void
  ): Promise<OcrEvidence[]> => {
    const evidence: OcrEvidence[] = [];
    const stats = photo.stats || (await analyzeImage(photo.dataUrl));
    if (!stats) return evidence;

    // Narrow portrait captures are usually medicine strips even when the
    // user leaves the box mode selected. Treat their dense label panel as a
    // column so small print is not forced through the brand-text layout.
    const isNarrowStrip = stats.height > stats.width * 1.25 && stats.width < 900;
    const surface = isNarrowStrip && photo.source === 'front'
      ? 'composition'
      : surfaceForSource(photo.source);
    const ocrInput = isNarrowStrip
      ? await cropAndMagnify(photo.dataUrl, { x0: 0.12, y0: 0, x1: 0.88, y1: 1 }, 1)
      : photo.dataUrl;
    const sourceForOcr = ocrInput || photo.dataUrl;

    const plan = buildPreprocessPlan(stats, surface);
    const orientationOffset = plan.quarterTurn ? 90 : 0;

    const record = (result: PassResult, variant: string, orientation: number) => {
      if (!result.text.trim()) return;
      evidence.push({
        source: photo.source,
        text: result.text,
        rawText: result.rawText,
        confidence: result.confidence,
        variant,
        orientation,
        words: result.words.map(w => ({
          text: w.text,
          confidence: w.confidence,
          bbox: w.bbox
        }))
      });
    };

    // --- Pass 1: the planned rendering ---
    onStatus(`Reading ${photo.label}...`);
    const primaryPsm = primaryPsmFor(surface);
    const primaryUrl = await renderPreprocessed(sourceForOcr, plan);
    const primary = await runPass(worker, primaryUrl, primaryPsm, ALL_CHARS);
    record(primary, `adaptive-${plan.label}-psm${primaryPsm}`, orientationOffset);

    let best = primary;
    let bestUrl = primaryUrl;

    // --- Pass 2: alternate rendering, only if needed ---
    if (!isSufficient(surface, primary)) {
      onStatus(`Enhancing ${photo.label}...`);
      const altPlan = {
        ...plan,
        // Flip the thresholding decision: binarisation rescues small dense
        // print, while plain grayscale rescues faint foil lettering.
        binarize: !plan.binarize,
        clahe: true,
        stretch: true,
        sharpen: plan.binarize ? 0.8 : 1.4
      };
      const altPsm = primaryPsm === '11' ? '6' : '11';
      const altUrl = await renderPreprocessed(sourceForOcr, altPlan);
      const alt = await runPass(worker, altUrl, altPsm, ALL_CHARS);
      record(alt, `alt-${altPlan.binarize ? 'sauvola' : 'gray'}-psm${altPsm}`, orientationOffset);

      if (alt.score > best.score) {
        best = alt;
        bestUrl = altUrl;
      }
    }

    // --- Pass 3: half turn, only when the text still looks unreadable ---
    // Tilt and quarter turns are already corrected geometrically, so 180
    // degrees is the one ambiguity that projection analysis cannot resolve.
    if (best.alnum < 15 || best.confidence < 42) {
      onStatus(`Checking orientation of ${photo.label}...`);
      try {
        const flippedUrl = await rotateDataUrl(bestUrl, 180);
        const flipped = await runPass(worker, flippedUrl, primaryPsm, ALL_CHARS);
        if (flipped.score > best.score + 8) {
          record(flipped, 'orientation-180', (orientationOffset + 180) % 360);
          best = flipped;
          bestUrl = flippedUrl;
        }
      } catch (rotErr) {
        console.warn('Orientation retry warning:', rotErr);
      }
    }

    // --- Pass 4: magnified re-read of located code lines ---
    const wantsCodes = surface === 'codes' || surface === 'foil' || surface === 'composition';
    if (best.words.length > 0 && (wantsCodes || best.signals > 0)) {
      onStatus(`Reading batch and expiry details on ${photo.label}...`);
      const refined = await refineLabelRegions(worker, bestUrl, best.words, wantsCodes ? 3 : 2);
      for (const r of refined) {
        record(r, 'region-magnified', orientationOffset);
      }
    }

    return evidence;
  };

  // --- OCR FUSION & DEDUPLICATION ---
  const fuseOcrEvidence = (evidenceList: OcrEvidence[]): {
    combinedOcrText: string;
    textBySource: Record<PhotoSource, string>;
    ocrConfidence: number;
  } => {
    const textBySource: Record<PhotoSource, string> = {
      front: '',
      back: '',
      side: '',
      'strip-front': '',
      'strip-back': ''
    };

    const sources: PhotoSource[] = ['front', 'back', 'side', 'strip-front', 'strip-back'];
    let totalConfidenceWeight = 0;
    let weightedConfidenceSum = 0;

    for (const src of sources) {
      const items = evidenceList.filter(e => e.source === src);
      if (items.length === 0) continue;

      const bestItemConf = Math.max(...items.map(e => e.confidence));
      weightedConfidenceSum += bestItemConf;
      totalConfidenceWeight++;

      // Magnified region re-reads are the most reliable source for the
      // fields they target, so they are offered to the fuser first and win
      // ties against the same line read from the full image.
      const ordered = [...items].sort((a, b) => {
        const aRegion = a.variant.startsWith('region-') ? 1 : 0;
        const bRegion = b.variant.startsWith('region-') ? 1 : 0;
        if (aRegion !== bRegion) return bRegion - aRegion;
        return b.confidence - a.confidence;
      });

      const rawLines: Array<{ line: string; conf: number }> = [];
      for (const item of ordered) {
        const lines = item.text.split('\n').map(l => l.trim()).filter(Boolean);
        for (const l of lines) {
          if (l.length >= 2) {
            rawLines.push({ line: l, conf: item.confidence });
          }
        }
      }

      textBySource[src] = fuseLines(rawLines).join('\n');
    }

    const combinedOcrText = Object.entries(textBySource)
      .filter(([, text]) => Boolean(text.trim()))
      .map(([source, text]) => `\n--- [${source}] ---\n${text.trim()}`)
      .join('\n');

    const ocrConfidence = totalConfidenceWeight > 0
      ? Math.round(weightedConfidenceSum / totalConfidenceWeight)
      : 0;

    return { combinedOcrText, textBySource, ocrConfidence };
  };

  // --- RUN SMART OCR AND IDENTIFICATION ---
  const runSmartAnalysis = async () => {
    if (capturedPhotos.length === 0) return;

    setStage('analyzing');
    stopCamera();
    setOcrProgress(5);
    setOcrStatusText('Initializing Tesseract neural OCR engine...');

    const allEvidence: OcrEvidence[] = [];
    const qualityAlerts: string[] = [];

    let worker: Tesseract.Worker | null = null;

    try {
      worker = await Tesseract.createWorker('eng', 1, {
        logger: (m: any) => {
          if (m.status === 'recognizing text' && m.progress) {
            const step = Math.round(m.progress * (60 / capturedPhotos.length));
            setOcrProgress(prev => Math.min(85, prev + Math.round(step * 0.2)));
          }
        }
      });

      // Process each photo adaptively
      for (let i = 0; i < capturedPhotos.length; i++) {
        const photo = capturedPhotos[i];
        const baseProgress = 10 + Math.round((i / capturedPhotos.length) * 60);
        setOcrProgress(baseProgress);
        setOcrStatusText(`Analyzing ${photo.label}...`);

        if (photo.qualityWarning) {
          qualityAlerts.push(`${photo.label}: ${photo.qualityWarning}`);
        }

        try {
          const evidence = await processPhotoAdaptive(photo, worker, (msg) => {
            setOcrStatusText(msg);
          });
          allEvidence.push(...evidence);
        } catch (photoErr) {
          console.warn(`Error processing photo ${photo.label}:`, photoErr);
        }
      }
    } catch (err: any) {
      console.error('OCR Worker initialization failed:', err);
    } finally {
      if (worker) {
        try {
          await worker.terminate();
        } catch (termErr) {
          console.warn('Worker terminate error:', termErr);
        }
      }
    }

    setOcrProgress(75);
    setOcrStatusText('Combining multi-angle evidence and fusing readings...');

    // Fuse evidence into source-specific and deduplicated text
    const { combinedOcrText, textBySource, ocrConfidence } = fuseOcrEvidence(allEvidence);

    setTextBySourceState(textBySource);
    setOcrConfidenceState(ocrConfidence);
    setOcrEvidenceState(allEvidence);
    setRawText(combinedOcrText);

    setQualityWarning(qualityAlerts.length > 0 ? qualityAlerts.join(' • ') : '');

    setOcrProgress(85);
    setOcrStatusText('Matching against PharmaSense medicine catalog...');

    // Call backend identify API with multi-angle evidence and source details
    let identification: any = null;

    try {
      identification = await api.identifyMedicine({
        text: combinedOcrText,
        textBySource,
        ocrConfidence,
        ocrEvidence: allEvidence,
        existingMedicines: medicines,
        photos: capturedPhotos.map(photo => photo.dataUrl)
      });
    } catch (backendErr) {
      console.warn('Backend identification fallback:', backendErr);
    }

    if (identification) {
      if (identification.vlmUsed === true) {
        setOcrStatusText('Gemini Vision fallback completed. Review the contributed fields.');
      }
      setIdentificationResult(identification);

      const ext = identification.extractedFields || {};
      const pkg = identification.packageFields || {};
      const matched = identification.matchedMedicine;

      const resolvedName = matched?.name || ext.medicine_name || ext.brand_name || '';
      const resolvedGeneric = matched?.composition || ext.composition || ext.generic_name || '';
      const resolvedMfr = matched?.manufacturer || ext.manufacturer || '';
      const resolvedStrength = ext.strength || (matched?.name?.match(/\b\d+\s*(?:mg|mcg|g|ml|iu)\b/i)?.[0] || '');
      const resolvedForm = ext.dosage_form || matched?.type || 'Tablet';
      const resolvedMrp = pkg.mrp || ext.mrp || matched?.price || 0;
      const resolvedBatch = pkg.batch_no || ext.batch_no || '';
      const resolvedExp = pkg.expiry_date || ext.expiry_date || '';
      const resolvedMfg = pkg.manufacturing_date || ext.manufacturing_date || '';
      const resolvedBarcode = pkg.barcode || ext.barcode || '';
      const resolvedDesc = matched?.description || '';

      setReviewedData({
        name: resolvedName,
        genericName: resolvedGeneric,
        category: determineCategory(resolvedGeneric || resolvedName),
        manufacturer: resolvedMfr,
        strength: resolvedStrength,
        unit: resolvedForm,
        mrp: resolvedMrp,
        batchNumber: resolvedBatch,
        expiryDate: resolvedExp,
        manufacturingDate: resolvedMfg,
        description: resolvedDesc,
        barcode: resolvedBarcode
      });
    } else {
      setIdentificationResult({
        identified: false,
        confidence: ocrConfidence,
        matchType: 'not_found',
        askVerification: true,
        isAlreadyInFormulary: false,
        existingFormularyId: null,
        matchedMedicine: null,
        extractedFields: {
          medicine_name: '',
          strength: '',
          dosage_form: 'Tablet',
          manufacturer: '',
          composition: '',
          batch_no: '',
          manufacturing_date: '',
          expiry_date: '',
          mrp: 0,
          storage_instructions: '',
          warnings: ''
        }
      });
    }

    setOcrProgress(100);
    setStage('review');
  };

  // Helper: Switch to an alternate candidate catalog record
  const handleSelectCandidate = (candidate: any) => {
    if (!candidate) return;
    setReviewedData(prev => ({
      ...prev,
      name: candidate.name || prev.name,
      genericName: candidate.composition || prev.genericName,
      manufacturer: candidate.manufacturer || prev.manufacturer,
      strength: candidate.strength || (candidate.name?.match(/\b\d+\s*(?:mg|mcg|g|ml|iu)\b/i)?.[0] || prev.strength),
      unit: candidate.type || prev.unit,
      category: determineCategory(candidate.composition || candidate.name || prev.category)
    }));

    setIdentificationResult(prev => {
      if (!prev) return null;
      return {
        ...prev,
        matchedMedicine: candidate,
        identified: true,
        confidence: candidate.score || prev.confidence
      };
    });
  };

  // Helper to categorize medicines
  const determineCategory = (text: string): string => {
    const lower = text.toLowerCase();
    if (/paracetamol|ibuprofen|aspirin|analgesic|fever|pain/i.test(lower)) return 'Analgesic & Antipyretic';
    if (/amoxicillin|azithromycin|clavulanic|cefixime|ciprofloxacin|antibiotic/i.test(lower)) return 'Antibiotics';
    if (/metformin|glimepiride|vildagliptin|insulin|diabetic/i.test(lower)) return 'Antidiabetic';
    if (/amlodipine|telmisartan|losartan|atenolol|hypertensive/i.test(lower)) return 'Antihypertensive';
    if (/atorvastatin|rosuvastatin|clopidogrel|cardio/i.test(lower)) return 'Cardiovascular';
    if (/dextromethorphan|ambroxol|cetirizine|cough|cold/i.test(lower)) return 'Cough & Cold';
    if (/levocetirizine|fexofenadine|chlorpheniramine|antihistamine/i.test(lower)) return 'Antihistamine';
    if (/calcium|vitamin|iron|zinc|folic|supplement/i.test(lower)) return 'Vitamins & Supplements';
    if (/pantoprazole|omeprazole|rabeprazole|antacid|gastro/i.test(lower)) return 'Gastrointestinal';
    return 'Analgesic & Antipyretic';
  };

  // Pharmacist confirms and accepts result
  const handleConfirmAndUse = () => {
    const matched = identificationResult?.matchedMedicine;

    const payload: SmartCaptureResult = {
      barcode: reviewedData.barcode || `MED-${Date.now().toString().slice(-6)}`,
      name: reviewedData.name || 'Unknown Medicine',
      genericName: reviewedData.genericName || reviewedData.name,
      category: reviewedData.category,
      // Never substitute a placeholder manufacturer. The pharmacist reviewed
      // and confirmed this field as blank, and inventing a value here would
      // silently overwrite what they actually saw.
      manufacturer: reviewedData.manufacturer,
      strength: reviewedData.strength,
      unit: reviewedData.unit,
      mrp: Number(reviewedData.mrp) || 0,
      description: reviewedData.description || `${reviewedData.name} - Identified via Smart Medicine Capture.`,
      type: reviewedData.unit,
      // Report the confidence actually achieved. Falling back to 90 meant a
      // failed identification was handed downstream as a high-trust match.
      confidence: identificationResult?.confidence || ocrConfidenceState || 0,
      isNewCode: !identificationResult?.isAlreadyInFormulary,
      batchNumber: reviewedData.batchNumber,
      expiryDate: reviewedData.expiryDate,
      manufacturingDate: identificationResult?.extractedFields?.manufacturing_date,
      dosageForm: reviewedData.unit,
      composition: reviewedData.genericName,
      sideEffects: matched?.side_effects,
      matchedDatasetId: matched?.id,
      isAlreadyInFormulary: identificationResult?.isAlreadyInFormulary,
      matchType: identificationResult?.matchType,
      rawOcrText: rawText
    };

    onScanMatch(payload);
    onClose();
  };

  // Reset to capture mode
  const handleRetake = () => {
    setCapturedPhotos([]);
    setIdentificationResult(null);
    setRawText('');
    setTextBySourceState({ front: '', back: '', side: '', 'strip-front': '', 'strip-back': '' });
    setOcrEvidenceState([]);
    setOcrConfidenceState(0);
    setStage('capture');
    startCamera();
  };

  // Confidence badge renderer
  const renderConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Verified High Match ({confidence}%)
        </span>
      );
    } else if (confidence >= 75) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-teal-500/10 text-teal-600 border border-teal-500/20">
          <Sparkles className="h-3.5 w-3.5" />
          Good Match ({confidence}%)
        </span>
      );
    } else if (confidence >= 55) {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
          <AlertCircle className="h-3.5 w-3.5" />
          Review & Verify ({confidence}%)
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-orange-500/10 text-orange-600 border border-orange-500/20">
          <ShieldAlert className="h-3.5 w-3.5" />
          Pharmacist Verification Required ({confidence}%)
        </span>
      );
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-3 sm:p-5 animate-fade-in overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl border border-slate-100 overflow-hidden my-auto flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-teal-500/20 border border-teal-500/30 rounded-xl">
              <Camera className="h-5 w-5 text-teal-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-display font-bold text-lg text-white">Smart Medicine Capture</h2>
                <span className="bg-teal-500/20 text-teal-300 font-mono text-[10px] uppercase font-bold px-2 py-0.5 rounded-full border border-teal-500/30">
                  Adaptive OCR
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Multi-angle camera scan for medicine boxes and blister strips with structured packaging evidence.
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-slate-800 transition-all cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body Content by Stage */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-50/50">

          {/* STAGE 1: CAPTURE PHOTO(S) */}
          {stage === 'capture' && (
            <div className="space-y-4">

              {/* Package Type Selector (Box Mode vs Strip Mode) */}
              <div className="flex flex-wrap items-center justify-between gap-2 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider pl-1">
                    Packaging Format:
                  </span>
                </div>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSwitchPackageMode('box')}
                    className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      packageMode === 'box'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Box className="h-3.5 w-3.5 text-teal-400" />
                    Medicine Box (3 Sides)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchPackageMode('strip')}
                    className={`text-xs px-3.5 py-1.5 rounded-xl font-bold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                      packageMode === 'strip'
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Pill className="h-3.5 w-3.5 text-teal-400" />
                    Blister Strip (Foil / Face)
                  </button>
                </div>
              </div>

              {/* Camera Viewfinder & Controls */}
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-video max-h-[360px] flex items-center justify-center border border-slate-800 shadow-inner">
                {/* Video element */}
                <video 
                  ref={videoRef} 
                  autoPlay 
                  playsInline 
                  muted 
                  className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`}
                />

                {cameraActive ? (
                  <>
                    {/* Framing Guide Reticle */}
                    <div className="absolute inset-5 sm:inset-8 border-2 border-teal-400/50 rounded-xl pointer-events-none flex flex-col justify-between p-3">
                      <div className="flex justify-between items-start">
                        <span className="font-mono text-[10px] bg-slate-900/85 text-teal-300 px-2.5 py-1 rounded backdrop-blur-xs font-semibold border border-teal-500/30">
                          {activeSlotConfig.label} • {activeSlotConfig.badge}
                        </span>
                        <div className="h-3.5 w-3.5 border-t-2 border-r-2 border-teal-400" />
                      </div>
                      <div className="flex justify-center text-center">
                        <span className="text-[11px] text-white/90 bg-slate-900/80 px-3.5 py-1 rounded-full backdrop-blur-xs font-medium border border-slate-700/50">
                          {activeSlotConfig.hint}
                        </span>
                      </div>
                      <div className="flex justify-between items-end">
                        <div className="h-3.5 w-3.5 border-b-2 border-l-2 border-teal-400" />
                        <div className="h-3.5 w-3.5 border-b-2 border-r-2 border-teal-400" />
                      </div>
                    </div>

                    {/* Camera Control overlay */}
                    <div className="absolute top-3 right-3 flex items-center gap-2">
                      <button
                        onClick={toggleFacingMode}
                        type="button"
                        className="p-2 bg-slate-900/70 text-slate-200 hover:text-white rounded-lg backdrop-blur-xs border border-slate-700/50 hover:bg-slate-900 transition-all cursor-pointer"
                        title="Flip Camera"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="text-center p-6 text-slate-300 max-w-md animate-fade-in">
                    {cameraError === 'PERMISSION_DENIED' ? (
                      <div className="space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center mx-auto text-amber-400">
                          <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Camera Access Blocked in Browser</p>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            Chrome blocked camera permissions for this site.
                          </p>
                        </div>
                        <div className="bg-slate-900/90 border border-slate-700/80 rounded-xl p-3 text-left space-y-1.5 text-xs text-slate-300">
                          <div className="font-semibold text-teal-400 text-[11px] uppercase tracking-wider">How to unblock:</div>
                          <div className="flex items-start gap-2 text-[11px]">
                            <span className="bg-teal-600/30 text-teal-300 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]">1</span>
                            <span>Click the <b>camera icon</b> in Chrome address bar</span>
                          </div>
                          <div className="flex items-start gap-2 text-[11px]">
                            <span className="bg-teal-600/30 text-teal-300 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]">2</span>
                            <span>Select <b>"Always allow access to camera"</b></span>
                          </div>
                          <div className="flex items-start gap-2 text-[11px]">
                            <span className="bg-teal-600/30 text-teal-300 font-mono font-bold px-1.5 py-0.5 rounded text-[10px]">3</span>
                            <span>Click <b>Retry Camera</b></span>
                          </div>
                        </div>
                        <div className="flex justify-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry Camera
                          </button>
                        </div>
                      </div>
                    ) : cameraError === 'CAMERA_IN_USE' ? (
                      <div className="space-y-3">
                        <div className="w-12 h-12 rounded-2xl bg-orange-500/20 border border-orange-500/30 flex items-center justify-center mx-auto text-orange-400">
                          <AlertCircle className="h-6 w-6" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Camera is in Use</p>
                          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                            Webcam is currently locked by another application.
                          </p>
                        </div>
                        <div className="flex justify-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry Camera
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <Camera className="h-12 w-12 text-slate-600 mx-auto animate-pulse" />
                        <div>
                          <p className="text-sm font-semibold text-slate-200">Camera Inactive or Not Detected</p>
                          <p className="text-xs text-slate-400 mt-1">
                            Allow camera access or upload package images below.
                          </p>
                        </div>
                        <div className="flex justify-center gap-3 pt-1">
                          <button
                            type="button"
                            onClick={startCamera}
                            className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-xl transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-sm"
                          >
                            <RefreshCw className="h-3.5 w-3.5" />
                            Retry Camera
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Bar: Slot Selection & Capture Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Target Angle:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {currentSlots.map((slot) => {
                      const isCaptured = capturedPhotos.some(p => p.source === slot.source);
                      const isSelected = activeSource === slot.source;
                      return (
                        <button
                          key={slot.source}
                          type="button"
                          onClick={() => setActiveSource(slot.source)}
                          className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer inline-flex items-center gap-1.5 ${
                            isSelected
                              ? 'bg-teal-600 text-white shadow-xs' 
                              : isCaptured
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {isCaptured && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                          {slot.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {cameraActive && (
                    <button
                      type="button"
                      onClick={handleSnapPhoto}
                      className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md transition-all cursor-pointer"
                    >
                      <Camera className="h-4 w-4" />
                      Snap Photo
                    </button>
                  )}

                  <label className="flex items-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer">
                    <Upload className="h-4 w-4 text-slate-500" />
                    Upload Image
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Gallery of Captured Photos */}
              {capturedPhotos.length > 0 && (
                <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-2">
                      <Layers className="h-4 w-4 text-teal-600" />
                      Captured Angles ({capturedPhotos.length} {capturedPhotos.length === 1 ? 'Angle' : 'Angles'})
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Multi-angle captures improve batch, expiry, and composition detection.
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {capturedPhotos.map((photo) => (
                      <div key={photo.id} className="group relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-video shadow-xs">
                        <img 
                          src={photo.dataUrl} 
                          alt={photo.label} 
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/40 group-hover:bg-slate-950/65 transition-all flex flex-col justify-between p-2">
                          <div className="flex items-start justify-between gap-1">
                            <span className="text-[10px] font-mono font-bold text-white bg-slate-900/80 px-2 py-0.5 rounded backdrop-blur-xs">
                              {photo.label}
                            </span>
                            {photo.width && photo.height && (
                              <span className="text-[9px] font-mono text-slate-300 bg-slate-800/80 px-1.5 py-0.5 rounded">
                                {photo.width}×{photo.height}
                              </span>
                            )}
                          </div>
                          <div className="flex justify-between items-end">
                            {photo.qualityWarning ? (
                              <span className="text-[9px] text-amber-300 bg-amber-950/80 px-1.5 py-0.5 rounded flex items-center gap-1" title={photo.qualityWarning}>
                                <AlertTriangle className="h-3 w-3 shrink-0" />
                                Review
                              </span>
                            ) : <div />}
                            <button
                              type="button"
                              onClick={() => handleRemovePhoto(photo.id)}
                              className="p-1.5 bg-red-500/80 hover:bg-red-600 text-white rounded-lg transition-all cursor-pointer"
                              title="Delete photo"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Quality tip notice if any photo had quality alert */}
                  {capturedPhotos.some(p => p.qualityWarning) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-800 flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <span className="font-bold">Quality Notice: </span>
                        One or more images may have reflections or low contrast. For best accuracy, position packaging flat under even light.
                      </div>
                    </div>
                  )}

                  {/* Run OCR button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={runSmartAnalysis}
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 text-white font-bold text-sm rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer"
                    >
                      <Sparkles className="h-4 w-4" />
                      Analyze & Identify Medicine
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Manual Entry Fallback Option */}
              <div className="flex items-center justify-between px-2 pt-2 text-xs text-slate-500">
                <span>Prefer typing details manually?</span>
                <button
                  type="button"
                  onClick={() => {
                    stopCamera();
                    onClose();
                    if (onManualEntry) onManualEntry();
                  }}
                  className="font-bold text-teal-600 hover:text-teal-700 hover:underline cursor-pointer inline-flex items-center gap-1"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Switch to Manual Medicine Entry
                </button>
              </div>
            </div>
          )}

          {/* STAGE 2: ANALYZING (ADAPTIVE OCR PROGRESS) */}
          {stage === 'analyzing' && (
            <div className="py-14 flex flex-col items-center justify-center text-center space-y-6">
              <div className="relative">
                <div className="h-20 w-20 rounded-full border-4 border-teal-100 border-t-teal-600 animate-spin flex items-center justify-center">
                  <Sparkles className="h-8 w-8 text-teal-600" />
                </div>
              </div>

              <div className="space-y-2 max-w-md">
                <h3 className="font-display font-bold text-lg text-slate-900">
                  Smart Medicine Capture in Progress
                </h3>
                <p className="text-xs text-slate-500 leading-relaxed font-mono">
                  {ocrStatusText}
                </p>
              </div>

              {/* Progress Bar */}
              <div className="w-full max-w-md bg-slate-200 rounded-full h-3 overflow-hidden shadow-inner">
                <div 
                  className="bg-gradient-to-r from-teal-500 to-emerald-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
              <span className="font-mono text-xs font-bold text-slate-600">
                {ocrProgress}% Completed
              </span>
            </div>
          )}

          {/* STAGE 3: REVIEW & VERIFICATION */}
          {stage === 'review' && (
            <div className="space-y-5">
              {/* Match Header / Confidence Banner */}
              <div className={`p-4.5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                identificationResult?.matchType === 'not_found'
                  ? 'bg-purple-50/70 border-purple-200'
                  : identificationResult?.identified 
                    ? 'bg-emerald-50/70 border-emerald-200' 
                    : 'bg-amber-50/70 border-amber-200'
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-xl ${
                    identificationResult?.matchType === 'not_found'
                      ? 'bg-purple-600 text-white'
                      : identificationResult?.identified 
                        ? 'bg-emerald-500 text-white' 
                        : 'bg-amber-500 text-white'
                  }`}>
                    {identificationResult?.matchType === 'not_found' ? (
                      <Sparkles className="h-6 w-6" />
                    ) : identificationResult?.identified ? (
                      <CheckCircle2 className="h-6 w-6" />
                    ) : (
                      <AlertTriangle className="h-6 w-6" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display font-bold text-base text-slate-900">
                        {identificationResult?.matchType === 'not_found'
                          ? 'NEW MEDICINE / NOT FOUND IN CATALOG'
                          : identificationResult?.identified
                            ? `Identified: ${identificationResult.matchedMedicine?.name || reviewedData.name}`
                            : 'Medicine Review & Registration'}
                      </h3>
                      {identificationResult?.matchType === 'not_found' && (
                        <span className="bg-purple-100 text-purple-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-purple-200 uppercase font-mono">
                          New Entry
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {identificationResult?.matchType === 'not_found'
                        ? 'This medicine is not yet in the national or local catalog. All extracted packaging fields have been prepared below for verification.'
                        : identificationResult?.identified
                          ? identificationResult.isAlreadyInFormulary
                            ? 'This medicine is already present in your pharmacy inventory formulary.'
                            : 'Matched in the PharmaSense 253,000+ national pharmaceutical catalog.'
                          : 'OCR extracted candidate details. Review and customize fields below to register into your inventory.'}
                    </p>
                  </div>
                </div>

                <div className="shrink-0 flex flex-col items-end gap-2">
                  {renderConfidenceBadge(identificationResult?.confidence || ocrConfidenceState || 0)}
                  {identificationResult?.vlmUsed === true ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-violet-500/10 text-violet-700 border border-violet-200">
                      <Sparkles className="h-3 w-3" />
                      Tesseract + Gemini Vision
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-200 text-slate-700 border border-slate-200">
                      <FileText className="h-3 w-3" />
                      Tesseract OCR
                    </span>
                  )}
                </div>
              </div>

              {/* Verification Warnings Alert Banner */}
              {identificationResult?.verificationWarnings && identificationResult.verificationWarnings.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 p-3.5 rounded-2xl space-y-1.5">
                  <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0" />
                    <span>Discrepancy / Pharmacist Verification Required:</span>
                  </div>
                  <ul className="list-disc list-inside text-xs text-rose-700 pl-1 space-y-1">
                    {identificationResult.verificationWarnings.map((warn, wIdx) => (
                      <li key={wIdx} className="leading-tight">{warn}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Pharmacist Safety Notice */}
              <div className="bg-slate-100 border-l-4 border-teal-600 px-4 py-3 rounded-r-xl text-xs text-slate-700 flex items-start gap-2">
                <ShieldAlert className="h-4 w-4 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-900">Pharmacist Verification Notice: </span>
                  Always cross-verify extracted batch numbers, expiry dates, and compositions against physical packaging before dispensing or updating inventory.
                </div>
              </div>

              {/* Candidate Matches Selection (If multiple candidates exist) */}
              {identificationResult?.candidates && identificationResult.candidates.length > 1 && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-teal-600" />
                      Possible Catalog Matches ({identificationResult.candidates.length} Candidates)
                    </span>
                    <span className="text-[11px] text-slate-400">
                      Click candidate to apply catalog specs
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {identificationResult.candidates.slice(0, 4).map((cand) => {
                      const isSelected = identificationResult.matchedMedicine?.id === cand.id || reviewedData.name === cand.name;
                      return (
                        <div
                          key={cand.id}
                          onClick={() => handleSelectCandidate(cand)}
                          className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                            isSelected
                              ? 'bg-teal-50/80 border-teal-300 ring-2 ring-teal-500/20'
                              : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-100/50'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-1">
                            <span className="font-bold text-slate-900 line-clamp-1">{cand.name}</span>
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 shrink-0">
                              {cand.score}% Match
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1 line-clamp-1">
                            {cand.composition || cand.manufacturer || 'Catalog match'}
                          </div>
                          {isSelected && (
                            <span className="text-[10px] font-bold text-teal-700 flex items-center gap-1 mt-1">
                              <Check className="h-3 w-3" /> Active Candidate
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Quality warning notice if flagged */}
              {qualityWarning && (
                <div className="bg-amber-50 border border-amber-200 px-4 py-2.5 rounded-xl text-xs text-amber-800 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <span>{qualityWarning}</span>
                </div>
              )}

              {/* Tab Navigation: Verification Form vs Raw OCR Text */}
              <div className="flex border-b border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveTab('review')}
                  className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'review'
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Pill className="h-4 w-4" />
                  Verified Medicine Specifications
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('rawText')}
                  className={`pb-2.5 px-4 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'rawText'
                      ? 'border-teal-600 text-teal-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="h-4 w-4" />
                  Raw OCR Packaging Output
                </button>
              </div>

              {/* Tab 1: Editable Fields for Pharmacist Review */}
              {activeTab === 'review' && (
                <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
                  {/* Section: Catalog / Medicine Identity */}
                  <div>
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      1. Medicine Catalog Identity
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                          Brand / Trade Name*
                        </label>
                        <input
                          type="text"
                          value={reviewedData.name}
                          onChange={(e) => setReviewedData({ ...reviewedData, name: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 font-semibold text-slate-900"
                          placeholder="e.g. Augmentin 625 Duo"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                          Generic / Salt Composition*
                        </label>
                        <input
                          type="text"
                          value={reviewedData.genericName}
                          onChange={(e) => setReviewedData({ ...reviewedData, genericName: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 text-slate-800"
                          placeholder="e.g. Amoxycillin (500mg) + Clavulanic Acid (125mg)"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                          Dosage Form / Unit
                        </label>
                        <input
                          type="text"
                          value={reviewedData.unit}
                          onChange={(e) => setReviewedData({ ...reviewedData, unit: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                          placeholder="Tablet, Capsule, Syrup..."
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                          Strength
                        </label>
                        <input
                          type="text"
                          value={reviewedData.strength}
                          onChange={(e) => setReviewedData({ ...reviewedData, strength: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 font-mono"
                          placeholder="e.g. 625mg, 500mg"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                          Manufacturer
                        </label>
                        <input
                          type="text"
                          value={reviewedData.manufacturer}
                          onChange={(e) => setReviewedData({ ...reviewedData, manufacturer: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500"
                          placeholder="e.g. GlaxoSmithKline"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Section: Physical Package Data */}
                  <div className="pt-2">
                    <span className="text-[11px] font-bold text-teal-800 uppercase tracking-wider block mb-2">
                      2. Physical Package & Batch Specifics (Isolated From Catalog)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-teal-50/50 p-3.5 rounded-xl border border-teal-100">
                      <div>
                        <label className="text-[10px] font-bold text-teal-800 block uppercase mb-1 flex items-center gap-1">
                          <Hash className="h-3 w-3 text-teal-600" />
                          Captured Batch Number
                        </label>
                        <input
                          type="text"
                          value={reviewedData.batchNumber}
                          onChange={(e) => setReviewedData({ ...reviewedData, batchNumber: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-white border border-teal-200 rounded-lg focus:outline-none focus:border-teal-500 font-mono font-bold text-slate-900"
                          placeholder="e.g. BT8492"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-teal-800 block uppercase mb-1 flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-teal-600" />
                          Captured Expiry Date
                        </label>
                        <input
                          type="text"
                          value={reviewedData.expiryDate}
                          onChange={(e) => setReviewedData({ ...reviewedData, expiryDate: e.target.value })}
                          className="w-full px-3 py-2 text-xs bg-white border border-teal-200 rounded-lg focus:outline-none focus:border-teal-500 font-mono font-bold text-slate-900"
                          placeholder="e.g. 12/2026 or 2027-04-30"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-teal-800 block uppercase mb-1 flex items-center gap-1">
                          <DollarSign className="h-3 w-3 text-teal-600" />
                          Packaging Printed MRP (₹)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={reviewedData.mrp}
                          onChange={(e) => setReviewedData({ ...reviewedData, mrp: parseFloat(e.target.value) || 0 })}
                          className="w-full px-3 py-2 text-xs bg-white border border-teal-200 rounded-lg focus:outline-none focus:border-teal-500 font-mono font-bold text-slate-900"
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 block uppercase mb-1">
                      Clinical Description / Therapeutic Usage
                    </label>
                    <textarea
                      value={reviewedData.description}
                      onChange={(e) => setReviewedData({ ...reviewedData, description: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-teal-500 text-slate-600 leading-relaxed"
                      placeholder="Brief therapeutic details, usage instructions, or side effects note..."
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Raw OCR Output */}
              {activeTab === 'rawText' && (
                <div className="bg-slate-900 text-slate-300 p-4 rounded-2xl font-mono text-xs overflow-x-auto max-h-64 whitespace-pre-wrap border border-slate-800">
                  {rawText || 'No text extracted from captured packaging.'}
                </div>
              )}

              {/* Actions Footer */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleRetake}
                  className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-slate-200/70 hover:bg-slate-200 rounded-xl cursor-pointer transition-all inline-flex items-center justify-center gap-1.5"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retake Photos
                </button>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      if (onManualEntry) onManualEntry();
                    }}
                    className="w-full sm:w-auto px-4 py-2.5 text-xs font-semibold text-slate-600 hover:text-slate-800 bg-white border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition-all"
                  >
                    Cancel & Manual Entry
                  </button>

                  <button
                    type="button"
                    onClick={handleConfirmAndUse}
                    className="w-full sm:w-auto px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-xl shadow-xs hover:shadow-md cursor-pointer transition-all inline-flex items-center justify-center gap-2"
                  >
                    <Check className="h-4 w-4" />
                    Confirm & Proceed
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
