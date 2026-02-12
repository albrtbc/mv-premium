/**
 * Centered Posts Mode Feature
 *
 * Hides the sidebar (.c-side) and expands posts to full width.
 * On thread pages, it also relocates critical controls to a horizontal bar.
 *
 * Active on:
 * - Thread pages (full mode with control bar)
 * - Spy and subforum listing pages (layout-only mode)
 */

import { storage } from '@wxt-dev/storage'
import { logger } from '@/lib/logger'
import { STORAGE_KEYS, MV_SELECTORS, EARLY_STYLE_IDS, RUNTIME_CACHE_KEYS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'
import { getCenteredPostsPageKind, type CenteredPostsPageKind } from '@/lib/content-modules/utils/page-detection'

const STYLE_ID = DOM_MARKERS.IDS.CENTERED_POSTS_STYLES
const EARLY_STYLE_ID = EARLY_STYLE_IDS.CENTERED_POSTS
const CONTROL_BAR_ID = DOM_MARKERS.IDS.CENTERED_CONTROL_BAR
const CACHE_KEY = RUNTIME_CACHE_KEYS.CENTERED_POSTS
const SETTINGS_KEY = `local:${STORAGE_KEYS.SETTINGS}` as `local:${string}`
const SIDE_LAYOUT_MIN_WIDTH = 1500
const RESIZE_DEBOUNCE_MS = 120
const SIDE_BAR_GAP_PX = 12
const SIDE_TOP_OFFSET_PX = 92
const SIDE_MIN_INSET_PX = 12
const SIDE_TOP_MIN_PX = 66
const SIDE_BAR_FALLBACK_WIDTH_PX = 332
const SIDE_BAR_MIN_WIDTH_PX = 220
const SIDE_BAR_MAX_WIDTH_PX = 420

type ControlBarPosition = 'top' | 'side'

let requestedEnabled = false
let requestedSticky = false
let requestedPosition: ControlBarPosition = 'top'
let appliedPosition: ControlBarPosition | null = null
let resizeDebounceId: number | undefined
let resizeListenerInitialized = false
let resizeRafId: number | undefined
let cachedSidebarWidthPx = SIDE_BAR_FALLBACK_WIDTH_PX
let sideStableTopPx: number | null = null

interface SettingsState {
	state: {
		centeredPostsEnabled: boolean
		centeredControlsSticky: boolean
		centeredControlsPosition?: ControlBarPosition
	}
}

/**
 * CSS styles to hide sidebar and expand posts
 * Uses 100% width - no dynamic calculations to prevent layout shift
 * @param sticky - Whether the control bar should be sticky (top mode only)
 * @param position - Position mode for the control bar
 */
function generateStyles(sticky: boolean, position: ControlBarPosition): string {
	return `
		/* MVP Centered Posts Mode */

		/* 1. Hide Sidebar completely */
		${MV_SELECTORS.GLOBAL.C_SIDE},
		.wrw > .c-side,
		#main .c-side {
			display: none !important;
		}

		/* 2. Content wrapper - force full width */
		${MV_SELECTORS.GLOBAL.CONTENT_WRAPPER},
		.wrw,
		#main > .wrw,
		#main.wrp > .wrw {
			display: block !important;
			width: 100% !important;
			max-width: none !important;
		}

		/* 3. Main Content Area - expand to full width */
		${MV_SELECTORS.GLOBAL.MAIN_CONTENT},
		.c-main,
		#post-container,
		.wrw > .c-main,
		#main .wrw .c-main,
		#main.wrp .wrw .c-main,
		div.c-main#post-container {
			width: 100% !important;
			max-width: none !important;
			padding-right: 0 !important;
			padding-left: 0 !important;
			float: none !important;
			display: block !important;
			margin-left: auto !important;
			margin-right: auto !important;
			flex: unset !important;
			box-sizing: border-box !important;
		}

		/* 4. Inner content container */
		.wpx,
		.c-main > .wpx,
		#post-container > .wpx {
			width: 100% !important;
			max-width: none !important;
			padding-left: 0 !important;
			padding-right: 0 !important;
			box-sizing: border-box !important;
		}

		/* 5. Topic block and control bar */
		#topic,
		.block#topic,
		.wpx > .block#topic,
		#${CONTROL_BAR_ID} {
			width: 100% !important;
			max-width: none !important;
			margin-left: auto !important;
			margin-right: auto !important;
			box-sizing: border-box !important;
		}

		/* 6. Posts container */
		#posts-wrap,
		#topic > #posts-wrap,
		.block#topic > #posts-wrap {
			width: 100% !important;
			max-width: none !important;
			margin-left: auto !important;
			margin-right: auto !important;
			box-sizing: border-box !important;
		}

		/* 7. Individual posts */
		.post,
		#posts-wrap > .post,
		div.post.cf {
			width: 100% !important;
			max-width: none !important;
			margin-left: auto !important;
			margin-right: auto !important;
			box-sizing: border-box !important;
		}

		/* 7b. Postit should match posts width */
		#postit.postit,
		.postit {
			width: 100% !important;
			max-width: none !important;
			margin-left: auto !important;
			margin-right: auto !important;
			box-sizing: border-box !important;
			position: relative !important;
			padding-top: 40px !important;
		}

		/* 7b-collapsed. Postit collapsed state - no extra padding */
		#postit.postit.oculto,
		.postit.oculto {
			padding-top: 0 !important;
		}

		/* 7c. Postit toggle button - preserve visibility and position */
		#postit.postit > a.toggle,
		.postit > a.toggle {
			position: absolute !important;
			top: 8px !important;
			right: 8px !important;
			z-index: 10 !important;
			display: flex !important;
			align-items: center !important;
			justify-content: center !important;
		}

		/* =====================================================
		   Control Bar - Horizontal button bar
		   ===================================================== */
		#${CONTROL_BAR_ID} {
			display: flex !important;
			flex-direction: row !important;
			flex-wrap: wrap !important;
			gap: 12px;
			align-items: center;
			justify-content: flex-start;
			padding: 12px 16px !important;
			margin-top: 16px !important;
			margin-bottom: 20px !important;
			width: 100% !important;
			background: var(--card, #1e1e1e);
			color: var(--card-foreground, #e7e9ea);
			border: 1px solid var(--border, rgba(128, 128, 128, 0.25));
			border-radius: var(--radius, 8px);
			box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
			box-sizing: border-box !important;
			${
				sticky
					? `
			position: sticky !important;
			top: 40px !important;
			z-index: 50 !important;
			`
					: ''
			}
		}

		/* Control Groups - horizontal layout */
		#${CONTROL_BAR_ID} .mvp-control-group {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 8px;
			flex-shrink: 0;
		}

		/* Vertical Separator between groups */
		#${CONTROL_BAR_ID} .mvp-control-separator {
			width: 1px;
			height: 24px;
			background: color-mix(in srgb, var(--border, rgba(128, 128, 128, 0.3)) 80%, transparent);
			flex-shrink: 0;
		}

		/* =====================================================
		   Native MV Elements inside control bar
		   ===================================================== */

		/* Reset all elements inside control bar */
		#${CONTROL_BAR_ID} * {
			float: none !important;
		}

		/* #topic-reply: Responder + Compartir buttons */
		#${CONTROL_BAR_ID} #topic-reply {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 8px;
			margin: 0 !important;
			border: none !important;
		}

		/* #more-actions: Native MV action icons (Favoritos, Ignorar, Resumen) */
		#${CONTROL_BAR_ID} #more-actions {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 8px;
			margin: 0 !important;
			border: none !important;
		}

		/* #topic-nav: Navigation arrows */
		#${CONTROL_BAR_ID} #topic-nav {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			flex-wrap: nowrap !important;
			gap: 10px;
			margin: 0 !important;
			width: auto !important;
			max-width: fit-content !important;
			border: none !important;
		}

		/* Keep nav controls compact in top mode to avoid wrapping to next line */
		#${CONTROL_BAR_ID} .mvp-nav-group {
			min-width: 0 !important;
		}

		#${CONTROL_BAR_ID} #topic-nav .pull-right,
		#${CONTROL_BAR_ID} #topic-nav a.btn-fid {
			display: none !important;
		}

		/* =====================================================
		   MVP Extra Actions (inside #more-actions)
		   ===================================================== */

		/* Main MVP container - make horizontal and remove all borders */
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.EXTRA_ACTIONS} {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 8px;
			margin: 0 !important;
			margin-top: 0 !important;
			padding: 0 !important;
			padding-top: 0 !important;
			border: none !important;
			border-top: none !important;
			width: auto !important;
		}

		/* Main actions row (Gallery, Save, Summarize) */
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.MAIN_ACTIONS} {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 6px;
			width: auto !important;
		}

		/* Hide the separator inside control bar */
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.EXTRA_ACTIONS_SEPARATOR} {
			display: none !important;
		}

		/* Status actions row (Live, Infinite Scroll) */
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.STATUS_ACTIONS} {
			display: flex !important;
			flex-direction: row !important;
			align-items: center !important;
			gap: 6px;
			width: auto !important;
		}

		/* =====================================================
		   Button containers (ensure proper sizing)
		   ===================================================== */
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.LIVE_BUTTON_CONTAINER},
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.INFINITE_SCROLL_BUTTON_CONTAINER},
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.SAVE_THREAD_CONTAINER},
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.GALLERY_BTN} {
			display: flex !important;
			align-items: center !important;
		}

		/* Navigation arrows spacing */
		#${CONTROL_BAR_ID} #topic-nav a {
			margin: 0 !important;
		}

		/* Force pointer cursor for action buttons */
		#${CONTROL_BAR_ID} a,
		#${CONTROL_BAR_ID} button,
		#${CONTROL_BAR_ID} [role='button'] {
			cursor: pointer !important;
		}

		${
			position === 'side'
				? `
		/* =====================================================
		   Side Mode - Floating rail (does not consume thread width)
		   ===================================================== */
		#${CONTROL_BAR_ID} {
			position: fixed !important;
			top: ${SIDE_TOP_OFFSET_PX}px !important;
			left: calc(100vw - ${SIDE_BAR_FALLBACK_WIDTH_PX + SIDE_MIN_INSET_PX}px) !important;
			right: auto !important;
			transform: none !important;
			z-index: 120 !important;
			width: ${SIDE_BAR_FALLBACK_WIDTH_PX}px !important;
			max-width: min(${SIDE_BAR_MAX_WIDTH_PX}px, calc(100vw - ${SIDE_MIN_INSET_PX * 2}px)) !important;
			margin: 0 !important;
			margin-top: 0 !important;
			margin-bottom: 0 !important;
			padding: 0 !important;
			flex-direction: column !important;
			flex-wrap: nowrap !important;
			align-items: stretch !important;
			gap: 0 !important;
			max-height: calc(100vh - 100px) !important;
			overflow-y: auto !important;
			overflow-x: hidden !important;
			background: transparent !important;
			color: inherit !important;
			border: none !important;
			border-radius: 0 !important;
			box-shadow: none !important;
		}

		#${CONTROL_BAR_ID} .mvp-control-group {
			display: block !important;
			width: 100% !important;
		}

		#${CONTROL_BAR_ID} .mvp-control-separator {
			width: 100%;
			height: 1px;
			margin: 10px 0;
			background: color-mix(in srgb, var(--border, #30353a) 80%, transparent);
		}

		#${CONTROL_BAR_ID} .mvp-reply-group + .mvp-control-separator {
			display: none !important;
		}

		#${CONTROL_BAR_ID} #topic-reply,
		#${CONTROL_BAR_ID} #more-actions,
		#${CONTROL_BAR_ID} #topic-nav {
			display: block !important;
			width: 100% !important;
			padding: 0 !important;
			border: none !important;
		}

		#${CONTROL_BAR_ID} #topic-reply,
		#${CONTROL_BAR_ID} #more-actions {
			margin: 0 !important;
			padding: 0 !important;
		}

		#${CONTROL_BAR_ID} #more-actions {
			margin-top: 10px !important;
		}

		#${CONTROL_BAR_ID} #topic-reply a,
		#${CONTROL_BAR_ID} #more-actions > a,
		#${CONTROL_BAR_ID} #more-actions .post-btn {
			margin-right: 3px !important;
			margin-bottom: 3px !important;
		}

		#${CONTROL_BAR_ID} #topic-reply a:last-child,
		#${CONTROL_BAR_ID} #more-actions > a:last-child,
		#${CONTROL_BAR_ID} #more-actions .post-btn:last-child {
			margin-right: 0 !important;
		}

		#${CONTROL_BAR_ID} #topic-reply a > i,
		#${CONTROL_BAR_ID} #more-actions > a > i,
		#${CONTROL_BAR_ID} #more-actions .post-btn > i {
			margin-right: 5px !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.MAIN_ACTIONS} #${DOM_MARKERS.IDS.GALLERY_BTN} {
			display: inline-flex !important;
			order: 99 !important;
			flex-basis: auto !important;
			align-self: flex-start !important;
			width: auto !important;
			max-width: none !important;
			margin-top: 0 !important;
		}

		#${CONTROL_BAR_ID} #topic-nav a {
			display: inline-flex !important;
			align-items: center !important;
			justify-content: center !important;
			float: none !important;
			margin: 0 8px 0 0 !important;
		}

		#${CONTROL_BAR_ID} #topic-nav a:last-child {
			margin-right: 0 !important;
		}

		#${CONTROL_BAR_ID} #topic-nav a.btn-fid,
		#${CONTROL_BAR_ID} #topic-nav .pull-right {
			display: none !important;
		}

		#${CONTROL_BAR_ID} #topic-reply,
		#${CONTROL_BAR_ID} #more-actions,
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.EXTRA_ACTIONS},
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.MAIN_ACTIONS},
		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.STATUS_ACTIONS} {
			text-align: left !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.EXTRA_ACTIONS} {
			display: flex !important;
			flex-direction: column !important;
			align-items: stretch !important;
			gap: 8px !important;
			margin-top: 12px !important;
			padding-top: 12px !important;
			border-top: 1px solid rgba(128, 128, 128, 0.2) !important;
			width: 100% !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.MAIN_ACTIONS} {
			display: flex !important;
			flex-wrap: wrap !important;
			align-items: center !important;
			justify-content: flex-start !important;
			align-content: flex-start !important;
			width: 100% !important;
			gap: 4px !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.MAIN_ACTIONS} > * {
			flex: 0 0 auto !important;
			margin: 0 !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.EXTRA_ACTIONS_SEPARATOR} {
			display: none !important;
			border-top: 1px solid rgba(128, 128, 128, 0.1) !important;
			margin: 0 !important;
			width: 100% !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.EXTRA_ACTIONS}:has(#${DOM_MARKERS.IDS.STATUS_ACTIONS} > *) #${DOM_MARKERS.IDS.EXTRA_ACTIONS_SEPARATOR} {
			display: block !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.STATUS_ACTIONS} {
			display: flex !important;
			flex-wrap: wrap !important;
			align-items: center !important;
			justify-content: flex-start !important;
			align-content: flex-start !important;
			gap: 6px !important;
			width: 100% !important;
			margin: 0 !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.SAVE_THREAD_CONTAINER} .mvp-save-thread-label {
			display: none !important;
		}

		#${CONTROL_BAR_ID} #${DOM_MARKERS.IDS.SAVE_THREAD_CONTAINER} i {
			margin-right: 0 !important;
		}
		`
				: ''
		}

		/* 8. Side navigation - align with content edge (always, not just when affix) */
		#side-nav {
			transform: translateX(-11px) !important;
		}
	`
}

