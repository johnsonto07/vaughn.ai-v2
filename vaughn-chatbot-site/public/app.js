const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const messagesEl = document.querySelector("#messages");
const introView = document.querySelector("#intro-view");
const chatView = document.querySelector("#chat-view");
const startChatButton = document.querySelector("#start-chat");
const backButton = document.querySelector("#back-button");
const attachButton = document.querySelector("#attach-button");
const fileInput = document.querySelector("#file-input");
const attachmentPreview = document.querySelector("#attachment-preview");
const sendButton = form.querySelector("button[type='submit']");

const history = [];
let selectedAttachment = null;
const imageLimit = 6 * 1024 * 1024;
const fileLimit = 1024 * 1024;
const timeFormatter = new Intl.DateTimeFormat([], {
  hour: "numeric",
  minute: "2-digit"
});

function setAppHeight() {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty("--app-height", `${height}px`);
}

function formatTime(date = new Date()) {
  return timeFormatter.format(date);
}

function setInitialTimestamps() {
  const stamp = document.querySelector("#chat-date-stamp");
  if (stamp) stamp.textContent = `Today ${formatTime()}`;

  for (const time of document.querySelectorAll(".message-time")) {
    if (!time.textContent) time.textContent = formatTime();
  }
}

function readFile(file, mode = "dataUrl") {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result));
    reader.addEventListener("error", () => reject(reader.error));
    if (mode === "text") reader.readAsText(file);
    else reader.readAsDataURL(file);
  });
}

function addAttachmentToElement(parent, attachment) {
  if (!attachment) return;

  const holder = document.createElement("div");
  holder.className = "message-attachment";

  if (attachment.kind === "image") {
    const img = document.createElement("img");
    img.src = attachment.dataUrl;
    img.alt = attachment.name || "Uploaded image";
    holder.append(img);
  } else {
    const chip = document.createElement("div");
    chip.className = "file-chip";
    chip.textContent = attachment.name || "Attached file";
    holder.append(chip);
  }

  parent.append(holder);
}

