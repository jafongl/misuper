# Mi Súper

Gastos del supermercado por ítem, con lectura de recibos por foto (Claude).

## Desplegar en Vercel
1. Sube esta carpeta a un repo de GitHub e impórtalo en Vercel (o corre `npx vercel` dentro de la carpeta).
2. En Vercel → Settings → Environment Variables agrega:
   - `ANTHROPIC_API_KEY`: tu clave de https://console.anthropic.com
   - `APP_CODE`: una contraseña larga que inventes (protege tu API de uso ajeno)
   - `MODEL` (opcional): por defecto `claude-sonnet-5`
3. Redeploy. Abre la URL en Safari, ingresa el `APP_CODE` la primera vez y listo.
4. iPhone: Compartir → Añadir a pantalla de inicio (evita que Safari borre los datos).

Los datos se guardan en el navegador del dispositivo; usa "Guardar respaldo (JSON)" en Historial de vez en cuando.
