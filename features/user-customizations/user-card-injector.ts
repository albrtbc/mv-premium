/**
 * User Card Injector
 * Injects MVP action buttons into MV's native #user-card popover
 */

import { getUserCustomizations, saveUserCustomizations } from '@/features/user-customizations/storage'
import { openNoteDialog } from './components/note-editor-dialog'
import { isMVDarkMode } from '@/lib/theme-utils'
import { DOM_MARKERS, MV_SELECTORS } from '@/constants'
import { NOTE_ICON_STYLES, NOTE_ICON_SVG } from './logic/customizations-styles'

const INJECTED_MARKER = DOM_MARKERS.EDITOR.GENERIC_INJECTED
const MVP_ACTIONS_CLASS = DOM_MARKERS.CLASSES.USER_CARD_ACTIONS
const USER_NOTE_CLASS = DOM_MARKERS.CLASSES.USER_NOTE

/**
 * Initialize the user card observer
 * Watches for the native #user-card to appear and injects buttons
 */
export function initUserCardInjector(): void {
	const observer = new MutationObserver(mutations => {
		for (const mutation of mutations) {
			for (const node of mutation.addedNodes) {
				if (node instanceof HTMLElement) {
					if (node.id === 'user-card' && node.classList.contains('show')) {
						injectButtons(node)
					}
					const card = node.querySelector?.('#user-card.show')
					if (card instanceof HTMLElement) {
						injectButtons(card)
					}
				}
			}

			if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
				const target = mutation.target as HTMLElement
				if (target.id === 'user-card' && target.classList.contains('show')) {
					injectButtons(target)
				}
			}
		}
	})

	observer.observe(document.body, {
		childList: true,
		subtree: true,
		attributes: true,
		attributeFilter: ['class'],
	})
}

/**
 * Injects the custom action buttons into the user card
 */
async function injectButtons(card: HTMLElement): Promise<void> {
	if (card.hasAttribute(INJECTED_MARKER)) return
	card.setAttribute(INJECTED_MARKER, 'true')

	const usernameLink = card.querySelector('.user-info h4 a') as HTMLAnchorElement | null
	if (!usernameLink) return

	const username = usernameLink.textContent?.trim()
	if (!username) return

	const avatarImg = card.querySelector('.user-avatar img') as HTMLImageElement | null
	const avatarUrl = avatarImg?.src || ''

	const data = await getUserCustomizations()
	
	// Case-insensitive lookup for existing user customization
	// The user might be stored as "UserName" but textContent shows "username"
	const matchingKey = Object.keys(data.users).find(key => key.toLowerCase() === username.toLowerCase())
	const storageKey = matchingKey || username // Use existing key if found, otherwise use new username
	const userCustomization = matchingKey ? data.users[matchingKey] : {}

	const controlsContainer = card.querySelector('.user-controls')
	if (!controlsContainer) return

	const isDark = isMVDarkMode()
	injectButtonStyles(isDark)

	const borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.1)'

	const actionsDiv = document.createElement('div')
	actionsDiv.className = MVP_ACTIONS_CLASS
	actionsDiv.style.cssText = `
		display: flex !important;
		flex-direction: row !important;
		gap: 6px !important;
		padding: 8px 10px !important;
		border-top: 1px solid ${borderColor} !important;
		background: transparent !important;
		width: 100% !important;
		box-sizing: border-box !important;
		clear: both !important;
	`

	const isIgnoredHide = userCustomization.isIgnored && userCustomization.ignoreType === 'hide'
	const isIgnoredMute = userCustomization.isIgnored && userCustomization.ignoreType === 'mute'
	let currentNote = userCustomization.note || ''

	const hideBtn = createButton('fa-eye-slash', isIgnoredHide ? 'Oculto' : 'Ocultar',
		'Oculta completamente los posts de este usuario', !!isIgnoredHide)
	const muteBtn = createButton(
		isIgnoredMute ? 'fa-user-times' : 'fa-user',
		isIgnoredMute ? 'Ignorado' : 'Ignorar',
		'Colapsa los mensajes pero permite verlos con un clic',
		!!isIgnoredMute
	)
	const noteBtn = createButton('fa-sticky-note-o', currentNote ? 'Nota ✓' : 'Nota',
		'Añade una nota privada a este usuario', !!currentNote)

	hideBtn.addEventListener('click', async e => {
		e.preventDefault()
		await toggleIgnore(storageKey, avatarUrl, 'hide', hideBtn, muteBtn)
	})

	muteBtn.addEventListener('click', async e => {
		e.preventDefault()
		await toggleIgnore(storageKey, avatarUrl, 'mute', hideBtn, muteBtn)
	})

	noteBtn.addEventListener('click', async e => {
		e.preventDefault()
		const newNote = await openNoteEditor(storageKey, currentNote, avatarUrl)
		if (newNote !== null) {
			currentNote = newNote
			updateButtonState(noteBtn, !!currentNote, 'Nota ✓', 'Nota')
		}
	})

	actionsDiv.append(hideBtn, muteBtn, noteBtn)
	card.appendChild(actionsDiv)
}

