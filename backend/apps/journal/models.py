import uuid
from django.contrib.postgres.fields import ArrayField
from django.db import models


class JournalEntry(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    title = models.CharField(max_length=200)
    content = models.TextField()
    tags = ArrayField(models.CharField(max_length=50), default=list, blank=True)
    entry_date = models.DateField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'journal_entries'

    def __str__(self) -> str:
        return self.title
