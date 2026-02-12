/**
 * Steam API Service
 * Fetches game details from Steam Store API
 *
 * Uses in-memory cache only (no persistent storage)
 */
import { logger } from '@/lib/logger'
import { API_URLS } from '@/constants'

// =============================================================================
// Types
// =============================================================================

export interface SteamGameDetails {
	appId: number
	name: string
	headerImage: string
	/**
	 * Best Spanish description available from Steam.
	 * Priority: about_the_game text (stripped HTML) → short_description fallback.
	 * May be empty if Steam has no text for this game.
	 */
	description: string
	isFree: boolean
	price: string | null
	originalPrice: string | null
	discountPercent: number
	releaseDate: string
	developers: string[]
	publishers: string[]
	genres: string[]
	metacriticScore: number | null
	metacriticUrl: string | null
	screenshots: string[]
	steamLibraryHeaderUrl: string
}

interface SteamPriceOverview {
	currency: string
	initial: number
	final: number
	discount_percent: number
	initial_formatted: string
	final_formatted: string
}

interface SteamApiResponse {
	[appId: string]: {
		success: boolean
		data?: {
			type: string
			name: string
			steam_appid: number
			required_age: number
			is_free: boolean
			short_description: string
			detailed_description?: string
			about_the_game?: string
			header_image: string
			website: string | null
			developers?: string[]
			publishers?: string[]
			price_overview?: SteamPriceOverview
			release_date?: {
				coming_soon: boolean
				date: string
			}
			genres?: Array<{ id: string; description: string }>
			metacritic?: {
				score: number
				url: string
			}
			screenshots?: Array<{ id: number; path_thumbnail: string; path_full: string }>
		}
	}
}

// Cache TTL (session only - no persistent storage)
const CACHE_TTL = 30 * 60 * 1000 // 30 minutes (session cache)

// In-memory cache for session
const memoryCache = new Map<number, { data: SteamGameDetails; timestamp: number }>()

// =============================================================================
// Helpers
// =============================================================================

/**
 * Strip HTML tags from Steam's detailed_description and convert to clean text.
 * Preserves paragraph structure with line breaks.
 */
function stripHtmlToPlainText(html: string): string {
	if (!html) return ''

	return (
		html
			// Replace block-level elements with newlines
			.replace(/<\/?(h[1-6]|p|div|br|li|ul|ol|tr)[^>]*>/gi, '\n')
			// Remove all remaining HTML tags
			.replace(/<[^>]+>/g, '')
			// Decode common HTML entities
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/&nbsp;/g, ' ')
			// Collapse multiple newlines
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	)
}

/**
 * Extract Steam App ID from various URL formats
 * Supports:
 * - https://store.steampowered.com/app/1091500/Cyberpunk_2077/
 * - https://store.steampowered.com/app/1091500
 * - store.steampowered.com/app/1091500
 */
export function extractSteamAppId(url: string): number | null {
	const match = url.match(/store\.steampowered\.com\/app\/(\d+)/i)
	return match ? parseInt(match[1], 10) : null
}

/**
 * Check if a URL is a Steam store link
 */
export function isSteamUrl(url: string): boolean {
	return /store\.steampowered\.com\/app\/\d+/i.test(url)
}

// =============================================================================
// Cache (memory-only, no persistent storage)
// =============================================================================

function getCachedGame(appId: number): SteamGameDetails | null {
	const cached = memoryCache.get(appId)
	if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
		return cached.data
	}
	// Clean up expired entry
	if (cached) {
		memoryCache.delete(appId)
	}
	return null
}

function setCachedGame(appId: number, data: SteamGameDetails): void {
	memoryCache.set(appId, {
		data,
		timestamp: Date.now(),
	})
}

// =============================================================================
// API Functions
// =============================================================================

/**
 * Fetch game details from Steam API
 *
 * @internal
 * ⚠️ USE ONLY IN BACKGROUND SCRIPT
 * Do not import directly in UI components. Use fetchSteamGameDetailsViaBackground.
 */
export async function fetchSteamGameDetails(appId: number): Promise<SteamGameDetails | null> {
	// Check memory cache first
	const cached = getCachedGame(appId)
	if (cached) {
		logger.debug('[Steam] Using cached data for app:', appId)
		return cached
	}

	try {
		const url = `${API_URLS.STEAM_STORE}/api/appdetails?appids=${appId}&l=spanish&cc=es`
		const response = await fetch(url)

		if (!response.ok) {
			throw new Error(`HTTP ${response.status}`)
		}

		const json: SteamApiResponse = await response.json()
		const appData = json[appId.toString()]

		if (!appData?.success || !appData.data) {
			logger.warn('[Steam] No data found for app:', appId)
			return null
		}

		const data = appData.data

		const aboutText = stripHtmlToPlainText(data.about_the_game || '')

		const gameDetails: SteamGameDetails = {
			appId,
			name: data.name,
			headerImage: data.header_image,
			// Use about_the_game text if available, otherwise fall back to short_description
			description: aboutText || data.short_description || '',
			isFree: data.is_free,
			price: data.price_overview?.final_formatted || null,
			originalPrice: data.price_overview?.initial_formatted || null,
			discountPercent: data.price_overview?.discount_percent || 0,
			releaseDate: data.release_date?.date || 'Por anunciar',
			developers: data.developers || [],
			publishers: data.publishers || [],
			genres: data.genres?.map(g => g.description) || [],
			metacriticScore: data.metacritic?.score || null,
			metacriticUrl: data.metacritic?.url || null,
			screenshots: data.screenshots?.map(s => s.path_full) || [],
			steamLibraryHeaderUrl: `https://cdn.akamai.steamstatic.com/steam/apps/${appId}/library_header_2x.jpg`,
		}

		// Cache the result in memory
		setCachedGame(appId, gameDetails)

		return gameDetails
	} catch (error) {
		logger.error('[Steam] Failed to fetch game details:', error)
		return null
	}
}

import { sendMessage } from '@/lib/messaging'

/**
 * Fetch game details via background script (for content scripts)
 * This avoids CORS issues
 */
export async function fetchSteamGameDetailsViaBackground(appId: number): Promise<SteamGameDetails | null> {
	try {
		return await sendMessage('fetchSteamGame', appId)
	} catch (error) {
		logger.error('[Steam] Failed to fetch via background:', error)
		return null
	}
}
