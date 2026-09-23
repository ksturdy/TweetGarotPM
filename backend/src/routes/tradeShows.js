const express = require('express');
const router = express.Router();
const TradeShow = require('../models/TradeShow');
const { authenticate } = require('../middleware/auth');
const { tenantContext } = require('../middleware/tenant');
const { notify } = require('../utils/notificationService');

router.use(authenticate);
router.use(tenantContext);

// GET /api/trade-shows - List all trade shows
router.get('/', async (req, res, next) => {
  try {
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.year) filters.year = parseInt(req.query.year);
    if (req.query.sales_lead_id) filters.sales_lead_id = parseInt(req.query.sales_lead_id);
    if (req.query.coordinator_id) filters.coordinator_id = parseInt(req.query.coordinator_id);
    if (req.query.event_type) filters.event_type = req.query.event_type;
    if (req.query.market) filters.market = req.query.market;
    if (req.query.search) filters.search = req.query.search;

    const shows = await TradeShow.findAllByTenant(req.tenantId, filters);
    res.json(shows);
  } catch (err) {
    next(err);
  }
});

// POST /api/trade-shows - Create trade show
router.post('/', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const show = await TradeShow.create(req.body, req.tenantId, req.user.id);
    res.status(201).json(show);
  } catch (err) {
    next(err);
  }
});

// ── AI extraction helpers ────────────────────────────────────────────────────

function getPageText($) {
  $('script, style, nav, header, footer, aside, iframe, noscript').remove();
  $('[class*="nav"], [class*="menu"], [class*="footer"], [class*="cookie"], [class*="banner"], [id*="cookie"], [id*="banner"]').remove();
  return $('body').text().replace(/[\s ]+/g, ' ').trim().slice(0, 8000);
}

async function extractWithAI(text) {
  const Anthropic = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const today = new Date().toISOString().slice(0, 10);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: 'You are a precise event data extractor. Return ONLY valid JSON — no markdown fences, no explanation.',
    messages: [{
      role: 'user',
      content: `Today is ${today}. Extract trade show / event details from the text below.
Return a JSON object with exactly these fields (use null for anything not found):
{
  "name": null,
  "description": null,
  "event_start_date": null,
  "event_end_date": null,
  "event_start_time": null,
  "event_end_time": null,
  "registration_deadline": null,
  "venue": null,
  "address": null,
  "city": null,
  "state": null,
  "country": null,
  "registration_cost": null
}
Rules:
- dates → YYYY-MM-DD
- times → HH:MM (24-hour)
- state → 2-letter US abbreviation when applicable
- registration_cost → USD number (0 if free, null if not mentioned)
- description → 1–3 sentence plain-text summary of what the event is

TEXT:
${text}`,
    }],
  });

  const raw = message.content[0].text.trim().replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  return JSON.parse(raw);
}