/**
 * Updates localStorage cache for instant access on next page load
 */
function updateCache(enabled: boolean): void {
	try {
		if (enabled) {
			localStorage.setItem(CACHE_KEY, 'true')
		} else {
			localStorage.removeItem(CACHE_KEY)
		}
	} catch {
		// localStorage might be disabled
	}
}

function resolveControlBarPosition(
	requested: ControlBarPosition,
	pageKind: CenteredPostsPageKind
): ControlBarPosition {
	if (pageKind !== 'thread') return 'top'
	if (requested !== 'side') return 'top'
	return window.innerWidth >= SIDE_LAYOUT_MIN_WIDTH ? 'side' : 'top'
}

function getPrimaryThreadContainer(): HTMLElement | null {
	return (
		document.querySelector<HTMLElement>('#topic') ||
		document.querySelector<HTMLElement>('#posts-wrap') ||
		document.querySelector<HTMLElement>(MV_SELECTORS.GLOBAL.MAIN_CONTENT)
	)
}

function getFirstThreadPost(): HTMLElement | null {
	return (
		document.querySelector<HTMLElement>('#posts-wrap > .post') ||
		document.querySelector<HTMLElement>('#posts-wrap .post')
	)
}

function clampSidebarWidth(widthPx: number): number {
	return Math.max(SIDE_BAR_MIN_WIDTH_PX, Math.min(SIDE_BAR_MAX_WIDTH_PX, Math.round(widthPx)))
}

