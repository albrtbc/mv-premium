/**
 * Multi-Page Summary Modal Component
 *
 * Allows the user to select a page range and shows
 * a multi-page thread summary with progress feedback.
 */

import { useState, useEffect, useCallback } from 'react'
import X from 'lucide-react/dist/esm/icons/x'
import Copy from 'lucide-react/dist/esm/icons/copy'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle'
import Bot from 'lucide-react/dist/esm/icons/bot'
import Users from 'lucide-react/dist/esm/icons/users'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square'
import Check from 'lucide-react/dist/esm/icons/check'
import FileText from 'lucide-react/dist/esm/icons/file-text'
import Settings from 'lucide-react/dist/esm/icons/settings'
import Layers from 'lucide-react/dist/esm/icons/layers'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle'
import ChevronRight from 'lucide-react/dist/esm/icons/chevron-right'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw'
import History from 'lucide-react/dist/esm/icons/history'
import ExternalLink from 'lucide-react/dist/esm/icons/external-link'
import Clock3 from 'lucide-react/dist/esm/icons/clock-3'
import { ShadowWrapper } from '@/components/shadow-wrapper'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { sendMessage } from '@/lib/messaging'
import { summarizeMultiplePages, type MultiPageSummary } from '../logic/summarize-multi-page'
import {
	MAX_MULTI_PAGES_GEMINI,
	MAX_MULTI_PAGES_GROQ,
	getProviderMultiPageLimit,
	getTotalPages,
	getCurrentPage,
	type MultiPageProgress,
} from '../logic/fetch-pages'
import { getCachedMultiSummary, setCachedMultiSummary, getCachedMultiAge, formatCacheAge } from '../logic/summary-cache'
import { getLastModelUsed } from '@/services/ai/gemini-service'
import { useAIModelLabel } from '@/hooks/use-ai-model-label'
import { renderInlineMarkdown, markdownToBBCode } from '../logic/render-inline-markdown'
import { useSettingsStore } from '@/store/settings-store'
import { toast } from '@/lib/lazy-toast'

// =============================================================================
// TYPES
// =============================================================================

type ModalStep = 'config' | 'loading' | 'result'

interface MultiPageSummaryModalProps {
	isOpen: boolean
	onClose: () => void
}

function formatDuration(ms: number): string {
	const totalSeconds = Math.max(0, Math.floor(ms / 1000))
	const minutes = Math.floor(totalSeconds / 60)
	const seconds = totalSeconds % 60
	if (minutes > 0) return `${minutes}m ${seconds}s`
	return `${seconds}s`
}

// =============================================================================
// COMPONENT
// =============================================================================

