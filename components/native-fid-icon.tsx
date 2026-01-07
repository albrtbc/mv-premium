import { useMemo, useState, useEffect } from 'react'
import { getFidIconStyles } from '@/lib/fid-icons'
import { cn } from '@/lib/utils'
import { storage } from '#imports'
import { ICONS_STORAGE_KEY, type FidIconStyle } from '@/features/icons/icon-syncer'

interface NativeFidIconProps {
	iconId: number
	className?: string
	/** Optional style override (used by SubforumsView which has its own cache) */
	style?: React.CSSProperties
}

/**
 * NativeFidIcon component - Renders a native Mediavida community icon (FID)
 * 
 * MODES:
 * 1. Content Script (Mediavida.com): Extracts computed styles from the DOM.
 * 2. Dashboard (Extension): Reads cached styles from storage (synced by icon-syncer).
 */
export function NativeFidIcon({ iconId, className, style: propStyle }: NativeFidIconProps) {
	// ALL HOOKS MUST BE CALLED BEFORE ANY CONDITIONAL RETURNS
	const [retryCount, setRetryCount] = useState(0)
	const [dashboardStyle, setDashboardStyle] = useState<FidIconStyle | null>(null)
	
	// Mode detection - always computed
	const isDashboard = useMemo(() => {
		try {
			return window.location.protocol.includes('extension')
		} catch {
			return false
		}
	}, [])

	// DASHBOARD MODE: Load from storage
	useEffect(() => {
		// Skip if propStyle is provided or not in dashboard mode
		if (propStyle || !isDashboard) return

		storage.getItem<Record<number, FidIconStyle>>(ICONS_STORAGE_KEY).then(cache => {
			if (cache && cache[iconId]) {
				setDashboardStyle(cache[iconId])
			}
		})
	}, [isDashboard, iconId, propStyle])

	// CONTENT SCRIPT MODE: Compute from DOM
	const domStyle = useMemo(() => {
		// Skip if propStyle is provided or in dashboard mode
		if (propStyle || isDashboard) return null

		const styles = getFidIconStyles(iconId)
		if (styles.backgroundImage === 'none' && retryCount < 5) {
			setTimeout(() => setRetryCount(c => c + 1), 500)
		}
		return styles
	}, [iconId, retryCount, isDashboard, propStyle])

	// NOW WE CAN DO CONDITIONAL RETURNS (after all hooks)
	
	// If style is provided via props (e.g. from SubforumsView), use it directly
	if (propStyle) {
		return <span className={cn("inline-block shrink-0", className)} style={propStyle} aria-hidden="true" />
	}

	// Determine final style
	const finalStyle = isDashboard ? dashboardStyle : domStyle

	// Fallback/Loading state
	if (!finalStyle || finalStyle.backgroundImage === 'none' || !finalStyle.backgroundImage) {
		if (isDashboard) {
			return <span className={cn("inline-block shrink-0 w-6 h-6", className)} />
		}
		
		return (
			<span 
				className={cn("inline-block shrink-0", className)}
				style={{
					backgroundImage: 'url("/style/img/sprites/fids.png")',
					backgroundPosition: '0 0',
					width: 24,
					height: 24
				}}
				aria-hidden="true"
			/>
		)
	}

	const effectiveStyle = {
		...finalStyle,
		display: 'inline-block',
		width: 24,
		height: 24,
		backgroundRepeat: 'no-repeat'
	}

	return (
		<span 
			className={cn("inline-block shrink-0", className)}
			style={effectiveStyle}
			aria-hidden="true"
		/>
	)
}
