import { json } from "@sveltejs/kit";
import { updateVote } from "$lib/server/db";

export async function POST({ params, request }) {
  const messageId = parseInt(params.id);
  const { voteType } = await request.json();

  if (isNaN(messageId)) {
    return json({ error: "Invalid message ID" }, { status: 400 });
  }

  if (!['upvote', 'downvote'].includes(voteType)) {
    return json({ error: "Invalid vote type" }, { status: 400 });
  }

  try {
    updateVote(messageId, voteType);
    return json({ success: true });
  } catch (error) {
    console.error("Error updating vote:", error);
    return json({ error: "Failed to update vote" }, { status: 500 });
  }
} 