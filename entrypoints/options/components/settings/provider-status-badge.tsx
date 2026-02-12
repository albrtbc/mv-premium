/**
 * Provider Status Badge
 *
 * Shows a small "Configurado" / "Sin configurar" badge
 * next to API provider headers in the integrations settings.
 */

import { cn } from '@/lib/utils'

interface ProviderStatusBadgeProps {
	isConfigured: boolean
}

export function ProviderStatusBadge({ isConfigured }: ProviderStatusBadgeProps) {
	return (
		<span
			className={cn(
				'inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded-full',
				isConfigured
					? 'bg-green-500/10 text-green-600 dark:text-green-400'
					: 'bg-muted text-muted-foreground'
			)}
		>
			{isConfigured ? 'Configurado' : 'Sin configurar'}
		</span>
	)
}
