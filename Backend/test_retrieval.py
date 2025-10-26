import requests

def fetch_drug_info(drug_name: str, dosage: str = ""):
    """
    Fetch drug label data from the OpenFDA API based on the drug name.
    Optionally filters by dosage if available in label text.
    """
    base_url = "https://api.fda.gov/drug/label.json"
    query = f"openfda.generic_name:{drug_name}"  # search by generic name
    
    params = {
        "search": query,
        "limit": 1  # just get the first result for now
    }

    try:
        response = requests.get(base_url, params=params)
        response.raise_for_status()
        data = response.json()

        if "results" not in data:
            return {"error": "No results found"}

        result = data["results"][0]
        openfda = result.get("openfda", {})

        info = {
            "drug_name": openfda.get("generic_name", ["N/A"])[0],
            "brand_name": openfda.get("brand_name", ["N/A"])[0],
            "dosage": dosage,
            "warnings": result.get("warnings", ["No warnings found"])[0],
            "do_not_take_if": result.get("pregnancy_or_lactation", ["No data found"])[0],
            "do_not_take_with": result.get("drug_interactions", ["No interactions found"])[0],
        }

        return info

    except requests.exceptions.RequestException as e:
        return {"error": str(e)}

# simple test
if __name__ == "__main__":
    print(fetch_drug_info("ibuprofen", "200mg"))
