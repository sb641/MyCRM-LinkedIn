import os
import pickle
import gspread
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from .config import USERNAME, update_env

SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
]

def get_gsheet():
    creds = None
    token_file = 'token_linkedin.pickle'
    # Check for TikTok project token to avoid re-auth (effectively using same instance)
    tiktok_token = os.path.join('..', 'frozen-shuttle', 'token.pickle')
    creds_file = 'credentials.json'
    
    print("\n--- Google Sheets Authentication ---")
    
    if os.path.exists(token_file):
        print(f"Loading token from {token_file}...")
        with open(token_file, 'rb') as token:
            creds = pickle.load(token)
    elif os.path.exists(tiktok_token):
        print(f"Found existing TikTok token at {tiktok_token}. Reusing it...")
        # We can copy it to local or just read it
        with open(tiktok_token, 'rb') as token:
            creds = pickle.load(token)
            
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("Refreshing Google access token...")
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"Refresh failed: {e}. Re-authenticating...")
                creds = None
        
        if not creds or not creds.valid:
            if not os.path.exists(creds_file):
                print(f"CRITICAL ERROR: {creds_file} not found.")
                return None
            
            print("Authenticating with Google... A browser window should open shortly.")
            print("If it doesn't open automatically, look for a Google login tab in your default browser.")
            
            flow = InstalledAppFlow.from_client_secrets_file(creds_file, SCOPES)
            creds = flow.run_local_server(port=0, open_browser=True)
            
            # Save the token for next time
            with open(token_file, 'wb') as token:
                pickle.dump(creds, token)
            print(f"Authentication successful! Token saved to {token_file}")
            
    client = gspread.authorize(creds)
    
    sheet = None
    try:
        from .config import SPREADSHEET_ID
        current_id = SPREADSHEET_ID
        if current_id:
            print(f"Opening existing spreadsheet: {current_id}")
            sheet = client.open_by_key(current_id).sheet1
        else:
            print("SPREADSHEET_ID not found. Creating a NEW spreadsheet...")
            new_spreadsheet = client.create('LinkedIn CRM')
            print(f"New Spreadsheet created! ID: {new_spreadsheet.id}")
            
            # Shared with user's email if possible
            if USERNAME:
                try:
                    new_spreadsheet.share(USERNAME, perm_type='user', role='editor')
                    print(f"Shared with {USERNAME}")
                except Exception as share_e:
                    print(f"Could not share automatically: {share_e}")
            
            print(f"IMPORTANT: Please check your Google Sheets for 'LinkedIn CRM'")
            
            # Initial headers
            sheet = new_spreadsheet.sheet1
            sheet.update('A1:F1', [["Name", "Headline", "Last Message", "Draft Message", "Action", "Status"]])
            
            # Update .env
            print(f"Updating .env with SPREADSHEET_ID={new_spreadsheet.id}")
            update_env('SPREADSHEET_ID', new_spreadsheet.id)
            
        return sheet
    except Exception as e:
        print(f"Error handling spreadsheet: {e}")
        return None

async def sync_to_gsheet(sheet, data):
    print("Syncing data to Google Sheets...")
    # Get all records for deduplication check
    existing_data = sheet.get_all_records()
    # Using Name as the unique key for deduplication
    existing_names = {str(row.get("Name", "")).strip().lower() for row in existing_data}
    
    new_rows = []
    for entry in data:
        name_key = str(entry["Name"]).strip().lower()
        if name_key and name_key not in existing_names:
            status = "Replied!" if entry.get("Replied") else "New"
            new_rows.append([
                entry["Name"],
                entry["Headline"],
                entry["Last Message"],
                entry["Draft Message"],
                "", # Action
                status # Status
            ])
            # Add to set to avoid duplicates within the same scrape batch
            existing_names.add(name_key)
            
    if new_rows:
        sheet.append_rows(new_rows)
        print(f"✅ Successfully added {len(new_rows)} new UNIQUE leads to the sheet.")
        
        # Apply Adaptive Formatting
        try:
            print("Applying adaptive formatting to the sheet...")
            body = {
                "requests": [
                    {
                        "updateCells": {
                            "range": {
                                "sheetId": sheet.id,
                                "startRowIndex": 0,
                                "endRowIndex": 1000,
                                "startColumnIndex": 0,
                                "endColumnIndex": 6
                            },
                            "rows": [
                                {
                                    "values": [
                                        {
                                            "userEnteredFormat": {
                                                "wrapStrategy": "WRAP",
                                                "verticalAlignment": "TOP"
                                            }
                                        }
                                    ]
                                }
                            ],
                            "fields": "userEnteredFormat(wrapStrategy,verticalAlignment)"
                        }
                    },
                    {
                        "updateDimensionProperties": {
                            "range": {
                                "sheetId": sheet.id,
                                "dimension": "COLUMNS",
                                "startIndex": 0,
                                "endIndex": 1
                            },
                            "properties": {"pixelSize": 180},
                            "fields": "pixelSize"
                        }
                    },
                    {
                        "updateDimensionProperties": {
                            "range": {
                                "sheetId": sheet.id,
                                "dimension": "COLUMNS",
                                "startIndex": 2,
                                "endIndex": 4
                            },
                            "properties": {"pixelSize": 450},
                            "fields": "pixelSize"
                        }
                    }
                ]
            }
            sheet.spreadsheet.batch_update(body)
        except Exception as f_err:
            print(f"Formatting failed: {f_err}")
    else:
        print("ℹ️ No new unique leads found. All collected chats are already in the sheet.")
