# TS Python x Web Integration

## Setup

- ensure [uv](https://docs.astral.sh/uv/) is installed (can be found in MSC)

- navigate, or create, the folder you'd like to install this integration
- clone repo `git clone https://github.com/mlichte2/adyen-python-online-payments.git`

- rename `example.env` to `.env` and add your env variables
- run `./setup.sh`

## Running Integration

- run `./start.sh`
- navigate to http://localhost:8080
- test away!

## Project Structure

- `app/app.py` contains all the server-side logic for routing ie URL endpoints
  - there are also some API calls made in this file, namely `paypal/updateOrder` and the `/handleShopperRedirect` route handles and send the `/payments/details` call
- `app/main` contains most server-side requests | `paymentMethods`, `payments`, `payments/details`, `sessions`

- `static` folder contains alls static assests loaded on the client-side (ie HTML, JS, CSS)
- component code exists in `static/js/advanced` or `static/js/sessions` depending on flow

- most components are in v6 at the time of writing this

## Changing Request Parameters

- [sessions](https://docs.adyen.com/online-payments/build-your-integration/?platform=Web&integration=Drop-in#sessions-flow-a-single-api-request) flow
  -- `app/main/sessions.py` has the full JSON sent in the `sessions` call in the `request` variable

- [advanced](https://docs.adyen.com/online-payments/build-your-integration/?platform=Web&integration=Drop-in#advanced-flow-three-api-requests) flow
  - the JSON sent in the `/paymentMethods` and `/payments` call can be found and edited in `app/static/js/advanced/_requestInfo.js` file
    - `paymentMethodsData` contains the `/paymentMethods` JSON
    - `paymentsData` inherits all the values in `paymentMethodsData` and contains the `/payments` JSON

## Changing Web Version

- Edit the WEB_VERSION parameter in `app/app.py` to your perfered web version. Currently only setup for v6 integrations -- v5 integrations must be edited in the html file (ie paypalv5.html).

## Changing API Version

- Can be set in .env file by changing the `CHECKOUT_API_VERSION` variable. This may require restarting the server (to close "ctrl + c" | to start run "./start.sh") to load the new variable.

## How to Add Components

- create a file in both `app/templates/components/{flow}` and `app/static/js/{flow}` with flow being either advanced or sessions
- i typically copy the html from an existing file (ie card.html) and edit line 37 to import the newly created js file in the script tag
- go to `app/templates/home.html` and create a new list item for the new integration
  - be sure to put it under the correct integration type h1 (sessions or advanced) and change the integration parameter to be equal to html filename without .html (ie if the new js file is `newPaymentMethod.html` pass `integration="newPaymentMethod"`)

## Drop-in Demo

At `app/static/js/advanced/dropinDemo.js` you will find a file for the purposes of creating the Drop-in with the Advanced flow.

The only thing that needs to be edited is the .js file, the backend is already setup, and you just need to connect the two.

Follow the instructions outlined in Adyen's documentation [here](https://docs.adyen.com/online-payments/build-your-integration/advanced-flow/?platform=Web&integration=Drop-in&version=6.6.0).
