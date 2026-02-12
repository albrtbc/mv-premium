import { describe, it, expect } from 'vitest'
import {
	renderTemplate,
	validateTemplate,
	createBlockId,
	createFieldBlock,
	createSectionBlock,
	createRawBlock,
	createEmptyTemplate,
	cloneTemplate,
} from './template-engine'
import type { MediaTemplate, MovieTemplateDataInput } from '@/types/templates'

// =============================================================================
// Test Data
// =============================================================================

const sampleMovieData: MovieTemplateDataInput = {
	title: 'El Caballero Oscuro',
	originalTitle: 'The Dark Knight',
	year: '2008',
	director: 'Christopher Nolan',
	screenplay: ['Jonathan Nolan', 'Christopher Nolan'],
	cast: ['Christian Bale', 'Heath Ledger', 'Aaron Eckhart', 'Michael Caine', 'Gary Oldman'],
	genres: ['Acción', 'Crimen', 'Drama'],
	runtime: 152,
	overview: 'Batman se enfrenta al Joker en una batalla por el alma de Gotham City.',
	posterUrl: 'https://image.tmdb.org/t/p/w500/poster.jpg',
	trailerUrl: 'https://www.youtube.com/watch?v=EXeTwQWrcwY',
	releaseDate: '2008-07-18',
	voteAverage: 8.5,
}

const createTestTemplate = (blocks: MediaTemplate['blocks']): MediaTemplate => ({
	id: 'test-template',
	type: 'movie',
	name: 'Test Template',
	blocks,
	isDefault: false,
	version: 1,
})

// =============================================================================
// renderTemplate Tests
// =============================================================================

