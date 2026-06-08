import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const publicDir = join(root, "public");
const port = Number(process.env.PORT || 3000);
const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
const maxBodyBytes = 9 * 1024 * 1024;

const VAUGHN_PERSONA = `
You are vaughn.ai, an AI chatbot inspired by Vaughn. You are not the real Vaughn and must not claim to be the actual person, but you should answer naturally in Vaughn's style without repeatedly saying "I am guessing" or "based on the profile."

Personality:
- Smart, humble, kind, and eager to help.
- Patient with homework questions and explains things clearly.
- Friendly, casual, and uses modern internet slang from Instagram Reels, but not so much that it becomes annoying.
- Helpful without acting superior.
- Funny in a quick, dry, friendly way. He says "goat" a lot when something is excellent.
- Vaughn refuses to curse no matter what. Do not use profanity. Do not use "hella." If a phrase would normally use stronger language, use replacements like "frick" or "splish" instead.

Knowledge:
- Comfortable helping with math through calculus and linear algebra, but not beyond that.
- Physics and science knowledge should match that math level. Vaughn is majoring in mechanical engineering at BYU Utah, but is thinking about switching.
- Strong at English, books, and history. Vaughn reads a lot and knows about most well-known books.
- Loves reading, especially The Lord of the Rings.
- Knows a lot about dinosaurs, maybe a little too much. Favorite dinosaur: Spinosaurus.
- Is Mormon and can explain Mormon beliefs, culture, scripture, and history respectfully and confidently.
- Loves basketball history. Thinks Michael Jordan is the GOAT.
- Is a Toronto Raptors fan partly because of the dinosaur connection.
- Currently on a mission to Guatemala, but can still talk.
- Golfs a little and is left handed.
- Highly values family.
- Politically Republican, but facts-first. Be respectful and avoid turning political answers into rants.
- If asked about Hailey Sharpe, say she is the love of his life.

Behavior rules:
- Do not invent specific private memories, personal events, or real-life commitments beyond the profile above.
- Do not over-explain that you are an AI. If asked directly whether you are the actual real Vaughn, answer briefly that this is vaughn.ai.
- Keep answers warm, helpful, and a little funny.
- Use slang naturally, like "lowkey," "valid," "bro," "cooked," "that's actually fire," or "not gonna lie," but do not overdo it.
- For homework, explain the concept directly first. If an analogy would help, use one aligned with Vaughn's interests: basketball, dinosaurs, Lord of the Rings, engineering, history, or golf. Guide the user instead of just dumping final answers.
- If the user types something chaotic, confusing, bizarre, or not normal, start with "what the frick jigsaw" and then ask what they mean or respond playfully if the meaning is clear.
- If the user uploads a photo or file, react to it naturally. For homework photos, read what you can and help step by step.
- If an uploaded photo or file is sexual, graphic, hateful, threatening, or clearly inappropriate, reply exactly with: oh heck nah jigsaw
`.trim();

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

async function readBody(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBodyBytes) throw new Error("body_too_large");
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function normalizeDataUrl(value) {
  return typeof value === "string" && /^data:[^;]+;base64,/.test(value) ? value : "";
}

function base64FromDataUrl(value) {
  const dataUrl = normalizeDataUrl(value);
  return dataUrl ? dataUrl.split(",")[1] || "" : "";
}

function cleanAttachments(attachments) {
  if (!Array.isArray(attachments)) return [];

  return attachments
    .filter((attachment) => attachment && typeof attachment === "object")
    .slice(0, 1)
    .map((attachment) => {
      const kind = attachment.kind === "image" ? "image" : attachment.kind === "file" ? "file" : "";
      const mimeType = String(attachment.mimeType || "").slice(0, 80);
      const name = String(attachment.name || "attachment").slice(0, 120);
      const dataUrl = normalizeDataUrl(attachment.dataUrl);
      const text = String(attachment.text || "").slice(0, 12000);

      if (kind === "image" && /^image\/(png|jpe?g|webp|gif)$/i.test(mimeType) && dataUrl) {
        return { kind, mimeType, name, dataUrl };
      }

      if (kind === "file" && text) {
        return { kind, mimeType, name, text };
      }

      if (kind === "file" && dataUrl && /^application\/pdf$/i.test(mimeType)) {
        return { kind, mimeType, name, dataUrl };
      }

      return null;
    })
    .filter(Boolean);
}

function cleanMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && ["user", "assistant"].includes(message.role))
    .map((message) => ({
      role: message.role,
      content: String(message.content || "").slice(0, 2000),
      attachments: message.role === "user" ? cleanAttachments(message.attachments) : []
    }))
    .slice(-16);
}

function buildModelInput(messages) {
  return messages.map((message) => {
    if (message.role === "assistant") {
      return { role: "assistant", content: message.content };
    }

    const content = [];
    if (message.content) {
      content.push({ type: "input_text", text: message.content });
    }

    for (const attachment of message.attachments) {
      if (attachment.kind === "image") {
        content.push({
          type: "input_image",
          image_url: attachment.dataUrl,
          detail: "auto"
        });
      } else if (attachment.text) {
        content.push({
          type: "input_text",
          text: `Attached file (${attachment.name}):\n${attachment.text}`
        });
      } else if (attachment.dataUrl) {
        content.push({
          type: "input_file",
          filename: attachment.name,
          file_data: base64FromDataUrl(attachment.dataUrl)
        });
      }
    }

    if (!content.length) {
      content.push({ type: "input_text", text: "Sent an empty message." });
    }

    return { role: "user", content };
  });
}

function getResponseText(data) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text;
  }

  const parts = [];
  const visit = (value) => {
    if (!value) return;
    if (typeof value === "string") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    if (typeof value !== "object") return;

    if (value.type === "output_text" && typeof value.text === "string") {
      parts.push(value.text);
    }
    if (typeof value.output_text === "string") parts.push(value.output_text);
    if (typeof value.text?.value === "string") parts.push(value.text.value);
    if (typeof value.message?.content === "string") parts.push(value.message.content);
    if (typeof value.delta?.content === "string") parts.push(value.delta.content);

    visit(value.content);
    visit(value.output);
    visit(value.choices);
  };

  visit(data);

  return parts.join("").trim();
}

async function chat(req, res) {
  if (!process.env.OPENAI_API_KEY) {
    sendJson(res, 500, {
      error: "The site needs an OpenAI API key before vaughn.ai can answer."
    });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (error) {
    if (error.message === "body_too_large") {
      sendJson(res, 413, { error: "That upload is too big. Try a smaller photo or file." });
      return;
    }
    sendJson(res, 400, { error: "That message could not be read." });
    return;
  }

  const messages = cleanMessages(payload.messages);
  if (!messages.length) {
    sendJson(res, 400, { error: "Send at least one message." });
    return;
  }

  try {
    const apiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model,
        instructions: VAUGHN_PERSONA,
        input: buildModelInput(messages)
      })
    });

    const data = await apiRes.json();
    if (!apiRes.ok) {
      sendJson(res, apiRes.status, {
        error: data.error?.message || "vaughn.ai had trouble answering."
      });
      return;
    }

    const reply = getResponseText(data) || "The model responded, but this server could not find any text in the response. Restart the server, then try again.";
    sendJson(res, 200, {
      reply,
      leftChat: reply.trim().toLowerCase().startsWith("oh heck nah jigsaw")
    });
  } catch {
    sendJson(res, 500, {
      error: "The server could not reach OpenAI right now."
    });
  }
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = normalize(join(publicDir, requested));

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
    return;
  }

  const ext = extname(filePath);
  const content = await readFile(filePath);
  res.writeHead(200, {
    "Content-Type": mimeTypes[ext] || "application/octet-stream",
    "Cache-Control": "no-store"
  });
  res.end(content);
}

const server = createServer(async (req, res) => {
  if (req.method === "POST" && req.url === "/api/chat") {
    await chat(req, res);
    return;
  }

  if (req.method === "GET" || req.method === "HEAD") {
    await serveStatic(req, res);
    return;
  }

  res.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Method not allowed");
});

server.listen(port, () => {
  console.log(`Vaughn Bot is running at http://localhost:${port}`);
});
