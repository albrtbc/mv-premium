/**
 * Hook: useAIModelLabel
 *
 * Shared hook for displaying the AI model label and detecting fallback usage
 * across post summary, thread summary, and multi-page summary modals.
 */

import { useSettingsStore } from '@/store/settings-store'
import { getAvailableModels } from '@/services/ai/gemini-service'
import { getAvailableGroqModels } from '@/services/ai/groq-service'

interface AIModelLabelResult {
	/** The model ID to display (actual if available, otherwise configured) */
	displayModel: string
	/** Human-readable model label (e.g. "Gemini 2.5 Flash") */
	modelLabel: string
	/** True if the actual model differs from the configured one (rate-limit fallback) */
	isModelFallback: boolean
	/** The model ID selected for the effective provider */
	configuredModel: string
	/** Provider selected in settings */
	configuredProvider: 'gemini' | 'groq'
	/** Provider that will be used (no cross-provider fallback) */
	effectiveProvider: 'gemini' | 'groq'
	/** Kept for UI compatibility; always false because provider auto-switch is disabled */
	isProviderFallback: boolean
	/** Kept for UI compatibility; always null */
	providerFallbackMessage: string | null
}

/**
 * Returns the display label and fallback status for the current AI model.
 *
 * @param actualModel - The model that actually processed the request (from API response),
 *                       or null if not yet known / still loading.
 */
export function useAIModelLabel(actualModel: string | null): AIModelLabelResult {
	const aiProvider = useSettingsStore(s => s.aiProvider)
	const aiModel = useSettingsStore(s => s.aiModel)
	const groqModel = useSettingsStore(s => s.groqModel)
	const effectiveProvider = aiProvider

	const configuredModel = effectiveProvider === 'groq' ? groqModel : aiModel
	const displayModel = actualModel || configuredModel

	const modelLabel = (() => {
		if (effectiveProvider === 'groq') {
			const models = getAvailableGroqModels()
			return models.find(m => m.value === displayModel)?.label || displayModel
		}
		const models = getAvailableModels()
		return models.find(m => m.value === displayModel)?.label || displayModel
	})()

	const isModelFallback = !!actualModel && actualModel !== configuredModel
	const isProviderFallback = false
	const providerFallbackMessage = null

	return {
		displayModel,
		modelLabel,
		isModelFallback,
		configuredModel,
		configuredProvider: aiProvider,
		effectiveProvider,
		isProviderFallback,
		providerFallbackMessage,
	}
}
