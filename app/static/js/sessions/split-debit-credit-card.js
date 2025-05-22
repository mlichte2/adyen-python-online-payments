const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout, Card } = window.AdyenWeb;

// Function to create AdyenCheckout instance
async function createAdyenCheckout(session) {
  return AdyenCheckout(
    {
      session: session,
      clientKey,
      environment: "test",
      locale: "en_US",
      onPaymentCompleted: (result, component) => {
        console.info("onPaymentCompleted", result, component);
        handleOnPaymentCompleted(result.resultCode);
      },
      onPaymentFailed: (result, component) => {
        console.info("onPaymentFailed", result, component);
      handleOnPaymentFailed(result.resultCode);
      },
      onError: (error, component) => {
        console.error("onError", error.name, error.message, error.stack, component);
        window.location.href = "/result/error";
      },
    }
  );
}

// Function to handle payment completion redirects
function handleOnPaymentCompleted(resultCode) {
  switch (resultCode) {
    case "Authorised":
      window.location.href = "/result/success";
      break;
    case "Pending":
    case "Received":
      window.location.href = "/result/pending";
      break;
    default:
      window.location.href = "/result/error";
      break;
  }
}

// Function to handle payment failure redirects
function handleOnPaymentFailed(resultCode) {
  switch (resultCode) {
    case "Cancelled":
    case "Refused":
      window.location.href = "/result/failed";
      break;
    default:
      window.location.href = "/result/error";
      break;
  }
}

// Function to start checkout
async function startCheckout() {

  try {
    const session = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    }).then(response => response.json());

    const checkout = await createAdyenCheckout(session);

    console.log(checkout.paymentMethodsResponse)

    const debitCards = checkout.paymentMethodsResponse.paymentMethods.find(paymentMethod => paymentMethod.fundingSource === 'debit');

    if (debitCards) {
      const debitCard = new Card(checkout).mount('#debit-container');
    }

    const creditCards = checkout.paymentMethodsResponse.paymentMethods.find(paymentMethod => paymentMethod.fundingSource === 'credit');

    if (creditCards) {
      const creditCard = new Card(checkout).mount('#credit-container');
    }

  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details");
  }
}

startCheckout();