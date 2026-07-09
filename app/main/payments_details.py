import Adyen
import json
from Adyen.exceptions import AdyenError
from main.config import get_adyen_api_key, get_adyen_merchant_account, get_adyen_checkout_api_verson
from main.errors import handle_adyen_error


def adyen_payments_details(data):
    adyen = Adyen.Adyen()
    adyen.payment.client.xapikey = get_adyen_api_key()
    adyen.payment.client.platform = "test"  # change to live for production
    adyen.payment.client.merchant_account = get_adyen_merchant_account()
    adyen.payment.client.api_checkout_version = get_adyen_checkout_api_verson()

    request = data

    print("/paymentsDetails request:\n" + str(data))

    try:
        result = adyen.checkout.payments_api.payments_details(request)
    except AdyenError as error:
        return handle_adyen_error("/paymentsDetails", error)

    formatted_response = json.dumps((json.loads(result.raw_response)))
    print("/paymentsDetails response:\n" + formatted_response)

    return formatted_response
