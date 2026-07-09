import Adyen
import json
from Adyen.exceptions import AdyenError
from main.config import get_adyen_api_key, get_adyen_merchant_account, get_adyen_checkout_api_verson
from main.errors import handle_adyen_error


def adyen_payments(data):
    adyen = Adyen.Adyen()
    adyen.payment.client.xapikey = get_adyen_api_key()
    adyen.payment.client.platform = "test"  # change to live for production
    adyen.payment.client.merchant_account = get_adyen_merchant_account()
    adyen.payment.client.api_checkout_version = get_adyen_checkout_api_verson()

    request = data

    print("/payments request:\n", request)
    
    request['merchantAccount'] = get_adyen_merchant_account()


    try:
        result = adyen.checkout.payments_api.payments(request)
    except AdyenError as error:
        return handle_adyen_error("/payments", error)

    formatted_response = json.dumps((json.loads(result.raw_response)))
    print("/payments response:\n" + formatted_response)

    return formatted_response
