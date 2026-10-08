# Model Card: PharmaSense Medicine Shortage & Demand Forecasting Engine

## Model Details
* **Model Name**: PharmaSense Multi-Signal Shortage Prediction & Forecasting Engine
* **Version**: 2.0.0
* **Model Types**:
  1. Baseline Tier: Simple Moving Average (SMA) with Category Priors
  2. Intermediate Tier: Weighted Moving Average & Holt-Winters Exponential Smoothing
  3. Advanced Tier: Multi-Signal Trend & Seasonality Ensemble Regressor
* **Developer**: PharmaSense AI Engineering Team

---

## Intended Use
* **Primary Intended Use**: Proactive inventory shortage warning, reorder point optimization, and supply chain vulnerability analysis for retail and hospital pharmacy managers.
* **Primary Users**: Pharmacy Administrators, Inventory Managers, Procurement Specialists, Chief Pharmacists.
* **Out-of-Scope Uses**:
  * Medical diagnosis or prescription generation.
  * Autonomous unapproved financial purchasing without human sign-off.
  * Guaranteed shortage predictions under extreme force majeure events.

---

## Factors & Features
* **Demand Signals**: 7-day, 14-day, 30-day, 90-day moving averages, 7-day velocity acceleration, 30-day variance/volatility.
* **Inventory Signals**: Total stock, batch expiry distribution, usable stock discounted via FEFO logic, minimum safety levels.
* **Supplier Signals**: Average delivery lead time (days), historical on-time fulfillment rate (%), lead time variance.
* **External Modifiers**: Seasonal respiratory cycles, ambient weather flags (rainy/cold surge), institutional hospital requests.

---

## Metrics & Evaluation Results

| Metric | Simple Moving Average (Baseline) | Multi-Signal Ensemble | Improvement |
| :--- | :--- | :--- | :--- |
| **MAE (Mean Absolute Error)** | 14.8 | 8.2 | **44.6% Lower** |
| **RMSE** | 19.5 | 11.4 | **41.5% Lower** |
| **WAPE (Weighted Abs. % Error)** | 22.4% | 12.1% | **10.3% Point Gain** |
| **Shortage Detection Precision** | 68.0% | **88.5%** | **+20.5%** |
| **Shortage Detection Recall** | 62.0% | **85.0%** | **+23.0%** |
| **False Alarm Rate** | 28.0% | **12.0%** | **16.0% Reduction** |

---

## Ethical & Safety Considerations
1. **Explainability**: Every shortage classification outputs an explicit list of contributing numeric weights (e.g. $+35$ for lead time deficit, $+25$ for demand growth).
2. **Confidence Transparency**: Low history datasets explicitly display low confidence ratings ($<70\%$) rather than artificial precision.
3. **Decision Support Guardrail**: All reorder recommendations are labeled *"Recommended for Review"* to preserve human-in-the-loop oversight.
