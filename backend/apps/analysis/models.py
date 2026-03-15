import uuid
from django.db import models


class AnalysisHistory(models.Model):
    ANALYSIS_TYPES = [
        ('expense_analysis', 'Expense Analysis'),
        ('budget_recommendation', 'Budget Recommendation'),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    analysis_type = models.CharField(max_length=30, choices=ANALYSIS_TYPES)
    input_summary = models.JSONField()
    result = models.JSONField()
    model_used = models.CharField(max_length=50)
    tokens_used = models.IntegerField(null=True, blank=True)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'analysis_history'

    def __str__(self) -> str:
        return f'{self.analysis_type} — {self.created_at}'
