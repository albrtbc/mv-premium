import { describe, it, expect } from 'vitest'
import { renderInlineMarkdown, markdownToBBCode } from './render-inline-markdown'
import { renderToStaticMarkup } from 'react-dom/server'
import { isValidElement } from 'react'

// Helper: render React output to HTML string for easy assertion
function toHTML(node: React.ReactNode): string {
	if (typeof node === 'string') return node
	if (isValidElement(node)) return renderToStaticMarkup(node)
	return String(node)
}

describe('renderInlineMarkdown', () => {
	it('returns plain string when no markdown present', () => {
		const result = renderInlineMarkdown('Los usuarios debaten sobre el mercado laboral.')
		expect(result).toBe('Los usuarios debaten sobre el mercado laboral.')
	})

	it('converts **bold** to <strong>', () => {
		const result = renderInlineMarkdown('**Dificultad Extrema del Mercado Junior:** Los usuarios coinciden en que es muy difícil.')
		const html = toHTML(result)
		expect(html).toBe('<strong>Dificultad Extrema del Mercado Junior:</strong> Los usuarios coinciden en que es muy difícil.')
	})

	it('converts *italic* to <em>', () => {
		const result = renderInlineMarkdown('El debate está *en curso* todavía.')
		const html = toHTML(result)
		expect(html).toBe('El debate está <em>en curso</em> todavía.')
	})

	it('handles multiple bold segments', () => {
		const result = renderInlineMarkdown('**Punto 1:** algo importante y **Punto 2:** otra cosa.')
		const html = toHTML(result)
		expect(html).toBe('<strong>Punto 1:</strong> algo importante y <strong>Punto 2:</strong> otra cosa.')
	})

	it('handles text with asterisks that are not markdown (single *)', () => {
		const result = renderInlineMarkdown('Valoración: 3*5 = 15')
		// Single * without closing is not italic — returned as-is
		expect(result).toBe('Valoración: 3*5 = 15')
	})
})

describe('markdownToBBCode', () => {
	it('converts **bold** to [b]bold[/b]', () => {
		expect(markdownToBBCode('**Punto clave:** explicación')).toBe('[b]Punto clave:[/b] explicación')
	})

	it('converts *italic* to [i]italic[/i]', () => {
		expect(markdownToBBCode('El debate está *en curso*')).toBe('El debate está [i]en curso[/i]')
	})

	it('returns text unchanged when no markdown', () => {
		expect(markdownToBBCode('Texto normal sin formato')).toBe('Texto normal sin formato')
	})
})
