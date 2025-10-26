from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from drug_info_retriever import fetch_drug_info

app = FastAPI()

# Allow your frontend to access the backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # for local testing; you can restrict later
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request models
class Dosage(BaseModel):
    amount: float
    unit: str
    formatted: str

class Medication(BaseModel):
    name: str
    dosage: Optional[Dosage] = None
    brandName: Optional[str] = None
    genericName: Optional[str] = None
    confidence: str

class MedicationScanRequest(BaseModel):
    medications: List[Medication]
    fullText: str

# Single drug info endpoint (existing)
@app.get("/drug_info")
def drug_info(name: str, dosage: str = ""):
    return fetch_drug_info(name, dosage)

# New endpoint for scanned medications
@app.post("/medications/scan")
def process_scanned_medications(request: MedicationScanRequest):
    """
    Process medications scanned from label.
    Returns enriched information for each medication.
    """
    results = []
    
    for med in request.medications:
        # Use generic name if available, otherwise use name
        drug_name = med.genericName if med.genericName else med.name
        dosage_str = med.dosage.formatted if med.dosage else ""
        
        # Fetch drug info from OpenFDA
        drug_data = fetch_drug_info(drug_name, dosage_str)
        
        # Combine scanned data with fetched data
        results.append({
            "scanned": {
                "name": med.name,
                "dosage": dosage_str,
                "brandName": med.brandName,
                "genericName": med.genericName,
                "confidence": med.confidence
            },
            "drugInfo": drug_data
        })
    
    return {
        "count": len(results),
        "medications": results,
        "originalText": request.fullText
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
