import { NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/'];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.includes(pathname)) return NextResponse.next();

  const token = req.cookies.get('logistics_token')?.value;
  if (!token) {
    return NextResponse.redirect(new URL(`${req.nextUrl.basePath}/login`, req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard', '/orgin/:path*', '/destination/:path*', '/report', '/transporter-master', '/billing-details'],
};
