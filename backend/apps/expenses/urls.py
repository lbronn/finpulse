from django.urls import path

from . import views

app_name = 'expenses'

urlpatterns = [
    path('trends', views.expense_trends),
    path('breakdown', views.expense_breakdown),
    path('parse', views.parse_expense),
    path('categorize', views.categorize_expense),
    path('confirm-category', views.confirm_categorization),
]
