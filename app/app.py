import logging
import os

import Adyen
from Adyen.util import is_valid_hmac_notification
from flask import Flask, render_template, send_from_directory, request, Response
import json
import requests



from main.sessions import adyen_sessions
from main.payment_methods import adyen_payment_methods
from main.payments import adyen_payments
from main.payments_details import adyen_payments_details
from main.errors import handle_adyen_error
from main.config import *


WEB_VERSION = "6.41.0"


def create_app():
    logging.basicConfig(format='%(asctime)s - %(levelname)s - %(message)s', level=logging.INFO)
    logging.getLogger('werkzeug').setLevel(logging.ERROR)

    app = Flask('app')

    @app.template_filter('pretty_json')
    def pretty_json_filter(value):
        if value is None:
            return ''
        return json.dumps(value, indent=2, sort_keys=True)

    # Register 404 handler
    app.register_error_handler(404, page_not_found)

    # Routes:
    @app.route('/')
    def home():
        return render_template('home.html')

    # Display shopping cart
    @app.route('/cart/<flow>/<integration>')
    def cart(integration, flow):
        return render_template('cart.html', method=integration, flow=flow)

    # Display page with component
    @app.route('/checkout/<flow>/<integration>')
    def dropin(integration, flow):
        return render_template('components/'+ flow + '/' + integration + '.html', method=integration, client_key=get_adyen_client_key(), web_version=WEB_VERSION)

    # Component configuration explorer (reads the generated config catalog)
    @app.route('/config-explorer')
    def config_explorer_index():
        catalog = _load_config_catalog()
        comps = (catalog or {}).get('components', {})
        components = [
            {'name': name,
             'count': sum(1 for p in comps[name]['props'] if p.get('category') == 'merchant')}
            for name in sorted(comps)
        ]
        return render_template('config-explorer-index.html',
                               components=components,
                               version=(catalog or {}).get('version'))

    @app.route('/config-explorer/<component>')
    def config_explorer(component):
        catalog = _load_config_catalog()
        components = (catalog or {}).get('components', {})
        # case-insensitive match so /config-explorer/card resolves to "Card"
        key = next((k for k in components if k.lower() == component.lower()), None)
        if key is None:
            return render_template('error.html'), 404
        comp = components[key]
        return render_template('config-explorer.html',
                               component=key,
                               version=catalog['version'],
                               extends=comp.get('extends'),
                               props=comp['props'])

    # Perform /sessions call
    @app.route('/api/sessions', methods=['POST'])
    def sessions():
            host_url = request.host_url 
            return adyen_sessions(host_url)

    @app.route('/api/paymentMethods', methods=['POST'])
    def payment_methods():
        data = request.json
        return adyen_payment_methods(data)

    @app.route('/api/payments', methods=['POST'])
    def payments():
        data = request.json
        return adyen_payments(data)

    @app.route('/api/paymentsDetails', methods=['POST'])
    def payments_details():
        data = request.json
        return adyen_payments_details(data)


    @app.route('/api/shippingMethods', methods=['POST'])
    def shipping_methods():
        # Advanced flow sends "amount"; sessions flow sends "sessionAmount".
        flow = 'advanced' if request.json.get('amount') else 'sessions'

        amount = request.json.get('sessionAmount', request.json.get('amount'))

        available_shipping_methods = [
            {
                "reference": "1",
                "description": "Express Shipping",
                "type": "Shipping",
                "amount": {
                    "currency": amount['currency'],
                    "value": 1000
                },
                "selected": "false"
            },
            {
                "reference": "2",
                "description": "Standard Ground",
                "type": "Shipping",
                "amount": {
                    "currency": amount['currency'],
                    "value": 500
                },
                "selected": "true"
            },
            {
                "reference": "3",
                "description": "Super Express Shipping",
                "type": "Shipping",
                "amount": {
                    "currency": amount['currency'],
                    "value": 1500
                },
                "selected": "false"
            }
        ]

        payment_data = request.json.get('paymentData')
        selected_shipping_method = request.json['data'].get('selectedShippingOption')

        if not selected_shipping_method:
            country_code = request.json['data']['shippingAddress']['countryCode']

            # add logic to remove shipping methods if its a certain country or state
            if country_code.upper() != "US":
                available_shipping_methods.pop(2)

        else:
            for shipping_method in available_shipping_methods:
                if shipping_method['reference'] == selected_shipping_method['id']:
                    shipping_method['selected'] = 'true'
                else:
                    shipping_method['selected'] = 'false'

        for shipping_method in available_shipping_methods:
            if shipping_method['selected'] == 'true':
                active_shipping_method = shipping_method

        if flow == 'advanced':
            update_request = {
                "pspReference": request.json['pspReference'],
                "paymentData": payment_data,
                "amount": {
                    "currency": amount['currency'],
                    "value": int(active_shipping_method['amount']['value']) + int(amount['value'])
                },
                "deliveryMethods": available_shipping_methods
            }
        else: 
            update_request = {
                "sessionId": request.json['sessionId'],
                "paymentData": payment_data,
                "amount": {
                    "currency": amount['currency'],
                    "value": int(active_shipping_method['amount']['value']) + int(amount['value'])
                },
                "deliveryMethods": available_shipping_methods
            }


        apiKey = get_adyen_api_key()
        result = requests.post(url='https://checkout-test.adyen.com/v71/paypal/updateOrder',json=update_request, headers={'X-API-KEY': apiKey})

        formatted_response = result.json()
        return formatted_response

    @app.route('/api/removePaymentMethod', methods=['POST'])
    def remove_payment_method():

        params = request.json
        
        query_parameters = {
            "merchantAccount": get_adyen_merchant_account(),
            "shopperReference": params["shopperReference"]
        }

        adyen = Adyen.Adyen()
        adyen.payment.client.xapikey = get_adyen_api_key()
        adyen.payment.client.platform = "test"  # change to live for production

        try:
            http_response = adyen.checkout.recurring_api.delete_token_for_stored_payment_details(query_parameters=query_parameters, storedPaymentMethodId=params["storedPaymentMethodId"])
            logging.info(f"DELETE storedPaymentMethods/{params['storedPaymentMethodId']} | SUCCESS")
            return Response(status=200)
        except Adyen.exceptions.AdyenError as e:
            logging.error(f"DELETE storedPaymentMethods/{params['storedPaymentMethodId']} | FAILED")
            logging.error(f"Adyen error while deleting stored payment method: {e.message}")
            logging.error(e.debug())

            return Response(status=422)

    @app.route('/api/createOrder', methods=['POST'])
    def create_order():
        params = request.json

        adyen = Adyen.Adyen()
        adyen.payment.client.xapikey = get_adyen_api_key()
        adyen.payment.client.platform = "test"  # change to live for production
        
        params["merchantAccount"] = get_adyen_merchant_account()

        try:
            result = adyen.checkout.orders_api.orders(request=params)
        except Adyen.exceptions.AdyenError as error:
            return handle_adyen_error("/orders", error)

        return result.message

    @app.route('/api/paymentMethods/balance', methods=['POST'])
    def get_balance_of_gift_card():
        params = request.json

        adyen = Adyen.Adyen()
        adyen.payment.client.xapikey = get_adyen_api_key()
        adyen.payment.client.platform = "test"  # change to live for production
        
        params["merchantAccount"] = get_adyen_merchant_account()

        try:
            result = adyen.checkout.orders_api.get_balance_of_gift_card(request=params)
        except Adyen.exceptions.AdyenError as error:
            return handle_adyen_error("/paymentMethods/balance", error)

        return result.message

    @app.route('/api/orders/cancel', methods=['POST'])
    def cancel_order():
        params = request.json

        adyen = Adyen.Adyen()
        adyen.payment.client.xapikey = get_adyen_api_key()
        adyen.payment.client.platform = "test"  # change to live for production
        
        params["merchantAccount"] = get_adyen_merchant_account()

        try:
            result = adyen.checkout.orders_api.cancel_order(request=params)
        except Adyen.exceptions.AdyenError as error:
            return handle_adyen_error("/orders/cancel", error)

        return result.message
        

    @app.route('/result/success', methods=['GET'])
    def checkout_success():
        result = _parse_result(request.args.get('paymentResult'))
        return render_template('checkout-success.html', response=result)

    @app.route('/result/failed', methods=['GET'])
    def checkout_failure():
        result = _parse_result(request.args.get('paymentResult'))
        return render_template('checkout-failed.html', response=result)

    @app.route('/result/pending', methods=['GET'])
    def checkout_pending():
        result = _parse_result(request.args.get('paymentResult'))
        return render_template('checkout-success.html', response=result)

    @app.route('/result/error', methods=['GET'])
    def checkout_error():
        result = _parse_result(request.args.get('paymentResult'))
        return render_template('checkout-failed.html', response=result)
    
    # Handle redirect during payment. This gets called during the redirect flow
    @app.route('/handleShopperRedirect', methods=['GET', 'POST'])
    def handle_shopper_redirect():
        adyen = Adyen.Adyen()
        adyen.payment.client.xapikey = get_adyen_api_key()
        adyen.payment.client.platform = "test"  # change to live for production
        adyen.payment.client.merchant_account = get_adyen_merchant_account()

        # Payload for payment/details call
        redirect_data = request.args if request.method == 'GET' else request.form

        details = {}

        if 'redirectResult' in redirect_data:
            details['redirectResult'] = redirect_data['redirectResult']
        elif 'payload' in redirect_data:
            details['payload'] = redirect_data['payload']
        else: 
            details.update(dict(redirect_data))

        try:
            http_response = adyen_payments_details({ "details": details })

            # adyen_payments_details returns a (body, status_code) tuple on an Adyen API error
            if isinstance(http_response, tuple):
                logging.error(f"/paymentsDetails redirect failed: {http_response[0]}")
                return render_template('checkout-failed.html')

            response = json.loads(http_response)

            # Display resultCode to shopper
            if response['resultCode'] == "Authorised":
                return render_template('checkout-success.html', response=response)
            elif response['resultCode'] in ["Pending", "Received"]:
                return render_template('checkout-success.html', response=response)
            elif response['resultCode'] == "Refused":
                return render_template('checkout-failed.html', response=response)
            else:
                return render_template('checkout-failed.html', response=response)
        except Exception as err:
            logging.error(f"Error: {err}, error code: {getattr(err, 'errorCode', 'N/A')}")
            return render_template('checkout-failed.html')


    # Process incoming webhook notifications
    @app.route('/api/webhooks/notifications', methods=['POST'])
    def webhook_notifications():
        """
        Receives outcome of each payment
        :return:
        """
        notifications = request.json['notificationItems']
        # fetch first( and only) NotificationRequestItem
        notification = notifications[0]

        if is_valid_hmac_notification(notification['NotificationRequestItem'], get_adyen_hmac_key()) :
            # consume event asynchronously
            consume_event(notification)
        else:
            # invalid hmac: do not send [accepted] response
            raise Exception("Invalid HMAC signature")

        return '', 202

    @app.route('/favicon.ico')
    def favicon():
        return send_from_directory(os.path.join(app.root_path, 'static'),
                                   'img/favicon.ico')

    return app


def _load_config_catalog():
    """Load the generated component config catalog for the current WEB_VERSION, if present."""
    path = os.path.join(os.path.dirname(__file__), 'config_catalog', f'{WEB_VERSION}.json')
    if not os.path.exists(path):
        return None
    with open(path) as f:
        return json.load(f)


def _parse_result(result):
    """Normalize a payment result to a dict for template rendering.
    Handles JSON strings (from URL query params set by JS) and dicts (from redirect flow)."""
    if result is None:
        return None
    if isinstance(result, dict):
        return result
    try:
        return json.loads(result)
    except (json.JSONDecodeError, TypeError):
        return {"raw": str(result)}


#  process payload asynchronously
def consume_event(notification):
    logging.info(f"consume_event merchantReference: {notification['NotificationRequestItem']['merchantReference']} "
                 f"result? {notification['NotificationRequestItem']['success']}")

    # add item to DB, queue or run in a different thread


def page_not_found(error):
    return render_template('error.html'), 404


if __name__ == '__main__':
    web_app = create_app()

    logging.info(f"Running on http://localhost:{get_port()}")
    web_app.run(debug=os.environ.get('FLASK_DEBUG', '0') == '1', port=get_port(), host='0.0.0.0')
