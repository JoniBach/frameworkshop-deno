import { assert, assertEquals } from "@std/assert";
import { add, handleRequest, kv } from "./main.ts";

Deno.test(function addTest() {
  assertEquals(add(2, 3), 5);
});

Deno.test("POST /input-example stores and GET retrieves", async () => {
  const payload = { email: "test@example.com" };

  const postReq = new Request("http://localhost:3000/input-example", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const postRes = await handleRequest(postReq);
  assertEquals(postRes.status, 200);
  const postData = await postRes.json();
  assertEquals(postData.status, "ok");
  assertEquals(postData.saved.input, payload);

  const getReq = new Request("http://localhost:3000/input-example", { method: "GET" });
  const getRes = await handleRequest(getReq);
  assertEquals(getRes.status, 200);
  const getData = await getRes.json();
  assertEquals(getData.status, "ok");
  assertEquals(getData.data.id, postData.saved.id);
  assertEquals(getData.data.input.email, payload.email);

  // cleanup KV entry for isolated tests
  await kv.delete(["input-example", "current"]);

});

Deno.test("POST /auth/register stores a hashed password and returns a safe user", async () => {
  const email = "register@example.com";
  const password = "correct horse battery staple";

  const req = new Request("http://localhost:3000/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const res = await handleRequest(req);
  assertEquals(res.status, 201);
  const data = await res.json();
  assertEquals(data.status, "ok");
  assertEquals(data.user.email, email);
  assert(!("password" in data.user));
  assert(!("passwordHash" in data.user));

  const stored = await kv.get(["auth", "users", email]);
  assert(stored.value);
  assertEquals(stored.value.email, email);
  assertEquals(stored.value.passwordHash.algorithm, "PBKDF2-SHA-256");
  assertEquals(stored.value.passwordHash.iterations, 210000);
  assert(stored.value.passwordHash.hash !== password);
  assert(!("password" in stored.value));

  await kv.delete(["auth", "users", email]);
});

Deno.test("POST /auth/register rejects duplicate users", async () => {
  const email = "duplicate@example.com";
  const payload = { email, password: "correct horse battery staple" };

  const firstReq = new Request("http://localhost:3000/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const secondReq = new Request("http://localhost:3000/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  assertEquals((await handleRequest(firstReq)).status, 201);
  assertEquals((await handleRequest(secondReq)).status, 409);

  await kv.delete(["auth", "users", email]);
});

Deno.test("POST /auth/register rejects weak passwords", async () => {
  const req = new Request("http://localhost:3000/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "weak@example.com", password: "short" }),
  });

  const res = await handleRequest(req);
  assertEquals(res.status, 400);
});

Deno.test("POST /auth/login returns a safe user for valid credentials", async () => {
  const email = "login@example.com";
  const password = "goodpassword";

  const registerReq = new Request("http://localhost:3000/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assertEquals((await handleRequest(registerReq)).status, 201);

  const loginReq = new Request("http://localhost:3000/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const loginRes = await handleRequest(loginReq);
  assertEquals(loginRes.status, 200);
  const data = await loginRes.json();
  assertEquals(data.status, "ok");
  assertEquals(data.user.email, email);
  assert(!("password" in data.user));
  assert(!("passwordHash" in data.user));

  await kv.delete(["auth", "users", email]);
});

Deno.test("POST /auth/login rejects invalid credentials", async () => {
  const email = "invalid-login@example.com";
  const password = "goodpassword";

  const registerReq = new Request("http://localhost:3000/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  assertEquals((await handleRequest(registerReq)).status, 201);

  const loginReq = new Request("http://localhost:3000/auth/login", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "wrongpassword" }),
  });

  const loginRes = await handleRequest(loginReq);
  assertEquals(loginRes.status, 401);

  await kv.delete(["auth", "users", email]);
});

