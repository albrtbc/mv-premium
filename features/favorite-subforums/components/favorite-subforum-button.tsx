/**
 * FavoriteSubforumButton - Star button to mark/unmark a subforum as favorite
 */
import { useState, useCallback, useEffect, useRef } from 'react'
import { logger } from '@/lib/logger'
import Star from 'lucide-react/dist/esm/icons/star'
import { toast } from '@/lib/lazy-toast'
import { toggleFavoriteSubforum, isSubforumFavorite } from '@/features/favorite-subforums/logic/storage'
import { subscribeFavoriteSubforumsChanges } from '@/features/favorite-subforums/logic/listeners'
import { cn } from '@/lib/utils'
import type { FavoriteSubforum } from '@/types/storage'

interface FavoriteSubforumButtonProps {
	/** Subforum data (without addedAt) */
	subforum: Omit<FavoriteSubforum, 'addedAt'>
	/** Size of the star icon */
	size?: number
	/** Additional CSS classes */
	className?: string
}

/**
 * FavoriteSubforumButton component - A star icon that toggles a subforum's favorite status.
 * Uses optimistic updates for instant visual feedback without flicker.
 */
export function FavoriteSubforumButton({ subforum, size = 16, className = '' }: FavoriteSubforumButtonProps) {
	const [isFavorite, setIsFavorite] = useState(false)
	const [isInitializing, setIsInitializing] = useState(true)
	
	// Ref to prevent double-clicks while toggle is in progress
	const isTogglingRef = useRef(false)

	// Load initial state from storage
	useEffect(() => {
		let cancelled = false

		const loadState = async () => {
			try {
				const favoriteResult = await isSubforumFavorite(subforum.id)
				if (!cancelled) {
					setIsFavorite(favoriteResult)
					setIsInitializing(false)
				}
			} catch (err) {
				logger.error('Error loading favorite state:', err)
				if (!cancelled) {
					setIsInitializing(false)
				}
			}
		}

		void loadState()

		// Subscribe to external changes (other tabs, sidebar updates)
		// Only update if we're not currently toggling (to avoid reverting optimistic update)
		const unsubscribe = subscribeFavoriteSubforumsChanges(() => {
			if (!isTogglingRef.current) {
				void loadState()
			}
		})

		return () => {
			cancelled = true
			unsubscribe()
		}
	}, [subforum.id])

	/**
	 * Handles the click event with optimistic update
	 */
	const handleClick = useCallback(
		async (e: React.MouseEvent) => {
			e.preventDefault()
			e.stopPropagation()

			// Prevent double-clicks or clicks during initialization
			if (isTogglingRef.current || isInitializing) return

			// Optimistic update: toggle state immediately
			const previousState = isFavorite
			setIsFavorite(!previousState)
			isTogglingRef.current = true

			try {
				const result = await toggleFavoriteSubforum(subforum)
				
				// Sync with actual result (in case of race conditions)
				setIsFavorite(result.isFavorite)

				if (result.isFavorite) {
					toast.success(`${subforum.name} añadido a favoritos`)
				} else {
					toast.success(`${subforum.name} eliminado de favoritos`)
				}
			} catch (err) {
				// Revert optimistic update on error
				setIsFavorite(previousState)
				logger.error('Error toggling favorite:', err)
				toast.error('Error al actualizar favoritos')
			} finally {
				isTogglingRef.current = false
			}
		},
		[subforum, isFavorite, isInitializing]
	)

	return (
		<button
			type="button"
			onClick={handleClick}
			disabled={isInitializing}
			className={cn(
				'flex items-center justify-center h-8 w-8 rounded-lg',
				'bg-transparent text-muted-foreground cursor-pointer transition-all duration-150 relative',
				'hover:bg-muted hover:border hover:border-border hover:text-yellow-500',
				'disabled:cursor-not-allowed disabled:opacity-50',
				isFavorite && 'text-yellow-500 hover:text-yellow-400',
				className
			)}
			title={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
			aria-label={isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
		>
			<Star size={size} fill={isFavorite ? 'currentColor' : 'none'} />
		</button>
	)
}

