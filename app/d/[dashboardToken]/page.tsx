import DashboardScreen from "./DashboardScreen";

export const dynamic = "force-dynamic";

export default async function KioskPage({
  params,
}: {
  params: Promise<{ dashboardToken: string }>;
}) {
  const { dashboardToken } = await params;
  return <DashboardScreen dashboardToken={dashboardToken} />;
}
