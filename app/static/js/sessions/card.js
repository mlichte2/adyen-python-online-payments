const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout, Card } = window.AdyenWeb;

// Function to create AdyenCheckout instance
async function createAdyenCheckout(session) {
  return AdyenCheckout({
    session: session,
    clientKey,
    environment: "test",
    locale: "en_US",
    beforeSubmit: (data, component, actions) => {
      console.dir(data);
      actions.resolve(data);
    },
    onPaymentCompleted: (result, component) => {
      console.info("onPaymentCompleted", result, component);
      handleOnPaymentCompleted(result.resultCode);
    },
    onPaymentFailed: (result, component) => {
      console.info("onPaymentFailed", result, component);
      handleOnPaymentFailed(result.resultCode);
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
    const session = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    }).then((response) => response.json());

    const checkout = await createAdyenCheckout(session);
    const card = new Card(checkout, {
      // // Optional configuration.
      billingAddressRequired: true, // when true show the billing address input fields and mark them as required.
      // showBrandIcon: true, // when false not showing the brand logo
      // hasHolderName: true, // show holder name
      // holderNameRequired: true, // make holder name mandatory
      // // configure placeholders
      // placeholders: {
      //   cardNumber: '1234 5678 9012 3456',
      //   expiryDate: 'MM/YY',
      //   securityCodeThreeDigits: '123',
      //   securityCodeFourDigits: '1234',
      //   holderName: 'J. Smith'
      // }
    }).mount("#component-container");
  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details");
  }
}

startCheckout();
