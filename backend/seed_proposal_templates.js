require('dotenv').config();
const db = require('./src/config/database');

const defaultTemplates = [
  {
    name: 'General Commercial Proposal',
    description: 'Standard template for commercial HVAC, plumbing, and mechanical projects',
    category: 'Commercial',
    default_executive_summary: `We are pleased to submit this proposal for {{project_name}} at {{customer_name}}. With over {{years_experience}} years of experience in commercial mechanical systems, {{company_name}} is uniquely positioned to deliver exceptional results for this project.

Our team has successfully completed similar projects in the {{market}} sector, and we understand the unique requirements and challenges of {{construction_type}} construction.`,
    default_company_overview: `{{company_name}} is a leading mechanical contractor specializing in HVAC, plumbing, and sheet metal services for commercial, industrial, and institutional facilities. Founded in {{founding_year}}, we have built a reputation for quality workmanship, on-time delivery, and exceptional customer service.

Our capabilities include:
- Design-Build and Design-Assist services
- HVAC system installation and retrofit
- Plumbing and piping systems
- Sheet metal fabrication and installation
- Building automation and controls
- Preventive maintenance programs

We maintain all necessary licenses, certifications, and insurance coverage required for commercial construction projects.`,
    default_terms_and_conditions: `Payment Terms: {{payment_terms}}

Warranty: All work is warranted for one year from the date of substantial completion. Equipment warranties are per manufacturer specifications.

Schedule: Work will commence upon receipt of signed agreement and required submittals. Estimated duration: {{project_duration_days}} days.

Exclusions: This proposal excludes permits, engineering fees, and any work not specifically outlined in the scope of work section.

Validity: This proposal is valid for 30 days from {{proposal_date}}.`,
    is_default: true,
    is_active: true,
    sections: [
      {
        section_type: 'scope',
        title: 'Scope of Work',
        content: `{{company_name}} will provide all labor, materials, equipment, and supervision necessary to complete the following work for {{project_name}}:

[Detail specific scope items here based on project requirements]

All work will be performed in accordance with applicable building codes, industry standards, and best practices.`,
        display_order: 1,
        is_required: true,
      },
      {
        section_type: 'approach',
        title: 'Project Approach',
        content: `Our approach to {{project_name}} includes:

1. **Pre-Construction Planning**: Coordination with the project team, submittal preparation, and material procurement
2. **Installation**: Systematic installation following approved schedule and coordination drawings
3. **Quality Control**: Regular inspections and testing throughout the project
4. **Commissioning**: Complete system startup, testing, and balancing
5. **Training**: Owner training on system operation and maintenance
6. **Closeout**: As-built drawings, O&M manuals, and warranty documentation`,
        display_order: 2,
        is_required: false,
      },
      {
        section_type: 'timeline',
        title: 'Project Timeline',
        content: `Estimated project duration: {{project_duration_days}} days

Key milestones:
- Submittal approval: {{milestone_1_date}}
- Material delivery: {{milestone_2_date}}
- Rough-in complete: {{milestone_3_date}}
- Final completion: {{milestone_4_date}}

Our schedule will be coordinated with the overall project schedule and adjusted as needed to support project success.`,
        display_order: 3,
        is_required: false,
      },
    ],
  },
  {
    name: 'Healthcare Facility Proposal',
    description: 'Specialized template for hospitals, clinics, and medical facilities',
    category: 'Healthcare',
    default_executive_summary: `{{company_name}} is honored to propose mechanical services for {{project_name}} at {{customer_name}}. We understand the critical nature of healthcare facility mechanical systems and the importance of reliability, infection control, and patient comfort.

Our experience in healthcare construction includes work at major hospitals, outpatient clinics, and specialty care facilities throughout the region.`,
    default_company_overview: `{{company_name}} specializes in mechanical systems for healthcare facilities, with extensive experience in:

- Operating room HVAC with HEPA filtration
- Medical gas systems and vacuum systems
- Critical environment controls
- Infection control and isolation room systems
- Central utility plant installation
- Emergency power system coordination

Our team includes ASHE-certified technicians and we maintain strict adherence to FGI Guidelines and Joint Commission requirements.`,
    default_terms_and_conditions: `Payment Terms: {{payment_terms}}

Healthcare Compliance: All work will comply with FGI Guidelines, ASHRAE 170, and applicable state healthcare construction requirements.

Infection Control: An Infection Control Risk Assessment (ICRA) will be prepared and implemented for all work areas.

Schedule: Work will be coordinated to minimize disruption to patient care areas. Off-hours work available as needed.

Validity: This proposal is valid for 30 days from {{proposal_date}}.`,
    is_default: false,
    is_active: true,
    sections: [
      {
        section_type: 'scope',
        title: 'Scope of Work',
        content: `{{company_name}} will provide mechanical services for {{project_name}} including:

[Detail healthcare-specific scope items]

All work will meet FGI Guidelines, ASHRAE 170 ventilation standards, and local healthcare facility licensing requirements.`,
        display_order: 1,
        is_required: true,
      },
      {
        section_type: 'approach',
        title: 'Healthcare Project Approach',
        content: `Our healthcare facility approach includes:

1. **ICRA Planning**: Infection Control Risk Assessment and mitigation measures
2. **Phased Installation**: Coordinated sequencing to maintain facility operations
3. **After-Hours Work**: Scheduling to minimize patient impact
4. **Testing & Balancing**: Certified TAB per AABC standards
5. **Documentation**: Complete compliance documentation for licensing authorities`,
        display_order: 2,
        is_required: false,
      },
    ],
  },
  {
    name: 'Industrial Project Proposal',
    description: 'Template for manufacturing, warehouse, and industrial facilities',
    category: 'Industrial',
    default_executive_summary: `{{company_name}} submits this proposal for industrial mechanical services at {{project_name}}. Our experience with manufacturing and industrial facilities gives us unique insight into the demands of process systems, heavy-duty HVAC, and specialized exhaust systems.

We understand that minimizing downtime and maintaining productivity are critical to your operations.`,
    default_company_overview: `{{company_name}} provides comprehensive mechanical services for industrial facilities including:

- Process piping and equipment installation
- Industrial HVAC and ventilation systems
- Dust collection and exhaust systems
- Compressed air systems
- Boiler and chiller installation
- Maintenance and emergency repair services

Our industrial division includes certified welders, pipefitters, and millwrights experienced in industrial construction.`,
    default_terms_and_conditions: `Payment Terms: {{payment_terms}}

Safety: All work will comply with OSHA requirements and client-specific safety protocols.

Schedule: Work will be coordinated with production schedules to minimize operational impact. Weekend and off-shift work available.

Testing: All systems will be tested and commissioned prior to turnover.

Validity: This proposal is valid for 30 days from {{proposal_date}}.`,
    is_default: false,
    is_active: true,
    sections: [
      {
        section_type: 'scope',
        title: 'Industrial Scope of Work',
        content: `{{company_name}} will provide the following industrial mechanical services:

[Detail industrial-specific scope items including process systems, heavy-duty equipment, etc.]

All work will be coordinated with production schedules and performed in accordance with applicable codes and industry standards.`,
        display_order: 1,
        is_required: true,
      },
    ],
  },
  {
    name: 'Service & Maintenance Agreement',
    description: 'Template for ongoing service contracts and maintenance agreements',
    category: 'Service',
    default_executive_summary: `{{company_name}} is pleased to propose a comprehensive maintenance program for the mechanical systems at {{customer_name}}. Regular preventive maintenance is essential to system reliability, energy efficiency, and long equipment life.

Our service program is designed to minimize unplanned downtime and extend the service life of your mechanical systems.`,
    default_company_overview: `{{company_name}} Service Division provides comprehensive maintenance services including:

- Preventive maintenance programs
- Emergency repair services
- System monitoring and optimization
- Parts and supplies
- 24/7 emergency service availability

Our service technicians are factory-trained and certified on all major equipment brands.`,
    default_terms_and_conditions: `Service Term: {{contract_term}}

Payment Terms: {{payment_terms}}

Response Time: Emergency calls will receive response within {{emergency_response_hours}} hours. Routine service scheduled during normal business hours.

Equipment Coverage: This agreement covers equipment as detailed in the scope of work section.

Exclusions: Parts and materials for repairs are additional unless otherwise specified.`,
    is_default: false,
    is_active: true,
    sections: [
      {
        section_type: 'scope',
        title: 'Service Agreement Scope',
        content: `This service agreement includes the following:

**Equipment Covered:**
[List specific equipment and systems]

**Services Included:**
- Quarterly preventive maintenance inspections
- Filter changes
- Lubrication and adjustment
- Performance testing
- Emergency repair services (labor only)
- Detailed service reports

**Schedule:**
Service visits will be performed quarterly (4 times per year) or as otherwise specified.`,
        display_order: 1,
        is_required: true,
      },
    ],
  },
];

