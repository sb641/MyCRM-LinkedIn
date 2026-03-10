# MyCRM-LinkedIn

An automated Customer Relationship Management (CRM) system for LinkedIn. It allows you to scrape conversations, generate personalized AI-driven responses, and automate messaging through Google Sheets.

## Key Features

- **Conversation Scraping**: Extract data from recent LinkedIn dialogues and synchronize it with a Google Sheet.
- **AI Response Generation**: Use Google Gemini AI to create response drafts based on conversation context.
- **Automated Messaging**: Send prepared messages to leads directly from Google Sheets.
- **Stealth Mode**: Built with Playwright and the `playwright-stealth` library to minimize detection risks.
- **Google Sheets Integration**: Manage contact bases and interaction statuses in real-time.

## Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/sb641/MyCRM-LinkedIn.git
   cd MyCRM-LinkedIn
   ```

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Install Playwright browsers**:
   ```bash
   playwright install chromium
   ```

4. **Configure environment variables**:
   Create a `.env` file in the root directory (or edit the existing one) and fill in the following fields:
   ```env
   LINKEDIN_USERNAME=your_email
   LINKEDIN_PASSWORD=your_password
   SPREADSHEET_ID=your_google_sheet_id
   GEMINI_API_KEY=your_gemini_api_key
   USER_DATA_DIR=./user_data  # directory to save browser session
   ```

5. **Google API Setup**:
   - Place your `credentials.json` (Service Account or OAuth) in the project root for Google Sheets access.
   - For more details, see [google_setup_guide.md](google_setup_guide.md).

## Usage

Run the project using:
```bash
python main.py
```
Or use the provided scripts:
- `start.bat` (Windows)
- `start.ps1` (PowerShell)

### Operation Modes:
1. **Scrape**: Collects new messages and updates the spreadsheet.
2. **Draft**: Processes rows where a response is needed and generates a draft using Gemini AI.
3. **Send**: Sends messages to contacts that have the required status in the spreadsheet.

## Security
The project uses a local browser data directory (`USER_DATA_DIR`) to maintain your LinkedIn session and avoid frequent logins. Using a proxy is recommended when managing multiple accounts.
