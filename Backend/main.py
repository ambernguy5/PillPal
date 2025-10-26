from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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

@app.get("/drug_info")
def drug_info(name: str, dosage: str = ""):
    return fetch_drug_info(name, dosage)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
