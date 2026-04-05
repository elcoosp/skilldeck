'use client'

import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef } from 'react'
import { AB_TESTS } from '@/lib/ab-tests'

interface ABTestContextValue {
	getVariant: (testName: string) => string | null
}

const ABTestContext = createContext<ABTestContextValue>({
	getVariant: () => null,
})

function readCookie(name: string): string | null {
	if (typeof document === 'undefined') return null
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
	return match ? match[1] : null
}

function writeCookie(name: string, value: string, maxAge = 90 * 24 * 60 * 60) {
	if (typeof document === 'undefined') return
	document.cookie = `${name}=${value};path=/;max-age=${maxAge};SameSite=Lax`
}

function pickVariant(testName: string): string | null {
	const test = AB_TESTS[testName]
	if (!test?.variants.length) return null

	const cookieKey = `sd_${testName}`
	const existing = readCookie(cookieKey)
	if (existing) return existing

	// Weighted random assignment
	const totalWeight = test.variants.reduce((sum, v) => sum + v.traffic, 0)
	let rand = Math.random() * totalWeight
	for (const variant of test.variants) {
		rand -= variant.traffic
		if (rand <= 0) {
			writeCookie(cookieKey, variant.key)
			return variant.key
		}
	}

	// Fallback to first variant
	writeCookie(cookieKey, test.variants[0].key)
	return test.variants[0].key
}

export function ABTestProvider({ children }: { children: ReactNode }) {
	const initialized = useRef(false)

	useEffect(() => {
		if (initialized.current) return
		initialized.current = true

		// Assign variants for all registered tests that don't have cookies yet
		for (const testName of Object.keys(AB_TESTS)) {
			pickVariant(testName)
		}
	}, [])

	const getVariant = useCallback((testName: string): string | null => {
		const cookieKey = `sd_${testName}`
		return readCookie(cookieKey) ?? pickVariant(testName)
	}, [])

	return <ABTestContext.Provider value={{ getVariant }}>{children}</ABTestContext.Provider>
}

export function useABTest() {
	return useContext(ABTestContext)
}
