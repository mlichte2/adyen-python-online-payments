import Adyen
import json
import logging
from Adyen.exceptions import AdyenError
from main.config import get_adyen_api_key, get_adyen_checkout_api_verson
from main.errors import handle_adyen_error


def adyen_update_order_for_paypal_express_checkout(data):
    adyen = Adyen.Adyen()
    adyen.payment.client.xapikey = get_adyen_api_key()
    adyen.payment.client.platform = "test"  # change to live for production
    adyen.payment.client.api_checkout_version = get_adyen_checkout_api_verson()

    logging.info("/paypal/updateOrder request:\n%s", json.dumps(data, indent=2))

    try:
        result = adyen.checkout.utility_api.updates_order_for_paypal_express_checkout(data)
    except AdyenError as error:
        return handle_adyen_error("/paypal/updateOrder", error)

    parsed = json.loads(result.raw_response)
    logging.info("/paypal/updateOrder response:\n%s", json.dumps(parsed, indent=2))

    return json.dumps(parsed)
