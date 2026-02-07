/**
 * Multi-Page Thread Fetcher
 *
 * Fetches and parses HTML from multiple thread pages.
 * Reuses extraction logic from extract-posts.ts adapted for parsed Documents.
 */

import { MV_SELECTORS } from '@/constants'
import { logger } from '@/lib/logger'
import type { ExtractedPost } from './extract-posts'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Max pages that can be fetched in a single multi-page summary */
export const MAX_MULTI_PAGES = 30

/** Max chars per post (slightly tighter for multi-page to save tokens) */
const MAX_CHARS_PER_POST = 1000

/** Min chars to keep a post after truncation */
const MIN_CHARS_PER_POST = 40

/** Concurrency limit for parallel fetches */
const FETCH_CONCURRENCY = 4

/** Delay between fetch batches to avoid rate limiting (ms) */
const FETCH_BATCH_DELAY = 200

// =============================================================================
// TYPES
// =============================================================================

export interface PageData {
	pageNumber: number
	posts: ExtractedPost[]
	postCount: number
	uniqueAuthors: string[]
}

export interface MultiPageFetchResult {
	pages: PageData[]
	totalPosts: number
	totalUniqueAuthors: number
	threadTitle: string
	fetchErrors: number[]
}

export interface MultiPageProgress {
	phase: 'fetching' | 'summarizing'
	current: number
	total: number
	/** For map-reduce: which batch is being summarized */
	batch?: number
	totalBatches?: number
}

// =============================================================================
// URL HELPERS
// =============================================================================

/**
 * Gets the base URL for the current thread (without page number).
 */
function getThreadBaseUrl(): string {
	const baseUrlInput = document.getElementById(MV_SELECTORS.GLOBAL.BASE_URL_INPUT_ID) as HTMLInputElement
	if (baseUrlInput?.value) return baseUrlInput.value

	const path = window.location.pathname
	const match = path.match(/^(\/foro\/[^/]+\/[^/]+)(?:\/\d+)?$/)
	return match ? match[1] : path.replace(/\/\d+$/, '')
}

/**
 * Builds the full URL for a specific page of the thread.
 */
function buildPageUrl(baseUrl: string, pageNumber: number): string {
	const params = new URLSearchParams(window.location.search)

	let relativePath: string
	if (params.has('u')) {
		if (pageNumber > 1) params.set('pagina', String(pageNumber))
		const queryString = params.toString()
		relativePath = queryString ? `${baseUrl}?${queryString}` : baseUrl
	} else {
		relativePath = pageNumber === 1 ? baseUrl : `${baseUrl}/${pageNumber}`
	}

	return relativePath.startsWith('/') ? `${window.location.origin}${relativePath}` : relativePath
}

/**
 * Gets total pages available for the current thread.
 */
export function getTotalPages(): number {
	let maxPage = 1

	// Check pagination links (numbered <a> elements)
	const paginationLinks = document.querySelectorAll<HTMLAnchorElement>(MV_SELECTORS.THREAD.PAGINATION_LINKS)
	for (const link of paginationLinks) {
		const match = link.href.match(/\/(\d+)$/)
		if (match) {
			const num = parseInt(match[1], 10)
			if (num > maxPage) maxPage = num
		}
	}

	// Check current page indicator (not a link, could be higher than any link)
	const currentPageEl = document.querySelector(MV_SELECTORS.THREAD.PAGINATION_CURRENT)
	if (currentPageEl?.textContent) {
		const num = parseInt(currentPageEl.textContent.trim(), 10)
		if (!isNaN(num) && num > maxPage) maxPage = num
	}

	return maxPage
}

/**
 * Gets the current page number from the URL.
 */
export function getCurrentPage(): number {
	const urlMatch = window.location.pathname.match(/\/(\d+)$/)
	if (urlMatch) return parseInt(urlMatch[1], 10)

	const activePage = document.querySelector(MV_SELECTORS.THREAD.PAGINATION_CURRENT)
	if (activePage?.textContent) {
		const num = parseInt(activePage.textContent.trim(), 10)
		if (!isNaN(num)) return num
	}

	return 1
}