function measureNativeSidebarWidth(): number {
	const sidebar = document.querySelector<HTMLElement>(MV_SELECTORS.GLOBAL.C_SIDE)
	if (!sidebar) return cachedSidebarWidthPx

	const rectWidth = sidebar.getBoundingClientRect().width
	const computedStyle = window.getComputedStyle(sidebar)
	const cssWidth = Number.parseFloat(computedStyle.width)
	const cssBasis = Number.parseFloat(computedStyle.flexBasis)

	const measuredWidth = [rectWidth, cssWidth, cssBasis].find(value => Number.isFinite(value) && value > 0)
	if (measuredWidth) {
		cachedSidebarWidthPx = clampSidebarWidth(measuredWidth)
	}

	return cachedSidebarWidthPx
}

function positionSideControlBar(): void {
	if (appliedPosition !== 'side') return

	const bar = document.getElementById(CONTROL_BAR_ID) as HTMLElement | null
	const container = getPrimaryThreadContainer()
	if (!bar || !container) return

	const containerRect = container.getBoundingClientRect()
	const firstPostRect = getFirstThreadPost()?.getBoundingClientRect()
	const anchorRect = firstPostRect ?? containerRect
	const measuredSidebarWidth = measureNativeSidebarWidth()
	const maxWidthByViewport = Math.max(SIDE_BAR_MIN_WIDTH_PX, window.innerWidth - SIDE_MIN_INSET_PX * 2)
	const targetWidth = Math.min(measuredSidebarWidth, maxWidthByViewport)

	bar.style.setProperty('width', `${targetWidth}px`, 'important')
	bar.style.setProperty('max-width', `${targetWidth}px`, 'important')

	const barRect = bar.getBoundingClientRect()
	const barWidth = Math.max(SIDE_BAR_MIN_WIDTH_PX, Math.round(barRect.width))
	const preferredLeft = Math.round(anchorRect.right + SIDE_BAR_GAP_PX)
	const maxLeft = Math.round(window.innerWidth - barWidth - SIDE_MIN_INSET_PX)
	const clampedLeft = Math.max(SIDE_MIN_INSET_PX, Math.min(preferredLeft, maxLeft))

	const barHeight = Math.max(160, Math.round(barRect.height))
	const maxTop = Math.max(SIDE_MIN_INSET_PX, window.innerHeight - barHeight - SIDE_MIN_INSET_PX)
	const measuredTop = firstPostRect ? Math.round(firstPostRect.top + 2) : SIDE_TOP_OFFSET_PX
	const normalizedMeasuredTop = Math.max(SIDE_TOP_MIN_PX, measuredTop)
	if (sideStableTopPx === null || normalizedMeasuredTop > sideStableTopPx) {
		sideStableTopPx = normalizedMeasuredTop
	}
	const preferredTop = sideStableTopPx ?? normalizedMeasuredTop
	const clampedTop = Math.max(SIDE_TOP_MIN_PX, Math.min(preferredTop, maxTop))

	bar.style.left = `${clampedLeft}px`
	bar.style.right = 'auto'
	bar.style.top = `${clampedTop}px`
	bar.style.transform = 'none'

	// Override side-mode fallback CSS rules that use !important.
	bar.style.setProperty('left', `${clampedLeft}px`, 'important')
	bar.style.setProperty('right', 'auto', 'important')
	bar.style.setProperty('top', `${clampedTop}px`, 'important')
	bar.style.setProperty('transform', 'none', 'important')
}

