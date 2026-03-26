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

function cors(headers: Headers) {
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'POST, GET, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type');
}

export async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const headers = new Headers({ 'content-type': 'application/json' });
  cors(headers);

  if (url.pathname !== '/input-example') {
    return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers });
  }

  if (req.method === 'GET') {
    const value = await kv.get(['input-example', 'current'])
    if (!value.value) {
      return new Response(JSON.stringify({ status: 'empty', data: null }), { status: 200, headers })
    }
    return new Response(JSON.stringify({ status: 'ok', data: value.value }), { status: 200, headers })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers });
  }

  const contentType = req.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return new Response(JSON.stringify({ error: 'Unsupported Media Type: expected application/json' }), { status: 415, headers });
  }

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Bad Request: invalid JSON' }), { status: 400, headers });
  }

  if (!body || typeof body !== 'object' || !('email' in body)) {
    return new Response(JSON.stringify({ error: 'Bad Request: missing email' }), { status: 400, headers });
  }

  const id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const entry = { id, timestamp, input: body };

  await kv.set(['input-example', 'current'], entry);

  return new Response(JSON.stringify({ status: 'ok', saved: entry }), {
    status: 200,
    headers,
  });
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  const PORT = 3000;
  console.log(`Starting server on http://localhost:${PORT}`);
  serve(handleRequest, { port: PORT });
}
