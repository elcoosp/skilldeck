'use client'

import { useLingui } from '@lingui/react/macro'
import { CheckCircle2, Loader2, Sparkles } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function WaitlistSection() {
	const { t } = useLingui()
	const [email, setEmail] = useState('')
	const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
	const [message, setMessage] = useState('')
	const [count, setCount] = useState<number | null>(null)
	const inputRef = useRef<HTMLInputElement>(null)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		if (!email.trim()) return
		setStatus('loading')
		setMessage('')
		try {
			const res = await fetch('/api/waitlist/subscribe', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: email.trim() }),
			})
			const data = await res.json()
			if (data.success) {
				setStatus('success')
				setMessage(data.message)
				if (data.count) setCount(data.count)
			} else {
				setStatus('error')
				setMessage(data.error || t`Something went wrong.`)
			}
		} catch {
			setStatus('error')
			setMessage(t`Network error. Please try again.`)
		}
	}

	return (
		<section className="relative py-24 sm:py-32" id="waitlist">
			<div className="absolute inset-0 overflow-hidden pointer-events-none">
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] bg-blue-500/10 rounded-full blur-[120px]" />
			</div>
			<div className="relative max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="text-center mb-10">
					<div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
						<Sparkles className="w-4 h-4" />
						{t`Join the Waitlist`}
					</div>
					<h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">{t`Be first in line`}</h2>
					<p className="mt-4 text-lg text-muted-foreground max-w-md mx-auto">{t`Get early access when we launch. No spam, no shared emails — just one notification when SkillDeck is ready.`}</p>
				</div>

				{status === 'success' ? (
					<div className="text-center space-y-4">
						<div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/10 border border-green-500/20">
							<CheckCircle2 className="w-7 h-7 text-green-400" />
						</div>
						<p className="text-lg font-medium text-foreground">{message}</p>
						{count !== null && (
							<p className="text-sm text-muted-foreground">{t`You're joining ${count.toLocaleString()} others on the waitlist.`}</p>
						)}
					</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="flex flex-col sm:flex-row gap-3">
							<Input
								ref={inputRef}
								type="email"
								required
								placeholder="you@example.com"
								value={email}
								onChange={(e) => {
									setEmail(e.target.value)
									if (status === 'error') setStatus('idle')
								}}
								disabled={status === 'loading'}
								className="flex-1 h-12 px-4 bg-white/5 border-border/50 text-foreground placeholder:text-muted-foreground focus:border-blue-500/50 focus:ring-blue-500/20"
							/>
							<Button
								type="submit"
								disabled={status === 'loading' || !email.trim()}
								size="lg"
								className="h-12 px-8 bg-gradient-to-r from-blue-600 to-blue-400 hover:from-blue-500 hover:to-blue-300 text-white border-0 shadow-lg shadow-blue-500/20 shrink-0"
							>
								{status === 'loading' ? (
									<>
										<Loader2 className="w-4 h-4 mr-2 animate-spin" />
										{t`Joining...`}
									</>
								) : (
									t`Join Waitlist`
								)}
							</Button>
						</div>
						{status === 'error' && <p className="text-sm text-red-400 text-center">{message}</p>}
						<p className="text-xs text-muted-foreground text-center">{t`MIT License · Built with Tauri 2 + Rust · Your data stays on your machine`}</p>
					</form>
				)}
			</div>
		</section>
	)
}
