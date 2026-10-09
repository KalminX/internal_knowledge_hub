import { seedDemoDatabase } from '../src/lib/seed';

async function main() {
  try {
    await seedDemoDatabase();
    console.log('🎉 Seeding successfully finished.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seeding failed:', err);
    process.exit(1);
  }
}

main();
