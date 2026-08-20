import { AppShell } from "@/components/app-shell";
import { seedDemoData, getSettings } from "@/lib/storage";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Uso pessoal: seed automatico na primeira execução
  seedDemoData();
  const settings = getSettings();

  return (
    <AppShell user={{ name: settings.name, email: settings.email }}>{children}</AppShell>
  );
}
