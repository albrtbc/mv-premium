/**
 * Improved Upvotes - Enhances the native upvote display with avatars.
 *
 * For each post with upvotes, replaces the plain number with a row of
 * user avatars (lazy-loaded via IntersectionObserver) and a color-coded count.
 *
 * Ported from mv-ignited.
 */

import { createElement } from 'react'
import { DOM_MARKERS } from '@/constants/dom-markers'
import { mountFeature, isFeatureMounted } from '@/lib/content-modules/utils/react-helpers'
import { FEATURE_IDS } from '@/constants/feature-ids'
import { UpvotesLoading, UpvotesDisplay } from '../components/upvotes'

const STYLE_ID = 'mvp-improved-upvotes-styles'
const DATA_ATTR = 'data-mvp-upvotes'

function getUsername(): string | null {
	return document.querySelector('#user-data span')?.textContent?.trim() || null
}

function injectStyles(): void {
	if (document.getElementById(STYLE_ID)) return

	const style = document.createElement('style')
	style.id = STYLE_ID
	style.textContent = `
		/* Improved Upvotes - hide original content, show React component */
		.mvp-improved-upvotes .post-controls {
			display: flex !important;
			align-items: center !important;
			justify-content: space-between !important;
			margin-left: 0 !important;
			height: 40px;
		}
		.mvp-improved-upvotes .post-controls::after {
			content: unset;
		}
		.mvp-improved-upvotes .post-controls > * {
			display: block !important;
		}
		.mvp-improved-upvotes .btnmola {
			padding-left: 0 !important;
			display: block !important;
			opacity: 0;
			transition: opacity 0.2s;
		}
		.mvp-improved-upvotes .btnmola[${DATA_ATTR}] {
			opacity: 1 !important;
		}
		.mvp-improved-upvotes .post-controls .btnmola:hover {
			background: none;
		}
		.mvp-improved-upvotes .post-controls .btnrep {
			cursor: pointer;
			flex: 3;
			background-color: unset;
		}
		.mvp-improved-upvotes .post-controls .btnrep i {
			opacity: 0.4;
			font-size: 12px;
		}
	`
	document.head.appendChild(style)
}

interface UpvoteUser {
	username: string
	avatar: string
	url: string
}

async function fetchUpvotes(href: string): Promise<UpvoteUser[]> {
	const response = await fetch(`https://www.mediavida.com${href}`, {
		headers: { accept: '*/*', 'x-requested-with': 'XMLHttpRequest' },
		method: 'GET',
		mode: 'cors',
		credentials: 'include',
	})
	if (!response.ok) return []

	const html = await response.text()
	const doc = new DOMParser().parseFromString(html, 'text/html')
	const upvotes: UpvoteUser[] = []

	doc.querySelectorAll('li').forEach(li => {
		const anchor = li.querySelector('a')
		const img = li.querySelector('img')
		const username = anchor?.getAttribute('title')
		const avatar = img?.getAttribute('src')
		const url = anchor?.getAttribute('href')
		if (username && avatar && url) {
			upvotes.push({ username, avatar, url: url.startsWith('/') ? url : `/${url}` })
		}
	})

	return upvotes
}

function processPost(post: Element, currentUser: string | null): void {
	const upvoteEl = post.querySelector('.btnmola.post-n') as HTMLElement | null
	if (!upvoteEl || !upvoteEl.textContent || upvoteEl.hasAttribute(DATA_ATTR)) return

	const count = parseInt(upvoteEl.textContent, 10)
	if (!count || count <= 0) return

	const href = upvoteEl.getAttribute('href')
	if (!href) return

	// Mark as processed
	upvoteEl.setAttribute(DATA_ATTR, 'true')

	// Create mount point inside the upvote element
	const mountId = `${FEATURE_IDS.IMPROVED_UPVOTES_PREFIX}${Math.random().toString(36).slice(2, 8)}`
	const wrapper = document.createElement('div')
	wrapper.id = mountId
	wrapper.style.display = 'inline-flex'
	wrapper.style.alignItems = 'center'

	// Clear original text content and mount loading skeleton
	upvoteEl.textContent = ''
	upvoteEl.appendChild(wrapper)

	mountFeature(mountId, wrapper, createElement(UpvotesLoading, { count }), { withProviders: false })

	// Lazy load actual data
	const observer = new IntersectionObserver(entries => {
		entries.forEach(async entry => {
			if (!entry.isIntersecting) return
			observer.disconnect()

			try {
				const upvotes = await fetchUpvotes(href)
				mountFeature(mountId, wrapper, createElement(UpvotesDisplay, {
					count: upvotes.length || count,
					upvotes,
					currentUser,
				}), { withProviders: false })
			} catch {
				// Keep showing loading state on error
			}
		})
	})
	observer.observe(post)

	// Refresh when user votes
	const voteBtn = post.querySelector('.masmola')
	if (voteBtn) {
		voteBtn.addEventListener('click', () => {
			setTimeout(async () => {
				try {
					const upvotes = await fetchUpvotes(href)
					mountFeature(mountId, wrapper, createElement(UpvotesDisplay, {
						count: upvotes.length || count,
						upvotes,
						currentUser,
					}), { withProviders: false })
				} catch {
					// Silently fail
				}
			}, 300)
		})
	}
}

export function injectImprovedUpvotes(): void {
	injectStyles()

	// Add class to html for CSS scoping
	document.documentElement.classList.add('mvp-improved-upvotes')

	const currentUser = getUsername()

	// Process all posts
	document.querySelectorAll('.cf.post').forEach(post => {
		processPost(post, currentUser)
	})
}
