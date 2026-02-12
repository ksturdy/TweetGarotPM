require('dotenv').config();
const db = require('./src/config/database');

const templates = [
  {
    name: 'Full Detail',
    description: 'Complete case study with all sections - ideal for detailed project showcases',
    category: 'Detailed',
    layout_config: {
      sections: [
        { key: 'project_info', label: 'Project Information', visible: true, order: 1 },
        { key: 'executive_summary', label: 'Executive Summary', visible: true, order: 2 },
        { key: 'challenge', label: 'Challenge', visible: true, order: 3 },
        { key: 'solution', label: 'Our Solution', visible: true, order: 4 },
        { key: 'results', label: 'Results', visible: true, order: 5 },
        { key: 'metrics', label: 'Key Metrics', visible: true, order: 6 },
        { key: 'images', label: 'Project Photos', visible: true, order: 7 },
        { key: 'services_provided', label: 'Services Provided', visible: true, order: 8 }
      ],
      page_size: 'letter',
      orientation: 'portrait'
    },
    color_scheme: 'default',
    show_logo: true,
    show_images: true,
    show_metrics: true,
    is_default: true,
    is_active: true
  },
  {
    name: 'Executive Summary',
    description: 'Condensed one-page format focused on outcomes - ideal for proposals and client presentations',
    category: 'Summary',
    layout_config: {
      sections: [
        { key: 'project_info', label: 'Project Overview', visible: true, order: 1 },
        { key: 'executive_summary', label: 'Executive Summary', visible: true, order: 2 },
        { key: 'challenge', label: 'Challenge', visible: false, order: 3 },
        { key: 'solution', label: 'Our Solution', visible: false, order: 4 },
        { key: 'results', label: 'Results', visible: false, order: 5 },
        { key: 'metrics', label: 'Key Metrics', visible: true, order: 6 },
        { key: 'images', label: 'Project Photos', visible: false, order: 7 },
        { key: 'services_provided', label: 'Services Provided', visible: true, order: 8 }
      ],
      page_size: 'letter',
      orientation: 'portrait'
    },
    color_scheme: 'branded',
    show_logo: true,
    show_images: false,
    show_metrics: true,
    is_default: false,
    is_active: true
  },
  {
    name: 'Technical Showcase',
    description: 'Technical format emphasizing challenge-solution-results with project photos',
    category: 'Technical',
    layout_config: {
      sections: [
        { key: 'project_info', label: 'Project Details', visible: true, order: 1 },
        { key: 'executive_summary', label: 'Executive Summary', visible: false, order: 2 },
        { key: 'challenge', label: 'The Challenge', visible: true, order: 3 },
        { key: 'solution', label: 'Technical Solution', visible: true, order: 4 },
        { key: 'results', label: 'Outcomes & Results', visible: true, order: 5 },
        { key: 'metrics', label: 'Performance Metrics', visible: true, order: 6 },
        { key: 'images', label: 'Project Gallery', visible: true, order: 7 },
        { key: 'services_provided', label: 'Services Provided', visible: false, order: 8 }
      ],
      page_size: 'letter',
      orientation: 'portrait'
    },
    color_scheme: 'default',
    show_logo: true,
    show_images: true,
    show_metrics: true,
    is_default: false,
    is_active: true
  }
];

async function seedTemplates() {
  try {
    console.log('Seeding case study templates...');

    // Get tenant_id = 1
    const tenantResult = await db.query('SELECT id FROM tenants LIMIT 1');
    if (tenantResult.rows.length === 0) {
      console.error('No tenant found');
      process.exit(1);
    }
    const tenantId = tenantResult.rows[0].id;

    // Get first admin user
    const userResult = await db.query(
      "SELECT id FROM users WHERE tenant_id = $1 AND role = 'admin' LIMIT 1",
      [tenantId]
    );
    const userId = userResult.rows.length > 0 ? userResult.rows[0].id : null;

    for (const template of templates) {
      // Check if template already exists
      const existing = await db.query(
        'SELECT id FROM case_study_templates WHERE tenant_id = $1 AND name = $2',
        [tenantId, template.name]
      );

      if (existing.rows.length > 0) {
        console.log(`  Template "${template.name}" already exists, skipping`);
        continue;
      }

      await db.query(
        `INSERT INTO case_study_templates (
          tenant_id, name, description, category, layout_config,
          color_scheme, show_logo, show_images, show_metrics,
          is_default, is_active, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          tenantId, template.name, template.description, template.category,
          JSON.stringify(template.layout_config),
          template.color_scheme, template.show_logo, template.show_images, template.show_metrics,
          template.is_default, template.is_active, userId
        ]
      );
      console.log(`  Created template: ${template.name}`);
    }

    console.log('Done seeding case study templates!');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding templates:', error);
    process.exit(1);
  }
}

seedTemplates();
