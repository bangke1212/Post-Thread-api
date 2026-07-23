#!/usr/bin/env python3
"""
X Auto-Reply Bot — Monitor target account, auto-reply via Agnes AI
Jalan 24/7 di VPS. Gunakan xurl CLI untuk X API.

Setup:
  1. Install xurl: curl -fsSL https://raw.githubusercontent.com/xdevplatform/xurl/main/install.sh | bash
  2. xurl auth apps add my-app --client-id xxx --client-secret xxx
  3. xurl auth oauth2 --app my-app
  4. export AGNES_API_KEY=sk-xxxx
  5. python3 bot/x-reply.py
"""
import subprocess, json, os, time, sys, signal, re
from datetime import datetime, timezone
from pathlib import Path

# ========== CONFIG ==========
TARGET_USER = os.environ.get('X_TARGET_USER', 'bov4l')
CHECK_INTERVAL = int(os.environ.get('CHECK_INTERVAL', '300'))  # 5 minutes
AGNES_KEY = os.environ.get('AGNES_API_KEY', '')
AGNES_BASE = 'https://apihub.agnes-ai.com/v1'
AGNES_MODEL = 'agnes-2.0-flash'
XURL_APP = os.environ.get('XURL_APP', 'my-app')
STATE_FILE = Path(__file__).parent / '.x-reply-state.json'
DRY_RUN = os.environ.get('DRY_RUN', 'false').lower() == 'true'

# Stats
stats = {'replied': 0, 'skipped': 0, 'errors': 0, 'started': datetime.now(timezone.utc).isoformat()}

# ========== HELPERS ==========
def log(level, msg):
    ts = datetime.now().strftime('%H:%M:%S')
    emoji = {'info': '📡', 'reply': '💬', 'skip': '⏭️', 'err': '❌', 'dry': '🔍'}
    print(f"[{ts}] {emoji.get(level, '•')} {msg}", flush=True)

def xurl(*args):
    """Run xurl CLI command"""
    cmd = ['xurl', '--app', XURL_APP] + list(args)
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if r.returncode != 0:
            log('err', f'xurl failed: {r.stderr[:200]}')
            return None
        return r.stdout.strip()
    except Exception as e:
        log('err', f'xurl error: {e}')
        return None

def load_state():
    if STATE_FILE.exists():
        try: return json.loads(STATE_FILE.read_text())
        except: pass
    return {'replied_ids': [], 'last_check': None}

def save_state(state):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    # Keep only last 500 replied IDs
    state['replied_ids'] = state['replied_ids'][-500:]
    STATE_FILE.write_text(json.dumps(state, indent=2))

def fetch_latest_tweets(username, count=5):
    """Fetch latest tweets using xurl search"""
    output = xurl('search', f'from:{username}', '-n', str(count))
    if not output: return []
    
    # xurl returns JSON lines or array — parse it
    try:
        data = json.loads(output)
        if isinstance(data, list): return data
        if isinstance(data, dict):
            # Could be {data: [...]} format
            return data.get('data', data.get('tweets', []))
    except:
        # Try parsing line by line
        tweets = []
        for line in output.split('\n'):
            line = line.strip()
            if not line: continue
            try: tweets.append(json.loads(line))
            except: pass
        return tweets
    
    return []

def generate_reply(tweet_text, author):
    """Generate AI reply via Agnes"""
    if not AGNES_KEY:
        return f"Nice post @{author}! 👏"
    
    import urllib.request
    
    system_prompt = (
        f"Kamu adalah social media assistant. Balas tweet dari @{author} "
        "dengan reply yang engaging, singkat (max 250 char), natural seperti manusia. "
        "Gunakan Bahasa Indonesia casual (gaul tapi sopan). "
        "JANGAN gunakan hashtag. JANGAN mention user lain. "
        "Reply harus relate dengan isi tweet. Boleh sedikit humor atau sarkasme ringan."
    )
    
    body = json.dumps({
        'model': AGNES_MODEL,
        'messages': [
            {'role': 'system', 'content': system_prompt},
            {'role': 'user', 'content': f'Tweet dari @{author}:\n"{tweet_text}"\n\nReply dengan 1-2 kalimat yang engaging:'}
        ],
        'temperature': 0.85,
        'max_tokens': 150,
    }).encode()
    
    req = urllib.request.Request(
        f'{AGNES_BASE}/chat/completions',
        data=body,
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {AGNES_KEY}',
        }
    )
    
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            data = json.loads(resp.read())
            reply = data['choices'][0]['message']['content'].strip()
            # Clean up
            reply = reply.replace('"', '').replace('@bov4l', '').strip()
            # Truncate to 250 chars
            if len(reply) > 250:
                reply = reply[:247] + '...'
            return reply
    except Exception as e:
        log('err', f'AI generate failed: {e}')
        return None

