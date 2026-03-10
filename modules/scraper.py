import asyncio
import random
import os
from .config import VIDEO_LINK, MESSAGE_TEMPLATE
from .utils import clean_headline, get_next_followup_status
from .ai_agent import extract_company_and_title

async def scrape_conversations(page, limit=200):
    print(f"Navigating to Messaging...")
    await page.goto("https://www.linkedin.com/messaging/")
    
    conversations = []
    seen_conversations = set()
    
    print(f"Scrolling to load up to {limit} conversations...")
    pane_selector = ".msg-conversations-container__conversations-list"
    
    try:
        await page.wait_for_selector(pane_selector, timeout=15000)
    except:
        print("Could not find messaging container. Are you logged in?")
        return []

    while len(conversations) < limit:
        items = await page.query_selector_all(".msg-conversation-listitem")
        
        for item in items:
            # Participant Name
            name_elem = await item.query_selector(".msg-conversation-listitem__participant-names, .msg-conversation-card__participant-names")
            if not name_elem: continue
            
            name = (await name_elem.inner_text()).strip()
            if name in seen_conversations: continue
            
            print(f"Deep scraping conversation with {name}...")
            
            # Click to load full history
            await item.click()
            await asyncio.sleep(2) # Wait for pane to load
            
            headline = ""
            company = ""
            
            if "," in name or " and you" in name.lower():
                headline = "Group Chat"
            else:
                # Priority: Grab raw text from the chat header or right rail profile
                raw_profile_text = ""
                header_selectors = [
                    ".msg-entity-lockup__subtitle", 
                    ".artdeco-entity-lockup__subtitle",
                    ".msg-thread__topcard-subtext",
                    ".msg-thread__right-rail",
                    ".msg-entity-lockup__entity-info" # Added broader container
                ]
                for sel in header_selectors:
                    h_elems = await page.query_selector_all(sel)
                    for h_elem in h_elems:
                        text = (await h_elem.inner_text()).strip()
                        if text and len(text) > 5:
                            raw_profile_text += " " + text
                
                raw_profile_text = raw_profile_text.strip()
                            
                if raw_profile_text:
                    # Clean noise before parsing
                    if "Lead (" not in clean_headline(raw_profile_text, name):
                        print("    Parsing profile metadata...")
                        t_title, t_company = extract_company_and_title(raw_profile_text)
                        
                        if t_title:
                            headline = t_title
                            if t_company:
                                headline += f" at {t_company}"
                                company = t_company

            # Full Message History from the main pane
            full_history = await page.evaluate("""() => {
                const bodies = Array.from(document.querySelectorAll('.msg-s-event-listitem__body, .msg-s-message-group__item p'));
                // Filter out empty and take only unique messages
                return [...new Set(bodies.map(b => b.innerText.trim()).filter(t => t.length > 0))].join('\\n---\\n');
            }""")
            
            # Check if prospect replied (last message is not from viewer)
            replied = await page.evaluate("""() => {
                const groups = document.querySelectorAll('.msg-s-message-group');
                if (groups.length === 0) return false;
                const lastGroup = groups[groups.length - 1];
                // 'msg-s-message-group--viewer' is typically used for sent messages
                return !lastGroup.classList.contains('msg-s-message-group--viewer');
            }""")

            conversations.append({
                "Name": name,
                "Headline": headline,
                "Last Message": full_history if full_history else "No message history found.",
                "Draft Message": "", 
                "Action": "",
                "Replied": replied,
                "Company": company # Internal passing
            })
            seen_conversations.add(name)
            
            if len(conversations) >= limit: break
            
        # Scroll logic
        await page.eval_on_selector(pane_selector, "el => el.scrollTop = el.scrollHeight")
        await asyncio.sleep(2)
        
        new_items = await page.query_selector_all(".msg-conversation-listitem")
        if len(new_items) == len(items):
            print("Reached end of list.")
            break
            
        print(f"Found {len(conversations)} conversations...")
        
    return conversations

async def send_messages_from_gsheet(page, sheet):
    records = sheet.get_all_records()
    count = 0
    
    # Fallback to older MESSAGE_TEMPLATE if no text file or draft exist
    default_msg = f"Hi, would you be open to an intro? Here is the link: {VIDEO_LINK}"
    if MESSAGE_TEMPLATE:
        default_msg = MESSAGE_TEMPLATE.replace("{video_link}", VIDEO_LINK)

    for idx, row in enumerate(records, start=2):
        name = row.get("Name")
        action = str(row.get("Action", "")).lower()
        status = str(row.get("Status", "")).lower()
        draft = row.get("Draft Message")
        
        if action == "send" and status != "sent":
            count += 1
            print(f"Processing {name}...")
            message = draft if draft else default_msg
            
            await page.goto("https://www.linkedin.com/messaging/")
            await page.fill('input[placeholder="Search messages"]', name)
            await page.keyboard.press("Enter")
            await asyncio.sleep(3)
            
            first_result = await page.query_selector(".msg-conversation-listitem")
            if first_result:
                await first_result.click()
                await asyncio.sleep(2)
                await page.fill(".msg-form__contenteditable", message)
                await page.click("button[type='submit']")
                print(f"Message sent to {name}.")
                
                # Update Status to next followup stage
                new_status = get_next_followup_status(status)
                sheet.update_cell(idx, 6, new_status)
                
                # Clear Action cell to prevent accidental double-sending
                sheet.update_cell(idx, 5, "")
                
                delay = random.randint(300, 420)
                print(f"Waiting {delay} seconds...")
                await asyncio.sleep(delay)
            else:
                print(f"Could not find conversation for {name}. Skipping.")
                sheet.update_cell(idx, 6, "Not Found")
    
    if count == 0:
        print("No leads marked as 'send' with status other than 'Sent'.")
