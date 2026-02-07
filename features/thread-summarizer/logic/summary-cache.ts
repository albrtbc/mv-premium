/**
 * In-Memory Summary Cache
 *
 * Caches summary results so users can re-view them without re-generating.
 * Clears automatically on page reload. TTL prevents showing stale results.
 */

import type { ThreadSummary } from './summarize'
import type { MultiPageSummary } from './summarize-multi-page'

// =============================================================================
// CONSTANTS
// =============================================================================

/** Cache entries expire after 5 minutes */
const CACHE_TTL_MS = 5 * 60 * 1000

// =============================================================================
// TYPES
// =============================================================================

interface CacheEntry<T> {
	data: T
	timestamp: number
}

// =============================================================================
// CACHE STORE
// =============================================================================

const singlePageCache = new Map<string, CacheEntry<ThreadSummary>>()
const multiPageCache = new Map<string, CacheEntry<MultiPageSummary>>()

function buildSingleKey(pageNumber: number): string {
	return `${window.location.pathname}:single:${pageNumber}`
}

function buildMultiKey(fromPage: number, toPage: number): string {
	return `${window.location.pathname}:multi:${fromPage}-${toPage}`
}

function isExpired(entry: CacheEntry<unknown>): boolean {
	return Date.now() - entry.timestamp > CACHE_TTL_MS
}

// =============================================================================
// SINGLE-PAGE CACHE
// =============================================================================

export function getCachedSingleSummary(pageNumber: number): ThreadSummary | null {
	const entry = singlePageCache.get(buildSingleKey(pageNumber))
	if (!entry || isExpired(entry)) {
		if (entry) singlePageCache.delete(buildSingleKey(pageNumber))
		return null
	}
	return entry.data
}

export function setCachedSingleSummary(pageNumber: number, summary: ThreadSummary): void {
	// Don't cache errors
	if (summary.error) return
	singlePageCache.set(buildSingleKey(pageNumber), { data: summary, timestamp: Date.now() })
}

export function getCachedSingleAge(pageNumber: number): number | null {
	const entry = singlePageCache.get(buildSingleKey(pageNumber))
	if (!entry || isExpired(entry)) return null
	return Date.now() - entry.timestamp
}

// =============================================================================
// MULTI-PAGE CACHE
// =============================================================================

export function getCachedMultiSummary(fromPage: number, toPage: number): MultiPageSummary | null {
	const entry = multiPageCache.get(buildMultiKey(fromPage, toPage))
	if (!entry || isExpired(entry)) {
		if (entry) multiPageCache.delete(buildMultiKey(fromPage, toPage))
		return null
	}
	return entry.data
}

export function setCachedMultiSummary(fromPage: number, toPage: number, summary: MultiPageSummary): void {
	// Don't cache errors
	if (summary.error) return
	multiPageCache.set(buildMultiKey(fromPage, toPage), { data: summary, timestamp: Date.now() })
}

export function getCachedMultiAge(fromPage: number, toPage: number): number | null {
	const entry = multiPageCache.get(buildMultiKey(fromPage, toPage))
	if (!entry || isExpired(entry)) return null
	return Date.now() - entry.timestamp
}

// =============================================================================
// UTILS
// =============================================================================

/** Formats cache age as human-readable string (e.g. "hace 2 min") */
export function formatCacheAge(ageMs: number): string {
	const seconds = Math.floor(ageMs / 1000)
	if (seconds < 60) return 'hace unos segundos'
	const minutes = Math.floor(seconds / 60)
	return `hace ${minutes} min`
}
