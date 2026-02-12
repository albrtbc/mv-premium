import { createElement, Fragment } from 'react'

/**
 * Converts simple inline markdown (**bold**, *italic*) to React elements.
 * Returns plain string if no markdown is found, avoiding unnecessary wrappers.
 */
export function renderInlineMarkdown(text: string): React.ReactNode {
	// Fast path: no markdown markers at all
	if (!text.includes('*')) return text

	const parts: React.ReactNode[] = []
	// Match **bold** or *italic* segments
	const regex = /\*\*(.+?)\*\*|\*(.+?)\*/g
	let lastIndex = 0
	let match: RegExpExecArray | null
	let key = 0

	while ((match = regex.exec(text)) !== null) {
		// Add text before this match
		if (match.index > lastIndex) {
			parts.push(text.slice(lastIndex, match.index))
		}

		if (match[1] !== undefined) {
			// **bold**
			parts.push(createElement('strong', { key: key++ }, match[1]))
		} else if (match[2] !== undefined) {
			// *italic*
			parts.push(createElement('em', { key: key++ }, match[2]))
		}

		lastIndex = match.index + match[0].length
	}

	// No matches found — return plain string
	if (parts.length === 0) return text

	// Add remaining text after last match
	if (lastIndex < text.length) {
		parts.push(text.slice(lastIndex))
	}

	return createElement(Fragment, null, ...parts)
}

/**
 * Converts **bold** → [b]bold[/b] for BBCode clipboard output.
 * Also converts *italic* → [i]italic[/i].
 */
export function markdownToBBCode(text: string): string {
	return text.replace(/\*\*(.+?)\*\*/g, '[b]$1[/b]').replace(/\*(.+?)\*/g, '[i]$1[/i]')
}
