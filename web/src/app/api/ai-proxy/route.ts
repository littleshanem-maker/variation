import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

// NOTE: Add ANTHROPIC_API_KEY to Vercel environment variables for this project.
// Go to: https://vercel.com/leveraged-systems/variation/settings/environment-variables
// Variable name: ANTHROPIC_API_KEY

export const maxDuration = 60;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: CORS_HEADERS,
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { system, user, model } = body as {
      system?: string;
      user?: string;
      model?: string;
    };

    if (!system || !user) {
      return NextResponse.json(
        { error: 'Missing required fields: system and user.' },
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'AI proxy not configured — ANTHROPIC_API_KEY is missing.' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    const client = new Anthropic({ apiKey });

    const requestedModel = model ?? 'claude-opus-4-6';

    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: requestedModel,
        max_tokens: 2048,
        system,
        messages: [{ role: 'user', content: user }],
      });
    } catch (primaryError) {
      if (requestedModel !== 'claude-sonnet-4-6') {
        console.warn(`${requestedModel} failed, falling back to claude-sonnet-4-6:`, primaryError);
        response = await client.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 2048,
          system,
          messages: [{ role: 'user', content: user }],
        });
      } else {
        throw primaryError;
      }
    }

    const contentBlock = response.content[0];
    if (contentBlock.type !== 'text') {
      return NextResponse.json(
        { error: 'Unexpected response format from AI.' },
        { status: 500, headers: CORS_HEADERS }
      );
    }

    return NextResponse.json(
      { content: contentBlock.text },
      { headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('AI proxy error:', error);
    return NextResponse.json(
      { error: 'AI request failed — please try again.' },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
