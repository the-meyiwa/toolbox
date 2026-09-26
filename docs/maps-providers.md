# Maps place providers

Maps and the Assistant's place search always use OpenStreetMap. Two optional providers add
businesses OpenStreetMap is missing. Each one is used only when its key is set on the API
server, and all of them are asked at the same time. Answers are merged so each place appears
once. A place that several providers list is ranked as if it were closer, and the Assistant is
told which providers confirm it.

| Provider | Variable | Free allowance (checked September 2026) |
| :--- | :--- | :--- |
| TomTom Search | `TOMTOM_API_KEY` | 2,500 requests a month, no card needed |
| Foursquare Places | `FOURSQUARE_API_KEY` | 10,000 calls a month on standard (Pro) fields |

If a provider answers with a key or quota error (401, 403 or 429), it sits out for an hour and
the search carries on with the others. Autocomplete stays on OpenStreetMap so typing does not
use up the allowances; only nearby searches (chips, "nearest X", Assistant place questions and
"X at Y" directions) ask the extra providers. Results are cached for 30 minutes.

## Getting the keys

**TomTom**
1. Go to https://developer.tomtom.com and choose **Register**. Confirm your email.
2. Open the **Dashboard**. A key named "My first API key" is already there. Copy it.

**Foursquare**
1. Go to https://foursquare.com/developers and choose **Sign up**.
2. Create a project (any name).
3. In the project, open **Settings**, then **Service API Keys**, and choose **Generate API key**.
   Copy it straight away; it is shown once.

## Adding them to the server (Render)

1. In https://dashboard.render.com open the **toolbox-signaling** service.
2. Open **Environment**, choose **Add Environment Variable**, and add `TOMTOM_API_KEY` and
   `FOURSQUARE_API_KEY` with the keys as values.
3. Choose **Save, rebuild, and deploy**.

To check it worked, search for a chip such as "Pharmacy" in Maps and open a result. The details
show **Listed by** with the providers that know the place.
