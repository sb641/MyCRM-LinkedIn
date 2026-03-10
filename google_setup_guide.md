# Google Sheets Setup Guide

To use Google Sheets as your CRM, follow these steps to give the bot access:

### 1. Create a Google Cloud Project
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., "LinkedIn CRM").

### 2. Enable APIs
1. Go to "APIs & Services" > "Library".
2. Search for and **Enable** "Google Sheets API" and "Google Drive API".

### 3. Create a Service Account
1. Go to "APIs & Services" > "Credentials".
2. Click "Create Credentials" > **Service Account**.
3. Name it "linkedin-bot" and skip optional steps.
4. Once created, click on the service account email.
5. Go to the **Keys** tab > "Add Key" > "Create new key" > **JSON**.
6. A file will download to your computer. **Rename it to `service_account.json` and place it in the `MyCRM-LinkedIn` folder.**

### 4. Create and Share the Spreadsheet
1. Create a new Google Sheet.
2. Open the `service_account.json` file and copy the `"client_email"` address.
3. In your Google Sheet, click **Share** and paste that email address (give it "Editor" permissions).
4. Copy the **Spreadsheet ID** from the URL (the long string between `/d/` and `/edit`).

### 5. Finalize Configuration
Update your `.env` file with:
```bash
SPREADSHEET_ID=your_id_here
```

Once this is done, I can run the script to sync your LinkedIn chats directly to the sheet!
