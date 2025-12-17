const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout, Card } = window.AdyenWeb;

async function createOrder() {
  const orderRequestData = {
    reference: "12345",
    amount: {
      value: 2500,
      currency: "EUR",
    },
    merchantAccount: "ChicagoTechSupport",
  };

  const response = await fetch("/api/createOrder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(orderRequestData),
  });

  return await response.json();
}
// split: array of numbers breaking down the amounts per card, -1 = remaining balance
async function startCheckout(split) {
  i = 0;
  try {
    // Create a new session
    const paymentMethodsResponse = await fetch("/api/paymentMethods", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentMethodsData),
    }).then((response) => response.json());

    orderResponseData = await createOrder();
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

          if (!state.data.order) {
            requestData = {
              ...paymentsData,
              ...state.data,
              amount: {
                value: split[i],
                currency: paymentsData.amount.currency,
              },
              order: {
                pspReference: orderResponseData.pspReference,
                orderData: orderResponseData.orderData,
              },
            };
            // for last
          } else if (split[i] == -1) {
            requestData = {
              ...paymentsData,
              ...state.data,
              amount: component.core.options.amount,
              order: {
                pspReference: state.data.order.pspReference,
                orderData: state.data.order.orderData,
              },
            };
          } else {
            requestData = {
              ...paymentsData,
              ...state.data,
              amount: {
                value: split[i],
                currency: paymentsData.amount.currency,
              },
              order: {
                pspReference: state.data.order.pspReference,
                orderData: state.data.order.orderData,
              },
            };
          }

          console.log("requestData:\n", requestData);

          const paymentsResult = await fetch("/api/payments", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(requestData),
          }).then((response) => response.json());

          console.log("payments result:\n", paymentsResult);

          // If the /payments request from your server fails, or if an unexpected error occurs.
          if (!paymentsResult.resultCode) {
            actions.reject();
            return;
          }

          const { resultCode, action, order, donationToken } = paymentsResult;

          console.log(paymentsResult);

          // If the /payments request request form your server is successful, you must call this to resolve whichever of the listed objects are available.
          // You must call this, even if the result of the payment is unsuccessful.
          console.log("handling /payments action:\n", action);
          actions.resolve({
            resultCode,
            action,
            order,
            donationToken,
          });
          i++;
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

    const cardConfig = {
      billingAddressRequired: false,
      hasHolderName: false,
    };

    const checkout = await AdyenCheckout(configuration);
    const card = await new Card(checkout, cardConfig).mount(
      "#component-container"
    );
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

startCheckout([1000, 1000, -1]);
