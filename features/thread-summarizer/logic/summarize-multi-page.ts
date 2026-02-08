/**
 * Multi-Page Thread Summarizer
 *
 * Summarizes multiple pages of a thread using a map-reduce approach:
 * - Pages ≤ 8: Single prompt with all posts combined
 * - Pages > 8: Summarize each group of ~8 pages → meta-summary from partial summaries
 *
 * Injects community stats (top posters, most-voted posts) into prompts
 * to improve participant selection and key point identification.
 */

import { getAIService } from '@/services/ai/gemini-service'
import { parseAIJsonResponse } from '@/services/ai/shared'
import { logger } from '@/lib/logger'
import { fetchMultiplePages, getProviderMultiPageLimit, type MultiPageProgress, type PageData } from './fetch-pages'
import { formatPostsForPrompt } from './extract-posts'

// =============================================================================
// TYPES
// =============================================================================

export interface MultiPageSummary {
	topic: string
	keyPoints: string[]
	participants: { name: string; contribution: string; avatarUrl?: string }[]
	status: string
	// Metadata
	title: string
	totalPostsAnalyzed: number
	totalUniqueAuthors: number
	pagesAnalyzed: number
	pageRange: string
	fetchErrors: number[]
	generationMs?: number
	modelUsed?: string
	error?: string
}

// =============================================================================
// CONSTANTS
// =============================================================================

// GEMINI LIMITS (Original, High Performance)
const GEMINI_PAGES_PER_BATCH = 8
const GEMINI_MAX_CHARS_PER_BATCH = 40000

// GROQ LIMITS (Safer for Free Tier TPM)
const GROQ_PAGES_PER_BATCH = 4
const GROQ_MAX_CHARS_PER_BATCH = 16000

// GROQ THROTTLING (helps avoid 429 on long ranges like 30 pages)
const GROQ_LARGE_RANGE_THRESHOLD = 20
const GROQ_PAGES_PER_BATCH_LARGE_RANGE = 3
const GROQ_MAX_CHARS_PER_BATCH_LARGE_RANGE = 12000
const GROQ_DELAY_BETWEEN_CALLS_MS = 0
const GROQ_DELAY_BETWEEN_CALLS_MS_LARGE_RANGE = 0

function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms))
}

function getGroqLimits(totalRequestedPages: number): {
	pagesPerBatch: number
	maxCharsPerBatch: number
	delayBetweenCallsMs: number
} {
	if (totalRequestedPages >= GROQ_LARGE_RANGE_THRESHOLD) {
		return {
			pagesPerBatch: GROQ_PAGES_PER_BATCH_LARGE_RANGE,
			maxCharsPerBatch: GROQ_MAX_CHARS_PER_BATCH_LARGE_RANGE,
			delayBetweenCallsMs: GROQ_DELAY_BETWEEN_CALLS_MS_LARGE_RANGE,
		}
	}

	return {
		pagesPerBatch: GROQ_PAGES_PER_BATCH,
		maxCharsPerBatch: GROQ_MAX_CHARS_PER_BATCH,
		delayBetweenCallsMs: GROQ_DELAY_BETWEEN_CALLS_MS,
	}
}

// =============================================================================
// DYNAMIC LIMITS
// =============================================================================

/**
 * Returns scaled limits for key points and participants based on page count.
 */
function getScaledLimits(pageCount: number): { maxKeyPoints: number; maxParticipants: number } {
	if (pageCount <= 3) return { maxKeyPoints: 5, maxParticipants: 5 }
	if (pageCount <= 7) return { maxKeyPoints: 7, maxParticipants: 8 }
	if (pageCount <= 15) return { maxKeyPoints: 9, maxParticipants: 10 }
	if (pageCount <= 25) return { maxKeyPoints: 12, maxParticipants: 14 }
	return { maxKeyPoints: 15, maxParticipants: 16 }
}

// =============================================================================
// COMMUNITY STATS
// =============================================================================

/**
 * Builds a stats block from all fetched posts to inject into the AI prompt.
 * Includes top posters by post count and most-voted posts by the community.
 */
