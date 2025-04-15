import { NextResponse } from 'next/server';

export function middleware(request) {
  // Get pathname (everything after the hostname)
  const url = request.nextUrl.clone();
  const { pathname } = url;
  
  // Log navigation requests to help debug
  console.log(`Middleware processing path: ${pathname}`);
  
  // If we're navigating to an analysis page, make sure we don't redirect improperly
  if (pathname.startsWith('/analysis/')) {
    return NextResponse.next();
  }
  
  // Normal processing for all other routes
  return NextResponse.next();
}

// Configure matcher to only run middleware on specific paths
export const config = {
  matcher: [
    // Match all paths
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$).*)',
  ],
}; 