export function MultiPageSummaryModal({ isOpen, onClose }: MultiPageSummaryModalProps) {
	const [step, setStep] = useState<ModalStep>('config')
	const [summary, setSummary] = useState<MultiPageSummary | null>(null)
	const [progress, setProgress] = useState<MultiPageProgress | null>(null)
	const [copied, setCopied] = useState(false)
	const [actualModel, setActualModel] = useState<string | null>(null)
	const [startedAtMs, setStartedAtMs] = useState<number | null>(null)
	const [elapsedSeconds, setElapsedSeconds] = useState(0)
	const { modelLabel, isModelFallback, configuredModel, isProviderFallback, providerFallbackMessage } =
		useAIModelLabel(actualModel)
	const aiProvider = useSettingsStore(s => s.aiProvider)
	const hasAnyAIKey = useSettingsStore(s => s.geminiApiKey.trim().length > 0 || s.groqApiKey.trim().length > 0)
	const providerMaxPages = getProviderMultiPageLimit(aiProvider)

	// Page range state
	const totalPages = getTotalPages()
	const currentPage = getCurrentPage()
	const [fromPage, setFromPage] = useState(1)
	const [toPage, setToPage] = useState(Math.min(totalPages, 5))

	// Reset state when modal opens
	useEffect(() => {
		if (isOpen) {
			setStep('config')
			setSummary(null)
			setProgress(null)
			setCopied(false)
			setActualModel(null)
			setStartedAtMs(null)
			setElapsedSeconds(0)
			setFromPage(1)
			setToPage(Math.min(totalPages, 5))
		}
	}, [isOpen, totalPages, providerMaxPages])

	const pageCount = Math.max(1, toPage - fromPage + 1)
	const isValidRange = fromPage >= 1 && toPage >= fromPage && toPage <= totalPages && pageCount <= providerMaxPages

	const handleStartSummary = useCallback(async () => {
		if (!isValidRange || pageCount < 2) return

		const startedAt = Date.now()
		setStep('loading')
		setProgress(null)
		setActualModel(null)
		setStartedAtMs(startedAt)
		setElapsedSeconds(0)

		const result = await summarizeMultiplePages(fromPage, toPage, p => setProgress(p))
		const usedModel = getLastModelUsed()
		const timedResult: MultiPageSummary = {
			...result,
			generationMs: Date.now() - startedAt,
			modelUsed: usedModel || undefined,
		}

		if (!timedResult.error) {
			setCachedMultiSummary(fromPage, toPage, timedResult)
		}

		setActualModel(usedModel)
		setSummary(timedResult)
		setStep('result')
		setStartedAtMs(null)
	}, [fromPage, toPage, isValidRange, pageCount])

	const handleLoadCached = useCallback(() => {
		const cached = getCachedMultiSummary(fromPage, toPage)
		if (cached) {
			setActualModel(cached.modelUsed || null)
			setSummary(cached)
			setStep('result')
			setStartedAtMs(null)
			setElapsedSeconds(0)
		}
	}, [fromPage, toPage])

	useEffect(() => {
		if (step !== 'loading' || startedAtMs === null) return

		setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)))
		const intervalId = window.setInterval(() => {
			setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAtMs) / 1000)))
		}, 1000)

		return () => window.clearInterval(intervalId)
	}, [step, startedAtMs])

	// If API keys are removed while modal is open, auto-close to avoid stale UI.
	useEffect(() => {
		if (isOpen && !hasAnyAIKey) {
			toast.error('No hay API Keys de IA configuradas. Cerrando resumen multi-página.')
			onClose()
		}
	}, [isOpen, hasAnyAIKey, onClose])

	const handleCopy = () => {
		if (!summary) return

		const text = [
			`[center][b]✨ Resumen del Hilo (Págs. ${summary.pageRange})[/b][/center]`,
			'',
			`[b]🤖 TEMA:[/b] ${markdownToBBCode(summary.topic)}`,
			'',
			'[bar]PUNTOS CLAVE[/bar]',
			'[list]',
			...summary.keyPoints.map(p => `[*] ${markdownToBBCode(p)}`),
			'[/list]',
			'',
			'[bar]PARTICIPANTES DESTACADOS[/bar]',
			'[list]',
			...summary.participants.map(p => `[*] [b]${p.name}[/b]: ${markdownToBBCode(p.contribution)}`),
			'[/list]',
			'',
			`[quote][b]📝 ESTADO DEL DEBATE:[/b] [i]"${markdownToBBCode(summary.status)}"[/i][/quote]`,
			'',
			`📊 [b]${summary.totalPostsAnalyzed}[/b] posts · [b]${summary.pagesAnalyzed}[/b] páginas · [b]${summary.totalUniqueAuthors}[/b] autores`,
			'',
			'[i]Generado con Resumidor IA de Mediavida Premium[/i]',
		].join('\n')

		navigator.clipboard.writeText(text)
		setCopied(true)
		setTimeout(() => setCopied(false), 2000)
	}

	const handleBackdropClick = (e: React.MouseEvent) => {
		if (e.target === e.currentTarget) {
			// Don't allow closing during loading
			if (step !== 'loading') onClose()
		}
	}

	const openAISettings = () => {
		sendMessage('openOptionsPage', 'settings?tab=ai')
		onClose()
	}

	const isAINotConfigured = summary?.error?.includes('IA no configurada')
	const badgeTitle = providerFallbackMessage
		? providerFallbackMessage
		: isModelFallback
			? `Modelo configurado: ${configuredModel}`
			: undefined

	if (!isOpen) return null

	return (
		<ShadowWrapper className="fixed inset-0 z-[9999]">
			<div
				className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
				onClick={handleBackdropClick}
			>
				<div className="bg-card border border-border rounded-lg shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
					{/* Header */}
					<div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
						<div className="flex items-center gap-2">
							<Layers className="w-5 h-5 text-primary" />
							<h2 className="text-lg font-semibold text-foreground">Resumen Multi-Página</h2>
							<span
								className={cn(
									'text-[10px] px-1.5 py-0.5 rounded font-medium',
									isProviderFallback || isModelFallback
										? 'text-amber-600 bg-amber-500/10'
										: 'text-muted-foreground bg-muted'
								)}
								title={badgeTitle}
							>
								{modelLabel}
							</span>
						</div>
						{step !== 'loading' && (
							<button
								onClick={onClose}
								className="p-1 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
							>
								<X className="w-5 h-5" />
							</button>
						)}
					</div>

					{/* Content */}
					<div className="flex-1 overflow-y-auto p-4">
						{providerFallbackMessage && (
							<div className="mb-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5">
								<AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
								<p className="text-xs text-amber-700 dark:text-amber-400">{providerFallbackMessage}</p>
							</div>
						)}
						{step === 'config' && (
							<ConfigStep
								fromPage={fromPage}
								toPage={toPage}
								totalPages={totalPages}
								currentPage={currentPage}
								pageCount={pageCount}
								isValidRange={isValidRange}
								aiProvider={aiProvider}
								providerMaxPages={providerMaxPages}
								onFromPageChange={setFromPage}
								onToPageChange={setToPage}
								onStart={handleStartSummary}
								onLoadCached={handleLoadCached}
								cachedAge={getCachedMultiAge(fromPage, toPage)}
							/>
						)}

						{step === 'loading' && <LoadingStep progress={progress} pageCount={pageCount} elapsedSeconds={elapsedSeconds} />}

						{step === 'result' && summary?.error && (
							<ErrorStep
								summary={summary}
								isAINotConfigured={!!isAINotConfigured}
								onOpenSettings={openAISettings}
								onRetry={() => setStep('config')}
							/>
						)}

						{step === 'result' && summary && !summary.error && <ResultStep summary={summary} />}
					</div>

					{/* Footer */}
					{step === 'result' && summary && !summary.error && (
						<div className="flex items-center justify-between gap-2 p-4 border-t border-border bg-muted/10">
							<div className="flex items-center gap-1">
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setStep('config')}
									className="gap-1.5 text-muted-foreground"
								>
									<ChevronRight className="w-3.5 h-3.5 rotate-180" />
									Otro rango
								</Button>
								<Button
									variant="ghost"
									size="sm"
									onClick={handleStartSummary}
									className="gap-1.5 text-muted-foreground"
								>
									<RefreshCw className="w-3.5 h-3.5" />
									Regenerar
								</Button>
							</div>
							<div className="flex items-center gap-2">
								<Button variant="outline" size="sm" onClick={handleCopy} className="gap-2">
									{copied ? (
										<>
											<Check className="w-4 h-4" /> Copiado
										</>
									) : (
										<>
											<Copy className="w-4 h-4" /> Copiar
										</>
									)}
								</Button>
								<Button size="sm" onClick={onClose}>
									Cerrar
								</Button>
							</div>
						</div>
					)}
				</div>
			</div>
		</ShadowWrapper>
	)
}

