const clientKey = document.getElementById("clientKey").innerHTML;
const sessionId = document.getElementById("sessionId").innerHTML;
const redirectResult = document.getElementById("redirectResult").innerHTML;
const { AdyenCheckout } = window.AdyenWeb;

// Sessions flow: the shopper lands back on this page's returnUrl with
// sessionId + redirectResult (never sessionResult - see
// https://docs.adyen.com/online-payments/build-your-integration/sessions-flow/#handle-the-redirect).
// Submitting redirectResult is a client-side-only SDK call, so we
// re-initialize AdyenCheckout with the existing session and call
// submitDetails here. The resulting onPaymentCompleted/onPaymentFailed event
// carries result.sessionResult, which the /result/* routes use to verify the
// outcome server-side via GET /sessions/{sessionId}.
async function completeRedirect() {
  try {
    const checkout = await AdyenCheckout({
      session: { id: sessionId },
      clientKey,
      environment: "test",
      onPaymentCompleted: (result) => {
        console.info("onPaymentCompleted", result);
        handleOnPaymentCompleted(result, sessionId);
      },
      onPaymentFailed: (result) => {
        console.info("onPaymentFailed", result);
        handleOnPaymentFailed(result, sessionId);
      },
      onError: (error) => {
        console.error("onError", error.name, error.message, error.stack);
        window.location.href = "/result/error";
      },
    });

    checkout.submitDetails({ details: { redirectResult } });
  } catch (error) {
    console.error(error);
    window.location.href = "/result/error";
  }
}

function handleOnPaymentCompleted(result, sessionId) {
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

completeRedirect();
