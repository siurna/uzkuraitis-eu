"use client"

import { DialogTrigger } from "@/components/ui/dialog"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, Save } from "lucide-react"
import { countries } from "@/lib/countries"

type ResultsState = {
  top10: string[] // Array of country codes in order (1st to 10th)
  lithuaniaPlace: string // Lithuania's final place (1-26)
}

export default function SettingsPage() {
  const [votingEnabled, setVotingEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const [updatingVotingStatus, setUpdatingVotingStatus] = useState(false)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [resetPassword, setResetPassword] = useState("")
  const [resetError, setResetError] = useState("")
  const [resetTop10DialogOpen, setResetTop10DialogOpen] = useState(false)
  const [resettingTop10, setResettingTop10] = useState(false)
  const [resetVotesDialogOpen, setResetVotesDialogOpen] = useState(false)
  const [resetVotesPassword, setResetVotesPassword] = useState("")
  const [resetVotesError, setResetVotesError] = useState("")
  const [resettingVotes, setResettingVotes] = useState(false)

  // Final results state
  const [results, setResults] = useState<ResultsState>({
    top10: Array(10).fill(""),
    lithuaniaPlace: "",
  })
  const [submittingResults, setSubmittingResults] = useState(false)
  const [calculatingScores, setCalculatingScores] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch voting status
        const votingResponse = await fetch("/api/voting-status")
        if (votingResponse.ok) {
          const votingData = await votingResponse.json()
          setVotingEnabled(votingData.enabled)
        }

        // Fetch existing results if available
        const resultsResponse = await fetch("/api/results")
        if (resultsResponse.ok) {
          const resultsData = await resultsResponse.json()
          if (resultsData.results) {
            setResults(resultsData.results)
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  const handleToggleVoting = async () => {
    setUpdatingVotingStatus(true)

    try {
      const response = await fetch("/api/voting-status", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          enabled: !votingEnabled,
          password: "👀👀👀",
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setVotingEnabled(data.enabled)
        toast({
          title: "Success",
          description: `Voting has been ${data.enabled ? "enabled" : "disabled"}`,
        })
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to update voting status",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setUpdatingVotingStatus(false)
    }
  }

  const handleReset = async () => {
    if (resetPassword !== "👀👀👀") {
      setResetError("Incorrect password")
      return
    }

    try {
      const response = await fetch("/api/reset", {
        method: "POST",
      })

      // Even if there are non-critical errors, the API should still return 200 OK
      // We'll check the response body for more details
      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "All votes have been reset",
        })
        setResetDialogOpen(false)
        setResetPassword("")
        setResetError("")

        // Reset the local state as well
        setResults({
          top10: Array(10).fill(""),
          lithuaniaPlace: "",
        })
      } else {
        console.error("Reset error:", data.error)
        toast({
          title: "Error",
          description: data.error || "Failed to reset votes",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Reset error:", error)
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      })
    }
  }

  const handleResetVotes = async () => {
    if (resetVotesPassword !== "👀👀👀") {
      setResetVotesError("Incorrect password")
      return
    }

    setResettingVotes(true)

    try {
      const response = await fetch("/api/reset-votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          password: resetVotesPassword,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        toast({
          title: "Success",
          description: "All votes have been reset while keeping the Top 10 intact",
        })
        setResetVotesDialogOpen(false)
        setResetVotesPassword("")
        setResetVotesError("")
      } else {
        console.error("Reset votes error:", data.error)
        toast({
          title: "Error",
          description: data.error || "Failed to reset votes",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Reset votes error:", error)
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setResettingVotes(false)
    }
  }

  // Reset Top 10 handler
  const handleResetTop10 = async () => {
    setResettingTop10(true)

    try {
      // Create empty results
      const emptyResults = {
        top10: Array(10).fill(""),
        lithuaniaPlace: "0", // Use "0" instead of empty string
      }

      // Save empty results to the database
      const response = await fetch("/api/results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          results: emptyResults,
          password: "👀👀👀",
        }),
      })

      if (response.ok) {
        // Update local state
        setResults(emptyResults)

        // Close dialog
        setResetTop10DialogOpen(false)

        toast({
          title: "Success",
          description: "Top 10 Countries have been reset",
        })

        // Recalculate scores with the empty results
        const scoreResponse = await fetch("/api/calculate-scores", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            password: "👀👀👀",
          }),
        })

        if (scoreResponse.ok) {
          toast({
            title: "Scores Updated",
            description: "Scoreboard has been reset",
          })
        }
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to reset Top 10",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error resetting Top 10:", error)
      toast({
        title: "Error",
        description: "Something went wrong",
        variant: "destructive",
      })
    } finally {
      setResettingTop10(false)
    }
  }

  // Final results handlers
  const handleCountrySelect = (index, countryCode) => {
    // Create a copy of the top10 array
    const newTop10 = [...results.top10]

    // If this country is already in the list, remove it from its current position
    const existingIndex = newTop10.indexOf(countryCode)
    if (existingIndex !== -1 && existingIndex !== index) {
      newTop10[existingIndex] = ""
    }

    // Set the country at the specified index
    newTop10[index] = countryCode

    // Update the state
    setResults({
      ...results,
      top10: newTop10,
    })
  }

  const handleLithuaniaPlaceChange = (e) => {
    const value = e.target.value
    // Only allow numbers between 1 and 26
    if (value === "" || (Number.parseInt(value) >= 1 && Number.parseInt(value) <= 26)) {
      setResults({
        ...results,
        lithuaniaPlace: value,
      })
    }
  }

  const handleSubmitResults = async () => {
    // Validate the results
    if (results.top10.some((code) => code === "") || !results.lithuaniaPlace) {
      toast({
        title: "Incomplete Results",
        description: "Please fill in all positions in the Top 10 and Lithuania's final place.",
        variant: "destructive",
      })
      return
    }

    setSubmittingResults(true)

    try {
      console.log("Submitting results:", results)
      const response = await fetch("/api/results", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          results,
          password: "👀👀👀", // Use the admin password for authentication
        }),
      })

      const responseData = await response.json()

      if (response.ok) {
        toast({
          title: "Results Saved",
          description: "The results have been saved successfully.",
        })

        // Calculate scores automatically
        setCalculatingScores(true)
        try {
          const scoreResponse = await fetch("/api/calculate-scores", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              password: "👀👀👀", // Use the admin password for authentication
            }),
          })

          const scoreData = await scoreResponse.json()

          if (scoreResponse.ok) {
            toast({
              title: "Scores Calculated",
              description: "User scores have been calculated successfully.",
            })
          } else {
            console.error("Score calculation error:", scoreData)
            toast({
              title: "Error",
              description: scoreData.error || "Failed to calculate scores.",
              variant: "destructive",
            })
          }
        } catch (scoreError) {
          console.error("Error during score calculation:", scoreError)
          toast({
            title: "Error",
            description: "Failed to calculate scores. See console for details.",
            variant: "destructive",
          })
        }
      } else {
        console.error("Error saving results:", responseData)
        toast({
          title: "Error",
          description: responseData.error || "Failed to save results.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error saving results:", error)
      toast({
        title: "Error",
        description: "An unexpected error occurred. See console for details.",
        variant: "destructive",
      })
    } finally {
      setSubmittingResults(false)
      setCalculatingScores(false)
    }
  }

  // Get country details by code
  const getCountry = (code) => {
    return countries.find((c) => c.code === code)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-16 w-16 animate-spin text-pink-600" />
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-3xl font-bold italic font-title mb-8">Settings</h1>

      <div className="space-y-8">
        {/* Voting Status Control */}
        <div className="p-6 rounded-lg bg-black/60 border border-pink-600/20">
          <h2 className="text-xl font-bold font-title mb-4">Voting Status</h2>

          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="voting-toggle" className="text-lg">
                {votingEnabled ? "Voting is enabled" : "Voting is disabled"}
              </Label>
              <p className="text-gray-400 text-sm mt-1">
                {votingEnabled ? "Users can submit and update their votes" : "Users cannot submit new votes"}
              </p>
            </div>

            <div className="flex items-center">
              <Switch
                id="voting-toggle"
                checked={votingEnabled}
                onCheckedChange={handleToggleVoting}
                disabled={updatingVotingStatus}
              />
              {updatingVotingStatus && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
            </div>
          </div>
        </div>

        {/* Final Results */}
        <div className="p-6 rounded-lg bg-black/60 border border-pink-600/20">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold font-title">Final Results</h2>

            <Dialog open={resetTop10DialogOpen} onOpenChange={setResetTop10DialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-pink-400 border-pink-600/30 hover:bg-pink-950/20">
                  Reset Top 10
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-black border border-pink-600/30 text-white">
                <DialogHeader>
                  <DialogTitle className="font-title">Reset Top 10 Countries</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    This will clear the Top 10 Countries and reset the scoreboard. Are you sure?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setResetTop10DialogOpen(false)}
                    className="border-pink-600/30"
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleResetTop10} disabled={resettingTop10}>
                    {resettingTop10 ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset Top 10"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-gray-400 mb-4">Select the countries in their final order (1st to 10th place).</p>

              <div className="space-y-2">
                {results.top10.map((countryCode, index) => {
                  const position = index + 1
                  const country = countryCode ? getCountry(countryCode) : null

                  return (
                    <div className="flex items-center gap-3 mb-2" key={index}>
                      <div className="w-10 h-10 flex items-center justify-center bg-pink-600 text-white rounded-full font-bold flex-shrink-0">
                        {position}
                      </div>

                      <select
                        value={countryCode}
                        onChange={(e) => handleCountrySelect(index, e.target.value)}
                        className="flex-1 bg-black/60 border border-pink-600/30 rounded-md p-2 text-white"
                      >
                        <option value="">Select a country</option>
                        {countries.map((country) => (
                          <option key={country.code} value={country.code}>
                            {country.flag} {country.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="pt-6 border-t border-pink-600/20">
              <h3 className="text-lg font-semibold mb-4 font-title">Lithuania's Final Place</h3>
              <div className="flex items-center gap-4">
                <div className="w-12 text-2xl">🇱🇹</div>
                <Input
                  type="number"
                  min="1"
                  max="26"
                  value={results.lithuaniaPlace}
                  onChange={handleLithuaniaPlaceChange}
                  className="w-24 bg-black/60 border-pink-600/30 text-center text-xl"
                  placeholder="#"
                />
                <span className="text-gray-400">Enter a number between 1 and 26</span>
              </div>
            </div>

            <div className="pt-6">
              <Button
                onClick={handleSubmitResults}
                disabled={submittingResults || calculatingScores}
                className="w-full bg-gradient-to-r from-pink-600 to-cyan-500 text-white py-2 px-4"
              >
                {submittingResults ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : calculatingScores ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Calculating Scores...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Results & Calculate Scores
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Reset Votes */}
        <div className="p-6 rounded-lg bg-black/60 border border-pink-600/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-title mb-2">Reset Data</h2>
              <p className="text-gray-400 text-sm">
                This will delete all votes and reset the scoreboard. This action cannot be undone.
              </p>
            </div>

            <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">Reset All Votes</Button>
              </DialogTrigger>
              <DialogContent className="bg-black border border-pink-600/30 text-white">
                <DialogHeader>
                  <DialogTitle className="font-title">Are you sure?</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    This will delete all votes and reset the scoreboard. This action cannot be undone.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <Label htmlFor="resetPassword">Enter password to confirm</Label>
                  <Input
                    id="resetPassword"
                    type="text"
                    value={resetPassword}
                    onChange={(e) => setResetPassword(e.target.value)}
                    className="bg-black/60 border-pink-600/50"
                    placeholder="Enter admin password"
                  />
                  {resetError && <p className="text-red-500 text-sm">{resetError}</p>}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResetDialogOpen(false)
                      setResetPassword("")
                      setResetError("")
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleReset}>
                    Reset All Votes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Reset Votes Only */}
        <div className="p-6 rounded-lg bg-black/60 border border-pink-600/20">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold font-title mb-2">Reset Votes Only</h2>
              <p className="text-gray-400 text-sm">
                This will delete all votes while keeping the Top 10 and final results intact. This action cannot be
                undone.
              </p>
            </div>

            <Dialog open={resetVotesDialogOpen} onOpenChange={setResetVotesDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-pink-600/30 text-pink-400 hover:bg-pink-950/20">
                  Reset Votes Only
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-black border border-pink-600/30 text-white">
                <DialogHeader>
                  <DialogTitle className="font-title">Reset Votes Only</DialogTitle>
                  <DialogDescription className="text-gray-400">
                    This will delete all votes while keeping the Top 10 and final results intact. This action cannot be
                    undone.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                  <Label htmlFor="resetVotesPassword">Enter password to confirm</Label>
                  <Input
                    id="resetVotesPassword"
                    type="text"
                    value={resetVotesPassword}
                    onChange={(e) => setResetVotesPassword(e.target.value)}
                    className="bg-black/60 border-pink-600/50"
                    placeholder="Enter admin password"
                  />
                  {resetVotesError && <p className="text-red-500 text-sm">{resetVotesError}</p>}
                </div>

                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setResetVotesDialogOpen(false)
                      setResetVotesPassword("")
                      setResetVotesError("")
                    }}
                  >
                    Cancel
                  </Button>
                  <Button variant="destructive" onClick={handleResetVotes} disabled={resettingVotes}>
                    {resettingVotes ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Resetting...
                      </>
                    ) : (
                      "Reset Votes Only"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      <Toaster />
    </div>
  )
}