// POST /api/trade-shows/extract-url - Extract event info from a URL (Schema.org + AI enrichment)
router.post('/extract-url', async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL is required' });
    }

    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http/https URLs are supported' });
    }

    const axios = require('axios');
    const cheerio = require('cheerio');

    let html;
    try {
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 10000,
        maxRedirects: 5,
        maxContentLength: 2 * 1024 * 1024,
      });
      html = response.data;
    } catch {
      return res.status(422).json({ error: 'Could not fetch that URL. The site may be blocking automated requests.' });
    }

    const $ = cheerio.load(html);
    const result = {};

    const extractDate = (val) => { if (!val) return null; return String(val).split('T')[0]; };
    const extractTime = (val) => { if (!val || !String(val).includes('T')) return null; return String(val).split('T')[1].substring(0, 5); };

    // ── Schema.org JSON-LD ───────────────────────────────────────────────────
    $('script[type="application/ld+json"]').each((_, el) => {
      if (result.name) return;
      try {
        const raw = $(el).html();
        if (!raw) return;
        const json = JSON.parse(raw);
        const items = Array.isArray(json) ? json : (json['@graph'] ? json['@graph'] : [json]);
        for (const item of items) {
          const type = item['@type'];
          if (!(type === 'Event' || (Array.isArray(type) && type.includes('Event')))) continue;

          if (item.name) result.name = String(item.name).trim();
          if (item.description) result.description = String(item.description).trim();
          result.website_url = item.url || url;
          if (item.startDate) { result.event_start_date = extractDate(item.startDate); const t = extractTime(item.startDate); if (t) result.event_start_time = t; }
          if (item.endDate)   { result.event_end_date   = extractDate(item.endDate);   const t = extractTime(item.endDate);   if (t) result.event_end_time   = t; }

          const loc = item.location;
          if (loc && typeof loc === 'object') {
            if (loc.name) result.venue = String(loc.name).trim();
            const addr = loc.address;
            if (addr) {
              if (typeof addr === 'string') { result.address = addr; }
              else {
                if (addr.streetAddress)  result.address = String(addr.streetAddress).trim();
                if (addr.addressLocality) result.city   = String(addr.addressLocality).trim();
                if (addr.addressRegion)  result.state   = String(addr.addressRegion).trim();
                if (addr.addressCountry) result.country = String(addr.addressCountry).trim();
              }
            }
          } else if (loc && typeof loc === 'string') { result.venue = loc; }

          const offers = item.offers ? (Array.isArray(item.offers) ? item.offers : [item.offers]) : [];
          for (const offer of offers) {
            const price = parseFloat(offer.price);
            if (!isNaN(price)) { result.registration_cost = price; break; }
            if (offer.validThrough) result.registration_deadline = extractDate(offer.validThrough);
          }
          break;
        }
      } catch { /* malformed JSON-LD */ }
    });

    // ── OpenGraph fallbacks ──────────────────────────────────────────────────
    if (!result.name)        result.name        = $('meta[property="og:title"]').attr('content')       || $('meta[name="twitter:title"]').attr('content') || $('title').text().trim() || null;
    if (!result.description) result.description = $('meta[property="og:description"]').attr('content') || $('meta[name="description"]').attr('content')   || null;
    if (!result.website_url) result.website_url = $('meta[property="og:url"]').attr('content')         || url;

    // ── AI enrichment: fill any fields still missing ─────────────────────────
    const missingKey = ['event_start_date', 'city', 'venue'].some(k => !result[k]);
    if (missingKey && process.env.ANTHROPIC_API_KEY) {
      try {
        const pageText = getPageText($);
        const aiData = await extractWithAI(pageText);
        for (const [k, v] of Object.entries(aiData)) {
          if (v != null && result[k] == null) result[k] = v;
        }
        result._ai_enriched = true;
      } catch { /* AI failed — return what we have */ }
    }

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/trade-shows/extract-text - Extract event info from pasted text using AI
router.post('/extract-text', async (req, res, next) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'Text is required' });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(503).json({ error: 'AI extraction is not configured on this server.' });
    }

    const aiData = await extractWithAI(text.trim());
    res.json({ ...aiData, _ai_enriched: true });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return res.status(422).json({ error: 'AI returned an unexpected response. Please try again.' });
    }
    next(err);
  }
});

// GET /api/trade-shows/:id - Get trade show with attendees
router.get('/:id', async (req, res, next) => {
  try {
    const show = await TradeShow.findByIdAndTenant(parseInt(req.params.id), req.tenantId);
    if (!show) {
      return res.status(404).json({ error: 'Trade show not found' });
    }
    res.json(show);
  } catch (err) {
    next(err);
  }
});

// PUT /api/trade-shows/:id - Update trade show
router.put('/:id', async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const show = await TradeShow.update(
      parseInt(req.params.id),
      req.body,
      req.tenantId,
      req.user.id
    );

    if (!show) {
      return res.status(404).json({ error: 'Trade show not found' });
    }
    res.json(show);
  } catch (err) {
    next(err);
  }
});

