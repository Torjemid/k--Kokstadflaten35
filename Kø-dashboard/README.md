# Kokstad Queue Dashboard

Et veggvennlig dashboard for å overvåke kø mellom Odfjell Drilling på `Kokstadflaten 35` og krysset `Kokstadflaten x Kokstadvegen`.

## Hva dette prosjektet inneholder

- `dashboard/`: mørkt, fullskjerms dashboard i ren HTML/CSS/JS.
- `supabase/schema.sql`: tabeller og views for historikk, køepisoder og KPI-er.
- `supabase/functions/poll-kokstad-traffic/index.ts`: Edge Function som henter live trafikkdata fra Google Routes API og lagrer snapshots.

## Anbefalt løsning for å få dette raskt på nett

Den raskeste og enkleste produksjonsløsningen er:

1. `Supabase`
2. `Google Maps Platform`
3. `Vercel` eller `Cloudflare Pages`

Hvorfor:

- `Google Routes API` kan gi både live ETA (`duration`), referansetid uten live kø (`staticDuration`) og trafikksegmenter langs ruten.
- `Supabase` gir database, SQL-views, historikk og cron-jobber på ett sted.
- `Vercel` eller `Cloudflare Pages` er veldig raske for publisering av selve dashboardet.

## Viktig realitetsavklaring

For akkurat denne typen lokal kømåling er **satellittbilder alene ikke egnet** som live-datakilde. Satellittbilder er ikke sanntidsnok for å måle kø minutt for minutt. Den mest robuste løsningen er derfor:

- live trafikk fra `Google Routes API`
- eventuelt støtteinformasjon fra Statens vegvesen hvis et relevant kamera eller trafikkpunkt finnes i området
- egen historikklagring som bygger statistikk over tid

Med 5-minutters polling blir start/slutt på kø estimert med omtrent `+/- 5 minutter`. Hvis du vil ha høyere presisjon, kan intervallet senkes til 1-2 minutter, men det øker API-bruk og kostnad.

## Foreslåtte koordinater

Disse er lagt inn som utgangspunkt i Edge Function og kan finjusteres etter en test i kart:

- Start: Odfjell Drilling, `Kokstadflaten 35`
- Slutt: krysset der `Kokstadflaten` møter `Kokstadvegen`

## Oppsett

### 1. Opprett Google Maps Platform

Aktiver:

- `Routes API`
- `Maps JavaScript API` hvis du senere vil ha ekte satellittkart i dashboardet

Miljøvariabler:

- `GOOGLE_MAPS_API_KEY`

### 2. Opprett Supabase

Kjør SQL fra:

- `supabase/schema.sql`

Opprett Edge Function:

- `supabase/functions/poll-kokstad-traffic/index.ts`

Miljøvariabler i Supabase:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_API_KEY`

Planlagt jobb:

- `*/5 * * * *`

Den bør kalle Edge Function-en hvert 5. minutt.

### 3. Publiser dashboardet

Raskeste vei:

1. legg `dashboard/` på GitHub
2. koble repoet til `Vercel` eller `Cloudflare Pages`
3. pek dashboardet mot Supabase-data i stedet for sample-data

## Datamodell

Hver snapshot lagrer blant annet:

- tidspunkt
- total reisetid
- referansetid uten live-kø
- forsinkelse
- estimert kølengde
- trafikksegmenter langs ruten

Ut fra dette kan dashboardet vise:

- live kø akkurat nå
- når køen typisk starter og stopper
- toppforsinkelse per dag
- gjennomsnittlig køtid per ukedag
- hvor stor del av ruten som er `NORMAL`, `SLOW` eller `TRAFFIC_JAM`

## Neste steg

Når API-nøkler er på plass, er det naturlige neste steget å:

1. finjustere start- og sluttkoordinater
2. koble dashboardet mot live Supabase-data
3. eventuelt legge inn ekte satellittkart eller webcam-panel
