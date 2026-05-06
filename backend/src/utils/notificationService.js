const db = require('../config/database');
const Notification = require('../models/Notification');
const { sendEmail } = require('./emailService');

/**
 * Find the user_id for a project's manager via the employees table.
 * Returns { userId, email, firstName } or null.
 */
async function getProjectManagerUser(projectId) {
  const result = await db.query(
    `SELECT u.id as user_id, u.email, u.first_name, u.last_name
     FROM projects p
     JOIN employees e ON p.manager_id = e.id
     JOIN users u ON e.user_id = u.id
     WHERE p.id = $1 AND u.is_active = true`,
    [projectId]
  );
  return result.rows[0] || null;
}

/**
 * Get project-assigned users (managers + admins) who should receive notifications,
 * excluding the person who triggered the action.
 */
async function getProjectNotifyUsers(projectId, tenantId, excludeUserId) {
  // Get the PM
  const pm = await getProjectManagerUser(projectId);
  const users = [];
  if (pm && pm.user_id !== excludeUserId) {
    users.push(pm);
  }
  return users;
}

/**
 * Generate notification email HTML using the same branded template style.
 */
function generateNotificationEmailHtml({ title, entityLabel, projectName, submittedBy, details, appUrl }) {
  const detailRows = details.map(d =>
    `<div class="info-row"><span class="info-label">${d.label}:</span><span class="info-value">${d.value}</span></div>`
  ).join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #002356, #004080); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .header h1 { margin: 0; font-size: 22px; }
    .header p { margin: 5px 0 0; opacity: 0.9; font-size: 14px; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .info-row { display: flex; margin-bottom: 10px; }
    .info-label { font-weight: 600; color: #6b7280; width: 120px; flex-shrink: 0; }
    .info-value { color: #1f2937; }
    .btn { display: inline-block; background: #002356; color: white !important; padding: 10px 20px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 15px; }
    .footer { background: #f3f4f6; padding: 15px 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <p>${projectName}</p>
  </div>
  <div class="content">
    <p><strong>${submittedBy}</strong> ${entityLabel}</p>
    ${detailRows}
    ${appUrl ? `<p><a href="${appUrl}" class="btn">View in TITAN</a></p>` : ''}
  </div>
  <div class="footer">
    <p>This is an automated notification from TITAN Project Management.</p>
  </div>
</body>
</html>`;
}

/**
 * Core function: create in-app notification + send email.
 * Runs async (fire-and-forget) so it doesn't block the API response.
 */
async function notify({ tenantId, projectId, entityType, entityId, eventType, title, message, link, createdBy, emailSubject, emailDetails, targetUserId, targetUserIds, contextName }) {
  try {
    let users;
    if (Array.isArray(targetUserIds) && targetUserIds.length > 0) {
      // Notify a specific list of users
      const targetResult = await db.query(
        'SELECT id as user_id, email, first_name, last_name FROM users WHERE id = ANY($1::int[]) AND is_active = true',
        [targetUserIds]
      );
      users = targetResult.rows;
    } else if (targetUserId) {
      // Notify a specific user instead of the default PM list
      const targetResult = await db.query(
        'SELECT id as user_id, email, first_name, last_name FROM users WHERE id = $1 AND is_active = true',
        [targetUserId]
      );
      users = targetResult.rows;
    } else {
      users = await getProjectNotifyUsers(projectId, tenantId, createdBy);
    }

    // Get the context name (project, trade show, etc.) for the email header.
    // Caller can pass `contextName` to override the project lookup — useful
    // for entities not tied to a project (e.g., trade show todos).
    let projectName = contextName;
    if (!projectName && projectId) {
      const projectResult = await db.query('SELECT name FROM projects WHERE id = $1', [projectId]);
      projectName = projectResult.rows[0]?.name;
    }
    projectName = projectName || 'TITAN';

    const submitterResult = await db.query(
      "SELECT first_name || ' ' || last_name as full_name FROM users WHERE id = $1",
      [createdBy]
    );
    const submitterName = submitterResult.rows[0]?.full_name || 'Someone';

    const appBaseUrl = process.env.APP_URL || process.env.FRONTEND_URL || '';

    for (const user of users) {
      let emailSent = false;

      // Send email
      if (user.email && emailSubject) {
        const html = generateNotificationEmailHtml({
          title: emailSubject,
          entityLabel: message,
          projectName,
          submittedBy: submitterName,
          details: emailDetails || [],
          appUrl: appBaseUrl && link ? `${appBaseUrl}${link}` : '',
        });

        const result = await sendEmail({
          to: user.email,
          subject: `[TITAN] ${emailSubject}`,
          html,
          text: `${submitterName} ${message}\n\nProject: ${projectName}`,
        });
        emailSent = result.success;
      }

      // Save in-app notification
      await Notification.create({
        tenantId,
        userId: user.user_id,
        entityType,
        entityId,
        eventType,
        title,
        message: `${submitterName} ${message}`,
        link,
        createdBy,
        emailSent,
      });
    }
  } catch (error) {
    // Log but don't throw — notifications should never break the main flow
    console.error('Notification error:', error);
  }
}

module.exports = { notify };
