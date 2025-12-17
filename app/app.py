import logging

import Adyen
from Adyen.util import is_valid_hmac_notification
from flask import Flask, render_template, send_from_directory, request, Response
import json
import requests



from main.sessions import adyen_sessions
from main.payment_methods import adyen_payment_methods
from main.payments import adyen_payments
from main.payments_details import adyen_payments_details
from main.config import *


WEB_VERSION = "6.27.0"


def create_app():
    logging.basicConfig(format='%(asctime)s - %(levelname)s - %(message)s', level=logging.INFO)
    logging.getLogger('werkzeug').setLevel(logging.ERROR)

    app = Flask('app')

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

    # Perform /sessions call
    @app.route('/api/sessions', methods=['POST'])
    def sessions():
            host_url = request.host_url 
            return adyen_sessions(host_url)

    @app.route('/api/paymentMethods', methods=['POST'])
    def payment_methods():
        
        data = request.json
        print(data)
        return adyen_payment_methods(data)

    @app.route('/api/payments', methods=['POST'])
    def payments():
        
        data = request.json
        print(data)
        return adyen_payments(data)

    @app.route('/api/paymentsDetails', methods=['POST'])
    def payments_details():
        
        data = request.json
        print(data)
        return adyen_payments_details(data)


    @app.route('/api/shippingMethods', methods=['POST'])
    def shipping_methods():    

        print(request.json)

        if request.json['amount']:
            flow = 'advanced'

        amount = request.json.get('sessionAmount', request.json.get('amount'))

        print(amount)

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
            if country_code.lower() is not "US".lower():
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

        
        print("update/paypalOrder request:\n", update_request)

        apiKey = get_adyen_api_key()
        result = requests.post(url='https://checkout-test.adyen.com/v71/paypal/updateOrder',json=update_request, headers={'X-API-KEY': apiKey})
        
        print(result)
        formatted_response = result.json()
        print("update/paypalOrder response:\n", formatted_response)

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
            print(http_response)

            print(f"\nDELETE storedPaymentMethods/{params['storedPaymentMethodId']} | SUCCESS")

            return Response(status=200)
        except:
            print(f"\nDELETE storedPaymentMethods/{params['storedPaymentMethodId']} | FAILED")

            return Response(status=422)

    @app.route('/api/createOrder', methods=['POST'])
    def create_order():
        params = request.json

        adyen = Adyen.Adyen()
        adyen.payment.client.xapikey = get_adyen_api_key()
        adyen.payment.client.platform = "test"  # change to live for production
        
        params["merchantAccount"] = get_adyen_merchant_account()

        result = adyen.checkout.orders_api.orders(request=params)

        return result.message

    @app.route('/api/paymentMethods/balance', methods=['POST'])
    def get_balance_of_gift_card():
        params = request.json

        adyen = Adyen.Adyen()
        adyen.payment.client.xapikey = get_adyen_api_key()
        adyen.payment.client.platform = "test"  # change to live for production
        
        params["merchantAccount"] = get_adyen_merchant_account()

        result = adyen.checkout.orders_api.get_balance_of_gift_card(request=params)

        return result.message

    @app.route('/api/orders/cancel', methods=['POST'])
    def cancel_order():
        params = request.json

        adyen = Adyen.Adyen()
        adyen.payment.client.xapikey = get_adyen_api_key()
        adyen.payment.client.platform = "test"  # change to live for production
        
        params["merchantAccount"] = get_adyen_merchant_account()

        result = adyen.checkout.orders_api.cancel_order(request=params)

        return result.message
        

    @app.route('/result/success', methods=['GET'])
    def checkout_success():
        result = request.args.get('paymentResult')
        return render_template('checkout-success.html', response=result)

    @app.route('/result/failed', methods=['GET'])
    def checkout_failure():
        result = request.args.get('paymentResult')
        return render_template('checkout-failed.html', response=result)

    @app.route('/result/pending', methods=['GET'])
    def checkout_pending():
        result = request.args.get('paymentResult')
        return render_template('checkout-success.html', response=result)

    @app.route('/result/error', methods=['GET'])
    def checkout_error():
        result = request.args.get('paymentResult')
        return render_template('checkout-failed.html', response=result)
    
    # Handle redirect during payment. This gets called during the redirect flow
    @app.route('/handleShopperRedirect', methods=['GET', 'POST'])
    def handle_shopper_redirect():
        print("/handleShopperRedirect")

        print(request.method)

        adyen = Adyen.Adyen()
        adyen.payment.client.xapikey = get_adyen_api_key()
        adyen.payment.client.platform = "test"  # change to live for production
        adyen.payment.client.merchant_account = get_adyen_merchant_account()

        # Payload for payment/details call
        redirect_data = request.args if request.method == 'GET' else request.form

        print(request.method)
        print(redirect_data)
        
        details = {}

        if 'redirectResult' in redirect_data:
            details['redirectResult'] = redirect_data['redirectResult']
        elif 'payload' in redirect_data:
            details['payload'] = redirect_data['payload']
        else: 
            details.update(dict(redirect_data))

        try:
            http_response = adyen_payments_details({ "details": details })

            response = json.loads(http_response)
            print("/paymentDetails response:\n" + str(response))

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


#  process payload asynchronously
def consume_event(notification):
    print(f"consume_event merchantReference: {notification['NotificationRequestItem']['merchantReference']} "
          f"result? {notification['NotificationRequestItem']['success']}")

    # add item to DB, queue or run in a different thread


def page_not_found(error):
    return render_template('error.html'), 404


if __name__ == '__main__':
    web_app = create_app()

    logging.info(f"Running on http://localhost:{get_port()}")
    web_app.run(debug=True, port=get_port(), host='0.0.0.0')
