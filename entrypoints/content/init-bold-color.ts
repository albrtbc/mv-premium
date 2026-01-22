/**
 * Bold Color Module
 * Applies custom bold text color from storage when enabled
 *
 * Refactored to use @wxt-dev/storage (API unificada)
 */
import { storage } from '#imports'
import { browser, type Browser } from 'wxt/browser'
import { STORAGE_KEYS } from '@/constants'

// Storage items for bold color settings
const boldColorStorage = storage.defineItem<string | null>(`local:${STORAGE_KEYS.BOLD_COLOR}`, {
	defaultValue: null,
})

const boldColorEnabledStorage = storage.defineItem<boolean>(`local:${STORAGE_KEYS.BOLD_COLOR_ENABLED}`, {
	defaultValue: false,
})

/**
 * Apply custom bold text color from storage (only if enabled)
 * Sets the --mvp-bold-color CSS variable on the document root
 */
export async function applyBoldColor(): Promise<void> {
	try {
		const isEnabled = await boldColorEnabledStorage.getValue()
		if (!isEnabled) {
			// Set to 'inherit' to use native styling (overrides CSS fallback)
			document.documentElement.style.setProperty('--mvp-bold-color', 'inherit')
			return
		}

		const savedColor = await boldColorStorage.getValue()
		if (savedColor) {
			document.documentElement.style.setProperty('--mvp-bold-color', savedColor)
		}
	} catch {
		// Ignore if storage is unavailable
	}
}

/**
 * Watch for bold color changes and apply instantly
 * Uses native browser.storage.onChanged for cross-context support
 */
export function watchBoldColor(): void {
	const listener = (changes: Record<string, Browser.storage.StorageChange>, areaName: string) => {
		if (areaName !== 'local') return

		// Watch for enabled toggle changes
		if (changes[STORAGE_KEYS.BOLD_COLOR_ENABLED]) {
			const isEnabled = changes[STORAGE_KEYS.BOLD_COLOR_ENABLED].newValue
			if (!isEnabled) {
				document.documentElement.style.setProperty('--mvp-bold-color', 'inherit')
			} else {
				// Re-apply color when enabled
				void applyBoldColor()
			}
		}

		// Watch for color changes (only apply if enabled)
		if (changes[STORAGE_KEYS.BOLD_COLOR]) {
			const newColor = changes[STORAGE_KEYS.BOLD_COLOR].newValue
			// Check if enabled before applying
			boldColorEnabledStorage.getValue().then(isEnabled => {
				if (isEnabled && newColor) {
					document.documentElement.style.setProperty('--mvp-bold-color', newColor as string)
				}
			})
		}
	}
	browser.storage.onChanged.addListener(listener)
}

// Export storage items for external use if needed
export { boldColorStorage, boldColorEnabledStorage }
