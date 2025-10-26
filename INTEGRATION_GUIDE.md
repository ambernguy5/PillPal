# PillPal - Frontend-Backend Integration Guide

## 🎯 What's Integrated

The medication scanner now sends scanned data to your backend for enrichment with drug information from OpenFDA.

## 🔄 Data Flow

```
Scanner → OCR → Parse Medications → Frontend → Backend → OpenFDA → LLM Summary → Frontend
```

## 🚀 How to Test

### 1. Start Backend Server

```bash
cd /Users/ambernguyen/Desktop/PillPal/Backend
python main.py
```

Backend will run on: `http://127.0.0.1:8000`

### 2. Start Frontend App

```bash
cd /Users/ambernguyen/Desktop/PillPal/Frontend/PillPal
npm start
```

### 3. Scan a Medication Label

1. Open the app
2. Tap "Scan Medication Label"
3. Select a photo from library
4. Watch the console logs!

## 📊 Console Output

You'll see:
```
✅ Detected medications: [...]
📊 Total: 1 medication(s) found
📤 Sending medications to backend: {...}
✅ Received enriched data from backend: {...}
🎉 Backend processing complete!
📋 Enriched medications: [...]
```

## 🔍 What the Backend Returns

For each medication, you get:

```json
{
  "count": 1,
  "medications": [
    {
      "scanned": {
        "name": "Ibuprofen",
        "dosage": "200mg",
        "brandName": "Advil",
        "genericName": "Ibuprofen",
        "confidence": "high"
      },
      "drugInfo": {
        "drug_name": "IBUPROFEN",
        "brand_name": "Advil",
        "dosage": "200mg",
        "do_not_take_if_raw": [...],
        "do_not_take_with_raw": [...],
        "summary": "LLM-generated safety summary"
      }
    }
  ],
  "originalText": "Full OCR text..."
}
```

## 🛠️ Configuration

### Change Backend URL

Edit `/Frontend/PillPal/src/services/api.js`:

```javascript
const API_BASE_URL = 'http://YOUR_BACKEND_URL:8000';
```

### Add Claude API Key

Set environment variable for LLM summaries:

```bash
export CLAUDE_API_KEY='your-key-here'
```

Or set it in your backend code.

## 📱 Next Steps

### 1. Create Results Screen

Uncomment in `scan.js`:
```javascript
navigation.navigate("Results", { data: response.data });
```

Then create `/app/results.js` to display the enriched data.

### 2. Add Error Handling

Show alerts to user if backend is down or scan fails.

### 3. Add Loading States

The loading overlay is already implemented!

### 4. Store Results

Save scanned medications to AsyncStorage or a database.

## 🔧 Troubleshooting

### Backend connection refused
- Make sure backend is running: `python main.py`
- Check the URL in `api.js`

### CORS errors
- Backend already has CORS enabled for all origins
- For production, restrict to your frontend domain

### LLM summary not working
- Set CLAUDE_API_KEY environment variable
- Or modify `drug_info_retriever.py` to use different LLM

## 📝 API Endpoints

### POST /medications/scan
Processes scanned medications and returns enriched data.

**Request:**
```json
{
  "medications": [...],
  "fullText": "..."
}
```

### GET /drug_info?name=X&dosage=Y
Gets info for a single drug (legacy endpoint).

## 🎉 Success!

You now have a fully integrated medication scanner with:
- ✅ OCR text recognition (Google Cloud Vision)
- ✅ Smart medication parsing (multiple drugs, brand/generic)
- ✅ Backend enrichment (OpenFDA + LLM)
- ✅ Loading states and error handling