function buildStatsBlock(pages: PageData[]): string {
	const postCounts = new Map<string, number>()
	const votedPosts: { number: number; author: string; votes: number }[] = []

	for (const page of pages) {
		for (const post of page.posts) {
			postCounts.set(post.author, (postCounts.get(post.author) || 0) + 1)
			if (post.votes && post.votes > 0) {
				votedPosts.push({ number: post.number, author: post.author, votes: post.votes })
			}
		}
	}

	const topPosters = [...postCounts.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([author, count]) => `${author} (${count})`)
		.join(', ')

	const topVoted = votedPosts
		.sort((a, b) => b.votes - a.votes)
		.slice(0, 10)
		.map(p => `#${p.number} por ${p.author} (${p.votes} votos)`)
		.join(', ')

	let block = `ESTADISTICAS DEL HILO:\n- Usuarios mas activos (por nº de posts): ${topPosters}`
	if (topVoted) {
		block += `\n- Posts mas votados por la comunidad: ${topVoted}`
	}
	return block
}

// =============================================================================
// PROMPTS - GEMINI (Standard JSON)
// =============================================================================

function buildSingleBatchPromptGemini(pageCount: number): string {
	const { maxKeyPoints, maxParticipants } = getScaledLimits(pageCount)

	return `Eres un analista de foros. Tu trabajo es resumir MULTIPLES PAGINAS de un hilo de Mediavida y devolver un objeto JSON valido.

FORMATO DE SALIDA (JSON estrictamente valido):
{
  "topic": "Una frase concisa explicando el tema principal del hilo en estas paginas.",
  "keyPoints": [
    "Punto clave 1",
    "Punto clave 2",
    "... (hasta ${maxKeyPoints} puntos clave)"
  ],
  "participants": [
    { "name": "Usuario1", "contribution": "Resumen breve de su postura o aporte principal" },
    { "name": "Usuario2", "contribution": "Resumen breve de su postura o aporte principal" },
    "... (hasta ${maxParticipants} participantes destacados)"
  ],
  "status": "Una frase sobre el estado general del debate en estas paginas."
}

REGLAS ESTRICTAS:
- Devuelve SOLO el JSON. No incluyas bloques de codigo markdown.
- El JSON debe ser valido.
- Resume TODOS los posts que te paso, dando una vision global.
- Ignora posts sin contenido ("pole", "+1").
- Identifica los temas principales y como evolucionan entre paginas.
- Incluye hasta ${maxParticipants} participantes, priorizando los mas activos y relevantes.
- Los posts marcados con [👍N] tienen N votos de la comunidad. Los posts muy votados suelen contener opiniones o informacion especialmente relevante. Tenlos en cuenta para los puntos clave y participantes.
- Usa las ESTADISTICAS DEL HILO como referencia objetiva para seleccionar participantes destacados, pero no te limites solo a los que mas postean: alguien con pocos posts pero muy votados puede ser mas relevante.
- Incluye hasta ${maxKeyPoints} puntos clave.
- Responde en espanol.
- IMPORTANTE: El bloque JSON final debe ser válido y contener toda la información solicitada.`
}

function buildMetaSummaryPromptGemini(pageCount: number): string {
	const { maxKeyPoints, maxParticipants } = getScaledLimits(pageCount)

	return `Eres un analista de foros. Te voy a dar RESUMENES PARCIALES de diferentes secciones de un hilo largo de Mediavida. Tu trabajo es crear UN UNICO RESUMEN GLOBAL coherente combinando todos los parciales.

FORMATO DE SALIDA (JSON estrictamente valido):
{
  "topic": "El tema principal del hilo completo.",
  "keyPoints": [
    "Punto clave 1 (los mas importantes de todo el hilo)",
    "Punto clave 2",
    "... (hasta ${maxKeyPoints} puntos clave)"
  ],
  "participants": [
    { "name": "Usuario1", "contribution": "Su aportacion general al hilo" },
    { "name": "Usuario2", "contribution": "Su aportacion general al hilo" },
    "... (hasta ${maxParticipants} participantes destacados)"
  ],
  "status": "Estado final del debate considerando toda la evolucion del hilo."
}

REGLAS ESTRICTAS:
- Devuelve SOLO el JSON. No incluyas bloques de codigo markdown.
- El JSON debe ser valido.
- Combina los resumenes parciales en UN UNICO resumen coherente.
- No repitas informacion redundante entre secciones.
- Prioriza los puntos mas relevantes e impactantes.
- Si un tema evoluciona entre secciones, describe la evolucion.
- Los participantes deben ser los MAS destacados en todo el hilo (hasta ${maxParticipants}).
- Usa las ESTADISTICAS DEL HILO como referencia objetiva. Alguien con pocos posts pero muy votados puede ser mas relevante que alguien que postea mucho sin impacto.
- Responde en espanol.
- IMPORTANTE: El bloque JSON final debe ser válido.`
}

