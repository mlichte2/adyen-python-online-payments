import Adyen
import json
from main.config import get_adyen_api_key, get_adyen_merchant_account


def adyen_payments_details(data):
    adyen = Adyen.Adyen()
    adyen.payment.client.xapikey = get_adyen_api_key()
    adyen.payment.client.platform = "test"  # change to live for production
    adyen.payment.client.merchant_account = get_adyen_merchant_account()

    request = data

    print("/paymentsDetails request:\n" + str(data))

    result = adyen.checkout.payments_api.payments_details(request)

    formatted_response = json.dumps((json.loads(result.raw_response)))
    print("/paymentsDetails response:\n" + formatted_response)

    return formatted_response
