import uuid
from django.db import models
from apps.expenses.models import Category


class BudgetGoal(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4)
    user_id = models.UUIDField()
    category = models.ForeignKey(Category, on_delete=models.DO_NOTHING, db_column='category_id')
    amount = models.DecimalField(max_digits=12, decimal_places=2)
    month = models.DateField()
    created_at = models.DateTimeField()
    updated_at = models.DateTimeField()

    class Meta:
        managed = False
        db_table = 'budget_goals'
        unique_together = [('user_id', 'category', 'month')]

    def __str__(self) -> str:
        return f'{self.category} — {self.month}'