/**
 * Creates the control bar by MOVING (not cloning) sidebar elements.
 * Moving preserves all event listeners attached by Mediavida's JavaScript.
 *
 * Layout order:
 * 1. Native MV buttons (Reply, Share)
 * 2. Separator
 * 3. Native MV actions + MVP injected buttons (Fav, Ignore, Summary + Gallery, Save, Live, Scroll)
 * 4. Separator
 * 5. Navigation arrows (Up/Down)
 */
function createControlBar(): HTMLElement {
	const bar = document.createElement('div')
	bar.id = CONTROL_BAR_ID

	const sidebar = document.querySelector(MV_SELECTORS.GLOBAL.C_SIDE)
	if (!sidebar) return bar

	// === GROUP 1: Reply & Share ===
	const group1 = document.createElement('div')
	group1.className = 'mvp-control-group mvp-reply-group'

	const topicReply = sidebar.querySelector('#topic-reply') as HTMLElement | null
	if (topicReply) {
		group1.appendChild(topicReply)
	}

	if (group1.children.length > 0) {
		bar.appendChild(group1)
	}

	// === SEPARATOR 1 ===
	if (group1.children.length > 0) {
		const sep1 = document.createElement('div')
		sep1.className = 'mvp-control-separator'
		bar.appendChild(sep1)
	}

	// === GROUP 2: Actions (MV native + MVP buttons) ===
	// Move #more-actions which already contains MVP extra actions inside it
	const group2 = document.createElement('div')
	group2.className = 'mvp-control-group mvp-actions-group'

	const moreActions = sidebar.querySelector('#more-actions') as HTMLElement | null
	if (moreActions) {
		group2.appendChild(moreActions)
	}

	if (group2.children.length > 0) {
		bar.appendChild(group2)
	}

	// === SEPARATOR 2 ===
	const hasContent = group1.children.length > 0 || group2.children.length > 0

	// === GROUP 3: Navigation ===
	const group3 = document.createElement('div')
	group3.className = 'mvp-control-group mvp-nav-group'

	const topicNav = sidebar.querySelector('#topic-nav') as HTMLElement | null
	if (topicNav) {
		group3.appendChild(topicNav)
	}

	if (group3.children.length > 0 && hasContent) {
		const sep2 = document.createElement('div')
		sep2.className = 'mvp-control-separator'
		bar.appendChild(sep2)
	}

	if (group3.children.length > 0) {
		bar.appendChild(group3)
	}

	return bar
}

