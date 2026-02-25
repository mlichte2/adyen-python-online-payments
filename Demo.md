# Adyen Drop-in Integration Exercise (Web SDK v6)

Welcome to the Adyen Drop-in integration exercise! In this module, you will get hands-on experience building a seamless checkout flow by connecting a frontend JavaScript component (using the latest Adyen Web SDK v6) to a Python (Flask) backend.

## 🎯 Learning Objective

Your goal is to wire up the communication between the client (the shopper's browser), your server (the Flask app), and the Adyen API. By the end of this exercise, you will have a fully functioning checkout capable of rendering payment methods, processing payments, and handling advanced authentication like 3D Secure.

---

## 🏗️ Architecture & Payment Flow

Before you start writing code, it is crucial to understand how data moves through the system. The Adyen Drop-in handles the complex UI and client-side encryption, but it relies on your backend to securely communicate with Adyen APIs.

**The Checkout Lifecycle:**

1. **Shopper opens checkout:** The frontend requests available payment methods from your backend (`/api/paymentMethods`).
2. **Drop-in renders:** The frontend uses the response to mount and display the available payment options.
3. **Shopper pays:** The shopper submits their payment details. The frontend merges this encrypted state data with your core order data and sends it to your backend (`/api/payments`).
4. **Action handling:** If the payment requires additional action (like a 3D Secure redirect), the frontend handles it and sends the resulting data back to your server (`/api/paymentsDetails`).

---

## 📝 Instructions

You will find `TODO` comments scattered throughout the frontend JavaScript file. Complete the steps below to finish the integration.

### What's Important in Web SDK v6:

If you have used older versions of Adyen, notice these key v6 differences:

- **Initialization:** You must destructure `AdyenCheckout` and `Dropin` directly from the global `window.AdyenWeb` object.
- **Resolving Actions:** When you call `actions.resolve()`, you no longer pass the entire raw response. You must destructure and pass specific fields: `resultCode`, `action`, `order`, and `donationToken`.
- **Mounting:** You instantiate `AdyenCheckout` first, and then pass it into a new `Dropin` instance to mount it.

### Step-by-Step Implementation

1. **Initialize the SDK:** At the top of your file, destructure `AdyenCheckout` and `Dropin` from `window.AdyenWeb`.

2. **Configure the Endpoints:** Find the `fetch` requests inside `startCheckout()`, `onSubmit`, and `onAdditionalDetails`. Update the empty string URLs to point to your local Flask endpoints (`/api/paymentMethods`, `/api/payments`, and `/api/paymentsDetails`).

3. **Build the Request Payload:** Inside `onSubmit`, create a `requestData` object by spreading (`...`) both your pre-defined `paymentsData` and the Drop-in's `state.data`.

4. **Resolve & Reject Actions:** \* Check if `paymentsResult.resultCode` exists. If it doesn't, call `actions.reject()`.

   - If successful, destructure `{ resultCode, action, order, donationToken }` from your backend response and pass them into `actions.resolve()`. Repeat this logic inside `onAdditionalDetails`.

5. **Mount the Component:** At the bottom of `startCheckout()`, initialize `AdyenCheckout(configuration)`. Then, create a `new Dropin()` passing in the checkout instance and your `paymentMethodsConfiguration`. Finally, `.mount()` it to `#dropin-container`.

---

## 🚀 Running the Application

1. Ensure your `.env` or config file is populated with your Adyen `API_KEY`, `MERCHANT_ACCOUNT`, and `CLIENT_KEY`.
2. Start your Flask development server.
3. Navigate to your local checkout route (e.g., `http://localhost:8080/checkout/...`) and test the checkout flow using Adyen's test card numbers.
4. Check both your browser console and your terminal for payload logs to debug any issues!