// POST /api/trade-shows/:id/recur - Clone show for next occurrence
router.post('/:id/recur', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    const newShow = await TradeShow.recur(showId, req.tenantId, req.user.id, {
      event_start_date: req.body.event_start_date || null,
      event_end_date: req.body.event_end_date || null,
      registration_deadline: req.body.registration_deadline || null,
    });

    res.status(201).json(newShow);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trade-shows/:id - Delete trade show
router.delete('/:id', async (req, res, next) => {
  try {
    const deleted = await TradeShow.delete(parseInt(req.params.id), req.tenantId);
    if (!deleted) {
      return res.status(404).json({ error: 'Trade show not found' });
    }
    res.json({ message: 'Trade show deleted' });
  } catch (err) {
    next(err);
  }
});

// ── Attendee routes ──

// GET /api/trade-shows/:id/attendees
router.get('/:id/attendees', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) {
      return res.status(404).json({ error: 'Trade show not found' });
    }

    const attendees = await TradeShow.getAttendees(showId);
    res.json(attendees);
  } catch (err) {
    next(err);
  }
});

// POST /api/trade-shows/:id/attendees
router.post('/:id/attendees', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) {
      return res.status(404).json({ error: 'Trade show not found' });
    }

    const { employee_id, external_name } = req.body;
    if (!employee_id && (!external_name || !external_name.trim())) {
      return res.status(400).json({ error: 'Either an employee or external name is required' });
    }

    const attendee = await TradeShow.addAttendee(showId, req.tenantId, req.body);
    res.status(201).json(attendee);
  } catch (err) {
    next(err);
  }
});

// PUT /api/trade-shows/:id/attendees/:attendeeId
router.put('/:id/attendees/:attendeeId', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) {
      return res.status(404).json({ error: 'Trade show not found' });
    }

    const { employee_id, external_name } = req.body;
    if (!employee_id && (!external_name || !external_name.trim())) {
      return res.status(400).json({ error: 'Either an employee or external name is required' });
    }

    const attendee = await TradeShow.updateAttendee(
      parseInt(req.params.attendeeId),
      showId,
      req.body
    );

    if (!attendee) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    res.json(attendee);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/trade-shows/:id/attendees/:attendeeId
router.delete('/:id/attendees/:attendeeId', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) {
      return res.status(404).json({ error: 'Trade show not found' });
    }

    const deleted = await TradeShow.deleteAttendee(parseInt(req.params.attendeeId), showId);
    if (!deleted) {
      return res.status(404).json({ error: 'Attendee not found' });
    }
    res.json({ message: 'Attendee removed' });
  } catch (err) {
    next(err);
  }
});

// ── Expense routes ──

router.get('/:id/expenses', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });
    const expenses = await TradeShow.getExpenses(showId);
    res.json(expenses);
  } catch (err) { next(err); }
});

router.post('/:id/expenses', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    const amt = parseFloat(req.body.amount);
    if (isNaN(amt)) return res.status(400).json({ error: 'Amount is required and must be a number' });

    const expense = await TradeShow.addExpense(showId, req.tenantId, req.body, req.user.id);
    res.status(201).json(expense);
  } catch (err) { next(err); }
});

router.put('/:id/expenses/:expenseId', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    const amt = parseFloat(req.body.amount);
    if (isNaN(amt)) return res.status(400).json({ error: 'Amount is required and must be a number' });

    const expense = await TradeShow.updateExpense(
      parseInt(req.params.expenseId), showId, req.body, req.user.id
    );
    if (!expense) return res.status(404).json({ error: 'Expense not found' });
    res.json(expense);
  } catch (err) { next(err); }
});

router.delete('/:id/expenses/:expenseId', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    const deleted = await TradeShow.deleteExpense(parseInt(req.params.expenseId), showId);
    if (!deleted) return res.status(404).json({ error: 'Expense not found' });
    res.json({ message: 'Expense deleted' });
  } catch (err) { next(err); }
});

// ── To-Do routes ──

