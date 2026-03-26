import { serve } from "https://deno.land/std@0.203.0/http/server.ts";

export function add(a: number, b: number): number {
  return a + b;
}

// Learn more at https://docs.deno.com/runtime/manual/examples/module_metadata#concepts
if (import.meta.main) {
  // Start a simple HTTP server with one POST endpoint at /input-example
  const PORT = 3000;

  console.log(`Starting server on http://localhost:${PORT}`);

  serve(async (req) => {
    try {
      const url = new URL(req.url);
      // Only accept POST to /input-example
      if (url.pathname !== '/input-example') {
        return new Response(JSON.stringify({ error: 'Not Found' }), { status: 404, headers: { 'content-type': 'application/json' } });
      }

      if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { status: 405, headers: { 'content-type': 'application/json' } });
      }

      const contentType = req.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return new Response(JSON.stringify({ error: 'Unsupported Media Type: expected application/json' }), { status: 415, headers: { 'content-type': 'application/json' } });
      }

      let body: any;
      try {
        body = await req.json();
      } catch (err) {
        return new Response(JSON.stringify({ error: 'Bad Request: invalid JSON' }), { status: 400, headers: { 'content-type': 'application/json' } });
      }

      // Typical successful response: echo back the received payload with an id and timestamp
      const response = {
        status: 'ok',
        received: body,
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: {
          'content-type': 'application/json',
          'access-control-allow-origin': '*',
          'access-control-allow-methods': 'POST, OPTIONS',
          'access-control-allow-headers': 'content-type',
        },
      });
    } catch (err) {
      console.error('Server error', err);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), { status: 500, headers: { 'content-type': 'application/json' } });
    }
  }, { port: PORT });
}
