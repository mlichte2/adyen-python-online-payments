const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout, ApplePay } = window.AdyenWeb;

async function startCheckout() {
  try {
    // Create a new session
    const paymentMethodsResponse = await fetch("/api/paymentMethods", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentMethodsData),
    }).then((response) => response.json());

    const configuration = {
      paymentMethodsResponse: paymentMethodsResponse,
      clientKey,
      amount: paymentMethodsData.amount,
      environment: "test",
      countryCode: paymentMethodsData.countryCode,
      onSubmit: async (state, component, actions) => {
        try {
          // Make a POST /payments request from your server.
          // const result = await makePaymentsCall(state.data, countryCode, locale, amount);]

          console.log("state:\n", state, "component:\n", component);

          requestData = {
            ...paymentsData,
            ...state.data,
          };

          console.log("requestData:\n", requestData);

          const paymentsResult = await fetch("/api/payments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
          }).then((response) => response.json());

          console.log(paymentsResult);

          // If the /payments request from your server fails, or if an unexpected error occurs.
          if (!paymentsResult.resultCode) {
            actions.reject();
            return;
          }

          const { resultCode, action, order, donationToken } = paymentsResult;

          // If the /payments request request form your server is successful, you must call this to resolve whichever of the listed objects are available.
          // You must call this, even if the result of the payment is unsuccessful.
          console.log("handling /payments action:\n", action);
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
            body: JSON.stringify(state.data),
          }).then((response) => response.json());

          // If the /payments/details request from your server fails, or if an unexpected error occurs.
          if (!paymentsDetailsResult.resultCode) {
            actions.reject();
            return;
          }

          const { resultCode, action, order, donationToken } =
            paymentsDetailsResult;

          // If the /payments/details request request from your server is successful, you must call this to resolve whichever of the listed objects are available.
          // You must call this, even if the result of the payment is unsuccessful.
          console.log("handling /payments/details action:\n", action);
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
        handleOnPaymentCompleted(result, component);
      },
      onPaymentFailed: (result, component) => {
        console.info("onPaymentFailed", result, component);
        handleOnPaymentFailed(result, component);
      },
      onError: (error, component) => {
        console.error(
          "onError",
          error.name,
          error.message,
          error.stack,
          component
        );
        window.location.href = "/result/error";
      },
    };

    applePayConfig = {};

    const checkout = await AdyenCheckout(configuration);
    const applePay = new ApplePay(checkout, applePayConfig);
    applePay
      .isAvailable()
      .then(() => {
        applePay.applePayCapabilities().then((capabilities) => {
          // Check whether the person has an active payment method in their wallet.
          console.log(capabilities.paymentCredentialStatus);
          switch (capabilities.paymentCredentialStatus) {
            case "paymentCredentialsAvailable":
              // Display an Apple Pay button and offer Apple Pay as the primary payment option.
              applePayComponent.mount("#component-container");
            case "paymentCredentialStatusUnknown":
              // Display an Apple Pay button and offer Apple Pay as a payment option.
              applePayComponent.mount("#component-container");
            case "paymentCredentialsUnavailable":
            // Optionally, display an Apple Pay button.
            case "applePayUnsupported":
            // Do not show an Apple Pay button or offer Apple Pay.
          }
        });
      })
      .catch((e) => {
        console.log(e);
      });
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