// =============================================================================
// PROMPTS - GROQ (JSON only)
// =============================================================================

function buildSingleBatchPromptGroq(pageCount: number): string {
	const { maxKeyPoints, maxParticipants } = getScaledLimits(pageCount)

	return `Eres un analista de foros experto. Tu trabajo es resumir MULTIPLES PAGINAS de un hilo de Mediavida y devolver un objeto JSON valido.

FORMATO DE SALIDA (JSON estrictamente valido):
{
  "topic": "Una frase concisa y DETALLADA explicando el tema principal específico.",
  "keyPoints": [
    "Punto clave 1 (con nombres propios y argumentos concretos)",
    "Punto clave 2",
    "... (hasta ${maxKeyPoints} puntos clave)"
  ],
  "participants": [
    { "name": "Usuario1", "contribution": "Resumen de su postura. Si tiene votos, indícalo como '(N votos)' al final." },
    { "name": "Usuario2", "contribution": "Resumen de su postura." },
    "... (hasta ${maxParticipants} participantes destacados)"
  ],
  "status": "Una frase sobre el estado actual del debate."
}

REGLAS ESTRICTAS:
- Devuelve SOLO el JSON. No incluyas bloques de codigo markdown.
- El JSON debe ser valido.
- Resume TODOS los posts que te paso, dando una vision global.
- EVITA FRASES GENÉRICAS como "Se discute sobre X". Di QUÉ se dice sobre X.
- Ignora posts sin contenido ("pole", "+1").
- Identifica los temas principales y como evolucionan entre paginas.
- Incluye hasta ${maxParticipants} participantes, priorizando los mas activos y relevantes.
- Los posts marcados con [👍N] tienen N votos de la comunidad. Son MUY importantes.
  - Al citar participantes con muchos votos, menciona los votos explícitamente en español: "(15 votos)", NO uses inglés como "15-vote post".
- Usa las ESTADISTICAS DEL HILO como referencia objetiva.
- Incluye hasta ${maxKeyPoints} puntos clave.
- RESPUESTA 100% EN ESPAÑOL. No uses términos en inglés.
- IMPORTANTE: Tu respuesta debe empezar con { y terminar con }. Sin texto antes ni después.`
}

function buildMetaSummaryPromptGroq(pageCount: number): string {
	const { maxKeyPoints, maxParticipants } = getScaledLimits(pageCount)

	return `Eres un analista de foros experto. Te voy a dar RESUMENES PARCIALES de diferentes secciones de un hilo largo de Mediavida. Tu trabajo es crear UN UNICO RESUMEN GLOBAL coherente combinando todos los parciales.

FORMATO DE SALIDA (JSON estrictamente valido):
{
  "topic": "El tema principal del hilo completo, detallado y específico.",
  "keyPoints": [
    "Punto clave 1 (los mas importantes de todo el hilo, con detalles concretos)",
    "Punto clave 2",
    "... (hasta ${maxKeyPoints} puntos clave)"
  ],
  "participants": [
    { "name": "Usuario1", "contribution": "Su aportacion general al hilo. Si es muy votado, indícalo como '(N votos)'." },
    { "name": "Usuario2", "contribution": "Su aportacion general al hilo" },
    "... (hasta ${maxParticipants} participantes destacados)"
  ],
  "status": "Estado final del debate considerando toda la evolucion del hilo."
}

REGLAS ESTRICTAS:
- Devuelve SOLO el JSON. No incluyas bloques de codigo markdown.
- El JSON debe ser valido.
- Combina los resumenes parciales en UN UNICO resumen coherente.
- No repitas informacion redundante entre secciones.
- EVITA GENERALIDADES. No digas "hubo debate", di "X argumentó Y contra Z".
- Prioriza los puntos mas relevantes e impactantes.
- Si un tema evoluciona entre secciones, describe la evolucion.
- Los participantes deben ser los MAS destacados en todo el hilo (hasta ${maxParticipants}).
- Si mencionas votos, hazlo EN ESPAÑOL: "(15 votos)", NO en inglés ("15-vote post").
- Usa las ESTADISTICAS DEL HILO como referencia objetiva.
- RESPUESTA 100% EN ESPAÑOL.
- IMPORTANTE: Tu respuesta debe empezar con { y terminar con }. Sin texto antes ni después.`
}

