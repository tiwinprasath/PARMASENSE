/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Feature Engineering Service for Supply Chain Intelligence
 */

/**
 * Calculates historical sales metrics for a medicine over multiple lookback windows.
 */
export function calculateSalesFeatures(sales, medicineId, currentDateStr) {
  const currentDate = new Date(currentDateStr);
  const medicineSales = (sales || []).filter((s) => s.medicineId === medicineId);

  const getSalesInWindow = (startDaysAgo, endDaysAgo = 0) => {
    const startDate = new Date(currentDate);
    startDate.setDate(startDate.getDate() - startDaysAgo);
    const endDate = new Date(currentDate);
    endDate.setDate(endDate.getDate() - endDaysAgo);

    return medicineSales.filter((s) => {
      const d = new Date(s.date);
      return d >= startDate && d <= endDate;
    });
  };

  const sales7d = getSalesInWindow(7, 0);
  const salesPrev7d = getSalesInWindow(14, 7);
  const sales14d = getSalesInWindow(14, 0);
  const sales30d = getSalesInWindow(30, 0);
  const salesPrev30d = getSalesInWindow(60, 30);
  const sales90d = getSalesInWindow(90, 0);

  const sumQty = (arr) => arr.reduce((acc, s) => acc + (Number(s.quantity) || 0), 0);

  const qty7d = sumQty(sales7d);
  const qtyPrev7d = sumQty(salesPrev7d);
  const qty14d = sumQty(sales14d);
  const qty30d = sumQty(sales30d);
  const qtyPrev30d = sumQty(salesPrev30d);
  const qty90d = sumQty(sales90d);

  // Demand growth calculation
  const growth7d = qtyPrev7d > 0 ? ((qty7d - qtyPrev7d) / qtyPrev7d) * 100 : (qty7d > 0 ? 100 : 0);
  const growth30d = qtyPrev30d > 0 ? ((qty30d - qtyPrev30d) / qtyPrev30d) * 100 : (qty30d > 0 ? 100 : 0);

  // Daily demand averages
  const dailyDemand7d = qty7d / 7;
  const dailyDemand30d = qty30d / 30;
  const dailyDemand90d = qty90d / 90;

  // Demand volatility (std dev of daily sales in 30 days)
  const dailyBuckets = Array(30).fill(0);
  sales30d.forEach((s) => {
    const saleDate = new Date(s.date);
    const diffDays = Math.floor((currentDate.getTime() - saleDate.getTime()) / (1000 * 3600 * 24));
    if (diffDays >= 0 && diffDays < 30) {
      dailyBuckets[diffDays] += Number(s.quantity) || 0;
    }
  });

  const meanDaily = dailyDemand30d;
  const variance = dailyBuckets.reduce((acc, val) => acc + Math.pow(val - meanDaily, 2), 0) / 30;
  const stdDev = Math.sqrt(variance);
  const volatility = meanDaily > 0 ? (stdDev / meanDaily) * 100 : 0;

  return {
    totalSalesCount: medicineSales.length,
    qty7d,
    qty14d,
    qty30d,
    qty90d,
    growth7d: Number(growth7d.toFixed(1)),
    growth30d: Number(growth30d.toFixed(1)),
    dailyDemand7d: Number(dailyDemand7d.toFixed(2)),
    dailyDemand30d: Number(dailyDemand30d.toFixed(2)),
    dailyDemand90d: Number(dailyDemand90d.toFixed(2)),
    demandVolatilityPercent: Number(volatility.toFixed(1)),
    recentAcceleration: Number((growth7d - growth30d).toFixed(1))
  };
}

/**
 * Calculates stock status, usable stock vs expiring stock based on FEFO (First Expire, First Out).
 */
export function calculateInventoryFeatures(inventoryList, medicineId, currentDateStr) {
  const currentDate = new Date(currentDateStr);
  const itemBatches = (inventoryList || []).filter((i) => i.medicineId === medicineId);

  let currentStock = 0;
  let usableStock = 0;
  let expiringSoon30d = 0;
  let expiredStock = 0;
  let minimumStock = 0;
  let maximumStock = 0;
  let reorderLevel = 0;
  let primarySupplierId = '';

  const cutoff30d = new Date(currentDate);
  cutoff30d.setDate(cutoff30d.getDate() + 30);

  itemBatches.forEach((batch) => {
    const qty = Number(batch.currentQuantity) || 0;
    currentStock += qty;
    minimumStock = Math.max(minimumStock, Number(batch.minimumStock) || 0);
    maximumStock = Math.max(maximumStock, Number(batch.maximumStock) || 0);
    reorderLevel = Math.max(reorderLevel, Number(batch.reorderLevel) || 0);
    if (batch.supplierId) primarySupplierId = batch.supplierId;

    if (batch.expiryDate) {
      const expDate = new Date(batch.expiryDate);
      if (expDate < currentDate) {
        expiredStock += qty;
      } else if (expDate <= cutoff30d) {
        expiringSoon30d += qty;
        // Expiring soon is treated as reduced usability
        usableStock += Math.round(qty * 0.3);
      } else {
        usableStock += qty;
      }
    } else {
      usableStock += qty;
    }
  });

  return {
    batchCount: itemBatches.length,
    currentStock,
    usableStock,
    expiringSoon30d,
    expiredStock,
    minimumStock: minimumStock || 20,
    maximumStock: maximumStock || 500,
    reorderLevel: reorderLevel || 40,
    primarySupplierId
  };
}

/**
 * Computes supplier reliability metrics.
 */
export function calculateSupplierFeatures(suppliers, supplierId) {
  const supplier = (suppliers || []).find((s) => s.id === supplierId);
  if (!supplier) {
    return {
      supplierName: 'Unassigned Supplier',
      leadTimeDays: 7, // Default fallback
      onTimeRate: 85, // Default percentage
      reliabilityScore: 80,
      leadTimeVarianceDays: 1.5
    };
  }

  const leadTimeDays = Number(supplier.deliveryTimeDays) || 7;
  const onTimeRate = Number(supplier.productAvailabilityPercent) || 90;
  const rating = Number(supplier.rating) || 4.0;
  const variance = Math.max(0.5, (100 - onTimeRate) / 20);

  return {
    supplierName: supplier.companyName || 'Supplier',
    leadTimeDays,
    onTimeRate,
    reliabilityScore: Math.round((onTimeRate * 0.7) + (rating * 6)),
    leadTimeVarianceDays: Number(variance.toFixed(1))
  };
}

/**
 * Extracts hospital demand signal if available.
 */
export function calculateHospitalDemandFeature(hospitalRecords, medicineId, currentDateStr) {
  const currentDate = new Date(currentDateStr);
  const thirtyDaysAgo = new Date(currentDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const relevant = (hospitalRecords || []).filter((h) => {
    if (h.medicineId !== medicineId) return false;
    const d = new Date(h.date);
    return d >= thirtyDaysAgo && d <= currentDate;
  });

  const totalRequested = relevant.reduce((acc, r) => acc + (Number(r.quantityRequested) || 0), 0);
  const dailyHospitalDemand = Number((totalRequested / 30).toFixed(2));

  return {
    hospitalOrderCount: relevant.length,
    totalHospitalRequested30d: totalRequested,
    dailyHospitalDemand,
    hasHospitalDemand: totalRequested > 0
  };
}
