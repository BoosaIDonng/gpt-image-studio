// 代理自测：拉起一个本地上游 echo 服务，验证 POST body、预检、流式转发。
import { createServer } from "node:http";

const upstream = createServer((req, res) => {
  if (req.method === "OPTIONS") {
    res.writeHead(200).end();
    return;
  }
  if (req.url?.startsWith("/sse")) {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    let i = 0;
    const timer = setInterval(() => {
      i += 1;
      res.write(`data: ${JSON.stringify({ i })}\n\n`);
      if (i >= 3) {
        clearInterval(timer);
        res.write("data: [DONE]\n\n");
        res.end();
      }
    }, 20);
    return;
  }
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        method: req.method,
        url: req.url,
        authorization: req.headers.authorization ?? null,
        contentType: req.headers["content-type"] ?? null,
        body: Buffer.concat(chunks).toString("utf8"),
      }),
    );
  });
});

await new Promise((resolve) => upstream.listen(39117, "127.0.0.1", resolve));

const PROXY = "http://127.0.0.1:8787";
const TARGET = "http://127.0.0.1:39117";
const origin = "https://image.idurspace.cn";
const results = [];

function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
}

// 1. POST JSON + Authorization 头转发
{
  const res = await fetch(
    `${PROXY}/?url=${encodeURIComponent(`${TARGET}/v1/images/generations?a=1`)}`,
    {
      method: "POST",
      headers: {
        Origin: origin,
        Authorization: "Bearer sk-test",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: "gpt-image-2", prompt: "hi" }),
    },
  );
  const payload = await res.json();
  check("POST JSON 转发", payload.method === "POST", `method=${payload.method}`);
  check("Authorization 头透传", payload.authorization === "Bearer sk-test");
  check(
    "body 与 query 透传",
    payload.body === '{"model":"gpt-image-2","prompt":"hi"}' && payload.url.includes("a=1"),
    payload.url,
  );
  check("响应带 CORS 头", res.headers.get("access-control-allow-origin") === origin);
}

// 2. multipart 表单转发（图片编辑走这条路）
{
  const form = new FormData();
  form.append("model", "gpt-image-2");
  form.append("prompt", "edit it");
  form.append("image[]", new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" }), "a.png");
  const res = await fetch(`${PROXY}/?url=${encodeURIComponent(`${TARGET}/v1/images/edits`)}`, {
    method: "POST",
    headers: { Authorization: "Bearer sk-test" },
    body: form,
  });
  const payload = await res.json();
  check(
    "multipart 表单转发",
    (payload.contentType ?? "").startsWith("multipart/form-data") &&
      payload.body.includes('name="prompt"') &&
      payload.body.includes('name="image[]"'),
    payload.contentType,
  );
}

// 3. OPTIONS 预检
{
  const res = await fetch(`${PROXY}/?url=${encodeURIComponent(`${TARGET}/v1/images/edits`)}`, {
    method: "OPTIONS",
    headers: {
      Origin: origin,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "authorization,content-type",
    },
  });
  check("OPTIONS 预检 204", res.status === 204, `status=${res.status}`);
  check(
    "预检放行 authorization",
    (res.headers.get("access-control-allow-headers") ?? "").includes("authorization"),
  );
}

// 4. 流式 SSE 透传（不缓冲、事件完整）
{
  const res = await fetch(`${PROXY}/?url=${encodeURIComponent(`${TARGET}/sse`)}`);
  const text = await res.text();
  check(
    "SSE 流式透传",
    text.includes('data: {"i":1}') && text.includes('data: {"i":3}') && text.includes("[DONE]"),
    JSON.stringify(text.slice(0, 40)),
  );
}

// 5. 路径式写法 + 非法协议拦截
{
  const res = await fetch(`${PROXY}/${TARGET}/v1/models`);
  const payload = await res.json();
  check("路径式写法", payload.url === "/v1/models", payload.url);

  const bad = await fetch(`${PROXY}/?url=${encodeURIComponent("file:///C:/Windows/win.ini")}`);
  check("非 http/https 被拦截", bad.status === 400, `status=${bad.status}`);
}

// 6. 上游不可达 → 502
{
  const res = await fetch(`${PROXY}/?url=${encodeURIComponent("http://127.0.0.1:39118/nope")}`);
  check("上游不可达返回 502", res.status === 502, `status=${res.status}`);
}

upstream.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} 通过`);
process.exit(failed.length ? 1 : 0);
