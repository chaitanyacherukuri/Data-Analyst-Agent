import { NextResponse } from 'next/server';

// Empty middleware that just passes through all requests
export function middleware(request) {
  return NextResponse.next();
}

// Define matcher for valid paths
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}; 