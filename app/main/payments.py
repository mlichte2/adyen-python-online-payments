import Adyen
import json
import logging
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
    request['merchantAccount'] = get_adyen_merchant_account()

    logging.info("/payments request:\n%s", json.dumps(request, indent=2))

    try:
        result = adyen.checkout.payments_api.payments(request)
    except AdyenError as error:
        return handle_adyen_error("/payments", error)

    parsed = json.loads(result.raw_response)
    logging.info("/payments response:\n%s", json.dumps(parsed, indent=2))

    return json.dumps(parsed)
