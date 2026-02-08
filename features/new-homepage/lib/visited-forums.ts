const STORAGE_KEY = 'mvp-latest-visited-forums'

export function getLatestVisitedForums(): string[] {
	try {
		const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
		return Array.isArray(parsed) ? parsed : []
	} catch {
		return []
	}
}

export function setLatestVisitedForum(forum: string): void {
	try {
		const existing = getLatestVisitedForums()
		const updated = [forum, ...existing.filter(f => f !== forum)]
		localStorage.setItem(STORAGE_KEY, JSON.stringify(updated.slice(0, 20)))
	} catch {
		// localStorage may be full or unavailable
	}
}
