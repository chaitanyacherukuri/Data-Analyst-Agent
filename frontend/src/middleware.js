import { NextResponse } from 'next/server';

// Minimal middleware that doesn't interfere with navigation
export function middleware(request) {
  // Just logging the path for debugging purposes
  // Skip processing and allow all requests to proceed normally
  return NextResponse.next();
}

// Minimal matcher that only applies to critical paths
export const config = {
  matcher: [
    // We don't need to apply middleware to any routes now
    // This empty array means middleware doesn't run on any routes
    []
  ],
}; 