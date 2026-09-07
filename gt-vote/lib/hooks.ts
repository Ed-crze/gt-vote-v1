'use client'
import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

export function useNavigate() {
  const router = useRouter()
  const [fadingOut, setFadingOut] = useState(false)

  const navigateTo = useCallback((url: string) => {
    setFadingOut(true)
    setTimeout(() => router.push(url), 350)
  }, [router])

  return { navigateTo, fadingOut }
}
