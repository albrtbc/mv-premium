import { DOM_MARKERS } from '@/constants'
import { logger } from '@/lib/logger'
import { extractThreadNumericId } from '@/lib/url-helpers'
import { getHiddenThreads, watchHiddenThreads } from './storage'
import { extractThreadPathFromRow } from './thread-utils'

const HIDDEN_THREAD_CLASS = DOM_MARKERS.CLASSES.HIDDEN_THREAD
const HIDDEN_THREAD_STYLE_ID = DOM_MARKERS.IDS.HIDDEN_THREADS_STYLES
const THREAD_ROWS_SELECTOR = 'tbody#temas tr, table#temas tbody tr'
const HIDDEN_THREADS_CACHE_KEY = 'mvp-hidden-threads-cache'
const EARLY_HIDDEN_THREAD_STYLE_IDS = ['mvp-hidden-threads-early', 'mvp-hidden-threads-early-fallback'] as const

let hiddenThreadIds = new Set<string>()
let initialized = false
let initializationPromise: Promise<void> | null = null
let unwatchHiddenThreads: (() => void) | null = null

function updateHiddenThreadsCache(): void {
	try {
		const numericIds = Array.from(hiddenThreadIds)
			.map(id => extractThreadNumericId(id))
			.filter((id): id is number => id !== null)
			.map(String)

		if (numericIds.length === 0) {
			localStorage.removeItem(HIDDEN_THREADS_CACHE_KEY)
			return
		}

		// Keep unique IDs and a stable order for deterministic cache updates.
		const unique = Array.from(new Set(numericIds)).sort((a, b) => Number(a) - Number(b))
		localStorage.setItem(HIDDEN_THREADS_CACHE_KEY, JSON.stringify(unique))
	} catch {
		// localStorage can fail in restricted contexts; ignore.
	}
}

function ensureHiddenThreadStyles(): void {
	if (document.getElementById(HIDDEN_THREAD_STYLE_ID)) return

	const style = document.createElement('style')
	style.id = HIDDEN_THREAD_STYLE_ID
	style.textContent = `
		.${HIDDEN_THREAD_CLASS} {
			display: none !important;
		}
	`
	document.head.appendChild(style)
}

function removeEarlyHiddenThreadStyles(): void {
	for (const styleId of EARLY_HIDDEN_THREAD_STYLE_IDS) {
		document.getElementById(styleId)?.remove()
	}
}

function updateRowsVisibility(): void {
	ensureHiddenThreadStyles()

	document.querySelectorAll<HTMLTableRowElement>(THREAD_ROWS_SELECTOR).forEach(row => {
		const threadPath = extractThreadPathFromRow(row)
		const shouldHide = threadPath ? hiddenThreadIds.has(threadPath) : false

		if (shouldHide) {
			row.classList.add(HIDDEN_THREAD_CLASS)
			return
		}

		row.classList.remove(HIDDEN_THREAD_CLASS)
	})
}

export function applyHiddenThreadsFilter(): void {
	if (!initialized && !initializationPromise) {
		void initHiddenThreadsFiltering()
		return
	}

	updateRowsVisibility()
}

export async function initHiddenThreadsFiltering(): Promise<void> {
	if (initialized) {
		updateRowsVisibility()
		return
	}

	if (initializationPromise) {
		await initializationPromise
		updateRowsVisibility()
		return
	}

	initializationPromise = (async () => {
		try {
			const threads = await getHiddenThreads()
			hiddenThreadIds = new Set(threads.map(thread => thread.id))
			updateHiddenThreadsCache()

			if (!unwatchHiddenThreads) {
				unwatchHiddenThreads = watchHiddenThreads(nextThreads => {
					hiddenThreadIds = new Set(nextThreads.map(thread => thread.id))
					updateHiddenThreadsCache()
					updateRowsVisibility()
				})
			}

			initialized = true
		} catch (error) {
			logger.error('Failed to initialize hidden threads filtering:', error)
			removeEarlyHiddenThreadStyles()
		}
	})()

	try {
		await initializationPromise
	} finally {
		initializationPromise = null
	}

	updateRowsVisibility()
	removeEarlyHiddenThreadStyles()
}
