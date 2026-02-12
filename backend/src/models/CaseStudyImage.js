const db = require('../config/database');
const { deleteFile } = require('../utils/fileStorage');

const CaseStudyImage = {
  /**
   * Create a new case study image
   */
  async create(data) {
    const {
      case_study_id,
      file_name,
      file_path,
      file_size,
      file_type,
      caption,
      display_order,
      is_hero_image,
      is_before_photo,
      is_after_photo,
      uploaded_by
    } = data;

    // If this is being set as hero image, unset any existing hero images
    if (is_hero_image) {
      await db.query(
        'UPDATE case_study_images SET is_hero_image = false WHERE case_study_id = $1',
        [case_study_id]
      );
    }

    const result = await db.query(
      `INSERT INTO case_study_images (
        case_study_id, file_name, file_path, file_size, file_type,
        caption, display_order, is_hero_image, is_before_photo, is_after_photo,
        uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *`,
      [
        case_study_id, file_name, file_path, file_size, file_type,
        caption, display_order, is_hero_image || false, is_before_photo || false,
        is_after_photo || false, uploaded_by
      ]
    );
    return result.rows[0];
  },

  /**
   * Find all images for a case study
   */
  async findByCaseStudy(caseStudyId) {
    const result = await db.query(
      `SELECT * FROM case_study_images
       WHERE case_study_id = $1
       ORDER BY display_order ASC`,
      [caseStudyId]
    );
    return result.rows;
  },

  /**
   * Find image by ID
   */
  async findById(id) {
    const result = await db.query(
      'SELECT * FROM case_study_images WHERE id = $1',
      [id]
    );
    return result.rows[0];
  },

  /**
   * Update image metadata (caption, order, flags)
   */
  async update(id, data) {
    const {
      caption,
      display_order,
      is_hero_image,
      is_before_photo,
      is_after_photo
    } = data;

    // If setting as hero image, get case_study_id first to unset others
    if (is_hero_image) {
      const image = await this.findById(id);
      if (image) {
        await db.query(
          'UPDATE case_study_images SET is_hero_image = false WHERE case_study_id = $1',
          [image.case_study_id]
        );
      }
    }

    const result = await db.query(
      `UPDATE case_study_images SET
        caption = COALESCE($1, caption),
        display_order = COALESCE($2, display_order),
        is_hero_image = COALESCE($3, is_hero_image),
        is_before_photo = COALESCE($4, is_before_photo),
        is_after_photo = COALESCE($5, is_after_photo)
       WHERE id = $6
       RETURNING *`,
      [caption, display_order, is_hero_image, is_before_photo, is_after_photo, id]
    );
    return result.rows[0];
  },

  /**
   * Update display order for an image
   */
  async updateOrder(id, displayOrder) {
    const result = await db.query(
      'UPDATE case_study_images SET display_order = $1 WHERE id = $2 RETURNING *',
      [displayOrder, id]
    );
    return result.rows[0];
  },

  /**
   * Update caption
   */
  async updateCaption(id, caption) {
    const result = await db.query(
      'UPDATE case_study_images SET caption = $1 WHERE id = $2 RETURNING *',
      [caption, id]
    );
    return result.rows[0];
  },

  /**
   * Delete an image (includes file cleanup)
   */
  async delete(id) {
    // Get image details first for file cleanup
    const image = await this.findById(id);
    if (!image) {
      return null;
    }

    // Delete from database
    const result = await db.query(
      'DELETE FROM case_study_images WHERE id = $1 RETURNING *',
      [id]
    );

    // Delete file from storage
    if (image.file_path) {
      try {
        await deleteFile(image.file_path);
      } catch (error) {
        console.error('Error deleting file:', error);
        // Don't fail the delete operation if file deletion fails
      }
    }

    return result.rows[0];
  },

  /**
   * Reorder images for a case study
   */
  async reorder(caseStudyId, imageOrders) {
    // imageOrders is an array of {id, display_order} objects
    const promises = imageOrders.map(({ id, display_order }) =>
      this.updateOrder(id, display_order)
    );

    await Promise.all(promises);
    return this.findByCaseStudy(caseStudyId);
  }
};

module.exports = CaseStudyImage;