// =============================================================================
// MAIN FUNCTION
// =============================================================================

/**
 * Summarizes multiple pages of a thread.
 *
 * @param fromPage - Start page (inclusive)
 * @param toPage - End page (inclusive)
 * @param onProgress - Progress callback for UI updates
 */
export async function summarizeMultiplePages(
	fromPage: number,
	toPage: number,
	onProgress?: (progress: MultiPageProgress) => void
): Promise<MultiPageSummary> {
	const aiService = await getAIService()

	if (!aiService) {
		return createErrorSummary('', fromPage, toPage, 'IA no configurada. Ve a Ajustes > Inteligencia Artificial.')
	}

	// Detect provider (gemini vs groq)
	// If getProvider is not available (legacy), assume gemini
	const provider = 'getProvider' in aiService ? aiService.getProvider() : 'gemini'
	const totalRequestedPages = Math.max(1, toPage - fromPage + 1)
	const providerMaxPages = getProviderMultiPageLimit(provider)

	// Multi-page mode is intentionally 2+ pages.
	if (totalRequestedPages < 2) {
		return createErrorSummary(
			'',
			fromPage,
			toPage,
			'Para resumir una sola página, usa el botón "Resumir" del hilo.'
		)
	}

	if (totalRequestedPages > providerMaxPages) {
		if (provider === 'groq') {
			return createErrorSummary(
				'',
				fromPage,
				toPage,
				`Con Groq (Kimi) el máximo es ${providerMaxPages} páginas por resumen debido a límites de tokens por minuto (TPM). Usa un rango más corto o cambia a Gemini para hasta 30 páginas.`
			)
		}

		return createErrorSummary(
			'',
			fromPage,
			toPage,
			`El máximo para este proveedor es ${providerMaxPages} páginas por resumen.`
		)
	}

	// SELECT LIMITS BASED ON PROVIDER
	const groqLimits = getGroqLimits(totalRequestedPages)
	const pagesPerBatch = provider === 'groq' ? groqLimits.pagesPerBatch : GEMINI_PAGES_PER_BATCH
	const maxCharsPerBatch = provider === 'groq' ? groqLimits.maxCharsPerBatch : GEMINI_MAX_CHARS_PER_BATCH
	const delayBetweenCallsMs = provider === 'groq' ? groqLimits.delayBetweenCallsMs : 0

	// 1. Fetch all pages
	const fetchResult = await fetchMultiplePages(fromPage, toPage, onProgress)

	if (fetchResult.pages.length === 0) {
		return createErrorSummary(
			fetchResult.threadTitle,
			fromPage,
			toPage,
			'No se pudieron obtener posts de las paginas solicitadas.'
		)
	}

	// Build avatar map from all pages
	const avatarMap = new Map<string, string>()
	fetchResult.pages.forEach(page => {
		page.posts.forEach(post => {
			if (post.avatarUrl && !avatarMap.has(post.author)) {
				avatarMap.set(post.author, post.avatarUrl)
			}
		})
	})

	try {
		let rawSummary: string

		const totalPages = fetchResult.pages.length
		const statsBlock = buildStatsBlock(fetchResult.pages)

		if (totalPages <= pagesPerBatch) {
			// Direct single-batch summarization
			onProgress?.({ phase: 'summarizing', current: 1, total: 2 })
			rawSummary = await summarizeBatch(
				aiService,
				fetchResult.threadTitle,
				fetchResult.pages,
				totalPages,
				statsBlock,
				provider,
				maxCharsPerBatch
			)
			onProgress?.({ phase: 'summarizing', current: 2, total: 2 })
		} else {
			// Map-reduce: split into batches
			const batches = splitIntoBatches(fetchResult.pages, pagesPerBatch)
			const partialSummaries: string[] = []
			const batchPageRanges: string[] = []

			for (let i = 0; i < batches.length; i++) {
				if (provider === 'groq' && i > 0) {
					await sleep(delayBetweenCallsMs)
				}

				onProgress?.({
					phase: 'summarizing',
					current: i + 1,
					total: batches.length + 1, // +1 for meta-summary
					batch: i + 1,
					totalBatches: batches.length,
				})

				const batch = batches[i]
				const rangeStart = batch[0].pageNumber
				const rangeEnd = batch[batch.length - 1].pageNumber
				batchPageRanges.push(`Paginas ${rangeStart}-${rangeEnd}`)

				const partial = await summarizeBatch(
					aiService,
					fetchResult.threadTitle,
					batch,
					batch.length,
					statsBlock,
					provider,
					maxCharsPerBatch
				)
				partialSummaries.push(partial)
			}

			// Meta-summary from partials
			if (provider === 'groq') {
				await sleep(delayBetweenCallsMs)
			}

			onProgress?.({
				phase: 'summarizing',
				current: batches.length + 1,
				total: batches.length + 1,
				batch: batches.length + 1,
				totalBatches: batches.length + 1,
			})

			rawSummary = await createMetaSummary(
				aiService,
				fetchResult.threadTitle,
				partialSummaries,
				batchPageRanges,
				fromPage,
				toPage,
				totalPages,
				statsBlock,
				provider
			)
		}

		type ParsedSummary = Omit<MultiPageSummary, 'title' | 'totalPostsAnalyzed' | 'totalUniqueAuthors' | 'pagesAnalyzed' | 'pageRange' | 'fetchErrors' | 'error'>
		const parsed = parseAIJsonResponse<ParsedSummary>(rawSummary)

		// Hydrate participants with avatars
		const participantsWithAvatars = parsed.participants.map(p => {
			const cleanName = p.name.toLowerCase().trim()
			let avatarUrl = avatarMap.get(p.name) || avatarMap.get(cleanName)

			if (!avatarUrl) {
				const matchedKey = Array.from(avatarMap.keys()).find(k => {
					const kLower = k.toLowerCase()
					return kLower.includes(cleanName) || cleanName.includes(kLower)
				})
				if (matchedKey) avatarUrl = avatarMap.get(matchedKey)
			}

			if (avatarUrl?.startsWith('//')) {
				avatarUrl = 'https:' + avatarUrl
			}

			return { ...p, avatarUrl }
		})

		return {
			...parsed,
			participants: participantsWithAvatars,
			title: fetchResult.threadTitle,
			totalPostsAnalyzed: fetchResult.totalPosts,
			totalUniqueAuthors: fetchResult.totalUniqueAuthors,
			pagesAnalyzed: fetchResult.pages.length,
			pageRange: `${fromPage}-${toPage}`,
			fetchErrors: fetchResult.fetchErrors,
		}
	} catch (error) {
		logger.error('MultiPageSummarizer error:', error)

		const errorMessage = error instanceof Error ? error.message : String(error)
		
		let userFriendlyError = 'Error al generar el resumen multi-pagina.'
		
		if (errorMessage.includes('429') || errorMessage.includes('TPM') || errorMessage.includes('Rate limit') || errorMessage.includes('Límite de velocidad') || errorMessage.includes('modelos agotados')) {
			userFriendlyError = 'Límite de velocidad excedido. El plan gratuito es limitado para resúmenes largos. Espera un momento o reduce el rango de páginas.'
		} else if (errorMessage.includes('400') || errorMessage.includes('too large') || errorMessage.includes('context length')) {
			userFriendlyError = 'Contenido demasiado largo para procesar. Intenta reducir el número de páginas.'
		} else if (errorMessage.includes('500') || errorMessage.includes('503')) {
			userFriendlyError = 'Error temporal del servidor. Inténtalo de nuevo.'
		}

		return createErrorSummary(fetchResult.threadTitle, fromPage, toPage, userFriendlyError)
	}
}

