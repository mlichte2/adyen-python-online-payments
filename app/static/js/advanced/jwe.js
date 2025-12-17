async function encryptCardData(cardDetails) {
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

  const dateTimeString = new Date().toISOString();
  const objectToEncrypt = JSON.stringify({
    ...cardDetails,
    generationtime: dateTimeString,
  });

  const jwe = await new jose.CompactEncrypt(
    new TextEncoder().encode(objectToEncrypt)
  )
    .setProtectedHeader({ alg: "RSA-OAEP-256", enc: "A256GCM", version: "1" })
    .encrypt(rsaPublicKey);

  return jwe;
}

async function submitPayment(jwe) {
  const paymentData = {
    paymentMethod: {
      type: "scheme",
      encryptedCard: jwe,
      holderName: document.getElementById("holderName").value,
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
    // Here you would typically handle the response (e.g., redirect or handle actions)
  } catch (error) {
    console.error("Error making payment:", error);
  }
}

document
  .getElementById("encrypt-button")
  .addEventListener("click", async () => {
    const cardDetails = {
      number: document.getElementById("card-number").value,
      expiryMonth: document.getElementById("expiry-month").value,
      expiryYear: document.getElementById("expiry-year").value,
      cvc: document.getElementById("cvc").value,
    };
    const button = document.getElementById("encrypt-button");
    button.innerText = "Processing...";
    button.disabled = true;
    const jweBlob = await encryptCardData(cardDetails);
    await submitPayment(jweBlob);
    button.disabled = false;
    button.innerText = "Encrypt";
  });
