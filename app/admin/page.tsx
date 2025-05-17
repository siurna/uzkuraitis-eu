"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { countries } from "@/lib/countries"
import { Loader2, RefreshCw, Trash2, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type VoteData = {
  id: string
  name: string
  votes: Record<string, string>
  lithuaniaPrediction?: string
}

type CountryScore = {
  code: string
  name: string
  flag: string
  totalPoints: number
  pointsBreakdown: Record<string, number>
}

type PointToDelete = {
  voterId: string
  voterName: string
  points: string
  countryCode: string
}

export default function AdminPage() {
  const [scores, setScores] = useState<CountryScore[]>([])
  const [voters, setVoters] = useState<VoteData[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [voterToDelete, setVoterToDelete] = useState<VoteData | null>(null)
  const [deleteVoterDialogOpen, setDeleteVoterDialogOpen] = useState(false)
  const [deletePassword, setDeletePassword] = useState("")
  const [deleteError, setDeleteError] = useState("")
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<"scoreboard" | "votes">("scoreboard")

  // New state for point deletion
  const [pointToDelete, setPointToDelete] = useState<PointToDelete | null>(null)
  const [deletePointDialogOpen, setDeletePointDialogOpen] = useState(false)
  const [deletePointPassword, setDeletePointPassword] = useState("")
  const [deletePointError, setDeletePointError] = useState("")

  const fetchData = useCallback(
    async (isRefreshing = false) => {
      if (isRefreshing) {
        setRefreshing(true)
      } else if (!refreshing) {
        setLoading(true)
      }

      try {
        const response = await fetch("/api/scores")
        if (response.ok) {
          const data = await response.json()
          console.log("Fetched scores:", data.scores.slice(0, 3))
          setScores(data.scores)
          setVoters(data.voters)
          setLastUpdated(new Date())
        } else {
          console.error("Error fetching scores:", response.status)
        }
      } catch (error) {
        console.error("Error fetching scores:", error)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [refreshing],
  )

  // Initial fetch
  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Set up polling for real-time updates
  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchData(true)
    }, 10000) // Poll every 10 seconds

    return () => {
      clearInterval(intervalId)
    }
  }, [fetchData])

  const handleDeleteVoter = async () => {
    if (deletePassword !== "👀👀👀") {
      setDeleteError("Incorrect password")
      return
    }

    if (!voterToDelete) return

    try {
      const response = await fetch(`/api/voter/${voterToDelete.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `Votes from ${voterToDelete.name} have been deleted`,
        })
        fetchData()
        setDeleteVoterDialogOpen(false)
        setVoterToDelete(null)
        setDeletePassword("")
        setDeleteError("")
      } else {
        toast({
          title: "Error",
          description: "Failed to delete voter",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      })
    }
  }

  // New function to handle deleting individual points
  const handleDeletePoint = async () => {
    if (deletePointPassword !== "👀👀👀") {
      setDeletePointError("Incorrect password")
      return
    }

    if (!pointToDelete) return

    try {
      const response = await fetch(`/api/vote/delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voterId: pointToDelete.voterId,
          points: pointToDelete.points,
        }),
      })

      if (response.ok) {
        toast({
          title: "Success",
          description: `${pointToDelete.points} points for ${getCountryName(pointToDelete.countryCode)} have been removed from ${pointToDelete.voterName}'s votes`,
        })
        fetchData()
        setDeletePointDialogOpen(false)
        setPointToDelete(null)
        setDeletePointPassword("")
        setDeletePointError("")
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to delete point",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      })
    }
  }

  const getCountryName = (code: string) => {
    const country = countries.find((c) => c.code === code)
    return country ? country.name : code
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

  // Handle tab change without transition
  const handleTabChange = (tab: "scoreboard" | "votes") => {
    if (tab === activeTab) return
    setActiveTab(tab)
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold italic font-title">Voting</h1>
      </div>

      {loading && !refreshing ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-16 w-16 animate-spin text-pink-600" />
        </div>
      ) : (
        <div>
          {/* Tabs */}
          <div className="flex w-full mb-6">
            <button
              onClick={() => handleTabChange("scoreboard")}
              className={`flex-1 py-3 text-center font-title text-lg border-b-2 transition-colors ${
                activeTab === "scoreboard"
                  ? "border-pink-600 text-white"
                  : "border-pink-600/20 text-gray-400 hover:text-white hover:border-pink-600/50"
              }`}
            >
              Scoreboard
            </button>
            <button
              onClick={() => handleTabChange("votes")}
              className={`flex-1 py-3 text-center font-title text-lg border-b-2 transition-colors flex items-center justify-center ${
                activeTab === "votes"
                  ? "border-pink-600 text-white"
                  : "border-pink-600/20 text-gray-400 hover:text-white hover:border-pink-600/50"
              }`}
            >
              All Votes
              <Badge variant="secondary" className="ml-2 bg-pink-600/20 text-white">
                {voters.length}
              </Badge>
            </button>
          </div>

          {/* Tab content */}
          <div>
            {activeTab === "scoreboard" ? (
              <div>
                <div className="flex items-center justify-between mb-4">
                  {lastUpdated && (
                    <div className="text-sm text-gray-400 flex items-center ml-auto">
                      Updated {formatLastUpdated()}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="ml-1 p-0 h-auto text-pink-400 hover:text-pink-300"
                        onClick={() => fetchData(true)}
                        disabled={refreshing}
                      >
                        <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
                      </Button>
                    </div>
                  )}
                </div>

                {scores.length === 0 ? (
                  <p className="text-center py-8 text-gray-400">No votes yet</p>
                ) : (
                  <div className="space-y-2">
                    {scores.map((country, index) => (
                      <div
                        key={country.code}
                        className="flex items-center justify-between p-3 rounded-md bg-black/60 border border-pink-600/20"
                      >
                        <div className="flex items-center gap-3">
                          <div className="bg-pink-600 text-white w-8 h-8 flex items-center justify-center rounded-full font-bold">
                            {index + 1}
                          </div>
                          <span className="text-xl">{country.flag}</span>
                          <span className="font-title">{country.name}</span>
                        </div>
                        <div className="font-score text-xl text-pink-600">{country.totalPoints} pts</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div>
                {voters.length === 0 ? (
                  <p className="text-center py-8 text-gray-400">No votes yet</p>
                ) : (
                  <div className="space-y-4">
                    {voters.map((voter, index) => (
                      <div key={index} className="p-3 rounded-md bg-black/60 border border-pink-600/20">
                        <div className="flex justify-between items-center mb-2">
                          <div className="flex items-center gap-2">
                            <h3 className="font-title">{voter.name}</h3>
                            {voter.lithuaniaPrediction && (
                              <span className="text-xs bg-yellow-500/20 px-1.5 py-0.5 rounded-full flex items-center">
                                🇱🇹 {voter.lithuaniaPrediction}
                              </span>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-400 hover:bg-red-950/20"
                            onClick={() => {
                              setVoterToDelete(voter)
                              setDeleteVoterDialogOpen(true)
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          {Object.entries(voter.votes)
                            .sort((a, b) => Number.parseInt(b[0]) - Number.parseInt(a[0])) // Sort by points in descending order
                            .map(([points, countryCode], idx) => (
                              <div
                                key={points}
                                className="flex items-center gap-2 group"
                                style={{
                                  gridColumn: idx < 5 ? 1 : 2,
                                  gridRow: (idx % 5) + 1,
                                }}
                              >
                                <span className="bg-pink-600/80 text-white px-2 py-0.5 rounded text-xs font-bold">
                                  {points}
                                </span>
                                <span className="font-title">{getCountryName(countryCode)}</span>
                                <button
                                  className="ml-auto opacity-0 group-hover:opacity-100 text-red-500 hover:text-red-400 transition-opacity"
                                  onClick={() => {
                                    setPointToDelete({
                                      voterId: voter.id,
                                      voterName: voter.name,
                                      points,
                                      countryCode,
                                    })
                                    setDeletePointDialogOpen(true)
                                  }}
                                  aria-label={`Delete ${points} points for ${getCountryName(countryCode)}`}
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete voter dialog */}
      <Dialog open={deleteVoterDialogOpen} onOpenChange={setDeleteVoterDialogOpen}>
        <DialogContent className="bg-black border border-pink-600/30 text-white">
          <DialogHeader>
            <DialogTitle>Delete Voter</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete {voterToDelete?.name}'s votes? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Label htmlFor="deletePassword">Enter password to confirm</Label>
            <Input
              id="deletePassword"
              type="text"
              value={deletePassword}
              onChange={(e) => setDeletePassword(e.target.value)}
              className="bg-black/60 border-pink-600/50"
              placeholder="Enter admin password"
            />
            {deleteError && <p className="text-red-500 text-sm">{deleteError}</p>}
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDeleteVoter} className="w-full">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete point dialog */}
      <Dialog open={deletePointDialogOpen} onOpenChange={setDeletePointDialogOpen}>
        <DialogContent className="bg-black border border-pink-600/30 text-white">
          <DialogHeader>
            <DialogTitle>Delete Individual Point</DialogTitle>
            <DialogDescription className="text-gray-400">
              Are you sure you want to delete {pointToDelete?.points} points for{" "}
              {pointToDelete ? getCountryName(pointToDelete.countryCode) : ""} from {pointToDelete?.voterName}'s votes?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Label htmlFor="deletePointPassword">Enter password to confirm</Label>
            <Input
              id="deletePointPassword"
              type="text"
              value={deletePointPassword}
              onChange={(e) => setDeletePointPassword(e.target.value)}
              className="bg-black/60 border-pink-600/50"
              placeholder="Enter admin password"
            />
            {deletePointError && <p className="text-red-500 text-sm">{deletePointError}</p>}
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={handleDeletePoint} className="w-full">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster />
    </div>
  )
}
