from django.core.management.base import BaseCommand
from hub.services.seed import seed_demo_database


class Command(BaseCommand):
    help = "Seeds the database with demo organization, users, and realistic SOP documents."

    def handle(self, *args, **options):
        seed_demo_database()
        self.stdout.write(self.style.SUCCESS("🎉 Successfully seeded Django database."))
