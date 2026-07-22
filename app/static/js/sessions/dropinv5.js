const clientKey = document.getElementById("clientKey").innerHTML;

async function createAdyenCheckout(session, paymentMethodsConfiguration) {
  return AdyenCheckout({
    session: session,
    clientKey,
    environment: "test",
    locale: "en_US",
    countryCode: "US",
    showPayButton: true,
    paymentMethodsConfiguration,
    onPaymentCompleted: (result, component) => {
      console.info("onPaymentCompleted", result, component);
      handleOnPaymentCompleted(result, session.id);
    },
    onPaymentFailed: (result, component) => {
      console.info("onPaymentFailed", result, component);
      handleOnPaymentFailed(result, session.id);
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
}

function handleOnPaymentCompleted(result, sessionId) {
  // Pass sessionId + sessionResult so the server can verify the outcome via
  // GET /sessions/{sessionId} instead of trusting the client-side result.
  const params = new URLSearchParams({
    sessionId: sessionId,
    sessionResult: result.sessionResult,
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

function handleOnPaymentFailed(result, sessionId) {
  const params = new URLSearchParams({
    sessionId: sessionId,
    sessionResult: result.sessionResult,
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

async function startCheckout() {
  try {
    const session = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }).then((response) => response.json());

    const paymentMethodsConfiguration = {
      card: {
        // showBrandIcon: true,
        // // hasHolderName: true,
        // // holderNameRequired: true,
        billingAddressRequired: true,
        billingAddressMode: "partial",
        disableIOSArrowKeys: false,
        // placeholders: {
        //   cardNumber: "1234 5678 9012 3456",
        //   expiryDate: "MM/YY",
        //   securityCodeThreeDigits: "123",
        //   securityCodeFourDigits: "1234",
        //   holderName: "J. Smith",
        // },
        data: {
          holderName: "Cardholder Name",
        },
      },
    };

    const checkout = await createAdyenCheckout(
      session,
      paymentMethodsConfiguration
    );

    checkout.create("dropin").mount("#dropin-container");
  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details");
  }
}

startCheckout();
