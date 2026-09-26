# Maps place providers

Maps and the Assistant's place search always use OpenStreetMap. Five optional providers add
businesses OpenStreetMap is missing. Each one is used only when its key is set on the API
server, and all of them are asked at the same time. Answers are merged so each place appears
once. A place that several providers list is ranked as if it were closer, the Maps place panel
shows **Listed by** with every provider that knows it, and the Assistant is told which providers
confirm it.

| Provider | Variable | Free allowance (checked September 2026) | Card needed |
| :--- | :--- | :--- | :--- |
| TomTom Search | `TOMTOM_API_KEY` | 2,500 requests a month | No |
| Foursquare Places | `FOURSQUARE_API_KEY` | 10,000 calls a month (standard fields) | No |
| HERE Discover | `HERE_API_KEY` | About 30,000 a month on the Base plan; confirm in your HERE account | Possibly |
| Mapbox Search Box | `MAPBOX_ACCESS_TOKEN` | 50,000 requests a month (introductory pricing) | Possibly |
| Google Places (Text Search) | `GOOGLE_PLACES_API_KEY` | 5,000 calls a month on the Pro tier | Yes (billing account) |

Google usually knows the most Lagos businesses, so it is worth the card. Toolbox only asks
Google for name, address, position and type, which keeps every call in the Pro tier; phone
numbers, websites and opening hours come from the other providers or OpenStreetMap.

Geoapify and LocationIQ were left out on purpose: both are built on OpenStreetMap data, so they
add no places Toolbox does not already search.

If a provider answers with a key or quota error (401, 403 or 429), it sits out for an hour and
the search carries on with the others. Autocomplete stays on OpenStreetMap so typing does not
use up the allowances; only nearby searches (chips, "nearest X", Assistant place questions and
"X at Y" directions) ask the extra providers. Results are cached for 30 minutes.

## Getting the keys

You do not need all five. Any one of them helps; more providers means fewer gaps.

**TomTom**
1. Go to https://developer.tomtom.com and choose **Register**. Confirm your email.
2. Open the **Dashboard**. A key named "My first API key" is already there. Copy it.

**Foursquare**
1. Go to https://foursquare.com/developers and choose **Sign up**.
2. Create a project (any name).
3. In the project, open **Settings**, then **Service API Keys**, and choose **Generate API key**.
   Copy it straight away; it is shown once.

**HERE**
1. Go to https://platform.here.com and sign up (choose the free Base plan).
2. Open **Access Manager**, create an app, then under **Credentials** choose **API Keys** and
   **Create API key**. Copy it.

**Mapbox**
1. Go to https://account.mapbox.com and sign up.
2. On the account page, copy the **Default public token** (it starts with `pk.`).

**Google Places**
1. Go to https://console.cloud.google.com, create a project, and add a billing account when asked.
2. Open **APIs & Services**, then **Library**, search for **Places API (New)** and choose **Enable**.
3. Open **APIs & Services**, then **Credentials**, choose **Create credentials**, then **API key**.
   Copy it.
4. Recommended: edit the key, under **API restrictions** choose **Restrict key** and tick only
   **Places API (New)**. Then in **APIs & Services**, **Places API (New)**, **Quotas**, set
   "Text Search requests per day" to 160 so you stay inside the free 5,000 a month.

## Adding them to the server (Render)

1. In https://dashboard.render.com open the **toolbox-signaling** service.
2. Open **Environment** and choose **Add Environment Variable** for each key you have, using the
   variable names in the table above.
3. Choose **Save, rebuild, and deploy**.

To check it worked, tap a chip such as "Pharmacy" in Maps and open a result. **Listed by**
shows the providers that know the place.
