import { ReactNode, RefObject } from 'react'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { ImageDropzone } from '@/features/editor/components/toolbar'

interface SharedEditorStackProps {
	toolbar: ReactNode
	textareaRef: RefObject<HTMLTextAreaElement | null>
	containerRef: RefObject<HTMLDivElement | null>
	footer: ReactNode
	value: string
	onInput: (value: string) => void
	placeholder?: string
	
	// Actions
	onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void
	onCopy: () => void
	onCursorChange: () => void
	
	// Drag & Drop
	onDragEnter: (e: React.DragEvent) => void
	onDragLeave: (e: React.DragEvent) => void
	onDragOver: (e: React.DragEvent) => void
	onDrop: (e: React.DragEvent) => void
	
	// State
	isCopied: boolean
	isUploading: boolean
	isDraggingOver: boolean
	uploadProgress: number
	showDropzone: boolean
	onDropzoneClose: () => void
	onFilesSelect: (files: File[]) => void
	
	// Optional Children (Floaters, Popovers)
	children?: ReactNode
}

export function SharedEditorStack({
	toolbar,
	textareaRef,
	containerRef,
	footer,
	value,
	onInput,
	placeholder,
	onPaste,
	onCopy,
	onCursorChange,
	onDragEnter,
	onDragLeave,
	onDragOver,
	onDrop,
	isCopied,
	isUploading,
	isDraggingOver,
	uploadProgress,
	showDropzone,
	onDropzoneClose,
	onFilesSelect,
	children
}: SharedEditorStackProps) {
	return (
		<>
			{/* Toolbar (Sticky) */}
			{toolbar}

			{/* Textarea Container */}
			<div
				ref={containerRef}
				className="flex-1 min-h-0 relative group"
				onDragEnter={onDragEnter}
				onDragLeave={onDragLeave}
				onDragOver={onDragOver}
				onDrop={onDrop}
			>
				{/* Floating Copy Button */}
				<div className="absolute top-4 right-4 z-10">
					<Button
						variant="secondary"
						size="icon"
						onClick={onCopy}
						disabled={!value.trim()}
						className={cn(
							'h-8 w-8 rounded-md shadow-md border opacity-0 group-hover:opacity-100 transition-opacity duration-200',
							isCopied
								? 'bg-green-500/10 border-green-500/50 text-green-500'
								: 'bg-background/80 hover:bg-background backdrop-blur-sm'
						)}
					>
						{isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
					</Button>
				</div>

				{/* Textarea */}
				<textarea
					ref={textareaRef}
					defaultValue={value}
					onInput={e => onInput((e.target as HTMLTextAreaElement).value)}
					onPaste={onPaste}
					onClick={onCursorChange}
					onKeyUp={onCursorChange}
					placeholder={placeholder}
					className="absolute inset-0 w-full h-full resize-none p-4 bg-transparent border-none focus:ring-0 focus:outline-none text-sm font-sans leading-relaxed overflow-y-auto custom-scroll"
					spellCheck={false}
				/>

				{/* Dropzone Overlay */}
				{showDropzone && (
					<div
						className="absolute inset-0 z-50 flex items-center justify-center p-4"
						style={{
							backgroundColor: isDraggingOver ? 'rgba(139, 92, 246, 0.1)' : 'rgba(0, 0, 0, 0.7)',
							backdropFilter: 'blur(2px)',
						}}
					>
						<div className="w-full max-w-sm">
							<ImageDropzone
								isOpen={showDropzone}
								onClose={onDropzoneClose}
								onFilesSelect={onFilesSelect}
								isUploading={isUploading}
								uploadProgress={uploadProgress}
							/>
						</div>
					</div>
				)}

				{children}
			</div>

			{/* Footer */}
			{footer}
		</>
	)
}
