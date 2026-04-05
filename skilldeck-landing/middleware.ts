import { type NextRequest, NextResponse } from 'next/server'
import { AB_TESTS } from '@/lib/ab-tests'

// Simple deterministic hash
function hashCode(str: string): number {
	let hash = 0
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i)
		hash = (hash << 5) - hash + char
		hash |= 0
	}
	return Math.abs(hash)
}

export function middleware(request: NextRequest) {
	const response = NextResponse.next()
	const { searchParams } = request.nextUrl

	// ── A/B Test Assignment ───────────────────────────────
	for (const [testName, test] of Object.entries(AB_TESTS)) {
		const cookieName = `sd_${testName}`
		const existing = request.cookies.get(cookieName)

		if (!existing) {
			const hash = hashCode(request.headers.get('user-agent') || '')
			const variantIndex = hash % test.variants.length
			const variant = test.variants[variantIndex].key

			response.cookies.set(cookieName, variant, {
				maxAge: 60 * 60 * 24 * 30,
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
			})
		}
	}

	// ── UTM Capture (First-Touch Attribution) ────────────
	const utmKeys = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']
	const utmParams: Record<string, string> = {}

	const hasFirstTouch = request.cookies.has('sd_utm_first')

	for (const key of utmKeys) {
		const value = searchParams.get(key)
		if (value) utmParams[key] = value
	}

	if (Object.keys(utmParams).length > 0) {
		response.cookies.set('sd_utm_last', JSON.stringify(utmParams), {
			maxAge: 60 * 60 * 24 * 30,
			path: '/',
			httpOnly: true,
			sameSite: 'lax',
		})

		if (!hasFirstTouch) {
			response.cookies.set('sd_utm_first', JSON.stringify(utmParams), {
				maxAge: 60 * 60 * 24 * 365,
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
			})
		}
	}

	return response
}

export const config = {
	matcher: ['/((?!api|_next/static|_next/image|favicon.ico|illustrations).*)'],
}