// =============================================================================
// FETCH & PARSE
// =============================================================================

/**
 * Fetches the HTML of a single thread page and parses it into a Document.
 */
async function fetchPageDocument(url: string): Promise<Document> {
	const response = await fetch(url, {
		credentials: 'include',
		headers: { Accept: 'text/html' },
	})

	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`)
	}

	const html = await response.text()
	const parser = new DOMParser()
	return parser.parseFromString(html, 'text/html')
}

/**
 * Extracts posts from a parsed Document (not the live DOM).
 * Adapted from extract-posts.ts for parsed HTML documents.
 */
function extractPostsFromDocument(doc: Document): ExtractedPost[] {
	const posts: ExtractedPost[] = []
	const postElements = doc.querySelectorAll<HTMLElement>(`${MV_SELECTORS.THREAD.POST}, ${MV_SELECTORS.THREAD.POST_DIV}`)

	postElements.forEach(postEl => {
		try {
			const post = extractSinglePostFromElement(postEl)
			if (post && post.content.length > 3) {
				posts.push(post)
			}
		} catch (e) {
			logger.warn('Error extracting post from fetched page:', e)
		}
	})

	posts.sort((a, b) => a.number - b.number)
	return truncatePosts(posts)
}

/**
 * Extracts data from a single post element.
 */
function extractSinglePostFromElement(postEl: HTMLElement): ExtractedPost | null {
	const numAttr = postEl.getAttribute('data-num') || postEl.id?.replace('post-', '')
	const number = parseInt(numAttr || '0', 10)

	const authorEl = postEl.querySelector(MV_SELECTORS.THREAD.POST_AUTHOR_ALL)
	const author = authorEl?.textContent?.trim() || 'Anónimo'

	// Avatar
	const avatarEl = postEl.querySelector(MV_SELECTORS.THREAD.POST_AVATAR_IMG)
	let rawAvatar = avatarEl?.getAttribute('data-src') || avatarEl?.getAttribute('src')
	let avatarUrl: string | undefined

	if (rawAvatar) {
		if (rawAvatar.startsWith('//')) rawAvatar = 'https:' + rawAvatar
		else if (rawAvatar.startsWith('/')) rawAvatar = 'https://www.mediavida.com' + rawAvatar
		else if (!rawAvatar.startsWith('http')) rawAvatar = 'https://www.mediavida.com/img/users/avatar/' + rawAvatar
		avatarUrl = rawAvatar
	}

	const contentEl = postEl.querySelector(MV_SELECTORS.THREAD.POST_BODY_ALL)
	if (!contentEl) return null

	const content = cleanPostContent(contentEl)
	if (!content) return null

	const timeEl = postEl.querySelector(`${MV_SELECTORS.THREAD.POST_TIME}, ${MV_SELECTORS.THREAD.POST_TIME_ALT}`)
	const timestamp = timeEl?.getAttribute('datetime') || timeEl?.textContent?.trim()

	// Votes (manitas / thumbs up)
	const votesEl = postEl.querySelector(MV_SELECTORS.THREAD.POST_LIKE_COUNT)
	const votes = votesEl?.textContent?.trim() ? parseInt(votesEl.textContent.trim(), 10) : 0

	return { number, author, content, timestamp, charCount: content.length, avatarUrl, votes: votes || undefined }
}

/**
 * Cleans post content by removing quotes, spoilers, media, etc.
 */
function cleanPostContent(contentEl: Element): string {
	const clone = contentEl.cloneNode(true) as HTMLElement

	const selectorsToRemove = [
		'blockquote',
		'.cita',
		'.ref',
		'.spoiler',
		'.sp',
		'.edit',
		'.edited',
		'script',
		'style',
		'[data-s9e-mediaembed]',
		'.media-container',
		'.iframe-container',
		'.video-container',
		'img',
		'.post-signature',
		'.signature',
	]

	clone.querySelectorAll(selectorsToRemove.join(', ')).forEach(el => el.remove())
	return (clone.textContent || '').replace(/\s+/g, ' ').trim()
}

/**
 * Truncates posts to fit within token limits for multi-page processing.
 */
function truncatePosts(posts: ExtractedPost[]): ExtractedPost[] {
	return posts
		.map(post => {
			if (post.content.length > MAX_CHARS_PER_POST) {
				return {
					...post,
					content: post.content.substring(0, MAX_CHARS_PER_POST) + '...',
					charCount: MAX_CHARS_PER_POST + 3,
				}
			}
			return post
		})
		.filter(p => p.content.length > MIN_CHARS_PER_POST)
}

/**
 * Gets thread title from a parsed document.
 */
function getTitleFromDocument(doc: Document): string {
	const h1 = doc.querySelector(MV_SELECTORS.THREAD.THREAD_TITLE_ALL)
	return h1?.textContent?.trim() || ''
}

// =============================================================================
// MAIN MULTI-PAGE FETCH
// =============================================================================

/**
 * Fetches and extracts posts from multiple thread pages.
 * Uses controlled concurrency to avoid overwhelming the server.
 *
 * @param fromPage - Start page (inclusive)
 * @param toPage - End page (inclusive)
 * @param onProgress - Progress callback
 */
export async function fetchMultiplePages(
	fromPage: number,
	toPage: number,
	onProgress?: (progress: MultiPageProgress) => void
): Promise<MultiPageFetchResult> {
	const baseUrl = getThreadBaseUrl()
	const pageNumbers = Array.from({ length: toPage - fromPage + 1 }, (_, i) => fromPage + i)

	const pages: PageData[] = []
	const fetchErrors: number[] = []
	let threadTitle = ''

	// Fetch in batches with concurrency limit
	let fetchedCount = 0

	for (let i = 0; i < pageNumbers.length; i += FETCH_CONCURRENCY) {
		const batch = pageNumbers.slice(i, i + FETCH_CONCURRENCY)

		onProgress?.({
			phase: 'fetching',
			current: fetchedCount,
			total: pageNumbers.length,
		})

		const results = await Promise.allSettled(
			batch.map(async pageNum => {
				const url = buildPageUrl(baseUrl, pageNum)
				const doc = await fetchPageDocument(url)
				const posts = extractPostsFromDocument(doc)
				const authors = [...new Set(posts.map(p => p.author.toLowerCase()))]

				// Grab title from first successful fetch
				if (!threadTitle) {
					threadTitle = getTitleFromDocument(doc)
				}

				return { pageNumber: pageNum, posts, postCount: posts.length, uniqueAuthors: authors }
			})
		)

		results.forEach((result, idx) => {
			fetchedCount++
			if (result.status === 'fulfilled') {
				pages.push(result.value)
			} else {
				const failedPage = batch[idx]
				fetchErrors.push(failedPage)
				logger.warn(`Failed to fetch page ${failedPage}:`, result.reason)
			}
		})

		// Small delay between batches
		if (i + FETCH_CONCURRENCY < pageNumbers.length) {
			await new Promise(r => setTimeout(r, FETCH_BATCH_DELAY))
		}
	}

	// Emit final fetch progress (100% of fetch phase)
	onProgress?.({
		phase: 'fetching',
		current: pageNumbers.length,
		total: pageNumbers.length,
	})

	// Sort pages by number
	pages.sort((a, b) => a.pageNumber - b.pageNumber)

	// Aggregate stats
	const allAuthors = new Set<string>()
	let totalPosts = 0
	pages.forEach(p => {
		totalPosts += p.postCount
		p.uniqueAuthors.forEach(a => allAuthors.add(a))
	})

	// Fallback title from current page
	if (!threadTitle) {
		const h1 = document.querySelector(MV_SELECTORS.THREAD.THREAD_TITLE_ALL)
		threadTitle = h1?.textContent?.trim() || document.title.replace(' - Mediavida', '').trim()
	}

	return {
		pages,
		totalPosts,
		totalUniqueAuthors: allAuthors.size,
		threadTitle,
		fetchErrors,
	}
}
