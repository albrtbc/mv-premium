/**
 * MediaResultItem - A single search result row with image, title, subtitle, and loading indicator.
 */

import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import { cn } from '@/lib/utils'

interface MediaResultItemProps {
	imageUrl: string | null
	fallbackIcon: React.ReactNode
	title: string
	subtitle: string
	onClick: () => void
	disabled?: boolean
	isLoading?: boolean
	/** Image dimensions class, e.g. "w-10 h-14" (default) or "w-10 h-15" */
	imageClassName?: string
	referrerPolicy?: React.HTMLAttributeReferrerPolicy
}

export function MediaResultItem({
	imageUrl,
	fallbackIcon,
	title,
	subtitle,
	onClick,
	disabled,
	isLoading,
	imageClassName = 'w-10 h-14',
	referrerPolicy,
}: MediaResultItemProps) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={cn(
				'flex items-center gap-3 p-2.5 bg-muted/30 border border-border rounded-lg cursor-pointer text-left text-foreground transition-all w-full font-inherit hover:bg-muted/60 hover:border-border/80',
				disabled && 'cursor-wait opacity-70'
			)}
		>
			{imageUrl ? (
				<img
					src={imageUrl}
					alt=""
					referrerPolicy={referrerPolicy}
					className={cn(imageClassName, 'object-cover rounded shrink-0 bg-muted')}
				/>
			) : (
				<div className={cn(imageClassName, 'bg-muted rounded flex items-center justify-center shrink-0')}>
					{fallbackIcon}
				</div>
			)}
			<div className="flex-1 min-w-0 overflow-hidden">
				<div className="font-medium text-[13px] whitespace-nowrap overflow-hidden text-ellipsis text-foreground">
					{title}
				</div>
				<div className="text-xs text-muted-foreground mt-0.5 whitespace-nowrap overflow-hidden text-ellipsis">
					{subtitle}
				</div>
			</div>
			{isLoading && <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />}
		</button>
	)
}
