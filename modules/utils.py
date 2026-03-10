import re

def get_next_followup_status(current_status):
    """Increments the follow-up stage (e.g., New -> 1st follow up -> 2nd follow up)."""
    current_status = str(current_status).strip().lower()
    
    # Check for existing "X follow up" pattern
    match = re.search(r'(\d+)(?:st|nd|rd|th)?\s+follow\s*up', current_status)
    if match:
        num = int(match.group(1))
        next_num = num + 1
        
        # Determine ordinal suffix
        suffix = "th"
        if next_num % 10 == 1 and next_num % 100 != 11: suffix = "st"
        elif next_num % 10 == 2 and next_num % 100 != 12: suffix = "nd"
        elif next_num % 10 == 3 and next_num % 100 != 13: suffix = "rd"
        
        return f"{next_num}{suffix} follow up"
    
    # Handle initial states
    if current_status in ["new", "new lead", "", "sent"]:
        return "1st follow up"
    
    return "1st follow up" # Fallback for unknown statuses

def clean_headline(text, name):
    """Cleans the headline by removing URLs and detecting group chats."""
    if not text: return ""
    text = str(text).strip()
    
    # 1. Detect Group Chats (multiple names or 'and you')
    if "," in name or " and you" in name.lower():
        return "Group Chat"
    
    # 2. Filter out internal LinkedIn noise or generic UI elements
    noise = ["video call", "zoom", "meet", "fathom", "calendar", "event"]
    low_text = text.lower()
    
    # Relaxed link detection - only filter if it's JUST a link
    if (low_text.startswith("http") or low_text.startswith("www")) and len(text) < 50:
        return "Lead (Headline Hidden)"
        
    for word in noise:
        if word in low_text and len(text) < 30:
            return "Lead (Headline Hidden)"
    
    return text
