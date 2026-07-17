const db = require('../config/database');

class MapMarketGroup {
  static async getAll(tenantId) {
    const result = await db.query(`
      SELECT g.*,
             u.first_name || ' ' || u.last_name AS created_by_name,
             COALESCE(
               json_agg(m.market_value ORDER BY m.market_value) FILTER (WHERE m.market_value IS NOT NULL),
               '[]'
             ) AS markets
      FROM map_market_groups g
      LEFT JOIN users u ON u.id = g.created_by
      LEFT JOIN map_market_group_markets m ON m.group_id = g.id
      WHERE g.tenant_id = $1
      GROUP BY g.id, u.first_name, u.last_name
      ORDER BY g.sort_order, g.name
    `, [tenantId]);
    return result.rows;
  }

  static async getByIdAndTenant(id, tenantId) {
    const result = await db.query(`
      SELECT g.*,
             u.first_name || ' ' || u.last_name AS created_by_name,
             COALESCE(
               json_agg(m.market_value ORDER BY m.market_value) FILTER (WHERE m.market_value IS NOT NULL),
               '[]'
             ) AS markets
      FROM map_market_groups g
      LEFT JOIN users u ON u.id = g.created_by
      LEFT JOIN map_market_group_markets m ON m.group_id = g.id
      WHERE g.id = $1 AND g.tenant_id = $2
      GROUP BY g.id, u.first_name, u.last_name
    `, [id, tenantId]);
    return result.rows[0];
  }

  static async create(data, userId, tenantId) {
    const { name, pin_color, markets = [], sort_order = 0 } = data;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      const groupResult = await client.query(`
        INSERT INTO map_market_groups (name, pin_color, sort_order, created_by, tenant_id)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *
      `, [name, pin_color || '#3b82f6', sort_order, userId, tenantId]);
      const group = groupResult.rows[0];
      if (markets.length > 0) {
        await this._replaceMarkets(client, group.id, markets);
      }
      await client.query('COMMIT');
      return this.getByIdAndTenant(group.id, tenantId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async update(id, data, tenantId) {
    const { name, pin_color, markets, sort_order } = data;
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        UPDATE map_market_groups
        SET name = $1, pin_color = $2, sort_order = $3, updated_at = NOW()
        WHERE id = $4 AND tenant_id = $5
      `, [name, pin_color, sort_order ?? 0, id, tenantId]);
      if (markets !== undefined) {
        await this._replaceMarkets(client, id, markets);
      }
      await client.query('COMMIT');
      return this.getByIdAndTenant(id, tenantId);
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  static async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM map_market_groups WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    return result.rows.length > 0;
  }

  static async _replaceMarkets(client, groupId, markets) {
    await client.query('DELETE FROM map_market_group_markets WHERE group_id = $1', [groupId]);
    if (markets.length > 0) {
      const values = markets.map((m, i) => `($1, $${i + 2})`).join(', ');
      await client.query(
        `INSERT INTO map_market_group_markets (group_id, market_value) VALUES ${values}`,
        [groupId, ...markets]
      );
    }
  }
}

module.exports = MapMarketGroup;
