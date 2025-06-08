import Adyen
import json
from main.config import get_adyen_api_key, get_adyen_merchant_account, get_adyen_checkout_api_verson
from dotenv import dotenv_values

'''
Create Payment Session by calling /sessions endpoint

Request must provide few mandatory attributes (amount, currency, returnUrl, transaction reference)

Your backend should have a payment state where you can fetch information like amount and shopperReference

Parameters
    ----------
    host_url : string
        URL of the host (i.e. http://localhost:8080): required to define returnUrl parameter
'''


def adyen_sessions(host_url):
    adyen = Adyen.Adyen()
    adyen.payment.client.xapikey = get_adyen_api_key()
    adyen.payment.client.platform = "test"  # change to live for production
    adyen.payment.client.merchant_account = get_adyen_merchant_account()
    adyen.payment.client.api_checkout_version = get_adyen_checkout_api_verson()

    request = {
        "splitCardFundingSources": "True",
        "merchantAccount": "ADYEN_MERCHANT_ACCOUNT",
        "shopperInteraction": "ContAuth",
        "recurringProcessingModel": "CardOnFile",
        "reference": "YOUR_ORDER_REFERENCE",
        "amount": {
            "currency": "USD",
            "value": 10000
        },
        "shopperLocale": "en_US",
        "countryCode": "US",
        "telephoneNumber": "+46 840 839 298",
        "shopperEmail": "youremail@email.com",
        "shopperName": {
            "firstName": "Testperson-se",
            "gender": "UNKNOWN",
            "lastName": "Approved"
        },
        "shopperReference": "YOUR_SHOPPER_REFERENCE",
        "billingAddress": {
            "city": "Ankeborg",
            "country": "US",
            "houseNumberOrName": "1",
            "postalCode": "12345",
            "street": "Stargatan",
            "stateOrProvince": "MN"
        },
        "deliveryAddress": {
            "city": "Ankeborg",
            "country": "US",
            "houseNumberOrName": "1",
            "postalCode": "12345",
            "street": "Stargatan",
            "stateOrProvince": "MN"
        },
        "dateOfBirth": "1996-09-04",
        "socialSecurityNumber": "0108",
        "returnUrl": f"{host_url}handleShopperRedirect?shopperOrder=myRef",
        "lineItems": [
            {
            "quantity": "1",
            "description": "Shoes",
            "id": "Item #1",
            "amountIncludingTax": "9000",
            "productUrl": "URL_TO_PURCHASED_ITEM",
            "imageUrl": "URL_TO_PICTURE_OF_PURCHASED_ITEM"
            },
            {
            "quantity": "2",
            "description": "Socks",
            "id": "Item #2",
            "amountIncludingTax": "1000",
            "productUrl": "URL_TO_PURCHASED_ITEM",
            "imageUrl": "URL_TO_PICTURE_OF_PURCHASED_ITEM"
            }
        ]
        }


    request['merchantAccount'] = get_adyen_merchant_account()

    result = adyen.checkout.payments_api.sessions(request)

    formatted_response = json.dumps((json.loads(result.raw_response)))
    print("/sessions response:\n" + formatted_response)

    return formatted_response
