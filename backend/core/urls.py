from django.urls import include, path

urlpatterns = [
    path('api/budgets/', include('apps.budgets.urls')),
    path('api/expenses/', include('apps.expenses.urls')),
    path('api/analysis/', include('apps.analysis.urls')),
]
