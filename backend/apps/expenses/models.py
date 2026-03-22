import uuid
from django.db import models


class Category(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField(null=True, blank=True)
    name = models.CharField(max_length=50)
    icon = models.CharField(max_length=30, null=True, blank=True)
    color = models.CharField(max_length=7, null=True, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'categories'

    def __str__(self) -> str:
        return self.name


class Expense(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    category = models.ForeignKey(Category, on_delete=models.DO_NOTHING, db_column='category_id')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    description = models.CharField(max_length=255)
    notes = models.TextField(null=True, blank=True)
    expense_date = models.DateField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'expenses'

    def __str__(self) -> str:
        return f'{self.description} — {self.amount}'


class CategorizationHistory(models.Model):
    id = models.UUIDField(primary_key=True)
    user_id = models.UUIDField()
    description_pattern = models.CharField(max_length=255)
    category_id = models.UUIDField()
    frequency = models.IntegerField(default=1)
    last_used_at = models.DateTimeField()
    created_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'categorization_history'
