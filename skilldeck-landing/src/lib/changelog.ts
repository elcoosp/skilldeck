import fs from 'node:fs'
import path from 'node:path'

export function getChangelogContent(): string {
	try {
		const filePath = path.join(process.cwd(), 'src/content/changelog.md')
		return fs.readFileSync(filePath, 'utf-8')
	} catch {
		return ''
	}
}
