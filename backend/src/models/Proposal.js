const db = require('../config/database');
const { processTemplate, buildProposalVariables } = require('../utils/templateProcessor');

class Proposal {
  // Find all proposals for a tenant with optional filters
  static async findAllByTenant(tenantId, filters = {}) {
    let query = `
      SELECT
        p.*,
        c.customer_facility as customer_name,
        u1.first_name || ' ' || u1.last_name as created_by_name,
        u2.first_name || ' ' || u2.last_name as approved_by_name,
        (SELECT COUNT(*) FROM proposal_sections WHERE proposal_id = p.id) as section_count
      FROM proposals p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u1 ON p.created_by = u1.id
      LEFT JOIN users u2 ON p.approved_by = u2.id
      WHERE p.tenant_id = $1
    `;

    const params = [tenantId];
    let paramCount = 1;

    // Add filters
    if (filters.status) {
      paramCount++;
      query += ` AND p.status = $${paramCount}`;
      params.push(filters.status);
    }

    if (filters.customer_id) {
      paramCount++;
      query += ` AND p.customer_id = $${paramCount}`;
      params.push(filters.customer_id);
    }

    if (filters.opportunity_id) {
      paramCount++;
      query += ` AND p.opportunity_id = $${paramCount}`;
      params.push(filters.opportunity_id);
    }

    if (filters.created_by) {
      paramCount++;
      query += ` AND p.created_by = $${paramCount}`;
      params.push(filters.created_by);
    }

    if (filters.is_latest !== undefined) {
      paramCount++;
      query += ` AND p.is_latest = $${paramCount}`;
      params.push(filters.is_latest);
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await db.query(query, params);
    return result.rows;
  }

  // Find single proposal by ID with full details
  static async findByIdAndTenant(id, tenantId) {
    const query = `
      SELECT
        p.*,
        c.customer_facility as customer_name,
        c.customer_owner,
        c.address as customer_address,
        u1.first_name || ' ' || u1.last_name as created_by_name,
        u2.first_name || ' ' || u2.last_name as approved_by_name,
        u3.first_name || ' ' || u3.last_name as sent_by_name,
        pt.name as template_name
      FROM proposals p
      LEFT JOIN customers c ON p.customer_id = c.id
      LEFT JOIN users u1 ON p.created_by = u1.id
      LEFT JOIN users u2 ON p.approved_by = u2.id
      LEFT JOIN users u3 ON p.sent_by = u3.id
      LEFT JOIN proposal_templates pt ON p.template_id = pt.id
      WHERE p.id = $1 AND p.tenant_id = $2
    `;

    const result = await db.query(query, [id, tenantId]);

    if (result.rows.length === 0) {
      return null;
    }

    const proposal = result.rows[0];

    // Get sections
    const sectionsResult = await db.query(
      'SELECT * FROM proposal_sections WHERE proposal_id = $1 ORDER BY display_order',
      [id]
    );
    proposal.sections = sectionsResult.rows;

    // Get attached case studies (full content for sell sheets)
    const caseStudiesResult = await db.query(`
      SELECT pcs.id as junction_id, pcs.display_order, pcs.notes,
             cs.id, cs.title, cs.subtitle, cs.market, cs.status as case_study_status,
             cs.challenge, cs.solution, cs.results, cs.executive_summary,
             cs.cost_savings, cs.timeline_improvement_days, cs.quality_score,
             cs.additional_metrics, cs.construction_type, cs.project_size,
             cs.services_provided, cs.customer_logo_url,
             c.customer_owner as customer_name, c.customer_facility,
             p.contract_value as project_value, p.name as project_name,
             p.start_date as project_start_date, p.end_date as project_end_date
      FROM proposal_case_studies pcs
      JOIN case_studies cs ON pcs.case_study_id = cs.id
      LEFT JOIN customers c ON cs.customer_id = c.id
      LEFT JOIN projects p ON cs.project_id = p.id
      WHERE pcs.proposal_id = $1
      ORDER BY pcs.display_order
    `, [id]);
    proposal.case_studies = caseStudiesResult.rows;

    // Get attached service offerings (full content for sell sheets)
    const serviceOfferingsResult = await db.query(`
      SELECT pso.id as junction_id, pso.display_order, pso.custom_description,
             so.id, so.name, so.description, so.category, so.icon_name,
             so.pricing_model, so.typical_duration_days
      FROM proposal_service_offerings pso
      JOIN service_offerings so ON pso.service_offering_id = so.id
      WHERE pso.proposal_id = $1
      ORDER BY pso.display_order
    `, [id]);
    proposal.service_offerings = serviceOfferingsResult.rows;

    // Get attached resumes (full content for sell sheets)
    const resumesResult = await db.query(`
      SELECT pr.id as junction_id, pr.display_order, pr.role_on_project,
             er.id, er.employee_name, er.job_title, er.summary,
             er.years_experience, er.certifications, er.skills, er.education
      FROM proposal_resumes pr
      JOIN employee_resumes er ON pr.resume_id = er.id
      WHERE pr.proposal_id = $1
      ORDER BY pr.display_order
    `, [id]);
    proposal.resumes = resumesResult.rows;

    return proposal;
  }

  // Create a new proposal with auto-generated proposal number
  static async create(data, userId, tenantId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Generate proposal number
      const numberResult = await client.query(
        'SELECT generate_proposal_number($1) as proposal_number',
        [tenantId]
      );
      const proposalNumber = numberResult.rows[0].proposal_number;

      // Insert proposal
      const proposalResult = await client.query(
        `INSERT INTO proposals (
          tenant_id, proposal_number, customer_id, opportunity_id, template_id,
          title, project_name, project_location,
          executive_summary, company_overview, scope_of_work, approach_and_methodology,
          total_amount, payment_terms, terms_and_conditions,
          status, valid_until, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *`,
        [
          tenantId,
          proposalNumber,
          data.customer_id || null,
          data.opportunity_id || null,
          data.template_id || null,
          data.title,
          data.project_name || null,
          data.project_location || null,
          data.executive_summary || null,
          data.company_overview || null,
          data.scope_of_work || null,
          data.approach_and_methodology || null,
          data.total_amount || null,
          data.payment_terms || null,
          data.terms_and_conditions || null,
          data.status || 'draft',
          data.valid_until || null,
          userId,
        ]
      );

      const proposal = proposalResult.rows[0];

      // Insert sections if provided
      if (data.sections && data.sections.length > 0) {
        for (let i = 0; i < data.sections.length; i++) {
          const section = data.sections[i];
          await client.query(
            `INSERT INTO proposal_sections (
              proposal_id, section_type, title, content, display_order
            ) VALUES ($1, $2, $3, $4, $5)`,
            [
              proposal.id,
              section.section_type,
              section.title,
              section.content || '',
              section.display_order || i + 1,
            ]
          );
        }
      }

      // Sync attached items if provided
      if (data.case_study_ids || data.service_offering_ids || data.resume_ids) {
        await Proposal.syncAttachments(proposal.id, {
          case_study_ids: data.case_study_ids || [],
          service_offering_ids: data.service_offering_ids || [],
          resume_ids: data.resume_ids || [],
        }, client);
      }

      await client.query('COMMIT');
      return proposal;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Create proposal from template (with variable substitution)
  static async createFromTemplate(templateId, data, userId, tenantId, context = {}) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Get template with sections
      const templateResult = await client.query(
        'SELECT * FROM proposal_templates WHERE id = $1 AND tenant_id = $2',
        [templateId, tenantId]
      );

      if (templateResult.rows.length === 0) {
        throw new Error('Template not found');
      }

      const template = templateResult.rows[0];

      // Get template sections
      const sectionsResult = await client.query(
        'SELECT * FROM proposal_template_sections WHERE template_id = $1 ORDER BY display_order',
        [templateId]
      );

      // Generate proposal number
      const numberResult = await client.query(
        'SELECT generate_proposal_number($1) as proposal_number',
        [tenantId]
      );
      const proposalNumber = numberResult.rows[0].proposal_number;

      // Build template variables for substitution
      const variables = buildProposalVariables({
        proposal: {
          proposal_number: proposalNumber,
          title: data.title,
          project_name: data.project_name,
          project_location: data.project_location,
          total_amount: data.total_amount,
          valid_until: data.valid_until,
          payment_terms: data.payment_terms,
        },
        customer: context.customer || {},
        tenant: context.tenant || {},
        user: context.user || {},
      });

      // Process template content with variable substitution
      const executiveSummary = processTemplate(template.default_executive_summary, variables);
      const companyOverview = processTemplate(template.default_company_overview, variables);
      const termsAndConditions = processTemplate(template.default_terms_and_conditions, variables);

      // Create proposal with processed template defaults
      const proposalResult = await client.query(
        `INSERT INTO proposals (
          tenant_id, proposal_number, customer_id, opportunity_id, template_id,
          title, project_name, project_location,
          executive_summary, company_overview, terms_and_conditions,
          status, valid_until, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *`,
        [
          tenantId,
          proposalNumber,
          data.customer_id || null,
          data.opportunity_id || null,
          templateId,
          data.title,
          data.project_name || null,
          data.project_location || null,
          executiveSummary || null,
          companyOverview || null,
          termsAndConditions || null,
          'draft',
          data.valid_until || null,
          userId,
        ]
      );

      const proposal = proposalResult.rows[0];

      // Copy template sections to proposal with variable substitution
      for (const section of sectionsResult.rows) {
        await client.query(
          `INSERT INTO proposal_sections (
            proposal_id, section_type, title, content, display_order
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            proposal.id,
            section.section_type,
            processTemplate(section.title, variables),
            processTemplate(section.content, variables),
            section.display_order,
          ]
        );
      }

      // Sync attached items if provided
      if (data.case_study_ids || data.service_offering_ids || data.resume_ids) {
        await Proposal.syncAttachments(proposal.id, {
          case_study_ids: data.case_study_ids || [],
          service_offering_ids: data.service_offering_ids || [],
          resume_ids: data.resume_ids || [],
        }, client);
      }

      await client.query('COMMIT');
      return proposal;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // Update proposal
  static async update(id, data, tenantId) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = [
      'customer_id',
      'opportunity_id',
      'title',
      'project_name',
      'project_location',
      'executive_summary',
      'company_overview',
      'scope_of_work',
      'approach_and_methodology',
      'total_amount',
      'payment_terms',
      'terms_and_conditions',
      'valid_until',
    ];

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        paramCount++;
        fields.push(`${field} = $${paramCount}`);
        values.push(data[field]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    paramCount++;
    values.push(id);
    paramCount++;
    values.push(tenantId);

    const query = `
      UPDATE proposals
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount - 1} AND tenant_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Proposal not found or access denied');
    }

    return result.rows[0];
  }

  // Update proposal status with workflow validation
  static async updateStatus(id, status, userId, tenantId) {
    const validTransitions = {
      draft: ['pending_review'],
      pending_review: ['approved', 'draft'],
      approved: ['sent'],
      sent: ['accepted', 'rejected', 'expired'],
    };

    // Get current proposal
    const currentResult = await db.query(
      'SELECT status FROM proposals WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (currentResult.rows.length === 0) {
      throw new Error('Proposal not found');
    }

    const currentStatus = currentResult.rows[0].status;

    // Validate transition
    if (
      !validTransitions[currentStatus] ||
      !validTransitions[currentStatus].includes(status)
    ) {
      throw new Error(`Invalid status transition from ${currentStatus} to ${status}`);
    }

    const updates = { status };

    // Set additional fields based on status
    if (status === 'approved') {
      updates.approved_by = userId;
      updates.approved_at = 'CURRENT_TIMESTAMP';
    } else if (status === 'sent') {
      updates.sent_by = userId;
      updates.sent_date = 'CURRENT_TIMESTAMP';
    } else if (status === 'accepted') {
      updates.accepted_date = 'CURRENT_TIMESTAMP';
    }

    const fields = Object.keys(updates).map((key, idx) => {
      if (updates[key] === 'CURRENT_TIMESTAMP') {
        return `${key} = CURRENT_TIMESTAMP`;
      }
      return `${key} = $${idx + 1}`;
    });

    const values = Object.values(updates).filter((v) => v !== 'CURRENT_TIMESTAMP');
    values.push(id, tenantId);

    const query = `
      UPDATE proposals
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${values.length - 1} AND tenant_id = $${values.length}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Get proposal sections
  static async getSections(proposalId) {
    const result = await db.query(
      'SELECT * FROM proposal_sections WHERE proposal_id = $1 ORDER BY display_order',
      [proposalId]
    );
    return result.rows;
  }

  // Update a specific section
  static async updateSection(sectionId, data) {
    const fields = [];
    const values = [];
    let paramCount = 0;

    const allowedFields = ['section_type', 'title', 'content', 'display_order'];

    allowedFields.forEach((field) => {
      if (data[field] !== undefined) {
        paramCount++;
        fields.push(`${field} = $${paramCount}`);
        values.push(data[field]);
      }
    });

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    paramCount++;
    values.push(sectionId);

    const query = `
      UPDATE proposal_sections
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);
    return result.rows[0];
  }

