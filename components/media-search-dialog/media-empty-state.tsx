/**
 * MediaEmptyState - Empty or initial state with centered icon and text.
 */

import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'

interface MediaEmptyStateProps {
	icon: React.ReactNode
	text: string
}

export function MediaEmptyState({ icon, text }: MediaEmptyStateProps) {
	return (
		<div className="text-center py-10 px-5">
			<div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">{icon}</div>
			<p className="m-0 text-[13px] text-muted-foreground">{text}</p>
		</div>
	)
}

/** Inline error banner for search errors */
export function MediaSearchError({ error }: { error: string }) {
	return (
		<div className="flex items-center gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-[13px] mb-4">
			<AlertCircle className="w-4 h-4 shrink-0" />
			{error}
		</div>
	)
}
