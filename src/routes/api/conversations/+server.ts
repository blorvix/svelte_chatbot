import { json } from "@sveltejs/kit";
import { getAllConversations } from "$lib/server/db";

export async function GET() {
  const conversations = getAllConversations();
  return json(conversations);
}
