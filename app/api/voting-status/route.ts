import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase"

export async function GET() {
  try {
    const supabase = getSupabaseServerClient()

    // Get the voting status from the settings table
    const { data, error } = await supabase.from("settings").select("value").eq("key", "voting_enabled").single()

    if (error) {
      console.error("Error fetching voting status:", error)
      // Default to enabled if there's an error
      return NextResponse.json({ enabled: true })
    }

    // Parse the value as boolean
    const enabled = data ? data.value === "true" : true

    return NextResponse.json({ enabled })
  } catch (error) {
    console.error("Unexpected error fetching voting status:", error)
    // Default to enabled if there's an error
    return NextResponse.json({ enabled: true })
  }
}

export async function POST(request: Request) {
  try {
    // Parse request body
    let body
    try {
      body = await request.json()
    } catch (error) {
      console.error("Error parsing request body:", error)
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
    }

    const { enabled, password } = body

    // Check password
    if (password !== "👀👀👀") {
      return NextResponse.json({ error: "Incorrect password" }, { status: 403 })
    }

    if (enabled === undefined) {
      return NextResponse.json({ error: "Enabled status is required" }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Update the voting status in the settings table
    const { error } = await supabase
      .from("settings")
      .update({ value: enabled ? "true" : "false", updated_at: new Date().toISOString() })
      .eq("key", "voting_enabled")

    if (error) {
      console.error("Error updating voting status:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, enabled })
  } catch (error) {
    console.error("Unexpected error updating voting status:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
