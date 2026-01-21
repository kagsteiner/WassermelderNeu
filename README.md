# Wassermelder

A water meter tracking application that uses AI (GPT-4 Vision) to read water meter values from photos and track water consumption over time.

![Wassermelder Screenshot](https://via.placeholder.com/800x400/0a0a0b/3b82f6?text=Wassermelder)

## Features

- 📸 **Photo Capture**: Take photos of your water meter directly from the app
- 🤖 **AI-Powered Reading**: Uses GPT-4 Vision to automatically read meter values
- 📊 **Consumption Statistics**: View daily, monthly, and yearly consumption data
- 📈 **Visual Charts**: Weekly consumption chart for the last 12 months
- 🔒 **Password Protection**: Simple authentication to protect your data

## Local Development

### Prerequisites

- Node.js 18 or higher
- OpenAI API key with GPT-4 Vision access

### Setup

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd wassermelder
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file (copy from `env.example`):
   ```bash
   cp env.example .env
   ```

4. Edit `.env` and add your configuration:
   ```
   OPENAI_TOKEN=sk-your-openai-api-key
   APP_PASSWORD=your-secure-password
   SESSION_SECRET=random-secret-string
   ```

5. Start the server:
   ```bash
   npm start
   ```

6. Open http://localhost:3000 in your browser

## Deployment to Render.com

### Option 1: Blueprint Deployment

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New" → "Blueprint"
4. Connect your GitHub repository
5. Render will automatically detect `render.yaml` and configure the service
6. Add the required environment variables:
   - `OPENAI_TOKEN`: Your OpenAI API key
   - `APP_PASSWORD`: Your chosen password

### Option 2: Manual Deployment

1. Push your code to GitHub
2. Go to [Render Dashboard](https://dashboard.render.com/)
3. Click "New" → "Web Service"
4. Connect your GitHub repository
5. Configure:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
6. Add environment variables:
   - `OPENAI_TOKEN`: Your OpenAI API key
   - `APP_PASSWORD`: Your chosen password
   - `SESSION_SECRET`: Generate a random string
   - `NODE_ENV`: `production`
   - `RENDER`: `true`
7. Add a disk (for persistent data storage):
   - **Name**: `wassermelder-data`
   - **Mount Path**: `/var/data`
   - **Size**: 1 GB

## Usage

1. **Login**: Enter your password to access the dashboard
2. **Take a Reading**: Click "Capture Photo" to photograph your water meter
3. **Review**: The AI will analyze the image and show the detected value
4. **Track**: View your consumption statistics and trends

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/auth/status` | GET | Check authentication status |
| `/api/auth/login` | POST | Login with password |
| `/api/auth/logout` | POST | Logout |
| `/api/data` | GET | Get all readings and statistics |
| `/api/reading` | POST | Upload photo and save reading |
| `/api/reading/manual` | POST | Manually enter a reading |
| `/api/reading/:id` | DELETE | Delete a reading |

## Data Storage

- **Readings**: Stored in `data.json`
- **Images**: Stored in `images/` folder
- On Render.com, data is persisted to `/var/data` disk

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: Vanilla JavaScript, Chart.js
- **AI**: OpenAI GPT-4 Vision (gpt-4o-mini)
- **Styling**: Custom CSS with dark theme

## License

MIT
