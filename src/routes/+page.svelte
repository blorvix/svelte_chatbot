<script lang="ts">
  import { onMount } from "svelte";
  import { SSE } from "sse.js";
  import Trash2 from "lucide-svelte/icons/trash-2";

  type Message = { role: "user" | "assistant"; content: string };

  let messages: Message[] = $state([]);
  let userInput = $state("");
  let chatContainer: HTMLElement | undefined = $state();
  let conversationId: number | null = $state(null);
  let conversations: {
    id: number;
    created_at: string;
    last_message: string;
  }[] = $state([]);

  async function loadConversations() {
    const response = await fetch("/api/conversations");
    conversations = await response.json();
  }

  async function loadConversation(id: number) {
    const response = await fetch(`/api/chat?conversationId=${id}`);
    messages = await response.json();
    conversationId = id;
    scrollToBottom();
  }

  function scrollToBottom() {
    setTimeout(() => {
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 0);
  }

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();

    if (!userInput.trim()) return;

    const userMessage: Message = { role: "user", content: userInput };
    messages = [...messages, userMessage];
    userInput = "";
    scrollToBottom();

    const eventSource = new SSE("/api/chat", {
      headers: { "Content-Type": "application/json" },
      payload: JSON.stringify({ messages, conversationId }),
    });

    let assistantMessage: Message = { role: "assistant", content: "" };
    messages = [...messages, assistantMessage];

    eventSource.addEventListener("message", (e: MessageEvent<string>) => {
      try {
        if (e.data === "[DONE]") {
          eventSource.close();
          return;
        }
        const parseToJSON = JSON.parse(e.data);
        const messageChunk = parseToJSON.choices[0].delta.content;
        if (typeof messageChunk === "string") {
          assistantMessage.content += messageChunk;
          messages = [...messages.slice(0, -1), assistantMessage];
        }
        scrollToBottom();
      } catch (err) {
        console.error(err);
      }
    });

    eventSource.addEventListener("error", (e: Event) => {
      console.error("Error:", e);
      eventSource.close();
    });

    eventSource.stream();

    // Update conversationId if it's a new conversation
    if (!conversationId) {
      conversationId = parseInt(eventSource.headers["X-Conversation-Id"]);
    }

    // Refresh conversations list
    await loadConversations();
  }

  async function deleteConversation(id: number) {
    if (confirm("Are you sure you want to delete this conversation?")) {
      const response = await fetch(`/api/conversations/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        conversations = conversations.filter((conv) => conv.id !== id);
        if (conversationId === id) {
          messages = [];
          conversationId = null;
        }
      } else {
        alert("Failed to delete conversation");
      }
    }
  }

  onMount(async () => {
    await loadConversations();
  });
</script>

<div class="flex h-[75vh] bg-gray-100 dark:bg-gray-900">
  <!-- Sidebar -->
  <div class="w-64 overflow-y-auto bg-white shadow-lg dark:bg-gray-800">
    <div class="p-4">
      <h2 class="mb-4 text-lg font-semibold dark:text-white">Conversations</h2>
      <button
        class="w-full rounded bg-blue-500 px-4 py-2 text-white hover:bg-blue-600"
        onclick={() => {
          messages = [];
          conversationId = null;
        }}
      >
        New Chat
      </button>
    </div>
    <ul>
      {#each conversations as conversation}
        <li class="relative">
          <button
            class="w-full p-4 text-left hover:bg-gray-100 focus:bg-gray-200 focus:outline-none dark:text-white dark:hover:bg-gray-700 dark:focus:bg-gray-600"
            onclick={() => loadConversation(conversation.id)}
          >
            <p class="truncate pr-8 font-medium">
              {conversation.last_message || "New Conversation"}
            </p>
            <p class="text-sm text-gray-500 dark:text-gray-400">
              {new Date(conversation.created_at).toLocaleString()}
            </p>
          </button>
          <button
            class="absolute right-2 top-1/2 -translate-y-1/2 transform p-2 text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400"
            onclick={() => deleteConversation(conversation.id)}
            title="Delete conversation"
          >
            <Trash2 size={16} />
          </button>
        </li>
      {/each}
    </ul>
  </div>

  <!-- Chat Area -->
  <div class="flex flex-1 flex-col">
    <div
      class="flex flex-1 flex-col overflow-hidden rounded-lg bg-white shadow-lg dark:bg-gray-800"
    >
      <div class="bg-gray-800 p-4 text-white dark:bg-gray-900">
        <h1 class="text-2xl font-bold">AI Chat App</h1>
      </div>
      <div
        class="flex-1 space-y-4 overflow-y-auto p-4"
        bind:this={chatContainer}
      >
        {#each messages as message}
          <div
            class="flex {message.role === 'user'
              ? 'justify-end'
              : 'justify-start'}"
          >
            <div
              class="max-w-xs rounded-lg px-4 py-2 lg:max-w-md {message.role ===
              'user'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}"
            >
              <p>{message.content}</p>
            </div>
          </div>
        {/each}
      </div>
      <form
        onsubmit={handleSubmit}
        class="flex bg-gray-100 p-4 dark:bg-gray-700"
      >
        <input
          type="text"
          bind:value={userInput}
          placeholder="Type your message..."
          class="flex-grow rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white dark:placeholder-gray-400"
        />
        <button
          type="submit"
          class="rounded-r-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          Send
        </button>
      </form>
    </div>
  </div>
</div>
