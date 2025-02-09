import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("database.db");

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER,
    role TEXT,
    content TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (conversation_id) REFERENCES conversations (id)
  );
`);

export function saveMessage(
  conversationId: number,
  role: string,
  content: string,
) {
  const stmt = db.prepare(
    "INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)",
  );
  stmt.run(conversationId, role, content);
}

export function getConversation(conversationId: number) {
  const stmt = db.prepare(
    "SELECT role, content FROM messages WHERE conversation_id = ? ORDER BY created_at",
  );
  return stmt.all(conversationId);
}

export function createConversation() {
  const stmt = db.prepare("INSERT INTO conversations DEFAULT VALUES");
  const result = stmt.run();
  return result.lastInsertRowid;
}

export function getAllConversations() {
  const stmt = db.prepare(`
    SELECT c.id, c.created_at, m.content as last_message
    FROM conversations c
    LEFT JOIN messages m ON m.conversation_id = c.id
    WHERE m.id = (
      SELECT id FROM messages
      WHERE conversation_id = c.id
      ORDER BY created_at DESC
      LIMIT 1
    )
    ORDER BY c.created_at DESC
  `);
  return stmt.all();
}

export function deleteConversation(conversationId: number) {
  const deleteMessages = db.prepare(
    "DELETE FROM messages WHERE conversation_id = ?",
  );
  const deleteConversation = db.prepare(
    "DELETE FROM conversations WHERE id = ?",
  );

  const session = db.createSession();

  deleteMessages.run(conversationId);
  deleteConversation.run(conversationId);

  session.changeset();
}
