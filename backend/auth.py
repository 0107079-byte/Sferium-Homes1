import os
import logging
import json
import urllib.request
import urllib.parse
from fastapi import APIRouter, Query, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse
from backend.config import settings

logger = logging.getLogger("sferium.auth")
router = APIRouter(prefix="/api/auth", tags=["auth"])

def get_env_var(key: str, fallback: str = "") -> str:
    """Retrieve environment variable from OS env or config settings."""
    val = os.getenv(key)
    if val and val.strip():
        return val.strip()
    if fallback and fallback.strip():
        return fallback.strip()
    return ""

def exchange_vk_code(code: str, redirect_uri: str, client_id: str, client_secret: str) -> dict:
    """Exchange authorization code for VK access token."""
    url = "https://oauth.vk.com/access_token"
    params = {
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "code": code
    }
    query_str = urllib.parse.urlencode(params)
    full_url = f"{url}?{query_str}"
    
    req = urllib.request.Request(
        full_url,
        headers={"User-Agent": "SferiumHomes/1.0"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            res_data = response.read().decode("utf-8")
            return json.loads(res_data)
    except Exception as e:
        logger.error(f"Error during VK code exchange: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to exchange code: {str(e)}")

def get_vk_redirect_uri(custom_uri: str | None = None) -> str:
    """Determine VK OAuth redirect URI."""
    env_redirect = os.getenv("VK_REDIRECT_URI") or settings.vk_redirect_uri
    if custom_uri and custom_uri.strip():
        return custom_uri.strip()
    if env_redirect and env_redirect.strip():
        return env_redirect.strip()
    base_url = (os.getenv("APP_URL") or settings.app_url or "http://localhost:3000").rstrip("/")
    return f"{base_url}/api/auth/vk/callback"


@router.get("/vk/login")
@router.get("/url/vk")
async def vk_login(redirect_uri: str | None = Query(None)):
    """Returns the VK OAuth 2.0 authorization URL."""
    vk_client_id = get_env_var("VK_CLIENT_ID", settings.vk_client_id)
    if not vk_client_id:
        raise HTTPException(status_code=400, detail="Ключи не настроены")

    final_redirect_uri = get_vk_redirect_uri(redirect_uri)
    params = {
        "client_id": vk_client_id,
        "redirect_uri": final_redirect_uri,
        "response_type": "code",
        "scope": "video,offline",
        "v": "5.131"
    }
    auth_url = f"https://oauth.vk.com/authorize?{urllib.parse.urlencode(params)}"
    return {"url": auth_url, "redirect_uri": final_redirect_uri}


@router.get("/vk/callback", response_class=HTMLResponse)
async def vk_callback(
    code: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    redirect_uri: str | None = Query(None)
):
    """Callback route that exchanges VK auth code for access token and sends message to parent window."""
    vk_client_id = get_env_var("VK_CLIENT_ID", settings.vk_client_id)
    vk_client_secret = get_env_var("VK_CLIENT_SECRET", settings.vk_client_secret)

    if not vk_client_id or not vk_client_secret:
        return render_callback_html("vk", None, "Ключи не настроены")

    if error or not code:
        err_msg = error_description or error or "Код авторизации не получен"
        return render_callback_html("vk", None, err_msg)

    final_redirect_uri = get_vk_redirect_uri(redirect_uri)

    try:
        token_data = exchange_vk_code(code, final_redirect_uri, vk_client_id, vk_client_secret)
        access_token = token_data.get("access_token")

        if not access_token:
            err_msg = token_data.get("error_description") or token_data.get("error") or "Токен доступа отсутствует в ответе VK"
            return render_callback_html("vk", None, err_msg)

        return render_callback_html("vk", access_token, None, token_data)
    except Exception as e:
        return render_callback_html("vk", None, str(e))


@router.get("/vk/token")
async def vk_token(code: str = Query(...), redirect_uri: str | None = Query(None)):
    """Exchanges code for VK token directly via JSON endpoint if requested."""
    vk_client_id = get_env_var("VK_CLIENT_ID", settings.vk_client_id)
    vk_client_secret = get_env_var("VK_CLIENT_SECRET", settings.vk_client_secret)

    if not vk_client_id or not vk_client_secret:
        raise HTTPException(status_code=400, detail="Ключи не настроены")

    final_redirect_uri = get_vk_redirect_uri(redirect_uri)
    token_data = exchange_vk_code(code, final_redirect_uri, vk_client_id, vk_client_secret)
    return token_data


@router.get("/url/{provider}")
async def get_auth_url(provider: str, redirect_uri: str | None = Query(None)):
    """Generic endpoint to retrieve OAuth authorization URL for various providers."""
    p = provider.lower()
    if p == "vk":
        return await vk_login(redirect_uri)
    elif p == "google":
        google_client_id = get_env_var("GOOGLE_CLIENT_ID", settings.google_client_id)
        if not google_client_id:
            raise HTTPException(status_code=400, detail="Ключи не настроены")
        base_url = (os.getenv("APP_URL") or settings.app_url or "http://localhost:3000").rstrip("/")
        redirect = redirect_uri or os.getenv("GOOGLE_REDIRECT_URI") or f"{base_url}/api/auth/google/callback"
        params = {
            "client_id": google_client_id,
            "redirect_uri": redirect,
            "response_type": "code",
            "scope": "https://www.googleapis.com/auth/youtube.readonly",
            "access_type": "offline",
            "prompt": "consent"
        }
        return {"url": f"https://accounts.google.com/o/oauth2/v2/auth?{urllib.parse.urlencode(params)}"}
    else:
        raise HTTPException(status_code=400, detail=f"Unsupported provider: {provider}")


def render_callback_html(provider: str, token: str | None, error: str | None, full_data: dict | None = None) -> str:
    """HTML popup response with postMessage notification for parent window."""
    if error:
        payload = json.dumps({"type": "OAUTH_AUTH_FAILURE", "provider": provider, "error": error})
        message_element = f"<div style='color: #ef4444; font-size: 16px; margin-top: 10px;'>Ошибка авторизации: {error}</div>"
    else:
        payload = json.dumps({
            "type": "OAUTH_AUTH_SUCCESS",
            "provider": provider,
            "token": token,
            "user_id": full_data.get("user_id") if full_data else None,
            "email": full_data.get("email") if full_data else None
        })
        message_element = "<div style='color: #10b981; font-size: 16px; margin-top: 10px;'>Авторизация прошла успешно! Это окно закроется...</div>"

    return f"""
    <!DOCTYPE html>
    <html lang="ru">
    <head>
        <meta charset="UTF-8">
        <title>Sferium Homes - OAuth</title>
        <style>
            body {{
                background-color: #09090b;
                color: #f4f4f5;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 100vh;
                margin: 0;
                text-align: center;
                padding: 24px;
            }}
            .spinner {{
                border: 4px solid #27272a;
                border-top: 4px solid #6366f1;
                border-radius: 50%;
                width: 44px;
                height: 44px;
                animation: spin 0.8s linear infinite;
            }}
            @keyframes spin {{
                0% {{ transform: rotate(0deg); }}
                100% {{ transform: rotate(360deg); }}
            }}
        </style>
    </head>
    <body>
        <div class="spinner"></div>
        {message_element}
        <script>
            (function() {{
                const payload = {payload};
                try {{
                    if (window.opener) {{
                        window.opener.postMessage(payload, '*');
                        setTimeout(function() {{
                            window.close();
                        }}, 1200);
                    }} else {{
                        document.body.innerHTML += "<p style='color: #a1a1aa; margin-top: 16px;'>Окно авторизации можно закрыть.</p>";
                    }}
                }} catch (e) {{
                    console.error("postMessage error:", e);
                }}
            }})();
        </script>
    </body>
    </html>
    """
