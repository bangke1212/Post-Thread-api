#!/bin/bash
set -e
echo "🤖 X Auto-Reply Bot — Setup"
echo "============================"

# xurl
if ! command -v xurl &>/dev/null; then
  echo "📦 Installing xurl..."
  curl -fsSL https://raw.githubusercontent.com/xdevplatform/xurl/main/install.sh | bash
fi

# Python deps
echo "📦 Python deps..."
pip3 install -q requests 2>/dev/null || echo "⚠️ Install requests manually: pip3 install requests"

# Check xurl auth
echo "🔑 Checking X auth..."
xurl whoami 2>/dev/null || {
  echo "⚠️ xurl not authenticated!"
  echo "Run:"
  echo "  1. xurl auth apps add my-app --client-id YOUR_CLIENT_ID --client-secret YOUR_CLIENT_SECRET"
  echo "  2. xurl auth oauth2 --app my-app"
  exit 1
}

# Check Agnes
if [ -z "$AGNES_API_KEY" ]; then
  echo "⚠️ AGNES_API_KEY not set!"
  echo "   export AGNES_API_KEY=sk-xxxx"
  echo "   Get free key: https://platform.agnes-ai.com"
fi

# PM2
if command -v pm2 &>/dev/null; then
  pm2 delete x-reply 2>/dev/null || true
  pm2 start bot/x-reply.py --name x-reply --interpreter python3
  pm2 save
  echo "✅ Bot started with PM2"
else
  echo "⚡ PM2 not found. Install: npm install -g pm2"
  echo "   Then: pm2 start bot/x-reply.py --name x-reply --interpreter python3"
fi

echo ""
echo "✅ Setup complete!"
echo "   Dashboard: https://post-thread-api.vercel.app/x-reply"
echo "   PM2 logs: pm2 logs x-reply"
echo "   API test: curl 'https://post-thread-api.vercel.app/api/x-reply?dry=true'"
