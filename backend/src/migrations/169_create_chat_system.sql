-- Chat system: direct messages, group conversations, and user presence

CREATE TABLE IF NOT EXISTS dm_conversations (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  name VARCHAR(255),          -- NULL for 1-on-1, set for group chats
  is_group BOOLEAN NOT NULL DEFAULT FALSE,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dm_participants (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  last_read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(conversation_id, user_id)
);

CREATE TABLE IF NOT EXISTS dm_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER NOT NULL REFERENCES dm_conversations(id) ON DELETE CASCADE,
  sender_id INTEGER NOT NULL REFERENCES users(id),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_presence (
  user_id INTEGER PRIMARY KEY REFERENCES users(id),
  tenant_id INTEGER NOT NULL REFERENCES tenants(id),
  status VARCHAR(20) NOT NULL DEFAULT 'offline'
    CHECK (status IN ('online', 'away', 'offline')),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_dm_conversations_tenant ON dm_conversations(tenant_id);
CREATE INDEX idx_dm_participants_user ON dm_participants(user_id);
CREATE INDEX idx_dm_participants_conversation ON dm_participants(conversation_id);
CREATE INDEX idx_dm_messages_conversation ON dm_messages(conversation_id, created_at DESC);
CREATE INDEX idx_dm_messages_sender ON dm_messages(sender_id);
CREATE INDEX idx_user_presence_tenant_status ON user_presence(tenant_id, status);
