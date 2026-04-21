const db = require('../config/database');

const DirectMessage = {
  // Find existing 1-on-1 conversation between two users, or create one
  async findOrCreateConversation(tenantId, userId1, userId2) {
    const existing = await db.query(`
      SELECT dp1.conversation_id
      FROM dm_participants dp1
      JOIN dm_participants dp2 ON dp1.conversation_id = dp2.conversation_id
      JOIN dm_conversations dc ON dc.id = dp1.conversation_id
      WHERE dp1.user_id = $1 AND dp2.user_id = $2 AND dc.tenant_id = $3 AND dc.is_group = FALSE
    `, [userId1, userId2, tenantId]);

    if (existing.rows.length > 0) {
      return existing.rows[0].conversation_id;
    }

    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const conv = await client.query(
        'INSERT INTO dm_conversations (tenant_id, is_group) VALUES ($1, FALSE) RETURNING id',
        [tenantId]
      );
      const convId = conv.rows[0].id;
      await client.query(
        'INSERT INTO dm_participants (conversation_id, user_id) VALUES ($1, $2), ($1, $3)',
        [convId, userId1, userId2]
      );
      await client.query('COMMIT');
      return convId;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  // Create a group conversation
  async createGroupConversation(tenantId, createdBy, name, memberIds) {
    const client = await db.getClient();
    try {
      await client.query('BEGIN');
      const conv = await client.query(
        `INSERT INTO dm_conversations (tenant_id, name, is_group, created_by)
         VALUES ($1, $2, TRUE, $3) RETURNING *`,
        [tenantId, name, createdBy]
      );
      const convId = conv.rows[0].id;

      // Ensure creator is included
      const allMembers = [...new Set([createdBy, ...memberIds])];
      const values = allMembers.map((uid, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO dm_participants (conversation_id, user_id) VALUES ${values}`,
        [convId, ...allMembers]
      );

      await client.query('COMMIT');
      return conv.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  },

  async createMessage(conversationId, senderId, body) {
    const result = await db.query(`
      INSERT INTO dm_messages (conversation_id, sender_id, body)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [conversationId, senderId, body]);

    await db.query(
      'UPDATE dm_conversations SET updated_at = NOW() WHERE id = $1',
      [conversationId]
    );

    return result.rows[0];
  },

  async getParticipants(conversationId) {
    const result = await db.query(`
      SELECT dp.*, u.first_name, u.last_name
      FROM dm_participants dp
      JOIN users u ON u.id = dp.user_id
      WHERE dp.conversation_id = $1
    `, [conversationId]);
    return result.rows;
  },

  // Get conversations for a user with last message and unread count
  async getConversationsForUser(userId, tenantId) {
    const result = await db.query(`
      SELECT
        dc.id,
        dc.name as group_name,
        dc.is_group,
        dc.updated_at,
        dc.created_by,
        last_msg.body as last_message_body,
        last_msg.created_at as last_message_at,
        last_msg.sender_id as last_message_sender_id,
        last_msg.sender_name as last_message_sender_name,
        (SELECT COUNT(*) FROM dm_messages m
         WHERE m.conversation_id = dc.id
           AND m.created_at > COALESCE(my_part.last_read_at, '1970-01-01'::timestamptz)
           AND m.sender_id != $1
        ) as unread_count
      FROM dm_conversations dc
      JOIN dm_participants my_part ON my_part.conversation_id = dc.id AND my_part.user_id = $1
      LEFT JOIN LATERAL (
        SELECT m.body, m.created_at, m.sender_id,
               u.first_name || ' ' || u.last_name as sender_name
        FROM dm_messages m
        JOIN users u ON u.id = m.sender_id
        WHERE m.conversation_id = dc.id
        ORDER BY m.created_at DESC LIMIT 1
      ) last_msg ON true
      WHERE dc.tenant_id = $2
      ORDER BY COALESCE(last_msg.created_at, dc.created_at) DESC
    `, [userId, tenantId]);

    // For each conversation, get participant info
    const conversations = result.rows;
    for (const conv of conversations) {
      const participants = await db.query(`
        SELECT u.id, u.first_name, u.last_name
        FROM dm_participants dp
        JOIN users u ON u.id = dp.user_id
        WHERE dp.conversation_id = $1
      `, [conv.id]);
      conv.participants = participants.rows;
    }

    return conversations;
  },

  // Get messages for a conversation with pagination
  async getMessages(conversationId, { limit = 50, before = null } = {}) {
    let query = `
      SELECT m.*, u.first_name as sender_first_name, u.last_name as sender_last_name
      FROM dm_messages m
      JOIN users u ON u.id = m.sender_id
      WHERE m.conversation_id = $1
    `;
    const params = [conversationId];

    if (before) {
      params.push(before);
      query += ` AND m.created_at < $${params.length}`;
    }

    query += ' ORDER BY m.created_at DESC';
    params.push(limit);
    query += ` LIMIT $${params.length}`;

    const result = await db.query(query, params);
    return result.rows.reverse(); // Return chronological
  },

  async markRead(conversationId, userId) {
    await db.query(`
      UPDATE dm_participants SET last_read_at = NOW()
      WHERE conversation_id = $1 AND user_id = $2
    `, [conversationId, userId]);
  },

  async getTotalUnreadCount(userId, tenantId) {
    const result = await db.query(`
      SELECT COALESCE(SUM(unread), 0) as total_unread FROM (
        SELECT (
          SELECT COUNT(*) FROM dm_messages m
          WHERE m.conversation_id = dc.id
            AND m.created_at > COALESCE(dp.last_read_at, '1970-01-01'::timestamptz)
            AND m.sender_id != $1
        ) as unread
        FROM dm_conversations dc
        JOIN dm_participants dp ON dp.conversation_id = dc.id AND dp.user_id = $1
        WHERE dc.tenant_id = $2
      ) sub
    `, [userId, tenantId]);
    return parseInt(result.rows[0].total_unread, 10);
  },

  // Check if user is a participant of a conversation
  async isParticipant(conversationId, userId) {
    const result = await db.query(
      'SELECT 1 FROM dm_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );
    return result.rows.length > 0;
  },

  // Add members to a group conversation
  async addMembers(conversationId, userIds) {
    const values = userIds.map((uid, i) => `($1, $${i + 2})`).join(', ');
    await db.query(
      `INSERT INTO dm_participants (conversation_id, user_id) VALUES ${values}
       ON CONFLICT (conversation_id, user_id) DO NOTHING`,
      [conversationId, ...userIds]
    );
  },

  // Remove a member from a group conversation
  async removeMember(conversationId, userId) {
    await db.query(
      'DELETE FROM dm_participants WHERE conversation_id = $1 AND user_id = $2',
      [conversationId, userId]
    );
  },

  // Update group name
  async updateGroupName(conversationId, name) {
    const result = await db.query(
      'UPDATE dm_conversations SET name = $1, updated_at = NOW() WHERE id = $2 RETURNING *',
      [name, conversationId]
    );
    return result.rows[0];
  },
};

module.exports = DirectMessage;
