from fastapi import FastAPI, Request
import requests
import re
import httpx
import asyncio
import os
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

app = FastAPI()

OPENFDA_URL = "https://api.fda.gov/drug/label.json"

# Load Claude API key from environment
CLAUDE_API_KEY = os.getenv("CLAUDE_API_KEY")
CLAUDE_API_URL = "https://api.anthropic.com/v1/messages"

# Log whether API key is configured (without revealing it)
if CLAUDE_API_KEY:
    print(f"✅ Claude API key loaded (length: {len(CLAUDE_API_KEY)} chars)")
else:
    print("⚠️  No Claude API key found. LLM summaries will be disabled.")

def fetch_drug_info(drug_name: str, dosage: str = "", use_llm_summary: bool = True):
    """
    Fetch drug info from OpenFDA and summarize key 'do not take if' and 'do not take with'.
    """
    print(f"\n💊 Fetching drug info for: '{drug_name}' ({dosage})")
    
    base_url = "https://api.fda.gov/drug/label.json"
    params = {
        "search": f"openfda.generic_name:{drug_name}",
        "limit": 1
    }

    try:
        print(f"   📡 Querying OpenFDA API...")
        resp = requests.get(base_url, params=params, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        
        if "results" not in data:
            print(f"   ❌ No results found for '{drug_name}'")
            return {"error": "No results found", "searched_for": drug_name}

        result = data["results"][0]
        openfda = result.get("openfda", {})
        
        # Extract returned drug names
        returned_generic = openfda.get("generic_name", ["N/A"])
        returned_brand = openfda.get("brand_name", ["N/A"])
        
        # Get first name from lists
        returned_generic_name = returned_generic[0] if returned_generic else "N/A"
        returned_brand_name = returned_brand[0] if returned_brand else "N/A"
        
        # Sanity check: does the returned drug match what we searched for?
        print(f"   🔍 Sanity Check:")
        print(f"      Searched for: '{drug_name}'")
        print(f"      FDA returned generic: '{returned_generic_name}'")
        print(f"      FDA returned brand: '{returned_brand_name}'")
        
        # Check if there's a reasonable match
        search_lower = drug_name.lower().strip()
        generic_lower = returned_generic_name.lower().strip() if returned_generic_name != "N/A" else ""
        brand_lower = returned_brand_name.lower().strip() if returned_brand_name != "N/A" else ""
        
        # Check for exact match or substring match
        is_exact_match = (search_lower == generic_lower or search_lower == brand_lower)
        is_partial_match = (search_lower in generic_lower or generic_lower in search_lower or
                           search_lower in brand_lower or brand_lower in search_lower)
        
        if is_exact_match:
            print(f"      ✅ EXACT MATCH - Data is correct!")
            match_quality = "exact"
        elif is_partial_match:
            print(f"      ⚠️  PARTIAL MATCH - Data might be correct")
            match_quality = "partial"
        else:
            print(f"      ❌ NO MATCH - FDA returned different drug!")
            print(f"      ⚠️  WARNING: This might not be the correct medication!")
            match_quality = "no_match"

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
            print(f"\n🤖 Attempting Claude API call for {drug_name}...")
            print(f"   API Key present: {bool(CLAUDE_API_KEY)}")
            print(f"   API Key length: {len(CLAUDE_API_KEY) if CLAUDE_API_KEY else 0} chars")
            
            prompt = f"""
            You are a medical assistant. Summarize the following drug safety information
            into two bullet point lists: 'Do not take if' and 'Do not take with', 
            written in simple, non-technical language.
            
            Drug: {drug_name} {dosage}
            
            Do not take if info: {" ".join(do_not_take_if_text)}
            Do not take with info: {" ".join(do_not_take_with_text)}
            """

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
                
                print(f"   Sending request to: {CLAUDE_API_URL}")
                print(f"   Model: {payload['model']}")
                
                response = requests.post(CLAUDE_API_URL, json=payload, headers=headers, timeout=30)
                
                print(f"   Response status: {response.status_code}")
                
                if response.status_code == 200:
                    response_data = response.json()
                    summary_text = response_data["content"][0]["text"]
                    print(f"   ✅ Claude API success! Summary length: {len(summary_text)} chars")
                else:
                    error_detail = response.text
                    print(f"   ❌ Claude API error: {response.status_code}")
                    print(f"   Error details: {error_detail[:200]}")
                    summary_text = f"LLM summarization failed: HTTP {response.status_code}"
                    
            except requests.exceptions.Timeout:
                error_msg = "Request timeout (>30s)"
                print(f"   ❌ {error_msg}")
                summary_text = f"LLM summarization failed: {error_msg}"
                
            except requests.exceptions.ConnectionError as e:
                error_msg = "Connection error - check internet"
                print(f"   ❌ {error_msg}: {str(e)[:100]}")
                summary_text = f"LLM summarization failed: {error_msg}"
                
            except KeyError as e:
                error_msg = f"Unexpected response format: missing {e}"
                print(f"   ❌ {error_msg}")
                print(f"   Response: {response.text[:200]}")
                summary_text = f"LLM summarization failed: {error_msg}"
                
            except Exception as e:
                error_msg = f"{type(e).__name__}: {str(e)[:100]}"
                print(f"   ❌ Unexpected error: {error_msg}")
                summary_text = f"LLM summarization failed: {error_msg}"
        else:
            # Log why LLM summary was skipped
            if not use_llm_summary:
                print(f"   ⏭️  LLM summary disabled by parameter")
            elif not CLAUDE_API_KEY:
                print(f"   ⏭️  No Claude API key configured")
            elif not (do_not_take_if_text or do_not_take_with_text):
                print(f"   ⏭️  No safety text to summarize")

        return {
            "drug_name": returned_generic_name,
            "brand_name": returned_brand_name,
            "dosage": dosage,
            "searched_for": drug_name,
            "match_quality": match_quality,
            "do_not_take_if_raw": do_not_take_if_text,
            "do_not_take_with_raw": do_not_take_with_text,
            "summary": summary_text
        }

    except requests.exceptions.RequestException as e:
        print(f"   ❌ OpenFDA API error: {str(e)}")
        return {
            "error": str(e),
            "searched_for": drug_name
        }


# -----------------------
# Example usage
# -----------------------
if __name__ == "__main__":
    result = fetch_drug_info("ibuprofen", "200mg")
    import json
    print(json.dumps(result, indent=2))


