from django.urls import path

from . import views

urlpatterns = [
    path('expenses', views.analyze_expenses),
    path('recommendations', views.budget_recommendations),
    path('history', views.analysis_history_list),
    path('token-usage', views.token_usage_summary),
    path('chat', views.chat_message),
    path('chat/sessions', views.chat_sessions_list),
    path('chat/sessions/<uuid:session_id>/messages', views.chat_session_messages),
    path('digest/latest', views.latest_digest),
]
