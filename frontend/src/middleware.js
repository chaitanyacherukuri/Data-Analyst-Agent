import { NextResponse } from 'next/server';

export function middleware(request) {
  // Get pathname (everything after the hostname)
  const url = request.nextUrl.clone();
  const { pathname } = url;
  
  // Enhanced logging for debugging navigation issues
  console.log(`Middleware processing path: ${pathname}`);
  console.log(`Request headers:`, Object.fromEntries(request.headers));
  console.log(`Request method: ${request.method}`);
  
  // If we're navigating to an analysis page, ensure it passes through without interference
  if (pathname.startsWith('/analysis/')) {
    console.log(`Analysis route detected: ${pathname}`);
    return NextResponse.next();
  }
  
  // Special handling for direct navigations - add debugging
  if (pathname === '/' || pathname === '') {
    console.log('Root route detected');
  }
  
  // Normal processing for all other routes
  return NextResponse.next();
}

// Configure matcher to only run middleware on specific paths
export const config = {
  matcher: [
    // Match all paths except static assets
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(png|jpg|svg|ico)$).*)',
  ],
}; 