const express = require('express');
const router = express.Router();
const Team = require('../models/Team');
const { authenticate, authorize } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');

// Apply authentication and tenant context to all routes
router.use(authenticate);
router.use(tenantContext);

// Get all teams
router.get('/', async (req, res) => {
  try {
    const teams = await Team.getAll(req.tenantId);
    res.json({ data: teams });
  } catch (error) {
    console.error('Error fetching teams:', error);
    res.status(500).json({ error: 'Failed to fetch teams' });
  }
});

// Get all team member IDs for the current user's teams
// This is used for "My Team" filtering on the dashboard
// Returns employee IDs (for project filtering), user IDs (for opportunity/estimate filtering),
// and names (for matching estimates by estimator_name text field)
router.get('/my-team-members', async (req, res) => {
  try {
    const [employeeIds, userIds, names] = await Promise.all([
      Team.getMyTeamMemberEmployeeIds(req.user.id, req.tenantId),
      Team.getMyTeamMemberUserIds(req.user.id, req.tenantId),
      Team.getMyTeamMemberNames(req.user.id, req.tenantId)
    ]);
    res.json({ data: { employeeIds, userIds, names } });
  } catch (error) {
    console.error('Error fetching team member IDs:', error);
    res.status(500).json({ error: 'Failed to fetch team member IDs' });
  }
});

// Get team by ID
router.get('/:id', async (req, res) => {
  try {
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json({ data: team });
  } catch (error) {
    console.error('Error fetching team:', error);
    res.status(500).json({ error: 'Failed to fetch team' });
  }
});

// Get team members
router.get('/:id/members', async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const members = await Team.getMembers(req.params.id, req.tenantId);
    res.json({ data: members });
  } catch (error) {
    console.error('Error fetching team members:', error);
    res.status(500).json({ error: 'Failed to fetch team members' });
  }
});

// Get team dashboard metrics
router.get('/:id/dashboard', async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const metrics = await Team.getDashboardMetrics(req.params.id, req.tenantId);
    res.json({ data: metrics });
  } catch (error) {
    console.error('Error fetching team dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch team dashboard' });
  }
});

// Get team's opportunities
router.get('/:id/opportunities', async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const opportunities = await Team.getOpportunities(req.params.id, req.tenantId);
    res.json({ data: opportunities });
  } catch (error) {
    console.error('Error fetching team opportunities:', error);
    res.status(500).json({ error: 'Failed to fetch team opportunities' });
  }
});

// Get team's customers
router.get('/:id/customers', async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const customers = await Team.getCustomers(req.params.id, req.tenantId);
    res.json({ data: customers });
  } catch (error) {
    console.error('Error fetching team customers:', error);
    res.status(500).json({ error: 'Failed to fetch team customers' });
  }
});

// Get team's estimates
router.get('/:id/estimates', async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const estimates = await Team.getEstimates(req.params.id, req.tenantId);
    res.json({ data: estimates });
  } catch (error) {
    console.error('Error fetching team estimates:', error);
    res.status(500).json({ error: 'Failed to fetch team estimates' });
  }
});

// Create team - requires admin or manager role
router.post('/', authorize('admin', 'manager'), async (req, res) => {
  try {
    if (!req.body.name || !req.body.name.trim()) {
      return res.status(400).json({ error: 'Team name is required' });
    }

    const team = await Team.create({
      name: req.body.name.trim(),
      description: req.body.description,
      team_lead_id: req.body.team_lead_id,
      color: req.body.color,
      is_active: req.body.is_active,
      created_by: req.user.id
    }, req.tenantId);

    res.status(201).json({ data: team });
  } catch (error) {
    console.error('Error creating team:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A team with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create team' });
  }
});

// Update team - requires admin or manager role
router.put('/:id', authorize('admin', 'manager'), async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const existingTeam = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!existingTeam) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const team = await Team.update(req.params.id, {
      name: req.body.name,
      description: req.body.description,
      team_lead_id: req.body.team_lead_id,
      color: req.body.color,
      is_active: req.body.is_active
    }, req.tenantId);

    res.json({ data: team });
  } catch (error) {
    console.error('Error updating team:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'A team with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to update team' });
  }
});

// Delete team - requires admin role
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const deleted = await Team.delete(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Team not found' });
    }
    res.json({ message: 'Team deleted successfully' });
  } catch (error) {
    console.error('Error deleting team:', error);
    res.status(500).json({ error: 'Failed to delete team' });
  }
});

// Add member to team - requires admin or manager role
router.post('/:id/members', authorize('admin', 'manager'), async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (!req.body.employee_id) {
      return res.status(400).json({ error: 'Employee ID is required' });
    }

    const member = await Team.addMember(
      req.params.id,
      req.body.employee_id,
      req.body.role || 'member'
    );
    res.status(201).json({ data: member });
  } catch (error) {
    console.error('Error adding team member:', error);
    res.status(500).json({ error: 'Failed to add team member' });
  }
});

// Remove member from team - requires admin or manager role
router.delete('/:id/members/:employeeId', authorize('admin', 'manager'), async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    const removed = await Team.removeMember(req.params.id, req.params.employeeId);
    if (!removed) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    res.json({ message: 'Team member removed successfully' });
  } catch (error) {
    console.error('Error removing team member:', error);
    res.status(500).json({ error: 'Failed to remove team member' });
  }
});

// Update member role - requires admin or manager role
router.patch('/:id/members/:employeeId/role', authorize('admin', 'manager'), async (req, res) => {
  try {
    // Verify team exists and belongs to tenant
    const team = await Team.getByIdAndTenant(req.params.id, req.tenantId);
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    if (!req.body.role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    const member = await Team.updateMemberRole(
      req.params.id,
      req.params.employeeId,
      req.body.role
    );
    if (!member) {
      return res.status(404).json({ error: 'Team member not found' });
    }
    res.json({ data: member });
  } catch (error) {
    console.error('Error updating member role:', error);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

module.exports = router;
