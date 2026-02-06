/**
 * MediaSearchInput - Search input with icon and loading spinner.
 */

import Search from 'lucide-react/dist/esm/icons/search'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'

interface MediaSearchInputProps {
	ref?: React.Ref<HTMLInputElement>
	value: string
	onChange: (value: string) => void
	placeholder: string
	isSearching: boolean
	disabled?: boolean
}

export function MediaSearchInput({ ref, value, onChange, placeholder, isSearching, disabled }: MediaSearchInputProps) {
	return (
		<div className="relative mb-4">
			<Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
			<input
				ref={ref}
				type="text"
				value={value}
				onChange={e => onChange(e.target.value)}
				onKeyDown={e => e.stopPropagation()}
				placeholder={placeholder}
				disabled={disabled}
				className="w-full h-10 pl-10 pr-10 bg-black/20 border border-border rounded-lg text-foreground text-[13px] outline-none focus:ring-1 focus:ring-ring focus:bg-black/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			/>
			{isSearching && (
				<Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary animate-spin" />
			)}
		</div>
	)
}
