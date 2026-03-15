import jwt
from django.conf import settings
from django.http import JsonResponse


class SupabaseAuthMiddleware:
    """
    Validates Supabase JWT tokens on all /api/ requests.
    Sets request.user_id to the Supabase user UUID (sub claim).
    Returns 401 if token is missing or invalid.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith('/api/'):
            auth_header = request.headers.get('Authorization', '')
            if not auth_header.startswith('Bearer '):
                return JsonResponse({'error': 'No token provided'}, status=401)

            token = auth_header.removeprefix('Bearer ').strip()
            if not token:
                return JsonResponse({'error': 'No token provided'}, status=401)

            try:
                payload = jwt.decode(
                    token,
                    settings.SUPABASE_JWT_SECRET,
                    algorithms=['HS256'],
                    audience='authenticated',
                )
                request.user_id = payload['sub']  # Supabase user UUID
            except jwt.ExpiredSignatureError:
                return JsonResponse({'error': 'Token expired'}, status=401)
            except jwt.InvalidTokenError as e:
                return JsonResponse({'error': f'Invalid token: {str(e)}'}, status=401)

        return self.get_response(request)