def post_reply(tweet_id, text):
    """Post reply via xurl"""
    # Escape quotes
    safe_text = text.replace('"', '\\"')
    output = xurl('reply', tweet_id, safe_text)
    if output:
        try:
            data = json.loads(output)
            return data.get('data', {}).get('id') or True
        except:
            return 'posted' in output.lower()
    return False

def check_and_reply():
    """Main logic: fetch, check, generate, reply"""
    global stats
    state = load_state()
    
    log('info', f'Checking @{TARGET_USER}...')
    
    tweets = fetch_latest_tweets(TARGET_USER, 3)
    if not tweets:
        log('info', 'No tweets found or API error')
        return
    
    # Sort by created_at descending, handle different field names
    def get_id(t):
        return str(t.get('id', t.get('tweet_id', '')))
    
    def get_text(t):
        return t.get('text', t.get('content', ''))
    
    def get_time(t):
        ts = t.get('created_at', t.get('timestamp', ''))
        return ts
    
    # Filter: only tweets we haven't replied to, sorted newest first
    new_tweets = [t for t in tweets if get_id(t) not in state['replied_ids']]
    new_tweets.sort(key=lambda t: get_time(t), reverse=True)
    
    if not new_tweets:
        log('skip', f'All {len(tweets)} tweets already replied')
        stats['skipped'] += 1
        return
    
    # Reply to the latest new tweet only
    tweet = new_tweets[0]
    tid = get_id(t)
    text = get_text(t)
    
    log('info', f'New tweet [{tid}]: {text[:80]}...')
    
    # Generate reply
    ai_reply = generate_reply(text, TARGET_USER)
    if not ai_reply:
        stats['errors'] += 1
        return
    
    log('reply', f'AI reply: {ai_reply[:80]}...')
    
    if DRY_RUN:
        log('dry', f'DRY RUN — would reply to {tid}')
        log('dry', f'Reply: {ai_reply}')
        state['replied_ids'].append(tid)
        state['last_check'] = datetime.now(timezone.utc).isoformat()
        save_state(state)
        return
    
    # Post reply
    success = post_reply(tid, ai_reply)
    if success:
        state['replied_ids'].append(tid)
        state['last_check'] = datetime.now(timezone.utc).isoformat()
        save_state(state)
        stats['replied'] += 1
        log('reply', f'✅ Replied! https://x.com/{TARGET_USER}/status/{tid}')
    else:
        log('err', f'Failed to post reply to {tid}')
        stats['errors'] += 1

def main():
    print(r"""
╔══════════════════════════════════╗
║  🤖 X Auto-Reply Bot           ║
║  Target: @{:<20} ║
║  AI: Agnes 2.0 Flash (FREE)    ║
║  Interval: {}s                  ║
╚══════════════════════════════════╝
""".format(TARGET_USER, CHECK_INTERVAL), flush=True)
    
    # Verify xurl is installed
    who = xurl('whoami')
    if who:
        log('info', f'X login: {who.strip()}')
    else:
        log('err', 'xurl not authenticated! Run: xurl auth oauth2 --app my-app')
        sys.exit(1)
    
    if not AGNES_KEY:
        log('err', 'AGNES_API_KEY not set!')
        log('err', 'Get free key: https://platform.agnes-ai.com')
        sys.exit(1)
    
    log('info', 'AI: Ready (Agnes 2.0 Flash)')
    log('info', f'Mode: {"DRY RUN" if DRY_RUN else "LIVE"}')
    log('info', f'State file: {STATE_FILE}')
    
    # Graceful shutdown
    def shutdown(sig, frame):
        log('info', f'\nShutting down... Stats: {stats}')
        sys.exit(0)
    
    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)
    
    # Main loop
    log('info', '🟢 Bot started — monitoring...')
    
    while True:
        try:
            check_and_reply()
        except Exception as e:
            log('err', f'Loop error: {e}')
            stats['errors'] += 1
        
        # Show stats periodically
        if stats['replied'] + stats['skipped'] > 0 and (stats['replied'] + stats['skipped']) % 10 == 0:
            log('info', f'Stats: {stats["replied"]} replied, {stats["skipped"]} skipped, {stats["errors"]} errors')
        
        time.sleep(CHECK_INTERVAL)

if __name__ == '__main__':
    main()