describe('renderTemplate', () => {
	describe('field blocks', () => {
		it('should render a simple field', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'field',
					field: 'title',
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, sampleMovieData)
			expect(result).toBe('El Caballero Oscuro')
		})

		it('should render a field with label', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'field',
					field: 'director',
					label: '[b]Director:[/b] {{value}}',
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, sampleMovieData)
			expect(result).toBe('[b]Director:[/b] Christopher Nolan')
		})

		it('should render an array field with separator', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'field',
					field: 'cast',
					label: '[b]Reparto:[/b] {{value}}',
					separator: ', ',
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, sampleMovieData)
			expect(result).toBe('[b]Reparto:[/b] Christian Bale, Heath Ledger, Aaron Eckhart, Michael Caine, Gary Oldman')
		})

		it('should limit array items with maxItems', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'field',
					field: 'cast',
					maxItems: 3,
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, sampleMovieData)
			expect(result).toBe('Christian Bale, Heath Ledger, Aaron Eckhart')
		})

		it('should apply wrapper', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'field',
					field: 'posterUrl',
					wrapper: '[center][img]{{content}}[/img][/center]',
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, sampleMovieData)
			expect(result).toBe('[center][img]https://image.tmdb.org/t/p/w500/poster.jpg[/img][/center]')
		})

		it('should skip conditional field when value is empty', () => {
			const dataWithEmptyCast = { ...sampleMovieData, cast: [] }
			const template = createTestTemplate([
				{
					id: '1',
					type: 'field',
					field: 'cast',
					conditional: true,
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, dataWithEmptyCast)
			expect(result).toBe('')
		})

		it('should render field even when empty if conditional is false', () => {
			const dataWithEmptyDirector = { ...sampleMovieData, director: '' }
			const template = createTestTemplate([
				{
					id: '1',
					type: 'field',
					field: 'director',
					label: '[b]Director:[/b] {{value}}',
					conditional: false,
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, dataWithEmptyDirector)
			expect(result).toBe('[b]Director:[/b]')
		})

		it('should format runtime field', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'field',
					field: 'runtime',
					label: '[b]Duración:[/b] {{value}}',
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, sampleMovieData)
			expect(result).toBe('[b]Duración:[/b] 152 min')
		})

		it('should format date fields', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'field',
					field: 'releaseDate',
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, sampleMovieData)
			expect(result).toContain('2008')
			expect(result).toContain('julio')
		})
	})

	describe('section blocks', () => {
		it('should render a section bar', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'section',
					sectionTitle: 'SINOPSIS',
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, sampleMovieData)
			expect(result).toBe('[bar]SINOPSIS[/bar]')
		})

		it('should render a section with content field', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'section',
					sectionTitle: 'SINOPSIS',
					contentField: 'overview',
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, sampleMovieData)
			expect(result).toContain('[bar]SINOPSIS[/bar]')
			expect(result).toContain('Batman se enfrenta al Joker')
		})

		it('should skip section if content field is empty', () => {
			const dataWithEmptyOverview = { ...sampleMovieData, overview: '' }
			const template = createTestTemplate([
				{
					id: '1',
					type: 'section',
					sectionTitle: 'SINOPSIS',
					contentField: 'overview',
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, dataWithEmptyOverview)
			expect(result).toBe('')
		})
	})

	describe('raw blocks', () => {
		it('should render raw text', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'raw',
					rawText: '[center]Contenido personalizado[/center]',
					addLineBreak: false,
				},
			])

			const result = renderTemplate(template, sampleMovieData)
			expect(result).toBe('[center]Contenido personalizado[/center]')
		})
	})

	describe('complete templates', () => {
		it('should render a complete movie template', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'field',
					field: 'posterUrl',
					wrapper: '[center][img]{{content}}[/img][/center]',
				},
				{
					id: '2',
					type: 'field',
					field: 'director',
					label: '[b]Director:[/b] {{value}}',
				},
				{
					id: '3',
					type: 'field',
					field: 'cast',
					label: '[b]Reparto:[/b] {{value}}',
					maxItems: 3,
				},
				{
					id: '4',
					type: 'section',
					sectionTitle: 'SINOPSIS',
					contentField: 'overview',
				},
				{
					id: '5',
					type: 'field',
					field: 'trailerUrl',
					wrapper: '[bar]TRAILER[/bar]\n\n[media]{{content}}[/media]',
				},
			])

			const result = renderTemplate(template, sampleMovieData)

			expect(result).toContain('[center][img]https://image.tmdb.org/t/p/w500/poster.jpg[/img][/center]')
			expect(result).toContain('[b]Director:[/b] Christopher Nolan')
			expect(result).toContain('[b]Reparto:[/b] Christian Bale, Heath Ledger, Aaron Eckhart')
			expect(result).toContain('[bar]SINOPSIS[/bar]')
			expect(result).toContain('Batman se enfrenta al Joker')
			expect(result).toContain('[bar]TRAILER[/bar]')
			expect(result).toContain('[media]https://www.youtube.com/watch?v=EXeTwQWrcwY[/media]')
		})

		it('should add line breaks between blocks', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'field',
					field: 'title',
					addLineBreak: true,
				},
				{
					id: '2',
					type: 'field',
					field: 'director',
					addLineBreak: true,
				},
			])

			const result = renderTemplate(template, sampleMovieData)
			expect(result).toContain('\n\n')
		})

		it('should not have more than 2 consecutive newlines', () => {
			const template = createTestTemplate([
				{
					id: '1',
					type: 'field',
					field: 'title',
					addLineBreak: true,
				},
				{
					id: '2',
					type: 'raw',
					rawText: '',
					addLineBreak: true,
				},
				{
					id: '3',
					type: 'field',
					field: 'director',
					addLineBreak: true,
				},
			])

			const result = renderTemplate(template, sampleMovieData)
			expect(result).not.toMatch(/\n{3,}/)
		})
	})
})

// =============================================================================
// validateTemplate Tests
// =============================================================================

