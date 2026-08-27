import { getMemberByToken } from "@/lib/auth";
import ChoresManagement from "./ChoresManagement";
import InvalidLink from "../InvalidLink";

export const dynamic = "force-dynamic";

export default async function ChoresPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const member = await getMemberByToken(token);

  if (!member) {
    return <InvalidLink />;
  }

  return <ChoresManagement token={token} />;
}
