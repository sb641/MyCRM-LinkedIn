import os
from google import genai
from google.genai import types
from dotenv import load_dotenv

load_dotenv()

proxy = os.getenv('PROXY_URL')
if proxy:
    os.environ['HTTP_PROXY'] = proxy
    os.environ['HTTPS_PROXY'] = proxy
    print(f"Using proxy: {proxy}")

api_key = os.getenv('GEMINI_API_KEY')
client = genai.Client(api_key=api_key)

try:
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents="Say hello in professional business tone."
    )
    print("Success:", response.text)
except Exception as e:
    print("Error:", e)