// =============================================================================
// BATCH PROCESSING
// =============================================================================

/**
 * Summarizes a single batch of pages in one AI call.
 */
async function summarizeBatch(
	aiService: { generate: (prompt: string) => Promise<string> },
	threadTitle: string,
	pages: PageData[],
	totalPageCount: number,
	statsBlock?: string,
	provider: 'gemini' | 'groq' = 'gemini',
	maxChars: number = GEMINI_MAX_CHARS_PER_BATCH
): Promise<string> {
	const pageRangeLabel =
		pages.length === 1
			? `Pagina ${pages[0].pageNumber}`
			: `Paginas ${pages[0].pageNumber}-${pages[pages.length - 1].pageNumber}`

	let formattedContent = ''
	for (const page of pages) {
		const formatted = formatPostsForPrompt(page.posts)
		formattedContent += `\n--- PAGINA ${page.pageNumber} (${page.postCount} posts) ---\n${formatted}\n`
	}

	// Truncate if total content is too large
	if (formattedContent.length > maxChars) {
		formattedContent = formattedContent.substring(0, maxChars) + '\n[...contenido truncado]'
	}

	const statsSection = statsBlock ? `\n${statsBlock}\n` : ''

	const promptBuilder = provider === 'groq' ? buildSingleBatchPromptGroq : buildSingleBatchPromptGemini
	const prompt = `${promptBuilder(totalPageCount)}

---
TITULO DEL HILO: ${threadTitle} (${pageRangeLabel})
${statsSection}
POSTS:
${formattedContent}`

	return aiService.generate(prompt)
}