// =============================================================================
// SUB-COMPONENTS
// =============================================================================

function ConfigStep({
	fromPage,
	toPage,
	totalPages,
	currentPage,
	pageCount,
	isValidRange,
	aiProvider,
	providerMaxPages,
	onFromPageChange,
	onToPageChange,
	onStart,
	onLoadCached,
	cachedAge,
}: {
	fromPage: number
	toPage: number
	totalPages: number
	currentPage: number
	pageCount: number
	isValidRange: boolean
	aiProvider: 'gemini' | 'groq'
	providerMaxPages: number
	onFromPageChange: (v: number) => void
	onToPageChange: (v: number) => void
	onStart: () => void
	onLoadCached: () => void
	cachedAge: number | null
}) {
	const isGroq = aiProvider === 'groq'

	// Quick range presets
	const presets = [
		{ label: 'Todo el hilo', from: 1, to: totalPages, show: totalPages <= providerMaxPages },
		{ label: 'Primeras 5', from: 1, to: Math.min(5, totalPages), show: totalPages >= 3 },
		{ label: 'Primeras 10', from: 1, to: Math.min(10, totalPages), show: totalPages >= 6 && providerMaxPages >= 10 },
		{ label: 'Primeras 20', from: 1, to: Math.min(20, totalPages), show: totalPages >= 15 && providerMaxPages >= 20 },
		{ label: 'Últimas 5', from: Math.max(1, totalPages - 4), to: totalPages, show: totalPages >= 3 },
		{
			label: 'Últimas 10',
			from: Math.max(1, totalPages - 9),
			to: totalPages,
			show: totalPages >= 6 && providerMaxPages >= 10,
		},
		{
			label: 'Últimas 20',
			from: Math.max(1, totalPages - 19),
			to: totalPages,
			show: totalPages >= 15 && providerMaxPages >= 20,
		},
		{
			label: `Desde actual (${currentPage})`,
			from: currentPage,
			to: Math.min(currentPage + providerMaxPages - 1, totalPages),
			show: currentPage > 1 && currentPage < totalPages,
		},
	].filter(p => p.show)

	return (
		<div className="space-y-5">
			{/* Info */}
			<div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
				<div className="flex items-start gap-2">
					<Bot className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
					<div>
						<p className="text-sm font-medium text-foreground">Resumen de múltiples páginas</p>
						<p className="text-xs text-muted-foreground mt-1">
							Selecciona el rango de páginas a resumir. El hilo tiene <strong>{totalPages}</strong>{' '}
							{totalPages === 1 ? 'página' : 'páginas'}.
							{totalPages > providerMaxPages && (
								<span className="text-amber-500"> (máximo {providerMaxPages} páginas con el proveedor actual)</span>
							)}
						</p>
					</div>
				</div>
			</div>

			{/* Provider limits */}
			<div
				className={cn(
					'rounded-lg p-3 border',
					isGroq ? 'bg-amber-500/10 border-amber-500/30' : 'bg-blue-500/10 border-blue-500/30'
				)}
			>
				<div className="flex items-start gap-2">
					<AlertTriangle className={cn('w-4 h-4 mt-0.5 flex-shrink-0', isGroq ? 'text-amber-500' : 'text-blue-500')} />
					<div className="space-y-1">
						<p className="text-sm font-medium text-foreground">
							Límites por proveedor (actual: {isGroq ? 'Groq / Kimi' : 'Gemini'})
						</p>
						<p className="text-xs text-muted-foreground">
							Groq / Kimi: <strong>2-{MAX_MULTI_PAGES_GROQ}</strong> páginas por límites de tokens por minuto
							(TPM) y rate limit.
						</p>
						<p className="text-xs text-muted-foreground">
							Gemini: <strong>2-{MAX_MULTI_PAGES_GEMINI}</strong> páginas por resumen, mejor tolerancia en hilos largos.
						</p>
						<p className="text-xs text-muted-foreground">
							Si necesitas más rango, cambia el proveedor desde Ajustes de IA.
						</p>
					</div>
				</div>
			</div>

			{/* Quick presets */}
			{presets.length > 0 && (
				<div className="space-y-2">
					<label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rangos rápidos</label>
					<div className="flex flex-wrap gap-1.5">
						{presets.map(preset => (
							<button
								key={preset.label}
								onClick={() => {
									onFromPageChange(preset.from)
									onToPageChange(preset.to)
								}}
								className={cn(
									'px-2.5 py-1.5 text-xs rounded-md border transition-colors',
									fromPage === preset.from && toPage === preset.to
										? 'bg-primary text-primary-foreground border-primary'
										: 'bg-muted/30 text-foreground border-border hover:bg-muted/60'
								)}
							>
								{preset.label}
							</button>
						))}
					</div>
				</div>
			)}

			{/* Manual range */}
			<div className="space-y-2">
				<label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rango personalizado</label>
				<div className="flex items-center gap-3">
					<div className="flex-1 space-y-1">
						<label className="text-xs text-muted-foreground">Desde</label>
						<input
							type="number"
							min={1}
							max={totalPages}
							value={fromPage}
							onChange={e => {
								const val = Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1))
								onFromPageChange(val)
							}}
							className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
						/>
					</div>
					<div className="text-muted-foreground mt-5">—</div>
					<div className="flex-1 space-y-1">
						<label className="text-xs text-muted-foreground">Hasta</label>
						<input
							type="number"
							min={1}
							max={totalPages}
							value={toPage}
							onChange={e => {
								const val = Math.max(1, Math.min(totalPages, parseInt(e.target.value) || 1))
								onToPageChange(val)
							}}
							className="w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
						/>
					</div>
				</div>
			</div>

			{/* Warnings */}
			{isValidRange && pageCount > 10 && (
				<div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5">
					<AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
					<p className="text-xs text-amber-600 dark:text-amber-400">
						{pageCount} páginas es un rango amplio. El resumen puede tardar más y perder detalle fino.
					</p>
				</div>
			)}

			{pageCount === 1 && isValidRange && (
				<div className="flex items-start gap-2 bg-primary/5 border border-primary/20 rounded-md p-2.5">
					<Bot className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
					<p className="text-xs text-muted-foreground">
						Para resumir una sola página, usa el botón <strong>Resumir</strong> del hilo. Este modo está pensado para
						rangos de 2 o más páginas.
					</p>
				</div>
			)}

			{!isValidRange && (
				<div className="flex items-start gap-2 bg-destructive/10 border border-destructive/30 rounded-md p-2.5">
					<AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
					<p className="text-xs text-destructive">
						Rango no válido. Asegúrate de que las páginas están entre 1 y {totalPages}
						{pageCount > providerMaxPages ? ` y no superas ${providerMaxPages} páginas con ${isGroq ? 'Groq / Kimi' : 'Gemini'}.` : '.'}
					</p>
				</div>
			)}

			{/* Cached result */}
			{cachedAge !== null && pageCount >= 2 && (
				<button
					onClick={onLoadCached}
					className="w-full flex items-center gap-2.5 p-2.5 rounded-md border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors text-left"
				>
					<History className="w-4 h-4 text-primary flex-shrink-0" />
					<div className="flex-1 min-w-0">
						<p className="text-sm font-medium text-foreground">Ver último resumen</p>
						<p className="text-xs text-muted-foreground">
							Generado {formatCacheAge(cachedAge)} · Págs. {fromPage}-{toPage}
						</p>
					</div>
					<ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
				</button>
			)}

			{/* Start button */}
			<Button onClick={onStart} disabled={!isValidRange || pageCount < 2} className="w-full gap-2" size="lg">
				<Layers className="w-4 h-4" />
				{cachedAge !== null && pageCount >= 2
					? 'Regenerar resumen'
					: `Resumir ${pageCount} ${pageCount === 1 ? 'página' : 'páginas'}`}
			</Button>
		</div>
	)
}

