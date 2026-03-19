const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout } = window.AdyenWeb;

document.getElementById("pay-button").addEventListener("click", async () => {
  const cardNumber = document.getElementById("card-number").value;
  const expiryMonth = document.getElementById("expiry-month").value;
  const expiryYear = document.getElementById("expiry-year").value;
  const cvc = document.getElementById("cvc").value;
  const holderName = document.getElementById("holderName").value;

  // Construct the payment method object for raw card data
  const paymentMethod = {
    type: "scheme",
    number: cardNumber,
    expiryMonth: expiryMonth,
    expiryYear: expiryYear,
    cvc: cvc,
    holderName: holderName,
  };

  const requestData = {
    paymentMethod: paymentMethod,
    amount: {
      currency: "EUR",
      value: 1000,
    },
    reference: "YOUR_ORDER_NUMBER",
    shopperReference: "YOUR_UNIQUE_SHOPPER_ID",
    authenticationData: {
      threeDSRequestData: {
        nativeThreeDS: "preferred",
      },
    },
    browserInfo: {
      userAgent: navigator.userAgent,
      acceptHeader:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
      language: navigator.language,
      colorDepth: window.screen.colorDepth,
      screenHeight: window.screen.height,
      screenWidth: window.screen.width,
      timeZoneOffset: new Date().getTimezoneOffset(),
      javaEnabled: navigator.javaEnabled(),
    },
    billingAddress: {
      street: "Infinite Loop",
      houseNumberOrName: "1",
      postalCode: "1011DJ",
      city: "Amsterdam",
      country: "NL",
    },
    shopperEmail: "s.hopper@example.com",
    shopperIP: "192.0.2.1",
    channel: "web",
    origin: window.location.origin,
    returnUrl: "http://" + window.location.host + "/handleShopperRedirect",
  };

  try {
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    const result = await response.json();
    console.log("Payment response:", result);

    if (result.action) {
      console.log(
        "Action returned, 3DS authentication required:\n",
        result.action
      );
      const checkout = await AdyenCheckout({
        clientKey,
        environment: "test",
        locale: "en-US",
        countryCode: "NL",
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
            actions.resolve({ resultCode, action, order, donationToken });
          } catch (error) {
            console.error("onAdditionalDetails error:", error);
            actions.reject();
          }
        },
        onPaymentCompleted: (result, component) => {
          handlePaymentResult(result);
        },
        onPaymentFailed: (result, component) => {
          handlePaymentResult(result);
        },
        onError: (error, component) => {
          console.error("onError", error);
          window.location.href = "/result/error";
        },
      });
      // Create a modal overlay
      const modalOverlay = document.createElement("div");
      modalOverlay.id = "modal-overlay";
      modalOverlay.style.position = "fixed";
      modalOverlay.style.top = "0";
      modalOverlay.style.left = "0";
      modalOverlay.style.width = "100%";
      modalOverlay.style.height = "100%";
      modalOverlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
      modalOverlay.style.display = "flex";
      modalOverlay.style.alignItems = "center";
      modalOverlay.style.justifyContent = "center";
      modalOverlay.style.zIndex = "1000";

      // Create a modal container
      const modalContainer = document.createElement("div");
      modalContainer.id = "modal-container";
      modalContainer.style.backgroundColor = "#fff";
      modalContainer.style.padding = "20px";
      modalContainer.style.borderRadius = "8px";
      modalContainer.style.boxShadow = "0 4px 6px rgba(0, 0, 0, 0.1)";

      // Append container to overlay, and overlay to body
      modalOverlay.appendChild(modalContainer);
      document.body.appendChild(modalOverlay);

      checkout
        .createFromAction(result.action, { challengeWindowSize: "02" })
        .mount("#modal-container");
    } else {
      handlePaymentResult(result);
    }
  } catch (error) {
    console.error("Error making payment request:", error);
  }
});

function handlePaymentResult(result) {
  const params = new URLSearchParams({
    paymentResult: JSON.stringify(result),
  });

  if (result.resultCode === "Authorised") {
    window.location.href = `/result/success?${params.toString()}`;
  } else if (
    result.resultCode === "Pending" ||
    result.resultCode === "Received"
  ) {
    window.location.href = `/result/pending?${params.toString()}`;
  } else if (
    result.resultCode === "Refused" ||
    result.resultCode === "Cancelled"
  ) {
    window.location.href = `/result/failed?${params.toString()}`;
  } else {
    window.location.href = `/result/error?${params.toString()}`;
  }
}
