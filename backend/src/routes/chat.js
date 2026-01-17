const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Apply auth middleware
router.use(authenticate);

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Chat endpoint
router.post('/message', async (req, res, next) => {
  try {
    const { message, conversationHistory = [] } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build conversation messages for Claude
    const messages = [
      ...conversationHistory.map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      })),
      {
        role: 'user',
        content: message
      }
    ];

    // Create system prompt with context about the business
    const systemPrompt = `You are Titan, an AI assistant for Tweet Garot Mechanical, a commercial HVAC and plumbing contractor.

You help with:
- Project management insights (RFIs, submittals, change orders, schedules)
- Customer account management
- Estimating and budgeting
- Marketing and business development
- Operations analysis

Be helpful, professional, and concise. When discussing projects or data, be specific and actionable. If you don't have access to specific data, acknowledge that and offer to help in other ways.

Current user: ${req.user.firstName} ${req.user.lastName} (${req.user.role})`;

    // Call Claude API
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1024,
      system: systemPrompt,
      messages: messages
    });

    // Extract the response text
    const responseText = response.content[0].text;

    res.json({
      response: responseText,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    });

  } catch (error) {
    console.error('Chat error:', error);

    if (error.status === 401) {
      return res.status(500).json({
        error: 'AI service authentication failed. Please check API key configuration.'
      });
    }

    next(error);
  }
});

module.exports = router;