/**
 * Injects the control bar into the page
 */
function injectControlBar(position: ControlBarPosition): void {
	// Remove existing bar if present (and restore elements first!)
	const existingBar = document.getElementById(CONTROL_BAR_ID)
	if (existingBar) {
		removeControlBar()
	}

	// Find insertion point: place bar OUTSIDE #topic (before it)
	const topic = document.querySelector('#topic')
	const postit = document.querySelector('#postit')

	if (!topic) return

	const bar = createControlBar()
	const topicParent = topic.parentElement

	// If postit exists outside #topic (e.g., native live), insert above postit
	if (postit && postit.parentElement && postit.parentElement !== topic) {
		postit.parentElement.insertBefore(bar, postit)
		return
	}

	// Default: insert before #topic to avoid inheriting its border/line styles
	if (topicParent) {
		topicParent.insertBefore(bar, topic)
	} else {
		// Fallback: insert at start of topic if parent is missing
		topic.insertBefore(bar, topic.firstChild)
	}

	// Clean up inline styles from MVP containers that were designed for sidebar
	const extraActions = bar.querySelector<HTMLElement>(`#${DOM_MARKERS.IDS.EXTRA_ACTIONS}`)
	if (extraActions) {
		if (position === 'side') {
			// Preserve native sidebar-like spacing in side mode.
			extraActions.style.borderTop = '1px solid rgba(128, 128, 128, 0.2)'
			extraActions.style.marginTop = '12px'
			extraActions.style.paddingTop = '12px'
			extraActions.style.flexDirection = 'column'
		} else {
			extraActions.style.borderTop = 'none'
			extraActions.style.marginTop = '0'
			extraActions.style.paddingTop = '0'
			extraActions.style.flexDirection = 'row'
		}
	}
}

