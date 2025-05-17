import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase"
import { countries } from "@/lib/countries"

export async function GET(request: Request) {
  try {
    // Get Supabase client
    const supabase = getSupabaseServerClient()

    // Get all voters with their votes
    const { data: votersData, error: votersError } = await supabase
      .from("voters")
      .select(`
      id,
      name,
      lithuania_prediction,
      created_at,
      votes (
        country_code,
        points
      )
    `)
      .order("created_at", { ascending: false })

    if (votersError) {
      console.error("Error fetching voters:", votersError)
      return NextResponse.json({ error: votersError.message }, { status: 500 })
    }

    // Get user scores
    let userScores = []

    // Try to get scores from user_scores table first
    try {
      const { data: scoresData, error: scoresError } = await supabase
        .from("user_scores")
        .select("*")
        .order("total_score", { ascending: false })

      if (!scoresError && scoresData && scoresData.length > 0) {
        userScores = scoresData.map((score) => ({
          id: score.id,
          name: score.name,
          top10Score: score.top10_score,
          lithuaniaScore: score.lithuania_score,
          totalScore: score.total_score,
        }))
      }
    } catch (error) {
      console.log("Error accessing user_scores table:", error)
    }

    // If no scores from table, try from settings
    if (userScores.length === 0) {
      try {
        const { data: settingsData, error: settingsError } = await supabase
          .from("settings")
          .select("value")
          .eq("key", "user_scores")
          .single()

        if (!settingsError && settingsData && settingsData.value) {
          try {
            userScores = JSON.parse(settingsData.value)
          } catch (parseError) {
            console.error("Error parsing user_scores from settings:", parseError)
          }
        }
      } catch (error) {
        console.log("Error fetching user_scores from settings:", error)
      }
    }

    // Get final results
    let finalResults = null
    try {
      const { data: resultsData, error: resultsError } = await supabase
        .from("settings")
        .select("value")
        .eq("key", "final_results")
        .single()

      if (!resultsError && resultsData && resultsData.value) {
        try {
          finalResults = JSON.parse(resultsData.value)
        } catch (parseError) {
          console.error("Error parsing final results:", parseError)
        }
      }
    } catch (error) {
      console.log("Error fetching final results:", error)
    }

    // Helper function to escape CSV fields properly
    const escapeCSV = (field) => {
      if (field === null || field === undefined) return ""
      const stringField = String(field)
      // If the field contains quotes, commas, or newlines, wrap it in quotes and escape internal quotes
      if (stringField.includes('"') || stringField.includes(",") || stringField.includes("\n")) {
        return `"${stringField.replace(/"/g, '""')}"`
      }
      return stringField
    }

    // Format voter data for CSV
    const voterRows = votersData.map((voter) => {
      // Create a map of points to country code
      const votesMap = {}
      voter.votes.forEach((vote) => {
        votesMap[vote.points] = vote.country_code
      })

      // Get country names for each point value
      const pointValues = [12, 10, 8, 7, 6, 5, 4, 3, 2, 1]
      const voteEntries = pointValues.map((points) => {
        const countryCode = votesMap[points]
        if (!countryCode) return ""
        const country = countries.find((c) => c.code === countryCode)
        return country ? country.name : countryCode
      })

      // Format date
      let formattedDate = ""
      try {
        const createdAt = new Date(voter.created_at)
        formattedDate = `${createdAt.toLocaleDateString()} ${createdAt.toLocaleTimeString()}`
      } catch (e) {
        formattedDate = voter.created_at || ""
      }

      return [voter.name, ...voteEntries, voter.lithuania_prediction || "", formattedDate]
    })

    // Create CSV content for votes
    let csvContent =
      "Name,12 Points,10 Points,8 Points,7 Points,6 Points,5 Points,4 Points,3 Points,2 Points,1 Point,Lithuania Prediction,Timestamp\n"

    voterRows.forEach((row) => {
      csvContent += row.map(escapeCSV).join(",") + "\n"
    })

    // Add a separator
    csvContent += "\n\nSCORES\n"
    csvContent += "Name,Top 10 Score,Lithuania Score,Total Score\n"

    // Add scores
    userScores.forEach((score) => {
      csvContent +=
        [
          escapeCSV(score.name),
          escapeCSV(score.top10Score || 0),
          escapeCSV(score.lithuaniaScore || 0),
          escapeCSV(score.totalScore || 0),
        ].join(",") + "\n"
    })

    // Add final results if available
    if (finalResults) {
      csvContent += "\n\nFINAL RESULTS\n"
      csvContent += "Position,Country\n"

      finalResults.top10.forEach((countryCode, index) => {
        if (countryCode) {
          const country = countries.find((c) => c.code === countryCode)
          const countryName = country ? country.name : countryCode
          csvContent += `${index + 1},${escapeCSV(countryName)}\n`
        }
      })

      csvContent += `\nLithuania Final Position,${escapeCSV(finalResults.lithuaniaPlace)}\n`
    }

    // Set headers for CSV download
    const headers = new Headers()
    headers.set("Content-Type", "text/csv; charset=utf-8")
    headers.set(
      "Content-Disposition",
      `attachment; filename="eurovision-data-${new Date().toISOString().split("T")[0]}.csv"`,
    )

    return new Response(csvContent, {
      status: 200,
      headers,
    })
  } catch (error) {
    console.error("Error generating CSV:", error)
    return NextResponse.json({ error: "Failed to generate CSV" }, { status: 500 })
  }
}
