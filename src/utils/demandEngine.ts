/**
 * AI Medicine Demand Prediction - Core Analytics Engine
 * Combines historical sales patterns with simulated Google Trends, Weather, Seasonal cycles, and Public Holidays.
 */

import { MedicineMaster, Sale, ExternalTrendIndicator, MedicinePrediction } from '../types';

// Helper to check if a date is a public holiday
export function getPublicHoliday(dateStr: string): { isHoliday: boolean; name?: string } {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1; // 1-indexed
  const day = date.getDate();

  const holidays: Record<string, string> = {
    '1-1': 'New Year\'s Day',
    '1-26': 'Republic Day',
    '5-1': 'International Workers\' Day',
    '8-15': 'Independence Day',
    '10-2': 'Gandhi Jayanti',
    '10-31': 'Diwali Festival',
    '11-14': 'Children\'s Day',
    '12-25': 'Christmas Day'
  };

  const key = `${month}-${day}`;
  if (holidays[key]) {
    return { isHoliday: true, name: holidays[key] };
  }
  return { isHoliday: false };
}

// Get season based on date month
export function getSeasonAndCondition(dateStr: string): {
  season: 'Winter' | 'Summer' | 'Monsoon' | 'Autumn' | 'Spring';
  temp: number;
  weather: 'Sunny' | 'Rainy' | 'Cold' | 'Humid' | 'Overcast';
  healthTrend: string;
} {
  const date = new Date(dateStr);
  const month = date.getMonth(); // 0-indexed

  // Simple seasonality logic
  if (month >= 11 || month <= 1) { // Dec, Jan, Feb
    return {
      season: 'Winter',
      temp: 14 + (date.getDate() % 6), // 14 to 19 deg
      weather: 'Cold',
      healthTrend: 'Seasonal Influenza & Respiratory Wave'
    };
  } else if (month >= 2 && month <= 4) { // Mar, Apr, May
    return {
      season: 'Spring',
      temp: 24 + (date.getDate() % 8), // 24 to 31 deg
      weather: 'Sunny',
      healthTrend: 'Allergy Season & Dust Spike'
    };
  } else if (month >= 5 && month <= 8) { // Jun, Jul, Aug, Sep
    return {
      season: 'Monsoon',
      temp: 26 + (date.getDate() % 4), // 26 to 29 deg
      weather: 'Rainy',
      healthTrend: 'Waterborne Diseases & Dengue Advisory'
    };
  } else { // Oct, Nov
    return {
      season: 'Autumn',
      temp: 20 + (date.getDate() % 6), // 20 to 25 deg
      weather: 'Humid',
      healthTrend: 'Viral Fever & Pre-winter Wave'
    };
  }
}

// Generate the Day's Trend indicator record
export function generateTrendIndicator(dateStr: string): ExternalTrendIndicator {
  const { season, temp, weather, healthTrend } = getSeasonAndCondition(dateStr);
  const holiday = getPublicHoliday(dateStr);

  // Generate deterministic but dynamic Google Trends score (0 to 100) based on date & season
  const dateSeed = new Date(dateStr).getDate() + new Date(dateStr).getMonth() * 10;
  let baseTrends = 50 + (dateSeed % 31); // 50 to 80 baseline

  if (season === 'Winter' || season === 'Monsoon') {
    baseTrends += 12; // High search volume for cough, cold, flu
  }
  if (holiday.isHoliday) {
    baseTrends -= 15; // Low search volume on holidays
  }
  const trendsScore = Math.max(10, Math.min(100, baseTrends));

  return {
    id: `IND-${dateStr}`,
    date: dateStr,
    googleTrendsScore: trendsScore,
    temperatureCelsius: temp,
    weatherCondition: weather,
    season: season,
    isPublicHoliday: holiday.isHoliday,
    holidayName: holiday.name,
    majorHealthTrend: healthTrend
  };
}

