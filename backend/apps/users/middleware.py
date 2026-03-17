import jwt
from jwt import PyJWKClient
from django.conf import settings
from django.http import JsonResponse

# Module-level cache — initialized once on first request, reused thereafter.
# PyJWKClient fetches the public key set from Supabase's JWKS endpoint and
# caches it for `lifespan` seconds before re-fetching.
_jwks_client: PyJWKClient | None = None


def _get_jwks_client() -> PyJWKClient:
    global _jwks_client
    if _jwks_client is None:
        jwks_url = f"{settings.SUPABASE_URL}/auth/v1/.well-known/jwks.json"
        _jwks_client = PyJWKClient(jwks_url, cache_jwk_set=True, lifespan=3600)
    return _jwks_client


class SupabaseAuthMiddleware:
    """
    Validates Supabase JWT tokens on all /api/ requests.
    Supports both RS256 (current Supabase default) and HS256 (legacy projects).
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
                client = _get_jwks_client()
                signing_key = client.get_signing_key_from_jwt(token)
                payload = jwt.decode(
                    token,
                    signing_key,
                    algorithms=['ES256', 'RS256', 'HS256'],
                    audience='authenticated',
                )
                request.user_id = payload['sub']
            except jwt.ExpiredSignatureError:
                return JsonResponse({'error': 'Token expired'}, status=401)
            except jwt.InvalidTokenError as e:
                return JsonResponse({
                    'error': f'Invalid token: {str(e)}',
                    'detail': type(e).__name__,
                }, status=401)
            except Exception as e:
                return JsonResponse({
                    'error': f'Auth error: {str(e)}',
                    'detail': type(e).__name__,
                }, status=401)

        return self.get_response(request)
