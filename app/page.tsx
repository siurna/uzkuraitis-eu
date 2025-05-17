"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Loader2, ChevronDown, ChevronUp, RefreshCw, Share2 } from "lucide-react"
import { countries } from "@/lib/countries"

type CountryScore = {
  code: string
  name: string
  flag: string
  totalPoints: number
}

type VoterData = {
  id: string
  name: string
  votes: Record<string, string>
  lithuaniaPrediction?: string
}

export default function Home() {
  const [scores, setScores] = useState<CountryScore[]>([])
  const [voters, setVoters] = useState<VoterData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [hasVoted, setHasVoted] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)
  const [votingEnabled, setVotingEnabled] = useState(true)
  const [showAdminButton, setShowAdminButton] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  // Function to fetch scores
  const fetchScores = useCallback(async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    setError(null)

    try {
      console.log("Fetching scores from /api/scores")
      const response = await fetch("/api/scores")

      if (response.ok) {
        const data = await response.json()
        console.log("Received scores data:", data.scores.slice(0, 3))
        setScores(data.scores)

        // Keep the full voter data including votes
        setVoters(data.voters)

        // Update last updated timestamp
        setLastUpdated(new Date())

        // Check if voting is enabled
        if (data.votingEnabled !== undefined) {
          setVotingEnabled(data.votingEnabled)
        }
      } else {
        console.error("Error response from /api/scores:", response.status)
        const errorText = await response.text()
        console.error("Error details:", errorText)
        setError("Failed to load scores. Please try again later.")
      }
    } catch (error) {
      console.error("Error fetching scores:", error)
      setError("Failed to load scores. Please try again later.")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  // Fetch admin settings
  useEffect(() => {
    const fetchAdminSettings = async () => {
      try {
        const response = await fetch("/api/admin-settings")
        if (response.ok) {
          const data = await response.json()
          setShowAdminButton(data.showAdminButton)
        }
      } catch (error) {
        console.error("Error fetching admin settings:", error)
      }
    }

    fetchAdminSettings()
  }, [])

  // Check if user has voted
  useEffect(() => {
    const savedVotes = localStorage.getItem("eurovision_votes")
    if (savedVotes) {
      try {
        const parsedVotes = JSON.parse(savedVotes)
        // Check if at least one vote has been cast
        const hasAnyVotes = Object.values(parsedVotes).some((vote) => vote !== "")
        setHasVoted(hasAnyVotes)
      } catch (error) {
        console.error("Error parsing saved votes:", error)
      }
    }
  }, [])

  // Initial fetch
  useEffect(() => {
    fetchScores()
  }, [fetchScores])

  // Set up polling for real-time updates
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchScores(true)
    }, 10000) // Poll every 10 seconds

    return () => {
      clearInterval(intervalId)
    }
  }, [fetchScores])

  // Get country details including song
  const getCountryDetails = (code) => {
    return countries.find((c) => c.code === code) || { name: code, song: "", artist: "", flag: "🏳️", order: 999 }
  }

  // Function to get font size based on position
  const getFontSize = (index) => {
    if (index === 0) return "text-2xl"
    if (index === 1) return "text-xl"
    if (index === 2) return "text-lg"
    return "text-base"
  }

  // Function to get badge size based on position
  const getBadgeSize = (index) => {
    if (index === 0) return "w-12 h-12 text-xl" // Gold - larger
    if (index === 1) return "w-10 h-10 text-lg" // Silver - medium
    if (index === 2) return "w-9 h-9" // Bronze - slightly larger than default
    return "w-8 h-8" // Default size
  }

  // Function to get badge color based on position
  const getBadgeColor = (index) => {
    if (index === 0) return "bg-yellow-500" // Gold
    if (index === 1) return "bg-gray-300 text-gray-900" // Silver
    if (index === 2) return "bg-amber-700" // Bronze
    return "bg-pink-600" // Default pink
  }

  // Format the last updated time
  const formatLastUpdated = () => {
    if (!lastUpdated) return ""

    const now = new Date()
    const diffSeconds = Math.floor((now.getTime() - lastUpdated.getTime()) / 1000)

    if (diffSeconds < 5) return "just now"
    if (diffSeconds < 60) return `${diffSeconds} seconds ago`
    if (diffSeconds < 120) return "1 minute ago"
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)} minutes ago`

    return lastUpdated.toLocaleTimeString()
  }

  // Manual refresh
  const handleManualRefresh = () => {
    fetchScores(true)
  }

  // Toggle show all with animation
  const toggleShowAll = () => {
    if (isAnimating) return

    setIsAnimating(true)

    if (contentRef.current) {
      if (!showAll) {
        // Expanding - add class for animation
        contentRef.current.classList.add("expanding")
        contentRef.current.classList.add("country-list-expanding")
        setTimeout(() => {
          setShowAll(true)
          contentRef.current?.classList.remove("expanding")
          setTimeout(() => {
            contentRef.current?.classList.remove("country-list-expanding")
            setIsAnimating(false)
          }, 500)
        }, 100)
      } else {
        // Collapsing - add class for animation
        contentRef.current.classList.add("collapsing")
        setTimeout(() => {
          setShowAll(false)
          contentRef.current?.classList.remove("collapsing")
          setIsAnimating(false)
        }, 300)
      }
    } else {
      setShowAll(!showAll)
      setIsAnimating(false)
    }
  }

  // Handle share button click
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Eurovision 2025 Voting",
          text: "Check out the current Eurovision 2025 standings and cast your vote!",
          url: window.location.href,
        })
      } catch (error) {
        console.error("Error sharing:", error)
      }
    } else {
      // Fallback for browsers that don't support the Web Share API
      navigator.clipboard.writeText(window.location.href)
      alert("Link copied to clipboard!")
    }
  }

  // Function to get all countries with scores (including 0 points)
  const getAllCountriesWithScores = () => {
    // Create a map of country codes to scores
    const scoreMap = {}
    scores.forEach((country) => {
      scoreMap[country.code] = country
    })

    // Create a list of all countries with scores (or 0 if not in scores)
    return countries
      .map((country) => {
        if (scoreMap[country.code]) {
          return scoreMap[country.code]
        } else {
          return {
            code: country.code,
            name: country.name,
            flag: country.flag,
            totalPoints: 0,
          }
        }
      })
      .sort((a, b) => {
        // Sort by score first (descending)
        if (b.totalPoints !== a.totalPoints) {
          return b.totalPoints - a.totalPoints
        }

        // Then by performance number (ascending)
        const countryA = getCountryDetails(a.code)
        const countryB = getCountryDetails(b.code)
        return countryA.order - countryB.order
      })
  }

  // Get random gradient for voter badge
  const getRandomGradient = (index) => {
    const gradients = [
      "from-pink-500 to-purple-500",
      "from-blue-500 to-cyan-500",
      "from-green-500 to-teal-500",
      "from-yellow-500 to-orange-500",
      "from-red-500 to-pink-500",
      "from-indigo-500 to-purple-500",
      "from-cyan-500 to-blue-500",
      "from-teal-500 to-green-500",
      "from-orange-500 to-red-500",
      "from-purple-500 to-indigo-500",
    ]

    // Use modulo to cycle through gradients if there are more voters than gradients
    return gradients[index % gradients.length]
  }

  // Get the country that received 12 points from a voter
  const getTopCountry = (voterVotes) => {
    if (!voterVotes || !voterVotes["12"]) return null
    return countries.find((c) => c.code === voterVotes["12"])
  }

  return (
    <div className="min-h-screen bg-black text-white flex flex-col pb-24">
      {/* Invisible admin button in top right corner */}
      {showAdminButton && (
        <div className="fixed top-0 right-0 z-50">
          <Link href="/admin">
            <div className="w-16 h-16 opacity-0" aria-hidden="true"></div>
          </Link>
        </div>
      )}
      <div className="w-full flex justify-center">
        <Image
          src="/images/eurovision-2025-logo.png"
          alt="Eurovision 2025"
          width={1200}
          height={600}
          className="w-full max-w-[960px] max-h-[275px] object-cover object-center"
          priority
        />
      </div>

      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="max-w-3xl mx-auto w-full">
          <div className="w-full">
            <div className="mb-6">
              <h2 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-cyan-400 to-red-500 text-center font-title mb-2">
                Current Standings
              </h2>
              {lastUpdated && (
                <div className="flex flex-col items-center">
                  <p className="text-sm text-gray-400 text-center mt-1 flex items-center justify-center">
                    Updated {formatLastUpdated()}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-1 p-0 h-auto text-pink-400 hover:text-pink-300"
                      onClick={handleManualRefresh}
                      disabled={refreshing}
                    >
                      <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                    </Button>
                  </p>
                </div>
              )}
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <Loader2 className="h-16 w-16 animate-spin text-pink-600" />
              </div>
            ) : error ? (
              <div className="text-center py-8 text-red-400">{error}</div>
            ) : scores.length > 0 ? (
              <div className="space-y-2 country-list-container" ref={contentRef}>
                {(showAll ? getAllCountriesWithScores() : scores.slice(0, 5)).map((country, index) => {
                  const countryDetails = getCountryDetails(country.code)
                  const fontSize = getFontSize(index)
                  const badgeColor = getBadgeColor(index)
                  const badgeSize = getBadgeSize(index)

                  return (
                    <div
                      key={country.code}
                      className="flex items-center justify-between p-3 rounded-md bg-black/60 border border-pink-600/20 score-item country-item"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div
                          className={`${badgeColor} text-white flex items-center justify-center rounded-full font-bold flex-shrink-0 ${badgeSize}`}
                        >
                          {index + 1}
                        </div>
                        <span className="text-3xl flex-shrink-0">{country.flag}</span>
                        <div className="flex-1 min-w-0">
                          <div className={`font-title ${fontSize} truncate`}>{country.name}</div>
                          <div className="text-gray-400 text-sm truncate">
                            {countryDetails.artist} - {countryDetails.song}
                          </div>
                        </div>
                      </div>
                      <div className="font-score text-xl text-pink-600 ml-2 flex-shrink-0">
                        {country.totalPoints} pts
                      </div>
                    </div>
                  )
                })}

                {scores.length > 0 && (
                  <Button
                    variant="ghost"
                    className="w-full text-pink-400 hover:text-pink-300 hover:bg-pink-950/20 mt-2 font-title"
                    onClick={toggleShowAll}
                    disabled={isAnimating}
                  >
                    {showAll ? (
                      <>
                        <ChevronUp className="h-4 w-4 mr-2" /> Show Top 5
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-4 w-4 mr-2" /> Show All Countries
                      </>
                    )}
                  </Button>
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-400 font-title">No votes yet. Be the first to vote!</div>
            )}

            {/* Voter badges - centered and with flags */}
            {voters.length > 0 && (
              <div className="mt-8 text-center">
                <h3 className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-cyan-400 to-red-500 text-center font-title mb-4">
                  Votes Cast
                </h3>
                <div className="flex flex-wrap gap-3 justify-center">
                  {voters.map((voter, index) => {
                    const topCountry = getTopCountry(voter.votes)
                    const gradient = getRandomGradient(index)

                    return (
                      <div
                        key={index}
                        className={`inline-flex items-center rounded-full px-3 py-1.5 text-base font-medium text-white bg-gradient-to-r ${gradient}`}
                      >
                        {topCountry && <span className="mr-2 text-xl">{topCountry.flag}</span>}
                        {voter.name}
                        {voter.lithuaniaPrediction && (
                          <span className="ml-1 text-xs bg-yellow-500/20 px-1.5 py-0.5 rounded-full flex items-center">
                            🇱🇹 {voter.lithuaniaPrediction}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Sticky footer with glowing button and share button */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm border-t border-pink-600/30 py-4 z-10">
        <div className="container mx-auto px-4 flex gap-3 items-center">
          <Link href="/vote" className="block flex-1">
            <Button
              className={`w-full h-14 flex items-center justify-center text-xl font-title ${
                votingEnabled
                  ? "bg-gradient-to-r from-pink-600 via-cyan-500 to-red-500 hover:from-pink-700 hover:via-cyan-600 hover:to-red-600 text-white " +
                    (hasVoted ? "update-pulse-button font-bold" : "cast-pulse-button font-bold italic")
                  : "bg-gray-800 text-gray-400 cursor-not-allowed"
              }`}
              disabled={!votingEnabled}
            >
              {!votingEnabled ? "VOTING CLOSED" : hasVoted ? "UPDATE YOUR VOTE!" : "CAST YOUR VOTE!"}
            </Button>
          </Link>

          <Button
            variant="outline"
            onClick={handleShare}
            className="h-14 w-14 flex items-center justify-center border-pink-600/50 text-pink-400 hover:text-pink-300 hover:bg-pink-950/20"
            aria-label="Share standings"
          >
            <Share2 className="h-7 w-7 stroke-2" />
          </Button>
        </div>
      </div>

      <footer className="py-6 text-center text-sm text-gray-400">
        {/* Admin link removed - now accessible via invisible button in top right */}
      </footer>
    </div>
  )
}