/** Injects theme-specific active button CSS */
function injectButtonStyles(isDark: boolean): void {
	const styleId = isDark ? DOM_MARKERS.IDS.BTN_STYLES_DARK : DOM_MARKERS.IDS.BTN_STYLES_LIGHT
	const oppositeId = isDark ? DOM_MARKERS.IDS.BTN_STYLES_LIGHT : DOM_MARKERS.IDS.BTN_STYLES_DARK

	document.getElementById(oppositeId)?.remove()

	if (document.getElementById(styleId)) return

	const style = document.createElement('style')
	style.id = styleId
	style.textContent = isDark
		? `.btn.mvp-btn-active { background: rgba(76,175,80,0.25) !important; border-color: #4CAF50 !important; color: #81C784 !important; }
		   .btn.mvp-btn-active:hover { background: rgba(76,175,80,0.35) !important; border-color: #43A047 !important; color: #A5D6A7 !important; box-shadow: 0 0 8px rgba(76,175,80,0.4) !important; text-decoration: none !important; }`
		: `.btn.mvp-btn-active { background: rgba(46,125,50,0.12) !important; border-color: #2E7D32 !important; color: #1B5E20 !important; }
		   .btn.mvp-btn-active:hover { background: rgba(46,125,50,0.2) !important; border-color: #1B5E20 !important; color: #1B5E20 !important; box-shadow: 0 1px 3px rgba(0,0,0,0.12) !important; text-decoration: none !important; }`
	document.head.appendChild(style)
}

/** Creates an action button */
function createButton(icon: string, label: string, tooltip: string, isActive: boolean): HTMLAnchorElement {
	const btn = document.createElement('a')
	btn.href = '#'
	btn.className = `btn ${isActive ? DOM_MARKERS.CLASSES.BTN_ACTIVE : ''}`
	btn.innerHTML = `<i class="fa ${icon}"></i> <span>${label}</span>`
	btn.title = tooltip
	btn.style.cssText = `
		flex: 1 !important; display: flex !important; align-items: center !important;
		justify-content: center !important; gap: 4px !important; margin: 0 !important;
		padding: 6px 4px !important; white-space: nowrap !important; text-decoration: none !important;
	`
	return btn
}

/** Toggle ignore status for a user */
async function toggleIgnore(
	username: string, avatarUrl: string, type: 'hide' | 'mute',
	hideBtn: HTMLElement, muteBtn: HTMLElement
): Promise<void> {
	const data = await getUserCustomizations()
	
	// Case-insensitive lookup to find existing user data
	const matchingKey = Object.keys(data.users).find(key => key.toLowerCase() === username.toLowerCase())
	const storageKey = matchingKey || username
	// Create a COPY of existing data to avoid mutation issues
	const existing = matchingKey ? { ...data.users[matchingKey] } : {}

	if (existing.isIgnored && existing.ignoreType === type) {
		// Remove ignore status but preserve other fields
		const { isIgnored: _, ignoreType: __, ...restOfExisting } = existing
		
		// Check if there are any other meaningful values left
		const hasOtherValues = Object.values(restOfExisting).some(v => v != null && v !== '')
		
		if (hasOtherValues) {
			data.users[storageKey] = restOfExisting
		} else {
			delete data.users[storageKey]
		}
	} else {
		// Add or update ignore status, preserve all other fields
		data.users[storageKey] = { ...existing, isIgnored: true, ignoreType: type, avatarUrl: avatarUrl || existing.avatarUrl }
	}

	await saveUserCustomizations(data)

	const newState = data.users[storageKey]
	updateButtonState(hideBtn, !!(newState?.isIgnored && newState?.ignoreType === 'hide'), 'Oculto', 'Ocultar')
	updateButtonState(muteBtn, !!(newState?.isIgnored && newState?.ignoreType === 'mute'), 'Ignorado', 'Ignorar', 'fa-user-times', 'fa-user')

	if (data.users[storageKey]?.isIgnored) {
		setTimeout(() => location.reload(), 300)
	} else {
		// Also reload when removing ignore to restore hidden posts
		setTimeout(() => location.reload(), 300)
	}
}

