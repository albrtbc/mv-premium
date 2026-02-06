/**
 * MediaPreviewStep - Preview section with cover image, info slot, Customize/Edit buttons, and template display.
 */

import Edit3 from 'lucide-react/dist/esm/icons/edit-3'
import Brush from 'lucide-react/dist/esm/icons/brush'
import { Textarea } from '@/components/ui/textarea'

interface MediaPreviewStepProps {
	/** Cover/poster image URL */
	coverUrl?: string | null
	/** Cover image height in pixels (default: 100) */
	coverHeight?: number
	/** Free-form info content: title, subtitle, genres, etc. */
	previewInfo: React.ReactNode
	/** Called when the "Customize" button is clicked */
	onCustomize: () => void
	/** Current template BBCode text */
	template: string
	/** Called when template text changes (edit mode) */
	onTemplateChange: (template: string) => void
	/** Whether the template is in edit mode */
	isEditing: boolean
	/** Toggle edit mode */
	onToggleEditing: () => void
	/** Optional referrer policy for the cover image */
	referrerPolicy?: React.HTMLAttributeReferrerPolicy
}

export function MediaPreviewStep({
	coverUrl,
	coverHeight = 100,
	previewInfo,
	onCustomize,
	template,
	onTemplateChange,
	isEditing,
	onToggleEditing,
	referrerPolicy,
}: MediaPreviewStepProps) {
	return (
		<div className="overflow-hidden">
			{/* Media info header */}
			<div className="flex items-start gap-3 mb-4 pb-4 border-b border-border overflow-hidden">
				{coverUrl && (
					<img
						src={coverUrl}
						alt=""
						referrerPolicy={referrerPolicy}
						className="w-[70px] object-cover rounded-lg shrink-0 bg-muted"
						style={{ height: `${coverHeight}px` }}
					/>
				)}
				<div className="flex-1 min-w-0 overflow-hidden">{previewInfo}</div>
				<div className="flex gap-1.5 shrink-0">
					<button
						onClick={onCustomize}
						className="h-7 px-2 text-xs bg-muted/30 border border-border rounded-md text-muted-foreground flex items-center justify-center gap-1.5 cursor-pointer hover:bg-muted/60 transition-colors"
						title="Personalizar el formato de la plantilla"
					>
						<Brush className="w-3 h-3" />
						<span className="hidden sm:inline">Personalizar</span>
					</button>
					<button
						onClick={onToggleEditing}
						className="h-7 px-2 text-xs bg-muted/30 border border-border rounded-md text-muted-foreground flex items-center justify-center gap-1.5 cursor-pointer hover:bg-muted/60 transition-colors"
					>
						<Edit3 className="w-3 h-3" />
						{isEditing ? 'Ver' : 'Editar'}
					</button>
				</div>
			</div>

			{/* Template content */}
			{isEditing ? (
				<Textarea
					value={template}
					onChange={e => onTemplateChange(e.target.value)}
					onKeyDown={e => e.stopPropagation()}
					className="min-h-[180px] text-xs font-mono resize-y leading-relaxed !bg-card"
				/>
			) : (
				<div className="bg-muted/30 border border-border rounded-lg p-3 text-xs font-mono whitespace-pre-wrap break-words max-h-[180px] overflow-y-auto overflow-x-hidden leading-relaxed text-foreground">
					{template}
				</div>
			)}
		</div>
	)
}
