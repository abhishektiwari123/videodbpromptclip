#!/bin/bash
set -e

echo "========================================"
echo "BTC Risk Monitor - Setup"
echo "========================================"

# Check Node.js version
NODE_VERSION=$(node -v 2>/dev/null | cut -d'v' -f2 | cut -d'.' -f1)
if [ -z "$NODE_VERSION" ] || [ "$NODE_VERSION" -lt 18 ]; then
  echo "Error: Node.js 18+ is required. Current: $(node -v 2>/dev/null || echo 'not installed')"
  exit 1
fi
echo "Node.js $(node -v) detected"

# Install backend dependencies
echo ""
echo "Installing backend dependencies..."
cd "$(dirname "$0")/.."
npm install

# Install frontend dependencies and build
echo ""
echo "Installing frontend dependencies..."
cd frontend
npm install

echo ""
echo "Building frontend..."
npm run build
cd ..

# Create data directory
mkdir -p data logs

# Copy .env.example if .env doesn't exist
if [ ! -f .env ]; then
  cp .env.example .env
  echo ""
  echo "Created .env file from .env.example"
  echo "IMPORTANT: Edit .env with your Telegram bot token and chat ID"
fi

echo ""
echo "========================================"
echo "Setup complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Edit .env with your Telegram bot credentials"
echo "     TELEGRAM_BOT_TOKEN=your_token"
echo "     TELEGRAM_CHAT_ID=your_chat_id"
echo ""
echo "  2. Start the server:"
echo "     npm start"
echo ""
echo "  3. Open http://localhost:3000 in your browser"
echo ""
echo "  4. Test Telegram: Send /status to your bot"
echo ""
