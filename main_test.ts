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