async function seedProposalTemplates() {
  const client = await db.pool.connect();

  try {
    console.log('Starting proposal templates seed...');

    // Use tenant_id = 1 for default templates
    const TENANT_ID = 1;

    await client.query('BEGIN');

    for (const template of defaultTemplates) {
      // Check if template already exists
      const existing = await client.query(
        'SELECT id FROM proposal_templates WHERE tenant_id = $1 AND name = $2',
        [TENANT_ID, template.name]
      );

      if (existing.rows.length > 0) {
        console.log(`Template "${template.name}" already exists, skipping...`);
        continue;
      }

      // If this template is default, unmark any existing defaults
      if (template.is_default) {
        await client.query(
          'UPDATE proposal_templates SET is_default = false WHERE tenant_id = $1',
          [TENANT_ID]
        );
      }

      // Insert template
      const templateResult = await client.query(
        `INSERT INTO proposal_templates (
          tenant_id, name, description, category,
          default_executive_summary, default_company_overview, default_terms_and_conditions,
          is_default, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id`,
        [
          TENANT_ID,
          template.name,
          template.description,
          template.category,
          template.default_executive_summary,
          template.default_company_overview,
          template.default_terms_and_conditions,
          template.is_default,
          template.is_active,
        ]
      );

      const templateId = templateResult.rows[0].id;
      console.log(`Created template: ${template.name} (ID: ${templateId})`);

      // Insert sections
      if (template.sections && template.sections.length > 0) {
        for (const section of template.sections) {
          await client.query(
            `INSERT INTO proposal_template_sections (
              template_id, section_type, title, content, display_order, is_required
            ) VALUES ($1, $2, $3, $4, $5, $6)`,
            [
              templateId,
              section.section_type,
              section.title,
              section.content,
              section.display_order,
              section.is_required,
            ]
          );
        }
        console.log(`  Added ${template.sections.length} sections`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Proposal templates seeded successfully!');

    // Show summary
    const summary = await client.query(
      'SELECT COUNT(*) as count FROM proposal_templates WHERE tenant_id = $1',
      [TENANT_ID]
    );
    console.log(`Total templates in database: ${summary.rows[0].count}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Error seeding proposal templates:', error);
    throw error;
  } finally {
    client.release();
    await db.pool.end();
  }
}

// Run the seed
seedProposalTemplates()
  .then(() => {
    console.log('Seed completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  });
