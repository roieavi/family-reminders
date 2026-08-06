import { supabaseAdmin } from "@/lib/supabase";
import EntryScreen from "./EntryScreen";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { count } = await supabaseAdmin
    .from("families")
    .select("id", { count: "exact", head: true });

  const familyExists = Boolean(count && count > 0);

  return <EntryScreen familyExists={familyExists} />;
}