/**
 * Creates a meta-summary from partial summaries using map-reduce.
 * Includes page range labels for each partial and global stats.
 */
async function createMetaSummary(
	aiService: { generate: (prompt: string) => Promise<string> },
	threadTitle: string,
	partialSummaries: string[],
	batchPageRanges: string[],
	fromPage: number,
	toPage: number,
	totalPageCount: number,
	statsBlock: string,
	provider: 'gemini' | 'groq' = 'gemini'
): Promise<string> {
	const formattedPartials = partialSummaries
		.map((summary, i) => {
			const rangeLabel = batchPageRanges[i] || `Seccion ${i + 1}`
			return `--- ${rangeLabel} ---\n${summary}`
		})
		.join('\n\n')

	const promptBuilder = provider === 'groq' ? buildMetaSummaryPromptGroq : buildMetaSummaryPromptGemini
	const prompt = `${promptBuilder(totalPageCount)}

---
TITULO DEL HILO: ${threadTitle}
RANGO DE PAGINAS: ${fromPage} a ${toPage}

${statsBlock}

RESUMENES PARCIALES:
${formattedPartials}`

	return aiService.generate(prompt)
}

/**
 * Splits pages into batches of the given size.
 */
function splitIntoBatches(pages: PageData[], batchSize: number): PageData[][] {
	const batches: PageData[][] = []
	for (let i = 0; i < pages.length; i += batchSize) {
		batches.push(pages.slice(i, i + batchSize))
	}
	return batches
}

// =============================================================================
// HELPERS
// =============================================================================

function createErrorSummary(title: string, fromPage: number, toPage: number, error: string): MultiPageSummary {
	return {
		topic: '',
		keyPoints: [],
		participants: [],
		status: '',
		title,
		totalPostsAnalyzed: 0,
		totalUniqueAuthors: 0,
		pagesAnalyzed: 0,
		pageRange: `${fromPage}-${toPage}`,
		fetchErrors: [],
		error,
	}
}
