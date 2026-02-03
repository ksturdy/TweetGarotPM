require('dotenv').config();
const { Pool } = require('pg');

/**
 * Push Projects, Departments, and Employees to Production
 * Transfers data from local development database to production Render database
 * WARNING: This will REPLACE all existing data in production!
 */

// Local database connection
const localPool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'tweetgarot_pm',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

// Production database connection (Render)
const productionPool = new Pool({
  connectionString: 'postgresql://titan_db_tjj1_user:SP1Tiit79QCCOU3NrIz2f4VEDGif9BHD@dpg-d5lbh6qli9vc73c3scf0-a.ohio-postgres.render.com/titan_db_tjj1',
  ssl: { rejectUnauthorized: false },
});

// Default tenant_id for production
const TENANT_ID = 1;

async function pushToProduction() {
  const localClient = await localPool.connect();
  const prodClient = await productionPool.connect();

  try {
    console.log('📦 Starting data push to production...\n');
    console.log('⚠️  This will REPLACE existing data in production!\n');

    // Start transaction on production
    await prodClient.query('BEGIN');

    // Clear existing data (in reverse order due to foreign keys)
    console.log('🗑️  Clearing existing production data...');
    await prodClient.query('DELETE FROM projects WHERE tenant_id = $1', [TENANT_ID]);
    await prodClient.query('DELETE FROM employees WHERE tenant_id = $1', [TENANT_ID]);
    await prodClient.query('DELETE FROM departments WHERE tenant_id = $1', [TENANT_ID]);
    console.log('   ✅ Cleared existing data\n');

    // 1. Push Departments - deduplicate by keeping lowest ID for each name
    console.log('📁 Pushing departments...');
    const departments = await localClient.query(`
      SELECT DISTINCT ON (name) * FROM departments
      ORDER BY name, id
    `);
    console.log(`   Found ${departments.rows.length} unique departments locally`);

    // Build a mapping from old department IDs to new department IDs
    const deptIdMap = new Map();

    if (departments.rows.length > 0) {
      for (const dept of departments.rows) {
        await prodClient.query(`
          INSERT INTO departments (id, name, department_number, description, manager_id, tenant_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [dept.id, dept.name, dept.department_number, dept.description, null, TENANT_ID, dept.created_at]);
        deptIdMap.set(dept.id, dept.id);
      }
      await prodClient.query(`SELECT setval('departments_id_seq', (SELECT MAX(id) FROM departments))`);
      console.log(`   ✅ Pushed ${departments.rows.length} departments`);
    }

    // Also map duplicate department IDs to their unique counterpart
    const allDepts = await localClient.query('SELECT id, name FROM departments ORDER BY id');
    const nameToIdMap = new Map();
    for (const dept of departments.rows) {
      nameToIdMap.set(dept.name, dept.id);
    }
    for (const dept of allDepts.rows) {
      if (!deptIdMap.has(dept.id)) {
        // This is a duplicate - map to the unique one
        deptIdMap.set(dept.id, nameToIdMap.get(dept.name));
      }
    }

    // 2. Push Employees
    console.log('\n👥 Pushing employees...');
    const employees = await localClient.query('SELECT * FROM employees ORDER BY id');
    console.log(`   Found ${employees.rows.length} employees locally`);

    if (employees.rows.length > 0) {
      for (const emp of employees.rows) {
        // Map department_id to the unique department
        const mappedDeptId = emp.department_id ? deptIdMap.get(emp.department_id) : null;

        await prodClient.query(`
          INSERT INTO employees (id, first_name, last_name, email, phone, job_title, position, department_id,
                                 hire_date, employment_status, employee_number, tenant_id, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [emp.id, emp.first_name, emp.last_name, emp.email, emp.phone, emp.position, emp.position,
            mappedDeptId, emp.hire_date, emp.employment_status, emp.employee_number,
            TENANT_ID, emp.created_at, emp.updated_at]);
      }
      await prodClient.query(`SELECT setval('employees_id_seq', (SELECT MAX(id) FROM employees))`);
      console.log(`   ✅ Pushed ${employees.rows.length} employees`);
    }

    // Update department managers now that employees exist
    console.log('\n🔗 Updating department managers...');
    let managerCount = 0;
    for (const dept of departments.rows) {
      if (dept.manager_id) {
        await prodClient.query('UPDATE departments SET manager_id = $1 WHERE id = $2', [dept.manager_id, dept.id]);
        managerCount++;
      }
    }
    console.log(`   ✅ Updated ${managerCount} department managers`);

    // 3. Push Projects
    console.log('\n🏗️  Pushing projects...');
    const projects = await localClient.query('SELECT * FROM projects ORDER BY id');
    console.log(`   Found ${projects.rows.length} projects locally`);

    if (projects.rows.length > 0) {
      let count = 0;
      for (const proj of projects.rows) {
        // Map department_id to the unique department
        const mappedDeptId = proj.department_id ? deptIdMap.get(proj.department_id) : null;

        await prodClient.query(`
          INSERT INTO projects (id, name, number, client, address, start_date, end_date,
                                status, description, market, manager_id, department_id,
                                contract_value, gross_margin_percent, backlog, tenant_id, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `, [proj.id, proj.name, proj.number, proj.client, proj.address, proj.start_date,
            proj.end_date, proj.status, proj.description, proj.market, proj.manager_id,
            mappedDeptId, proj.contract_value, proj.gross_margin_percent, proj.backlog,
            TENANT_ID, proj.created_at]);
        count++;
        if (count % 500 === 0) {
          console.log(`   ... pushed ${count} projects`);
        }
      }
      await prodClient.query(`SELECT setval('projects_id_seq', (SELECT MAX(id) FROM projects))`);
      console.log(`   ✅ Pushed ${projects.rows.length} projects`);
    }

    // Commit transaction
    await prodClient.query('COMMIT');

    console.log('\n✅ Data push to production complete!');
    console.log(`   📁 ${departments.rows.length} departments`);
    console.log(`   👥 ${employees.rows.length} employees`);
    console.log(`   🏗️  ${projects.rows.length} projects`);

  } catch (error) {
    await prodClient.query('ROLLBACK');
    console.error('❌ Error pushing to production:', error);
    throw error;
  } finally {
    localClient.release();
    prodClient.release();
    await localPool.end();
    await productionPool.end();
    process.exit(0);
  }
}

pushToProduction();
