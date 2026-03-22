import uuid
from django.db import models


class AnalysisHistory(models.Model):
    ANALYSIS_TYPES = [
        ('expense_analysis', 'Expense Analysis'),
        ('budget_recommendation', 'Budget Recommendation'),
        ('weekly_digest', 'Weekly Digest'),
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


class ChatSession(models.Model):
    id = models.UUIDField(primary_key=True)
    user_id = models.UUIDField()
    title = models.CharField(max_length=200, null=True, blank=True)
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'chat_sessions'

    def __str__(self) -> str:
        return f'{self.title or "Untitled"} — {self.created_at}'


class ChatMessage(models.Model):
    id = models.UUIDField(primary_key=True)
    session_id = models.UUIDField()
    user_id = models.UUIDField()
    role = models.CharField(max_length=10)
    content = models.TextField()
    metadata = models.JSONField(default=dict)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'chat_messages'

    def __str__(self) -> str:
        return f'[{self.role}] {self.content[:50]}'
