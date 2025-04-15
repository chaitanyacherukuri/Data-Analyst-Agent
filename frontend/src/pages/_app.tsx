import '../app/globals.css'
import { AppProps } from 'next/app'
import { useEffect } from 'react'

export default function MyApp({ Component, pageProps, router }: AppProps) {
  // Track page navigation
  useEffect(() => {
    // Log page changes for debugging
    console.log('Page changed to:', router.pathname)
    
    // If we're at the root path but have a session ID, redirect to analysis
    const sessionId = localStorage.getItem('lastSessionId')
    if (router.pathname === '/' && sessionId) {
      console.log('Session detected, checking if redirect needed...')
      
      // Get the last navigation timestamp to prevent redirect loops
      const lastNav = localStorage.getItem('lastNavTime')
      const now = Date.now()
      
      // Only redirect if we haven't redirected in the last 5 seconds
      if (!lastNav || now - parseInt(lastNav) > 5000) {
        console.log('Redirecting to analysis page')
        localStorage.setItem('lastNavTime', now.toString())
        // Use window.location for hard navigation
        window.location.href = `/analysis/${sessionId}`
      }
    }
  }, [router.pathname])

  return <Component {...pageProps} />
} 