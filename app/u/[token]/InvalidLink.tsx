import Link from "next/link";
import ClearStoredToken from "./ClearStoredToken";

export default function InvalidLink() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-16">
      <ClearStoredToken />
      <p className="text-center text-lg">
        הלינק לא תקין. בדוק שהעתקת אותו במלואו, או בקש לינק חדש ממי שהוסיף
        אותך.
      </p>
      <Link
        href="/"
        className="rounded-lg border-2 border-black px-4 py-2 text-sm font-semibold transition hover:bg-indigo-50 dark:border-zinc-300 dark:hover:bg-zinc-700"
      >
        חזרה לעמוד הראשי
      </Link>
    </main>
  );
}
