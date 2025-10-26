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

# Request models - simplified input
class MedicationInput(BaseModel):
    name: str
    dosage: str  # Simple string like "500mg"

class MedicationScanRequest(BaseModel):
    medications: List[MedicationInput]

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
    
    Input: { medications: [{ name: "Ibuprofen", dosage: "200mg" }] }
    Output: Enriched data with OpenFDA info + LLM summary
    """
    results = []
    
    for med in request.medications:
        # Fetch drug info from OpenFDA
        drug_data = fetch_drug_info(med.name, med.dosage)
        
        # Return both the input and enriched data
        results.append({
            "input": {
                "name": med.name,
                "dosage": med.dosage
            },
            "drugInfo": drug_data
        })
    
    return {
        "count": len(results),
        "medications": results
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
