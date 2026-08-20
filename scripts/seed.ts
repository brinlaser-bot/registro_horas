import "dotenv/config";
import { seedDemoUser } from "../src/db/seed";

async function main() {
  const created = await seedDemoUser();
  console.log(
    created
      ? "✅ Usuário demo criado com dados de exemplo (demo@exemplo.com / demo123)."
      : "ℹ️  Usuário demo já existia — nada a fazer.",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Falha ao semear o banco:", err);
  process.exit(1);
});
