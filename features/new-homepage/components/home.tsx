import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { clsx } from 'clsx'
import { getForumLastThreads, getUserLastPosts, getFavorites, getLastNews, getUsername } from '../logic/data'
import { getLatestVisitedForums } from '../lib/visited-forums'
import { getIconClassBySlug } from '../lib/forum-icons'
import { Threads } from './threads'
import { News } from './news'

const MAX_NEWS = 5
const MAX_THREADS = 40
const MAX_USER_LAST_POSTS = 6
const MAX_FAVORITES = 6
const THREADS_REFETCH_INTERVAL = 30 * 1000
const NEWS_REFETCH_INTERVAL = 60 * 10 * 1000

export function Home({ onLoad }: { onLoad: () => void }) {
	const username = useMemo(() => getUsername(), [])
	const lastVisitedForums = useMemo(() => getLatestVisitedForums(), [])

	const { data: lastThreads, isPending: lastThreadsPending } = useQuery({
		queryKey: ['lastThreads'],
		queryFn: () => getForumLastThreads(),
		refetchInterval: THREADS_REFETCH_INTERVAL,
	})

	const { data: userLastPosts, isPending: userLastPostsPending } = useQuery({
		queryKey: ['userLastPosts'],
		queryFn: () => getUserLastPosts(username),
		refetchInterval: THREADS_REFETCH_INTERVAL,
	})

	const { data: favorites, isPending: favoritesPending } = useQuery({
		queryKey: ['favorites'],
		queryFn: () => getFavorites(),
		refetchInterval: THREADS_REFETCH_INTERVAL,
	})

	const { data: lastNews, isPending: lastNewsPending } = useQuery({
		queryKey: ['lastNews'],
		queryFn: () => getLastNews(),
		refetchInterval: NEWS_REFETCH_INTERVAL,
	})

	useEffect(() => {
		onLoad()
	}, [onLoad])

	return (
		<div className="pb-4">
			<h1>Noticias</h1>
			<News.Root className="mt-3">
				<News.NewsItemList threads={lastNews} loading={lastNewsPending} maxThreads={MAX_NEWS} />
			</News.Root>
			<div className="grid grid-cols-3 gap-8 mt-10">
				<div className="col-span-2">
					<div className="flex items-end justify-between -mt-[0.3rem]">
						<h1>Foro</h1>
						<div className="flex items-center gap-2" title="Últimos foros visitados">
							{lastVisitedForums.slice(0, 8).map(forumSlug => (
								<a
									key={forumSlug}
									href={`/foro/${forumSlug}`}
									title={forumSlug}
								>
									<i className={clsx('fid', getIconClassBySlug(forumSlug))} />
								</a>
							))}
						</div>
					</div>
					<Threads.Root className="mt-3">
						<Threads.ThreadList threads={lastThreads} loading={lastThreadsPending} maxThreads={MAX_THREADS} />
					</Threads.Root>
				</div>
				<div>
					<div className="flex items-end justify-between">
						<h2>Tus últimos posts</h2>
						{username && <a href={`/id/${username}/posts`}>Todos</a>}
					</div>
					<Threads.Root className="mt-3">
						<Threads.ThreadList
							threads={userLastPosts}
							loading={userLastPostsPending}
							maxThreads={MAX_USER_LAST_POSTS}
						/>
					</Threads.Root>
					<div className="flex items-end justify-between mt-4">
						<h2>Favoritos</h2>
						<a href="/foro/favoritos">Todos</a>
					</div>
					<Threads.Root className="mt-3">
						<Threads.ThreadList threads={favorites} loading={favoritesPending} maxThreads={MAX_FAVORITES} />
					</Threads.Root>
				</div>
			</div>
		</div>
	)
}
