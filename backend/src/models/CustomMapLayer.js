const db = require('../config/database');

class CustomMapLayer {
  static async getAll(tenantId) {
    const result = await db.query(`
      SELECT cml.*,
             u.first_name || ' ' || u.last_name AS created_by_name,
             (SELECT COUNT(*) FROM custom_map_pins WHERE layer_id = cml.id) AS pin_count
      FROM custom_map_layers cml
      LEFT JOIN users u ON u.id = cml.created_by
      WHERE cml.tenant_id = $1
      ORDER BY cml.name
    `, [tenantId]);
    return result.rows;
  }

  static async getByIdAndTenant(id, tenantId) {
    const result = await db.query(`
      SELECT cml.*,
             u.first_name || ' ' || u.last_name AS created_by_name,
             (SELECT COUNT(*) FROM custom_map_pins WHERE layer_id = cml.id) AS pin_count
      FROM custom_map_layers cml
      LEFT JOIN users u ON u.id = cml.created_by
      WHERE cml.id = $1 AND cml.tenant_id = $2
    `, [id, tenantId]);
    return result.rows[0];
  }

  static async create(data, userId, tenantId) {
    const { name, pin_color } = data;
    const result = await db.query(`
      INSERT INTO custom_map_layers (name, pin_color, created_by, tenant_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [name, pin_color || '#ef4444', userId, tenantId]);
    return result.rows[0];
  }

  static async update(id, data, tenantId) {
    const { name, pin_color } = data;
    const result = await db.query(`
      UPDATE custom_map_layers
      SET name = $1, pin_color = $2, updated_at = NOW()
      WHERE id = $3 AND tenant_id = $4
      RETURNING *
    `, [name, pin_color, id, tenantId]);
    return result.rows[0];
  }

  static async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM custom_map_layers WHERE id = $1 AND tenant_id = $2 RETURNING id',
      [id, tenantId]
    );
    return result.rows.length > 0;
  }

  static async getPins(layerId, tenantId) {
    // Validate tenant ownership via JOIN
    const result = await db.query(`
      SELECT p.*
      FROM custom_map_pins p
      JOIN custom_map_layers l ON l.id = p.layer_id
      WHERE p.layer_id = $1 AND l.tenant_id = $2
      ORDER BY p.name
    `, [layerId, tenantId]);
    return result.rows;
  }

  static async replacePins(layerId, pins, tenantId) {
    const client = await db.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify tenant ownership
      const check = await client.query(
        'SELECT id FROM custom_map_layers WHERE id = $1 AND tenant_id = $2',
        [layerId, tenantId]
      );
      if (check.rows.length === 0) {
        throw new Error('Layer not found');
      }

      // Delete existing pins
      await client.query('DELETE FROM custom_map_pins WHERE layer_id = $1', [layerId]);

      // Insert new pins
      let inserted = 0;
      for (const pin of pins) {
        await client.query(`
          INSERT INTO custom_map_pins (layer_id, name, address, city, state, zip_code, latitude, longitude, category, notes, geocode_source)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `, [
          layerId,
          pin.name,
          pin.address || null,
          pin.city || null,
          pin.state || null,
          pin.zip_code || null,
          pin.latitude || null,
          pin.longitude || null,
          pin.category || null,
          pin.notes || null,
          pin.geocode_source || null,
        ]);
        inserted++;
      }

      await client.query('COMMIT');
      return inserted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = CustomMapLayer;
