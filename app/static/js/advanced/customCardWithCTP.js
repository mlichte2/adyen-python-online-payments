const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout, CustomCard, ClickToPay } = window.AdyenWeb;

// State management for the Custom Card component
let state = {
  isValid: false,
  data: {},
};

// Handles responses from your server
const handleServerResponse = (res, component) => {
  if (res.action) {
    // The component will handle the action as part of the payment flow
    component.handleAction(res.action);
  } else {
    // Redirect to the appropriate result page
    handleRedirect(res);
  }
};

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

// Makes a payment request to your server
const makePayment = async (data) => {
  try {
    const requestData = {
      ...paymentsData, // from _requestInfo.js
      ...data,
    };

    const response = await fetch("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    return await response.json();
  } catch (error) {
    console.error("Error making payment:", error);
    window.location.href = "/result/error";
  }
};

async function startCheckout() {
  try {
    const paymentMethodsResponse = await fetch("/api/paymentMethods", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentMethodsData),
    }).then((response) => response.json());

    console.log(paymentMethodsResponse);

    const checkout = await AdyenCheckout({
      paymentMethodsResponse: paymentMethodsResponse,
      clientKey,
      environment: "test",
      locale: "en_US",
      countryCode: paymentMethodsData.countryCode,
      amount: paymentsData.amount,
      onSubmit: async (state, component, actions) => {
        try {
          console.log("state:\n", state, "component:\n", component);

          let requestData = {
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

          if (!paymentsResult.resultCode) {
            actions.reject();
            return;
          }

          const { resultCode, action, order, donationToken } = paymentsResult;

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
          const paymentsDetailsResult = await fetch("/api/paymentsDetails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(state.data),
          }).then((response) => response.json());

          if (!paymentsDetailsResult.resultCode) {
            actions.reject();
            return;
          }

          const { resultCode, action, order, donationToken } =
            paymentsDetailsResult;

          console.log("handling /payments/details action:\n", action);
          actions.resolve({
            resultCode,
            action,
            order,
            donationToken,
          });
        } catch (error) {
          console.error("onAdditionalDetails", error);
          actions.reject();
        }
      },
      onPaymentCompleted: (result, component) => {
        console.info("onPaymentCompleted", result, component);
        handleRedirect(result);
      },
      onPaymentFailed: (result, component) => {
        console.info("onPaymentFailed", result, component);
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
    });

    const customCard = new CustomCard(checkout, {
      type: "card",
      brands: ["mc", "visa", "amex", "bcmc", "maestro"],
      autofocus: false,
      // Keep our local state object updated
      onChange: (newState) => {
        state = newState;
      },
      // Log which field is in focus
      onFocus: (event) => {
        // Remove 'focused' class from all previously focused fields
        document.querySelectorAll(".focused").forEach((el) => {
          el.classList.remove("focused");
        });

        console.log("Field focused:", event.fieldType);
        let focusedField = document.querySelector(
          `span[data-cse="${event.fieldType}"]`
        );
        console.log(focusedField);
        if (focusedField) {
          focusedField.classList.add("focused");
        }
      },
      styles: {
        base: {
          color: "black",
          fontSize: "16px",
          fontSmoothing: "antialiased",
          fontFamily: "Helvetica",
        },
        error: {
          color: "red",
        },
        placeholder: {
          color: "#d8d8d8",
        },
        validated: {
          color: "green",
        },
      },
      placeholders: {
        cardNumber: "Enter your card number",
        expiryDate: "MM/YY",
        securityCodeThreeDigits: "CVC",
        securityCodeFourDigits: "CVC",
      },
    }).mount("#customCard-container");

    const clickToPay = new ClickToPay(checkout, {
      shopperEmail: "test@adyen.com", // Used to recognize your shopper's Click to Pay account.
      onReady() {
        console.log("Component is ready to interact with the shopper");
      },
    });
    // Display the Component if the shopper is identified.
    clickToPay
      .isAvailable()
      .then(() => {
        clickToPay.mount("#clicktopay-container");
      })
      .catch((e) => {
        console.log(e);
      });

    // Create and mount the Pay button
    const payButton = document.createElement("button");
    payButton.innerText = "Pay";
    payButton.classList.add("button"); // Use existing CSS class for styling
    payButton.onclick = async () => {
      if (state.isValid) {
        payButton.disabled = true;
        payButton.innerText = "Processing...";
        const res = await makePayment(state.data);
        handleServerResponse(res, customCard);
      } else {
        // Trigger validation on all fields to show errors
        customCard.showValidation();
      }
    };

    document.getElementById("pay-button-container").appendChild(payButton);
  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details.");
  }
}

startCheckout();
