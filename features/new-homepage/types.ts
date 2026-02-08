export interface HomepageThread {
	url: string
	forumSlug: string
	title: string
	thumbnail?: string
	hasLive?: boolean
	urlSinceLastVisit?: string | null
	responsesSinceLastVisit?: number
	lastActivityAt?: string
	createdAt?: string
	/** Abbreviated string like "1.2k" or "350" */
	totalResponses?: string
}
