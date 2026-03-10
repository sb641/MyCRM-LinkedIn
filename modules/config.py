import os
from dotenv import load_dotenv

load_dotenv()

USERNAME = os.getenv('LINKEDIN_USERNAME', '')
PASSWORD = os.getenv('LINKEDIN_PASSWORD', '')
VIDEO_LINK = os.getenv('VIDEO_LINK', '')
MESSAGE_TEMPLATE = os.getenv('MESSAGE_TEMPLATE', '')
PROXY_URL = os.getenv('PROXY_URL', '')
USER_DATA_DIR = os.getenv('USER_DATA_DIR', '')
SPREADSHEET_ID = os.getenv('SPREADSHEET_ID', '')
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
AI_MODEL = os.getenv('AI_MODEL', 'gemini-2.5-flash') # Cost-effective model for simple tasks

def update_env(key, value):
    env_file = ".env"
    lines = []
    if os.path.exists(env_file):
        with open(env_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    
    found = False
    new_lines = []
    for line in lines:
        if line.startswith(f"{key}="):
            new_lines.append(f"{key}={value}\n")
            found = True
        else:
            new_lines.append(line)
    
    if not found:
        new_lines.append(f"{key}={value}\n")
        
    with open(env_file, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