function LoadingStep({
	progress,
	pageCount,
	elapsedSeconds,
}: {
	progress: MultiPageProgress | null
	pageCount: number
	elapsedSeconds: number
}) {
	const getProgressText = () => {
		if (!progress) return 'Preparando...'

		if (progress.phase === 'fetching') {
			return `Descargando páginas... (${progress.current}/${progress.total})`
		}

		if (progress.phase === 'summarizing') {
			if (progress.totalBatches && progress.totalBatches > 1) {
				if (progress.batch === progress.totalBatches) {
					return 'Generando resumen global...'
				}
				return `Analizando bloque ${progress.batch}/${progress.totalBatches}...`
			}
			return 'Analizando con IA...'
		}

		return 'Procesando...'
	}

	const getPercentage = () => {
		if (!progress) return 0

		if (progress.phase === 'fetching') {
			// Fetch is 40% of total progress
			return Math.round((progress.current / progress.total) * 40)
		}

		if (progress.phase === 'summarizing') {
			// Summarize is 60% (40-100)
			return 40 + Math.round((progress.current / progress.total) * 60)
		}

		return 0
	}

	const percentage = getPercentage()

	return (
		<div className="flex flex-col items-center justify-center py-12 gap-5">
			<div className="relative">
				<Loader2 className="w-12 h-12 animate-spin text-primary" />
				<div className="absolute inset-0 flex items-center justify-center">
					<span className="text-[10px] font-bold text-primary">{percentage}%</span>
				</div>
			</div>

			<div className="text-center space-y-2">
				<p className="text-sm font-medium text-foreground">{getProgressText()}</p>
				<p className="text-xs text-muted-foreground">Resumiendo {pageCount} páginas · Esto puede tardar</p>
				<p className="text-xs text-muted-foreground/80">Tiempo transcurrido: {elapsedSeconds}s</p>
			</div>

			{/* Progress bar */}
			<div className="w-full max-w-xs">
				<div className="h-1.5 bg-muted rounded-full overflow-hidden">
					<div
						className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
						style={{ width: `${percentage}%` }}
					/>
				</div>
			</div>
		</div>
	)
}

