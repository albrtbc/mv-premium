import { useState, useRef, useCallback, useEffect } from 'react'
import { useTextEditor } from '@/hooks/use-text-editor'
import { useEditorHandlers } from '@/entrypoints/options/views/draft-editor/use-editor-handlers'
import { useUploadState } from '@/hooks/use-upload-state'
import { useDialogManager } from '@/hooks/use-dialog-manager'
import { getActiveFormats } from '@/features/editor/lib/bbcode-utils'
import { DEFAULT_TOOLBAR_BUTTONS } from '@/types/editor'
import { type TableEditState } from '@/features/editor/components/toolbar/toolbar-handlers'

interface UseFullPageEditorProps {
	value: string
	onChange: (value: string) => void
	shortcuts?: boolean
}

export function useFullPageEditor({ value, onChange, shortcuts = false }: UseFullPageEditorProps) {
	// Refs
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const previewRef = useRef<HTMLDivElement>(null)
	const editorContainerRef = useRef<HTMLDivElement>(null)
	const lastTypedValueRef = useRef<string>(value)

	// State
	const [activeFormats, setActiveFormats] = useState<string[]>([])
	const [isTableAtCursor, setIsTableAtCursor] = useState(false)
	const [tableEditData, setTableEditData] = useState<TableEditState | null>(null)
	const [copied, setCopied] = useState(false)

	// Dialogs
	const dialogs = useDialogManager()

	// Sync textarea when value changes externally
	useEffect(() => {
		if (textareaRef.current && value !== lastTypedValueRef.current) {
			textareaRef.current.value = value
			lastTypedValueRef.current = value
		}
	}, [value])

	// Check active formats
	const checkActiveFormats = useCallback(() => {
		if (!textareaRef.current) return
		const text = textareaRef.current.value
		const cursorPos = textareaRef.current.selectionStart
		const formats = getActiveFormats(text, cursorPos)
		setActiveFormats(formats)
	}, [])

	// Base Editor Hook
	const editor = useTextEditor({
		value,
		onChange: newValue => {
			onChange(newValue)
			lastTypedValueRef.current = newValue // Update expected value
		},
		textareaRef,
		shortcuts,
		buttons: DEFAULT_TOOLBAR_BUTTONS,
		onAction: dialogId => {
			const tableData = handlers.handleDialog(dialogId)
			if (dialogId === 'table') {
				setTableEditData(tableData)
			}
		},
	})

	// Handlers Hook
	const handlers = useEditorHandlers({
		onChange,
		textareaRef,
		previewRef,
		editor: {
			insertAtCursor: editor.insertAtCursor,
			wrapSelection: editor.wrapSelection,
			executeAction: editor.executeAction,
			getSelection: editor.getSelection,
			replaceSelection: editor.replaceSelection,
		},
		dialogs: {
			open: dialogs.open,
			close: dialogs.close,
		},
		checkActiveFormats,
	})

	// Upload Hook
	const upload = useUploadState({
		dialogs,
		onInsertImage: bbcode => editor.insertAtCursor(bbcode),
	})

	// Drag & Drop Handler
	const handleDragLeave = useCallback(
		(e: React.DragEvent) => {
			upload.handleDragLeave(e, editorContainerRef)
		},
		[upload]
	)

	// Paste Handler
	const handlePaste = useCallback(
		async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
			if (upload.isUploading) return

			const clipboardData = e.clipboardData
			if (!clipboardData) return

			const imageFiles: File[] = []

			if (clipboardData.files && clipboardData.files.length > 0) {
				for (const file of Array.from(clipboardData.files)) {
					if (file.type.startsWith('image/')) {
						imageFiles.push(file)
					}
				}
			}

			if (imageFiles.length === 0 && clipboardData.items) {
				for (const item of Array.from(clipboardData.items)) {
					if (item.type.startsWith('image/')) {
						const file = item.getAsFile()
						if (file) {
							imageFiles.push(file)
						}
					}
				}
			}

			if (imageFiles.length > 0) {
				e.preventDefault()
				dialogs.open('dropzone')
				await new Promise(resolve => setTimeout(resolve, 50))
				await upload.handleFilesSelect(imageFiles)
				return
			}

			handlers.handlePaste(e)
		},
		[upload, dialogs, handlers]
	)

	// Copy Handler
	const handleCopy = useCallback(async () => {
		if (!value.trim()) return
		try {
			await navigator.clipboard.writeText(value)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			// Ignore error
		}
	}, [value])

	// Cursor State Updater
	const updateCursorState = useCallback(() => {
		checkActiveFormats()
		setIsTableAtCursor(handlers.checkTableAtCursor())
	}, [checkActiveFormats, handlers])

	return {
		editor,
		handlers,
		upload,
		dialogs,
		refs: {
			textarea: textareaRef,
			preview: previewRef,
			container: editorContainerRef,
			lastTypedValue: lastTypedValueRef,
		},
		state: {
			activeFormats,
			isTableAtCursor,
			tableEditData,
			setTableEditData,
			copied,
		},
		actions: {
			handleDragLeave,
			handlePaste,
			handleCopy,
			updateCursorState,
		},
	}
}
