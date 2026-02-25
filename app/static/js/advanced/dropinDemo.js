// TODO: Ensure your HTML contains an element with id="clientKey" containing your Adyen Client Key
const clientKey = document.getElementById("clientKey").innerHTML;

// TODO: Destructure AdyenCheckout and Dropin from the global AdyenWeb object
const { AdyenCheckout, Dropin } = window.AdyenWeb;

// TODO: Define the payment requirements (amount, currency, countryCode, etc.)
// Example: const paymentMethodsData = { amount: { currency: "EUR", value: 1000 }, countryCode: "NL" };
const paymentMethodsData = {
  /* Add your payment methods fetch data here */
};

// TODO: Define any additional core data needed for the /payments request (like reference or shopper info)
const paymentsData = {
  /* Add your core payment request data here */
};

async function startCheckout() {
  try {
    // TODO: Replace the empty string "" with your backend endpoint for fetching payment methods (e.g., "/api/paymentMethods")
    const paymentMethodsResponse = await fetch("", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentMethodsData),
    }).then((response) => response.json());

    const configuration = {
      paymentMethodsResponse: paymentMethodsResponse,
      clientKey,
      amount: paymentMethodsData.amount, // TODO: Ensure paymentMethodsData.amount is defined
      environment: "test", // TODO: Change to "live" when deploying to production
      countryCode: paymentMethodsData.countryCode,
      showPayButton: true,

      onSubmit: async (state, component, actions) => {
        try {
          console.log("state:\n", state, "component:\n", component);

          // TODO: Construct your requestData by spreading both paymentsData and the Drop-in state.data
          const requestData = {
            /* ...paymentsData, ...state.data */
          };

          console.log("requestData:\n", requestData);

          // TODO: Replace "" with your backend endpoint to initiate a payment (e.g., "/api/payments")
          const paymentsResult = await fetch("", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
          }).then((response) => response.json());

          console.log(paymentsResult);

          // TODO: If the /payments request from your server fails, call actions.reject()
          // Hint: Check if paymentsResult.resultCode exists
          if (/* Add failure condition here */ false) {
            actions.reject();
            return;
          }

          // TODO: Destructure the expected fields (resultCode, action, order, donationToken)
          // from paymentsResult and pass them into actions.resolve()

          /* const { resultCode, action, order, donationToken } = paymentsResult;
          actions.resolve({ resultCode, action, order, donationToken }); 
          */
        } catch (error) {
          console.error("onSubmit", error);
          actions.reject();
        }
      },

      onAdditionalDetails: async (state, component, actions) => {
        try {
          // TODO: Replace "" with your backend endpoint for submitting additional details (e.g., "/api/paymentsDetails")
          const paymentsDetailsResult = await fetch("", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(state.data),
          }).then((response) => response.json());

          // TODO: If the request from your server fails, call actions.reject()
          if (/* Add failure condition here */ false) {
            actions.reject();
            return;
          }

          // TODO: Destructure the expected fields and pass them into actions.resolve(), just like in onSubmit
        } catch (error) {
          console.error("onAdditionalDetails", error);
          actions.reject();
        }
      },

      onPaymentCompleted: (result, component) => {
        console.log("onPaymentCompleted", result, component);
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
        // Ensure you have a corresponding "/result/error" route handled by your frontend
        window.location.href = "/result/error";
      },
    };

    // TODO: Configure specific payment methods if needed (e.g., hiding cardholder names, styling Apple Pay)
    const paymentMethodsConfiguration = {
      /* card: { ... },
      klarna: { ... }
      */
    };

    // TODO: Initialize AdyenCheckout with the configuration, then create and mount the Dropin
    // Ensure your HTML contains a container like: <div id="dropin-container"></div>
    const adyenCheckout = await AdyenCheckout(configuration);

    /* const dropin = new Dropin(adyenCheckout, {
      paymentMethodsConfiguration: paymentMethodsConfiguration,
    }).mount("#dropin-container"); 
    */
  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details.");
  }
}

// Function to handle payment completion redirects
function handleOnPaymentCompleted(result) {
  const params = new URLSearchParams({
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

// Initialize the checkout process
startCheckout();