/** Update button visual state */
function updateButtonState(
	btn: HTMLElement,
	isActive: boolean,
	activeLabel: string,
	inactiveLabel: string,
	activeIcon?: string,
	inactiveIcon?: string
): void {
	btn.querySelector('span')!.textContent = isActive ? activeLabel : inactiveLabel
	btn.classList.toggle('mvp-btn-active', isActive)
	
	// Update icon if provided
	if (activeIcon && inactiveIcon) {
		const iconEl = btn.querySelector('i')
		if (iconEl) {
			iconEl.className = `fa ${isActive ? activeIcon : inactiveIcon}`
		}
	}
	
	;(btn as HTMLAnchorElement).blur()
}

/** Opens note editor and persists result */
async function openNoteEditor(username: string, currentNote: string, avatarUrl: string): Promise<string | null> {
	const newNote = await openNoteDialog(username, currentNote, avatarUrl)
	if (newNote === null) return null

	const data = await getUserCustomizations()
	
	// Case-insensitive lookup to find existing user data
	const matchingKey = Object.keys(data.users).find(key => key.toLowerCase() === username.toLowerCase())
	const storageKey = matchingKey || username
	
	// Create a COPY of existing data to avoid mutation issues
	const existing = matchingKey ? { ...data.users[matchingKey] } : {}
	
	const trimmed = newNote.trim()

	if (trimmed) {
		// Add or update note, preserve all other fields
		data.users[storageKey] = { ...existing, note: trimmed, avatarUrl: avatarUrl || existing.avatarUrl }
	} else {
		// Remove note but preserve other fields
		const { note: _, ...restOfExisting } = existing
		
		// Check if there are any other meaningful values left
		const hasOtherValues = Object.values(restOfExisting).some(v => v != null && v !== '')
		
		if (hasOtherValues) {
			// Keep the entry with other values (badge, color, etc.)
			data.users[storageKey] = restOfExisting
		} else {
			// No other values, remove the entire entry
			delete data.users[storageKey]
		}
	}

	await saveUserCustomizations(data)

	// Update note icons in DOM without page reload
	updateNoteIconsForUser(storageKey, trimmed)

	return trimmed
}

/**
 * Updates note icons in the DOM for a specific user without page reload.
 * Adds, updates, or removes note icons based on whether there's a note.
 * Only processes avatar links (not mentions in post content).
 */
function updateNoteIconsForUser(username: string, note: string): void {
	// Find all user-card links inside avatars for this user (not mentions in post content)
	const avatarLinks = document.querySelectorAll<HTMLAnchorElement>(
		`${MV_SELECTORS.THREAD.POST_AVATAR} a.user-card[href*="/id/${username}" i]`
	)

	avatarLinks.forEach(link => {
		// The link is inside the avatar, so get the avatar container directly
		const avatarContainer = link.closest(MV_SELECTORS.THREAD.POST_AVATAR) as HTMLElement
		if (!avatarContainer) return

		// Remove existing note icon if present
		const existingNote = avatarContainer.querySelector(`.${USER_NOTE_CLASS}`)
		if (existingNote) existingNote.remove()

		// If there's a note, add the icon
		if (note) {
			avatarContainer.style.overflow = 'visible'
			avatarContainer.style.position = 'relative'

			const noteIcon = document.createElement('div')
			noteIcon.className = USER_NOTE_CLASS
			noteIcon.setAttribute('data-tooltip', note)
			noteIcon.style.cssText = NOTE_ICON_STYLES
			noteIcon.innerHTML = NOTE_ICON_SVG
			avatarContainer.appendChild(noteIcon)
		}
	})
}
