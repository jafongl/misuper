# Mi Súper

Gastos del supermercado por ítem, con lectura de recibos por foto.

## Desplegar gratis (Vercel Hobby + Gemini)
1. Crea una clave gratis en https://aistudio.google.com/apikey (sin tarjeta).
2. Sube esta carpeta a un repo de GitHub e impórtalo en Vercel (o corre `npx vercel` dentro de la carpeta).
3. En Vercel → Settings → Environment Variables agrega:
   - `GEMINI_API_KEY`: la clave del paso 1
   - `APP_CODE`: una contraseña larga que inventes (protege tu clave de uso ajeno)
   - `GEMINI_MODEL` (opcional): por defecto `gemini-flash-latest`. Si llegas al límite diario, prueba un modelo "Flash-Lite" de la lista de AI Studio.
4. Redeploy. Abre la URL en Safari, ingresa el `APP_CODE` la primera vez y listo.
5. iPhone: Compartir → Añadir a pantalla de inicio (evita que Safari borre los datos).

## Alternativa de pago (Claude)
En vez de `GEMINI_API_KEY`, define `ANTHROPIC_API_KEY` (y opcionalmente `MODEL`). Si defines ambas, usa `PROVIDER=gemini` o `PROVIDER=anthropic`.

Los datos se guardan en el navegador del dispositivo; usa "Guardar respaldo (JSON)" en Historial de vez en cuando.
