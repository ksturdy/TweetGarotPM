const ScheduledReport = require('../models/ScheduledReport');
const { sendEmail } = require('../utils/emailService');

// Report type → data + PDF generation mapping
const REPORT_HANDLERS = {
  async executive_report(report) {
    const { buildReportData } = require('../routes/executiveReport');
    const { generateExecutiveReportPdfBuffer } = require('../utils/executiveReportPdfBuffer');

    const snapshotDate = report.filters?.snapshotDate || null;
    const reportData = await buildReportData(report.tenant_id, snapshotDate);
    const pdfBuffer = await generateExecutiveReportPdfBuffer(reportData);
    const dateStr = reportData.reportDate || new Date().toISOString().split('T')[0];

    return {
      pdfBuffer,
      filename: `Executive-Report-${dateStr}.pdf`,
      subject: `Executive Report - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      body: `Please find attached the Executive Report.\n\nThis report includes Top 10 rankings across key financial categories including contract value, gross profit, margin performance, cash flow, backlog, and more.`,
    };
  },

  async backlog_fit(report) {
    const { buildReportData } = require('../routes/backlogReport');
    const { generateBacklogReportPdfBuffer } = require('../utils/backlogReportPdfBuffer');

    const { reportData, recommendations } = await buildReportData(report.tenant_id);
    const pdfBuffer = await generateBacklogReportPdfBuffer(reportData, recommendations, 'Automated Report');
    const dateStr = new Date().toISOString().split('T')[0];

    return {
      pdfBuffer,
      filename: `Backlog-Fit-Report-${dateStr}.pdf`,
      subject: `Backlog Fit Analysis Report - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      body: `Please find attached the Backlog Fit Analysis Report.\n\nThis report analyzes capacity gaps across four scenarios (All States 12/18 months, Wisconsin 12/18 months) in both revenue and labor modes, and includes strategic opportunity targeting recommendations.`,
    };
  },

  async buyout_metric(report) {
    const { buildBuyoutMetricData } = require('../routes/buyoutMetricReport');
    const { generateBuyoutMetricReportPdfBuffer } = require('../utils/buyoutMetricReportPdfBuffer');

    const filters = report.filters || {};
    // Resolve team name for display on cover page
    if (filters.team) {
      const Team = require('../models/Team');
      const team = await Team.getByIdAndTenant(Number(filters.team), report.tenant_id);
      if (team) filters.teamName = team.name;
    }
    const rows = await buildBuyoutMetricData(report.tenant_id, filters);
    // Sort by most buyout remaining first (descending)
    rows.sort((a, b) => (b.buyout_remaining || 0) - (a.buyout_remaining || 0));
    const pdfBuffer = await generateBuyoutMetricReportPdfBuffer(rows, filters);
    const dateStr = new Date().toISOString().split('T')[0];

    return {
      pdfBuffer,
      filename: `Buyout-Metric-Report-${dateStr}.pdf`,
      subject: `Buyout Metric Report - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      body: `Please find attached the Buyout Metric Report covering ${rows.length} project${rows.length !== 1 ? 's' : ''}.`,
    };
  },

  async campaign(report) {
    const campaignId = report.filters?.campaign_id;
    if (!campaignId) {
      throw new Error('No campaign selected for this scheduled report');
    }

    const campaigns = require('../models/campaigns');
    const campaignCompanies = require('../models/campaignCompanies');
    const campaignOpportunities = require('../models/campaignOpportunities');
    const db = require('../config/database');
    const { generateCampaignPdfHtml } = require('../utils/campaignPdfGenerator');
    const { fetchLogoBase64 } = require('../utils/logoFetcher');
    const { launchBrowser } = require('../utils/launchBrowser');

    const campaign = await campaigns.getByIdAndTenant(campaignId, report.tenant_id);
    if (!campaign) {
      throw new Error(`Campaign ${campaignId} not found`);
    }

    const [companiesList, weeksList, teamList, campaignOppsList, mainOppsResult, scoreBreakdownResult] = await Promise.all([
      campaignCompanies.getByCampaignId(campaignId, {}, report.tenant_id),
      campaigns.getWeeks(campaignId),
      campaigns.getTeamMembers(campaignId),
      campaignOpportunities.getByCampaignId(campaignId),
      db.query(`
        SELECT o.*, ps.name as stage_name, u.first_name || ' ' || u.last_name as assigned_to_name
        FROM opportunities o
        LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
        LEFT JOIN users u ON o.assigned_to = u.id
        WHERE o.campaign_id = $1
        ORDER BY o.estimated_value DESC
      `, [campaignId]),
      db.query(`
        SELECT
          CASE
            WHEN c.customer_score >= 85 THEN 'A'
            WHEN c.customer_score >= 70 THEN 'B'
            WHEN c.customer_score >= 50 THEN 'C'
            WHEN c.customer_score IS NOT NULL AND c.customer_score < 50 THEN 'D'
            ELSE 'Unscored'
          END as tier,
          COUNT(*) as count,
          COALESCE(SUM(o.estimated_value), 0) as total_value
        FROM opportunities o
        LEFT JOIN customers c ON o.customer_id = c.id
        WHERE o.tenant_id = $1 AND o.campaign_id = $2
        GROUP BY tier
        ORDER BY tier
      `, [report.tenant_id, campaignId])
    ]);

    // Derive team from company assignments if empty
    let effectiveTeam = teamList;
    if (teamList.length === 0 && companiesList.length > 0) {
      const memberMap = {};
      companiesList.forEach(c => {
        if (c.assigned_to_name && c.assigned_to_id) {
          if (!memberMap[c.assigned_to_id]) {
            memberMap[c.assigned_to_id] = {
              employee_id: c.assigned_to_id,
              name: c.assigned_to_name,
              role: c.assigned_to_id === campaign.owner_id ? 'owner' : 'member'
            };
          }
        }
      });
      effectiveTeam = Object.values(memberMap);
    }

    // Merge opportunities
    const mainOpps = mainOppsResult.rows.map(o => ({
      name: o.title,
      company_name: o.client_company || '',
      value: o.estimated_value,
      stage: o.stage_name || '',
      probability: o.probability || '',
      close_date: o.estimated_start_date,
      description: o.description
    }));
    const opportunitiesList = [...campaignOppsList, ...mainOpps];

    // Enrich statuses
    const campOppCompanyIds = new Set(campaignOppsList.map(o => o.campaign_company_id));
    const mainOppCompanyNames = new Set(
      mainOpps.map(o => (o.company_name || '').toLowerCase().trim()).filter(Boolean)
    );
    companiesList.forEach(c => {
      if (c.status !== 'new_opp' && c.status !== 'no_interest' && c.status !== 'dead') {
        if (campOppCompanyIds.has(c.id) || mainOppCompanyNames.has((c.name || '').toLowerCase().trim())) {
          c.status = 'new_opp';
        }
      }
    });

    const logoBase64 = await fetchLogoBase64(report.tenant_id);
    const html = generateCampaignPdfHtml(campaign, companiesList, weeksList, effectiveTeam, opportunitiesList, logoBase64, scoreBreakdownResult.rows);

    let browser = null;
    try {
      browser = await launchBrowser();
      const page = await browser.newPage();
      await page.setViewport({ width: 1056, height: 816 });
      await page.setContent(html, { waitUntil: ['load', 'domcontentloaded'], timeout: 30000 });
      await page.evaluate(() => new Promise(resolve => setTimeout(resolve, 500)));
      const pdfBuffer = await page.pdf({
        format: 'Letter',
        landscape: true,
        printBackground: true,
        margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' },
      });
      await browser.close();
      browser = null;

      const safeName = (campaign.name || 'Campaign').replace(/[^a-zA-Z0-9]/g, '_');
      const dateStr = new Date().toISOString().split('T')[0];

      return {
        pdfBuffer: Buffer.from(pdfBuffer),
        filename: `${safeName}_Report-${dateStr}.pdf`,
        subject: `Campaign Report: ${campaign.name} - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
        body: `Please find attached the Campaign Report for "${campaign.name}".\n\nThis report includes executive summary, status breakdown, team performance, and prospect details.`,
      };
    } catch (err) {
      if (browser) {
        try { await browser.close(); } catch (e) { /* ignore */ }
      }
      throw err;
    }
  },

  async cash_flow(report) {
    const { buildCashFlowData, buildCashFlowMetrics } = require('../routes/cashFlowReport');
    const { generateCashFlowReportPdfBuffer } = require('../utils/cashFlowReportPdfBuffer');

    const filters = report.filters || {};
    // Resolve team name for display on cover page
    if (filters.team) {
      const Team = require('../models/Team');
      const team = await Team.getByIdAndTenant(Number(filters.team), report.tenant_id);
      if (team) filters.teamName = team.name;
    }
    const rows = await buildCashFlowData(report.tenant_id, filters);
    const metrics = await buildCashFlowMetrics(report.tenant_id);
    // Sort by worst cash flow first (ascending)
    rows.sort((a, b) => (Number(a.cash_flow) || 0) - (Number(b.cash_flow) || 0));
    const pdfBuffer = await generateCashFlowReportPdfBuffer(rows, filters, report.name, metrics);
    const dateStr = new Date().toISOString().split('T')[0];

    return {
      pdfBuffer,
      filename: `Cash-Flow-Report-${dateStr}.pdf`,
      subject: `Cash Flow Report - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      body: `Please find attached the Cash Flow Report covering ${rows.length} project${rows.length !== 1 ? 's' : ''}.`,
    };
  },

  async weekly_sales(report) {
    const { buildWeeklySalesData, generateWeeklySalesPdfBuffer, getCurrentMonday } =
      require('../routes/weeklySalesReport');

    const weekStart = getCurrentMonday();
    const data = await buildWeeklySalesData(report.tenant_id, weekStart);
    const pdfBuffer = await generateWeeklySalesPdfBuffer(data, report.tenant_id);

    const fmtRange = `${data.week_start} to ${data.week_end}`;
    const t = data.totals || {};

    return {
      pdfBuffer,
      filename: `Weekly-Sales-Report-${weekStart}.pdf`,
      subject: `Weekly Sales Report - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      body: `Please find attached the Weekly Sales Report for ${fmtRange}.\n\nHighlights: ${t.new_opp_count || 0} new opportunities, ${t.won_count || 0} won, ${t.lost_count || 0} lost.`,
    };
  },

  async opportunity_search(report) {
    const RecurringSearches = require('../models/RecurringSearches');
    const { generateOpportunitySearchPdfBuffer } = require('../utils/opportunitySearchPdfBuffer');
    const Anthropic = require('@anthropic-ai/sdk');

    const recurringSearchId = report.filters?.recurring_search_id;

    if (!recurringSearchId) {
      throw new Error('No recurring search selected for this scheduled report');
    }

    const recurringSearch = await RecurringSearches.findById(recurringSearchId, report.tenant_id);
    if (!recurringSearch) {
      throw new Error(`Recurring search ${recurringSearchId} not found`);
    }

    if (!recurringSearch.is_active) {
      throw new Error(`Recurring search "${recurringSearch.name}" is not active`);
    }

    let searchData = {
      name: recurringSearch.name,
      criteria: recurringSearch.criteria,
      results: [],
      lead_count: 0,
      total_estimated_value: 0,
    };

    // Always re-run the search with fresh results for recurring searches
    console.log(`[Scheduled Reports] Running recurring opportunity search "${recurringSearch.name}"`);

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    // Reuse the shared prompt/message builders and normalizers from the main search route
    const { SYSTEM_PROMPT, buildUserMessage, normalizeProject, classifyLead } = require('../routes/opportunitySearch');
    const criteria = recurringSearch.criteria;
    const userMessage = buildUserMessage(criteria);

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 16000,
          system: SYSTEM_PROMPT,
          tools: [{ type: 'web_search_20250305', name: 'web_search' }],
          messages: [{ role: 'user', content: userMessage }]
        });

        // Extract and parse results (simplified version of route logic)
        let responseText = '';
        for (const block of response.content) {
          if (block.type === 'text') responseText += block.text;
        }

        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const leadsJson = JSON.parse(jsonMatch[0]);
          const rawProjects = leadsJson.projects || leadsJson.leads || leadsJson.results || [];

          // Use the same normalization/classification as the main search route
          const normalizedLeads = rawProjects.map(normalizeProject);
          const classifiedLeads = normalizedLeads.map(classifyLead);
          const totalEstValue = classifiedLeads.reduce((sum, l) => sum + (l.estimated_value || 0), 0);

          searchData = {
            ...searchData,
            results: classifiedLeads,
            lead_count: classifiedLeads.length,
            total_estimated_value: totalEstValue,
            name: `${recurringSearch.name} (${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
          };

          console.log(`[Scheduled Reports] Fresh search found ${rawProjects.length} projects`);
        } else {
          console.warn('[Scheduled Reports] Could not parse AI response');
        }
      } catch (err) {
        console.error('[Scheduled Reports] Failed to run search:', err.message);
        throw err; // Re-throw since we don't have fallback results for recurring searches
      }

    // Update last run stats and save results
    await RecurringSearches.updateLastRun(
      recurringSearch.id,
      searchData.lead_count,
      searchData.total_estimated_value,
      searchData.results,
      report.tenant_id
    );

    // Use default domain (custom_domain column may not exist yet)
    const tenantDomain = 'app.titanpm.com';

    const pdfBuffer = await generateOpportunitySearchPdfBuffer(searchData, tenantDomain);
    const dateStr = new Date().toISOString().split('T')[0];
    const safeName = (recurringSearch.name || 'Opportunity-Search').replace(/[^a-zA-Z0-9]/g, '_');

    const leadCount = searchData.lead_count || 0;
    const totalValue = searchData.total_estimated_value || 0;
    const fmtValue = totalValue >= 1e6
      ? `$${(totalValue / 1e6).toFixed(1)}M`
      : totalValue >= 1e3
      ? `$${(totalValue / 1e3).toFixed(0)}K`
      : `$${totalValue.toLocaleString()}`;

    return {
      pdfBuffer,
      filename: `${safeName}-${dateStr}.pdf`,
      subject: `Opportunity Search Report: ${recurringSearch.name} - ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
      body: `Please find attached the Opportunity Search Report for "${recurringSearch.name}".\n\nThis search found ${leadCount} project${leadCount !== 1 ? 's' : ''} with a total estimated value of ${fmtValue}.\n\nClick the link in the PDF to view full details and convert opportunities in Titan.`,
    };
  },
};

