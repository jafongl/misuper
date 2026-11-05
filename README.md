# Mi Súper

Gastos del supermercado por ítem, con lectura de recibos por foto.

## Desplegar gratis (Vercel Hobby + Gemini)

1. Crea una clave gratis en https://aistudio.google.com/apikey (sin tarjeta).
2. Sube esta carpeta a un repo de GitHub e impórtalo en Vercel (o corre `npx vercel` dentro de la carpeta).
3. En Vercel → Settings → Environment Variables agrega:

| Variable | Obligatoria | Para qué |
|---|---|---|
| `GEMINI_API_KEY` | sí (o `ANTHROPIC_API_KEY`) | Leer recibos con IA. |
| `APP_CODE` | sí | Contraseña larga que inventes. Protege tu clave de uso ajeno. |
| `GEMINI_MODEL` | opcional | Por defecto `gemini-flash-latest`. Si llegas al límite diario, prueba un modelo "Flash-Lite" de la lista de AI Studio. |
| `ANTHROPIC_API_KEY` | opcional | Alternativa de pago a Gemini. |
| `MODEL` | opcional | Modelo de Claude (si usas Anthropic). |
| `PROVIDER` | opcional | `gemini` o `anthropic`. Si defines ambas claves, fuerza el proveedor. |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | opcional | Sincronizar entre dispositivos. También acepta `KV_REST_API_URL` / `KV_REST_API_TOKEN`. |
| `TELEGRAM_BOT_TOKEN` | opcional | Notificación por Telegram al guardar. |
| `TELEGRAM_CHAT_ID` | opcional | Chat donde llega la notificación. |

4. Redeploy. Abre la URL en Safari, ingresa el `APP_CODE` la primera vez y listo.
5. iPhone: Compartir → Añadir a pantalla de inicio (evita que Safari borre los datos).

## Sin sincronizar

La app funciona 100% sin `APP_CODE`: todo se guarda en `localStorage` del navegador. El código solo sirve para sincronizar entre dispositivos vía Redis. Sin `UPSTASH_REDIS_REST_URL/TOKEN`, la sincronización se desactiva y la app muestra "Solo local".

## Alternativa de pago (Claude)

En vez de `GEMINI_API_KEY`, define `ANTHROPIC_API_KEY` (y opcionalmente `MODEL`). Si defines ambas, usa `PROVIDER=gemini` o `PROVIDER=anthropic`.

## Respaldos

Los datos se guardan en el navegador del dispositivo. Usa **Historial → Guardar respaldo (JSON)** de vez en cuando. También puedes exportar a CSV para Excel.