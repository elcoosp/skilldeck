'use client'

import { useEffect, useRef, useState } from 'react'

export function useTypingAnimation(text: string, speed: number = 30, startDelay: number = 500) {
	const indexRef = useRef(0)
	const [displayText, setDisplayText] = useState(() => '')
	const [isComplete, setIsComplete] = useState(() => false)
	const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
	const textRef = useRef(text)
	const prevTextRef = useRef(text)

	useEffect(() => {
		// Only restart if text content actually changed
		if (text === prevTextRef.current) return
		prevTextRef.current = text
		textRef.current = text

		indexRef.current = 0
		setDisplayText('')
		setIsComplete(false)

		timeoutRef.current = setTimeout(() => {
			const type = () => {
				if (indexRef.current < textRef.current.length) {
					setDisplayText((prev) => prev + textRef.current[indexRef.current])
					indexRef.current += 1
					timeoutRef.current = setTimeout(type, speed)
				} else {
					setIsComplete(true)
				}
			}

			type()
		}, startDelay)

		return () => {
			if (timeoutRef.current !== null) {
				clearTimeout(timeoutRef.current)
			}
		}
	}, [text, speed, startDelay])

	return { displayText, isComplete }
}
