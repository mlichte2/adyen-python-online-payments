import Adyen
import json
from main.config import get_adyen_api_key, get_adyen_merchant_account


def adyen_payments(data):
    adyen = Adyen.Adyen()
    adyen.payment.client.xapikey = get_adyen_api_key()
    adyen.payment.client.platform = "test"  # change to live for production
    adyen.payment.client.merchant_account = get_adyen_merchant_account()

    request = data

    print("/payments request:\n", request)
    
    request['merchantAccount'] = get_adyen_merchant_account()


    result = adyen.checkout.payments_api.payments(request)

    formatted_response = json.dumps((json.loads(result.raw_response)))
    print("/payments response:\n" + formatted_response)

    return formatted_response
