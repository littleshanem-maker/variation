import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiting: message → lastSentAt timestamp
const recentErrors = new Map<string, number>();
const RATE_LIMIT_MS = 5 * 60 * 1000; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, stack, url, context } = body as {
      message?: string;
      stack?: string;
      url?: string;
      context?: string;
    };

    const errorMessage = message || 'Unknown error';
    const now = Date.now();

    // Rate limiting — skip if same error sent in last 5 minutes
    const lastSent = recentErrors.get(errorMessage);
    if (lastSent && now - lastSent < RATE_LIMIT_MS) {
      return NextResponse.json({ ok: true, rateLimited: true });
    }
    recentErrors.set(errorMessage, now);

    // Clean up old entries to avoid memory leak
    for (const [key, ts] of recentErrors.entries()) {
      if (now - ts > RATE_LIMIT_MS * 2) {
        recentErrors.delete(key);
      }
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (!token || !chatId) {
      console.error('[error-report] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
      return NextResponse.json({ ok: true, sent: false });
    }

    // Format first 3 lines of stack trace
    const stackLines = (stack || '')
      .split('\n')
      .filter(Boolean)
      .slice(0, 3)
      .join('\n');

    const telegramText = [
      '🚨 Variation Shield Error',
      '',
      `Message: ${errorMessage}`,
      `URL: ${url || 'unknown'}`,
      `Context: ${context || 'unknown'}`,
      '',
      'Stack:',
      stackLines || '(no stack)',
      '',
      `Time: ${new Date().toISOString()}`,
    ].join('\n');

    const tgRes = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: telegramText,
          parse_mode: undefined, // plain text — avoids formatting escaping issues
        }),
      }
    );

    if (!tgRes.ok) {
      const err = await tgRes.text();
      console.error('[error-report] Telegram API error:', err);
    }

    return NextResponse.json({ ok: true, sent: tgRes.ok });
  } catch (err) {
    // Never let the error reporter itself throw
    console.error('[error-report] Internal error:', err);
    return NextResponse.json({ ok: true, sent: false });
  }
}
