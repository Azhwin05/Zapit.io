import { NextResponse } from 'next/server';
import { getLanIp } from '@/lib/lan-ip.server';

// Lets the client swap `localhost` for this machine's real LAN address when
// building the QR/share link — a QR scanned from another device is useless
// if it just says "localhost", since that resolves to the SCANNING device.
export async function GET() {
  return NextResponse.json({ ip: getLanIp() });
}
