// below is the data sent in the /paymentMethods call

const paymentMethodsData = {
    amount: {
        value: 2495,
        currency: "USD"
    },
    countryCode: "US"
}

// the data sent in the /payments call

const paymentsData = {
    ...paymentMethodsData,
    reference: crypto.randomUUID(),
    returnUrl: "http://" + window.location.host + "/handleShopperRedirect",
    shopperEmail: "test@adyen.com",
    shopperReference: "123",
    redirectFromIssuerMethod: "POST",
    lineItems: [
        {
            "quantity": "1",
            "description": "Shoes",
            "id": "Item #1",
            "amountIncludingTax": "9000",
            "productUrl": "URL_TO_PURCHASED_ITEM",
            "imageUrl": "URL_TO_PICTURE_OF_PURCHASED_ITEM",
            "itemCategory": "PHYSICAL_GOODS"
        },
        {
            "quantity": "2",
            "description": "Socks",
            "id": "Item #2",
            "amountIncludingTax": "1000",
            "productUrl": "URL_TO_PURCHASED_ITEM",
            "imageUrl": "URL_TO_PICTURE_OF_PURCHASED_ITEM",
            "itemCategory": "PHYSICAL_GOODS"
        }
    ]
}
