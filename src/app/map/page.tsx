import { redirect } from "next/navigation";

export default function MapPage() {
  redirect("/map/goals");
  return null;
}
