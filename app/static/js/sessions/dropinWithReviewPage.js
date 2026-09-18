const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout, Dropin } = window.AdyenWeb;

const dropinContainer = document.getElementById("dropin-container");
const reviewContainer = document.getElementById("review-page-container");
const actionContainer = document.getElementById("action-container");
const reviewSummary = document.getElementById("review-summary");
const reviewBackButton = document.getElementById("review-back-button");
const reviewConfirmButton = document.getElementById("review-confirm-button");

let adyenCheckout = null;
let currentSession = null;

// The PaymentData the SDK hands us in onReview. Held in memory only: this demo
// keeps the review page on the same page as the Drop-in (no navigation), so
// there's no need to persist it across a reload. See dropinWithSessionUpdate.js
// for the pattern this file is based on.
let reviewPaymentData = null;

async function startCheckout() {
  try {
    // Create a new session
    const session = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }).then((response) => response.json());

    currentSession = session;

    const configuration = {
      session: session,
      clientKey,
      environment: "test",
      locale: "en_US",
      countryCode: "US",
      showPayButton: true,
      // Called instead of an immediate payment call when the shopper clicks
      // Pay (the button reads "Continue" automatically while this is set).
      // Payment methods with their own native flow (PayPal, Klarna widget,
      // Apple/Google Pay, etc.) bypass this and submit directly.
      onReview: (state, component, reviewDetails) => {
        console.info("onReview", state, component, reviewDetails);
        showReviewPage(state, reviewDetails);
      },
      // Fires if checkout.processPayment(...) comes back with an action
      // (3DS2 challenge, redirect, QR code). We're responsible for mounting it.
      onAction: (actionElement) => {
        console.info("onAction", actionElement);
        showActionElement(actionElement);
      },
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
    adyenCheckout = await AdyenCheckout(configuration);
    new Dropin(adyenCheckout, {
      paymentMethodsConfiguration: paymentMethodsConfiguration,
    }).mount("#dropin-container");

    reviewBackButton.addEventListener("click", showDropin);
    reviewConfirmButton.addEventListener("click", confirmPayment);
  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details.");
  }
}

// Swap the Drop-in for the review page and render a summary from the
// PaymentData + reviewDetails onReview handed us.
function showReviewPage(state, reviewDetails) {
  reviewPaymentData = state;
  renderReviewSummary(state, reviewDetails);

  dropinContainer.classList.add("hidden");
  actionContainer.classList.add("hidden");
  actionContainer.innerHTML = "";
  reviewContainer.classList.remove("hidden");
  reviewConfirmButton.disabled = false;
}

// Let the shopper back out of the review page and pick a different payment
// method. Nothing server-side to undo: no payment call has been made yet.
function showDropin() {
  reviewPaymentData = null;
  reviewContainer.classList.add("hidden");
  actionContainer.classList.add("hidden");
  actionContainer.innerHTML = "";
  dropinContainer.classList.remove("hidden");
}

function renderReviewSummary(state, reviewDetails) {
  const amount = currentSession && currentSession.amount;
  const paymentMethodType =
    (state && state.paymentMethod && state.paymentMethod.type) || "selected method";

  const rows = [
    `<div class="review-summary-row"><span>Payment method</span><span>${escapeHtml(paymentMethodType)}</span></div>`,
  ];

  if (amount) {
    rows.push(
      `<div class="review-summary-row"><span>Amount</span><span>${escapeHtml(formatAmount(amount.value, amount.currency))}</span></div>`
    );
  }

  // Only populated when a partial payment order is in progress (e.g. gift
  // card + card). Absent for a normal single-payment checkout like this demo.
  const remainingAmount = reviewDetails && reviewDetails.orderStatus && reviewDetails.orderStatus.remainingAmount;
  if (remainingAmount) {
    rows.push(
      `<div class="review-summary-row"><span>Remaining balance</span><span>${escapeHtml(formatAmount(remainingAmount.value, remainingAmount.currency))}</span></div>`
    );
  }

  reviewSummary.innerHTML = rows.join("");
}

function formatAmount(value, currency) {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value / 100);
  } catch (error) {
    return `${value} ${currency}`;
  }
}

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value;
  return div.innerHTML;
}

// Resumes the flow from the review page: submits the PaymentData captured in
// onReview. Sessions-only (throws in the advanced flow). Internally calls
// session.submitPayment and drives onPaymentCompleted/onPaymentFailed/onAction
// on our configuration, same as a normal Drop-in submit.
function confirmPayment() {
  if (!adyenCheckout || !reviewPaymentData) {
    return;
  }

  reviewConfirmButton.disabled = true;
  adyenCheckout.processPayment(reviewPaymentData);
}

// Mount whatever action element onAction handed us (3DS2 challenge, redirect,
// QR code) into the review page in place of the summary/confirm button.
function showActionElement(actionElement) {
  actionContainer.innerHTML = "";
  actionContainer.classList.remove("hidden");
  actionElement.mount(actionContainer);
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
