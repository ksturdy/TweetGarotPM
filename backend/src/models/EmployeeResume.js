const db = require('../config/database');

const EmployeeResume = {
  /**
   * Create a new employee resume
   */
  async create(data, tenantId, userId) {
    const {
      employee_id,
      employee_name,
      job_title,
      years_experience,
      summary,
      certifications,
      skills,
      education,
      resume_file_name,
      resume_file_path,
      resume_file_size,
      resume_file_type,
      employee_photo_path,
      phone,
      email,
      address,
      languages,
      hobbies,
      references,
      is_active = true
    } = data;

    const result = await db.query(
      `INSERT INTO employee_resumes (
        tenant_id, employee_id, employee_name, job_title, years_experience,
        summary, certifications, skills, education,
        resume_file_name, resume_file_path, resume_file_size, resume_file_type,
        employee_photo_path, phone, email, address, languages, hobbies, references,
        is_active, version_number, last_updated_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
      RETURNING *`,
      [
        tenantId, employee_id, employee_name, job_title, years_experience,
        summary, JSON.stringify(certifications || []), skills || [],
        education, resume_file_name, resume_file_path, resume_file_size,
        resume_file_type, employee_photo_path, phone, email, address,
        JSON.stringify(languages || []), hobbies || [], JSON.stringify(references || []),
        is_active, 1, userId
      ]
    );
    return result.rows[0];
  },

  /**
   * Find all employee resumes by tenant with optional filters
   */
  async findAllByTenant(tenantId, filters = {}) {
    let query = `
      SELECT *
      FROM employee_resumes
      WHERE tenant_id = $1
    `;
    const params = [tenantId];

    if (filters.employee_id) {
      params.push(filters.employee_id);
      query += ` AND employee_id = $${params.length}`;
    }

    if (filters.is_active !== undefined) {
      params.push(filters.is_active);
      query += ` AND is_active = $${params.length}`;
    }

    if (filters.search) {
      params.push(`%${filters.search}%`);
      query += ` AND (employee_name ILIKE $${params.length} OR job_title ILIKE $${params.length})`;
    }

    query += ' ORDER BY employee_name ASC, version_number DESC';

    const result = await db.query(query, params);
    return result.rows;
  },

  /**
   * Find employee resume by ID and tenant
   */
  async findByIdAndTenant(id, tenantId) {
    const result = await db.query(
      'SELECT * FROM employee_resumes WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Get current resume for an employee
   */
  async getByEmployee(employeeId, tenantId) {
    const result = await db.query(
      `SELECT * FROM employee_resumes
       WHERE employee_id = $1 AND tenant_id = $2 AND is_active = true
       ORDER BY version_number DESC
       LIMIT 1`,
      [employeeId, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Update an employee resume (creates new version)
   */
  async update(id, data, tenantId, userId) {
    const existing = await this.findByIdAndTenant(id, tenantId);
    if (!existing) return null;

    const {
      employee_id,
      employee_name,
      job_title,
      years_experience,
      summary,
      certifications,
      skills,
      education,
      resume_file_name,
      resume_file_path,
      resume_file_size,
      resume_file_type,
      employee_photo_path,
      phone,
      email,
      address,
      languages,
      hobbies,
      references,
      is_active
    } = data;

    // Increment version number
    const newVersion = (existing.version_number || 1) + 1;

    const result = await db.query(
      `UPDATE employee_resumes SET
        employee_id = COALESCE($1, employee_id),
        employee_name = COALESCE($2, employee_name),
        job_title = COALESCE($3, job_title),
        years_experience = COALESCE($4, years_experience),
        summary = COALESCE($5, summary),
        certifications = COALESCE($6, certifications),
        skills = COALESCE($7, skills),
        education = COALESCE($8, education),
        resume_file_name = COALESCE($9, resume_file_name),
        resume_file_path = COALESCE($10, resume_file_path),
        resume_file_size = COALESCE($11, resume_file_size),
        resume_file_type = COALESCE($12, resume_file_type),
        employee_photo_path = COALESCE($13, employee_photo_path),
        phone = COALESCE($14, phone),
        email = COALESCE($15, email),
        address = COALESCE($16, address),
        languages = COALESCE($17, languages),
        hobbies = COALESCE($18, hobbies),
        "references" = COALESCE($19, "references"),
        is_active = COALESCE($20, is_active),
        version_number = $21,
        last_updated_by = $22,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = $23 AND tenant_id = $24
       RETURNING *`,
      [
        employee_id, employee_name, job_title, years_experience,
        summary, certifications ? JSON.stringify(certifications) : null,
        skills || null, education, resume_file_name, resume_file_path,
        resume_file_size, resume_file_type, employee_photo_path,
        phone, email, address,
        languages ? JSON.stringify(languages) : null,
        hobbies || null, references ? JSON.stringify(references) : null,
        is_active, newVersion, userId, id, tenantId
      ]
    );
    return result.rows[0];
  },

  /**
   * Delete an employee resume
   */
  async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM employee_resumes WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );
    return result.rows[0];
  },

  /**
   * Check if resume is used in any proposals
   * (For future use when proposal_resumes table exists)
   */
  async isUsedInProposals(id) {
    // Placeholder for when proposal_resumes table is implemented
    // const result = await db.query(
    //   'SELECT COUNT(*) as count FROM proposal_resumes WHERE resume_id = $1',
    //   [id]
    // );
    // return parseInt(result.rows[0].count, 10) > 0;
    return false;
  }
};

module.exports = EmployeeResume;