/**
 * Restores native elements back to the sidebar before removing the control bar.
 * This ensures that disabling the feature doesn't delete the native buttons.
 */
function restoreNativeElements(bar: HTMLElement): void {
	const sidebar = document.querySelector(MV_SELECTORS.GLOBAL.C_SIDE)
	if (!sidebar) return

	// functionality to move elements back to sidebar
	const moveBack = (selector: string) => {
		const element = bar.querySelector(selector)
		if (element) {
			sidebar.appendChild(element)
		}
	}

	// Restore in logical order
	moveBack('#topic-reply')
	moveBack('#more-actions')
	moveBack('#topic-nav')
}

/**
 * Removes the control bar from the page
 */
function removeControlBar(): void {
	const bar = document.getElementById(CONTROL_BAR_ID)
	if (bar) {
		// Restore native elements to sidebar before removing
		restoreNativeElements(bar)

		// Clean up MVP-specific containers if necessary (though they are inside bar, so removing bar kills them)
		// But native elements must be saved!
		bar.remove()
	}
}

/**
 * Reacts to viewport changes when side mode is enabled.
 * If there is not enough lateral space, the bar falls back to top mode.
 */
function initResponsivePositionListener(): void {
	if (resizeListenerInitialized) return
	resizeListenerInitialized = true

	window.addEventListener('resize', () => {
		if (!requestedEnabled || requestedPosition !== 'side') return

		const pageKind = getCenteredPostsPageKind()
		if (pageKind !== 'thread') return

		// Reposition immediately while resizing to avoid temporary overlap over posts.
		if (resizeRafId) {
			window.cancelAnimationFrame(resizeRafId)
		}
		resizeRafId = window.requestAnimationFrame(() => {
			resizeRafId = undefined
			const nextPosition = resolveControlBarPosition(requestedPosition, pageKind)
			const bar = document.getElementById(CONTROL_BAR_ID) as HTMLElement | null

			if (nextPosition === 'side') {
				if (bar) {
					bar.style.removeProperty('visibility')
					bar.style.removeProperty('pointer-events')
				}
				if (appliedPosition === 'side') {
					positionSideControlBar()
				}
				return
			}

			// While waiting for debounced mode switch (side -> top), hide the rail.
			if (bar && appliedPosition === 'side') {
				bar.style.setProperty('visibility', 'hidden', 'important')
				bar.style.setProperty('pointer-events', 'none', 'important')
			}
		})

		if (resizeDebounceId) {
			window.clearTimeout(resizeDebounceId)
		}

		resizeDebounceId = window.setTimeout(() => {
			const nextPosition = resolveControlBarPosition(requestedPosition, pageKind)
			const bar = document.getElementById(CONTROL_BAR_ID) as HTMLElement | null
			if (bar) {
				bar.style.removeProperty('visibility')
				bar.style.removeProperty('pointer-events')
			}

			if (nextPosition === appliedPosition) {
				if (nextPosition === 'side') {
					positionSideControlBar()
				}
				return
			}

			applyCenteredPosts(requestedEnabled, requestedSticky, requestedPosition)
		}, RESIZE_DEBOUNCE_MS)
	})
}

