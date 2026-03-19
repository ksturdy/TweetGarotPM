/**
 * Generate HTML for Backlog Fit Analysis PDF Report.
 * Landscape Letter, multi-page layout: cover + 4 variants (revenue + labor each) + strategy.
 */

const { fmtCurrency, fmtHeadcount, parseNum, REGIONS, pursuitRules: defaultPursuitRules, workDurationRules: defaultWorkDurationRules } = require('./backlogFitCalculator');

// ─── Formatting Helpers ───

const fmtCompact = (value) => {
  if (value === null || value === undefined || value === 0 || isNaN(value)) return '-';
  if (Math.abs(value) >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
  if (Math.abs(value) >= 1000) return `$${(value / 1000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
};

const fmtHoursCompact = (value) => {
  if (value === 0 || isNaN(value)) return '-';
  if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`;
  return value.toFixed(0);
};

const fmtHC = (hours, hpp) => {
  if (hours === 0 || isNaN(hours)) return '-';
  const hc = hours / hpp;
  if (hc < 0.1) return '-';
  return hc.toFixed(1);
};

const getFitColor = (score) => {
  if (score >= 60) return '#16a34a';
  if (score >= 30) return '#ca8a04';
  return '#dc2626';
};

const getFitBg = (score) => {
  if (score >= 60) return '#dcfce7';
  if (score >= 30) return '#fef9c3';
  return '#fee2e2';
};

// ─── Cover Page ───

function buildCoverPage(settings, generatedBy, hasRegional) {
  const today = new Date();
  const dateLabel = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `
    <div class="page cover-page">
      <div style="text-align: center; padding-top: 80px;">
        <div style="font-size: 28pt; font-weight: 700; color: #002356; letter-spacing: 0.05em;">TITAN</div>
        <div style="font-size: 10pt; color: #6b7280; margin-top: 4px; letter-spacing: 0.15em; text-transform: uppercase;">Tweet Garot Mechanical</div>
        <div style="width: 80px; height: 3px; background: #F37B03; margin: 20px auto;"></div>
        <div style="font-size: 18pt; font-weight: 700; color: #1f2937; margin-top: 16px;">Backlog Fit Analysis Report</div>
        <div style="font-size: 10pt; color: #6b7280; margin-top: 8px;">${dateLabel}</div>
        ${generatedBy ? `<div style="font-size: 9pt; color: #94a3b8; margin-top: 4px;">Prepared by ${generatedBy}</div>` : ''}
      </div>

      <div style="margin: 40px auto 0; max-width: 600px;">
        <div style="font-size: 9pt; font-weight: 700; color: #002356; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Report Settings</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8pt;">
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 5px 8px; color: #6b7280; width: 200px;">Monthly Revenue Target</td>
            <td style="padding: 5px 8px; font-weight: 600; color: #1f2937;">${fmtCompact(settings.capacityTarget)}/month</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 5px 8px; color: #6b7280;">Labor Headcount Target</td>
            <td style="padding: 5px 8px; font-weight: 600; color: #1f2937;">${settings.laborCapacityTarget} people</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 5px 8px; color: #6b7280;">Labor % of Value</td>
            <td style="padding: 5px 8px; font-weight: 600; color: #1f2937;">${settings.laborPctOfValue}%</td>
          </tr>
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 5px 8px; color: #6b7280;">Avg Labor Rate</td>
            <td style="padding: 5px 8px; font-weight: 600; color: #1f2937;">$${settings.avgLaborRate}/hr</td>
          </tr>
          <tr>
            <td style="padding: 5px 8px; color: #6b7280;">Hours/Person/Month</td>
            <td style="padding: 5px 8px; font-weight: 600; color: #1f2937;">${settings.hoursPerPersonPerMonth}</td>
          </tr>
        </table>
      </div>

      ${hasRegional ? `
      <div style="margin: 16px auto 0; max-width: 600px;">
        <div style="font-size: 9pt; font-weight: 700; color: #002356; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Regional Targets</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8pt;">
          <tr style="border-bottom: 2px solid #e5e7eb; background: #f8fafc;">
            <th style="padding: 4px 8px; text-align: left; color: #6b7280;">Region</th>
            <th style="padding: 4px 8px; text-align: right; color: #6b7280;">Revenue/mo</th>
            <th style="padding: 4px 8px; text-align: right; color: #6b7280;">Labor (people)</th>
          </tr>
          ${REGIONS.map(r => {
            const rt = settings.regionTargets?.[r.prefix];
            const revT = rt?.revenueTarget || Math.round(settings.capacityTarget / REGIONS.length);
            const labT = rt?.laborTarget || Math.round(settings.laborCapacityTarget / REGIONS.length);
            return `
          <tr style="border-bottom: 1px solid #e5e7eb;">
            <td style="padding: 4px 8px; color: #1f2937;"><span style="display: inline-block; width: 8px; height: 8px; background: ${r.color}; border-radius: 2px; vertical-align: middle; margin-right: 4px;"></span>${r.label}</td>
            <td style="padding: 4px 8px; text-align: right; font-weight: 600; color: #1f2937;">${fmtCompact(revT)}</td>
            <td style="padding: 4px 8px; text-align: right; font-weight: 600; color: #1f2937;">${labT}</td>
          </tr>`;
          }).join('')}
        </table>
      </div>` : ''}

      <div style="margin: ${hasRegional ? '16' : '30'}px auto 0; max-width: 600px;">
        <div style="font-size: 9pt; font-weight: 700; color: #002356; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 0.05em;">Report Contents</div>
        <table style="width: 100%; border-collapse: collapse; font-size: 8pt;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 4px 8px; color: #6b7280;">1.</td>
            <td style="padding: 4px 8px; color: #1f2937;">All States \u2014 12-Month Revenue &amp; Labor Analysis</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 4px 8px; color: #6b7280;">2.</td>
            <td style="padding: 4px 8px; color: #1f2937;">All States \u2014 18-Month Revenue &amp; Labor Analysis</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 4px 8px; color: #6b7280;">3.</td>
            <td style="padding: 4px 8px; color: #1f2937;">Wisconsin \u2014 12-Month Revenue &amp; Labor Analysis</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 4px 8px; color: #6b7280;">4.</td>
            <td style="padding: 4px 8px; color: #1f2937;">Wisconsin \u2014 18-Month Revenue &amp; Labor Analysis</td>
          </tr>
          ${hasRegional ? `
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 4px 8px; color: #6b7280;">5.</td>
            <td style="padding: 4px 8px; color: #1f2937;">Regional Comparison \u2014 12 Months</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 4px 8px; color: #6b7280;">6.</td>
            <td style="padding: 4px 8px; color: #1f2937;">Regional Comparison \u2014 18 Months</td>
          </tr>
          <tr>
            <td style="padding: 4px 8px; color: #6b7280;">7.</td>
            <td style="padding: 4px 8px; color: #1f2937;">Strategy &amp; Recommendations</td>
          </tr>` : `
          <tr>
            <td style="padding: 4px 8px; color: #6b7280;">5.</td>
            <td style="padding: 4px 8px; color: #1f2937;">Strategy &amp; Recommendations</td>
          </tr>`}
        </table>
      </div>
    </div>`;
}

// ─── Bar Chart (pure HTML/CSS) ───

function buildBarChart(monthKeys, projectMonthly, oppMonthly, target, mode, settings) {
  const hpp = settings.hoursPerPersonPerMonth;
  const isRevenue = mode === 'revenue';

  // Collect values and find max for scaling
  const data = monthKeys.map(m => {
    const proj = projectMonthly.get(m.key) || 0;
    const opp = oppMonthly.get(m.key) || 0;
    return { label: m.label, proj, opp, total: proj + opp };
  });

  const maxVal = Math.max(target, ...data.map(d => d.total)) || 1;
  const chartHeight = 110;
  const targetPct = (target / maxVal) * 100;

  const bars = data.map(d => {
    const projPct = (d.proj / maxVal) * chartHeight;
    const oppPct = (d.opp / maxVal) * chartHeight;
    return `
      <div style="flex: 1; display: flex; flex-direction: column; align-items: center; min-width: 0;">
        <div style="width: 100%; height: ${chartHeight}px; display: flex; flex-direction: column-reverse; align-items: center; position: relative;">
          <div style="width: 70%; height: ${projPct}px; background: rgba(59,130,246,0.7); border-radius: 1px 1px 0 0; flex-shrink: 0;"></div>
          <div style="width: 70%; height: ${oppPct}px; background: rgba(34,197,94,0.25); border: 1px dashed rgba(34,197,94,0.7); border-radius: 1px 1px 0 0; flex-shrink: 0; margin-bottom: -1px;"></div>
        </div>
        <div style="font-size: 5.5pt; color: #94a3b8; margin-top: 2px; text-align: center; white-space: nowrap;">${d.label}</div>
      </div>`;
  }).join('');

  const yLabel = isRevenue ? 'Revenue ($M)' : 'Headcount';

  return `
    <div style="margin-bottom: 8px;">
      <div style="font-size: 7pt; color: #64748b; margin-bottom: 2px;">${yLabel}</div>
      <div style="position: relative; border-bottom: 1px solid #e2e8f0; border-left: 1px solid #e2e8f0; padding-left: 30px;">
        <div style="position: absolute; left: 30px; right: 0; bottom: ${targetPct}%; border-top: 2.5px dashed #ef4444; z-index: 2;"></div>
        <div style="position: absolute; left: 0; bottom: ${targetPct}%; transform: translateY(50%); font-size: 7pt; font-weight: 700; color: #ef4444; background: white; padding: 0 3px; white-space: nowrap; z-index: 3;">
          ${isRevenue ? fmtCompact(target) : settings.laborCapacityTarget}
        </div>
        <div style="display: flex; align-items: flex-end; gap: 1px;">
          ${bars}
        </div>
      </div>
      <div style="display: flex; gap: 10px; justify-content: center; margin-top: 4px; font-size: 6.5pt; color: #64748b;">
        <span><span style="display: inline-block; width: 10px; height: 8px; background: rgba(59,130,246,0.7); border-radius: 1px; vertical-align: middle; margin-right: 3px;"></span>Committed</span>
        <span><span style="display: inline-block; width: 10px; height: 8px; background: rgba(34,197,94,0.25); border: 1px dashed rgba(34,197,94,0.7); border-radius: 1px; vertical-align: middle; margin-right: 3px;"></span>Pipeline (wtd)</span>
        <span><span style="display: inline-block; width: 12px; height: 2.5px; background: #ef4444; vertical-align: middle; margin-right: 3px; border-top: 2.5px dashed #ef4444;"></span><span style="color: #ef4444; font-weight: 600;">Target</span></span>
      </div>
    </div>`;
}

// ─── KPI Cards ───

function buildKpiCards(summary, mode, settings) {
  const isRevenue = mode === 'revenue';
  const hpp = settings.hoursPerPersonPerMonth;
  const horizonMonths = summary.totalCapacity / (isRevenue ? settings.capacityTarget : settings.laborCapacityTarget * hpp);

  const cards = [
    {
      label: isRevenue ? 'Project Backlog' : 'Project Labor',
      value: isRevenue ? fmtCompact(summary.totalProjectValue) : `${fmtHC(summary.totalProjectValue / horizonMonths, hpp)} avg`,
      color: '#3b82f6',
    },
    {
      label: isRevenue ? 'Opp. Pipeline (wtd)' : 'Opp. Labor (est.)',
      value: isRevenue ? fmtCompact(summary.totalOppValue) : `${fmtHC(summary.totalOppValue / horizonMonths, hpp)} avg`,
      color: '#22c55e',
    },
    {
      label: isRevenue ? 'Monthly Target' : 'Headcount Target',
      value: isRevenue ? `${fmtCompact(settings.capacityTarget)}/mo` : `${settings.laborCapacityTarget}/mo`,
      color: '#ef4444',
      sub: isRevenue ? `${fmtCompact(summary.totalCapacity)} over ${Math.round(horizonMonths)}mo` : `${fmtHC(summary.totalCapacity / horizonMonths, hpp)} avg HC`,
    },
    {
      label: isRevenue ? 'Backlog Gap' : 'Labor Gap',
      value: summary.totalGap > 0
        ? (isRevenue ? fmtCompact(summary.totalGap) : `${fmtHC(summary.totalGap / horizonMonths, hpp)} avg`)
        : 'Covered',
      color: summary.totalGap > 0 ? '#ef4444' : '#16a34a',
    },
    {
      label: 'Months Under Capacity',
      value: `${summary.gapMonths} / ${Math.round(horizonMonths)}`,
      color: summary.gapMonths > 0 ? '#f59e0b' : '#16a34a',
    },
  ];

  return `
    <div style="display: flex; gap: 6px; margin-bottom: 8px;">
      ${cards.map(c => `
        <div style="flex: 1; text-align: center; border: 1px solid #e2e8f0; border-radius: 4px; padding: 5px 4px; background: #fafbfc;">
          <div style="font-size: 6pt; color: #64748b; margin-bottom: 2px;">${c.label}</div>
          <div style="font-size: 10pt; font-weight: 700; color: ${c.color};">${c.value}</div>
          ${c.sub ? `<div style="font-size: 5.5pt; color: #94a3b8; margin-top: 1px;">${c.sub}</div>` : ''}
        </div>
      `).join('')}
    </div>`;
}

// ─── Monthly Breakdown Table ───

function buildMonthlyTable(monthKeys, projectMonthly, oppMonthly, target, mode, settings) {
  const isRevenue = mode === 'revenue';
  const hpp = settings.hoursPerPersonPerMonth;

  const fmtVal = (v) => isRevenue ? fmtCompact(v) : fmtHC(v, hpp);

  const headerCells = monthKeys.map(m => `<th style="padding: 3px 2px; text-align: right; font-size: 6.5pt; border-bottom: 2px solid #e2e8f0; white-space: nowrap;">${m.label}</th>`).join('');

  const projectRow = monthKeys.map(m => {
    const v = projectMonthly.get(m.key) || 0;
    return `<td style="padding: 3px 2px; text-align: right; font-size: 6.5pt;">${fmtVal(v)}</td>`;
  }).join('');

  const oppRow = monthKeys.map(m => {
    const v = oppMonthly.get(m.key) || 0;
    return `<td style="padding: 3px 2px; text-align: right; font-size: 6.5pt;">${fmtVal(v)}</td>`;
  }).join('');

  const combinedRow = monthKeys.map(m => {
    const combined = (projectMonthly.get(m.key) || 0) + (oppMonthly.get(m.key) || 0);
    return `<td style="padding: 3px 2px; text-align: right; font-size: 6.5pt; font-weight: 600;">${fmtVal(combined)}</td>`;
  }).join('');

  const targetRow = monthKeys.map(() => {
    return `<td style="padding: 3px 2px; text-align: right; font-size: 6.5pt; color: #ef4444;">${isRevenue ? fmtCompact(target) : settings.laborCapacityTarget}</td>`;
  }).join('');

  const gapRow = monthKeys.map(m => {
    const projectValue = projectMonthly.get(m.key) || 0;
    const gap = target - projectValue;
    const isGap = gap > 0;
    return `<td style="padding: 3px 2px; text-align: right; font-size: 6.5pt; font-weight: 600; color: ${isGap ? '#dc2626' : '#16a34a'}; background: ${isGap ? '#fef2f2' : '#f0fdf4'};">
      ${isGap ? fmtVal(gap) : 'OK'}
    </td>`;
  }).join('');

  return `
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 6px;">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding: 3px 4px; text-align: left; font-size: 6.5pt; border-bottom: 2px solid #e2e8f0; width: 100px;">Category</th>
          ${headerCells}
        </tr>
      </thead>
      <tbody>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 3px 4px; font-size: 6.5pt; font-weight: 500; color: #3b82f6;">${isRevenue ? 'Project Backlog' : 'Project Labor'}</td>
          ${projectRow}
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 3px 4px; font-size: 6.5pt; font-weight: 500; color: #22c55e;">${isRevenue ? 'Opp. Pipeline (wtd)' : 'Opp. Labor (est.)'}</td>
          ${oppRow}
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9; background: #f8fafc;">
          <td style="padding: 3px 4px; font-size: 6.5pt; font-weight: 600;">Combined</td>
          ${combinedRow}
        </tr>
        <tr style="border-bottom: 1px solid #f1f5f9;">
          <td style="padding: 3px 4px; font-size: 6.5pt; font-weight: 500; color: #ef4444;">${isRevenue ? 'Capacity Target' : 'Headcount Target'}</td>
          ${targetRow}
        </tr>
        <tr style="background: #fef2f2;">
          <td style="padding: 3px 4px; font-size: 6.5pt; font-weight: 600; color: #991b1b;">Gap (backlog only)</td>
          ${gapRow}
        </tr>
      </tbody>
    </table>`;
}

// ─── Opportunity Fit Table ───

function buildOpportunityTable(scores, mode, settings) {
  if (!scores || scores.length === 0) {
    return '<div style="font-size: 7pt; color: #94a3b8; text-align: center; padding: 10px;">No active opportunities to rank</div>';
  }

  const isRevenue = mode === 'revenue';
  const rows = scores.map((s, idx) => {
    const color = getFitColor(s.fitScore);
    const bg = getFitBg(s.fitScore);
    const widthPct = Math.min(100, s.fitScore);

    return `
      <tr style="border-bottom: 1px solid #f1f5f9;">
        <td style="padding: 3px 4px; text-align: center; font-size: 6.5pt; color: #94a3b8; font-weight: 500;">${idx + 1}</td>
        <td style="padding: 3px 4px; font-size: 6.5pt;">
          <div style="font-weight: 500;">${s.opportunity.title}</div>
          <div style="font-size: 5.5pt; color: #64748b;">${s.opportunity.stage_name || ''} | ${s.opportunity.market || 'No market'}</div>
        </td>
        <td style="padding: 3px 4px; text-align: right; font-size: 6.5pt; font-weight: 500;">${fmtCompact(parseNum(s.opportunity.estimated_value))}</td>
        <td style="padding: 3px 4px; text-align: right; font-size: 6.5pt; color: #64748b;">${s.probability}%</td>
        <td style="padding: 3px 4px; text-align: right; font-size: 6.5pt; color: #64748b;">${isRevenue ? fmtCompact(s.weightedValue) : fmtHoursCompact(s.weightedHours)}</td>
        <td style="padding: 3px 4px; text-align: center; font-size: 6pt; color: #64748b;">${s.projectedStartLabel}</td>
        <td style="padding: 3px 4px; text-align: center; font-size: 6pt; color: #64748b;">${s.workDuration}mo</td>
        <td style="padding: 3px 4px; width: 90px;">
          <div style="display: flex; align-items: center; gap: 3px;">
            <div style="flex: 1; height: 10px; background: #f1f5f9; border-radius: 5px; overflow: hidden;">
              <div style="width: ${widthPct}%; height: 100%; background: ${color}; border-radius: 5px;"></div>
            </div>
            <span style="font-size: 6pt; font-weight: 600; color: ${color}; background: ${bg}; padding: 0 3px; border-radius: 3px; min-width: 20px; text-align: center;">
              ${s.fitScore.toFixed(0)}
            </span>
          </div>
        </td>
      </tr>`;
  }).join('');

  return `
    <div style="font-size: 7.5pt; font-weight: 600; margin-bottom: 4px;">Top Opportunity Fit Ranking (by ${isRevenue ? 'revenue' : 'labor'} fit)</div>
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="background: #f8fafc;">
          <th style="padding: 3px 4px; text-align: center; font-size: 6pt; border-bottom: 2px solid #e2e8f0; width: 20px;">#</th>
          <th style="padding: 3px 4px; text-align: left; font-size: 6pt; border-bottom: 2px solid #e2e8f0;">Opportunity</th>
          <th style="padding: 3px 4px; text-align: right; font-size: 6pt; border-bottom: 2px solid #e2e8f0;">Value</th>
          <th style="padding: 3px 4px; text-align: right; font-size: 6pt; border-bottom: 2px solid #e2e8f0;">Prob</th>
          <th style="padding: 3px 4px; text-align: right; font-size: 6pt; border-bottom: 2px solid #e2e8f0;">${isRevenue ? 'Weighted' : 'Est. Hrs'}</th>
          <th style="padding: 3px 4px; text-align: center; font-size: 6pt; border-bottom: 2px solid #e2e8f0;">Start</th>
          <th style="padding: 3px 4px; text-align: center; font-size: 6pt; border-bottom: 2px solid #e2e8f0;">Dur.</th>
          <th style="padding: 3px 4px; text-align: center; font-size: 6pt; border-bottom: 2px solid #e2e8f0; width: 90px;">Fit Score</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>`;
}

// ─── Variant Section (Revenue page + Labor page) ───

function buildVariantPages(variant, variantIdx, settings) {
  const revTarget = settings.capacityTarget;
  const labTarget = settings.laborCapacityTarget * settings.hoursPerPersonPerMonth;

  // Page A: Revenue
  const pageA = `
    <div class="page">
      <div class="section-header">
        <div style="font-size: 12pt; font-weight: 700; color: #002356;">${variant.label}</div>
        <div style="font-size: 8pt; color: #6b7280;">Revenue Analysis</div>
      </div>
      ${buildKpiCards(variant.revenue.summary, 'revenue', settings)}
      ${buildBarChart(variant.monthKeys, variant.revenue.projectMonthly, variant.revenue.oppMonthly, revTarget, 'revenue', settings)}
      ${buildMonthlyTable(variant.monthKeys, variant.revenue.projectMonthly, variant.revenue.oppMonthly, revTarget, 'revenue', settings)}
    </div>`;

  // Page B: Labor + Opportunity Table
  const pageB = `
    <div class="page">
      <div class="section-header">
        <div style="font-size: 12pt; font-weight: 700; color: #002356;">${variant.label}</div>
        <div style="font-size: 8pt; color: #6b7280;">Labor Analysis &amp; Opportunity Targeting</div>
      </div>
      ${buildKpiCards(variant.labor.summary, 'labor', settings)}
      ${buildBarChart(variant.monthKeys, variant.labor.projectMonthly, variant.labor.oppMonthly, labTarget, 'labor', settings)}
      ${buildOpportunityTable(variant.revenue.scores, 'revenue', settings)}
    </div>`;

  return pageA + pageB;
}

// ─── Regional Comparison Page ───

function buildRegionalComparisonPage(regions, horizonMonths, settings) {
  if (!regions || regions.length === 0) return '';

  const hpp = settings.hoursPerPersonPerMonth;

  const columns = regions.map(r => {
    const revSummary = r.revenue.summary;
    const labSummary = r.labor.summary;
    const revCoverage = revSummary.totalCapacity > 0
      ? (revSummary.totalProjectValue / revSummary.totalCapacity * 100).toFixed(0) : '0';
    const labHC = labSummary.totalProjectValue > 0
      ? (labSummary.totalProjectValue / horizonMonths / hpp).toFixed(1) : '0';

    // Gap heat strip — one cell per month
    const heatCells = r.monthKeys.map(m => {
      const projVal = r.revenue.projectMonthly.get(m.key) || 0;
      const gap = r.revTarget - projVal;
      const isGap = gap > 0;
      const intensity = isGap ? Math.min(1, gap / r.revTarget) : 0;
      const bg = isGap
        ? `rgba(239, 68, 68, ${0.15 + intensity * 0.6})`
        : 'rgba(34, 197, 94, 0.25)';
      return `<div style="flex: 1; height: 14px; background: ${bg}; border-radius: 1px;" title="${m.label}: ${isGap ? fmtCompact(gap) + ' gap' : 'OK'}"></div>`;
    }).join('');

    // Top 3 opportunities
    const topOpps = (r.revenue.scores || []).slice(0, 3).map((s, i) => {
      const color = getFitColor(s.fitScore);
      const bg = getFitBg(s.fitScore);
      return `
        <div style="display: flex; align-items: center; gap: 3px; padding: 2px 0; border-bottom: 1px solid #f1f5f9; font-size: 6pt;">
          <span style="color: #94a3b8; width: 10px; flex-shrink: 0;">${i + 1}.</span>
          <span style="flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${s.opportunity.title}">${s.opportunity.title}</span>
          <span style="font-weight: 600; color: ${color}; background: ${bg}; padding: 0 3px; border-radius: 2px; flex-shrink: 0; font-size: 5.5pt;">${s.fitScore.toFixed(0)}</span>
        </div>`;
    }).join('');

    const noOpps = (r.revenue.scores || []).length === 0
      ? '<div style="font-size: 6pt; color: #94a3b8; text-align: center; padding: 6px 0;">No scored opportunities</div>'
      : '';

    return `
      <div style="flex: 1; min-width: 0; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden;">
        <!-- Region Header -->
        <div style="background: ${r.color}; padding: 5px 8px; display: flex; align-items: center; gap: 6px;">
          <span style="font-size: 8.5pt; font-weight: 700; color: white;">${r.label}</span>
        </div>

        <div style="padding: 6px 8px;">
          <!-- KPI Grid -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-bottom: 6px;">
            <div style="text-align: center; padding: 3px; background: #f8fafc; border-radius: 3px;">
              <div style="font-size: 5pt; color: #64748b; text-transform: uppercase;">Committed</div>
              <div style="font-size: 9pt; font-weight: 700; color: #3b82f6;">${fmtCompact(revSummary.totalProjectValue)}</div>
            </div>
            <div style="text-align: center; padding: 3px; background: #f8fafc; border-radius: 3px;">
              <div style="font-size: 5pt; color: #64748b; text-transform: uppercase;">Gap</div>
              <div style="font-size: 9pt; font-weight: 700; color: ${revSummary.totalGap > 0 ? '#ef4444' : '#16a34a'};">
                ${revSummary.totalGap > 0 ? fmtCompact(revSummary.totalGap) : 'Covered'}
              </div>
            </div>
            <div style="text-align: center; padding: 3px; background: #f8fafc; border-radius: 3px;">
              <div style="font-size: 5pt; color: #64748b; text-transform: uppercase;">Coverage</div>
              <div style="font-size: 9pt; font-weight: 700; color: ${parseInt(revCoverage) >= 80 ? '#16a34a' : parseInt(revCoverage) >= 60 ? '#f59e0b' : '#ef4444'};">${revCoverage}%</div>
            </div>
            <div style="text-align: center; padding: 3px; background: #f8fafc; border-radius: 3px;">
              <div style="font-size: 5pt; color: #64748b; text-transform: uppercase;">Gap Months</div>
              <div style="font-size: 9pt; font-weight: 700; color: ${revSummary.gapMonths > 0 ? '#f59e0b' : '#16a34a'};">${revSummary.gapMonths} / ${horizonMonths}</div>
            </div>
          </div>

          <!-- Revenue target -->
          <div style="font-size: 5.5pt; color: #64748b; margin-bottom: 2px;">Revenue Target: ${fmtCompact(r.revTarget)}/mo | Labor: ${r.labTargetPeople} people</div>

          <!-- Heat Strip -->
          <div style="margin-bottom: 6px;">
            <div style="font-size: 5.5pt; color: #64748b; margin-bottom: 2px;">Monthly Revenue Gap</div>
            <div style="display: flex; gap: 1px;">
              ${heatCells}
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 4.5pt; color: #94a3b8; margin-top: 1px;">
              <span>${r.monthKeys[0]?.label || ''}</span>
              <span>${r.monthKeys[r.monthKeys.length - 1]?.label || ''}</span>
            </div>
          </div>

          <!-- Labor Summary -->
          <div style="display: flex; gap: 4px; margin-bottom: 6px; font-size: 6pt;">
            <div style="flex: 1; text-align: center; padding: 2px; background: #f0f9ff; border-radius: 2px;">
              <span style="color: #64748b;">Labor: </span>
              <span style="font-weight: 600; color: #1f2937;">${labHC} avg HC</span>
            </div>
            <div style="flex: 1; text-align: center; padding: 2px; background: ${labSummary.totalGap > 0 ? '#fef2f2' : '#f0fdf4'}; border-radius: 2px;">
              <span style="color: #64748b;">Gap: </span>
              <span style="font-weight: 600; color: ${labSummary.totalGap > 0 ? '#ef4444' : '#16a34a'};">
                ${labSummary.totalGap > 0 ? fmtHC(labSummary.totalGap / horizonMonths, hpp) + ' HC' : 'OK'}
              </span>
            </div>
          </div>

          <!-- Top Opportunities -->
          <div style="font-size: 6pt; font-weight: 600; color: #374151; margin-bottom: 2px;">Top Opportunities</div>
          ${topOpps}${noOpps}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="page">
      <div class="section-header">
        <div style="font-size: 12pt; font-weight: 700; color: #002356;">Regional Comparison \u2014 ${horizonMonths} Months</div>
        <div style="font-size: 8pt; color: #6b7280;">By Department Prefix (committed backlog only, pipeline excluded from gap)</div>
      </div>
      <div style="display: flex; gap: 8px; align-items: stretch;">
        ${columns}
      </div>
      <div style="margin-top: 8px; display: flex; gap: 12px; font-size: 6pt; color: #64748b; justify-content: center;">
        <span><span style="display: inline-block; width: 10px; height: 8px; background: rgba(34,197,94,0.25); border-radius: 1px; vertical-align: middle; margin-right: 2px;"></span>At/above target</span>
        <span><span style="display: inline-block; width: 10px; height: 8px; background: rgba(239,68,68,0.3); border-radius: 1px; vertical-align: middle; margin-right: 2px;"></span>Minor gap</span>
        <span><span style="display: inline-block; width: 10px; height: 8px; background: rgba(239,68,68,0.75); border-radius: 1px; vertical-align: middle; margin-right: 2px;"></span>Major gap</span>
      </div>
    </div>`;
}

// ─── Duration Rules Footer ───

function formatRuleValue(val) {
  if (val == null || val === Infinity || val >= 1e15) return '\u221e';
  if (val >= 1000000) return `$${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `$${(val / 1000).toFixed(0)}K`;
  return `$${val}`;
}

function buildDurationRulesFooter(settings) {
  const pursuit = (settings && settings.pursuitRules) || defaultPursuitRules;
  const workDur = (settings && settings.workDurationRules) || defaultWorkDurationRules;

  function renderRulesRow(rules) {
    return rules.map(r =>
      `<span style="white-space: nowrap;">${formatRuleValue(r.minValue)}\u2013${formatRuleValue(r.maxValue)} \u2192 ${r.months}mo</span>`
    ).join(' &nbsp;\u2502&nbsp; ');
  }

  return `
    <br><br>
    <strong>Duration rules used for opportunity scheduling:</strong><br>
    <em>Pursuit-to-award (time before work starts):</em> ${renderRulesRow(pursuit)}<br>
    <em>Work duration (how long the work lasts):</em> ${renderRulesRow(workDur)}
    <br>Opportunities with a user-adjusted start date or duration override these defaults.`;
}

// ─── Strategy Page ───

function buildStrategyPage(recommendations, settings) {
  if (!recommendations || recommendations.length === 0) {
    return '';
  }

  const borderColors = { info: '#3b82f6', warning: '#f59e0b', critical: '#ef4444' };
  const bgColors = { info: '#f0f9ff', warning: '#fffbeb', critical: '#fef2f2' };
  const icons = { info: '\u2139', warning: '\u26a0', critical: '\u2757' };

  const cards = recommendations.map(r => {
    const borderColor = borderColors[r.type] || borderColors.info;
    const bgColor = bgColors[r.type] || bgColors.info;
    const icon = icons[r.type] || icons.info;

    // Convert newlines in body to <br> for priority list formatting
    const bodyHtml = (r.body || '').replace(/\n/g, '<br>');

    return `
      <div style="padding: 8px 12px; border-left: 4px solid ${borderColor}; background: ${bgColor}; margin-bottom: 8px; border-radius: 0 4px 4px 0;">
        <div style="font-size: 8.5pt; font-weight: 700; color: #1f2937; margin-bottom: 3px;">${icon} ${r.title}</div>
        <div style="font-size: 7.5pt; color: #374151; line-height: 1.5;">${bodyHtml}</div>
      </div>`;
  }).join('');

  return `
    <div class="page">
      <div class="section-header">
        <div style="font-size: 12pt; font-weight: 700; color: #002356;">Strategy &amp; Recommendations</div>
        <div style="font-size: 8pt; color: #6b7280;">Deterministic analysis based on current backlog, pipeline, and capacity targets</div>
      </div>
      ${cards}
      <div style="margin-top: 16px; font-size: 6.5pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 8px;">
        <strong>How fit scoring works:</strong> Each opportunity is scored 0\u2013100 based on: how much of its value lands in months with capacity gaps (60% weight),
        win probability (30% weight), and size appropriateness (10% weight).
        <span style="display: inline-block; background: #dcfce7; color: #16a34a; padding: 0 3px; border-radius: 2px; margin: 0 2px;">60+</span> = strong fit,
        <span style="display: inline-block; background: #fef9c3; color: #ca8a04; padding: 0 3px; border-radius: 2px; margin: 0 2px;">30\u201359</span> = moderate,
        <span style="display: inline-block; background: #fee2e2; color: #dc2626; padding: 0 3px; border-radius: 2px; margin: 0 2px;">&lt;30</span> = weak fit.
        Revenue is probability-weighted.
        <br><br>
        <strong>How opportunity labor is estimated:</strong> Project labor uses actual remaining hours from Vista (Projected \u2013 JTD for pipefitting, sheet metal, and plumbing).
        Opportunity labor is estimated using: Est. Value \u00d7 ${settings ? settings.laborPctOfValue : 60}% (labor portion) \u00f7 $${settings ? settings.avgLaborRate : 85}/hr = estimated hours.
        Hours are then probability-weighted and distributed across the projected work duration.
        Headcount = monthly hours \u00f7 ${settings ? settings.hoursPerPersonPerMonth : 173} hrs/person/month.
        ${buildDurationRulesFooter(settings)}
      </div>
    </div>`;
}

// ─── Main Generator ───

function generateBacklogReportPdfHtml(reportData, recommendations, generatedBy) {
  const { variants, regional12, regional18, settings } = reportData;

  const hasRegional = regional12 && regional12.length > 0;
  const variantPages = variants.map((v, i) => buildVariantPages(v, i, settings)).join('');
  const regionalPages = hasRegional
    ? buildRegionalComparisonPage(regional12, 12, settings) + buildRegionalComparisonPage(regional18, 18, settings)
    : '';
  const strategyPage = buildStrategyPage(recommendations, settings);
  const coverPage = buildCoverPage(settings, generatedBy, hasRegional);

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    @page {
      size: letter landscape;
      margin: 0.4in;
    }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #000;
      line-height: 1.3;
      font-size: 8pt;
      margin: 0;
      padding: 0;
    }

    .page {
      page-break-after: always;
      position: relative;
    }
    .page:last-child {
      page-break-after: auto;
    }

    .cover-page {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      padding-bottom: 6px;
      border-bottom: 2px solid #002356;
      margin-bottom: 8px;
    }
  </style>
</head>
<body>
  ${coverPage}
  ${variantPages}
  ${regionalPages}
  ${strategyPage}
</body>
</html>`;
}

module.exports = { generateBacklogReportPdfHtml };
