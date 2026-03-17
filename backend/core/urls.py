from django.urls import path, include

urlpatterns = [
    path('api/budgets/', include('apps.budgets.urls')),
    path('api/expenses/', include('apps.expenses.urls')),
]
