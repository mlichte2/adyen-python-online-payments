const clientKey = document.getElementById("clientKey").innerHTML;
const { AdyenCheckout, PayPal } = window.AdyenWeb;


// Function to create AdyenCheckout instance
async function createAdyenCheckout(session) {
  return AdyenCheckout(
    {
      session: session,
      clientKey,
      environment: "test",
      locale: "en_US",
      countryCode: 'NL',
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
      }
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
    const paypalConfig = {
      isExpress: true,
      userAction: "continue",
      onShippingAddressChange: async function(data, actions, component) {
        // Example: not shipping to NL.
        // if (data.shippingAddress.countryCode == 'NL') {
        //     return actions.reject();
        // }
 
        // Get the current paymentData value stored within the Component.
        const currentPaymentData = {
          'sessionId': component.core.session.session.id,
          'paymentData': component.paymentData,
          'data': data,
          'sessionAmount': session.amount
        };
 
        // Implement the code to call your backend endpoint to update the final amount based on the selected delivery method, passing the paymentData.

        const response = await fetch('/api/shippingMethods', {
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(currentPaymentData)
        });

        const paymentData = await response.json()

        // Update the Component paymentData value with the new one.
        component.updatePaymentData(paymentData.paymentData);

        console.log('onShippingAddressChange: success')
      },
      onShippingOptionsChange: async function(data, actions, component) {
        console.log(data, component)
 
        // Get the current paymentData value stored within the Component.
        const currentPaymentData = {
          'sessionId': component.core.session.session.id,
          'paymentData': component.paymentData,
          'data': data,
          'sessionAmount': session.amount
        };
 
        // Implement the code to call your backend endpoint to update the final amount based on the selected delivery method, passing the paymentData.
        const response = await fetch('/api/shippingMethods', {
          method: "POST",
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(currentPaymentData)
        });

        const paymentData = await response.json()

        // Update the Component paymentData value with the new one.
        component.updatePaymentData(paymentData.paymentData);
        console.log('onShippingOptionsChange: success')
      
      },
      onAuthorized: async function(data, actions) {
        finalData = await data
        // logic to reject shipping to PO boxes since street address info is not available in onShippingAddressChange nor onShippingOptionsChange
          if (finalData.deliveryAddress.street.toUpperCase().includes("P.O.")) {
            console.log("onAuthorized failed: \n")
            console.log(JSON.stringify(finalData))
            actions.reject()
          } else {
            console.log("onAuthorized success: \n")
            console.log(JSON.stringify(finalData))
            setTimeout(1000)
            actions.resolve()
          }

      },

    }
    const paypal = new PayPal(checkout, paypalConfig).mount('#component-container');

  } catch (error) {
    console.error(error);
    alert("Error occurred. Look at console for details");
  }
}

startCheckout();