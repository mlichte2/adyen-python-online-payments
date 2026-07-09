async function createAdyenEncryptor() {
  const x509 = `-----BEGIN CERTIFICATE-----
MIICtzCCAZ+gAwIBAgIBATANBgkqhkiG9w0BAQsFADAOMQwwCgYDVQQDDANDU0Uw
HhcNMjUxMTE3MTgzNjUyWhcNMzUxMTE3MTgzNjUyWjAOMQwwCgYDVQQDDANDU0Uw
ggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCdmKpw0j+hyyB+30wIKSar
sNTejK5kF+XWtJDGq+nLFLakH31ubCmkvMTvj2PgeRljFVKUAKCgJhBMTEjEUCeE
SU3FFWmlbyQ7Y2uGyjGB2CY6ITB2FJbTR8cYIrQVX/ud3Jf7yIsK6fESpe0MBfGl
7+gRdCb3IpIehTB/ZAdDAqtCmlWKa+EWYTN0/thmHUiOIkrvV6kCjaXHC/g2Q1y1
RQtdTCocjVv+odePMFO0P9rVkaEdxjipTyNFeQDNctiAAz7tzPTrVSJr3sqn1BcG
mvpR33Ka9mSuwnHpUjxvouZz8s49lbh5zTKLiPuhAcEYXS9//l6JSvm1V66IVPRP
AgMBAAGjIDAeMAwGA1UdEwEB/wQCMAAwDgYDVR0PAQH/BAQDAgQQMA0GCSqGSIb3
DQEBCwUAA4IBAQAHLDur9tBlDziWQQEVb6RHmOMj+mXVwWUYxU4wDiLoYlRGWd3k
rnJJdKTJg0Ri7lFdGbYsJjmZ+xQhQXpinl420QmlOGuDwu3UD5CYJF5IKzQPOTBV
LxzBDRxP9l9fjLQ8StRDTVw3YkY/c0JJBn2C0QH66nvN+ClCe5c7PIfD9GWV3KMX
gWSm4ylKW4jxO9HzN8dUcTECht2pgQZwtDzhEZfhIOHQpuIxTT30EPKhQQEXqBsC
QqVEjGIHfTybniylohVgf8pkpPw316hhyXvZ72XwOA1LCYlbNCamdVYnfjhUclEM
fGeSU/E+jKG/+S9CIqszpeq8LOQFpQoMmmT
-----END CERTIFICATE-----`;

  const rsaPublicKey = await jose.importX509(x509, "RSA-OAEP-256");

  const encrypt = async (payload) => {
    const objectToEncrypt = JSON.stringify({
      ...payload,
      generationtime: new Date().toISOString(),
    });
    return new jose.CompactEncrypt(new TextEncoder().encode(objectToEncrypt))
      .setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM", version: "1" })
      .encrypt(rsaPublicKey);
  };

  return {
    encryptCardNumber: (number) => encrypt({ number }),
    encryptExpiryMonth: (expiryMonth) => encrypt({ expiryMonth }),
    encryptExpiryYear: (expiryYear) => encrypt({ expiryYear }),
    encryptSecurityCode: (cvc) => encrypt({ cvc }),
  };
}

async function submitPayment(encryptedData) {
  const paymentData = {
    paymentMethod: {
      type: "scheme",
      encryptedCardNumber: encryptedData.encryptedCardNumber,
      encryptedExpiryMonth: encryptedData.encryptedExpiryMonth,
      encryptedExpiryYear: encryptedData.encryptedExpiryYear,
      encryptedSecurityCode: encryptedData.encryptedSecurityCode,
      holderName: document.getElementById("holderName").value,
    },
    billingAddress: {
      street: "N/A",
      city: "N/A",
      country: "NL",
      postalCode: "N/A",
      stateOrProvince: "N/A",
    },
  };

  const requestData = {
    ...paymentsData, // from _requestInfo.js
    ...paymentData,
  };

  try {
    const response = await fetch("/api/payments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    });

    const responseJson = await response.json();
    console.log("/payments response:", responseJson);
    handleRedirect(responseJson);
  } catch (error) {
    console.error("Error making payment:", error);
  }
}

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

document
  .getElementById("encrypt-button")
  .addEventListener("click", async () => {
    const button = document.getElementById("encrypt-button");
    button.innerText = "Processing...";
    button.disabled = true;

    const encryptor = await createAdyenEncryptor();

    const encryptedData = {
      encryptedCardNumber: await encryptor.encryptCardNumber(
        document.getElementById("card-number").value
      ),
      encryptedExpiryMonth: await encryptor.encryptExpiryMonth(
        document.getElementById("expiry-month").value
      ),
      encryptedExpiryYear: await encryptor.encryptExpiryYear(
        document.getElementById("expiry-year").value
      ),
      encryptedSecurityCode: await encryptor.encryptSecurityCode(
        document.getElementById("cvc").value
      ),
    };

    await submitPayment(encryptedData);

    button.disabled = false;
    button.innerText = "Encrypt";
  });
