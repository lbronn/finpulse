import uuid
from django.db import models


class UserProfile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    display_name = models.CharField(max_length=100)
    currency = models.CharField(max_length=3, default='PHP')
    monthly_budget_goal = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'user_profiles'

    def __str__(self) -> str:
        return self.display_name


class OnboardingProgress(models.Model):
    user_id = models.UUIDField(primary_key=True)
    step = models.CharField(max_length=30, default='welcome')
    completed_at = models.DateTimeField(null=True, blank=True)
    skipped = models.BooleanField(default=False)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'onboarding_progress'
