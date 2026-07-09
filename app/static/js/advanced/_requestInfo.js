/*

Below are some constants 

*/
const shopperReference = "YOUR_SHOPPER_REFERENCE";

// below is the data sent in the /paymentMethods call

const paymentMethodsData = {
  amount: {
    value: 6000,
    currency: "AUD",
  },
  countryCode: "AU",
  shopperReference: shopperReference,
  // blockedPaymentMethods: ["clicktopay"],
};

// the data + plus paymentMethodsData object sent in the /payments call

const paymentsData = {
  ...paymentMethodsData,
  reference: "TEST_123",
  returnUrl: window.location.origin + "/handleShopperRedirect",
  shopperEmail: "test@adyen.com",
  shopperReference: shopperReference,
  shopperInteraction: "Ecommerce",
  recurringProcessingModel: "CardOnFile",
  storePaymentMethod: true,
  lineItems: [
    {
      quantity: "1",
      description: "Shoes",
      id: "Item #1",
      amountIncludingTax: "9000",
      productUrl: "URL_TO_PURCHASED_ITEM",
      imageUrl: "URL_TO_PICTURE_OF_PURCHASED_ITEM",
      itemCategory: "PHYSICAL_GOODS",
    },
    {
      quantity: "2",
      description: "Socks",
      id: "Item #2",
      amountIncludingTax: "1000",
      productUrl: "URL_TO_PURCHASED_ITEM",
      imageUrl: "URL_TO_PICTURE_OF_PURCHASED_ITEM",
      itemCategory: "PHYSICAL_GOODS",
    },
  ],
  authenticationData: {
    threeDSRequestData: {
      nativeThreeDS: "preferred",
    },
  },
  deliveryAddress: {
    city: "Melbourne",
    country: "AU",
    houseNumberOrName: "167",
    postalCode: "3000",
    street: "Queen St"
    },
  channel: "Web",
  origin: window.location.origin,
};
