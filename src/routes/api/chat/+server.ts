import { json } from "@sveltejs/kit";
import { CYGNET_API_KEY } from "$env/static/private";
import {
  createConversation,
  getConversation,
  saveMessage,
} from "$lib/server/db";

export async function GET({ url }) {
  const conversationId = url.searchParams.get("conversationId");
  if (!conversationId) {
    return json({ error: "Conversation ID is required" }, { status: 400 });
  }

  const messages = getConversation(parseInt(conversationId));
  return json(messages);
}

export async function POST({ request }) {
  const { messages, conversationId } = await request.json();

  let currentConversationId = conversationId;
  if (!currentConversationId) {
    currentConversationId = createConversation();
  }

  const userMessage = messages[messages.length - 1];
  saveMessage(currentConversationId, userMessage.role, userMessage.content);

  const response = await fetch("https://api.grayswan.ai/chat/completion", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + CYGNET_API_KEY,
    },
    body: JSON.stringify({
      model: "cygnet",
      messages: messages,
      stream: true,
    }),
  });

  if (!response.body) {
    return json(
      { error: "Failed to get response from assistant" },
      { status: 500 },
    );
  }

  let assistantResponse = "";
  const reader = response.body.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  return new Response(
    new ReadableStream({
      async start(controller) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const decodedChunk = decoder.decode(value);

          const lines = decodedChunk.split("\n");
          for (const line of lines) {
            try {
              if (line === "data: [DONE]") {
                break;
              }

              if (line.trim() === "") {
                continue;
              }

              const parseToJSON = JSON.parse(line.replace(/^data: /, ""));
              const messageChunk = parseToJSON.choices[0].delta.content;

              if (typeof messageChunk === "string") {
                assistantResponse += messageChunk;
              }
            } catch (error) {
              console.log("DECODED CHUNK", decodedChunk);
              console.log("LINE", line);
              console.error(error);
            }
          }

          controller.enqueue(encoder.encode(decodedChunk));
        }

        // Save assistant message to the database
        saveMessage(currentConversationId, "assistant", assistantResponse);

        controller.close();
      },
    }),
    {
      headers: {
        "Content-Type": "text/event-stream",
        "X-Conversation-Id": currentConversationId.toString(),
      },
    },
  );
}