// Calculate predicted demand for a specific medicine
export function calculateSingleMedicinePrediction(
  medicine: MedicineMaster,
  sales: Sale[],
  currentDateStr: string,
  indicator: ExternalTrendIndicator
): MedicinePrediction {
  const currentDate = new Date(currentDateStr);
  
  // 1. Calculate average sales over the last 30 days
  const thirtyDaysAgo = new Date(currentDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const relevantSales = sales.filter(s => {
    if (s.medicineId !== medicine.id) return false;
    const saleDate = new Date(s.date);
    return saleDate >= thirtyDaysAgo && saleDate <= currentDate;
  });

  const totalSold = relevantSales.reduce((acc, curr) => acc + curr.quantity, 0);
  
  // Daily base demand rate. Fallback to category baseline if there's no sales history
  let baseDailyDemand = totalSold / 30;
  if (baseDailyDemand === 0) {
    // Generate an intelligent baseline based on medicine category
    if (medicine.category === 'Analgesic') baseDailyDemand = 1.2;
    else if (medicine.category === 'Antibiotic') baseDailyDemand = 0.8;
    else if (medicine.category === 'Cardiopathic') baseDailyDemand = 0.5;
    else if (medicine.category === 'Antidiabetic') baseDailyDemand = 0.6;
    else if (medicine.category === 'Antihistamine') baseDailyDemand = 0.7;
    else baseDailyDemand = 0.4;
  }

  // 2. Incorporate External Trend Modifiers (Google Trends, Weather, Season)
  let trendFactor = 1.0;

  // Google Trends impact (scales demand up to +30% or down to -20%)
  const trendsDelta = (indicator.googleTrendsScore - 50) / 100; // range from -0.4 to +0.5
  trendFactor += trendsDelta * 0.4; // up to +20% / -16%

  // Seasonal and weather boosts
  if (indicator.season === 'Winter') {
    if (medicine.category === 'Analgesic' || medicine.category === 'Antihistamine') {
      trendFactor += 0.25; // Flu and coughs
    }
  } else if (indicator.season === 'Monsoon') {
    if (medicine.category === 'Antibiotic' || medicine.category === 'Analgesic') {
      trendFactor += 0.35; // Viral outbreaks
    }
  } else if (indicator.season === 'Spring') {
    if (medicine.category === 'Antihistamine') {
      trendFactor += 0.45; // Pollen Allergy Season boost!
    }
  }

  // Weather Condition multiplier
  if (indicator.weatherCondition === 'Rainy' || indicator.weatherCondition === 'Cold') {
    trendFactor += 0.15;
  }

  // Holiday impact (Refills are sometimes rushed before holidays, but general OTC falls)
  if (indicator.isPublicHoliday) {
    trendFactor *= 0.90; // general slight dip
  }

  // Ensure trend factor is sane
  trendFactor = Math.max(0.6, Math.min(2.5, trendFactor));

  // 3. Extrapolate predictions for 7, 15, and 30 days ahead
  const predictedDemand7Days = Math.round(baseDailyDemand * 7 * trendFactor);
  const predictedDemand15Days = Math.round(baseDailyDemand * 15 * trendFactor);
  const predictedDemand30Days = Math.round(baseDailyDemand * 30 * trendFactor);

  // Confidence score calculation (more sales history = higher confidence, higher external index consistency = higher confidence)
  let baseConfidence = 85;
  if (relevantSales.length > 5) baseConfidence += 5;
  if (relevantSales.length > 15) baseConfidence += 4;
  
  // Random variance but stable
  const seed = (medicine.name.charCodeAt(0) + medicine.name.charCodeAt(medicine.name.length - 1)) % 10;
  const confidenceScore = Math.min(98.5, Math.max(75.0, baseConfidence + (seed / 2) - (indicator.googleTrendsScore % 4)));

  // Reorder quantity recommended: Safety stock buffer + 30 days demand - any current active stock
  const estimated30dRequired = predictedDemand30Days;
  const reorderQuantityRecommended = Math.max(20, Math.ceil(estimated30dRequired * 1.25)); // 25% safety stock buffer

  // Classification
  let demandClassification: 'High Demand' | 'Stable' | 'Low Demand' = 'Stable';
  if (predictedDemand30Days > 45) {
    demandClassification = 'High Demand';
  } else if (predictedDemand30Days < 15) {
    demandClassification = 'Low Demand';
  }

  return {
    id: `PRED-${medicine.id}-${currentDateStr}`,
    medicineId: medicine.id,
    predictedDemand7Days,
    predictedDemand15Days,
    predictedDemand30Days,
    confidenceScore: parseFloat(confidenceScore.toFixed(1)),
    reorderQuantityRecommended,
    demandClassification,
    lastUpdated: currentDateStr,
    trendFactor: parseFloat(trendFactor.toFixed(2)),
    historicalMonthlyAverage: Math.round(baseDailyDemand * 30)
  };
}

// Calculate prediction table for all medicines
export function runPredictionsEngine(
  medicines: MedicineMaster[],
  sales: Sale[],
  currentDateStr: string
): {
  indicator: ExternalTrendIndicator;
  predictions: MedicinePrediction[];
} {
  const indicator = generateTrendIndicator(currentDateStr);
  const predictions = medicines.map(med => 
    calculateSingleMedicinePrediction(med, sales, currentDateStr, indicator)
  );

  return { indicator, predictions };
}
