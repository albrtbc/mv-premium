import { clsx } from 'clsx'
import type { PropsWithChildren } from 'react'
import { NativeFidIcon } from '@/components/native-fid-icon'
import { getSubforumIconId } from '@/lib/subforums'
import type { HomepageItemBase, HomepageThread } from '../types'

function abbrevNumberToInt(value: string): number {
	const match = value.match(/^(\d+(\.\d+)?)([kK])?$/)
	if (!match) return 0

	const numPart = parseFloat(match[1])
	if (match[3]?.toLowerCase() === 'k') {
		return Math.round(numPart * 1000)
	}

	return Math.round(numPart)
}

function ThreadsRoot({ children, className }: PropsWithChildren<{ className?: string }>) {
	return (
		<div
			className={clsx('grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-table-border bg-[var(--table-border)] shadow-sm', className)}
		>
			{children}
		</div>
	)
}

function ThreadItem({
	url,
	urlSinceLastVisit,
	title,
	lastActivityAt,
	responsesSinceLastVisit,
	totalResponses,
	hasLive,
	forumSlug,
}: HomepageThread) {
	const totalResponsesAsInt = totalResponses ? abbrevNumberToInt(totalResponses) : 0
	const forumIconId = getSubforumIconId(forumSlug)

	return (
		<div className="flex justify-between bg-table-row text-[var(--table-row-foreground)] transition-colors hover:bg-table-row-hover!">
			<div className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2">
				<a href={`/foro/${forumSlug}`} title={`Ir a ${forumSlug}`} className="shrink-0 transition hover:opacity-80">
					{forumIconId ? (
						<NativeFidIcon iconId={forumIconId} className="rounded-sm" />
					) : (
						<span className="inline-block h-6 w-6 rounded-sm bg-mv-bg-tertiary" />
					)}
				</a>
				<a href={url} className="min-w-0 flex-1 truncate text-sm hover:underline" title={title}>
					{title}
				</a>
				<div className="flex shrink-0 items-center gap-2 text-xs">
					{hasLive && <a href={`${url}/live`} title="Abrir live" className="h-2.5 w-2.5 rounded-full bg-red-500" />}
					<span
						title="Total de respuestas"
						className={clsx('w-10 text-right font-medium', {
							'text-muted-foreground': totalResponsesAsInt < 100,
							'text-foreground/80': totalResponsesAsInt >= 100 && totalResponsesAsInt <= 1000,
							'text-orange-400': totalResponsesAsInt > 1000 && totalResponsesAsInt <= 10000,
							'text-purple-400': totalResponsesAsInt > 10000,
						})}
					>
						{totalResponses}
					</span>
					<span title="Tiempo desde la última respuesta" className="w-8 text-right text-muted-foreground">
						{lastActivityAt}
					</span>
				</div>
			</div>

			{responsesSinceLastVisit && urlSinceLastVisit ? (
				<a
					href={urlSinceLastVisit}
					title="Respuestas nuevas"
					className={clsx(
						'flex w-10 shrink-0 items-center justify-center text-xs font-semibold text-white transition hover:opacity-90',
						{
							'bg-blue-500': responsesSinceLastVisit < 30,
							'bg-orange-500': responsesSinceLastVisit >= 30 && responsesSinceLastVisit <= 99,
							'bg-red-500': responsesSinceLastVisit > 99,
						}
					)}
				>
					{responsesSinceLastVisit > 99 ? '+99' : responsesSinceLastVisit}
				</a>
			) : (
				<div
					title="Sin respuestas nuevas"
					className="flex w-10 shrink-0 items-center justify-center bg-[var(--table-row-alt)] text-xs text-muted-foreground"
				>
					/
				</div>
			)}
		</div>
	)
}

function ThreadSkeleton() {
	return <div className="h-10 animate-pulse bg-table-row" />
}

function ThreadList({
	threads,
	loading,
	maxThreads,
}: {
	threads?: HomepageItemBase[]
	loading: boolean
	maxThreads: number
}) {
	if (loading) {
		const skeletonCount = Math.min(maxThreads, 8)
		return <>{Array.from({ length: skeletonCount }, (_, i) => <ThreadSkeleton key={i} />)}</>
	}

	return <>{threads?.slice(0, maxThreads).map(thread => <ThreadItem key={thread.url} {...thread as HomepageThread} />)}</>
}

export const Threads = {
	Root: ThreadsRoot,
	Thread: ThreadItem,
	ThreadSkeleton,
	ThreadList,
}