describe('validateTemplate', () => {
	it('should validate a correct template', () => {
		const template = createTestTemplate([
			{
				id: '1',
				type: 'field',
				field: 'title',
			},
		])

		const { valid, errors } = validateTemplate(template)
		expect(valid).toBe(true)
		expect(errors).toHaveLength(0)
	})

	it('should detect missing template ID', () => {
		const template = {
			id: '',
			type: 'movie' as const,
			name: 'Test',
			blocks: [],
		}

		const { valid, errors } = validateTemplate(template)
		expect(valid).toBe(false)
		expect(errors).toContain('Template must have an ID')
	})

	it('should detect missing block ID', () => {
		const template = createTestTemplate([
			{
				id: '',
				type: 'field',
				field: 'title',
			},
		])

		const { valid, errors } = validateTemplate(template)
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('must have an ID'))).toBe(true)
	})

	it('should detect missing field property in field block', () => {
		const template = createTestTemplate([
			{
				id: '1',
				type: 'field',
				field: '',
			},
		])

		const { valid, errors } = validateTemplate(template)
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('must have a field property'))).toBe(true)
	})

	it('should detect missing sectionTitle in section block', () => {
		const template = createTestTemplate([
			{
				id: '1',
				type: 'section',
				sectionTitle: '',
			},
		])

		const { valid, errors } = validateTemplate(template)
		expect(valid).toBe(false)
		expect(errors.some(e => e.includes('must have a sectionTitle property'))).toBe(true)
	})
})

// =============================================================================
// Helper Function Tests
// =============================================================================

describe('createBlockId', () => {
	it('should create unique IDs', () => {
		const id1 = createBlockId()
		const id2 = createBlockId()
		expect(id1).not.toBe(id2)
	})

	it('should have correct prefix', () => {
		const id = createBlockId()
		expect(id.startsWith('block_')).toBe(true)
	})
})

describe('createFieldBlock', () => {
	it('should create a field block with defaults', () => {
		const block = createFieldBlock('title')

		expect(block.type).toBe('field')
		expect(block.field).toBe('title')
		expect(block.conditional).toBe(true)
		expect(block.addLineBreak).toBe(true)
		expect(block.id).toBeTruthy()
	})

	it('should allow overriding defaults', () => {
		const block = createFieldBlock('cast', {
			label: '[b]Cast:[/b] {{value}}',
			maxItems: 5,
			conditional: false,
		})

		expect(block.label).toBe('[b]Cast:[/b] {{value}}')
		expect(block.maxItems).toBe(5)
		expect(block.conditional).toBe(false)
	})
})

describe('createSectionBlock', () => {
	it('should create a section block', () => {
		const block = createSectionBlock('SINOPSIS')

		expect(block.type).toBe('section')
		expect(block.sectionTitle).toBe('SINOPSIS')
		expect(block.addLineBreak).toBe(true)
	})

	it('should allow specifying content field', () => {
		const block = createSectionBlock('SINOPSIS', { contentField: 'overview' })

		expect(block.contentField).toBe('overview')
	})
})

describe('createRawBlock', () => {
	it('should create a raw block', () => {
		const block = createRawBlock('[center]Hello[/center]')

		expect(block.type).toBe('raw')
		expect(block.rawText).toBe('[center]Hello[/center]')
	})
})

describe('createEmptyTemplate', () => {
	it('should create an empty template', () => {
		const template = createEmptyTemplate('movie', 'Mi plantilla')

		expect(template.type).toBe('movie')
		expect(template.name).toBe('Mi plantilla')
		expect(template.blocks).toHaveLength(0)
		expect(template.isDefault).toBe(false)
	})
})

describe('cloneTemplate', () => {
	it('should clone a template with new ID', () => {
		const original = createTestTemplate([
			{
				id: '1',
				type: 'field',
				field: 'title',
			},
		])

		const cloned = cloneTemplate(original)

		expect(cloned.id).not.toBe(original.id)
		expect(cloned.name).toBe('Test Template (copia)')
		expect(cloned.blocks).toHaveLength(1)
		expect(cloned.blocks[0].id).not.toBe(original.blocks[0].id)
	})

	it('should allow specifying new name', () => {
		const original = createTestTemplate([])

		const cloned = cloneTemplate(original, 'Nueva plantilla')

		expect(cloned.name).toBe('Nueva plantilla')
	})
})
