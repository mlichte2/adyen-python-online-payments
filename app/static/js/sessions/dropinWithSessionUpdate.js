const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout, Dropin } = window.AdyenWeb;

// Tracks the amount most recently applied via the "Update" button, so
// beforeSubmit can send it along when it PATCHes the server-side session.
// Stays null until the shopper updates the amount, in which case the server
// falls back to its own tracked total.
let pendingAmount = null;

async function startCheckout() {
  try {
    // Create a new session
    const session = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        "payable": false
      })
    }).then((response) => response.json());

    const configuration = {
      session: session,
      clientKey,
      environment: "test",
      locale: "en_US",
      countryCode: "US",
      showPayButton: true,
      onPaymentCompleted: (result, component) => {
        console.info("onPaymentCompleted", result, component);
        handleOnPaymentCompleted(result, session.id);
      },
      onPaymentFailed: (result, component) => {
        console.info("onPaymentFailed", result, component);
        handleOnPaymentFailed(result, session.id);
      },
      beforeSubmit: async (data, component, actions) => {
        try {
          // Get the latest session so the server can look up the id and the
          // encoded sessionData it needs to PATCH /sessions/{sessionId}.
          const { session } = component.core.session;

          const response = await fetch("/api/sessions", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              id: session.id,
              sessionData: session.sessionData,
              ...(pendingAmount && { amount: pendingAmount }),
            }),
          });

          if (!response.ok) {
            throw new Error(`Session update failed with status ${response.status}`);
          }

          const sessionUpdateResponse = await response.json();
          if (!sessionUpdateResponse.sessionData) {
            throw new Error("Session update response is missing sessionData");
          }

          // Forward the original submit data along with the refreshed
          // sessionData, otherwise the payment method details collected by
          // the Drop-in are dropped from the request.
          actions.resolve({ ...data, sessionData: sessionUpdateResponse.sessionData });
        }
        catch (error) {
          console.error("beforeSubmit", error);
          actions.reject();
        }
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

    const paymentMethodsConfiguration = {
      card: {
        showBrandIcon: true,
        hasHolderName: true,
        holderNameRequired: true,
        placeholders: {
          cardNumber: "1234 5678 9012 3456",
          expiryDate: "MM/YY",
          securityCodeThreeDigits: "123",
          securityCodeFourDigits: "1234",
          holderName: "J. Smith",
        },
      },
    };

    // Start the AdyenCheckout and mount the element onto the 'payment' div.
    const adyenCheckout = await AdyenCheckout(configuration);
    const dropin = new Dropin(adyenCheckout, {
      paymentMethodsConfiguration: paymentMethodsConfiguration,
    }).mount("#dropin-container");

    // Reflect a shopper-driven amount change (e.g. cart update) in the
    // Component immediately. This only updates what is displayed; it does
    // not touch the server-side session, so it can be called as often as
    // needed. shouldReinitializeCheckout: false avoids remounting the drop-in.
    const updateAmountButton = document.querySelector(".session-update-button");
    const amountInput = document.getElementById("sessionAmount");
    updateAmountButton.addEventListener("click", () => {
      // The input takes minor units directly (e.g. 4000 = $40.00 USD),
      // matching the "value" the rest of this demo uses for amounts.
      const enteredAmount = parseInt(amountInput.value, 10);
      if (isNaN(enteredAmount) || enteredAmount <= 0) {
        alert("Enter a valid amount, in minor units (e.g. 4000 = $40.00).");
        return;
      }

      const amount = {
        value: enteredAmount,
        currency: "USD",
      };
      pendingAmount = amount;
      adyenCheckout.update({ amount }, { shouldReinitializeCheckout: true });
    });
  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details.");
  }
}

// Function to handle payment completion redirects
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

// Function to handle payment failure redirects
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

startCheckout();
