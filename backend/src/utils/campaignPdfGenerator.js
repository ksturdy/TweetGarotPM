const fs = require('fs');
const path = require('path');

const generateCampaignPdfHtml = (campaign, companies, weeks, team, opportunities) => {
  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const formatCurrency = (value) => {
    const num = parseFloat(value) || 0;
    return '$' + num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Load and convert logo to base64
  let logoBase64 = '';
  try {
    const logoPath = path.join(__dirname, '../../uploads/TweetGarotLogo.png');
    const logoBuffer = fs.readFileSync(logoPath);
    logoBase64 = `data:image/png;base64,${logoBuffer.toString('base64')}`;
  } catch (error) {
    console.error('Error loading logo:', error);
  }

  // Compute stats
  const totalProspects = companies.length;
  const contacted = companies.filter(c => c.status !== 'prospect').length;
  const followUp = companies.filter(c => c.status === 'follow_up').length;
  const newOpp = companies.filter(c => c.status === 'new_opp').length;
  const noInterest = companies.filter(c => c.status === 'no_interest').length;
  const dead = companies.filter(c => c.status === 'dead').length;
  const prospect = companies.filter(c => c.status === 'prospect').length;
  const totalOppValue = opportunities.reduce((sum, o) => sum + (parseFloat(o.value) || 0), 0);

  // Status labels
  const statusLabels = {
    prospect: 'Prospect',
    no_interest: 'No Interest',
    follow_up: 'Follow Up',
    new_opp: 'New Opportunity',
    dead: 'Dead'
  };

  const actionLabels = {
    none: 'None',
    follow_30: 'Follow Up 30d',
    opp_incoming: 'Opp Incoming',
    no_follow: 'No Follow Up'
  };

  const stageLabels = {
    qualification: 'Qualification',
    discovery: 'Discovery',
    proposal: 'Proposal',
    negotiation: 'Negotiation',
    closed_won: 'Closed Won',
    closed_lost: 'Closed Lost'
  };

  // Goals progress
  const targetTouchpoints = parseInt(campaign.target_touchpoints) || 0;
  const targetOpportunities = parseInt(campaign.target_opportunities) || 0;
  const targetEstimates = parseInt(campaign.target_estimates) || 0;
  const targetAwards = parseInt(campaign.target_awards) || 0;
  const targetPipelineValue = parseFloat(campaign.target_pipeline_value) || 0;

  const actualTouchpoints = contacted;
  const actualOpportunities = opportunities.length;
  const actualPipelineValue = totalOppValue;

  // Build weekly prospect counts
  const weekProspectCounts = {};
  weeks.forEach(w => {
    weekProspectCounts[w.week_number] = companies.filter(c => c.target_week === w.week_number).length;
  });

  // Team member stats
  const teamStats = team.map(member => {
    const memberCompanies = companies.filter(c =>
      c.assigned_to_name === member.name ||
      c.assigned_to_id === member.employee_id
    );
    const memberContacted = memberCompanies.filter(c => c.status !== 'prospect').length;
    return {
      name: member.name,
      role: member.role,
      assigned: memberCompanies.length,
      contacted: memberContacted,
      progress: memberCompanies.length > 0 ? Math.round((memberContacted / memberCompanies.length) * 100) : 0
    };
  });

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      margin: 0.5in;
      size: letter landscape;
    }
    * {
      box-sizing: border-box;
    }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000000;
      line-height: 1.3;
      font-size: 9pt;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 100%;
    }

    /* Header with Logo */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 15px;
      border-bottom: 2px solid #000;
      padding-bottom: 10px;
    }
    .header-left h1 {
      font-size: 18pt;
      font-weight: bold;
      margin: 0 0 5px 0;
      text-transform: uppercase;
    }
    .header-left .subtitle {
      font-size: 10pt;
      margin: 0;
    }
    .header-right {
      text-align: right;
      max-width: 150px;
    }
    .logo {
      width: 120px;
      height: auto;
      max-height: 60px;
      object-fit: contain;
    }

    /* Campaign Info */
    .campaign-info {
      margin-bottom: 15px;
      font-size: 10pt;
    }
    .campaign-info strong {
      font-weight: bold;
    }

    /* Section Title */
    .section-title {
      font-size: 11pt;
      font-weight: bold;
      text-transform: uppercase;
      margin: 20px 0 8px 0;
      padding-bottom: 4px;
      border-bottom: 1px solid #000;
    }

    /* Table Styles */
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
      font-size: 8pt;
    }
    thead {
      background-color: #000;
      color: #fff;
    }
    th {
      padding: 6px 4px;
      text-align: left;
      font-weight: bold;
      text-transform: uppercase;
      border: 1px solid #000;
      font-size: 7pt;
    }
    td {
      padding: 4px;
      border: 1px solid #ddd;
      vertical-align: top;
    }
    tbody tr:nth-child(even) {
      background-color: #f8f8f8;
    }

    /* Summary Box */
    .summary {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 10px;
      margin-bottom: 15px;
      padding: 10px;
      background-color: #f8f8f8;
      border: 1px solid #ddd;
    }
    .summary-item {
      text-align: center;
    }
    .summary-label {
      font-size: 7pt;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 4px;
    }
    .summary-value {
      font-size: 16pt;
      font-weight: bold;
      color: #000;
    }

    /* Goals Grid */
    .goals-grid {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      gap: 8px;
      margin-bottom: 15px;
    }
    .goal-item {
      border: 1px solid #ddd;
      padding: 8px;
      text-align: center;
      background: #fff;
    }
    .goal-label {
      font-size: 7pt;
      text-transform: uppercase;
      color: #666;
      margin-bottom: 4px;
    }
    .goal-actual {
      font-size: 14pt;
      font-weight: bold;
    }
    .goal-target {
      font-size: 8pt;
      color: #666;
    }
    .goal-bar {
      height: 4px;
      background: #e5e7eb;
      border-radius: 2px;
      margin-top: 4px;
    }
    .goal-bar-fill {
      height: 100%;
      background: #ea580c;
      border-radius: 2px;
    }

    /* Status Badge */
    .badge {
      display: inline-block;
      padding: 2px 6px;
      font-weight: bold;
      font-size: 7pt;
      border-radius: 2px;
    }
    .badge-prospect { background-color: #dbeafe; color: #1e40af; }
    .badge-no_interest { background-color: #fecaca; color: #991b1b; }
    .badge-follow_up { background-color: #fef3c7; color: #92400e; }
    .badge-new_opp { background-color: #d1fae5; color: #065f46; }
    .badge-dead { background-color: #e5e7eb; color: #374151; }

    /* Tier Badge */
    .tier-a { color: #ea580c; font-weight: bold; }
    .tier-b { color: #2563eb; font-weight: bold; }
    .tier-c { color: #6b7280; font-weight: bold; }

    /* Footer */
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #ddd;
      font-size: 7pt;
      color: #666;
      text-align: center;
    }

    /* Page break */
    .page-break {
      page-break-before: always;
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <h1>Sales Campaign Report</h1>
        <p class="subtitle">Tweet Garot Mechanical</p>
      </div>
      <div class="header-right">
        ${logoBase64 ? `<img src="${logoBase64}" alt="Tweet Garot Mechanical" class="logo" />` : '<div style="width: 120px; height: 60px;"></div>'}
      </div>
    </div>

    <!-- Campaign Info -->
    <div class="campaign-info">
      <strong>Campaign:</strong> ${campaign.name || ''} |
      <strong>Status:</strong> ${(campaign.status || '').charAt(0).toUpperCase() + (campaign.status || '').slice(1)} |
      <strong>Owner:</strong> ${campaign.owner_name || 'N/A'} |
      <strong>Period:</strong> ${formatDate(campaign.start_date)} - ${formatDate(campaign.end_date)} |
      <strong>Report Date:</strong> ${formatDate(new Date().toISOString())}
    </div>

    <!-- Executive Summary -->
    <div class="section-title">Executive Summary</div>
    <div class="summary">
      <div class="summary-item">
        <div class="summary-label">Total Prospects</div>
        <div class="summary-value">${totalProspects}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Contacted</div>
        <div class="summary-value">${contacted}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Opportunities</div>
        <div class="summary-value">${opportunities.length}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Pipeline Value</div>
        <div class="summary-value" style="font-size: 13pt;">${formatCurrency(totalOppValue)}</div>
      </div>
      <div class="summary-item">
        <div class="summary-label">Follow Up Needed</div>
        <div class="summary-value" style="color: #ea580c;">${followUp}</div>
      </div>
    </div>

    <!-- Status Breakdown -->
    <div class="section-title">Status Breakdown</div>
    <table>
      <thead>
        <tr>
          <th>Status</th>
          <th>Count</th>
          <th>% of Total</th>
        </tr>
      </thead>
      <tbody>
        <tr><td><span class="badge badge-prospect">Prospect</span></td><td>${prospect}</td><td>${totalProspects > 0 ? Math.round((prospect / totalProspects) * 100) : 0}%</td></tr>
        <tr><td><span class="badge badge-follow_up">Follow Up</span></td><td>${followUp}</td><td>${totalProspects > 0 ? Math.round((followUp / totalProspects) * 100) : 0}%</td></tr>
        <tr><td><span class="badge badge-new_opp">New Opportunity</span></td><td>${newOpp}</td><td>${totalProspects > 0 ? Math.round((newOpp / totalProspects) * 100) : 0}%</td></tr>
        <tr><td><span class="badge badge-no_interest">No Interest</span></td><td>${noInterest}</td><td>${totalProspects > 0 ? Math.round((noInterest / totalProspects) * 100) : 0}%</td></tr>
        <tr><td><span class="badge badge-dead">Dead</span></td><td>${dead}</td><td>${totalProspects > 0 ? Math.round((dead / totalProspects) * 100) : 0}%</td></tr>
      </tbody>
    </table>

    ${targetTouchpoints > 0 || targetOpportunities > 0 || targetPipelineValue > 0 ? `
    <!-- Goals Progress -->
    <div class="section-title">Goals Progress</div>
    <div class="goals-grid">
      ${targetTouchpoints > 0 ? `
      <div class="goal-item">
        <div class="goal-label">Touchpoints</div>
        <div class="goal-actual">${actualTouchpoints}</div>
        <div class="goal-target">of ${targetTouchpoints} target</div>
        <div class="goal-bar"><div class="goal-bar-fill" style="width: ${Math.min(100, Math.round((actualTouchpoints / targetTouchpoints) * 100))}%"></div></div>
      </div>` : ''}
      ${targetOpportunities > 0 ? `
      <div class="goal-item">
        <div class="goal-label">Opportunities</div>
        <div class="goal-actual">${actualOpportunities}</div>
        <div class="goal-target">of ${targetOpportunities} target</div>
        <div class="goal-bar"><div class="goal-bar-fill" style="width: ${Math.min(100, Math.round((actualOpportunities / targetOpportunities) * 100))}%"></div></div>
      </div>` : ''}
      ${targetEstimates > 0 ? `
      <div class="goal-item">
        <div class="goal-label">Estimates</div>
        <div class="goal-actual">0</div>
        <div class="goal-target">of ${targetEstimates} target</div>
        <div class="goal-bar"><div class="goal-bar-fill" style="width: 0%"></div></div>
      </div>` : ''}
      ${targetAwards > 0 ? `
      <div class="goal-item">
        <div class="goal-label">Awards</div>
        <div class="goal-actual">0</div>
        <div class="goal-target">of ${targetAwards} target</div>
        <div class="goal-bar"><div class="goal-bar-fill" style="width: 0%"></div></div>
      </div>` : ''}
      ${targetPipelineValue > 0 ? `
      <div class="goal-item">
        <div class="goal-label">Pipeline Value</div>
        <div class="goal-actual" style="font-size: 11pt;">${formatCurrency(actualPipelineValue)}</div>
        <div class="goal-target">of ${formatCurrency(targetPipelineValue)} target</div>
        <div class="goal-bar"><div class="goal-bar-fill" style="width: ${Math.min(100, Math.round((actualPipelineValue / targetPipelineValue) * 100))}%"></div></div>
      </div>` : ''}
    </div>
    ${campaign.goal_description ? `<p style="font-size: 8pt; color: #666; margin-top: -10px; margin-bottom: 15px;"><strong>Goal:</strong> ${campaign.goal_description}</p>` : ''}
    ` : ''}

    <!-- Team Performance -->
    ${team.length > 0 ? `
    <div class="section-title">Team Performance</div>
    <table>
      <thead>
        <tr>
          <th>Team Member</th>
          <th>Role</th>
          <th>Assigned</th>
          <th>Contacted</th>
          <th>Progress</th>
        </tr>
      </thead>
      <tbody>
        ${teamStats.map(m => `
          <tr>
            <td style="font-weight: bold;">${m.name}</td>
            <td>${m.role === 'owner' ? 'Owner' : m.role === 'member' ? 'Member' : 'Viewer'}</td>
            <td>${m.assigned}</td>
            <td>${m.contacted}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 6px;">
                <div style="flex: 1; height: 6px; background: #e5e7eb; border-radius: 3px;">
                  <div style="height: 100%; width: ${m.progress}%; background: #ea580c; border-radius: 3px;"></div>
                </div>
                <span style="font-size: 7pt; font-weight: bold;">${m.progress}%</span>
              </div>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    <!-- Weekly Schedule Overview -->
    ${weeks.length > 0 ? `
    <div class="section-title">Weekly Schedule Overview</div>
    <table>
      <thead>
        <tr>
          <th>Week</th>
          <th>Date Range</th>
          <th>Total</th>
          ${team.map(m => `<th>${m.name.split(' ')[0]}</th>`).join('')}
        </tr>
      </thead>
      <tbody>
        ${weeks.map(w => {
          const weekCompanies = companies.filter(c => c.target_week === w.week_number);
          return `
            <tr>
              <td style="font-weight: bold;">Week ${w.week_number}</td>
              <td>${formatDate(w.start_date)} - ${formatDate(w.end_date)}</td>
              <td style="font-weight: bold;">${weekCompanies.length}</td>
              ${team.map(m => {
                const memberWeekCount = weekCompanies.filter(c =>
                  c.assigned_to_name === m.name || c.assigned_to_id === m.employee_id
                ).length;
                return `<td>${memberWeekCount}</td>`;
              }).join('')}
            </tr>
          `;
        }).join('')}
        <tr style="font-weight: bold; border-top: 2px solid #000;">
          <td colspan="2">TOTAL</td>
          <td>${companies.length}</td>
          ${team.map(m => {
            const total = companies.filter(c =>
              c.assigned_to_name === m.name || c.assigned_to_id === m.employee_id
            ).length;
            return `<td>${total}</td>`;
          }).join('')}
        </tr>
      </tbody>
    </table>

    <!-- Weekly Goals by Salesperson -->
    <div class="section-title">Weekly Goals by Salesperson</div>
    ${team.map(m => {
      const memberCompanies = companies.filter(c =>
        c.assigned_to_name === m.name || c.assigned_to_id === m.employee_id
      );
      if (memberCompanies.length === 0) return '';
      return `
      <div style="margin-bottom: 12px;">
        <div style="font-size: 9pt; font-weight: bold; margin-bottom: 4px; padding: 4px 8px; background: #f3f4f6; border-left: 3px solid #ea580c;">
          ${m.name} (${m.role === 'owner' ? 'Owner' : 'Member'}) - ${memberCompanies.length} Prospects
        </div>
        <table>
          <thead>
            <tr>
              <th style="width: 5%;">Wk</th>
              <th style="width: 25%;">Company</th>
              <th style="width: 15%;">Sector</th>
              <th style="width: 5%;">Tier</th>
              <th style="width: 10%;">Status</th>
              <th style="width: 10%;">Next Action</th>
              <th style="width: 15%;">Phone</th>
              <th style="width: 15%;">Address</th>
            </tr>
          </thead>
          <tbody>
            ${weeks.map(w => {
              const weekMemCompanies = memberCompanies.filter(c => c.target_week === w.week_number);
              if (weekMemCompanies.length === 0) return '';
              return weekMemCompanies.map((c, idx) => `
                <tr>
                  ${idx === 0 ? `<td rowspan="${weekMemCompanies.length}" style="font-weight: bold; vertical-align: middle; text-align: center; background: #f8f8f8;">${w.week_number}</td>` : ''}
                  <td style="font-weight: bold;">${c.name || ''}</td>
                  <td>${c.sector || '-'}</td>
                  <td class="tier-${(c.tier || 'c').toLowerCase()}">${c.tier || '-'}</td>
                  <td><span class="badge badge-${c.status}">${statusLabels[c.status] || c.status}</span></td>
                  <td>${actionLabels[c.next_action] || c.next_action || '-'}</td>
                  <td style="font-size: 7pt;">${c.phone || '-'}</td>
                  <td style="font-size: 7pt;">${c.address || '-'}</td>
                </tr>
              `).join('');
            }).join('')}
          </tbody>
        </table>
      </div>`;
    }).join('')}
    ` : ''}

    <!-- Full Prospect List -->
    <div class="page-break"></div>
    <div class="section-title">Full Prospect List (${companies.length})</div>
    <table>
      <thead>
        <tr>
          <th style="width: 18%;">Company</th>
          <th style="width: 12%;">Sector</th>
          <th style="width: 5%;">Tier</th>
          <th style="width: 4%;">Score</th>
          <th style="width: 12%;">Assigned To</th>
          <th style="width: 5%;">Week</th>
          <th style="width: 10%;">Status</th>
          <th style="width: 10%;">Next Action</th>
          <th style="width: 12%;">Phone</th>
          <th style="width: 12%;">Address</th>
        </tr>
      </thead>
      <tbody>
        ${companies.map(c => `
          <tr>
            <td style="font-weight: bold;">${c.name || ''}</td>
            <td>${c.sector || '-'}</td>
            <td class="tier-${(c.tier || 'c').toLowerCase()}">${c.tier || '-'}</td>
            <td>${c.score || '-'}</td>
            <td>${c.assigned_to_name || '-'}</td>
            <td>${c.target_week || '-'}</td>
            <td><span class="badge badge-${c.status}">${statusLabels[c.status] || c.status}</span></td>
            <td>${actionLabels[c.next_action] || c.next_action || '-'}</td>
            <td style="font-size: 7pt;">${c.phone || '-'}</td>
            <td style="font-size: 7pt;">${c.address || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <!-- Opportunities -->
    ${opportunities.length > 0 ? `
    <div class="section-title">Opportunities (${opportunities.length})</div>
    <table>
      <thead>
        <tr>
          <th style="width: 20%;">Opportunity</th>
          <th style="width: 18%;">Company</th>
          <th style="width: 12%;">Value</th>
          <th style="width: 12%;">Stage</th>
          <th style="width: 8%;">Probability</th>
          <th style="width: 12%;">Close Date</th>
          <th style="width: 18%;">Description</th>
        </tr>
      </thead>
      <tbody>
        ${opportunities.map(o => `
          <tr>
            <td style="font-weight: bold;">${o.name || ''}</td>
            <td>${o.company_name || '-'}</td>
            <td>${formatCurrency(o.value)}</td>
            <td>${stageLabels[o.stage] || o.stage || '-'}</td>
            <td>${o.probability || 0}%</td>
            <td>${o.close_date ? formatDate(o.close_date) : '-'}</td>
            <td style="font-size: 7pt;">${o.description || '-'}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
    ` : ''}

    <!-- Footer -->
    <div class="footer">
      <div>Tweet Garot Mechanical | ${campaign.name} - Sales Campaign Report</div>
      <div style="margin-top: 4px;">Generated on ${formatDate(new Date().toISOString())} at ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</div>
    </div>
  </div>
</body>
</html>
  `;
};

module.exports = { generateCampaignPdfHtml };
