from django.urls import path

from . import views

urlpatterns = [
    path('expenses', views.analyze_expenses),
    path('recommendations', views.budget_recommendations),
    path('history', views.analysis_history_list),
    path('token-usage', views.token_usage_summary),
]
