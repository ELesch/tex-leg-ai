import { NextResponse } from 'next/server';

// This timestamp is set at build time
const BUILD_TIMESTAMP = new Date().toISOString();

export const dynamic = 'force-static';

export async function GET() {
  return NextResponse.json({
    status: 'ok',
    buildTimestamp: BUILD_TIMESTAMP,
    message: 'TexLegAI API is running',
  });
}
