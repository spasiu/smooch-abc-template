# Smooch ABC preconfigured templates

Use specific phrases sent by agents to users to trigger preconfigured Apple Business Chat messages.

## Environment variables

```
SMOOCH_APP_KEY_ID=<your_smooch_app_key_id>
SMOOCH_APP_KEY_SECRET=<your_smooch_app_key_secret>
APPLE_BASE_URL=https://<your_abc_subdomain>.push.apple.com/v1
APPLE_API_SECRET=<your_abc_api_secret>
APPLE_BUSINESS_ID=<your_abc_business_id>
APPLE_CSP_ID=<your_abc_csp_id>
PORT=8000
```

## Run locally

1. `npm install`
2. create a _.env_ file and fill in your environment variables
3. `npm start`
4. expose port 8000 using a service like ngrok.io
5. create a Smooch webhook with a `message:appMaker` trigger pointing at _/smooch-event_
6. configure triggers and payload templates in the config folder

## Configuration

Place Business Chat interactiveData JSON payloads in _config > templates_ (see pre-made examples for guidance, or refer to the Business Chat [documentation](https://developer.apple.com/library/content/documentation/General/Conceptual/MessagesIntegration/SendingLargeInteractiveDataPayloads.html#//apple_ref/doc/uid/TP40017634-CH25-SW1)).

If the payload includes images, include them in _config > images_. Images must be kept below 20KB.

In your interactiveData JSON payload in the _templates_ folder, replace each image data field with the filename of the corresponding image in the _images_ folder. like so:
```json
...
"images": [
  {
    "identifier": "color-preview",
    "data": "color_preview.jpeg"
  },
  {
    "identifier": "color-reply",
    "data": "reply_icon.png"
  },
  {
    "identifier": "color-warm",
    "data": "color_warm.jpeg"
  },
  {
    "identifier": "color-cool",
    "data": "color_cool.jpeg"
  },
  {
    "identifier": "color-neutral",
    "data": "color_neutral.jpeg"
  },
  {
    "identifier": "color-unsure",
    "data": "unsure_icon.png"
  }
],
...
```

At runtime, JSON payloads will be constructed out of the images and templates provided.
