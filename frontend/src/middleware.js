import { NextResponse } from 'next/server';

// Simple middleware that just logs navigation but doesn't interfere with it
export function middleware(request) {
  // Get the current path
  const { pathname } = request.nextUrl;
  
  // Log the path for debugging purposes
  console.log(`Middleware: Handling request for path: ${pathname}`);
  
  // Allow the request to proceed without any modifications
  return NextResponse.next();
}

// Apply middleware only to the most essential routes to minimize interference
export const config = {
  matcher: [
    '/',
    '/analysis/:path*'
  ],
}; 