function ErrorStep({
	summary,
	isAINotConfigured,
	onOpenSettings,
	onRetry,
}: {
	summary: MultiPageSummary
	isAINotConfigured: boolean
	onOpenSettings: () => void
	onRetry: () => void
}) {
	return (
		<div className="flex flex-col items-center justify-center py-12 gap-4">
			<div
				className={cn(
					'w-12 h-12 rounded-full flex items-center justify-center',
					isAINotConfigured ? 'bg-primary/10' : 'bg-destructive/10'
				)}
			>
				{isAINotConfigured ? (
					<Settings className="w-6 h-6 text-primary" />
				) : (
					<AlertCircle className="w-6 h-6 text-destructive" />
				)}
			</div>
			<div className="text-center space-y-2">
				<p className={cn('text-sm font-medium', isAINotConfigured ? 'text-foreground' : 'text-destructive')}>
					{isAINotConfigured ? 'IA no configurada' : 'Error'}
				</p>
				<p className="text-xs text-muted-foreground">
					{isAINotConfigured ? 'Necesitas una API Key de Gemini o Groq para usar esta función.' : summary.error}
				</p>
				{isAINotConfigured ? (
					<Button size="sm" onClick={onOpenSettings} className="mt-3 gap-2">
						<Settings className="w-4 h-4" />
						Configurar API
					</Button>
				) : (
					<Button size="sm" variant="outline" onClick={onRetry} className="mt-3 gap-2">
						<ChevronRight className="w-4 h-4 rotate-180" />
						Volver a intentar
					</Button>
				)}
			</div>
		</div>
	)
}