router.get('/:id/todos', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });
    const todos = await TradeShow.getTodos(showId);
    res.json(todos);
  } catch (err) { next(err); }
});

router.post('/:id/todos', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    if (!req.body.title || !req.body.title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const todo = await TradeShow.addTodo(showId, req.tenantId, req.body, req.user.id);

    // Fire an in-app + email notification to the assignee on creation.
    if (todo.assigned_to_user_id && todo.assigned_to_user_id !== req.user.id) {
      const show = await TradeShow.findByIdAndTenant(showId, req.tenantId);
      const dueParts = [todo.due_date, todo.due_time].filter(Boolean).join(' ');
      notify({
        tenantId: req.tenantId,
        projectId: null,
        entityType: 'trade_show_todo',
        entityId: todo.id,
        eventType: 'assigned',
        title: `Trade show task assigned: ${todo.title}`,
        message: `assigned you a task for ${show?.name || 'a trade show'}`,
        link: `/marketing/trade-shows/${showId}`,
        createdBy: req.user.id,
        emailSubject: `New trade show task: ${todo.title}`,
        emailDetails: [
          { label: 'Trade Show', value: show?.name || '' },
          { label: 'Task', value: todo.title },
          { label: 'Priority', value: todo.priority },
          ...(dueParts ? [{ label: 'Due', value: dueParts }] : []),
          ...(todo.description ? [{ label: 'Details', value: todo.description }] : []),
        ],
        targetUserId: todo.assigned_to_user_id,
        contextName: `Trade Show: ${show?.name || ''}`,
      });
    }

    res.status(201).json(todo);
  } catch (err) { next(err); }
});

router.put('/:id/todos/:todoId', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    if (!req.body.title || !req.body.title.trim()) {
      return res.status(400).json({ error: 'Title is required' });
    }

    const previous = await TradeShow.getTodoById(parseInt(req.params.todoId), showId);
    const todo = await TradeShow.updateTodo(
      parseInt(req.params.todoId), showId, req.body, req.user.id
    );
    if (!todo) return res.status(404).json({ error: 'Task not found' });

    // Notify on assignee change.
    const reassigned =
      todo.assigned_to_user_id &&
      todo.assigned_to_user_id !== req.user.id &&
      todo.assigned_to_user_id !== previous?.assigned_to_user_id;

    if (reassigned) {
      const show = await TradeShow.findByIdAndTenant(showId, req.tenantId);
      const dueParts = [todo.due_date, todo.due_time].filter(Boolean).join(' ');
      notify({
        tenantId: req.tenantId,
        projectId: null,
        entityType: 'trade_show_todo',
        entityId: todo.id,
        eventType: 'reassigned',
        title: `Trade show task assigned: ${todo.title}`,
        message: `reassigned a task to you for ${show?.name || 'a trade show'}`,
        link: `/marketing/trade-shows/${showId}`,
        createdBy: req.user.id,
        emailSubject: `Trade show task: ${todo.title}`,
        emailDetails: [
          { label: 'Trade Show', value: show?.name || '' },
          { label: 'Task', value: todo.title },
          { label: 'Priority', value: todo.priority },
          ...(dueParts ? [{ label: 'Due', value: dueParts }] : []),
        ],
        targetUserId: todo.assigned_to_user_id,
        contextName: `Trade Show: ${show?.name || ''}`,
      });
    }

    res.json(todo);
  } catch (err) { next(err); }
});

router.delete('/:id/todos/:todoId', async (req, res, next) => {
  try {
    const showId = parseInt(req.params.id);
    const owns = await TradeShow.verifyOwnership(showId, req.tenantId);
    if (!owns) return res.status(404).json({ error: 'Trade show not found' });

    const deleted = await TradeShow.deleteTodo(parseInt(req.params.todoId), showId);
    if (!deleted) return res.status(404).json({ error: 'Task not found' });
    res.json({ message: 'Task deleted' });
  } catch (err) { next(err); }
});

module.exports = router;
