const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout, Klarna } = window.AdyenWeb;

// Function to create AdyenCheckout instance
async function createAdyenCheckout(session) {
  return AdyenCheckout({
    session: session,
    clientKey,
    environment: "test",
    amount: {
      value: 10000,
      currency: 'EUR'
    },
    locale: "en_US",
    countryCode: 'NL',
    showPayButton: true,
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
    const session = await fetch('/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    }).then(response => response.json());

    const checkout = await createAdyenCheckout(session);

    console.log(checkout.paymentMethodsResponse)

    const klarnaPaymentMethods = checkout.paymentMethodsResponse.paymentMethods.filter(
      (element) => 
        element.type == 'klarna' || 
        element.type == 'klarna_account' || 
        element.type == 'klarna_paynow'
    )

    for (let i = 0; i < klarnaPaymentMethods.length; i++) {
      const element = klarnaPaymentMethods[i];
      console.log(element)
      const klarna = new Klarna(checkout, {
        type: element.type, // Types: 'klarna_paynow' (pay now), 'klarna' (pay later), 'klarna_account' (pay over time)
        name: element.name,
        useKlarnaWidget: false,
      }).mount('#component-container-' + i);
      
    }


  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details");
  }
}

startCheckout();
