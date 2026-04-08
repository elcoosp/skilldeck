// src/hooks/use-app-version.ts

import { getVersion } from '@tauri-apps/api/app'
import { useEffect, useState } from 'react'

export function useAppVersion() {
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => {
        // Fallback for web preview / dev mode without Tauri
        setVersion('0.1.0-dev')
      })
  }, [])

  return version
}
