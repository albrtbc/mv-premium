import { clsx } from 'clsx'
import type { CSSProperties, PropsWithChildren } from 'react'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { getSubforumIconId } from '@/lib/subforums'
import type { HomepageNewsItem } from '../types'

const TWO_LINE_CLAMP_STYLE: CSSProperties = {
	display: '-webkit-box',
	WebkitLineClamp: 2,
	WebkitBoxOrient: 'vertical',
	overflow: 'hidden',
}

function NewsRoot({ children, className }: PropsWithChildren<{ className?: string }>) {
	return <div className={clsx('grid grid-cols-1 gap-2 md:grid-cols-3 xl:grid-cols-5', className)}>{children}</div>
}

function NewsItem({ url, forumSlug, title, thumbnail, createdAt }: HomepageNewsItem) {
	const forumIconId = getSubforumIconId(forumSlug)

	return (
		<a
			href={url}
			className="group relative flex flex-col w-full h-full overflow-hidden rounded border border-border/60 bg-mv-bg-secondary text-left transition-all hover:border-mv-blue/50"
		>
			{/* Image Section - Top (16:9) */}
			<div
				className="aspect-video w-full bg-cover bg-center transition-transform duration-500 group-hover:opacity-90"
				style={
					thumbnail
						? { backgroundImage: `url(${thumbnail})` }
						: { backgroundColor: 'var(--mv-bg-tertiary)' }
				}
			/>

			{/* Content Section - Bottom */}
			<div className="flex flex-1 flex-col justify-between bg-table-row p-3">
				{/* Title & Icon */}
				<div className="flex items-start gap-2">
					<div className="shrink-0 pt-1">
						{forumIconId ? (
							<NativeFidIcon iconId={forumIconId} className="h-4 w-4 rounded-sm" />
						) : (
							<span className="inline-block h-4 w-4 rounded-sm bg-mv-bg-tertiary" />
						)}
					</div>
					<div className="min-w-0 flex-1">
						<h3
							className="h-8 text-xs font-semibold leading-tight text-white/90 group-hover:text-white"
							style={TWO_LINE_CLAMP_STYLE}
							title={title}
						>
							{title}
						</h3>
					</div>
				</div>

				{/* Date */}
				<div className="mt-2 h-4 text-right text-[10px] text-white/60">
					{createdAt || <span className="invisible">00 min</span>}
				</div>
			</div>
		</a>
	)
}

function NewsItemSkeleton() {
	return <div className="h-48 animate-pulse rounded border border-border/60 bg-mv-bg-secondary/70" />
}

function NewsItemList({
	threads,
	loading,
	maxThreads,
}: {
	threads?: HomepageNewsItem[]
	loading: boolean
	maxThreads: number
}) {
	if (loading && (!threads || threads.length === 0)) {
		return <>{Array.from({ length: maxThreads }, (_, i) => <NewsItemSkeleton key={i} />)}</>
	}

	return <>{threads?.slice(0, maxThreads).map(thread => <NewsItem key={thread.url} {...thread} />)}</>
}

export const News = {
	Root: NewsRoot,
	NewsItem,
	NewsItemSkeleton,
	NewsItemList,
}