/**
 * Applies or removes the centered posts mode
 * @param enabled - Whether to enable centered posts
 * @param sticky - Whether the control bar should be sticky
 * @param requestedControlPosition - Desired control bar placement
 */
function applyCenteredPosts(
	enabled: boolean,
	sticky: boolean = false,
	requestedControlPosition: ControlBarPosition = 'top'
): void {
	logger.debug('CenteredPosts: applyCenteredPosts called with enabled =', enabled)
	requestedEnabled = enabled
	requestedSticky = sticky
	requestedPosition = requestedControlPosition

	// Update cache for next page load
	updateCache(enabled)

	const pageKind = getCenteredPostsPageKind()
	const isSupportedPage = pageKind !== 'unsupported'

	// Remove existing styles (both main and early-inject to avoid duplication)
	const existingStyle = document.getElementById(STYLE_ID)
	if (existingStyle) {
		existingStyle.remove()
	}

	const earlyStyle = document.getElementById(EARLY_STYLE_ID)
	if (earlyStyle) {
		earlyStyle.remove()
	}

	if (!enabled || !isSupportedPage) {
		if (resizeDebounceId) {
			window.clearTimeout(resizeDebounceId)
			resizeDebounceId = undefined
		}
		if (resizeRafId) {
			window.cancelAnimationFrame(resizeRafId)
			resizeRafId = undefined
		}
		appliedPosition = null
		sideStableTopPx = null
		removeControlBar()
		return
	}

	const resolvedPosition = resolveControlBarPosition(requestedControlPosition, pageKind)
	if (resolvedPosition === 'side') {
		sideStableTopPx = null
		measureNativeSidebarWidth()
	} else {
		sideStableTopPx = null
	}

	// Create and inject styles
	const styleEl = document.createElement('style')
	styleEl.id = STYLE_ID
	styleEl.textContent = generateStyles(sticky, resolvedPosition)
	document.head.appendChild(styleEl)
	logger.debug('CenteredPosts: Stylesheet injected with id', STYLE_ID)

	if (pageKind === 'thread') {
		// Inject control bar by MOVING native sidebar elements
		// This preserves all event listeners since we move, not clone
		injectControlBar(resolvedPosition)
		appliedPosition = resolvedPosition

		if (resolvedPosition === 'side') {
			positionSideControlBar()
			requestAnimationFrame(() => positionSideControlBar())
			window.setTimeout(() => positionSideControlBar(), 220)
			window.setTimeout(() => positionSideControlBar(), 900)
		}
		return
	}

	// Listing mode: apply layout styles only (no control bar relocation)
	appliedPosition = null
	removeControlBar()
}

