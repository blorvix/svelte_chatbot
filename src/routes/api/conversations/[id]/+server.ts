import { json } from "@sveltejs/kit";
import { deleteConversation } from "$lib/server/db";

export async function DELETE({ params }) {
  const conversationId = parseInt(params.id);

  if (isNaN(conversationId)) {
    return json({ error: "Invalid conversation ID" }, { status: 400 });
  }

  try {
    deleteConversation(conversationId);
    return json({ success: true });
  } catch (error) {
    console.error("Error deleting conversation:", error);
    return json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}
