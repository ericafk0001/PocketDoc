const chatContainer = document.getElementById("chatContainer");
const chatMessages = document.getElementById("chatMessages");
const chatForm = document.getElementById("chatForm");
const chatInput = document.getElementById("chatInput");
const sendBtn = document.getElementById("sendBtn");
const chatError = document.getElementById("chatError");
const chatIntroCard = document.getElementById("chatIntroCard");
const suggestedPrompts = document.getElementById("suggestedPrompts");

const STORAGE_KEY = "pocketdoc_conversations";
let activeConversation = null;

function uid() {
  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function getQueryParam(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

function loadConversations() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveConversations(conversations) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations));
}

function persistActiveConversation() {
  if (!activeConversation) return;
  const all = loadConversations();
  const idx = all.findIndex((c) => c.id === activeConversation.id);
  if (idx >= 0) {
    all[idx] = activeConversation;
  } else {
    all.push(activeConversation);
  }
  saveConversations(all);
}

function setError(message) {
  if (!message) {
    chatError.classList.add("hidden");
    chatError.textContent = "";
    return;
  }
  chatError.textContent = message;
  chatError.classList.remove("hidden");
}

function autoGrowTextarea() {
  chatInput.style.height = "auto";
  chatInput.style.height = `${Math.min(chatInput.scrollHeight, 128)}px`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function repairMojibake(value) {
  if (!value || !/[Ãâð]/.test(value)) return value;
  const chars = Array.from(value);
  if (chars.some((ch) => ch.charCodeAt(0) > 255)) return value;

  try {
    const bytes = Uint8Array.from(chars.map((ch) => ch.charCodeAt(0)));
    const fixed = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    return fixed.includes("�") ? value : fixed;
  } catch {
    return value;
  }
}

function formatAssistantContent(content) {
  const repaired = repairMojibake(content || "");
  const safeMarkdown = escapeHtml(repaired);

  if (window.marked) {
    return window.marked.parse(safeMarkdown, {
      gfm: true,
      breaks: true,
      headerIds: false,
      mangle: false,
    });
  }

  return safeMarkdown.replaceAll("\n", "<br>");
}

function renderMessage(message) {
  const isUser = message.role === "user";
  const wrapper = document.createElement("div");
  wrapper.className = `flex ${isUser ? "justify-end" : "justify-start"}`;
  const contentHtml = isUser
    ? escapeHtml(message.content).replaceAll("\n", "<br>")
    : formatAssistantContent(message.content);

  wrapper.innerHTML = `
    <div class="max-w-[84%] rounded-[18px] px-4 py-3 text-sm leading-6 ${
      isUser
        ? "bg-[#2f7af6] text-white rounded-br-md"
        : "bg-white border border-[#e3e7ee] text-[#2a3343] rounded-bl-md assistant-content"
    }">
      ${contentHtml}
    </div>
  `;

  chatMessages.appendChild(wrapper);
}

function renderConversation() {
  chatMessages.innerHTML = "";
  const hasMessages = activeConversation.messages.length > 0;
  if (chatIntroCard) {
    chatIntroCard.style.display = hasMessages ? "none" : "block";
  }
  if (suggestedPrompts) {
    suggestedPrompts.style.display = hasMessages ? "none" : "block";
  }

  activeConversation.messages.forEach(renderMessage);
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function parseSsePayload(line) {
  if (!line.startsWith("data: ")) return null;
  const raw = line.slice(6).trim();
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function chooseTitleFromMessages(messages) {
  const firstUser = messages.find((m) => m.role === "user");
  if (!firstUser) return "New chat";
  return firstUser.content.slice(0, 55);
}

async function sendMessage(userText) {
  setError("");

  const userMsg = {
    role: "user",
    content: userText,
    timestamp: Date.now(),
  };
  activeConversation.messages.push(userMsg);
  activeConversation.updatedAt = Date.now();
  activeConversation.title = chooseTitleFromMessages(activeConversation.messages);
  persistActiveConversation();
  renderConversation();

  sendBtn.disabled = true;
  sendBtn.textContent = "...";

  try {
    const response = await fetch("/api/ai/chat/stream", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: activeConversation.messages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "Failed to get AI response");
    }

    if (!response.body) {
      throw new Error("Streaming is not supported by this browser.");
    }

    const assistantMsg = {
      role: "assistant",
      content: "",
      timestamp: Date.now(),
    };

    activeConversation.messages.push(assistantMsg);
    activeConversation.updatedAt = Date.now();
    persistActiveConversation();
    renderConversation();

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split("\n\n");
      buffer = chunks.pop() || "";

      for (const chunk of chunks) {
        const lines = chunk.split("\n");
        for (const line of lines) {
          const payload = parseSsePayload(line);
          if (!payload) continue;
          if (payload.error) {
            throw new Error(payload.error);
          }
          if (payload.delta) {
            assistantMsg.content += payload.delta;
            activeConversation.updatedAt = Date.now();
            persistActiveConversation();
            renderConversation();
          }
          if (payload.done) {
            break;
          }
        }
      }
    }

    if (!assistantMsg.content.trim()) {
      assistantMsg.content = "I could not generate a response.";
      persistActiveConversation();
      renderConversation();
    }
  } catch (error) {
    setError(error.message || "Could not reach the AI service.");
  } finally {
    sendBtn.disabled = false;
    sendBtn.textContent = "Send";
  }
}

function ensureConversation() {
  const chatId = getQueryParam("chat");
  const all = loadConversations();

  if (chatId) {
    const found = all.find((c) => c.id === chatId);
    if (found) {
      activeConversation = found;
      return;
    }
  }

  activeConversation = {
    id: uid(),
    title: "New chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messages: [],
  };
  persistActiveConversation();
}

chatForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = chatInput.value.trim();
  if (!text) return;

  chatInput.value = "";
  autoGrowTextarea();
  await sendMessage(text);
});

chatInput.addEventListener("input", autoGrowTextarea);
chatInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    chatForm.requestSubmit();
  }
});

document.querySelectorAll(".prompt-chip").forEach((button) => {
  button.addEventListener("click", async () => {
    await sendMessage(button.textContent.trim());
  });
});

ensureConversation();
renderConversation();

const initialMessage = (getQueryParam("message") || "").trim();
if (initialMessage) {
  const alreadyAsked = activeConversation.messages.some(
    (m) => m.role === "user" && m.content === initialMessage,
  );
  if (!alreadyAsked) {
    sendMessage(initialMessage);
  }
}