  // Create a revision (new version) of an existing proposal
  static async createRevision(id, userId, tenantId) {
    const client = await db.pool.connect();

    try {
      await client.query('BEGIN');

      // Get original proposal
      const originalResult = await client.query(
        'SELECT * FROM proposals WHERE id = $1 AND tenant_id = $2',
        [id, tenantId]
      );

      if (originalResult.rows.length === 0) {
        throw new Error('Original proposal not found');
      }

      const original = originalResult.rows[0];

      // Mark original as not latest
      await client.query('UPDATE proposals SET is_latest = false WHERE id = $1', [id]);

      // Generate new proposal number
      const numberResult = await client.query(
        'SELECT generate_proposal_number($1) as proposal_number',
        [tenantId]
      );
      const proposalNumber = numberResult.rows[0].proposal_number;

      // Create new revision
      const revisionResult = await client.query(
        `INSERT INTO proposals (
          tenant_id, proposal_number, customer_id, opportunity_id, template_id,
          title, project_name, project_location,
          executive_summary, company_overview, scope_of_work, approach_and_methodology,
          total_amount, payment_terms, terms_and_conditions,
          status, parent_proposal_id, version_number, is_latest, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING *`,
        [
          tenantId,
          proposalNumber,
          original.customer_id,
          original.opportunity_id,
          original.template_id,
          original.title,
          original.project_name,
          original.project_location,
          original.executive_summary,
          original.company_overview,
          original.scope_of_work,
          original.approach_and_methodology,
          original.total_amount,
          original.payment_terms,
          original.terms_and_conditions,
          'draft',
          id,
          original.version_number + 1,
          true,
          userId,
        ]
      );

      const revision = revisionResult.rows[0];

      // Copy sections
      const sectionsResult = await client.query(
        'SELECT * FROM proposal_sections WHERE proposal_id = $1 ORDER BY display_order',
        [id]
      );

      for (const section of sectionsResult.rows) {
        await client.query(
          `INSERT INTO proposal_sections (
            proposal_id, section_type, title, content, display_order
          ) VALUES ($1, $2, $3, $4, $5)`,
          [
            revision.id,
            section.section_type,
            section.title,
            section.content,
            section.display_order,
          ]
        );
      }

      // Copy attached case studies
      await client.query(`
        INSERT INTO proposal_case_studies (proposal_id, case_study_id, display_order, notes)
        SELECT $1, case_study_id, display_order, notes
        FROM proposal_case_studies WHERE proposal_id = $2
      `, [revision.id, id]);

      // Copy attached service offerings
      await client.query(`
        INSERT INTO proposal_service_offerings (proposal_id, service_offering_id, display_order, custom_description)
        SELECT $1, service_offering_id, display_order, custom_description
        FROM proposal_service_offerings WHERE proposal_id = $2
      `, [revision.id, id]);

      // Copy attached resumes
      await client.query(`
        INSERT INTO proposal_resumes (proposal_id, resume_id, display_order, role_on_project)
        SELECT $1, resume_id, display_order, role_on_project
        FROM proposal_resumes WHERE proposal_id = $2
      `, [revision.id, id]);

      await client.query('COMMIT');
      return revision;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // === JUNCTION TABLE METHODS ===

  // Sync all attachments (used during create)
  static async syncAttachments(proposalId, attachments, client = null) {
    const queryFn = client ? client.query.bind(client) : db.query.bind(db);

    if (attachments.case_study_ids !== undefined) {
      await queryFn('DELETE FROM proposal_case_studies WHERE proposal_id = $1', [proposalId]);
      for (let i = 0; i < attachments.case_study_ids.length; i++) {
        await queryFn(
          'INSERT INTO proposal_case_studies (proposal_id, case_study_id, display_order) VALUES ($1, $2, $3)',
          [proposalId, attachments.case_study_ids[i], i + 1]
        );
      }
    }

    if (attachments.service_offering_ids !== undefined) {
      await queryFn('DELETE FROM proposal_service_offerings WHERE proposal_id = $1', [proposalId]);
      for (let i = 0; i < attachments.service_offering_ids.length; i++) {
        await queryFn(
          'INSERT INTO proposal_service_offerings (proposal_id, service_offering_id, display_order) VALUES ($1, $2, $3)',
          [proposalId, attachments.service_offering_ids[i], i + 1]
        );
      }
    }

    if (attachments.resume_ids !== undefined) {
      await queryFn('DELETE FROM proposal_resumes WHERE proposal_id = $1', [proposalId]);
      for (let i = 0; i < attachments.resume_ids.length; i++) {
        await queryFn(
          'INSERT INTO proposal_resumes (proposal_id, resume_id, display_order) VALUES ($1, $2, $3)',
          [proposalId, attachments.resume_ids[i], i + 1]
        );
      }
    }
  }

  // --- Case Studies ---

  static async getCaseStudies(proposalId) {
    const result = await db.query(`
      SELECT pcs.id as junction_id, pcs.display_order, pcs.notes,
             cs.id, cs.title, cs.subtitle, cs.customer_name, cs.market,
             cs.status as case_study_status, cs.project_value
      FROM proposal_case_studies pcs
      JOIN case_studies cs ON pcs.case_study_id = cs.id
      WHERE pcs.proposal_id = $1
      ORDER BY pcs.display_order
    `, [proposalId]);
    return result.rows;
  }

  static async addCaseStudy(proposalId, caseStudyId, data = {}) {
    const result = await db.query(`
      INSERT INTO proposal_case_studies (proposal_id, case_study_id, display_order, notes)
      VALUES ($1, $2, COALESCE($3, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM proposal_case_studies WHERE proposal_id = $1)), $4)
      ON CONFLICT (proposal_id, case_study_id)
      DO UPDATE SET notes = COALESCE(EXCLUDED.notes, proposal_case_studies.notes)
      RETURNING *
    `, [proposalId, caseStudyId, data.display_order || null, data.notes || null]);
    return result.rows[0];
  }

  static async removeCaseStudy(proposalId, caseStudyId) {
    const result = await db.query(
      'DELETE FROM proposal_case_studies WHERE proposal_id = $1 AND case_study_id = $2 RETURNING *',
      [proposalId, caseStudyId]
    );
    return result.rows[0];
  }

  // --- Service Offerings ---

  static async getServiceOfferings(proposalId) {
    const result = await db.query(`
      SELECT pso.id as junction_id, pso.display_order, pso.custom_description,
             so.id, so.name, so.description, so.category, so.icon_name
      FROM proposal_service_offerings pso
      JOIN service_offerings so ON pso.service_offering_id = so.id
      WHERE pso.proposal_id = $1
      ORDER BY pso.display_order
    `, [proposalId]);
    return result.rows;
  }

  static async addServiceOffering(proposalId, serviceOfferingId, data = {}) {
    const result = await db.query(`
      INSERT INTO proposal_service_offerings (proposal_id, service_offering_id, display_order, custom_description)
      VALUES ($1, $2, COALESCE($3, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM proposal_service_offerings WHERE proposal_id = $1)), $4)
      ON CONFLICT (proposal_id, service_offering_id)
      DO UPDATE SET custom_description = COALESCE(EXCLUDED.custom_description, proposal_service_offerings.custom_description)
      RETURNING *
    `, [proposalId, serviceOfferingId, data.display_order || null, data.custom_description || null]);
    return result.rows[0];
  }

  static async removeServiceOffering(proposalId, serviceOfferingId) {
    const result = await db.query(
      'DELETE FROM proposal_service_offerings WHERE proposal_id = $1 AND service_offering_id = $2 RETURNING *',
      [proposalId, serviceOfferingId]
    );
    return result.rows[0];
  }

  // --- Resumes ---

  static async getResumes(proposalId) {
    const result = await db.query(`
      SELECT pr.id as junction_id, pr.display_order, pr.role_on_project,
             er.id, er.employee_name, er.job_title, er.summary
      FROM proposal_resumes pr
      JOIN employee_resumes er ON pr.resume_id = er.id
      WHERE pr.proposal_id = $1
      ORDER BY pr.display_order
    `, [proposalId]);
    return result.rows;
  }

  static async addResume(proposalId, resumeId, data = {}) {
    const result = await db.query(`
      INSERT INTO proposal_resumes (proposal_id, resume_id, display_order, role_on_project)
      VALUES ($1, $2, COALESCE($3, (SELECT COALESCE(MAX(display_order), 0) + 1 FROM proposal_resumes WHERE proposal_id = $1)), $4)
      ON CONFLICT (proposal_id, resume_id)
      DO UPDATE SET role_on_project = COALESCE(EXCLUDED.role_on_project, proposal_resumes.role_on_project)
      RETURNING *
    `, [proposalId, resumeId, data.display_order || null, data.role_on_project || null]);
    return result.rows[0];
  }

  static async removeResume(proposalId, resumeId) {
    const result = await db.query(
      'DELETE FROM proposal_resumes WHERE proposal_id = $1 AND resume_id = $2 RETURNING *',
      [proposalId, resumeId]
    );
    return result.rows[0];
  }

  // Delete proposal
  static async delete(id, tenantId) {
    const result = await db.query(
      'DELETE FROM proposals WHERE id = $1 AND tenant_id = $2 RETURNING *',
      [id, tenantId]
    );

    if (result.rows.length === 0) {
      throw new Error('Proposal not found or access denied');
    }

    return result.rows[0];
  }
}

module.exports = Proposal;
