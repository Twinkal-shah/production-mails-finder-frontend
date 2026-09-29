import { NextResponse } from 'next/server'

// Liveness probe for the container / nginx upstream check. Intentionally does
// not touch Supabase or the backend: it answers "is this Next.js process up",
// nothing more.
export async function GET() {
  return NextResponse.json({ status: 'ok', uptime: process.uptime() })
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
