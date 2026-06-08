const form = document.querySelector("#chat-form");
const input = document.querySelector("#message-input");
const messagesEl = document.querySelector("#messages");
const introView = document.querySelector("#intro-view");
const chatView = document.querySelector("#chat-view");
const startChatButton = document.querySelector("#start-chat");
const backButton = document.querySelector("#back-button");

const history = [];

function addMessage(role, content) {
  const article = document.createElement("article");
  article.className = `message ${role === "user" ? "user" : "bot"}`;

  const bubble = document.createElement("p");
  bubble.textContent = content;

  article.append(bubble);
  messagesEl.append(article);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function setWaiting(waiting) {
  form.querySelector("button").disabled = waiting;
  input.disabled = waiting;
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
  if (!content) return;

  input.value = "";
  input.style.height = "auto";
  history.push({ role: "user", content });
  addMessage("user", content);
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
  } catch (error) {
    thinkingBubble.textContent = `${error.message} Add your API key on the server and try again.`;
  } finally {
    setWaiting(false);
    input.focus();
  }
});