/**
 * Execute a single scheduled report: generate PDF and email to all recipients.
 * @param {Object} report - Row from scheduled_reports with recipients joined
 * @returns {Object} - Result summary
 */
async function executeScheduledReport(report) {
  const handler = REPORT_HANDLERS[report.report_type];
  if (!handler) {
    throw new Error(`Unknown report type: ${report.report_type}`);
  }

  const recipients = report.recipients || [];
  const teamRecipients = report.team_recipients || [];

  if (recipients.length === 0 && teamRecipients.length === 0) {
    throw new Error('No recipients configured for this scheduled report');
  }

  // Generate the report PDF
  const { pdfBuffer, filename, subject, body } = await handler(report);

  // Collect recipient emails from direct users
  const emailSet = new Set(recipients.map(r => r.email).filter(Boolean));

  // Resolve team members to emails
  if (teamRecipients.length > 0) {
    const Team = require('../models/Team');
    for (const tr of teamRecipients) {
      const members = await Team.getMembers(tr.team_id, report.tenant_id);
      for (const m of members) {
        if (m.email) emailSet.add(m.email);
      }
    }
  }

  const toAddresses = [...emailSet];
  if (toAddresses.length === 0) {
    throw new Error('No valid email addresses found for recipients');
  }

  // Send a single email to all recipients
  const result = await sendEmail({
    to: toAddresses.join(', '),
    subject: `${subject}${report.name ? ` (${report.name})` : ''}`,
    text: `${body}\n\nThis is an automated report from TITAN Project Management.\nSchedule: "${report.name}"`,
    html: generateEmailHtml(body, report.name),
    attachments: [
      {
        filename,
        content: pdfBuffer,
        contentType: 'application/pdf',
      },
    ],
  });

  return {
    reportId: report.id,
    reportName: report.name,
    recipientCount: toAddresses.length,
    emailResult: result,
  };
}

