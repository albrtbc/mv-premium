/**
 * Scroll to Bottom Button
 *
 * Adds a "scroll to bottom" button next to the native "scroll to top" button in thread sidebars.
 * Automatically hides when Live Mode or Infinite Scroll are active.
 */
import { DOM_MARKERS } from '@/constants/dom-markers'

const BUTTON_ID = 'mvp-scroll-to-bottom'

let isLiveModeActive = false
let isInfiniteScrollActive = false
let button: HTMLAnchorElement | null = null

/**
 * Updates button visibility based on current mode states
 */
function updateButtonVisibility(): void {
	if (!button) return

	const shouldHide = isLiveModeActive || isInfiniteScrollActive
	button.style.display = shouldHide ? 'none' : ''
}

/**
 * Creates and injects the scroll-to-bottom button
 */
export function injectScrollToBottomButton(): void {
	// Only inject on thread pages
	const topicNav = document.getElementById('topic-nav')
	if (!topicNav) return

	// Find the existing "scroll to top" button as anchor point
	const scrollUpBtn = topicNav.querySelector('a.btn-circle[href="#top"]')
	if (!scrollUpBtn) return

	// Avoid duplicate injection
	if (document.getElementById(BUTTON_ID)) return

	// Create the scroll down button
	button = document.createElement('a')
	button.id = BUTTON_ID
	button.className = 'btn-circle'
	button.href = '#bottom'
	button.title = 'Ir al final'
	button.innerHTML = '<i class="fa fa-chevron-circle-down"></i>'

	button.addEventListener('click', e => {
		e.preventDefault()
		window.scrollTo({
			top: document.documentElement.scrollHeight,
			behavior: 'smooth',
		})
		// Update URL hash to match native behavior
		history.pushState(null, '', '#bottom')
	})

	// Insert after the scroll-up button
	scrollUpBtn.insertAdjacentElement('afterend', button)

	// Listen for mode changes
	window.addEventListener(DOM_MARKERS.EVENTS.LIVE_MODE_CHANGED, ((e: CustomEvent<{ active: boolean }>) => {
		isLiveModeActive = e.detail.active
		updateButtonVisibility()
	}) as EventListener)

	window.addEventListener(DOM_MARKERS.EVENTS.INFINITE_SCROLL_MODE_CHANGED, ((e: CustomEvent<{ active: boolean }>) => {
		isInfiniteScrollActive = e.detail.active
		updateButtonVisibility()
	}) as EventListener)
}
