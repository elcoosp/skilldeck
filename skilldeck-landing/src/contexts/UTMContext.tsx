'use client'

import { createContext, type ReactNode, useContext, useState } from 'react'
import type { UTMParams } from '@/types/utm'

interface UTMContextValue {
	firstTouch: UTMParams | null
	lastTouch: UTMParams | null
}

const UTMContext = createContext<UTMContextValue>({
	firstTouch: null,
	lastTouch: null,
})

function readCookie(name: string): UTMParams | null {
	if (typeof document === 'undefined') return null
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
	if (!match) return null
	try {
		return JSON.parse(decodeURIComponent(match[1]))
	} catch {
		return null
	}
}

// Sentinel type to distinguish "not yet read" from "read and was null"
type MaybeUTM = UTMParams | null | undefined

export function UTMProvider({ children }: { children: ReactNode }) {
	const [firstTouch] = useState<MaybeUTM>(() => readCookie('sd_utm_first'))
	const [lastTouch] = useState<MaybeUTM>(() => readCookie('sd_utm_last'))

	return (
		<UTMContext.Provider value={{ firstTouch: firstTouch ?? null, lastTouch: lastTouch ?? null }}>
			{children}
		</UTMContext.Provider>
	)
}

export function useUTM() {
	return useContext(UTMContext)
}
