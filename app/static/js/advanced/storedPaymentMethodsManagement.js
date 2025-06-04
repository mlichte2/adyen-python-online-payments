const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout, Dropin } = window.AdyenWeb;

async function startCheckout() {
  try {
    // Create a new session
    const paymentMethodsResponse = await fetch("/api/paymentMethods", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ...paymentMethodsData,
        shopperReference: "YOUR_SHOPPER_REFERENCE",
        amount: {
            value: 0,
            currency: "USD"
        },
        allowedPaymentMethods: ["scheme", "paypal"]
      })
    }).then((response) => response.json());

    const configuration = {
      paymentMethodsResponse: paymentMethodsResponse,
      clientKey,
      environment: "test",
      countryCode: paymentMethodsData.countryCode,
      showPayButton: true,
      translations: {
        "en-US": {
          "payButton": "Continue"
        }
      },
      onSubmit: async (state, component, actions) => {
        try {
          // Make a POST /payments request from your server.
          // const result = await makePaymentsCall(state.data, countryCode, locale, amount);]

          console.log("state:\n", state, "component:\n", component)

          requestData = {
            ...paymentsData,
            ...state.data, 
            authenticationData: {
                threeDSRequestData: {nativeThreeDS: "preferred"}
            },
            channel: "web"

          }

          console.log("requestData:\n", requestData)

          const paymentsResult = await fetch("/api/payments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ...requestData,
                shopperInteraction: "Ecommerce",
                storePaymentMethod: true,
                recurringProcessingModel: "CardOnFile",
                shopperReference: "YOUR_SHOPPER_REFERENCE",
                amount: {
                    value: 0,
                    currency: "USD"
                },
            })
          }).then((response) => response.json());

          console.log(paymentsResult)

          // If the /payments request from your server fails, or if an unexpected error occurs.
          if (!paymentsResult.resultCode) {
            actions.reject();
            return;
          }
     
          const {
            resultCode,
            action,
            order,
            donationToken
          } = paymentsResult;
     
          // If the /payments request request form your server is successful, you must call this to resolve whichever of the listed objects are available.
          // You must call this, even if the result of the payment is unsuccessful.
          console.log("handling /payments action:\n", action)
          actions.resolve({
            resultCode,
            action,
            order,
            donationToken,
          });
        
        } catch (error) {
          console.error("onSubmit", error);
          actions.reject();
        }
      },
      onAdditionalDetails: async (state, component, actions) => {
        try {
          // Make a POST /payments/details request from your server.
          const paymentsDetailsResult = await fetch("/api/paymentsDetails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(state.data)
          }).then((response) => response.json());
     
          // If the /payments/details request from your server fails, or if an unexpected error occurs.
          if (!paymentsDetailsResult.resultCode) {
            actions.reject();
            return;
          }
     
          const {
            resultCode,
            action,
            order,
            donationToken
          } = paymentsDetailsResult;
     
          // If the /payments/details request request from your server is successful, you must call this to resolve whichever of the listed objects are available.
          // You must call this, even if the result of the payment is unsuccessful.
          console.log("handling /payments/details action:\n", action)
          actions.resolve({
            resultCode,
            action,
            order,
            donationToken,
          });
        } catch (error) {
          console.error("onSubmit", error);
          actions.reject();
        }
      },
      onPaymentCompleted: (result, component) => {
        console.info("onPaymentCompleted", result, component);
        window.location.href = '/checkout/advanced/storedPaymentMethodsManagement'
      },
      onPaymentFailed: (result, component) => {
        console.info("onPaymentFailed", result, component);
        handleOnPaymentFailed(result, component);
      },
      onError: (error, component) => {
        console.error("onError", error.name, error.message, error.stack, component);
        window.location.href = "/result/error";
      },

      // allows removing of payment method
      

    };

    const paymentMethodsConfiguration = {
        card: {
            showBrandIcon: true,
            hasHolderName: false,
            holderNameRequired: false,
            placeholders: {
            cardNumber: "1234 5678 9012 3456",
            expiryDate: "MM/YY",
            securityCodeThreeDigits: "123",
            securityCodeFourDigits: "1234",
            holderName: "J. Smith",
            },
        },
        paypal: {
            // intent: "tokenize"
        }
        
    };

    // Start the AdyenCheckout and mount the element onto the 'payment' div.
    const adyenCheckout = await AdyenCheckout(configuration);
    const dropin = new Dropin(adyenCheckout, {
      paymentMethodsConfiguration: paymentMethodsConfiguration,
        showRemovePaymentMethodButton: true,
        onDisableStoredPaymentMethod: async (storedPaymentMethod, resolve, reject) => {
            console.log("removing payment method")
            const removeResponse = await fetch("/api/removePaymentMethod", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(
                    {
                        storedPaymentMethodId: storedPaymentMethod,
                        shopperReference: "YOUR_SHOPPER_REFERENCE"
                    })
                }
            )
            console.log(removeResponse)

            if (removeResponse.status != 200) {
                reject()
            } else {
                resolve()
            }
        }
    }).mount("#dropin-container");
  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details.");
  }
}

// Function to handle payment completion redirects
function handleOnPaymentCompleted(result) {
  const params = new URLSearchParams({
    // Add your key-value pairs here
    paymentResult: JSON.stringify(result),
  });
  switch (result.resultCode) {
    case "Authorised":
      window.location.href = `/result/success?${params.toString()}`;
      break;
    case "Pending":
    case "Received":
      window.location.href = `/result/pending?${params.toString()}`;
      break;
    default:
      window.location.href = `/result/error?${params.toString()}`;
      break;
  }
}

// Function to handle payment failure redirects
function handleOnPaymentFailed(result) {
  const params = new URLSearchParams({
    // Add your key-value pairs here
    paymentResult: JSON.stringify(result),
  });
  switch (result.resultCode) {
    case "Cancelled":
    case "Refused":
      window.location.href = `/result/failed?${params.toString()}`;
      break;
    default:
      window.location.href = `/result/error?${params.toString()}`;
      break;
  }
}

startCheckout();
