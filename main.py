import os
import sys
import io
import asyncio
from playwright.async_api import async_playwright
from playwright_stealth import Stealth

# Fix for UnicodeEncodeError with Cyrillic characters in terminal
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    except: pass
if sys.stderr.encoding != 'utf-8':
    try:
        sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')
    except: pass

from modules.config import PROXY_URL, USER_DATA_DIR, USERNAME, PASSWORD
from modules.sheets import get_gsheet, sync_to_gsheet
from modules.scraper import scrape_conversations, send_messages_from_gsheet
from modules.ai_agent import generate_drafts_from_gsheet

async def run(mode="scrape"):
    sheet = get_gsheet()
    if not sheet:
        return

    if mode == "draft":
        # Draft generation doesn't need a browser
        await generate_drafts_from_gsheet(sheet)
        return

    # For 'scrape' and 'send', we need a browser
    async with async_playwright() as p:
        proxy = None
        if PROXY_URL:
            proxy = {"server": PROXY_URL}
            print(f"Using proxy: {PROXY_URL}")
        
        launch_args = ["--disable-blink-features=AutomationControlled"]
        
        if USER_DATA_DIR:
            print(f"Using persistent context: {USER_DATA_DIR}")
            context = await p.chromium.launch_persistent_context(
                USER_DATA_DIR,
                headless=False,
                proxy=proxy,
                args=launch_args,
                channel="chrome",
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={'width': 1280, 'height': 800},
                locale='en-US'
            )
        else:
            browser = await p.chromium.launch(headless=False, proxy=proxy, args=launch_args)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                viewport={'width': 1280, 'height': 800},
                locale='en-US'
            )
            
        page = await context.new_page()
        await Stealth().apply_stealth_async(page)
        
        await page.goto("https://www.linkedin.com/feed/")
        if "login" in page.url:
            print("Not logged in. Opening login page...")
            await page.goto("https://www.linkedin.com/login")
            if USERNAME and PASSWORD:
                await page.fill("#username", USERNAME)
                await page.fill("#password", PASSWORD)
                await page.click("button[type='submit']")
            
            print("Waiting for login...")
            try:
                await page.wait_for_url("https://www.linkedin.com/feed/", timeout=60000)
                print("Login successful.")
            except:
                print("Login timed out. Please ensure you are logged in manualy.")

        if mode == "scrape":
            limit_input = input("How many conversations to collect? (default 20): ").strip()
            limit = int(limit_input) if limit_input else 20
            
            data = await scrape_conversations(page, limit=limit)
            if data:
                await sync_to_gsheet(sheet, data)
            else:
                print("No data collected.")
        elif mode == "send":
            await send_messages_from_gsheet(page, sheet)
            
        await context.close()

if __name__ == "__main__":
    def show_menu():
        print("\n--- LinkedIn CRM Menu (Google Sheets Edition) ---")
        print("1. Sync LinkedIn conversations to Google Sheet (Sync only)")
        print("2. Generate AI Drafts for leads marked as 'draft'")
        print("3. Send messages to leads marked as 'send'")
        print("q. Quit")
        return input("Choose action: ")

    try:
        if len(sys.argv) > 1:
            mode = sys.argv[1].lower()
        else:
            choice = show_menu().strip().lower()
            if choice == "1": mode = "scrape"
            elif choice == "2": mode = "draft"
            elif choice == "3": mode = "send"
            else: sys.exit()

        asyncio.run(run(mode))
    except Exception as e:
        print(f"\nCRITICAL ERROR: {e}")
        import traceback
        traceback.print_exc()
