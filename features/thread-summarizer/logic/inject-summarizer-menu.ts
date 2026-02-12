/**
 * Summarizer Menu Injection
 *
 * Replaces the two separate summarizer buttons (Resumir + Resumen+) with a single
 * button that shows a dropdown menu with both options.
 */

import { FEATURE_IDS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'
import { isThreadPage } from '@/features/gallery/lib/thread-scraper'
import { mountFeature, isFeatureMounted, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import {
	createThreadActionButton,
	isThreadActionButtonInjected,
	removeThreadActionButton,
} from '@/lib/content-modules/utils/thread-action-button'
import { createElement } from 'react'
import { SummaryModal } from '../components/summary-modal'
import { MultiPageSummaryModal } from '../components/multi-page-summary-modal'

// =============================================================================
// STYLES
// =============================================================================

const MENU_STYLES = `
.mvp-summarizer-dropdown {
	position: fixed;
	min-width: 220px;
	background: var(--mv-bg-alt, #1e1e1e);
	border: 1px solid rgba(128, 128, 128, 0.2);
	border-radius: 6px;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
	z-index: 100;
	overflow: hidden;
}

.mvp-summarizer-dropdown-item {
	display: block;
	padding: 8px 12px;
	color: var(--mv-text, #e0e0e0);
	text-decoration: none;
	cursor: pointer;
	font-size: 13px;
	white-space: nowrap;
	transition: background 0.15s;
}

.mvp-summarizer-dropdown-item:hover {
	background: rgba(128, 128, 128, 0.15);
	text-decoration: none;
	color: var(--mv-text, #e0e0e0);
}
`

// =============================================================================
// MODAL HELPERS (reuse same logic as create-summarizer-injection)
// =============================================================================

function openModal(
	featureId: string,
	containerId: string,
	ModalComponent: React.ComponentType<{ isOpen: boolean; onClose: () => void }>
): void {
	if (isFeatureMounted(featureId)) return

	let container = document.getElementById(containerId)
	if (!container) {
		container = document.createElement('div')
		container.id = containerId
		document.body.appendChild(container)
	}

	function ModalWrapper({ onClose }: { onClose: () => void }) {
		return createElement(ModalComponent, { isOpen: true, onClose })
	}

	mountFeature(featureId, container, createElement(ModalWrapper, { onClose: () => closeModal(featureId, containerId) }))
}

function closeModal(featureId: string, containerId: string): void {
	unmountFeature(featureId)
	const container = document.getElementById(containerId)
	if (container) container.remove()
}

// =============================================================================
// INJECT
// =============================================================================

let styleInjected = false
let outsideClickHandler: ((e: MouseEvent) => void) | null = null

function injectStyles(): void {
	if (styleInjected) return
	if (document.getElementById('mvp-summarizer-menu-styles')) return

	const style = document.createElement('style')
	style.id = 'mvp-summarizer-menu-styles'
	style.textContent = MENU_STYLES
	document.head.appendChild(style)
	styleInjected = true
}

function createDropdown(buttonEl: HTMLAnchorElement): HTMLDivElement {
	const dropdown = document.createElement('div')
	dropdown.id = DOM_MARKERS.IDS.SUMMARIZER_MENU
	dropdown.className = 'mvp-summarizer-dropdown'

	// Option 1: Resumir página actual
	const singlePage = document.createElement('a')
	singlePage.className = 'mvp-summarizer-dropdown-item'
	singlePage.href = 'javascript:void(0);'
	singlePage.textContent = '\u{1F4C4} Resumir p\u00E1gina actual'
	singlePage.addEventListener('click', (e) => {
		e.preventDefault()
		e.stopPropagation()
		hideDropdown()
		openModal(FEATURE_IDS.THREAD_SUMMARIZER_MODAL, DOM_MARKERS.IDS.SUMMARIZER_MODAL, SummaryModal)
	})

	// Option 2: Resumen+ (multi-página)
	const multiPage = document.createElement('a')
	multiPage.className = 'mvp-summarizer-dropdown-item'
	multiPage.href = 'javascript:void(0);'
	multiPage.textContent = '\u{1F4DA} Resumen+ (multi-p\u00E1gina)'
	multiPage.addEventListener('click', (e) => {
		e.preventDefault()
		e.stopPropagation()
		hideDropdown()
		openModal(
			FEATURE_IDS.MULTI_PAGE_SUMMARIZER_MODAL,
			DOM_MARKERS.IDS.MULTI_PAGE_SUMMARIZER_MODAL,
			MultiPageSummaryModal
		)
	})

	dropdown.appendChild(singlePage)
	dropdown.appendChild(multiPage)

	return dropdown
}

function hideDropdown(): void {
	const dropdown = document.getElementById(DOM_MARKERS.IDS.SUMMARIZER_MENU)
	if (dropdown) dropdown.remove()

	if (outsideClickHandler) {
		document.removeEventListener('click', outsideClickHandler, true)
		outsideClickHandler = null
	}
}

function toggleDropdown(buttonEl: HTMLAnchorElement): void {
	const existing = document.getElementById(DOM_MARKERS.IDS.SUMMARIZER_MENU)
	if (existing) {
		hideDropdown()
		return
	}

	const dropdown = createDropdown(buttonEl)

	// Position using getBoundingClientRect to avoid overflow clipping from ancestors
	const rect = buttonEl.getBoundingClientRect()
	dropdown.style.top = `${rect.bottom + 4}px`
	dropdown.style.left = `${rect.left}px`

	document.body.appendChild(dropdown)

	// Close on outside click
	outsideClickHandler = (e: MouseEvent) => {
		const target = e.target as Node
		if (!buttonEl.contains(target) && !dropdown.contains(target)) {
			hideDropdown()
		}
	}
	// Use setTimeout to avoid the current click event triggering the handler
	setTimeout(() => {
		if (outsideClickHandler) {
			document.addEventListener('click', outsideClickHandler, true)
		}
	}, 0)
}

export function injectSummarizerMenu(): void {
	if (isThreadActionButtonInjected(DOM_MARKERS.IDS.SUMMARIZER_BTN)) return
	if (!isThreadPage()) return

	injectStyles()

	createThreadActionButton({
		id: DOM_MARKERS.IDS.SUMMARIZER_BTN,
		icon: 'fa-magic',
		text: 'Resumir',
		tooltip: 'Resumir hilo con IA',
		ariaLabel: 'Abrir men\u00FA de resumen con inteligencia artificial',
		onClick: (_e, button) => {
			toggleDropdown(button)
		},
	})
}

export function cleanupSummarizerMenu(): void {
	hideDropdown()
	removeThreadActionButton(DOM_MARKERS.IDS.SUMMARIZER_BTN)
	closeModal(FEATURE_IDS.THREAD_SUMMARIZER_MODAL, DOM_MARKERS.IDS.SUMMARIZER_MODAL)
	closeModal(FEATURE_IDS.MULTI_PAGE_SUMMARIZER_MODAL, DOM_MARKERS.IDS.MULTI_PAGE_SUMMARIZER_MODAL)
}
