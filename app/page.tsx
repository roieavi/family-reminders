import { supabaseAdmin } from "@/lib/supabase";
import SetupForm from "./SetupForm";
import JoinForm from "./JoinForm";
import AutoRedirect from "./AutoRedirect";
import SplashScreen from "./SplashScreen";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { count } = await supabaseAdmin
    .from("families")
    .select("id", { count: "exact", head: true });

  const familyExists = Boolean(count && count > 0);

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <SplashScreen />
      <AutoRedirect />
      <div className="w-full max-w-sm">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo-full-color.png"
          alt="תזכיר לי - מישהו צריך לזכור את זה"
          className="mx-auto mb-8 w-40"
        />
        {familyExists ? <JoinForm /> : <SetupForm />}
      </div>
    </main>
  );
}
