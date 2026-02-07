/**
 * Multi-Page Summarizer Injection
 *
 * Injects a separate button for multi-page thread summarization.
 * Uses createThreadActionButton utility for standardized button injection.
 */

import { isThreadPage } from '@/features/gallery/lib/thread-scraper'
import { mountFeature, isFeatureMounted, unmountFeature } from '@/lib/content-modules/utils/react-helpers'
import {
	createThreadActionButton,
	isThreadActionButtonInjected,
	removeThreadActionButton,
	type ThreadActionButtonResult,
} from '@/lib/content-modules/utils/thread-action-button'
import { MultiPageSummaryModal } from '../components/multi-page-summary-modal'
import { createElement } from 'react'
import { FEATURE_IDS } from '@/constants'
import { DOM_MARKERS } from '@/constants/dom-markers'

// =============================================================================
// CONSTANTS
// =============================================================================

const BUTTON_ID = DOM_MARKERS.IDS.MULTI_PAGE_SUMMARIZER_BTN
const MODAL_FEATURE_ID = FEATURE_IDS.MULTI_PAGE_SUMMARIZER_MODAL
const MODAL_CONTAINER_ID = DOM_MARKERS.IDS.MULTI_PAGE_SUMMARIZER_MODAL

// =============================================================================
// STATE
// =============================================================================

let buttonResult: ThreadActionButtonResult | null = null

// =============================================================================
// MODAL WRAPPER
// =============================================================================

function MultiPageSummaryModalWrapper({ onClose }: { onClose: () => void }) {
	return createElement(MultiPageSummaryModal, { isOpen: true, onClose })
}

/**
 * Mounts the Multi-Page Summarizer modal into the document body.
 */
function openMultiPageSummaryModal(): void {
	if (isFeatureMounted(MODAL_FEATURE_ID)) return

	let container = document.getElementById(MODAL_CONTAINER_ID)
	if (!container) {
		container = document.createElement('div')
		container.id = MODAL_CONTAINER_ID
		document.body.appendChild(container)
	}

	mountFeature(
		MODAL_FEATURE_ID,
		container,
		createElement(MultiPageSummaryModalWrapper, {
			onClose: () => closeMultiPageSummaryModal(),
		})
	)
}

function closeMultiPageSummaryModal(): void {
	unmountFeature(MODAL_FEATURE_ID)

	const container = document.getElementById(MODAL_CONTAINER_ID)
	if (container) {
		container.remove()
	}
}

// =============================================================================
// INJECTION
// =============================================================================

/**
 * Injects the AI Multi-Page Summarizer action button into the thread action bar.
 */
export function injectMultiPageSummarizerButton(): void {
	if (isThreadActionButtonInjected(BUTTON_ID)) return
	if (!isThreadPage()) return

	buttonResult = createThreadActionButton({
		id: BUTTON_ID,
		icon: 'fa-files-o',
		text: 'Resumen+',
		tooltip: 'Resumir múltiples páginas con IA',
		ariaLabel: 'Resumir múltiples páginas del hilo con inteligencia artificial',
		onClick: () => openMultiPageSummaryModal(),
	})
}

/**
 * Safely removes the multi-page summarizer button and any active modal from the DOM.
 */
export function cleanupMultiPageSummarizerButton(): void {
	if (buttonResult) {
		buttonResult.remove()
		buttonResult = null
	} else {
		removeThreadActionButton(BUTTON_ID)
	}

	closeMultiPageSummaryModal()
}
