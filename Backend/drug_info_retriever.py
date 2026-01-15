from fastapi import FastAPI, Request
import requests
import re
import httpx
import asyncio
import os
from openai import OpenAI

app = FastAPI()

OPENFDA_URL = "https://api.fda.gov/drug/label.json"

# Optionally use GPT for summarization
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY")
CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"

def fetch_drug_info(drug_name: str, dosage: str = "", use_llm_summary: bool = True):
    """
    Fetch drug info from OpenFDA and summarize key 'do not take if' and 'do not take with'.
    """
    base_url = "https://api.fda.gov/drug/label.json"
    params = {
        "search": f"openfda.generic_name:{drug_name}",
        "limit": 1
    }

    try:
        resp = requests.get(base_url, params=params)
        resp.raise_for_status()
        data = resp.json()
        if "results" not in data:
            return {"error": "No results found"}

        result = data["results"][0]
        openfda = result.get("openfda", {})

        # -----------------------
        # Gather 'do not take if' text from multiple fields
        # -----------------------
        do_not_take_if_fields = [
            "contraindications",
            "warnings",
            "warnings_and_cautions",
            "precautions",
            "pregnancy",
            "nursing_mothers",
            "pregnancy_or_lactation"
        ]

        do_not_take_if_text = []
        for field in do_not_take_if_fields:
            values = result.get(field, [])
            if values:
                do_not_take_if_text.append(values[0])


        # Gather 'do not take with' text
        do_not_take_with_text = result.get("drug_interactions", [])
        if do_not_take_with_text:
            do_not_take_with_text = [do_not_take_with_text[0]]  # keep as list
        else:
            do_not_take_with_text = []
        
        summary_text = None

        # -----------------------
        # Optional: summarize using LLM
        # -----------------------
        if use_llm_summary and CLAUDE_API_KEY and (do_not_take_if_text or do_not_take_with_text):
            prompt = f"""
            You are a medical assistant. Summarize the following drug safety information
            into two bullet point lists: 'Do not take if' and 'Do not take with', 
            written in simple, non-technical language.
            
            Drug: {drug_name} {dosage}
            
            Do not take if info: {" ".join(do_not_take_if_text)}
            Do not take with info: {" ".join(do_not_take_with_text)}
            """

                # response = requests.post(CLAUDE_API_URL, json=payload, headers=headers)
                # response.raise_for_status()
                # summary_text = response.json().get("completion")

            try:
                headers = {
                    "x-api-key": CLAUDE_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "Content-Type": "application/json"
                }
                payload = {
                    "model": "claude-sonnet-4-20250514",
                    "max_tokens": 400,
                    "messages": [
                        {
                            "role": "user",
                            "content": prompt
                        }
                    ]
                }
                response = requests.post(CLAUDE_API_URL, json=payload, headers=headers)
                response.raise_for_status()
                summary_text = response.json()["content"][0]["text"]

            
            except Exception as e:
                summary_text = f"LLM summarization failed: {e}"

        return {
            "drug_name": openfda.get("generic_name", ["N/A"])[0],
            "brand_name": openfda.get("brand_name", ["N/A"])[0],
            "dosage": dosage,
            "do_not_take_if_raw": do_not_take_if_text,
            "do_not_take_with_raw": do_not_take_with_text,
            "summary": summary_text
        }

    except requests.exceptions.RequestException as e:
        return {"error": str(e)}


# -----------------------
# Example usage
# -----------------------
if __name__ == "__main__":
    result = fetch_drug_info("ibuprofen", "200mg")
    import json
    print(json.dumps(result, indent=2))


