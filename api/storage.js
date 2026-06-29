// src/storage.ts — JSON file-based storage (Vercel-compatible, replaces SQLite)
// Uses /tmp for serverless compatibility.

const {  existsSync, readFileSync, writeFileSync, mkdirSync  } = require('fs'');
const {  dirname  } = require('path'');
const {  createCipheriv, createDecipheriv, createHash, randomBytes  } = require('crypto'');

  id: number;
  source_query: string | null;
  source_post_ids: string | null;
  generated_text: string;
  threads_post_id: string | null;
  published_at: string | null;
}

  id: number;
  access_token: string;
  refreshed_at: string;
  expires_at: string;
  user_id: string | null;
}

  id: number;
  status: 'success' | 'failed';
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

interface DBState {
  posts: Post[];
  tokens: Token[];
  runs: Run[];
  used_images: { image_id: string; image_url: string; used_at: string }[];
  nextIds: { posts: number; runs: number };
}

function emptyState(): DBState {
  return {
    posts: [],
    tokens: [],
    runs: [],
    used_images: [],
    nextIds: { posts: 1, runs: 1 },
  };
}

let _state: DBState | undefined;
let _dbPath: string | undefined;

function getDbPath(): string {
  if (_dbPath) return _dbPath;
  const envPath = process.env['DB_PATH'] || '/tmp/state.json';
  _dbPath = envPath;
  return _dbPath;
}

function loadState(): DBState {
  if (_state) return _state;
  const dbPath = getDbPath();
  try {
    const dir = dirname(dbPath);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (existsSync(dbPath)) {
      const raw = readFileSync(dbPath, 'utf-8');
      _state = JSON.parse(raw) as DBState;
      if (!_state.nextIds) _state.nextIds = { posts: 1, runs: 1 };
      if (!_state.used_images) _state.used_images = [];
      if (!_state.runs) _state.runs = [];
      if (!_state.posts) _state.posts = [];
      if (!_state.tokens) _state.tokens = [];
      return _state;
    }
  } catch {
    // File doesn't exist or is corrupted
  }
  _state = emptyState();
  return _state;
}

function saveState(): void {
  if (!_state) return;
  const dir = dirname(getDbPath());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(getDbPath(), JSON.stringify(_state, null, 2), { mode: 0o600 });
}

function deriveTokenKey(secret: string): Buffer {
  return createHash('sha256').update(secret).digest();
}

function encryptToken(accessToken: string, secret: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deriveTokenKey(secret), iv);
  const encrypted = Buffer.concat([cipher.update(accessToken, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return 'enc:v1:' + iv.toString('base64') + ':' + tag.toString('base64') + ':' + encrypted.toString('base64');
}

function decryptToken(payload: string, secret: string): string {
  if (!payload.startsWith('enc:v1:')) return payload;
  const parts = payload.split(':');
  const ivBase64 = parts[2];
  const tagBase64 = parts[3];
  const cipherBase64 = parts[4];
  if (!ivBase64 || !tagBase64 || !cipherBase64) {
    throw new Error('Stored token payload is malformed');
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    deriveTokenKey(secret),
    Buffer.from(ivBase64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagBase64, 'base64'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(cipherBase64, 'base64')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

function saveToken(
  secret: string,
  accessToken: string,
  expiresAt: Date,
  userId?: string,
): void {
  const s = loadState();
  const existing = s.tokens.find(function(t) { return t.id === 1; });
  const persistedUserId = userId !== undefined ? String(userId) : (existing ? existing.user_id : null);

  if (existing) {
    existing.access_token = encryptToken(accessToken, secret);
    existing.refreshed_at = new Date().toISOString();
    existing.expires_at = expiresAt.toISOString();
    existing.user_id = persistedUserId;
  } else {
    s.tokens.push({
      id: 1,
      access_token: encryptToken(accessToken, secret),
      refreshed_at: new Date().toISOString(),
      expires_at: expiresAt.toISOString(),
      user_id: persistedUserId,
    });
  }
  saveState();
}

function updateTokenUserId(userId: string): void {
  const s = loadState();
  const token = s.tokens.find(function(t) { return t.id === 1; });
  if (token) token.user_id = String(userId);
  saveState();
}

function loadToken(secret: string): Token | undefined {
  const s = loadState();
  const token = s.tokens.find(function(t) { return t.id === 1; });
  if (!token) return undefined;
  return { ...token, access_token: decryptToken(token.access_token, secret) };
}

function savePostRecord(post: Omit<Post, 'id'>): number {
  const s = loadState();
  const id = s.nextIds.posts++;
  s.posts.push({ id: id, ...post });
  saveState();
  return id;
}

function getRecentPosts(limit: number = 5): Post[] {
  const s = loadState();
  return s.posts
    .filter(function(p) { return p.threads_post_id !== null; })
    .sort(function(a, b) { return b.id - a.id; })
    .slice(0, limit);
}

function startRunRecord(): number {
  const s = loadState();
  const id = s.nextIds.runs++;
  s.runs.push({
    id: id,
    status: 'failed',
    started_at: new Date().toISOString(),
    error_message: null,
    completed_at: null,
  });
  saveState();
  return id;
}

function completeRunRecord(
  runId: number,
  status: 'success' | 'failed',
  errorMessage?: string,
): void {
  const s = loadState();
  const run = s.runs.find(function(r) { return r.id === runId; });
  if (run) {
    run.status = status;
    run.error_message = errorMessage ?? null;
    run.completed_at = new Date().toISOString();
  }
  saveState();
}

function countRecentFailures(last: number = 3): number {
  const s = loadState();
  const recent = s.runs.sort(function(a, b) { return b.id - a.id; }).slice(0, last);
  if (recent.length < last) return 0;
  return recent.every(function(r) { return r.status === 'failed'; }) ? last : 0;
}

function getUsedImageIds(): Set<string> {
  const s = loadState();
  return new Set(s.used_images.map(function(r) { return r.image_id; }));
}

function markImageUsed(imageId: string, imageUrl: string): void {
  const s = loadState();
  s.used_images.push({
    image_id: imageId,
    image_url: imageUrl,
    used_at: new Date().toISOString(),
  });
  if (s.used_images.length > 200) {
    s.used_images = s.used_images.slice(-200);
  }
  saveState();
}

function resetStorage(): void {
  _state = undefined;
}
