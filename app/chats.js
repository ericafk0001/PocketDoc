const chatList = document.getElementById("chatList");
const STORAGE_KEY = "pocketdoc_conversations";

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

function formatRelativeTime(timestamp) {
  if (!timestamp) return "Just now";
  const minutes = Math.floor((Date.now() - timestamp) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function renderChats() {
  const conversations = loadConversations().sort(
    (a, b) => (b.updatedAt || 0) - (a.updatedAt || 0),
  );

  if (conversations.length === 0) {
    chatList.innerHTML = `
      <div class="rounded-[20px] border border-[#e3e7ee] bg-white p-4">
        <div class="text-[#1f3f78] font-semibold mb-1">No chat history yet</div>
        <p class="text-sm text-[#6f7683]">Start your first conversation and it will show up here.</p>
      </div>
    `;
    return;
  }

  chatList.innerHTML = conversations
    .map((conv) => {
      const firstUser = (conv.messages || []).find((m) => m.role === "user");
      const preview = (firstUser?.content || conv.title || "Conversation").slice(
        0,
        90,
      );
      const turns = (conv.messages || []).filter((m) => m.role === "user").length;

      return `
        <article class="rounded-[20px] border border-[#e3e7ee] bg-white p-4 mb-3">
          <a href="ai.html?chat=${encodeURIComponent(conv.id)}" class="block">
            <div class="flex items-center justify-between gap-2 mb-2">
              <h3 class="font-semibold text-[#1f3f78] text-[16px] leading-tight">${preview}</h3>
              <span class="text-xs text-[#7b8391] whitespace-nowrap">${formatRelativeTime(conv.updatedAt)}</span>
            </div>
            <div class="text-sm text-[#6f7683]">${turns} question${
              turns === 1 ? "" : "s"
            }</div>
          </a>
          <button
            data-delete-id="${conv.id}"
            class="mt-3 text-xs font-semibold text-[#c43b3b] hover:underline"
          >
            Delete chat
          </button>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-delete-id]").forEach((btn) => {
    btn.addEventListener("click", (event) => {
      const id = event.currentTarget.getAttribute("data-delete-id");
      const filtered = loadConversations().filter((conv) => conv.id !== id);
      saveConversations(filtered);
      renderChats();
    });
  });
}

renderChats();
