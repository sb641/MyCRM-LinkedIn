import os
import time
import random
from dotenv import load_dotenv
from linkedin_api import Linkedin

# Load environment variables
load_dotenv()

USERNAME = os.getenv('LINKEDIN_USERNAME')
PASSWORD = os.getenv('LINKEDIN_PASSWORD')
VIDEO_LINK = os.getenv('VIDEO_LINK')
MESSAGE_TEMPLATE = os.getenv('MESSAGE_TEMPLATE')

def main():
    if not all([USERNAME, PASSWORD, VIDEO_LINK, MESSAGE_TEMPLATE]):
        print("Error: Please set LINKEDIN_USERNAME, LINKEDIN_PASSWORD, VIDEO_LINK, and MESSAGE_TEMPLATE in .env file.")
        return

    # Authenticate
    print(f"Authenticating as {USERNAME}...")
    try:
        api = Linkedin(USERNAME, PASSWORD)
    except Exception as e:
        print(f"Authentication failed: {e}")
        return

    print("Fetching last 50 conversations to find hospitality-related intros...")
    conversations = api.get_conversations()
    
    to_followup = []
    
    for conv in conversations.get('elements', []):
        if len(to_followup) >= 5:
            break
            
        try:
            conv_id = conv['entityUrn'].split(':')[-1]
            
            # Check if conversation is related to hospitality
            # We look at the participant's name/headline or the messages content
            participants = conv.get('participants', [])
            other_person = next((p for p in participants if 'member' in p.get('entityUrn', '')), None)
            
            if not other_person:
                continue

            # Fetch profile to check for "hospitality"
            profile = api.get_profile(other_person['entityUrn'].split(':')[-1])
            headline = profile.get('headline', '').lower()
            summary = profile.get('summary', '').lower()
            
            is_hospitality = "hospitality" in headline or "hospitality" in summary or "hotel" in headline or "hotel" in summary
            
            if not is_hospitality:
                continue

            messages = api.get_conversation_messages(conv_id)
            if not messages or 'elements' not in messages or len(messages['elements']) == 0:
                continue
                
            # Logic: If I sent the last message and it's an intro
            last_message = messages['elements'][0]
            # In linkedin-api, last_message is the newest.
            # We check if the sender is NOT the 'other_person' (meaning it's me)
            sender_urn = last_message.get('sender', {}).get('entityUrn', '')
            
            if other_person['entityUrn'] not in sender_urn:
                to_followup.append({
                    'id': conv_id,
                    'name': f"{other_person.get('firstName', '')} {other_person.get('lastName', '')}",
                    'headline': headline,
                    'urn': other_person.get('entityUrn')
                })
                print(f"Found candidate: {to_followup[-1]['name']} - {headline[:50]}...")
        except Exception as e:
            # print(f"Error processing conversation: {e}")
            pass

    print(f"\nFinal list of 5 latest hospitality intros:")
    for i, person in enumerate(to_followup, 1):
        print(f"{i}. {person['name']} ({person['headline'][:60]}...)")
    
    if not to_followup:
        print("No hospitality-related intros found in the recent history.")
        return

    # Dry run message preview
    print("\n--- Message Preview ---")
    message = MESSAGE_TEMPLATE.format(video_link=VIDEO_LINK)
    print(f"Template:\n{message}\n")
    
    print("To proceed with sending, edit the script to uncomment the send_message line and run it again.")

if __name__ == "__main__":
    main()
