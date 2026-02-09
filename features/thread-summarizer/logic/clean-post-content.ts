/**
 * Shared Post Content Cleaning
 *
 * Unified cleaning function for post content extraction.
 * Used by both thread summarizer (extract-posts, fetch-pages)
 * and individual post summarizer (summarize-post).
 */

export interface CleanPostContentOptions {
	/** Keep spoiler content visible (remove only trigger links). Default: false (removes all spoilers) */
	keepSpoilers?: boolean
	/** Remove code blocks (pre, code). Default: false */
	removeCodeBlocks?: boolean
}

/**
 * Base selectors always removed from post content.
 * Covers quotes, edits, scripts, media embeds, images, and signatures.
 */
const BASE_SELECTORS = [
	'.post-meta',
	'.post-meta-reply',
	'.post-controls',
	'blockquote',
	'.cita',
	'.ref',
	'.edit',
	'.edited',
	'script',
	'style',
	'[data-s9e-mediaembed]',
	'.twitter-tweet',
	'blockquote.twitter-tweet',
	'.instagram-media',
	'.tiktok-embed',
	'.fb-post',
	'.bluesky-embed',
	'iframe',
	'video',
	'audio',
	'object',
	'embed',
	'.media-container',
	'.iframe-container',
	'.video-container',
	'img',
	'.post-signature',
	'.signature',
]

/** Selectors for spoiler elements (trigger + content) */
const SPOILER_SELECTORS = ['.spoiler', '.sp']

/** Selectors for spoiler trigger links only (keep content) */
const SPOILER_TRIGGER_SELECTORS = ['.spoiler-wrap > a.spoiler']

/** Selectors for code blocks */
const CODE_SELECTORS = ['pre', 'code']

const MEDIA_URL_PATTERNS = [
	/^https?:\/\/(?:www\.)?(?:twitter\.com|x\.com)\/[^\s]+$/i,
	/^https?:\/\/(?:www\.)?instagram\.com\/[^\s]+$/i,
	/^https?:\/\/(?:www\.)?(?:tiktok\.com|vm\.tiktok\.com)\/[^\s]+$/i,
	/^https?:\/\/(?:www\.)?youtube\.com\/[^\s]+$/i,
	/^https?:\/\/(?:www\.)?youtu\.be\/[^\s]+$/i,
	/^https?:\/\/(?:www\.)?twitch\.tv\/[^\s]+$/i,
	/^https?:\/\/(?:www\.)?clips\.twitch\.tv\/[^\s]+$/i,
]

/**
 * Cleans post content by removing noise elements and normalizing whitespace.
 *
 * Default behavior (thread summarizer): removes quotes, spoilers, media, etc.
 * With `keepSpoilers: true`: keeps spoiler content, removes only trigger links.
 * With `removeCodeBlocks: true`: also removes pre/code elements.
 */
export function cleanPostContent(contentEl: Element, options: CleanPostContentOptions = {}): string {
	const { keepSpoilers = false, removeCodeBlocks = false } = options

	const clone = contentEl.cloneNode(true) as HTMLElement

	const selectors = [...BASE_SELECTORS]

	if (keepSpoilers) {
		// Only remove the trigger link, keep spoiler content
		selectors.push(...SPOILER_TRIGGER_SELECTORS)
		// Also remove .quote (used in summarize-post but not in thread summarizer)
		selectors.push('.quote')
	} else {
		// Remove all spoiler elements
		selectors.push(...SPOILER_SELECTORS)
	}

	if (removeCodeBlocks) {
		selectors.push(...CODE_SELECTORS)
	}

	clone.querySelectorAll(selectors.join(', ')).forEach(el => el.remove())

	// Remove bare media links that come from embed-only posts.
	clone.querySelectorAll<HTMLAnchorElement>('a[href]').forEach(anchor => {
		const href = (anchor.getAttribute('href') || '').trim()
		if (!isMediaOnlyUrl(href)) return

		const text = (anchor.textContent || '').trim()
		const normalizedHref = normalizeUrlLikeToken(href)
		const normalizedText = normalizeUrlLikeToken(text)
		const isBareUrl = !text || normalizedText === normalizedHref || /^https?:\/\//i.test(text)

		if (isBareUrl) {
			anchor.remove()
		}
	})

	const normalized = (clone.textContent || '').replace(/\s+/g, ' ').trim()
	return hasMeaningfulNonUrlText(normalized) ? normalized : ''
}

function isMediaOnlyUrl(url: string): boolean {
	return MEDIA_URL_PATTERNS.some(pattern => pattern.test(url))
}

function normalizeUrlLikeToken(value: string): string {
	return value.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '').trim().toLowerCase()
}

function hasMeaningfulNonUrlText(text: string): boolean {
	if (!text) return false

	const withoutUrls = text
		.replace(/https?:\/\/\S+/gi, ' ')
		.replace(/\bwww\.\S+/gi, ' ')
		.replace(/\s+/g, ' ')
		.trim()

	// If after stripping URLs there is no real text, treat as media-only/noise.
	return withoutUrls.length >= 3
}
