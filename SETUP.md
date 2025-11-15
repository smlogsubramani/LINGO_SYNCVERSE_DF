# LiveKit Voice Agent Setup Guide

## Prerequisites

1. Node.js >= 20
2. LiveKit account with API credentials

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file in the root directory (copy from `.env.example`):
```bash
# Copy the example file
cp .env.example .env
```

3. Update `.env` with your LiveKit credentials:
```env
LIVEKIT_API_KEY=your_livekit_api_key_here
LIVEKIT_API_SECRET=your_livekit_api_secret_here
LIVEKIT_URL=https://your-livekit-server-url.livekit.cloud
```

## Running the Application

### Option 1: Run both servers together (Recommended)
```bash
npm run dev:all
```

This will start:
- Express server on `http://localhost:8000` (for LiveKit token generation)
- Vite dev server (usually on `http://localhost:5173`)

### Option 2: Run servers separately

Terminal 1 - Start the Express server:
```bash
npm run server
```

Terminal 2 - Start the Vite dev server:
```bash
npm run dev
```

## Accessing the Application

1. Open your browser and navigate to: `http://localhost:5173/jarvis`
2. Click "Start call" to begin a voice session with the LiveKit agent

## Troubleshooting

### Server not starting
- Make sure port 8000 is not in use by another application
- Check that all environment variables are set in `.env`

### Connection errors
- Verify your LiveKit credentials are correct
- Ensure the Express server is running on port 8000
- Check browser console for detailed error messages

### Agent not responding
- Make sure you have a LiveKit agent running and configured
- Check that `agentName` is set in your app configuration if using a specific agent

## Project Structure

- `server.ts` - Express server for LiveKit token generation
- `src/pages/Jarvis.tsx` - Main page with LiveKit voice agent
- `src/components/app/` - LiveKit integration components
- `src/hooks/useRoom.ts` - Room connection hook
- `vite.config.ts` - Vite configuration with API proxy

