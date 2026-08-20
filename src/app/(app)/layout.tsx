import { getDefaultUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Uso pessoal: sem login — o app sempre abre direto no painel
  const user = await getDefaultUser();

  return (
    <AppShell user={{ name: user.name, email: user.email }}>{children}</AppShell>
  );
}
