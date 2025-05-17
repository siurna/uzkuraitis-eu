"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Trophy, Settings, LogOut, Home, Vote } from "lucide-react"

export default function AdminLayout({ children }) {
  const [authenticated, setAuthenticated] = useState(false)
  const [password, setPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [loading, setLoading] = useState(true)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    // Check if already authenticated in localStorage
    const isAuth = localStorage.getItem("eurovision_admin_auth") === "true"
    setAuthenticated(isAuth)
    setLoading(false)
  }, [])

  const handleLogin = (e) => {
    e.preventDefault()
    // Use the emoji password
    if (password === "👀👀👀") {
      setAuthenticated(true)
      setAuthError("")
      // Store authentication in localStorage
      localStorage.setItem("eurovision_admin_auth", "true")
    } else {
      setAuthError("Incorrect password")
    }
  }

  const handleLogout = () => {
    setAuthenticated(false)
    localStorage.removeItem("eurovision_admin_auth")
    router.push("/")
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-pink-600"></div>
      </div>
    )
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md p-6 bg-black/80 rounded-lg border border-pink-600/30">
          <h1 className="text-2xl font-bold mb-6 text-center font-title">Admin Login</h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-black/60 border-pink-600/50"
                placeholder="Enter admin password"
              />
              {authError && <p className="text-red-500 text-sm">{authError}</p>}
            </div>

            <Button type="submit" className="w-full bg-gradient-to-r from-pink-600 to-cyan-500">
              Login
            </Button>
          </form>
        </div>
      </div>
    )
  }

  // Navigation items
  const navItems = [
    { path: "/admin", label: "Voting", icon: <Vote className="h-5 w-5" /> },
    { path: "/admin/results", label: "Results", icon: <Trophy className="h-5 w-5" /> },
    { path: "/admin/settings", label: "Settings", icon: <Settings className="h-5 w-5" /> },
  ]

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Top navbar */}
      <header className="bg-black/80 backdrop-blur-md border-b border-pink-600/30 sticky top-0 z-10">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Link href="/" className="text-gray-400 hover:text-white">
                <Home className="h-5 w-5" />
              </Link>
              <span className="text-xl font-bold font-title">Eurovision Admin</span>
            </div>

            <div className="flex items-center gap-3">
              <Button variant="ghost" onClick={handleLogout} className="text-gray-400 hover:text-white">
                <LogOut className="h-5 w-5 mr-2" />
                Logout
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Side navbar and content */}
      <div className="flex flex-1">
        {/* Side navbar */}
        <nav className="w-64 bg-black/60 border-r border-pink-600/20 p-4 hidden md:block">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Link
                  href={item.path}
                  className={`flex items-center gap-3 p-3 rounded-md transition-colors ${
                    pathname === item.path
                      ? "bg-pink-600/20 text-white"
                      : "text-gray-400 hover:bg-pink-950/30 hover:text-white"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Mobile navbar */}
        <div className="fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-md border-t border-pink-600/30 md:hidden z-10">
          <div className="flex justify-around">
            {navItems.map((item) => (
              <Link
                key={item.path}
                href={item.path}
                className={`flex flex-col items-center py-3 px-4 ${
                  pathname === item.path ? "text-pink-500" : "text-gray-400"
                }`}
              >
                {item.icon}
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Main content */}
        <main className="flex-1 p-6 pb-20 md:pb-6 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
