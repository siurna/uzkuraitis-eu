import { redirect } from "next/navigation";

// Backstage lands on the Live controller — that's the thing you're at the
// keyboard for during the show. Rooms / Results / Settings are tabs.
export default function AdminIndex() {
  redirect("/admin/live");
}
