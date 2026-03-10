import os
from google import genai
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
    print("Listing models...")
    for model in client.models.list():
        print(f"Model ID: {model.name}")
except Exception as e:
    print("Error:", e)
