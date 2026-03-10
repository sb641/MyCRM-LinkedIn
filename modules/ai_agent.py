import os
import asyncio
try:
    from google import genai
    from google.genai import types
except ImportError:
    print("Warning: google-genai not installed. AI personalization will be disabled.")
    genai = None

from .config import GEMINI_API_KEY, PROXY_URL, VIDEO_LINK, AI_MODEL

# Initialize AI Client with Proxy Support
gemini_client = None
if genai and GEMINI_API_KEY:
    if PROXY_URL:
        os.environ['HTTP_PROXY'] = PROXY_URL
        os.environ['HTTPS_PROXY'] = PROXY_URL
        os.environ['http_proxy'] = PROXY_URL
        os.environ['https_proxy'] = PROXY_URL
        print(f"AI: Routing through proxy {PROXY_URL}")
        
    try:
        gemini_client = genai.Client(api_key=GEMINI_API_KEY)
    except Exception as e:
        print(f"AI Initialization Error: {e}")

def get_prompt_template():
    prompt_path = os.path.join("prompts", "followup.txt")
    if os.path.exists(prompt_path):
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
    else:
        # Fallback
        return "Write a professional follow up to {name}. History: {history}"

def extract_company_and_title(raw_text):
    """Uses Gemini to parse a raw block of LinkedIn text into a clean Job Title and Company."""
    if not gemini_client or not raw_text:
        return "", ""
        
    prompt = f"""
    You are an expert data extractor. Given the following raw text from a LinkedIn messaging header (which might include the person's name, headline, and other UI elements), extract the CURRENT Job Title and the Company Name.
    
    Guidelines:
    1. If the text looks like "Job Title at Company", extract accordingly.
    2. If the text is just a name, return empty strings.
    3. Ignore UI noise like "Active now", "View profile", "Message", or timestamps.
    4. If multiple companies/titles are mentioned, take the most current/prominent one.
    
    Raw text:
    "{raw_text[:1200]}"
    
    Return ONLY a valid JSON object strictly matching this format:
    {{"title": "Job Title", "company": "Company Name"}}
    """
    
    try:
        response = gemini_client.models.generate_content(
            model=AI_MODEL, # Use the configured model for consistency and cost
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.1,
                response_mime_type="application/json",
            )
        )
        import json
        data = json.loads(response.text)
        title = data.get("title", "").strip()
        company = data.get("company", "").strip()
        
        # Cleanup obvious placeholders the AI might returned
        if title.lower() in ["job title", "n/a", "none"]: title = ""
        if company.lower() in ["company name", "n/a", "none"]: company = ""
        
        return title, company
    except Exception as e:
        print(f"AI Parse Error: {e}")
        return "", ""

def generate_personalized_followup(history, name, company=""):
    if not gemini_client:
        return f"Hi {name}, would you be open to an intro? Here is info: {VIDEO_LINK}"
    
    template = get_prompt_template()
    prompt = template.replace("{name}", name).replace("{company}", company).replace("{history}", history[:2000])
    
    try:
        print(f"Using AI Model: {AI_MODEL}")
        response = gemini_client.models.generate_content(
            model=AI_MODEL,
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=0.3, 
            )
        )
        return response.text.replace("{video_link}", VIDEO_LINK).strip()
    except Exception as e:
        print(f"AI Generation Error: {e}")
        return f"Hi {name}, would you be open to an intro? Here is info: {VIDEO_LINK}"

async def generate_drafts_from_gsheet(sheet):
    """Processes leads marked with 'draft' action and generates AI follow-ups."""
    records = sheet.get_all_records()
    count = 0
    print("\n--- Generating AI Drafts for selected leads ---")
    
    for idx, row in enumerate(records, start=2):
        name = row.get("Name")
        headline = row.get("Headline", "")
        history = row.get("Last Message", "")
        action = str(row.get("Action", "")).lower()
        
        if action == "draft":
            count += 1
            print(f"[{count}] Generating draft for {name}...")
            
            # Extract company for better personalization
            company = ""
            if " at " in headline:
                company = headline.split(" at ")[-1].strip()
            elif " @ " in headline:
                company = headline.split(" @ ")[-1].strip()
            
            draft = generate_personalized_followup(history, name, company)
            
            # Update Draft Message in sheet
            sheet.update_cell(idx, 4, draft)
            # Update Status
            sheet.update_cell(idx, 6, "Drafted")
            # Clear Action
            sheet.update_cell(idx, 5, "")
            
            print(f"Done for {name}.")
            # Small delay to respect Google Sheets API limits
            await asyncio.sleep(1)
            
    if count == 0:
        print("No leads marked as 'draft' found in the Action column.")
    else:
        print(f"Successfully generated {count} drafts.")
