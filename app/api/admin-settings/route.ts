import { NextResponse } from "next/server"
import { getSupabaseServerClient } from "@/lib/supabase"

export async function GET() {
  try {
    const supabase = getSupabaseServerClient()

    // Get admin settings from the settings table
    const { data: showAdminData, error: showAdminError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "show_admin_button")
      .single()

    // Default to true if there's an error or no setting found
    let showAdminButton = true
    if (!showAdminError && showAdminData) {
      showAdminButton = showAdminData.value === "true"
    }

    // Get admin password from the settings table
    const { data: passwordData, error: passwordError } = await supabase
      .from("settings")
      .select("value")
      .eq("key", "admin_password")
      .single()

    // Default password if not found
    let adminPassword = "👀👀👀"
    if (!passwordError && passwordData && passwordData.value) {
      adminPassword = passwordData.value
    }

    return NextResponse.json({
      showAdminButton,
      adminPassword,
    })
  } catch (error) {
    console.error("Error fetching admin settings:", error)
    return NextResponse.json({ error: "Failed to fetch admin settings" }, { status: 500 })
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

    const { showAdminButton, adminPassword, currentPassword } = body

    // Check current password
    if (currentPassword !== "👀👀👀") {
      return NextResponse.json({ error: "Incorrect current password" }, { status: 403 })
    }

    const supabase = getSupabaseServerClient()

    // Update settings
    if (showAdminButton !== undefined) {
      const { error: showAdminError } = await supabase.from("settings").upsert(
        {
          key: "show_admin_button",
          value: showAdminButton ? "true" : "false",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      )

      if (showAdminError) {
        console.error("Error updating show_admin_button setting:", showAdminError)
        return NextResponse.json({ error: showAdminError.message }, { status: 500 })
      }
    }

    // Update password if provided
    if (adminPassword) {
      const { error: passwordError } = await supabase.from("settings").upsert(
        {
          key: "admin_password",
          value: adminPassword,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "key" },
      )

      if (passwordError) {
        console.error("Error updating admin_password setting:", passwordError)
        return NextResponse.json({ error: passwordError.message }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error updating admin settings:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
