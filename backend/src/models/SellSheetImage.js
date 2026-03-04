const db = require('../config/database');
const { deleteFile } = require('../utils/fileStorage');

const SellSheetImage = {
  async create(data) {
    const {
      sell_sheet_id, file_name, file_path, file_size, file_type,
      caption, display_order, is_hero_image, uploaded_by
    } = data;

    if (is_hero_image) {
      await db.query(
        'UPDATE sell_sheet_images SET is_hero_image = false WHERE sell_sheet_id = $1',
        [sell_sheet_id]
      );
    }

    const result = await db.query(
      `INSERT INTO sell_sheet_images (
        sell_sheet_id, file_name, file_path, file_size, file_type,
        caption, display_order, is_hero_image, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        sell_sheet_id, file_name, file_path, file_size, file_type,
        caption, display_order, is_hero_image || false, uploaded_by
      ]
    );
    return result.rows[0];
  },

  async findBySellSheet(sellSheetId) {
    const result = await db.query(
      'SELECT * FROM sell_sheet_images WHERE sell_sheet_id = $1 ORDER BY display_order ASC',
      [sellSheetId]
    );
    return result.rows;
  },

  async findById(id) {
    const result = await db.query(
      'SELECT * FROM sell_sheet_images WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  async update(id, data) {
    const { caption, display_order, is_hero_image } = data;

    if (is_hero_image) {
      const image = await this.findById(id);
      if (image) {
        await db.query(
          'UPDATE sell_sheet_images SET is_hero_image = false WHERE sell_sheet_id = $1',
          [image.sell_sheet_id]
        );
      }
    }

    const result = await db.query(
      `UPDATE sell_sheet_images SET
        caption = COALESCE($1, caption),
        display_order = COALESCE($2, display_order),
        is_hero_image = COALESCE($3, is_hero_image)
       WHERE id = $4
       RETURNING *`,
      [caption, display_order, is_hero_image, id]
    );
    return result.rows[0];
  },

  async delete(id) {
    const image = await this.findById(id);
    if (!image) return null;

    const result = await db.query(
      'DELETE FROM sell_sheet_images WHERE id = $1 RETURNING *',
      [id]
    );

    if (image.file_path) {
      try {
        await deleteFile(image.file_path);
      } catch (error) {
        console.error('Error deleting file:', error);
      }
    }

    return result.rows[0];
  }
};

module.exports = SellSheetImage;
