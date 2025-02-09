<script lang="ts">
  import { onMount } from "svelte";
  import { SSE } from "sse.js";
  import { marked } from 'marked';
  import Trash2 from "lucide-svelte/icons/trash-2";
  import Loader2 from "lucide-svelte/icons/loader-2";
  import ThumbsUp from "lucide-svelte/icons/thumbs-up";
  import ThumbsDown from "lucide-svelte/icons/thumbs-down";
  import type { PageData } from "./$types.js";

  interface Conversation {
    id: number;
    created_at: string;
    last_message: string;
  }

  type Message = {
    id?: number;
    role: "user" | "assistant";
    content: string;
    upvotes?: number;
    downvotes?: number;
    [key: string]: string | number | undefined;
  };

  let messages: Message[] = $state([]);
  let userInput = $state("");
  let chatContainer: HTMLElement | undefined = $state();
  let conversationId: number | null = $state(null);
  let isLoading = $state(false);
  let isLoadingConversation = $state(false);

  let { data } = $props<{ data: PageData }>();
  let conversations = $state(data.conversations as Conversation[]);

  // Add a function to safely parse markdown
  function parseMarkdown(content: string) {
    try {
      return marked(content);
    } catch (error) {
      console.error('Error parsing markdown:', error);
      return content;
    }
  }

  async function loadConversation(id: number) {
    isLoadingConversation = true;
    try {
      const response = await fetch(`/api/chat?conversationId=${id}`);
      messages = await response.json();
      conversationId = id;
      scrollToBottom();
    } finally {
      isLoadingConversation = false;
    }
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

    if (!userInput.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: userInput };
    console.log('Current messages before add user:', $state.snapshot(messages))
    messages = [...messages, userMessage];
    console.log('Current messages after add user:', $state.snapshot(messages))
    userInput = "";
    scrollToBottom();
    
    isLoading = true;

    try {
      const eventSource = new SSE("/api/chat", {
        headers: { "Content-Type": "application/json" },
        payload: JSON.stringify({ messages, conversationId }),
      });

      let assistantMessage: Message = { role: "assistant", content: "" };
      messages = [...messages, assistantMessage];
      console.log('Current messages after add asssistantce:', $state.snapshot(messages))

      eventSource.addEventListener("message", (e: MessageEvent<string>) => {
        try {
          if (e.data === "[DONE]") {
            // eventSource.close();
            return;
          }

          const parseToJSON = JSON.parse(e.data);
          
          // Handle message ID event
          if (parseToJSON.messageId) {
            assistantMessage.id = parseToJSON.messageId;
            messages = [...messages.slice(0, -1), assistantMessage];
            eventSource.close();
            return;
          }

          // Handle regular message chunks
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
        isLoading = false;
      });

      eventSource.stream();

      // Update conversationId if it's a new conversation
      if (!conversationId) {
        conversationId = parseInt(eventSource.headers["X-Conversation-Id"]);
      }

      // Refresh conversations list
      // await loadConversation(conversationId);
    } finally {
      isLoading = false;
    }
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

  async function handleVote(messageId: number, voteType: 'upvote' | 'downvote') {
    try {
      const response = await fetch(`/api/messages/${messageId}/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ voteType }),
      });

      if (response.ok) {
        // Update the message's vote count in the UI
        messages = messages.map(msg => {
          if (msg.id === messageId) {
            return {
              ...msg,
              [voteType + 's']: (msg[voteType + 's'] || 0) + 1,
            };
          }
          return msg;
        });
      }
    } catch (error) {
      console.error('Error voting:', error);
    }
  }

  onMount(async () => {
    // await loadConversations();
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
      {#each conversations as conversation (conversation.id)}
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
        {#if isLoadingConversation}
          <div class="flex items-center justify-center py-10">
            <Loader2 class="animate-spin" size={24} />
            <span class="ml-2">Loading conversation...</span>
          </div>
        {:else}
          {console.log('Current messages:', $state.snapshot(messages))}
          {#each messages as message}
            <div
              class="flex {message.role === 'user'
                ? 'justify-end'
                : 'justify-start'}"
            >
              <div
                class="flex flex-col"
              >
                <div
                  class="max-w-xs rounded-lg px-4 py-2 lg:max-w-md {message.role ===
                  'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-200 text-gray-800 dark:bg-gray-700 dark:text-gray-200'}"
                >
                  {#if message.role === 'assistant' && message.content.trim().length === 0}
                    <div class="flex items-center space-x-2">
                      <Loader2 class="animate-spin" size={16} />
                      <span>Thinking...</span>
                    </div>
                  {:else}
                    <div class="prose prose-sm dark:prose-invert max-w-none">
                      {@html parseMarkdown(message.content)}
                    </div>
                  {/if}
                </div>
                
                {#if message.role === 'assistant' && message.content.trim().length > 0 && message.id}
                  <div class="mt-2 flex items-center space-x-4">
                    <button
                      class="flex items-center space-x-1 text-gray-500 hover:text-green-500 dark:text-gray-400"
                      onclick={() => handleVote(message.id!, 'upvote')}
                    >
                      <ThumbsUp size={16} />
                      <span>{message.upvotes || 0}</span>
                    </button>
                    <button
                      class="flex items-center space-x-1 text-gray-500 hover:text-red-500 dark:text-gray-400"
                      onclick={() => handleVote(message.id!, 'downvote')}
                    >
                      <ThumbsDown size={16} />
                      <span>{message.downvotes || 0}</span>
                    </button>
                  </div>
                {/if}
              </div>
            </div>
          {/each}
        {/if}
      </div>
      <form
        onsubmit={handleSubmit}
        class="flex bg-gray-100 p-4 dark:bg-gray-700"
      >
        <textarea
          bind:value={userInput}
          placeholder="Type your message..."
          rows="1"
          disabled={isLoading}
          class="flex-grow resize-none rounded-l-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-600 dark:text-white dark:placeholder-gray-400 disabled:opacity-50"
          oninput={(e) => {
            const textarea = e.target as HTMLTextAreaElement;
            textarea.style.height = 'auto';
            textarea.style.height = textarea.scrollHeight + 'px';
          }}
          onkeydown={(e: KeyboardEvent) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              const form = (e.target as HTMLElement).closest('form');
              if (form) form.requestSubmit();
            }
          }}
        ></textarea>
        <button
          type="submit"
          disabled={isLoading}
          class="rounded-r-lg bg-blue-500 px-4 py-2 text-white hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:hover:bg-blue-500"
        >
          {#if isLoading}
            <Loader2 class="animate-spin" size={16} />
          {:else}
            Send
          {/if}
        </button>
      </form>
    </div>
  </div>
</div>

<style>
  /* Add styles for markdown content */
  :global(.prose) {
    @apply text-inherit;
  }
  
  :global(.prose p) {
    @apply my-0;
  }
  
  :global(.prose pre) {
    @apply bg-gray-800 text-white p-2 rounded my-2 overflow-x-auto;
  }
  
  :global(.prose code) {
    @apply bg-gray-800 text-white px-1 py-0.5 rounded;
  }
  
  :global(.prose pre code) {
    @apply bg-transparent p-0;
  }
  
  :global(.prose ul) {
    @apply list-disc list-inside my-2;
  }
  
  :global(.prose ol) {
    @apply list-decimal list-inside my-2;
  }
  
  :global(.prose a) {
    @apply text-blue-400 hover:underline;
  }
  
  :global(.prose blockquote) {
    @apply border-l-4 border-gray-500 pl-4 my-2;
  }
</style>
