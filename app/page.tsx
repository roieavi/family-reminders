import { supabaseAdmin } from "@/lib/supabase";
import SetupForm from "./SetupForm";
import JoinForm from "./JoinForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { count } = await supabaseAdmin
    .from("families")
    .select("id", { count: "exact", head: true });

  const familyExists = Boolean(count && count > 0);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold">
          תזכורות המשפחה
        </h1>
        {familyExists ? <JoinForm /> : <SetupForm />}
      </div>
    </main>
  );
}
