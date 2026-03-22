"""
Management command: generate_digests

Summary: Generates weekly spending digests for all active users.
Run manually with: python manage.py generate_digests
Schedule on Railway: cron job running this command every Sunday at 8 PM UTC.

Output:
    Prints count of generated digests to stdout.
"""
from django.core.management.base import BaseCommand

from services.weekly_digest import generate_all_digests


class Command(BaseCommand):
    help = 'Generate weekly spending digests for all active users'

    def handle(self, *args, **options):
        count = generate_all_digests()
        self.stdout.write(self.style.SUCCESS(f'Generated {count} digests'))
