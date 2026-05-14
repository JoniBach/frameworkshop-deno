/// <reference lib="deno.ns" />
import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

declare const Deno: {
  openKv(): Promise<any>
}

declare global {
  interface ImportMeta {
    main: boolean
  }
}

export function add(a: number, b: number): number {
  return a + b;
}

export const kv = await Deno.openKv();

const PASSWORD_HASH_ALGORITHM = 'PBKDF2-SHA-256';
const PASSWORD_HASH_ITERATIONS = 210_000;
const PASSWORD_HASH_LENGTH_BITS = 256;

type PasswordHash = {
  algorithm: string
  iterations: number
  salt: string
  hash: string
}

type StoredUser = {
  id: string
  email: string
  createdAt: string
  passwordHash: PasswordHash
}

function cors(headers: Headers) {
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'POST, GET, DELETE, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type');
}

function json(data: unknown, status: number, headers: Headers) {
  return new Response(JSON.stringify(data), { status, headers });
}

function toBase64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function fromBase64(value: string) {
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function safeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;

  let difference = 0;
  for (let i = 0; i < left.length; i++) {
    difference |= left[i] ^ right[i];
  }
  return difference === 0;
}

async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hashBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: PASSWORD_HASH_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    PASSWORD_HASH_LENGTH_BITS,
  );

  return {
    algorithm: PASSWORD_HASH_ALGORITHM,
    iterations: PASSWORD_HASH_ITERATIONS,
    salt: toBase64(salt),
    hash: toBase64(new Uint8Array(hashBits)),
  };
}

async function verifyPassword(password: string, passwordHash: PasswordHash) {
  if (passwordHash.algorithm !== PASSWORD_HASH_ALGORITHM) return false;

  const salt = fromBase64(passwordHash.salt);
  const expectedHash = fromBase64(passwordHash.hash);
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const hashBits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt,
      iterations: passwordHash.iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    PASSWORD_HASH_LENGTH_BITS,
  );

  return safeEqual(new Uint8Array(hashBits), expectedHash);
}

async function readJsonBody(req: Request, headers: Headers) {
  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { error: json({ error: 'Unsupported Media Type: expected application/json' }, 415, headers) };
  }

  try {
    return { body: await req.json() };
  } catch (err) {
    return { error: json({ error: 'Bad Request: invalid JSON' }, 400, headers) };
  }
}

async function handleInputExample(req: Request, headers: Headers): Promise<Response> {
  if (req.method === 'GET') {
    const value = await kv.get(['input-example', 'current'])
    if (!value.value) {
      return json({ status: 'empty', data: null }, 200, headers)
    }
    return json({ status: 'ok', data: value.value }, 200, headers)
  }

  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405, headers);
  }

  const parsed = await readJsonBody(req, headers);
  if (parsed.error) return parsed.error;

  const body = parsed.body;
  if (!body || typeof body !== 'object' || !('email' in body)) {
    return json({ error: 'Bad Request: missing email' }, 400, headers);
  }

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const entry = { id, timestamp, input: body };

  await kv.set(['input-example', 'current'], entry);

  return json({ status: 'ok', saved: entry }, 200, headers);
}

async function handleAuthRegister(req: Request, headers: Headers): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405, headers);
  }

  const parsed = await readJsonBody(req, headers);
  if (parsed.error) return parsed.error;

  const body = parsed.body;
  if (!body || typeof body !== 'object') {
    return json({ error: 'Bad Request: expected JSON object' }, 400, headers);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Bad Request: invalid email' }, 400, headers);
  }

  if (password.length < 9) {
    return json({ error: 'Bad Request: password must be at least 9 characters' }, 400, headers);
  }

  const existing = await kv.get(['auth', 'users', email]);
  if (existing.value) {
    return json({ error: 'Conflict: user already exists' }, 409, headers);
  }

  const id = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const passwordHash = await hashPassword(password);
  const user = { id, email, createdAt };

  await kv.set(['auth', 'users', email], {
    ...user,
    passwordHash,
  });

  return json({ status: 'ok', user }, 201, headers);
}

async function handleAuthLogin(req: Request, headers: Headers): Promise<Response> {
  if (req.method !== 'POST') {
    return json({ error: 'Method Not Allowed' }, 405, headers);
  }

  const parsed = await readJsonBody(req, headers);
  if (parsed.error) return parsed.error;

  const body = parsed.body;
  if (!body || typeof body !== 'object') {
    return json({ error: 'Bad Request: expected JSON object' }, 400, headers);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!email || !password) {
    return json({ error: 'Bad Request: missing email or password' }, 400, headers);
  }

  const existing = await kv.get(['auth', 'users', email]) as { value: StoredUser | null };
  if (!existing.value) {
    return json({ error: 'Unauthorized: invalid email or password' }, 401, headers);
  }

  const passwordMatches = await verifyPassword(password, existing.value.passwordHash);
  if (!passwordMatches) {
    return json({ error: 'Unauthorized: invalid email or password' }, 401, headers);
  }

  const user = {
    id: existing.value.id,
    email: existing.value.email,
    createdAt: existing.value.createdAt,
  };

  return json({ status: 'ok', user }, 200, headers);
}

async function handleAuthDeleteUser(req: Request, headers: Headers): Promise<Response> {
  if (req.method !== 'DELETE') {
    return json({ error: 'Method Not Allowed' }, 405, headers);
  }

  const parsed = await readJsonBody(req, headers);
  if (parsed.error) return parsed.error;

  const body = parsed.body;
  if (!body || typeof body !== 'object') {
    return json({ error: 'Bad Request: expected JSON object' }, 400, headers);
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'Bad Request: invalid email' }, 400, headers);
  }

  const existing = await kv.get(['auth', 'users', email]);
  if (!existing.value) {
    return json({ error: 'Not Found: user does not exist' }, 404, headers);
  }

  await kv.delete(['auth', 'users', email]);

  return json({ status: 'ok', deleted: { email } }, 200, headers);
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const headers = new Headers({ 'content-type': 'application/json' });
  cors(headers);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  if (url.pathname === '/input-example') {
    return await handleInputExample(req, headers);
  }

  if (url.pathname === '/auth/register') {
    return await handleAuthRegister(req, headers);
  }

  if (url.pathname === '/auth/login') {
    return await handleAuthLogin(req, headers);
  }

  if (url.pathname === '/auth/user') {
    return await handleAuthDeleteUser(req, headers);
  }

  return json({ error: 'Not Found' }, 404, headers);
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const PORT = 3000;
  console.log(`Starting server on http://localhost:${PORT}`);
  serve(handleRequest, { port: PORT });
}
