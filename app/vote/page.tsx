"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"
import { Toaster } from "@/components/ui/toaster"
import { countries } from "@/lib/countries"
import { Music, Home, Info, Trash2, GripVertical, AlertTriangle, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function VotePage() {
  // All the existing state and refs...
  const router = useRouter()
  const searchParams = useSearchParams()
  const [name, setName] = useState("")
  const [votes, setVotes] = useState({
    "12": "",
    "10": "",
    "8": "",
    "7": "",
    "6": "",
    "5": "",
    "4": "",
    "3": "",
    "2": "",
    "1": "",
  })
  const [lithuaniaPrediction, setLithuaniaPrediction] = useState("")
  const [glowingScore, setGlowingScore] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeTouchCountry, setActiveTouchCountry] = useState(null)
  const [activeTouchPoint, setActiveTouchPoint] = useState(null)
  const [draggedPoints, setDraggedPoints] = useState(null)
  const [dragOverPoints, setDragOverPoints] = useState(null)
  const [isDraggingToDelete, setIsDraggingToDelete] = useState(false)
  const [showDeleteArea, setShowDeleteArea] = useState(false)
  const [heartbeatActive, setHeartbeatActive] = useState(false)
  const [enhancedCountry, setEnhancedCountry] = useState(null)
  const [votingEnabled, setVotingEnabled] = useState(true)
  const [loading, setLoading] = useState(true)
  const pointRefs = useRef({})
  const countryRefs = useRef({})
  const deleteAreaRef = useRef(null)
  const formRef = useRef(null)
  const heartRef = useRef(null)

  const allAssigned = Object.values(votes).every((vote) => vote !== "")
  const formValid = name.trim() !== "" && allAssigned && lithuaniaPrediction !== ""

  const pointValues = ["12", "10", "8", "7", "6", "5", "4", "3", "2", "1"]

  // Detect device type
  const [isIOS, setIsIOS] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  // Calculate Lithuania's place based on votes
  const getLithuaniaPlace = () => {
    const lithuaniaCode = "lt"
    for (const [points, countryCode] of Object.entries(votes)) {
      if (countryCode === lithuaniaCode) {
        // Convert points to place
        switch (points) {
          case "12":
            return "1"
          case "10":
            return "2"
          case "8":
            return "3"
          case "7":
            return "4"
          case "6":
            return "5"
          case "5":
            return "6"
          case "4":
            return "7"
          case "3":
            return "8"
          case "2":
            return "9"
          case "1":
            return "10"
        }
      }
    }
    return null
  }

  // Update Lithuania prediction when votes change
  useEffect(() => {
    const lithuaniaPlace = getLithuaniaPlace()
    if (lithuaniaPlace) {
      setLithuaniaPrediction(lithuaniaPlace)
    }
  }, [votes])

  // Load saved prediction from localStorage on initial render
  useEffect(() => {
    const savedPrediction = localStorage.getItem("eurovision_lithuania_prediction")
    if (savedPrediction) {
      setLithuaniaPrediction(savedPrediction)
    }
  }, [])

  // Save prediction to localStorage whenever it changes
  useEffect(() => {
    if (lithuaniaPrediction) {
      localStorage.setItem("eurovision_lithuania_prediction", lithuaniaPrediction)
    }
  }, [lithuaniaPrediction])

  // Check if voting is enabled
  useEffect(() => {
    const checkVotingStatus = async () => {
      try {
        const response = await fetch("/api/voting-status")
        if (response.ok) {
          const data = await response.json()
          setVotingEnabled(data.enabled)
        }
      } catch (error) {
        console.error("Error checking voting status:", error)
      } finally {
        setLoading(false)
      }
    }

    checkVotingStatus()
  }, [])

  useEffect(() => {
    // Detect iOS and mobile
    const userAgent = window.navigator.userAgent.toLowerCase()
    setIsIOS(/iphone|ipad|ipod/.test(userAgent))
    setIsMobile(/iphone|ipad|ipod|android|mobile/.test(userAgent))

    // Check for error in URL
    const error = searchParams.get("error")
    if (error) {
      let errorMessage = "An error occurred while submitting your votes."

      switch (error) {
        case "server-config":
          errorMessage = "Server configuration error. Please try again later."
          break
        case "invalid-form":
          errorMessage = "Invalid form data. Please try again."
          break
        case "invalid-votes":
          errorMessage = "Invalid votes data. Please try again."
          break
        case "missing-data":
          errorMessage = "Missing required data. Please fill in all fields."
          break
        case "save-failed":
          errorMessage = "Failed to save votes. Please try again later."
          break
        case "voting-disabled":
          errorMessage = "Voting is currently disabled by the administrator."
          break
        default:
          errorMessage = `Error: ${error}`
          break
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    }
  }, [searchParams])

  // We'll remove the timer-based heartbeat and use vote changes instead
  useEffect(() => {
    // No timer-based heartbeat anymore
  }, [])

  // Generate a session ID on initial render if not already present
  useEffect(() => {
    let sessionId = localStorage.getItem("eurovision_session_id")
    if (!sessionId) {
      sessionId = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 15)
      localStorage.setItem("eurovision_session_id", sessionId)
    }
    console.log("Using session ID:", sessionId)
  }, [])

  // Load saved votes from localStorage on initial render
  useEffect(() => {
    const savedName = localStorage.getItem("eurovision_name")
    const savedVotes = localStorage.getItem("eurovision_votes")

    if (savedName) {
      setName(savedName)
    }

    if (savedVotes) {
      try {
        const parsedVotes = JSON.parse(savedVotes)
        setVotes(parsedVotes)
      } catch (error) {
        console.error("Error parsing saved votes:", error)
      }
    }
  }, [])

  // Save votes to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem("eurovision_votes", JSON.stringify(votes))
    if (name) {
      localStorage.setItem("eurovision_name", name)
    }
  }, [votes, name])

  // Trigger heartbeat animation when votes change
  useEffect(() => {
    // Skip the initial render
    if (Object.values(votes).some((vote) => vote !== "")) {
      setHeartbeatActive(true)
      const timer = setTimeout(() => {
        setHeartbeatActive(false)
      }, 500)
      return () => clearTimeout(timer)
    }
  }, [votes])

  // Get the highest available point value
  const getNextAvailablePoints = () => {
    for (let i = 0; i < pointValues.length; i++) {
      if (!votes[pointValues[i]]) {
        return pointValues[i]
      }
    }
    return null
  }

  // Handle country click (auto-assign to highest available point)
  const handleCountryClick = (country) => {
    const nextPoints = getNextAvailablePoints()

    if (!nextPoints) {
      toast({
        title: "All votes assigned!",
        description: "You've assigned all your votes. Submit when ready!",
      })
      return
    }

    // Simply assign the country without animation
    handleAssignCountry(nextPoints, country.code)
  }

  // Assign a country to a point value
  const handleAssignCountry = (points, countryCode) => {
    // If there's already a country assigned to this point value, put it back in available countries
    if (votes[points]) {
      // We don't need to do anything here since we're keeping all countries in the list
    }

    // Assign the new country
    setVotes((prev) => ({ ...prev, [points]: countryCode }))

    // Add the iOS widget-like shake animation to the point element
    const pointElement = pointRefs.current[points]
    if (pointElement) {
      // Remove the class first to reset the animation
      pointElement.classList.remove("ios-widget-shake")
      // Force a reflow to restart the animation
      void pointElement.offsetWidth
      // Add the class back to trigger the animation
      pointElement.classList.add("ios-widget-shake")

      // Remove the class after the animation completes
      setTimeout(() => {
        pointElement.classList.remove("ios-widget-shake")
      }, 600)
    }
  }

  // Handle removing a country from votes
  const handleRemoveVote = (points) => {
    const countryCode = votes[points]
    if (!countryCode) return

    // Remove from votes
    setVotes((prev) => ({ ...prev, [points]: "" }))
  }

  // Swap two countries between point values
  const handleSwapCountries = (sourcePoints, targetPoints) => {
    const sourceCountry = votes[sourcePoints]
    const targetCountry = votes[targetPoints]

    if (!sourceCountry) return

    // Create a new votes object with the swap
    const newVotes = { ...votes }
    newVotes[sourcePoints] = targetCountry
    newVotes[targetPoints] = sourceCountry

    setVotes(newVotes)

    // Add the iOS widget-like shake animation to the target point
    const targetElement = pointRefs.current[targetPoints]
    if (targetElement) {
      // Remove the class first to reset the animation
      targetElement.classList.remove("ios-widget-shake")
      // Force a reflow to restart the animation
      void targetElement.offsetWidth
      // Add the class back to trigger the animation
      targetElement.classList.add("ios-widget-shake")

      // Remove the class after the animation completes
      setTimeout(() => {
        targetElement.classList.remove("ios-widget-shake")
      }, 600)
    }
  }

  // iOS-specific touch handlers
  const handleCountryTouchStart = (country, e) => {
    if (!isIOS) return

    e.preventDefault()
    setActiveTouchCountry(country)

    // Highlight the country
    const element = countryRefs.current[country.code]
    if (element) {
      element.classList.add("bg-pink-900/50")
    }
  }

  const handleCountryTouchEnd = (country, e) => {
    if (!isIOS) return

    e.preventDefault()

    // Remove highlight
    const element = countryRefs.current[country.code]
    if (element) {
      element.classList.remove("bg-pink-900/50")
    }

    // If we have an active point and country, assign it
    if (activeTouchPoint && activeTouchCountry && activeTouchCountry.code === country.code) {
      handleAssignCountry(activeTouchPoint, country.code)
    } else if (!activeTouchPoint) {
      // If no active point, use auto-assign
      const nextPoints = getNextAvailablePoints()
      if (nextPoints) {
        handleAssignCountry(nextPoints, country.code)
      }
    }

    setActiveTouchCountry(null)
    setActiveTouchPoint(null)
  }

  const handlePointTouchStart = (points, e) => {
    if (!isIOS) return

    e.preventDefault()
    setActiveTouchPoint(points)

    // Highlight the point
    const element = pointRefs.current[points]
    if (element) {
      element.classList.add("border-cyan-400")
    }
  }

  const handlePointTouchEnd = (points, e) => {
    if (!isIOS) return

    e.preventDefault()

    // Remove highlight
    const element = pointRefs.current[points]
    if (element) {
      element.classList.remove("border-cyan-400")
    }

    // If we have an active country and point, assign it
    if (activeTouchCountry && activeTouchPoint && activeTouchPoint === points) {
      handleAssignCountry(points, activeTouchCountry.code)
    }

    setActiveTouchPoint(null)
    setActiveTouchCountry(null)
  }

  // Context menu handler for desktop right-click
  const handleContextMenu = (points, e) => {
    if (!isMobile && votes[points]) {
      e.preventDefault()
      handleRemoveVote(points)
    }
  }

  // Drag and drop handlers for points
  const handlePointDragStart = (points, e) => {
    if (!votes[points]) return // Skip for empty points

    setDraggedPoints(points)
    setShowDeleteArea(true) // Show delete area when dragging starts on any device

    // Set drag image
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move"

      // Get the country for this point
      const countryCode = votes[points]
      const country = countries.find((c) => c.code === countryCode)

      if (country) {
        // Create a custom drag image
        const dragImage = document.createElement("div")
        dragImage.className = "drag-image"
        dragImage.innerHTML = `
      <div class="flex items-center gap-2 p-2 bg-black/80 border border-pink-600/50 rounded-md">
        <span class="text-xl">${country.flag}</span>
        <div class="font-title drag-font text-white">${country.name}</div>
      </div>
    `
        document.body.appendChild(dragImage)

        // Position off-screen
        dragImage.style.position = "absolute"
        dragImage.style.top = "-1000px"

        // Set as drag image
        e.dataTransfer.setDragImage(dragImage, 0, 0)

        // Clean up after drag
        setTimeout(() => {
          document.body.removeChild(dragImage)
        }, 0)
      }
    }
  }

  const handlePointDragOver = (points, e) => {
    if (isMobile || !draggedPoints || draggedPoints === points) return

    e.preventDefault()
    setDragOverPoints(points)
  }

  const handlePointDragLeave = () => {
    if (isMobile) return

    setDragOverPoints(null)
  }

  const handlePointDrop = (points, e) => {
    if (isMobile || !draggedPoints || draggedPoints === points) return

    e.preventDefault()

    // Swap the countries between the two point values
    handleSwapCountries(draggedPoints, points)

    // Reset drag state
    setDraggedPoints(null)
    setDragOverPoints(null)
  }

  const handlePointDragEnd = () => {
    // Immediately hide the delete area
    setDraggedPoints(null)
    setDragOverPoints(null)
    setIsDraggingToDelete(false)
    setShowDeleteArea(false)

    // Add a small delay to ensure all drag operations are complete
    setTimeout(() => {
      setShowDeleteArea(false)
    }, 100)
  }

  // Touch-based drag and drop for points on mobile
  const [touchDragPoints, setTouchDragPoints] = useState(null)
  const [touchDragStartPos, setTouchDragStartPos] = useState({ x: 0, y: 0 })
  const [touchDragCurrentPos, setTouchDragCurrentPos] = useState({ x: 0, y: 0 })
  const [touchDragActive, setTouchDragActive] = useState(false)
  const touchDragImageRef = useRef(null)

  const handlePointTouchDragStart = (points, e) => {
    if (!isMobile || !votes[points] || activeTouchCountry || activeTouchPoint) return

    // Prevent default to stop page scrolling
    e.preventDefault()

    const touch = e.touches[0]
    setTouchDragPoints(points)
    setTouchDragStartPos({ x: touch.clientX, y: touch.clientY })
    setTouchDragCurrentPos({ x: touch.clientX, y: touch.clientY })

    // Show delete area immediately when drag starts
    setShowDeleteArea(true)

    // Increase the delay and threshold before considering it a drag
    setTimeout(() => {
      if (touchDragPoints === points) {
        // Check if we've moved enough to consider it a drag - INCREASED THRESHOLD
        const dx = Math.abs(touchDragCurrentPos.x - touchDragStartPos.x)
        const dy = Math.abs(touchDragCurrentPos.y - touchDragStartPos.y)

        // Increased threshold from 10 to 20 pixels
        if (dx > 20 || dy > 20) {
          setTouchDragActive(true)

          // Get the country for this point
          const countryCode = votes[points]
          const country = countries.find((c) => c.code === countryCode)

          if (country) {
            // Create drag image
            const dragImage = document.createElement("div")
            dragImage.className = "touch-drag-image"
            dragImage.innerHTML = `
            <div class="flex items-center gap-2 p-2 bg-black/90 border border-pink-600/50 rounded-md shadow-lg">
              <span class="text-xl">${country.flag}</span>
              <div class="font-title drag-font text-white">${country.name}</div>
            </div>
          `

            // Position at touch point
            dragImage.style.position = "fixed"
            dragImage.style.left = `${touch.clientX}px`
            dragImage.style.top = `${touch.clientY}px`
            dragImage.style.transform = "translate(-50%, -50%)"
            dragImage.style.zIndex = "100"
            dragImage.style.pointerEvents = "none"

            document.body.appendChild(dragImage)
            touchDragImageRef.current = dragImage
          }
        }
      }
    }, 300) // Increased from 150ms to 300ms
  }

  const handlePointTouchDragMove = (e: TouchEvent) => {
    if (!touchDragPoints) return

    // Prevent default to stop page scrolling
    e.preventDefault()

    const touch = e.touches[0]
    setTouchDragCurrentPos({ x: touch.clientX, y: touch.clientY })

    // If we haven't started dragging yet, check if we should
    if (!touchDragActive) {
      const dx = Math.abs(touch.clientX - touchDragStartPos.x)
      const dy = Math.abs(touch.clientY - touchDragStartPos.y)

      // Increased threshold from 10 to 20 pixels
      if (dx > 20 || dy > 20) {
        setTouchDragActive(true)

        // Get the country for this point
        const countryCode = votes[touchDragPoints]
        const country = countries.find((c) => c.code === countryCode)

        if (country) {
          // Create drag image
          const dragImage = document.createElement("div")
          dragImage.className = "touch-drag-image"
          dragImage.innerHTML = `
          <div class="flex items-center gap-2 p-2 bg-black/90 border border-pink-600/50 rounded-md shadow-lg">
            <span class="text-xl">${country.flag}</span>
            <div className="font-title drag-font text-white">${country.name}</div>
          </div>
        `

          // Position at touch point
          dragImage.style.position = "fixed"
          dragImage.style.left = `${touch.clientX}px`
          dragImage.style.top = `${touch.clientY}px`
          dragImage.style.transform = "translate(-50%, -50%)"
          dragImage.style.zIndex = "100"
          dragImage.style.pointerEvents = "none"

          document.body.appendChild(dragImage)
          touchDragImageRef.current = dragImage
        }
      }
    }

    // Rest of the function remains the same
    // If we're dragging, move the drag image
    if (touchDragActive && touchDragImageRef.current) {
      touchDragImageRef.current.style.left = `${touch.clientX}px`
      touchDragImageRef.current.style.top = `${touch.clientY}px`
    }

    // Check if over a point
    let foundPoint = null
    for (const points of pointValues) {
      if (points !== touchDragPoints) {
        const pointElement = pointRefs.current[points]
        if (pointElement) {
          const rect = pointElement.getBoundingClientRect()
          if (
            touch.clientX >= rect.left &&
            touch.clientX <= rect.right &&
            touch.clientY >= rect.top &&
            touch.clientY <= rect.bottom
          ) {
            foundPoint = points
            break
          }
        }
      }
    }

    // Check if over delete area
    if (deleteAreaRef.current) {
      const deleteRect = deleteAreaRef.current.getBoundingClientRect()
      if (
        touch.clientX >= deleteRect.left &&
        touch.clientX <= deleteRect.right &&
        touch.clientY >= deleteRect.top &&
        touch.clientY <= deleteRect.bottom
      ) {
        setIsDraggingToDelete(true)
        foundPoint = null
      } else {
        setIsDraggingToDelete(false)
      }
    }

    setDragOverPoints(foundPoint)
  }

  const handlePointTouchDragEnd = () => {
    if (!touchDragPoints) return

    // Clean up drag image
    if (touchDragImageRef.current) {
      document.body.removeChild(touchDragImageRef.current)
      touchDragImageRef.current = null
    }

    // If over delete area, remove the vote
    if (isDraggingToDelete) {
      handleRemoveVote(touchDragPoints)
    }
    // If over a point and we were actively dragging, swap the countries
    else if (touchDragActive && dragOverPoints) {
      handleSwapCountries(touchDragPoints, dragOverPoints)
    }

    // Reset state
    setTouchDragPoints(null)
    setTouchDragActive(false)
    setDragOverPoints(null)
    setIsDraggingToDelete(false)
    setShowDeleteArea(false)

    // Add a small delay to ensure all drag operations are complete
    setTimeout(() => {
      setShowDeleteArea(false)
    }, 100)
  }

  // Add global event listeners for touch drag
  useEffect(() => {
    const handleGlobalTouchMove = (e) => {
      if (touchDragPoints) {
        handlePointTouchDragMove(e)
      }
    }

    const handleGlobalTouchEnd = () => {
      if (touchDragPoints) {
        handlePointTouchDragEnd()
      }
    }

    if (touchDragPoints) {
      window.addEventListener("touchmove", handleGlobalTouchMove, { passive: false })
      window.addEventListener("touchend", handleGlobalTouchEnd)
    }

    return () => {
      window.removeEventListener("touchmove", handleGlobalTouchMove)
      window.removeEventListener("touchend", handleGlobalTouchEnd)
    }
  }, [touchDragPoints, touchDragActive, dragOverPoints, isDraggingToDelete])

  // Prevent page scrolling when dragging
  useEffect(() => {
    const preventScroll = (e) => {
      // Only prevent scrolling if we're actively dragging
      if (touchDragActive && touchDragPoints) {
        e.preventDefault()
        return false
      }
    }

    // Add event listeners to prevent scrolling during drag
    if (touchDragActive && touchDragPoints) {
      document.addEventListener("touchmove", preventScroll, { passive: false })
    }

    return () => {
      document.removeEventListener("touchmove", preventScroll)
    }
  }, [touchDragActive, touchDragPoints])

  const handleSubmit = async (e) => {
    e.preventDefault()

    // Check if voting is enabled
    if (!votingEnabled) {
      toast({
        title: "Voting Disabled",
        description: "Voting is currently disabled by the administrator.",
        variant: "destructive",
      })
      return
    }

    // Prevent double submission
    if (isSubmitting) return
    setIsSubmitting(true)

    // Check if all votes are selected
    const allVotesSelected = Object.values(votes).every((vote) => vote !== "")

    if (!name.trim()) {
      toast({
        title: "Error",
        description: "Please enter your name",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (!allVotesSelected) {
      toast({
        title: "Error",
        description: "Please assign all your votes before submitting",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    if (!lithuaniaPrediction) {
      toast({
        title: "Error",
        description: "Please make your prediction for Lithuania",
        variant: "destructive",
      })
      setIsSubmitting(false)
      return
    }

    try {
      // Get session ID
      const sessionId = localStorage.getItem("eurovision_session_id")
      console.log("Submitting with session ID:", sessionId)

      // For iOS, use a more direct approach
      if (isIOS) {
        // Create a hidden form and submit it directly
        const form = document.createElement("form")
        form.method = "POST"
        form.action = "/api/votes-ios"

        // Add hidden fields
        const nameField = document.createElement("input")
        nameField.type = "hidden"
        nameField.name = "name"
        nameField.value = name
        form.appendChild(nameField)

        const votesField = document.createElement("input")
        votesField.type = "hidden"
        votesField.name = "votes"
        votesField.value = JSON.stringify(votes)
        form.appendChild(votesField)

        const predictionField = document.createElement("input")
        predictionField.type = "hidden"
        predictionField.name = "lithuaniaPrediction"
        predictionField.value = lithuaniaPrediction
        form.appendChild(predictionField)

        const sessionIdField = document.createElement("input")
        sessionIdField.type = "hidden"
        sessionIdField.name = "sessionId"
        sessionIdField.value = sessionId || ""
        form.appendChild(sessionIdField)

        // Add the form to the document and submit it
        document.body.appendChild(form)
        form.submit()
        return
      }

      // For non-iOS devices, use fetch
      const response = await fetch("/api/votes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          votes,
          lithuaniaPrediction,
          sessionId,
        }),
      })

      if (response.ok) {
        // Force navigation for compatibility
        window.location.href = "/thank-you"
      } else {
        const errorData = await response.json()
        toast({
          title: "Error",
          description: errorData.error || "Failed to submit votes. Please try again.",
          variant: "destructive",
        })
        setIsSubmitting(false)
      }
    } catch (error) {
      console.error("Submission error:", error)
      toast({
        title: "Error",
        description: "Something went wrong. Please try again.",
        variant: "destructive",
      })
      setIsSubmitting(false)
    }
  }

  // Get country by code
  const getCountry = (code) => {
    return countries.find((country) => country.code === code)
  }

  // Check if a country is assigned to any point value
  const isCountryAssigned = (code) => {
    return Object.values(votes).includes(code)
  }

  // Get score color
  const getScoreColor = (points) => {
    if (points === "12") return "bg-yellow-500" // Gold
    if (points === "10") return "bg-gray-300" // Silver
    if (points === "8") return "bg-amber-700" // Bronze
    return "bg-pink-600" // Eurovision pink for other scores
  }

  // Get score text size
  const getScoreTextSize = (points) => {
    if (points === "12") return "text-2xl"
    if (points === "10") return "text-xl"
    if (points === "8") return "text-lg"
    return "text-base"
  }

  // Get country name text size
  const getCountryTextSize = (points) => {
    if (points === "12") return "text-lg"
    if (points === "10") return "text-base"
    if (points === "8") return "text-sm"
    return "text-sm" // Increased from text-xs
  }

  // Get song text size
  const getSongTextSize = (points) => {
    if (points === "12") return "text-sm"
    if (points === "10") return "text-xs"
    if (points === "8") return "text-xs"
    return "text-xs"
  }

  // Check if a score is glowing
  const isGlowing = (points) => {
    if (!glowingScore) return false
    return glowingScore === points || glowingScore.split(",").includes(points)
  }

  // Format running order number with leading zero
  const formatRunningOrder = (order) => {
    return order < 10 ? `0${order}` : `${order}`
  }

  // Get the country that has 12 points
  const getCountryWith12Points = () => {
    const countryCode = votes["12"]
    return countryCode ? getCountry(countryCode) : null
  }

  // If loading, show a loading spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Loader2 className="h-16 w-16 animate-spin text-pink-600" />
      </div>
    )
  }

  // If voting is disabled, show a message
  if (!votingEnabled) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-4">
        <div className="max-w-md text-center">
          <AlertTriangle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-4 font-title">Voting Closed</h1>
          <p className="text-xl mb-8 font-title">
            Voting has been temporarily disabled by the administrator. Please check back later.
          </p>
          <Link href="/">
            <Button className="bg-gradient-to-r from-pink-600 via-cyan-500 to-red-500 hover:from-pink-700 hover:via-cyan-600 hover:to-red-600 text-white py-4 px-8 text-lg font-title">
              View Results
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white select-none pb-24">
      {/* Header bar */}
      <div className="fixed top-0 left-0 right-0 z-20 bg-black/90 backdrop-blur-sm border-b border-pink-600/30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center text-white hover:text-pink-400 transition-colors">
            <Home className="h-5 w-5" />
          </Link>

          <div className="flex flex-col items-center">
            <h1 className="text-xl md:text-2xl font-bold italic text-transparent bg-clip-text bg-gradient-to-r from-pink-500 via-cyan-400 to-red-500 font-title">
              Europe, start voting now!
            </h1>
          </div>

          <div className="flex items-center">
            <Image
              src="/images/eurovision-heart.png"
              alt="Eurovision 2025"
              width={40}
              height={40}
              className={`h-8 w-auto ${heartbeatActive ? "heartbeat" : ""}`}
              ref={heartRef}
            />
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="pt-24 px-4 pb-8">
        <div className="max-w-4xl mx-auto">
          <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
            {/* Votes section - moved above the name input */}
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold font-title">Your Votes</h2>
                {/* Removed the drag and drop instruction */}
              </div>

              <div className="flex flex-col md:flex-row gap-6">
                {/* Points column */}
                <div className="w-full md:w-1/3 space-y-3">
                  {pointValues.map((points, index) => {
                    const countryCode = votes[points]
                    const country = countryCode ? getCountry(countryCode) : null
                    const scoreColor = getScoreColor(points)
                    const textSize = getScoreTextSize(points)
                    const countryTextSize = getCountryTextSize(points)
                    const songTextSize = getSongTextSize(points)

                    // Add a bigger gap between 8 and 7
                    const extraClass = points === "7" ? "mt-6" : ""

                    // Drag over styles
                    const isDragOver = dragOverPoints === points
                    const dragOverClass = isDragOver ? "border-cyan-400 bg-cyan-900/20 scale-105" : ""

                    // Dragging styles
                    const isDragging = draggedPoints === points || touchDragPoints === points
                    const draggingClass = isDragging && touchDragActive ? "opacity-50" : ""

                    // Enhanced country effect
                    const isEnhanced = country && country.code === enhancedCountry
                    const enhancedClass = isEnhanced ? "enhanced-country" : ""

                    return (
                      <div
                        key={points}
                        ref={(el) => (pointRefs.current[points] = el)}
                        data-points={points}
                        className={`h-20 ${extraClass} rounded-md border-2 ${
                          isGlowing(points) ? "border-cyan-400 glow-effect" : "border-pink-600/30"
                        } ${dragOverClass} ${draggingClass} ${touchDragActive && touchDragPoints === points ? "border-cyan-400 bg-cyan-900/20" : ""} ${enhancedClass} flex overflow-hidden relative transition-transform`}
                        onTouchStart={isIOS ? (e) => handlePointTouchStart(points, e) : undefined}
                        onTouchEnd={isIOS ? (e) => handlePointTouchEnd(points, e) : undefined}
                        onContextMenu={(e) => handleContextMenu(points, e)}
                        onDragOver={(e) => handlePointDragOver(points, e)}
                        onDragLeave={handlePointDragLeave}
                        onDrop={(e) => handlePointDrop(points, e)}
                      >
                        <div
                          className={`${scoreColor} text-white flex items-center justify-center font-score ${textSize} w-16 flex-shrink-0 z-0`}
                        >
                          {points}
                        </div>

                        {country ? (
                          <div className="flex-1 flex items-center overflow-hidden">
                            <div className="flex-1 flex items-center p-2 pl-4 bg-black/60 relative w-full no-scroll-touch">
                              <div className="flex items-center gap-3 w-full pr-8">
                                <span className="text-3xl flex-shrink-0">{country.flag}</span>
                                <div className="flex-1 min-w-0">
                                  <div className={`font-title ${countryTextSize} flex items-center gap-2 truncate`}>
                                    {country.name}
                                    <span className="text-gray-500 opacity-60 text-xs">
                                      #{formatRunningOrder(country.order)}
                                    </span>
                                  </div>
                                  <div className={`text-gray-400 truncate ${songTextSize}`}>
                                    {country.artist} - {country.song}
                                  </div>
                                </div>
                              </div>

                              {/* Drag handle indicator */}
                              <div
                                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-pink-400 bg-pink-950/50 p-2 rounded-md border border-pink-600/30 cursor-grab active:cursor-grabbing"
                                draggable={!isMobile}
                                onDragStart={(e) => handlePointDragStart(points, e)}
                                onDragEnd={handlePointDragEnd}
                                onTouchStart={(e) => {
                                  if (isMobile) {
                                    handlePointTouchDragStart(points, e)
                                  }
                                }}
                              >
                                <GripVertical className="h-6 w-6" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="flex-1 flex items-center justify-center text-gray-600 text-base p-2 bg-black/40 font-empty">
                            No country selected
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Available countries */}
                <div className="w-full md:w-2/3">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold font-title">Final Performances</h2>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {countries.map((country) => {
                      const isAssigned = isCountryAssigned(country.code)

                      return (
                        <div
                          key={country.code}
                          ref={(el) => (countryRefs.current[country.code] = el)}
                          onClick={() => !isAssigned && handleCountryClick(country)}
                          onTouchStart={(e) => !isAssigned && handleCountryTouchStart(country, e)}
                          onTouchEnd={(e) => !isAssigned && handleCountryTouchEnd(country, e)}
                          className={`p-3 rounded-md cursor-pointer bg-black/60 hover:bg-pink-900/30 border border-pink-600/20 transition-all relative ios-touch-highlight ${
                            isAssigned ? "opacity-50 pointer-events-none" : ""
                          } ${country.code === "lt" ? "border-yellow-500/50" : ""}`}
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{country.flag}</span>
                            <div className="flex-1 min-w-0">
                              <div className="font-title text-sm truncate">{country.name}</div>
                              <div className="text-xs text-gray-400 truncate">{country.artist}</div>
                            </div>
                            <div className="text-pink-500 font-mono text-sm">{formatRunningOrder(country.order)}</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Instructions */}
                  <div className="mt-6 p-4 bg-black/60 border border-pink-600/20 rounded-md">
                    <div className="flex items-start gap-3">
                      <Info className="h-5 w-5 text-pink-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-gray-300">
                        <p className="mb-2">
                          <strong>How to vote:</strong>
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                          <li>Click on a country to assign it to the highest available points</li>
                          <li>Drag assigned countries to reorder your votes or to the red area to delete</li>
                          {!isMobile && <li>Right-click on an assigned country to quickly remove it</li>}
                          <li>You must assign all points before submitting</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Name input - moved below the votes section */}
            <div className="space-y-3 mt-8 border-t border-pink-600/20 pt-8">
              <Label htmlFor="name" className="text-xl font-semibold text-white font-title">
                Your Name
              </Label>
              <div className="relative">
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="bg-black/80 border-pink-600/50 text-white text-xl py-7 pl-12 font-title font-bold"
                  placeholder="Enter your name"
                  required
                />
                {votes["12"] ? (
                  <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-xl">
                    {getCountryWith12Points()?.flag}
                  </span>
                ) : (
                  <Music className="absolute left-4 top-1/2 transform -translate-y-1/2 text-pink-600" />
                )}
              </div>
            </div>

            {/* Lithuania prediction - added below name input */}
            <div className="space-y-3">
              <Label
                htmlFor="lithuania-prediction"
                className="text-xl font-semibold text-white font-title flex items-center gap-2"
              >
                My prediction for Lithuania is:
                <span className="text-xl">🇱🇹</span>
              </Label>
              <div className="relative">
                {getLithuaniaPlace() ? (
                  <div className="bg-black/80 border border-yellow-500/50 text-white text-xl py-4 px-4 rounded-md font-title font-bold flex items-center">
                    <span className="text-yellow-500 mr-2">{getLithuaniaPlace()}</span>
                    <span>place</span>
                    <span className="text-gray-400 text-sm ml-2">(based on your votes)</span>
                  </div>
                ) : (
                  <Select value={lithuaniaPrediction} onValueChange={setLithuaniaPrediction}>
                    <SelectTrigger className="bg-black/80 border-pink-600/50 text-white text-xl py-7 font-title font-bold">
                      <SelectValue placeholder="Select Lithuania's final place" />
                    </SelectTrigger>
                    <SelectContent className="bg-black/90 border-pink-600/50 text-white">
                      {Array.from({ length: 16 }, (_, i) => i + 11).map((place) => (
                        <SelectItem key={place} value={place.toString()} className="text-white hover:bg-pink-900/30">
                          {place} place
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Sticky footer with submit button or delete area */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm border-t border-pink-600/30 py-4 z-10">
        <div className="container mx-auto px-4">
          {showDeleteArea || draggedPoints ? (
            <div
              ref={deleteAreaRef}
              className={`w-full py-6 rounded-md flex items-center justify-center gap-3 delete-area ${
                isDraggingToDelete ? "bg-red-700" : "bg-red-900/70 delete-area-pulse"
              } text-white text-xl transition-all`}
              onDragOver={handleDeleteAreaDragOver}
              onDragLeave={handleDeleteAreaDragLeave}
              onDrop={handleDeleteAreaDrop}
            >
              <Trash2 className={`h-6 w-6 ${isDraggingToDelete ? "animate-bounce" : ""}`} />
              <span className="font-bold">Drag here to delete</span>
            </div>
          ) : (
            <>
              {isIOS ? (
                <a
                  href="#"
                  onClick={formValid ? handleSubmit : undefined}
                  className={`block w-full text-center py-6 text-xl rounded-md font-title font-bold ${
                    formValid
                      ? "bg-gradient-to-r from-pink-600 via-cyan-500 to-red-500 hover:from-pink-700 hover:via-cyan-600 hover:to-red-600 text-white"
                      : "bg-gray-800 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  {isSubmitting ? "Submitting..." : "Submit Your Votes"}
                </a>
              ) : (
                <Button
                  type="submit"
                  disabled={!formValid || isSubmitting}
                  onClick={handleSubmit}
                  className="w-full bg-gradient-to-r from-pink-600 via-cyan-500 to-red-500 hover:from-pink-700 hover:via-cyan-600 hover:to-red-600 text-white py-6 text-xl font-title font-bold disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-800 disabled:from-gray-800 disabled:to-gray-800 disabled:via-gray-800 disabled:text-gray-500"
                >
                  {isSubmitting ? "Submitting..." : "Submit Your Votes"}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Toaster />
    </div>
  )

  // Add this function after handlePointDragOver
  function handleDeleteAreaDragOver(e) {
    if (!draggedPoints) return

    e.preventDefault()
    setIsDraggingToDelete(true)
  }

  // Add this function after handlePointDragLeave
  function handleDeleteAreaDragLeave() {
    setIsDraggingToDelete(false)
  }

  // Add this function after handlePointDrop
  function handleDeleteAreaDrop(e) {
    if (!draggedPoints) return

    e.preventDefault()
    handleRemoveVote(draggedPoints)

    // Reset drag state
    setDraggedPoints(null)
    setDragOverPoints(null)
    setIsDraggingToDelete(false)
    setShowDeleteArea(false)
  }

  // Add this useEffect after the other useEffects
  useEffect(() => {
    // If no drag is happening, ensure delete area is hidden
    if (!draggedPoints && !touchDragPoints) {
      // Small delay to ensure all drag operations are complete
      const timer = setTimeout(() => {
        setShowDeleteArea(false)
        setIsDraggingToDelete(false)
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [draggedPoints, touchDragPoints])
}