/**
 * Initializes the centered posts feature
 */
export async function initCenteredPosts(): Promise<void> {
	try {
		initResponsivePositionListener()

		// Get initial settings
		const raw = await storage.getItem<string | SettingsState>(SETTINGS_KEY)

		if (raw) {
			const parsed: SettingsState = typeof raw === 'string' ? JSON.parse(raw) : raw
			const enabled = parsed?.state?.centeredPostsEnabled ?? false
			const sticky = parsed?.state?.centeredControlsSticky ?? false
			const position: ControlBarPosition = parsed?.state?.centeredControlsPosition === 'side' ? 'side' : 'top'
			applyCenteredPosts(enabled, sticky, position)
		}

		// Watch for changes
		storage.watch<string | SettingsState>(SETTINGS_KEY, newValue => {
			if (!newValue) return

			try {
				const parsed: SettingsState = typeof newValue === 'string' ? JSON.parse(newValue) : newValue
				const enabled = parsed?.state?.centeredPostsEnabled ?? false
				const sticky = parsed?.state?.centeredControlsSticky ?? false
				const position: ControlBarPosition = parsed?.state?.centeredControlsPosition === 'side' ? 'side' : 'top'
				applyCenteredPosts(enabled, sticky, position)
			} catch (e) {
				logger.error('CenteredPosts error parsing settings:', e)
			}
		})
	} catch (error) {
		logger.error('CenteredPosts failed to initialize:', error)
	}
}
