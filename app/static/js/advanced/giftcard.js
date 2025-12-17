const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout, Giftcard, Card } = window.AdyenWeb;

let checkout; // Will be initialized later

// Handles redirect logic
function handleRedirect(result) {
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
    case "Refused":
    case "Cancelled":
      window.location.href = `/result/failed?${params.toString()}`;
      break;
    default:
      window.location.href = `/result/error?${params.toString()}`;
      break;
  }
}

async function startCheckout() {
  try {
    const paymentMethodsResponse = await fetch("/api/paymentMethods", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(paymentMethodsData),
    }).then((r) => r.json());

    const giftcardConfiguration = {
      onBalanceCheck: async (resolve, reject, data) => {
        try {
          const balanceResponse = await fetch("/api/paymentMethods/balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ...data,
              amount: paymentMethodsData.amount,
            }),
          }).then((r) => r.json());
          console.log("Balance check response:", balanceResponse);
          localStorage.setItem("balanceResponse", balanceResponse);
          resolve(balanceResponse);
        } catch (error) {
          console.error("Balance check failed:", error);
          reject(error);
        }
      },
      onOrderRequest: async (resolve, reject, data) => {
        try {
          // 1 hour
          const utcExpiresAt =
            new Date(Date.now() + 60 * 60 * 1000).toISOString().split(".")[0] +
            "Z";
          const orderResponse = await fetch("/api/createOrder", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              amount: paymentsData.amount,
              reference: paymentsData.reference,
              expiresAt: utcExpiresAt,
            }),
          }).then((r) => r.json());
          console.log("Order creation response:", orderResponse);
          resolve(orderResponse);
        } catch (error) {
          console.error("Order creation failed:", error);
          reject(error);
        }
      },
      onOrderCancel: async (order) => {
        try {
          await fetch("/api/orders/cancel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ order }),
          });
          console.log("Order cancelled");
        } catch (error) {
          console.error("Order cancellation failed:", error);
        }
      },
    };

    const configuration = {
      paymentMethodsResponse,
      clientKey,
      environment: "test",
      countryCode: paymentMethodsData.countryCode,
      amount: paymentsData.amount,
      translations: {
        "en-US": {
          applyGiftcard: "Apply",
        },
      },
      onSubmit: async (state, component) => {
        console.log(component);
        giftcardBalanceResponse = localStorage.getItem("balanceResponse");
        try {
          let requestData;
          if (!state.data.order) {
            requestData = {
              ...paymentsData,
              ...state.data,
            };
          } else if (
            state.data.order &&
            state.data.paymentMethod.type == "giftcard"
          ) {
            requestData = {
              ...paymentsData,
              ...state.data,
              amount: giftcardBalanceResponse.balance,
            };
          } else if (
            state.data.order &&
            state.data.paymentMethod.type == "scheme"
          ) {
            requestData = {
              ...paymentsData,
              ...state.data,
              amount: checkout.options.order.remainingAmount,
            };
          } else {
            console.log("An uncaught exception has occurred");
            alert("An uncaught exception has occurred");
          }

          const paymentsResponse = await fetch("/api/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestData),
          }).then((r) => r.json());

          if (paymentsResponse.action) {
            component.handleAction(paymentsResponse.action);
          } else if (
            paymentsResponse.order &&
            paymentsResponse.order.remainingAmount.value > 0
          ) {
            // Handle partial payment: reload checkout with the updated order
            checkout.update({ order: paymentsResponse.order });
            checkout.update({
              amount: paymentsResponse.order.remainingAmount,
            });
          } else {
            handleRedirect(paymentsResponse); // Handle fully paid scenario
          }
        } catch (error) {
          console.error("Payment submission failed:", error);
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
        handleRedirect(result);
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

    checkout = await AdyenCheckout(configuration);

    const giftcardComponent = new Giftcard(checkout, giftcardConfiguration);

    giftcardComponent
      .isAvailable()
      .then(() => {
        giftcardComponent.mount("#giftcard-container");
      })
      .catch((e) => {
        console.warn("Gift card component is not available.");
      });

    const cardConfiguration = {};

    const cardComponent = new Card(checkout, cardConfiguration);
    cardComponent
      .isAvailable()
      .then(() => {
        cardComponent.mount("#card-container");
      })
      .catch((e) => {
        console.warn("Card component is not available.");
      });
  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details.");
  }
}

startCheckout();
