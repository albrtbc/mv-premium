/**
 * Content Tab Content - Bold color + page width settings
 */
import Sparkles from 'lucide-react/dist/esm/icons/sparkles'
import Settings2 from 'lucide-react/dist/esm/icons/settings-2'
import { toast } from 'sonner'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SettingsSection } from '../../components/settings/settings-section'
import { SettingRow, ColorPickerWithConfirm } from '../../components/settings'
import { useSettingsStore } from '@/store/settings-store'

export function ContentTabContent() {
	const { boldColor, boldColorEnabled, setBoldColor, setBoldColorEnabled } = useSettingsStore()

	return (
		<SettingsSection title="Contenido" description="Funciones para visualizar y organizar contenido en hilos.">
			{/* Text Styling */}
			<SettingRow
				icon={<Sparkles className="h-4 w-4" />}
				label="Personalizar color de negrita"
				description="Usa un color personalizado para el texto en negrita. Desactivado = color nativo de Mediavida."
			>
				<div className="flex items-center gap-3">
					{boldColorEnabled && (
						<ColorPickerWithConfirm value={boldColor || '#ffffff'} defaultValue="#ffffff" onConfirm={setBoldColor} />
					)}
					<Switch
						checked={boldColorEnabled}
						onCheckedChange={checked => {
							setBoldColorEnabled(checked)
							toast.success(checked ? 'Color personalizado activado' : 'Color nativo restaurado')
						}}
					/>
				</div>
			</SettingRow>

			<Separator />

			{/* Page Width - Layout */}
			<PageWidthSettings />
		</SettingsSection>
	)
}

function PageWidthSettings() {
	const { ultrawideMode, setUltrawideMode } = useSettingsStore()

	return (
		<SettingRow
			icon={<Settings2 className="h-4 w-4" />}
			label="Modo Ultrawide"
			description="Ajusta el ancho del contenido. Ideal para monitores grandes."
		>
			<Select
				value={ultrawideMode}
				onValueChange={val => {
					setUltrawideMode(val as typeof ultrawideMode)
					toast.success('Configuración guardada')
				}}
			>
				<SelectTrigger className="w-[180px]">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="off">Off</SelectItem>
					<SelectItem value="wide">Wide</SelectItem>
					<SelectItem value="extra-wide">Extrawide</SelectItem>
					<SelectItem value="full">Ultrawide</SelectItem>
				</SelectContent>
			</Select>
		</SettingRow>
	)
}
