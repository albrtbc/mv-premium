
import { useState, useCallback, useEffect } from 'react'
import { useDebounce } from 'use-debounce'
import {
	useMovieSearch,
	useMovieTemplateData,
	useTVShowSearch,
	useTVShowTemplateData,
	useSeasonTemplateData,
} from '@/features/cine/hooks/use-tmdb'
import { type TVShowTemplateData } from '@/services/api/tmdb'
import { generatePlaceholderData } from '../utils/placeholders'
import type { TemplateType, TemplateDataInput } from '@/types/templates'

interface UseTmdbSelectionProps {
	mediaType: TemplateType
	onPreviewDataChange: (data: TemplateDataInput | null) => void
}

export function useTmdbSelection({ mediaType, onPreviewDataChange }: UseTmdbSelectionProps) {
	// State
	const [tmdbSearchQuery, setTmdbSearchQuery] = useState('')
	const [showSearchResults, setShowSearchResults] = useState(false)
	
	// Selection state
	const [selectedMovieId, setSelectedMovieId] = useState<number | null>(null)
	const [selectedMovieTitle, setSelectedMovieTitle] = useState<string | null>(null)
	
	const [selectedTVId, setSelectedTVId] = useState<number | null>(null)
	const [selectedTVTitle, setSelectedTVTitle] = useState<string | null>(null)
	
	// Season specific
	const [tvDataForSeason, setTvDataForSeason] = useState<TVShowTemplateData | null>(null)
	const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number | null>(null)

	// Debounce
	const [debouncedTmdbQuery] = useDebounce(tmdbSearchQuery, 400)

	// ---------------------------------------------------------------------------
	// Search Hooks
	// ---------------------------------------------------------------------------
	const { data: movieSearchData, isLoading: isSearchingMovies } = useMovieSearch(
		debouncedTmdbQuery,
		mediaType === 'movie' && debouncedTmdbQuery.length >= 2
	)
	const movieResults = movieSearchData?.results?.slice(0, 8) ?? []

	const { data: tvSearchData, isLoading: isSearchingTV } = useTVShowSearch(
		debouncedTmdbQuery,
		(mediaType === 'tvshow' || mediaType === 'season') && debouncedTmdbQuery.length >= 2
	)
	const tvResults = tvSearchData?.results?.slice(0, 8) ?? []

	// ---------------------------------------------------------------------------
	// Data Fetching Hooks
	// ---------------------------------------------------------------------------
	const { data: selectedMovieData, isLoading: isLoadingMovieData } = useMovieTemplateData(
		selectedMovieId ?? 0,
		mediaType === 'movie' && selectedMovieId !== null
	)

	const { data: selectedTVData, isLoading: isLoadingTVData } = useTVShowTemplateData(
		selectedTVId ?? 0,
		(mediaType === 'tvshow' || mediaType === 'season') && selectedTVId !== null
	)

	const { data: selectedSeasonData, isLoading: isLoadingSeasonData } = useSeasonTemplateData(
		selectedTVId ?? 0,
		selectedSeasonNumber ?? 0,
		tvDataForSeason,
		mediaType === 'season' && selectedTVId !== null && selectedSeasonNumber !== null && tvDataForSeason !== null
	)

	// ---------------------------------------------------------------------------
	// Effects for Data Synchronization
	// ---------------------------------------------------------------------------

	// Movie: set preview when data loads
	useEffect(() => {
		if (mediaType === 'movie' && selectedMovieId !== null && selectedMovieData) {
			onPreviewDataChange(selectedMovieData)
		}
	}, [mediaType, selectedMovieData, selectedMovieId, onPreviewDataChange])

	// TV show: set preview (or store for season picking)
	useEffect(() => {
		if (selectedTVId === null) return

		if (mediaType === 'tvshow' && selectedTVData) {
			onPreviewDataChange(selectedTVData)
		}
		
		if (mediaType === 'season' && selectedTVData) {
			setTvDataForSeason(selectedTVData)
			// Don't set previewData yet – user needs to pick a season, but we need
			// to ensure we aren't showing stale season data if we switched shows
		}
	}, [mediaType, selectedTVData, selectedTVId, onPreviewDataChange])

	// Season: set preview when season data loads
	useEffect(() => {
		if (mediaType === 'season' && selectedSeasonData) {
			onPreviewDataChange(selectedSeasonData)
		}
	}, [mediaType, selectedSeasonData, onPreviewDataChange])

	// ---------------------------------------------------------------------------
	// Actions
	// ---------------------------------------------------------------------------

	const handleSelectMovie = useCallback((id: number, title: string) => {
		setSelectedMovieId(id)
		setSelectedMovieTitle(title)
		setTmdbSearchQuery('')
		setShowSearchResults(false)
	}, [])

	const handleClearMovie = useCallback(() => {
		setSelectedMovieId(null)
		setSelectedMovieTitle(null)
		onPreviewDataChange(generatePlaceholderData(mediaType))
	}, [mediaType, onPreviewDataChange])

	const handleSelectTV = useCallback((id: number, title: string) => {
		setSelectedTVId(id)
		setSelectedTVTitle(title)
		setTmdbSearchQuery('')
		setShowSearchResults(false)
		
		// Reset season state when picking new show
		setTvDataForSeason(null)
		setSelectedSeasonNumber(null)
	}, [])

	const handleClearTV = useCallback(() => {
		setSelectedTVId(null)
		setSelectedTVTitle(null)
		setTvDataForSeason(null)
		setSelectedSeasonNumber(null)
		onPreviewDataChange(generatePlaceholderData(mediaType))
	}, [mediaType, onPreviewDataChange])

	const resetState = useCallback(() => {
		setTmdbSearchQuery('')
		setShowSearchResults(false)
		setSelectedMovieId(null)
		setSelectedMovieTitle(null)
		setSelectedTVId(null)
		setSelectedTVTitle(null)
		setTvDataForSeason(null)
		setSelectedSeasonNumber(null)
	}, [])

	return {
		// State
		tmdbSearchQuery,
		setTmdbSearchQuery,
		showSearchResults,
		setShowSearchResults,
		selectedMovieTitle,
		selectedTVTitle,
		selectedSeasonNumber,
		tvDataForSeason,

		// Computed
		debouncedTmdbQuery,
		movieResults,
		tvResults,
		isSearchingMovies,
		isSearchingTV,
		isLoadingMovieData,
		isLoadingTVData,
		isLoadingSeasonData,

		// Actions
		handleSelectMovie,
		handleClearMovie,
		handleSelectTV,
		handleClearTV,
		setSelectedSeasonNumber,
		resetState
	}
}
