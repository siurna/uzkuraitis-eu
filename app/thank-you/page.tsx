import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function ThankYouPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-black text-white p-4">
      <div className="text-center max-w-md">
        <div className="text-6xl animate-pulse mb-4">❤️</div>
        <h1 className="text-4xl font-bold italic mb-4 font-title">Thank You!</h1>
        <p className="text-xl mb-4 font-title">Your votes for Eurovision 2025 have been submitted successfully.</p>

        <p className="text-lg mb-8 text-pink-300">
          You can re-vote as many times as you want. Only your latest votes will be counted!
        </p>

        <div className="flex justify-center">
          <Link href="/">
            <Button className="bg-gradient-to-r from-pink-600 via-cyan-500 to-red-500 hover:from-pink-700 hover:via-cyan-600 hover:to-red-600 text-white py-6 px-8 text-lg font-title font-bold">
              View Results
            </Button>
          </Link>
        </div>
      </div>
    </div>
  )
}
