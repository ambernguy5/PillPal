# PillPal

PillPal is a mobile health application for medication management and safety, designed for users managing complex drug regimens. The app consists of label scanning, drug normalization, and FDA-verified data lookup to reduce medication errors.

## How It Works
* Scan medication labels using camera or uploaded image
* OCR → structured drug name + dosage

## Query FDA drug data

* Uses openFDA Drug Label API
* Returns indications, warnings, manufacturer, and dosage info

## Normalize real-world labels
* Extracts generic name + strength from noisy OCR text
* Deduplicates and ranks candidates

## Who It's For

* Patients with extensive list of medications
* Chronic illness populations

## Tech Stack

* Frontend: React Native, Expo Router

* OCR & Image Processing: Image-based OCR pipeline (Google Vision API)

* APIs: Google Vision API, openFDA Drug Label API


## Architecture (High-Level)
```src/
├── components/        # Scanner + UI
├── utils/             # OCR parsing & helpers
├── services/          # openFDA queries
app/                   # Expo Router screens
```

🔍 Example FDA Query
https://api.fda.gov/drug/label.json
?search=openfda.generic_name:ibuprofen
+AND+(openfda.strength:"200MG"+OR+openfda.strength:"200+mg")
&limit=1
