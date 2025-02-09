import { getAllConversations } from "$lib/server/db";
import type { PageData, PageServerLoad } from "./$types";

export const load: PageServerLoad = async () => {
  const conversations = getAllConversations();
  
  return {
    conversations
  };
};