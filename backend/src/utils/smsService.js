// Twilio SMS wrapper. Env-gated — if TWILIO_SID / TWILIO_TOKEN / TWILIO_FROM
// are unset, sendSms returns a soft-fail result (mirrors how emailService
// handles missing SMTP) so the rest of the app keeps working.

const isSmsConfigured = () => {
  return !!(
    process.env.TWILIO_SID &&
    process.env.TWILIO_TOKEN &&
    process.env.TWILIO_FROM &&
    process.env.LABOR_SMS_ENABLED !== 'false'
  );
};

let twilioClient = null;
const getClient = () => {
  if (!isSmsConfigured()) return null;
  if (!twilioClient) {
    const twilio = require('twilio');
    twilioClient = twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN);
  }
  return twilioClient;
};

const normalizePhone = (raw) => {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return digits;
};

const sendSms = async ({ to, body }) => {
  const client = getClient();
  if (!client) {
    return {
      success: false,
      preview: true,
      message: 'SMS not configured. Set TWILIO_SID, TWILIO_TOKEN, TWILIO_FROM in .env to enable.',
    };
  }

  const normalized = normalizePhone(to);
  if (!normalized) {
    return { success: false, error: 'No phone number on file', message: 'No phone number on file' };
  }

  try {
    const message = await client.messages.create({
      from: process.env.TWILIO_FROM,
      to: normalized,
      body,
    });
    return {
      success: true,
      messageId: message.sid,
      message: `SMS sent to ${normalized}`,
    };
  } catch (error) {
    console.error('SMS send error:', error);
    return {
      success: false,
      error: error.message,
      message: `Failed to send SMS: ${error.message}`,
    };
  }
};

module.exports = {
  isSmsConfigured,
  sendSms,
  normalizePhone,
};
