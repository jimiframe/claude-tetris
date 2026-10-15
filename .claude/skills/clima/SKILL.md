---
name: clima
description: Obtiene el clima actual y el pronóstico de los próximos días en una localidad (por defecto Almería, España). Úsala cuando el usuario pregunte por el tiempo, la temperatura, la lluvia o el viento, indicando opcionalmente la localidad.
argument-hint: "[localidad]"
---

# Clima local

Usa la API gratuita de Open-Meteo (sin API key). La localidad se recibe como parámetro: `$ARGUMENTS`. Si está vacío, usa **Almería, España** por defecto (latitud `36.8381`, longitud `-2.4597`, zona horaria `Europe/Madrid`) y salta el paso 1.

## Pasos

1. Si se indicó una localidad, geocodifícala con Bash (sustituye `LOCALIDAD` por el nombre, codificado para URL):

```bash
curl -s "https://geocoding-api.open-meteo.com/v1/search?name=LOCALIDAD&count=1&language=es&format=json"
```

   - Toma del primer resultado: `name`, `country`, `latitude`, `longitude` y `timezone`.
   - Si `results` no existe o está vacío, díselo al usuario y pídele otro nombre (puede añadir país o región, p. ej. "Córdoba, Argentina").

2. Consulta el pronóstico con Bash, sustituyendo `LAT`, `LON` y `TZ` (zona horaria codificada, p. ej. `Europe%2FMadrid`):

```bash
curl -s "https://api.open-meteo.com/v1/forecast?latitude=LAT&longitude=LON&current=temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,wind_direction_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=TZ&forecast_days=3"
```

3. Interpreta el JSON:
   - `current`: condiciones actuales (temperatura °C, sensación térmica, humedad %, precipitación mm, viento km/h).
   - `daily`: máximas/mínimas, precipitación y viento máximo de hoy y los 2 días siguientes.
   - `weather_code` (WMO): 0 despejado, 1-3 poco nuboso/nublado, 45-48 niebla, 51-57 llovizna, 61-67 lluvia, 71-77 nieve, 80-82 chubascos, 95-99 tormenta.

4. Responde siempre en español, de forma breve:
   - Encabezado con la localidad resuelta (nombre y país).
   - Una línea con el estado actual (temperatura, sensación, cielo, viento, humedad).
   - Una línea por día con el pronóstico (máx/mín, lluvia).

## Notas

- Si `curl` falla o no hay red, díselo al usuario en lugar de inventar datos.
- Ejemplos de uso: `/clima` (Almería), `/clima Madrid`, `/clima Buenos Aires`.
