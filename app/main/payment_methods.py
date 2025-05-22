import Adyen
import json
import uuid
from main.config import get_adyen_api_key, get_adyen_merchant_account


def adyen_payment_methods(data):
    adyen = Adyen.Adyen()
    adyen.payment.client.xapikey = get_adyen_api_key()
    adyen.payment.client.platform = "test"  # change to live for production
    adyen.payment.client.merchant_account = get_adyen_merchant_account()

    request = data
    request['merchantAccount'] = get_adyen_merchant_account()

    print("/paymentMethods request:\n" + str(request))

    result = adyen.checkout.payments_api.payment_methods(request)

    formatted_response = json.dumps((json.loads(result.raw_response)))
    print("/paymentMethods response:\n" + formatted_response)

    return formatted_response
