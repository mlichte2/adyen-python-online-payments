# Adyen Python Web Integration Demo

This project provides a sample web integration for Adyen Online Payments using a Python (Flask) backend. It's designed to demonstrate both the **Sessions Flow** and the **Advanced Flow**, allowing you to test and build out different payment components.

---

## Prerequisites

Before you begin, ensure you have the following installed:

- [**uv**](https://docs.astral.sh/uv/): An extremely fast Python package installer and resolver.

---

## 🚀 Getting Started

Follow these steps to get the application running locally.

1.  **Clone the Repository**

    ```bash
    git clone https://github.com/mlichte2/adyen-python-online-payments.git
    ```

2.  **Navigate to the Project Directory**

    ```bash
    cd adyen-python-online-payments
    ```

3.  **Configure Your Environment**
    Rename the `example.env` file to `.env` and populate it with your specific Adyen environment variables (API Key, Merchant Account, etc.).

4.  **Run the Setup Script**
    ```bash
    ./setup.sh
    ```
    > **Note:** This script uses `uv` to create a virtual environment (`.venv`) and install all the required Python packages from `requirements.txt`.

---

## ▶️ Running the Application

Once setup is complete, you can start the local server.

1.  **Start the Server**

    ```bash
    ./start.sh
    ```

2.  **Access the Application**
    Open your web browser and navigate to **[http://localhost:8080](http://localhost:8080)**.

3.  **Stopping the Server**
    To stop the running application, press `Ctrl + C` in your terminal.

---

## 📂 Project Structure

Here is a breakdown of the key files and directories.

- `app/`: Contains all server-side Python logic.

  - `app.py`: The main Flask application file. It handles URL routing and some API calls (e.g., `/paypal/updateOrder`, `/handleShopperRedirect`).
  - `main/`: Contains the core logic for making Adyen API requests, such as `/sessions`, `/paymentMethods`, `/payments`, and `/payments/details`.

- `static/`: Contains all client-side assets that are loaded by the browser.

  - `js/advanced/`: JavaScript for components using the Advanced Flow.
  - `js/sessions/`: JavaScript for components using the Sessions Flow.
  - `css/`: Stylesheets for the application.
  - `images/`: Static image assets.

- `templates/`: Contains HTML files rendered by Flask.
  - `home.html`: The main landing page that lists the available components.
  - `components/`: Individual HTML files for each payment component.

---

## ⚙️ Configuration & Customization

This project is designed to be easily configured for testing.

### Changing Request Parameters

- **Sessions Flow**

  - To modify the `/sessions` request body, edit the `request` variable in `app/main/sessions.py`.

- **Advanced Flow**
  - The JSON data for `/paymentMethods` and `/payments` calls is managed in `static/js/advanced/_requestInfo.js`.
  - `paymentMethodsData`: Contains the JSON for the `/paymentMethods` request.
  - `paymentsData`: Inherits all values from `paymentMethodsData` and adds the data for the `/payments` request.

### Changing Adyen Web Version

- The Adyen Web component version can be changed by editing the `WEB_VERSION` variable in `app/app.py`.
- _Note: This template is configured for Web Components v6.x. Older versions (v5) may require manual changes to the HTML files._

### Changing Adyen API Version

- The Checkout API version is set in your `.env` file via the `CHECKOUT_API_VERSION` variable.
- You must restart the server (`./start.sh`) for changes to this variable to take effect.

---

## ✨ How to Add a New Component

Follow these steps to add a new payment method component to the demo.

1.  **Create Component Files**

    - Create a new JavaScript file in `static/js/{flow}/` (where `{flow}` is either `advanced` or `sessions`).
    - Create a new HTML file in `templates/components/{flow}/`. A good practice is to copy an existing file (e.g., `card.html`) and modify it.

2.  **Link the JavaScript in Your HTML**

    - In your new HTML file, update the `<script>` tag to import your newly created JavaScript file. For example:
      ```html
      <script
        src="{{ url_for('static', filename='js/{flow}/your-new-component.js') }}"
        type="module"
      ></script>
      ```

3.  **Add the Component to the Homepage**
    - Open `app/templates/home.html`.
    - Under the correct heading (`Sessions Flow` or `Advanced Flow`), add a new list item (`<li>`) that links to your new component.
    - Set the `integration` parameter to match your HTML filename (without the `.html` extension).
      ```html
      <li class="integration-list-item" data-integration="your-new-component">
        <a href="/preview?integration=your-new-component">Your New Component</a>
      </li>
      ```

> **Example:** For a real-world example of adding a component, see this [commit on GitHub](https://github.com/mlichte2/adyen-python-online-payments/commit/fd3127d78d3b99bb4c0c6465995853ad9fc984b8).

---

## 🧑‍💻 Drop-in Demo Exercise

A sample file is available at `static/js/advanced/dropinDemo.js` for practicing a Drop-in integration with the Advanced flow. The backend is already configured to support it.

> Your task is to edit this `.js` file to mount and configure the Drop-in component by following the official Adyen documentation.
>
> **[Adyen Docs: Advanced Flow with Drop-in](https://docs.adyen.com/online-payments/build-your-integration/advanced-flow/?platform=Web&integration=Drop-in)**
