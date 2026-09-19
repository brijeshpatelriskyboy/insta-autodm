import { redirect } from "next/navigation";

/** Public /demo no longer exposes demo credentials. */
export default function DemoPage() {
  redirect("/login");
}
