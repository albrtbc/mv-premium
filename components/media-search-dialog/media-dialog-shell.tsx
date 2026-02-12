/**
 * MediaDialogShell - Shared dialog frame for media search dialogs.
 * Provides: Dialog + DialogContent + DialogHeader (icon + title + close) + scrollable content area + footer slot.
 */

import X from 'lucide-react/dist/esm/icons/x'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

const DIALOG_WIDTH = 540

interface MediaDialogShellProps {
	isOpen: boolean
	onClose: () => void
	icon: React.ReactNode
	title: string
	height?: number | 'auto'
	footer?: React.ReactNode
	children: React.ReactNode
}

export function MediaDialogShell({ isOpen, onClose, icon, title, height = 580, footer, children }: MediaDialogShellProps) {
	return (
		<Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
			<DialogContent
				showCloseButton={false}
				className="p-0 gap-0 overflow-hidden flex flex-col bg-background border-border rounded-xl"
				style={{
					width: `${DIALOG_WIDTH}px`,
					height: typeof height === 'number' ? `${height}px` : height,
					minHeight: '200px',
					maxWidth: '95vw',
					maxHeight: '85vh',
					zIndex: 99999,
				}}
			>
				<DialogHeader className="p-4 px-5 border-b border-border flex flex-row items-center justify-between shrink-0">
					<DialogTitle className="flex items-center gap-2.5 text-[15px] font-semibold text-foreground">
						<div className="p-1.5 rounded-lg bg-primary/15 flex items-center justify-center">{icon}</div>
						{title}
					</DialogTitle>
					<button
						onClick={onClose}
						className="flex items-center justify-center w-7 h-7 rounded-md bg-transparent text-muted-foreground border-none cursor-pointer transition-colors hover:bg-muted hover:text-foreground"
						title="Cerrar"
					>
						<X size={18} />
					</button>
				</DialogHeader>

				<div
					className="flex-1 overflow-y-auto overflow-x-hidden p-5 min-h-0 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent"
					onWheel={e => e.stopPropagation()}
				>
					{children}
				</div>

				{footer}
			</DialogContent>
		</Dialog>
	)
}
