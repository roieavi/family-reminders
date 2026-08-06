import { supabaseAdmin } from "@/lib/supabase";
import SetupForm from "./SetupForm";
import JoinForm from "./JoinForm";
import AutoRedirect from "./AutoRedirect";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { count } = await supabaseAdmin
    .from("families")
    .select("id", { count: "exact", head: true });

  const familyExists = Boolean(count && count > 0);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <AutoRedirect />
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-bold">
          תזכורות המשפחה
          <span className="mx-auto mt-2 block h-1.5 w-12 rounded-full bg-indigo-500" />
        </h1>
        {familyExists ? <JoinForm /> : <SetupForm />}
      </div>
    </main>
  );
}