/**
 * Generate a simple HTML email body for the scheduled report.
 */
function generateEmailHtml(bodyText, scheduleName) {
  const lines = bodyText.split('\n').map(l => `<p style="margin: 0 0 8px;">${l}</p>`).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #002356, #004080); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 22px; letter-spacing: 0.05em;">TITAN</h1>
    <p style="margin: 5px 0 0; opacity: 0.9; font-size: 14px;">Automated Report Delivery</p>
  </div>
  <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none;">
    ${lines}
    <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid #e5e7eb;">
      <p style="font-size: 12px; color: #6b7280; margin: 0;">
        This is an automated report from TITAN Project Management.<br>
        Schedule: "${scheduleName || 'Unnamed'}"
      </p>
    </div>
  </div>
  <div style="background: #f3f4f6; padding: 12px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; text-align: center;">
    <p style="font-size: 11px; color: #9ca3af; margin: 0;">TITAN Project Management</p>
  </div>
</body>
</html>`;
}

/**
 * Main cron runner: find all due reports and execute them.
 */
async function runScheduledReports() {
  const dueReports = await ScheduledReport.findDueReports();

  if (dueReports.length === 0) return;

  console.log(`[Scheduled Reports] Found ${dueReports.length} due report(s) to send...`);

  let sent = 0;
  let failed = 0;

  for (const report of dueReports) {
    try {
      console.log(`[Scheduled Reports] Processing "${report.name}" (${report.report_type}) for tenant ${report.tenant_id}...`);
      await executeScheduledReport(report);
      await ScheduledReport.markRun(report.id);
      sent++;
      console.log(`[Scheduled Reports] Sent "${report.name}" to ${report.recipients.length} recipient(s)`);
    } catch (err) {
      failed++;
      console.error(`[Scheduled Reports] Failed to send "${report.name}":`, err.message);
    }
  }

  console.log(`[Scheduled Reports] Complete: ${sent} sent, ${failed} failed`);
}

module.exports = { runScheduledReports, executeScheduledReport };
