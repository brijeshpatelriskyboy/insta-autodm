import { redirect } from "next/navigation";

/** Internal demo entry — keeps credentials off the normal /login experience. */
export default function DemoPage() {
  redirect("/login?demo=1");
}