function addMessage(role, content, attachments = []) {
  const article = document.createElement("article");
  article.className = `message ${role === "user" ? "user" : "bot"}`;

  if (attachments.length) {
    const contentWrap = document.createElement("div");
    contentWrap.className = "message-content";
    for (const attachment of attachments) addAttachmentToElement(contentWrap, attachment);
    if (content) {
      const bubble = document.createElement("p");
      bubble.textContent = content;
      contentWrap.append(bubble);
    }
    article.append(contentWrap);
  } else {
    const bubble = document.createElement("p");
    bubble.textContent = content;
    article.append(bubble);
  }

  const time = document.createElement("time");
  time.className = "message-time";
  time.textContent = formatTime();
  article.append(time);

  messagesEl.append(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addChatNote(content) {
  const article = document.createElement("article");
  article.className = "message chat-note";
  const note = document.createElement("p");
  note.textContent = content;
  article.append(note);
  messagesEl.append(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setWaiting(waiting) {
  sendButton.disabled = waiting;
  attachButton.disabled = waiting;
  input.disabled = waiting;
}

function clearAttachment() {
  selectedAttachment = null;
  fileInput.value = "";
  attachmentPreview.hidden = true;
  attachmentPreview.replaceChildren();
}

function renderAttachmentPreview() {
  attachmentPreview.replaceChildren();
  if (!selectedAttachment) {
    attachmentPreview.hidden = true;
    return;
  }

  if (selectedAttachment.kind === "image") {
    const img = document.createElement("img");
    img.src = selectedAttachment.dataUrl;
    img.alt = selectedAttachment.name;
    attachmentPreview.append(img);
  } else {
    const file = document.createElement("div");
    file.className = "preview-file";
    file.textContent = selectedAttachment.name;
    attachmentPreview.append(file);
  }

  const remove = document.createElement("button");
  remove.className = "remove-attachment";
  remove.type = "button";
  remove.setAttribute("aria-label", "Remove attachment");
  remove.textContent = "×";
  remove.addEventListener("click", clearAttachment);
  attachmentPreview.append(remove);
  attachmentPreview.hidden = false;
}

function showChat() {
  introView.classList.remove("is-active");
  introView.setAttribute("aria-hidden", "true");
  chatView.classList.add("is-active");
  chatView.removeAttribute("aria-hidden");
  window.setTimeout(() => input.focus(), 320);
}

function showIntro() {
  chatView.classList.remove("is-active");
  chatView.setAttribute("aria-hidden", "true");
  introView.classList.add("is-active");
  introView.removeAttribute("aria-hidden");
  window.setTimeout(() => startChatButton.focus(), 320);
}

startChatButton.addEventListener("click", showChat);
backButton.addEventListener("click", showIntro);
setInitialTimestamps();
setAppHeight();
window.visualViewport?.addEventListener("resize", setAppHeight);
window.addEventListener("resize", setAppHeight);

let dragStartX = 0;
let dragStartY = 0;
let revealAmount = 0;
let isDraggingTimes = false;

function setTimeReveal(amount) {
  revealAmount = Math.max(0, Math.min(54, amount));
  messagesEl.style.setProperty("--time-reveal", `${revealAmount}px`);
  messagesEl.style.setProperty("--time-opacity", `${revealAmount / 54}`);
}

function resetTimeReveal() {
  messagesEl.classList.remove("is-revealing-times");
  setTimeReveal(0);
  isDraggingTimes = false;
}

messagesEl.addEventListener("pointerdown", (event) => {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  dragStartX = event.clientX;
  dragStartY = event.clientY;
  isDraggingTimes = true;
  messagesEl.classList.add("is-revealing-times");
});

messagesEl.addEventListener("pointermove", (event) => {
  if (!isDraggingTimes) return;
  const dx = dragStartX - event.clientX;
  const dy = Math.abs(dragStartY - event.clientY);
  if (dy > 24 && dx < 14) return;
  if (dx > 0) {
    setTimeReveal(dx);
    event.preventDefault();
  }
});

messagesEl.addEventListener("pointerup", resetTimeReveal);
messagesEl.addEventListener("pointercancel", resetTimeReveal);
messagesEl.addEventListener("pointerleave", resetTimeReveal);

attachButton.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  try {
    if (file.type.startsWith("image/")) {
      if (file.size > imageLimit) {
        addChatNote("That photo is too big. Try one under 6 MB.");
        clearAttachment();
        return;
      }

      selectedAttachment = {
        kind: "image",
        name: file.name,
        mimeType: file.type,
        size: file.size,
        dataUrl: await readFile(file)
      };
    } else {
      if (file.size > fileLimit) {
        addChatNote("That file is too big. Try one under 1 MB.");
        clearAttachment();
        return;
      }

      const isText = file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name);
      selectedAttachment = {
        kind: "file",
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl: isText ? "" : await readFile(file),
        text: isText ? await readFile(file, "text") : ""
      };
    }

    renderAttachmentPreview();
  } catch {
    addChatNote("That upload did not work. Try a different file.");
    clearAttachment();
  }
});

input.addEventListener("input", () => {
  input.style.height = "auto";
  input.style.height = `${input.scrollHeight}px`;
});

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const content = input.value.trim();
  const attachments = selectedAttachment ? [selectedAttachment] : [];
  if (!content && !attachments.length) return;

  input.value = "";
  input.style.height = "auto";
  clearAttachment();
  history.push({ role: "user", content, attachments });
  addMessage("user", content, attachments);
  addMessage("assistant", "Thinking...");
  const thinkingBubble = messagesEl.lastElementChild.querySelector("p");

  setWaiting(true);

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Something went wrong.");

    thinkingBubble.textContent = data.reply;
    history.push({ role: "assistant", content: data.reply });
    if (data.leftChat) addChatNote("vaughn has left the chat");
  } catch (error) {
    thinkingBubble.textContent = `${error.message} Add your API key on the server and try again.`;
  } finally {
    setWaiting(false);
    input.focus();
  }
});
