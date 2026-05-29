/**
 * Vitest Global Setup
 *
 * This file runs before all tests and sets up:
 * - Jest-DOM matchers for React Testing Library
 * - Mocks for browser extension APIs (WXT)
 * - Common window API mocks
 */
import '@testing-library/jest-dom/vitest'
import { vi, beforeEach, afterEach } from 'vitest'

// =============================================================================
// BROWSER EXTENSION API MOCKS (WXT)
// =============================================================================

const createStorageMock = () => {
	let store: Record<string, unknown> = {}

	return {
		get: vi.fn((keys?: string | string[] | Record<string, unknown> | null) => {
			if (keys === null || keys === undefined) {
				return Promise.resolve({ ...store })
			}
			if (typeof keys === 'string') {
				return Promise.resolve({ [keys]: store[keys] })
			}
			if (Array.isArray(keys)) {
				const result: Record<string, unknown> = {}
				keys.forEach(key => {
					result[key] = store[key]
				})
				return Promise.resolve(result)
			}
			// Object with defaults
			const result: Record<string, unknown> = {}
			Object.keys(keys).forEach(key => {
				result[key] = store[key] ?? keys[key]
			})
			return Promise.resolve(result)
		}),
		set: vi.fn((items: Record<string, unknown>) => {
			store = { ...store, ...items }
			return Promise.resolve()
		}),
		remove: vi.fn((keys: string | string[]) => {
			const keysArray = Array.isArray(keys) ? keys : [keys]
			keysArray.forEach(key => {
				delete store[key]
			})
			return Promise.resolve()
		}),
		clear: vi.fn(() => {
			store = {}
			return Promise.resolve()
		}),
		// For testing: access internal store
		_getStore: () => store,
		_setStore: (newStore: Record<string, unknown>) => {
			store = newStore
		},
	}
}

export const mockBrowser = {
	storage: {
		local: createStorageMock(),
		sync: createStorageMock(),
		onChanged: {
			addListener: vi.fn(),
			removeListener: vi.fn(),
			hasListener: vi.fn(() => false),
		},
	},
	runtime: {
		sendMessage: vi.fn(() => Promise.resolve()),
		onMessage: {
			addListener: vi.fn(),
			removeListener: vi.fn(),
			hasListener: vi.fn(() => false),
		},
		getURL: vi.fn((path: string) => `chrome-extension://mock-id/${path}`),
		id: 'mock-extension-id',
	},
	tabs: {
		query: vi.fn(() => Promise.resolve([])),
		sendMessage: vi.fn(() => Promise.resolve()),
		create: vi.fn(() => Promise.resolve({ id: 1 })),
		update: vi.fn(() => Promise.resolve()),
		reload: vi.fn(() => Promise.resolve()),
	},
	contextMenus: {
		create: vi.fn(),
		update: vi.fn(),
		remove: vi.fn(),
		removeAll: vi.fn(() => Promise.resolve()),
		onClicked: {
			addListener: vi.fn(),
			removeListener: vi.fn(),
		},
	},
}

vi.mock('wxt/browser', () => ({
	browser: mockBrowser,
}))

// @wxt-dev/storage resolves browser APIs from this package.
vi.mock('@wxt-dev/browser', () => ({
	browser: mockBrowser,
}))

// =============================================================================
// WINDOW API MOCKS
// =============================================================================

// Mock matchMedia
Object.defineProperty(window, 'matchMedia', {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(), // Deprecated
		removeListener: vi.fn(), // Deprecated
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
})

// Mock ResizeObserver
class ResizeObserverMock {
	observe = vi.fn()
	unobserve = vi.fn()
	disconnect = vi.fn()
}
vi.stubGlobal('ResizeObserver', ResizeObserverMock)

// Mock IntersectionObserver
class IntersectionObserverMock {
	readonly root: Element | null = null
	readonly rootMargin: string = ''
	readonly thresholds: ReadonlyArray<number> = []
	observe = vi.fn()
	unobserve = vi.fn()
	disconnect = vi.fn()
	takeRecords = vi.fn(() => [])
}
vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)

// Mock Web Storage.
// jsdom normally provides localStorage, but Node 22+ ships an experimental
// global `localStorage` that shadows it and resolves to `undefined` unless
// `--localstorage-file` is passed. Provide a deterministic in-memory mock so
// tests behave the same across Node versions (CI on Node 20, local on Node 26+).
class StorageMock implements Storage {
	private store = new Map<string, string>()

	get length(): number {
		return this.store.size
	}
	clear(): void {
		this.store.clear()
	}
	getItem(key: string): string | null {
		return this.store.has(key) ? (this.store.get(key) as string) : null
	}
	key(index: number): string | null {
		return Array.from(this.store.keys())[index] ?? null
	}
	removeItem(key: string): void {
		this.store.delete(key)
	}
	setItem(key: string, value: string): void {
		this.store.set(key, String(value))
	}
}

const localStorageMock = new StorageMock()
const sessionStorageMock = new StorageMock()
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: localStorageMock })
Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: sessionStorageMock })
Object.defineProperty(window, 'localStorage', { configurable: true, value: localStorageMock })
Object.defineProperty(window, 'sessionStorage', { configurable: true, value: sessionStorageMock })

// Mock scrollTo
window.scrollTo = vi.fn()

// Mock clipboard
Object.assign(navigator, {
	clipboard: {
		writeText: vi.fn(() => Promise.resolve()),
		readText: vi.fn(() => Promise.resolve('')),
	},
})

// =============================================================================
// MEDIAVIDA GLOBALS MOCK
// =============================================================================

// Mock Mediavida's window properties
Object.defineProperty(window, 'sharedData', {
	writable: true,
	value: {
		nick: 'TestUser',
		avatar: '/img/avatars/default.png',
		id: 12345,
	},
})

// =============================================================================
// TEST LIFECYCLE HOOKS
// =============================================================================

beforeEach(() => {
	// Clear all mocks before each test
	vi.clearAllMocks()

	// Re-apply observer mocks on every test. Some suites call
	// vi.unstubAllGlobals() in their own afterEach, which would otherwise remove
	// these globals for the rest of the file. jsdom has no native ResizeObserver,
	// so without the mock code can fall back to self-triggering MutationObservers
	// that spin forever (e.g. thread-preview clamp logic).
	vi.stubGlobal('ResizeObserver', ResizeObserverMock)
	vi.stubGlobal('IntersectionObserver', IntersectionObserverMock)

	// Reset storage mocks
	mockBrowser.storage.local._setStore({})
	mockBrowser.storage.sync._setStore({})
	localStorageMock.clear()
	sessionStorageMock.clear()
})

afterEach(() => {
	// Ensure fake timers never leak between tests/suites.
	vi.useRealTimers()

	// Clean up any DOM modifications
	document.body.innerHTML = ''
})

// =============================================================================
// CUSTOM MATCHERS (optional, for future use)
// =============================================================================

// Example: expect(element).toBeVisibleInViewport()
// Can add custom matchers here if needed

// =============================================================================
// EXPORTS FOR TEST FILES
// =============================================================================

export { vi }
