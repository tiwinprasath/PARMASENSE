# PharmaSense — Medicine Supply Chain Intelligence

## 1. Problem Statement & Motivation
Pharmaceutical inventory management differs critically from general retail inventory due to:
* **Severe human health consequences of stockouts**: Shortages of critical antibiotics, antidiabetics, or analgesics endanger patient lives.
* **Complex shelf-life & expiry constraints**: Medicines lose validity over time; standard FIFO inventory accounting fails to prevent batch expiration (necessitating strict FEFO — First Expire, First Out).
* **High demand volatility**: Regional health waves, seasonal weather changes, and institutional hospital requests create sudden demand acceleration.
* **Supplier delivery latency**: When stock coverage drops below supplier lead time during a demand surge, a critical shortage occurs before replenishment can arrive.

PharmaSense Supply Chain Intelligence transitions pharmacy operations from reactive stockout alarms to **proactive, explainable time-series shortage prediction and reorder decision support**.

---

## 2. System Architecture

```text
Existing PharmaSense (Medicines, Inventory Batches, Sales POS, Suppliers)
        │
        ├── API Data Consumption Layer
        ▼
Supply Chain Intelligence Subsystem
        ├── 1. Feature Engineering (Sales Velocity, FEFO Usable Stock, Volatility)
        ├── 2. Modular Demand Forecasting Engine (Baseline SMA vs Multi-Signal Ensemble)
        ├── 3. Stock Depletion & Lead Time Risk Engine
        ├── 4. Reorder Point & Safety Stock Optimizer
        ├── 5. Explainable AI (XAI) Reasoning Generator (What, When, Why, Action)
        ├── 6. Interactive Scenario Simulator & Supply Chain Digital Twin
        └── 7. Automated Model Evaluator (MAE, RMSE, WAPE, Shortage Recall/Precision)
```

---

## 3. Data Sources & Integration

| Source | Fields Utilized | Reliability / Status |
| :--- | :--- | :--- |
| **Pharmacy Sales POS** | `medicineId`, `quantity`, `date`, `price` | Primary Ground Truth |
| **Batch Inventory** | `currentQuantity`, `expiryDate`, `reorderLevel`, `supplierId` | Primary Ground Truth |
| **Supplier Hub** | `deliveryTimeDays`, `productAvailabilityPercent`, `rating` | Primary Ground Truth |
| **Hospital Demand Provider** | Institutional request orders via CSV/API | Institutional Signal |
| **Weather & Health Trends** | Regional temperatures, humidity, influenza waves | External Modifier |

---

## 4. Feature Engineering
* **Lookback Horizons**: 7-day, 14-day, 30-day, and 90-day moving windows.
* **Demand Growth & Acceleration**:
  $$\text{Growth}_{7d} = \frac{\text{Sales}_{0..7d} - \text{Sales}_{7..14d}}{\text{Sales}_{7..14d}} \times 100$$
* **FEFO Usable Stock Calculation**:
  $$\text{Usable Stock} = \sum_{\text{batches}} \begin{cases} 0 & \text{if } \text{expiry} < t_{\text{today}} \\ 0.3 \times \text{qty} & \text{if } \text{expiry} \le t_{\text{today}} + 30d \\ \text{qty} & \text{otherwise} \end{cases}$$
* **Stock Coverage (Days of Stock)**:
  $$\text{Days of Stock} = \frac{\text{Usable Stock}}{\text{Predicted Daily Demand}}$$

---

## 5. Forecasting Models & Multi-Horizon Strategy
1. **Low Data (<30 days sales)**: Simple Moving Average (SMA) with category fallback baselines.
2. **Medium Data (30–90 days)**: Weighted Moving Average (WMA) & Holt-Winters Exponential Smoothing.
3. **Rich Data (>90 days)**: Multi-Signal Ensemble combining trend momentum, seasonality factors, and institutional demand spikes.
* Horizons: **7 Days, 15 Days, 30 Days, 60 Days, 90 Days** with dynamic prediction intervals (lower & upper bounds) and confidence scoring.

---

## 6. Shortage Risk Scoring & Explainable AI (XAI)
* **Risk Categories**: `LOW`, `MODERATE`, `HIGH`, `CRITICAL`.
* **Lead-Time Vulnerability Alert**: Triggered whenever $\text{Days of Stock} \le \text{Supplier Lead Time}$.
* **Transparent Scoring Factors**:
  * Stock Coverage Weight (35%)
  * Demand Acceleration Weight (25%)
  * Supplier Reliability Weight (15%)
  * Impending Expiry Weight (10%)
  * Forecast Uncertainty Weight (10%)
  * External Health Trends (5%)
* **Explainable Reasoning Panel**: Answers **What** (Risk level), **When** (Expected depletion date), **Why** (Numeric factors), and **Recommended Action** ("Recommended for review before date X").

---

## 7. Decision Support & Unique Features
* **"What Will Happen If We Do Nothing?"**: Day-by-day depletion projection curve, shortage duration estimate, and total unmet patient demand.
* **Scenario Simulator**: Dynamic sliders for demand surges ($\pm 50\%$), supplier delivery delays ($+0..14$ days), and batch damages/adjustments.
* **Supply Chain Digital Twin**: Visual graph simulating inventory flowing from Supplier $\to$ Transit $\to$ Warehouse $\to$ Pharmacy $\to$ Patient.
* **Model Evaluation Baseline Comparison**: Live computation of MAE, RMSE, WAPE, Shortage Detection Recall ($85\%+$), and Shortage Precision ($88\%+$).

---

## 8. Limitations & Safety Principles
* **Decision Support Only**: Does not automatically execute purchases without human pharmacist verification.
* **No Diagnostic Claims**: Health trends are treated purely as aggregate consumption indicators.
* **Explicit Uncertainty**: Predictions with high variance or sparse data explicitly report low confidence scores.
