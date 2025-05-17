"use client"

import { useState, useEffect, useCallback } from "react"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { Loader2, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

type UserScore = {
  id: string
  name: string
  top10Score: number
  lithuaniaScore: number
  totalScore: number
}

export default function ResultsPage() {
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [userScores, setUserScores] = useState<UserScore[]>([])
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)

  const fetchScores = useCallback(async (isRefreshing = false) => {
    if (isRefreshing) {
      setRefreshing(true)
    } else {
      setLoading(true)
    }

    try {
      const response = await fetch("/api/results")
      if (response.ok) {
        const data = await response.json()
        if (data.scores) {
          setUserScores(data.scores)
          setLastUpdated(new Date())
        }
      } else {
        console.error("Error response from /api/results:", response.status)
        const errorText = await response.text()
        console.error("Error details:", errorText)
        toast({
          title: "Error",
          description: "Failed to load scores. Please try again later.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error fetching scores:", error)
      toast({
        title: "Error",
        description: "Failed to load scores. Please try again later.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
      setRefreshing(false)
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

  if (loading && !refreshing) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin text-pink-600" />
      </div>
    )
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold italic font-title">Prediction Leaderboard</h1>

        {lastUpdated && (
          <div className="text-sm text-gray-400 flex items-center">
            Updated {formatLastUpdated()}
            <Button
              variant="ghost"
              size="sm"
              className="ml-1 p-0 h-auto text-pink-400 hover:text-pink-300"
              onClick={() => fetchScores(true)}
              disabled={refreshing}
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        )}
      </div>

      {userScores.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No scores calculated yet. Enter and submit the final results in Settings first.
        </div>
      ) : (
        <div className="space-y-2">
          {userScores.map((user, index) => (
            <div
              key={user.id}
              className={`flex items-center justify-between p-3 rounded-md bg-black/60 border border-pink-600/20 ${
                index < 3 ? "bg-pink-950/20" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 flex items-center justify-center rounded-full font-bold">
                  {index === 0 ? (
                    <span className="text-yellow-500 text-xl">🥇</span>
                  ) : index === 1 ? (
                    <span className="text-gray-300 text-xl">🥈</span>
                  ) : index === 2 ? (
                    <span className="text-amber-700 text-xl">🥉</span>
                  ) : (
                    <div className="bg-pink-600 text-white w-8 h-8 flex items-center justify-center rounded-full font-bold">
                      {index + 1}
                    </div>
                  )}
                </div>
                <span className="font-title text-lg">{user.name}</span>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="text-xs text-gray-400">Top 10</div>
                  <div className="font-score text-pink-400">{user.top10Score}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-400">Lithuania</div>
                  <div className="font-score text-yellow-400">{user.lithuaniaScore}</div>
                </div>
                <div className="text-right min-w-[60px]">
                  <div className="text-xs text-gray-400">Total</div>
                  <div className="font-score text-xl text-pink-600">{user.totalScore}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Toaster />
    </div>
  )
}
