/**
 * Upvotes display components for the improved upvotes feature.
 * Renders user avatars in a compact row with color-coded count.
 */

interface UpvoteUser {
	username: string
	avatar: string
	url: string
}

function getCountColor(count: number): string {
	if (count < 20) return '#9ca3af'   // gray
	if (count < 100) return '#f97316'  // orange
	return '#a855f7'                    // purple
}

export function UpvotesLoading({ count }: { count: number }) {
	if (!count) return null

	const dots = Math.min(count, 5)

	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
			<div
				title="Ver todas las manitas"
				style={{ display: 'flex', opacity: 0.75 }}
			>
				{Array.from({ length: dots }).map((_, i) => (
					<div
						key={i}
						style={{
							width: 24,
							height: 24,
							borderRadius: '50%',
							backgroundColor: 'rgba(128,128,128,0.3)',
							border: '2px solid rgba(128,128,128,0.2)',
							marginLeft: i > 0 ? -10 : 0,
							animation: 'pulse 1.5s ease-in-out infinite',
						}}
					/>
				))}
			</div>
			<span style={{ color: getCountColor(count), fontSize: 13, fontWeight: 600 }}>{count}</span>
		</div>
	)
}

export function UpvotesDisplay({
	count,
	upvotes,
	currentUser,
}: {
	count: number
	upvotes: UpvoteUser[]
	currentUser: string | null
}) {
	if (!count) return null

	const hasVoted = currentUser ? upvotes.some(u => u.username === currentUser) : false
	const visible = [...upvotes].reverse().slice(0, 5)

	return (
		<div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
			<div
				title="Ver todas las manitas"
				style={{
					display: 'flex',
					opacity: hasVoted ? 1 : 0.75,
					transition: 'opacity 0.3s',
				}}
				onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
				onMouseLeave={e => { if (!hasVoted) (e.currentTarget as HTMLElement).style.opacity = '0.75' }}
			>
				{visible.map((user, i) => (
					<a key={user.username} href={user.url} title={user.username} style={{ textDecoration: 'none' }}>
						<img
							src={user.avatar}
							alt={user.username}
							style={{
								width: 24,
								height: 24,
								borderRadius: '50%',
								marginLeft: i > 0 ? -10 : 0,
								position: 'relative',
								transition: 'transform 0.2s',
								filter: hasVoted ? 'none' : 'grayscale(0.3)',
							}}
							onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)' }}
							onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'none' }}
						/>
					</a>
				))}
			</div>
			<span style={{ color: getCountColor(count), fontSize: 13, fontWeight: 600 }}>{count}</span>
		</div>
	)
}