function ResultStep({ summary }: { summary: MultiPageSummary }) {
	return (
		<div className="space-y-6">
			{/* Fetch errors warning */}
			{summary.fetchErrors.length > 0 && (
				<div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-md p-2.5">
					<AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
					<p className="text-xs text-amber-600 dark:text-amber-400">
						No se pudieron descargar las páginas: {summary.fetchErrors.join(', ')}
					</p>
				</div>
			)}

			{/* Topic */}
			<div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
				<h3 className="text-xs font-bold text-primary mb-1 uppercase tracking-wider flex items-center gap-1.5">
					<Bot className="w-3.5 h-3.5" /> Tema Principal
				</h3>
				<p className="text-sm font-medium text-foreground leading-relaxed">{renderInlineMarkdown(summary.topic)}</p>
			</div>

			{/* Key Points */}
			<div className="space-y-3">
				<h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
					<Check className="w-3.5 h-3.5" /> Puntos Clave
				</h3>
				<ul className="grid gap-2">
					{summary.keyPoints?.map((point, i) => (
						<li
							key={i}
							className="text-sm text-foreground/90 bg-muted/30 rounded-md p-2.5 flex gap-3 items-start border border-border/50"
						>
							<span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary mt-2" />
							<span className="leading-relaxed">{renderInlineMarkdown(point)}</span>
						</li>
					))}
				</ul>
			</div>

			{/* Participants */}
			<div className="space-y-3">
				<h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
					<Users className="w-3.5 h-3.5" /> Participantes Destacados
				</h3>
				<div className="grid gap-2">
					{summary.participants?.map((p, i) => (
						<div
							key={i}
							className="flex gap-3 text-sm border border-border/40 rounded-md p-2 hover:bg-muted/20 transition-colors"
						>
							<div className="flex-shrink-0 w-8 h-8 rounded-md bg-secondary flex items-center justify-center font-bold text-xs text-secondary-foreground uppercase overflow-hidden">
								{p.avatarUrl ? (
									<img src={p.avatarUrl} alt={p.name} className="w-full h-full object-cover" />
								) : (
									p.name.substring(0, 2)
								)}
							</div>
							<div className="space-y-0.5">
								<div className="font-semibold text-foreground">{p.name}</div>
								<div className="text-muted-foreground text-xs leading-relaxed">
									{renderInlineMarkdown(p.contribution)}
								</div>
							</div>
						</div>
					))}
				</div>
			</div>

			{/* Status */}
			<div className="bg-muted/50 rounded-lg p-3 border-l-2 border-primary">
				<h3 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Estado del Debate</h3>
				<p className="text-sm text-foreground/80 italic">{renderInlineMarkdown(summary.status)}</p>
			</div>

			{/* Metadata */}
			<div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground/70 pt-2">
				<div className="flex items-center gap-1.5">
					<Layers className="w-3.5 h-3.5" />
					<span>Págs. {summary.pageRange}</span>
				</div>
				<div className="flex items-center gap-1.5">
					<FileText className="w-3.5 h-3.5" />
					<span>{summary.pagesAnalyzed} páginas</span>
				</div>
				<div className="flex items-center gap-1.5">
					<MessageSquare className="w-3.5 h-3.5" />
					<span>{summary.totalPostsAnalyzed} posts</span>
				</div>
				<div className="flex items-center gap-1.5">
					<Users className="w-3.5 h-3.5" />
					<span>{summary.totalUniqueAuthors} autores</span>
				</div>
				{summary.modelUsed && (
					<div className="flex items-center gap-1.5">
						<Bot className="w-3.5 h-3.5" />
						<span>{summary.modelUsed}</span>
					</div>
				)}
				{typeof summary.generationMs === 'number' && (
					<div className="flex items-center gap-1.5">
						<Clock3 className="w-3.5 h-3.5" />
						<span>{formatDuration(summary.generationMs)}</span>
					</div>
				)}
				</div>

			{/* API console links */}
			<div className="flex flex-col gap-1 pt-1">
				<a
					href="https://aistudio.google.com/"
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
				>
					<ExternalLink className="w-3 h-3" />
					Gemini: Consulta tu uso en AI Studio
				</a>
				<a
					href="https://console.groq.com/"
					target="_blank"
					rel="noopener noreferrer"
					className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50 hover:text-muted-foreground transition-colors"
				>
					<ExternalLink className="w-3 h-3" />
					Groq: Consulta tu uso en Groq Console
				</a>
			</div>
		</div>
	)
}
